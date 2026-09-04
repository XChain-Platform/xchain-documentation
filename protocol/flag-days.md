<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->
<!-- GENERATED FILE. Do not edit: run `node bin/generate-flag-days.js`. -->

# Flag-Day Values

**This page is generated** from `xchain-indexer/src/protocol_changes.js` and the
time-keyed activation modules beside it. Do not edit it by hand: run
`node bin/generate-flag-days.js` from the repository root and commit the result.

Every other page in this documentation set names the **gate** and links here
instead of quoting a date, because a flag-day value is not a fact about the
protocol, it is the current setting of a constant, and it has been repinned
before. One generated page moves on a repin; a dozen sentences do not.

For what a flag day is, how `isEnabled` evaluates it, which cohort a gate
belongs to, and what happens to a node that misses one, see
[Protocol Activation](./protocol-activation.md).

## Contract-era flag day

The coordinated instant that the **Cohort A** contract-era rules switch on,
simultaneously on Bitcoin, Litecoin, and Dogecoin.

| | |
|---|---|
| **Mainnet block time** | `1786060800` |
| **UTC instant** | 2026-08-07 00:00:00 UTC |
| **Gates riding it** | 37 |

4 gates do not ride it and carry a date of its own: `BATCH_ISSUANCE_LIMITS` at 2026-08-16 00:00:00 UTC, `CONTRACT_DELEGATION_MATERIALIZE` at 2026-09-15 00:00:00 UTC, `DISPENSER_ORACLE_PER_TOKEN_PRICE` at 2026-09-15 00:00:00 UTC, `CROSS_CHAIN_ROYALTY` at 2027-01-01 00:00:00 UTC. Each carries the reason it is armed separately in its registration comment, in the file the **Declared in** column names below. For how a gate is evaluated and what happens to a node that misses one, see [Protocol Activation](./protocol-activation.md).

**7 gates are UNARMED on mainnet** (`BATCH_COST_WEIGHTING`, `BATCH_ROOT_SUB_INDEX`, `CROSS_SETTLE_CAP`, `EMISSION_ISSUANCE_LIMITS`, `ISSUE_INHERITED_MINT_WINDOW`, `UNCAPPED_MAX_SUPPLY_ZERO`, `UNIFIED_FEES_SWEEP_CALLBACK`): each parks the sentinel rather than an instant, so mainnet has **never** run the post-activation behavior and will not until an operator names a date. They carry no row in the table below, because publishing the sentinel as a flag day would put a commitment on this page that nobody made. Each names its reason in its registration comment in `protocol_changes.js`. This note covers the registry only; a sibling `*_activation.js` module can park a mainnet sentinel too, and those are not enumerated here.

**Testnet and regtest are genesis-active** for the time-keyed gates: they carry
threshold `0`, so a testnet or regtest stack has always run the
post-activation behavior. One gate is the exception: `ISSUE_INHERITED_MINT_WINDOW` arms testnet at `1787961600` (2026-08-29 00:00:00 UTC). The reason it cannot be genesis-active there is written in its registration comment in `protocol_changes.js`. The values on this page are otherwise mainnet values only.

**One gate is UNARMED on testnet** (`UNIFIED_FEES_SWEEP_CALLBACK`): testnet carries the sentinel rather than `0`, so a testnet stack has **never** run the post-activation behavior and will not until an operator arms it. A consensus change registered after the public testnet launch cannot be genesis-active there without re-deciding history that outside nodes have already committed. Each names its reason in its registration comment in `protocol_changes.js`.

## Mainnet time-keyed gates

| Gate | Block time | UTC instant | Rides | Declared in |
|---|---|---|---|---|
| `ATTEST_CANONICAL_LOWERCASE_ID` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `ATTEST_RELAY_ORIGIN` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `BATCH_SUBACTION_NORMALIZATION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `COINPAY_EXPIRE_TOKEN_AMOUNT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `COINPAY_NATIVE_RECIPROCITY` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `CONTRACT_INDEX_CANONICAL` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `CONTROLLER_GUARD` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `COOLDOWN_BLOCKS_INTEGER` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `DELEGATE_REVOKE_NO_REINSERT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `DEPLOY_BASE64_CODE` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `DEPLOY_INIT_STRICT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `DEPLOY_SLASH_DEST_ADDRESS_VALID` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `DISPENSE_CANCELLING_MATCH_ACTIVATION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `dispense_cancelling_match_activation.js` |
| `DISPENSER_CAPS_ACTIVATION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `dispenser_caps_activation.js` |
| `DISPENSER_CLOSE_PER_UNIT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `DISPENSER_OWNERSHIP_CANCEL_ACTIVATION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `dispenser_ownership_cancel_activation.js` |
| `FIX_OUTPUT_FANOUT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `ISSUANCE_FEE_EMISSION_EXEMPT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `ISSUE_MINT_SUPPLY_CUMULATIVE_CAP` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `LEGACY_FEE_NUMERIC_DBHITS` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `LOCK_MAX_SUPPLY_EXACT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `MINT_SELF_MINTED_ONLY` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `NATIVE_FEE_PRICE_TIME_GATE` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `PARTIAL_UNSTAKE_COLLECT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `SLEEP_RESPECTS_LOCK_SLEEP` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `SYNTH_EXEC_TX_HASH` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `UNSTAKE_CONTRACT_COOLDOWN_STRICT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `UNSTAKE_COOLDOWN_COMPLETION_ACTION` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `VM_ATTESTATION_GETRESPONSE` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `VM_BALANCE_TOKENINFO` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `VM_BANNED_ASYNC` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `VM_LINT_HARDENING` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `VOTE_BINDING_MINIMUMS` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `VOTE_CALLBACK_TIMELOCK` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `VOTE_POLL_TICK_VISIBLE` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `VOTE_RESPECTS_SLEEP` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `XCALL_RESULT_ORPHAN_RETIREMENT` | `1786060800` | 2026-08-07 00:00:00 UTC | contract-era flag day | `protocol_changes.js` |
| `BATCH_ISSUANCE_LIMITS` | `1786838400` | 2026-08-16 00:00:00 UTC | own date | `protocol_changes.js` |
| `CONTRACT_DELEGATION_MATERIALIZE` | `1789430400` | 2026-09-15 00:00:00 UTC | own date | `protocol_changes.js` |
| `DISPENSER_ORACLE_PER_TOKEN_PRICE` | `1789430400` | 2026-09-15 00:00:00 UTC | own date | `protocol_changes.js` |
| `CROSS_CHAIN_ROYALTY` | `1798761600` | 2027-01-01 00:00:00 UTC | own date | `protocol_changes.js` |

Thresholds keyed on a **block height** rather than a block time (the
validator-era Cohort B rules and the per-chain Cohort C rules) are not listed
here; they are inventoried on
[Protocol Activation](./protocol-activation.md#the-three-cohorts).
