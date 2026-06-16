# NODEPROOF

**Full-node possession proof, verified-validator tier.**

A `NODEPROOF` action records an on-chain, quorum-signed **verdict** asserting which
validators answered a periodic *possession challenge*, proving they run a real
coin full node rather than mirroring the decoder/indexer DBs via `xchain-sync`.
The verified set earns the full-node tranche of the oracle-round reward (see
`PRICE` / `validator_rewards`); light mirrors keep the base tranche only.

> **Scope (v1):** BTC chain only. Capability staking and oracle-round reward
> derivation are BTC-only, so the proof (and the verified set it produces) live
> on BTC. Proving full nodes for other chains is a later extension.

## Why a verdict, not a broadcast challenge

The challenge is **derived deterministically from the chain**, not broadcast.
Every node (full *and* light, including the indexer) can recompute a challenge's
identity from on-chain data; only a node with a real coin full node can compute
the **answer**. This avoids leader election, per-challenge fees, and the
non-determinism of "who broadcasts the challenge." The only thing that reaches
the wire is the federation's signed verdict over who answered correctly, exactly
the trust model of `ATTEST v1` (the indexer verifies signatures + schedule; the
federation verifies the off-chain fact).

## The derived challenge

For each **epoch height** `E` where `E % CHALLENGE_INTERVAL_BLOCKS == 0`:

- `seed   = ledger_hash(E)` ; the indexer's stored per-block ledger hash at `E`
  (deterministic and identical across every honest node).
- `target = E − CONFIRM_DEPTH`: a *buried* block (reorg-stable) whose contents
  the possession query targets.
- `challenge_id = SHA256( NETWORK ":" E ":" seed ":" target )`.

Full-node verifiers map `seed` to a concrete query inside the `target` block:
`tx_index = int(seed) mod txcount`, `vout = int(seed[16:]) mod voutcount`, answer
= that output's **`scriptPubKey` (hex)**. This datum is *provably absent* from a
synced mirror: the decoder stores no `scriptPubKey`, no raw tx/block bytes, no
non-XChain transactions, and no UTXO set. The within-block mapping and the answer
are resolved entirely by the verifiers (who have the block); the indexer never
needs them; it only recomputes `challenge_id` and trusts the quorum.

## Wire format

```
NODEPROOF|0|CHALLENGE_ID|EPOCH_HEIGHT|PASS_COUNT|PASS_PK_1|…|PASS_PK_n|SIG_COUNT|PUBKEY_1|SIG_1|…|PUBKEY_m|SIG_m
```

| Field | Meaning |
|---|---|
| `VERSION` | `0` (verdict; the only on-chain form) |
| `CHALLENGE_ID` | 64-hex; MUST equal the derived id for `EPOCH_HEIGHT` |
| `EPOCH_HEIGHT` | the challenge epoch block; MUST be a multiple of `CHALLENGE_INTERVAL_BLOCKS` |
| `PASS_COUNT` / `PASS_PK_i` | validators that produced the correct answer (64-hex Ed25519 pubkeys) |
| `SIG_COUNT` / `PUBKEY_i`,`SIG_i` | verifier signatures over the canonical message (64-hex pubkey, 128-hex sig): consensus token name is `PUBKEY` (matches ANCHOR/ATTEST/PRICE) |

Validator-broadcast (like `ATTEST v1`); not VM-emitted, not user-meaningful.
Writes **no ledger rows**, rewards are derived later in `PRICE` finalization.

### Canonical signed message

```
canon = CHALLENGE_ID "|" EPOCH_HEIGHT "|" sort(lower(PASS_PK))[ join "," ]
```

At/above the EQUIV flag-day the canonical is wrapped with the uniform header
(`TAG = XNODEPROOF`, `ROUND_ID = CHALLENGE_ID`, `VIEW = 0`); below it, the bare
bytes. **CONSENSUS-CRITICAL:** the indexer's `_buildCanonical` and the hub's
publisher MUST agree byte-for-byte.

## Indexer validation (`actions/nodeproof.js`)

1. BTC-only; `EPOCH_HEIGHT % CHALLENGE_INTERVAL_BLOCKS == 0`, `EPOCH_HEIGHT ≤
   BLOCK_INDEX`, `BLOCK_INDEX − EPOCH_HEIGHT ≤ VERDICT_ACCEPT_WINDOW_BLOCKS`
   (verdicts must land promptly, bounds replay + reorg exposure), `target ≥ 0`.
