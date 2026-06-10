<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform — Cross-Chain DEX

This document describes how the XChain DEX settles trades **across chains** — a token on one
chain (e.g. BTC) traded for a token on another (e.g. LTC), with each side settling on its own
chain. Same-chain (local) order/swap matching is unchanged; see [`ORDER`](./actions/ORDER.md)
and [`SWAP`](./actions/SWAP.md).

## The problem

Each chain's indexer only sees its own database. No single indexer can see a counterparty's
offer on another chain, and no single indexer can move tokens on another chain. So a cross-chain
trade needs a party that watches **both** chains, confirms the two offers match, and tells each
chain to settle its side.

## The model — validators verify, indexers settle from escrow

When a user posts a cross-chain `ORDER`/`SWAP` (`GET_COIN` ≠ the posting chain), the GIVE side is
**escrowed locally on its home chain**, exactly like a same-chain offer. The trade is then matched
and settled by the **xchain-hub validator federation**:

1. **Discover** — the federation polls each chain's open cross-chain offers
   (`getopencrosschainorders`).
2. **Match** — a compatible pair is found. A cross-chain **`SWAP`** is exact, single-fill, FCFS; a
   cross-chain **`ORDER`** matches on a **price-time book** and may be **partially filled** across
   several matches (see [ORDER offers & partial fills](#order-offers--partial-fills)).
3. **Finalize + sign** — the federation reaches consensus and signs a single **match record**
   with `2f+1` `cross_chain`-capable validator signatures.
4. **Deliver** — the signed match is written to the hub's `cross_chain_matches` table and
   **streamed to every indexer over the existing hub-DB mirror** — the same channel that already
   carries `price_snapshots`/`oracle_prices`. **There is no per-trade on-chain transaction.**
5. **Settle** — each indexer reads the match from its local mirror, **verifies the signatures**,
   and **releases its leg's escrow to the counterparty's payout address** as an internal
   `CROSS_SETTLE` action (like the existing same-chain `SWAP_MATCH` — no on-chain tx).
6. **Retract** — if a source order is rolled back by a chain reorg, the federation retracts the
   match (mirror deletion) and any indexer that settled rolls its leg back.

Because both sides are **pre-escrowed**, there is no payment that can bounce — settlement is just
"release from escrow," so a single phase is sufficient (no reserve/commit handshake).

## Trust model

Every indexer **verifies the `2f+1` validator signatures before settling**. The mirror is a
*transport*, not a trusted authority: a corrupted or lagging mirror can **delay or withhold** a
settlement (a liveness/DoS concern) but **cannot forge** one — the signatures won't verify. Trust
rests on the `cross_chain` validator set, decentrally, exactly as for on-chain validator actions.

## The match record (`cross_chain_matches`)

A finalized match is symmetric and describes both legs:

| field | meaning |
|---|---|
| `match_id` | deterministic `sha256` of `network` + both order refs (each with its `*_filled_before` offset) + `snapshot_block` (order-independent) |
| `snapshot_block` | BTC-anchored block; selects the `cross_chain` validator set for verification |
| `network` | `mainnet`/`testnet`/`regtest`; signed into the canonical so a match can only settle on the network it was matched on |
| `a_chain,a_action_index,a_kind,a_tick,a_amount,a_filled_before,a_ownership,a_payout_addr` | order A (canonical-lower side); payout = A's receive address on B's chain |
| `b_*` | order B |
| `effective_time` | wall-clock instant indexers apply at (the only shared clock across chains) |
| `validator_signatures` | JSON `[{pubkey,sig}]`, `2f+1` over the canonical match |
| `status` | `finalized` / `retracted` |
| `batch_root` / `anchor_txid` | optional — the DOGE audit anchor (below) |

Two fields make a record a **fill** rather than a whole-offer match:
- **`a_kind`/`b_kind`** — `swap` (exact, single-fill) or `order` (partial-fillable). Settlement
  branches on this: a `swap` leg releases its full escrow and completes; an `order` leg releases
  only this match's fill and completes only once nothing remains.
- **`a_amount`/`b_amount`** are the **fill settled by *this* match** (for a `swap`, that equals the
  full offer). **`a_filled_before`/`b_filled_before`** are each offer's cumulative committed amount
  *before* this fill — so two sequential partial fills of the same order pair at the same
  `snapshot_block` produce **distinct `match_id`s** and are individually signed and settled.

**Settlement direction:** on A's chain, A's escrow releases `a_amount` to `b_payout_addr`; on B's
chain, B's escrow releases `b_amount` to `a_payout_addr`.

### Canonical signing string
Validators sign, and indexers verify, the UTF-8 bytes of:
```
XMATCH|match_id|snapshot_block|a_chain|a_action_index|a_tick|a_amount|a_ownership|a_payout_addr|b_chain|b_action_index|b_tick|b_amount|b_ownership|b_payout_addr|effective_time|network|a_kind|a_filled_before|b_kind|b_filled_before
```
(`a_tick`/`b_tick` empty when null; `a_kind`/`b_kind` default `swap` and `*_filled_before` default
`0` for a whole-offer match. `a` is the canonical-lower chain. The four fill fields are **appended
after `network`** so a `swap` record's leading bytes are unchanged from Phase 1.) A signature counts only if
its pubkey is in the `cross_chain` set at `snapshot_block` **and** the Ed25519 signature verifies.
The trailing `network` binds the match to its network: an indexer settles a match only when the
match's `network` equals its own, and because `network` is inside the signed bytes a match
finalized on one network can never be replayed onto another (e.g. regtest → mainnet).

## Validator-set propagation (why it's required)

Capability staking is **BTC-only**, so a non-BTC indexer has no local `cross_chain` stakes to verify
against. The hub therefore persists the block-boundary `cross_chain` validator set to
`capability_snapshots` and **mirrors it to every indexer** (same channel as the matches). A non-BTC
indexer resolves the set for a match's `snapshot_block` from this mirror; presence in the snapshot
means *qualified*. Without this, off-BTC chains could not verify cross-chain matches.

## Determinism

- **When:** each indexer applies a match at the first block whose `block_time ≥ effective_time`.
  Wall-clock is used because chains have independent block heights.
- **Sync barrier:** the block loop waits (`waitForMatchSync`) until the local match mirror has
  caught up to the block's time, so every operator of a chain settles the same matches at the same
  block — never against a stale mirror.
- **Idempotency / reorg:** each settled leg is recorded in `cross_chain_settlements` (action-indexed),
  so a match settles once per chain and a reorg drops the record and re-applies cleanly. Each partial
  fill has a distinct `match_id`, hence its own settlement row — partial fills accumulate against the
  same local order independently.

## ORDER offers & partial fills

A cross-chain **`ORDER`** is a resting book entry: it can be filled across several matches, each a
fraction of the offer, with price-time priority. (A cross-chain `SWAP` remains exact, single-fill.)

- **Open book.** `getopencrosschainorders` returns each chain's open cross-chain `SWAP` **and**
  `ORDER` offers (tagged `kind`); `ORDER` offers also carry `give_remaining`/`get_remaining`.
- **Reservation is mirror-derived.** The federation never over-fills an order's escrow: an offer's
  **effective remaining = full give − Σ fill amounts of finalized (non-retracted) matches** that
  reference it (computed from the mirrored `cross_chain_matches` table alone). This is deterministic
  across nodes and restarts and is the authoritative reservation source — it does not depend on the
  indexer-reported remaining, which lags until the indexer's settlement pass runs.
- **Matching mirrors the local book.** Price-time priority (earlier offer = maker), the maker's
  price-cross gate, and the bottleneck-clamped fill quantity reproduce the same arithmetic the
  indexer uses for same-chain `ORDER` matching (`order_match.js`), so a federation-computed fill and
  the indexer's `getOrderAmountsRemaining` stay consistent. SWAP↔ORDER cross-matching is not yet
  supported (a swap matches only another swap; an order only another order).
- **Settlement.** Each fill releases only `a_amount`/`b_amount` from the local order's escrow and
  records the fill so the order's remaining drops; the order is marked `complete` only once nothing
  remains, otherwise it stays `open` for further fills.

## On-chain match archive & full-parse recovery (`ANCHOR`)

Because settlement is mirror-driven, `cross_chain_matches` records are the one consensus-relevant
dataset that does not natively live on any chain. The [`ANCHOR`](./actions/ANCHOR.md) action
closes that gap: the federation periodically publishes, on **DOGE only**:

- **v0 checkpoints** — quorum-signed per-chain state-hash commitments (the indexer `blocks`
  hash triple), giving light clients a verifiable root for any chain's state; and
- **v1/v2 match archives** — the full `cross_chain_matches` records themselves (including
  `validator_signatures` and the `capability_snapshots` rows needed to re-verify them),
  compressed and batched.

This **does not gate settlement** (settlement remains mirror-driven and verifies `2f+1`
signatures as above); it guarantees that a full parse of the three chains, with no surviving hub
database, can rebuild the match set via the recovery tool (`xchain-indexer/src/recovery.js`) and
re-derive identical state. A match retracted after being archived is re-published in a later
batch with `status=retracted`; recovery applies latest-status-wins by `batch_seq`.

The earlier hub-side raw `XDEXANCHOR` payload (Merkle-root-only, not a protocol action) is
superseded by `ANCHOR` — the root-only design could *verify* a surviving copy of the match set
but could not *reconstruct* one from chain data alone.

## Residual reorg risk

The federation finalizes a match only after both source orders are confirmed N-deep, and retraction
+ rollback unwind any leg if a source order is later reorged. A deep reorg unwinding one escrow after
both legs settled is the residual risk — bounded by the per-chain confirmation depth, the same bound
any cross-chain settlement design carries.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
