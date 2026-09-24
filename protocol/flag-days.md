<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->
<!-- GENERATED FILE. Do not edit: run `node bin/generate-flag-days.js`. -->

# Flag-Day Values

**This page is generated** from `xchain-indexer/src/protocol_changes.js`, its part files
under `src/protocol_changes/`, the time-keyed activation modules beside them, and
`protocol/constants.js`. Do not edit it by hand: run `node bin/generate-flag-days.js`
from the repository root and commit the result.

Every other page in this documentation set names the **gate** and links here
instead of quoting a date, because a flag-day value is not a fact about the
protocol, it is the current setting of a constant, and it has been repinned
before. One generated page moves on a repin; a dozen sentences do not.

For what a flag day is, how `isEnabled` evaluates it, which cohort a gate
belongs to, and what happens to a node that misses one, see
[Protocol Activation](./protocol-activation.md).

## Canonical activation maps

These names are exported by [`protocol/constants.js`](./constants.js). The index includes
scheduled, inert, genesis-active, time-keyed, and height-keyed maps so a gate remains
discoverable here even when it has no mainnet date for the table below.

- `AMOUNT_REPRESENTABILITY_ACTIVATION`
- `ANCHOR_ACTIVATION`
- `ANCHOR_ATTEST_BARRIER_ACTIVATION`
- `ANCHOR_REWARD_ACTIVATION`
- `ANCHOR_REWARD_DERIVE_ACTIVATION`
- `ARCHIVE_REWARD_ACTIVATION`
- `ATTEST_ADMISSION_ACTIVATION`
- `ATTEST_BROADCAST_FEE_ACTIVATION`
- `ATTEST_RELAY_ACTIVATION`
- `ATTEST_REQUEST_CAP_ACTIVATION`
- `ATTEST_RESPONSE_MIRROR_ACTIVATION`
- `ATTEST_RESPONSIBLE_WIDENING_ACTIVATION`
- `ATTEST_ZERO_CONF_ACTIVATION`
- `BATCH_SUBCOMMAND_OUTPUT_CAPTURE_ACTIVATION`
- `CHECKPOINT_COMMITMENT_ACTIVATION`
- `CROSS_CHAIN_ROYALTY_ACTIVATION`
- `DISPENSER_CANCEL_GRACE_ACTIVATION`
- `DISPENSER_EXPIRY_REALIGN_ACTIVATION`
- `DISPENSER_FRESHNESS_SHAPE_ACTIVATION`
- `ENVELOPE_CARRIER_RECOGNITION_ACTIVATION`
- `ENVELOPE_RECOGNITION_ACTIVATION`
- `EQUIV_HEADER_ACTIVATION`
- `LIST_OWNER_ACTIVATION`
- `MIRROR_ADMISSION_ACTIVATION`
- `MIRROR_ADMISSION_CONSUMER_ACTIVATION`
- `ORACLE_FEE_OUTPUT_ACTIVATION`
- `ORACLE_FEE_SET_CAPTURE_ACTIVATION`
- `PRICE_BATCHING_FLOOR_ACTIVATION`
- `PRICE_FEE_BATCH_LANDED_ACTIVATION`
- `PRICE_PAIR_WIDEN_ACTIVATION`
- `PRICE_SIG_TALLY_ACTIVATION`
- `PRICE_ZERO_VALIDITY_ACTIVATION`
- `RETRACTION_SIGNING_ACTIVATION`
- `ROLLCALL_ACTIVATION`
- `ROLLCALL_GATES_ACTIVATION`
- `SNAPSHOT_BURIAL_ACTIVATION`
- `STAKE_KEY_REUSE_ACTIVATION`
- `STAKE_WEIGHTED_QUORUM_ACTIVATION`
- `STATE_COMMITMENT_ACTIVATION`
- `SWEEP_ZERO_LEG_ACTIVATION`
- `TICK_NAMESPACE_ACTIVATION`
- `TOKEN_BRIDGE_ACTIVATION`
- `TOKEN_POLICY_INHERITANCE_ACTIVATION`
- `TRAIN_ACTIVATION`
- `XCHAIN_BRIDGE_ACTIVATION`

## Contract-era flag day

The coordinated instant that the **Cohort A** contract-era rules switch on,
simultaneously on Bitcoin, Litecoin, and Dogecoin.

| | |
|---|---|
| **Mainnet block time** | `1786060800` |
| **UTC instant** | 2026-08-07 00:00:00 UTC |
| **Gates riding it** | 37 |

5 gates do not ride it and carry a date of its own: `BATCH_ISSUANCE_LIMITS` at 2026-08-16 00:00:00 UTC, `CONTRACT_DELEGATION_MATERIALIZE` at 2026-09-15 00:00:00 UTC, `DISPENSER_ORACLE_PER_TOKEN_PRICE` at 2026-09-15 00:00:00 UTC, `CROSS_CHAIN_ROYALTY` at 2027-01-01 00:00:00 UTC, `REST_PATTERN_METER` at 2027-01-01 00:00:00 UTC. Each carries the reason it is armed separately in its registration comment, in the file the **Declared in** column names below. For how a gate is evaluated and what happens to a node that misses one, see [Protocol Activation](./protocol-activation.md).