2. Recompute `challenge_id` from `ledger_hash(EPOCH_HEIGHT)`; reject on mismatch
   or unknown epoch block. This binds the verdict to real chain history.
3. **Eligible verifiers** at `snapshotBlock = EPOCH_HEIGHT` =
   `verified_full_nodes(EPOCH_HEIGHT) ∪ GENESIS_VERIFIERS`. Quorum =
   `floor(2·V/3) + 1` over `V = |eligible|`. `V == 0` ⇒ reject (no one can
   vouch, feature dormant until `GENESIS_VERIFIERS` is seeded).
4. Verify each signature: signer ∈ eligible set, valid Ed25519 over the
   canonical, deduped. Require `validSigners ≥ quorum`.
5. For each `PASS_PK` that **holds `full_node` capability stake at
   `EPOCH_HEIGHT`**, write a `full_node_verifications` row (idempotent on
   `(epoch_height, signing_pubkey)`).

A validator is **verified as of block `B`** (verifier-eligible; it may vouch in
later verdicts) iff it has a `passed` `full_node_verifications` row with
`block_index ∈ (B − PROOF_WINDOW_BLOCKS, B]` *and* still holds `full_node`
capability stake at `B`.

**Reward eligibility is participation-rate based; a carrot, with NO slashing.**
A staking **source** earns the full-node reward tranche at block `B` only if, over
the trailing `REWARD_PASS_WINDOW_BLOCKS`, it answered at least `MIN_PASS_RATE_BPS`
of the challenge epochs that *actually produced a verdict* (the denominator counts
only epochs the federation ran, so an outage never costs anyone). The set is
deduped by staking **source** (one operator = one full node = one share). The gate
is integer math (`passed_epochs · 10000 ≥ MIN_PASS_RATE_BPS · total_epochs`) so
it is forgiving of a missed check or two and reindex-deterministic. A validator
that doesn't run a full node simply fails the challenges, earns nothing, and is
**never penalised**: its `full_node` bond is untouched (there is no
failed-challenge slash). See `db.getFullNodeParticipation` + `PRICE`.

### Bootstrap / degradation

With no seeded `GENESIS_VERIFIERS` and no verified nodes, no verdict can reach
quorum → the verified set is empty → the full-node tranche rolls back into the
base tranche (see `PRICE`) → behavior is identical to pre-feature. The mechanism
activates as the operator seeds genesis verifiers and independent full nodes join
and get verified, at which point verified nodes (not just genesis) can vouch for
new joiners.

## Config (`STAKING.CAPABILITIES.full_node`, `FULLNODE`)

| Key | Default | Meaning |
|---|---|---|
| `CAPABILITIES.full_node.MIN_STAKE` | `2000.00000000` | entrance stake to claim the capability |
| `FULLNODE.CHALLENGE_INTERVAL_BLOCKS` | `144` | epoch cadence (~daily on BTC) |
| `FULLNODE.CONFIRM_DEPTH` | `100` | target-block burial (reorg safety) |
| `FULLNODE.PROOF_WINDOW_BLOCKS` | `300` | how long a passed proof keeps a node "verified" (verifier-eligible: can vouch) |
| `FULLNODE.VERDICT_ACCEPT_WINDOW_BLOCKS` | `24` | max lag from epoch to accepted verdict |
| `FULLNODE.REWARD_SHARE` | `'0'` | fraction of the oracle-round budget routed to full nodes (raise to `'0.25'` to enable: see `PRICE`) |
| `FULLNODE.REWARD_PASS_WINDOW_BLOCKS` | `1008` | trailing window the reward pass-rate is measured over (= 7 daily challenge epochs) |
| `FULLNODE.MIN_PASS_RATE_BPS` | `7000` | min pass rate to earn the tranche, in basis points (`7000` = 70% → pass ≥5 of 7, miss up to 2) |
| `FULLNODE.GENESIS_VERIFIERS` | `[]` | bootstrap verifier pubkeys (operator) |

## Reorg safety

`full_node_verifications` rows carry the verdict's `action_index` and
`block_index`; the generic action-rollback removes them on reorg exactly like any
other action's rows. The `(epoch_height, signing_pubkey)` unique key makes
re-recording on replay idempotent.

## Related

- `PRICE`: oracle-round reward derivation (two-tranche split).
- `validator_rewards` / `COLLECT`, reward ledger + claim.
- `ATTEST`: the signature-verification / responsible-set template this models on.
