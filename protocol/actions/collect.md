<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - COLLECT
This action collects all accrued validator rewards to the broadcasting address.

## PARAMS
| Name      | Type   | Description    |
| --------- | ------ | -------------- |
| `VERSION` | String | Format Version |
| `AMOUNT`  | String | Optional trailing partial-claim amount; absent = claim the full unclaimed total |

## Formats

### Version `0`
- `VERSION[|AMOUNT]`

## Examples
```
COLLECT|0
Collect all accrued validator rewards for the broadcasting address
```

```
COLLECT|0|25
Collect 25 XCHAIN of the accrued rewards; the remainder stays pending and collectible later
```

## Partial Claim (optional AMOUNT)
The trailing `AMOUNT` is activated by the `PARTIAL_UNSTAKE_COLLECT` protocol change (mainnet: the coordinated [contract-era flag day](../flag-days.md#contract-era-flag-day); testnet/regtest: genesis). Semantics:

- **Absent**: claim the full unclaimed total, byte-identical to the historical behavior
- **Present (at/after the flag-day)**: claim only `AMOUNT`; the remainder stays pending
- **Present (below the flag-day)**: ignored (full claim), matching what a pre-upgrade node parses
- An `AMOUNT` equal to the full unclaimed total is treated exactly as absent
- An `AMOUNT` of zero, malformed, finer than 8 decimals, or greater than the unclaimed total is rejected; over-asks are never clamped
- The reward-pool coverage check applies to the claimed amount, so a partial claim can succeed while the pool cannot yet cover the full pending total

## Rules
- BTC chain only
- Broadcasting address must have an active stake (gated by the 6-block activation delay)
- Broadcasting address must have unclaimed rewards greater than 0
- Rewards are paid by **debiting the reward pool address** and crediting the broadcasting address; XCHAIN is never minted by `COLLECT`
- The reward pool must hold enough XCHAIN to cover the full claim, or the `COLLECT` is rejected (see Reward Funding)

## Reward Sources

Rewards accumulate from multiple validator activities, all stored in the indexer's `validator_rewards` table:

| Reward Type | Earned By | Trigger |
|---|---|---|
| `oracle_round` | Validator with `price` capability | Legacy label, no consensus rail mints it today (see Reward Population Path); when minted with `FULLNODE.REWARD_SHARE` at 0: signature included in the on-chain PRICE v0 action of a finalized price round; the full per-round budget is split equally across all qualified signers |
| `oracle_base` | Validator with `price` capability | Active-regime label, not minted by any consensus rail today; when `FULLNODE.REWARD_SHARE` > 0: the base tranche of the per-round budget, split equally across all qualified signers; replaces `oracle_round` once the full-node reward tier is activated |
| `oracle_full_node` | Validator with `price` and `full_node` capabilities | Active-regime only, not minted by any consensus rail today: the full-node tranche of the per-round budget, split equally across verified full-node sources that signed the round and met the trailing `MIN_PASS_RATE_BPS` participation threshold |
| `attest_fee` | Validator with `attestation` capability | Share of the request fee for a fulfilled ATTEST request |
| `rollcall_publish` | Validator elected as the roll-call publisher | The elected leader of a rolled ROLLCALL epoch receives the frozen `ROLLCALL_REWARD_AMOUNT`, minted by the BTC-side epoch close; an unrolled epoch mints none (see [ROLLCALL](rollcall.md)) |
| `anchor_bundle` | Validator with `oracle_publish` capability | Publishing an ANCHOR v0 checkpoint cycle or, at or above that network's `ANCHOR_FOLD_ACTIVATION`, a v3 folded cycle: one reward per (network, SNAPSHOT_BLOCK), whether or not the byte budget split the cycle into multiple physical bundles or an archive section rode along |
| `anchor_archive` | Validator with `oracle_publish` capability | Publishing an ANCHOR v1 archive batch below that network's `ANCHOR_FOLD_ACTIVATION`; [retired at the fold](./anchor.md#version-3-only), so no v3, folded or not, mints one; rows below the fold height stay readable, and a network that never arms the fold keeps minting it through v1 |

## Reward Population Path

Reward rows reach the indexer's `validator_rewards` table only by derivation during block processing; the hub push rail is retired:

- **Oracle labels:** `oracle_round`, `oracle_base` and `oracle_full_node` are the labels the split uses, but the indexer's PRICE v0 parse derives no reward rows today, so no consensus rail mints them. The hub keeps its own local ledger of per-round splits (`ORACLE_REWARD_PER_ROUND`) for visibility; it is not a COLLECT source.
- **Derived (replayable):** `attest_fee` splits a fulfilled request's fee across its responsible set, and `rollcall_publish` is minted to the elected publisher at the ROLLCALL epoch close. A reindex reproduces these rows exactly.
- **Anchor rewards, derived at or above the reward flag-day:** `anchor_bundle` and `anchor_archive` each have their own boundary, `ANCHOR_REWARD_ACTIVATION` and `ARCHIVE_REWARD_ACTIVATION` in `protocol/constants.js` (mainnet 961000 and 963000; both genesis-active on testnet and regtest). At or above its own flag-day the type's reward is DERIVED by every indexer from the on-chain ANCHOR bytes, the elected `PUBLISHER` plus a quorate `XANCPUB` attestation, crediting the frozen reward amount and never an amount from the wire, so a chain parse reproduces the row exactly. For `anchor_bundle`, both the attestation and derived reward are keyed per (network, SNAPSHOT_BLOCK); repeated tails on physical bundles from a byte-budget split deduplicate to one attestation and one reward. Below it the hub federation recorded the reward when the anchor published and pushed it via the `pushvalidatorrewards` JSON-RPC endpoint (now retired and answering method-not-found); those historical rows a chain parse cannot re-derive, so they ride the ANCHOR v1 archive and are restored by full-parse recovery (see [ANCHOR](anchor.md)).

`COLLECT` queries the indexer's `validator_rewards` table directly. No hub round-trip during transaction processing.

## Replayability

`COLLECT` validation sums unclaimed rewards **earned at or before the COLLECT's own block** (`validator_rewards.block_index <= BLOCK_INDEX`). The scope is a no-op live (rows never carry a future block), but it makes every historical claim replay identically on a reindex or ANCHOR full-parse recovery, bulk-restored reward rows can never become visible to an earlier COLLECT than they were when it confirmed.

## Reward Funding

XCHAIN is a fixed-supply token: a permanent `MAX_SUPPLY` cap is set at genesis, but supply starts at zero (no pre-mint) and is created only by minting, whether as a pinned genesis distribution credit or a public mint, up to the cap (see [GAS](../../concepts/gas.md)). Rewards are therefore **not minted**; they are paid out of a dedicated **reward pool address** (`config['ADDRESS']['REWARD']`, BTC only). A valid `COLLECT` debits the pool for the reward amount and credits the broadcasting address, leaving total XCHAIN supply unchanged.

The pool is seeded by the operator after the mint window opens (Step 2 of the [XCHAIN Genesis](../../operations/xchain-genesis.md) runbook, since supply is zero at genesis) and **topped up manually** (an ordinary XCHAIN `SEND` to the pool address). Because the balance check reads the pool at the action's block/action index, every validator computes the same accept/reject outcome.

If the pool cannot cover the full pending reward, the `COLLECT` is rejected with `invalid: insufficient reward pool`. The claim is recorded as invalid, so the reward **remains unclaimed and fully collectible later**; the validator simply re-broadcasts `COLLECT` once the pool has been replenished. No rewards are lost or partially paid.

```mermaid
flowchart TD
    D1["Indexer computes attest_fee / rollcall_publish<br>during block processing"]
    D2["Indexer derives anchor_bundle / anchor_archive<br>from the on-chain ANCHOR bytes<br>(at or above that type's reward flag-day)"]
    P1["Hub federation recorded anchor_bundle / anchor_archive<br>reward on publish (below the flag-day)"]
    P2["Pushed via pushvalidatorrewards JSON-RPC<br>(retired, method removed; pre-flag-day history only)"]
    VR[("validator_rewards table")]
    C1["COLLECT sums unclaimed rewards<br>at or before its own block"]
    C2{"Reward pool holds<br>enough XCHAIN?"}
    C3["Debit reward pool address,<br>credit broadcasting address"]
    C4["Rejected: insufficient reward pool<br>(reward stays unclaimed, collectible later)"]

    D1 -->|"derived, replayable"| VR
    D2 -->|"derived, replayable"| VR
    P1 --> P2
    P2 -->|"pushed, archived via ANCHOR v1"| VR
    VR --> C1
    C1 --> C2
    C2 -->|"yes"| C3
    C2 -->|"no"| C4
```

## Notes
- Rewards accrue continuously while the address holds an active stake
- By default all pending rewards are collected in a single action; a partial claim is available via the optional trailing `AMOUNT` (see Partial Claim above)
- Rewards may be collected at any time while a stake is active
- Rewards can also be collected after initiating `UNSTAKE` during the cooldown period
- A single pubkey can earn from multiple capabilities in the same round, e.g. a validator with both `price` and `oracle_publish` capabilities can earn the per-round consensus reward AND the per-publish broadcast reward in the same round

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