**One gate is UNARMED on mainnet** (`UNCAPPED_MAX_SUPPLY_ZERO`): each parks the sentinel rather than an instant, so mainnet has **never** run the post-activation behavior and will not until an operator names a date. They carry no row in the table below, because publishing the sentinel as a flag day would put a commitment on this page that nobody made. Each names its reason in its registration comment under `xchain-indexer/src/protocol_changes/`. This note covers the registry only; a sibling `*_activation.js` module can park a mainnet sentinel too, and those are not enumerated here.

**Testnet and regtest are genesis-active** for the time-keyed gates: they carry
threshold `0`, so a testnet or regtest stack has always run the
post-activation behavior. 4 gates are the exception: `ISSUE_INHERITED_MINT_WINDOW` arms testnet at `1787961600` (2026-08-29 00:00:00 UTC), `DEPLOY_DEFERRED_ASSEMBLY` arms testnet at `1788868800` (2026-09-08 12:00:00 UTC), `CONTRACT_META_REQUIRED` arms testnet at `1789257600` (2026-09-13 00:00:00 UTC), `UNIFIED_FEES_SWEEP_CALLBACK` arms testnet at `1790812800` (2026-10-01 00:00:00 UTC). The reason it cannot be genesis-active there is written in its registration comment under `xchain-indexer/src/protocol_changes/`. The values on this page are otherwise mainnet values only.

## Mainnet time-keyed gates

| Gate | Block time | UTC instant | Rides | Declared in |
|---|---|---|---|---|
| `ATTEST_CANONICAL_LOWERCASE_ID` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `ATTEST_RELAY_ORIGIN` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `BATCH_SUBACTION_NORMALIZATION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `COINPAY_EXPIRE_TOKEN_AMOUNT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `COINPAY_NATIVE_RECIPROCITY` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `CONTRACT_INDEX_CANONICAL` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `CONTROLLER_GUARD` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_1.js` |
| `COOLDOWN_BLOCKS_INTEGER` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `DELEGATE_REVOKE_NO_REINSERT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `DEPLOY_BASE64_CODE` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_1.js` |
| `DEPLOY_INIT_STRICT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `DEPLOY_SLASH_DEST_ADDRESS_VALID` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `DISPENSE_CANCELLING_MATCH_ACTIVATION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/gates_1.js` |
| `DISPENSER_CAPS_ACTIVATION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/gates_1.js` |
| `DISPENSER_CLOSE_PER_UNIT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `DISPENSER_OWNERSHIP_CANCEL_ACTIVATION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/gates_1.js` |
| `FIX_OUTPUT_FANOUT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `ISSUANCE_FEE_EMISSION_EXEMPT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_1.js` |
| `ISSUE_MINT_SUPPLY_CUMULATIVE_CAP` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `LEGACY_FEE_NUMERIC_DBHITS` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_4.js` |
| `LOCK_MAX_SUPPLY_EXACT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `MINT_SELF_MINTED_ONLY` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_1.js` |
| `NATIVE_FEE_PRICE_TIME_GATE` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `PARTIAL_UNSTAKE_COLLECT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_4.js` |
| `SLEEP_RESPECTS_LOCK_SLEEP` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `SYNTH_EXEC_TX_HASH` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `UNSTAKE_CONTRACT_COOLDOWN_STRICT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `UNSTAKE_COOLDOWN_COMPLETION_ACTION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_3.js` |
| `VM_ATTESTATION_GETRESPONSE` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `VM_BALANCE_TOKENINFO` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_1.js` |
| `VM_BANNED_ASYNC` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `VM_LINT_HARDENING` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `VOTE_BINDING_MINIMUMS` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_1.js` |
| `VOTE_CALLBACK_TIMELOCK` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_1.js` |
| `VOTE_POLL_TICK_VISIBLE` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_2.js` |
| `VOTE_RESPECTS_SLEEP` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_1.js` |
| `XCALL_RESULT_ORPHAN_RETIREMENT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes/changes_4.js` |
| `BATCH_ISSUANCE_LIMITS` | `1786838400` | 2026-08-16 00:00:00 UTC | own date | `protocol_changes/changes_4.js` |
| `CONTRACT_DELEGATION_MATERIALIZE` | `1789430400` | 2026-09-15 00:00:00 UTC | own date | `protocol_changes/changes_3.js` |
| `DISPENSER_ORACLE_PER_TOKEN_PRICE` | `1789430400` | 2026-09-15 00:00:00 UTC | own date | `protocol_changes/changes_2.js` |
| `CROSS_CHAIN_ROYALTY` | `1798761600` | 2027-01-01 00:00:00 UTC | own date | `protocol_changes/changes_2.js` |
| `REST_PATTERN_METER` | `1798761600` | 2027-01-01 00:00:00 UTC | own date | `protocol_changes/changes_2.js` |

Thresholds keyed on a **block height** rather than a block time (the
validator-era Cohort B rules and the per-chain Cohort C rules) are not listed
here; they are inventoried on
[Protocol Activation](./protocol-activation.md#the-three-cohorts).
