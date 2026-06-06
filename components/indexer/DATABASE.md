<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Indexer — Database Schema

The indexer uses two separate MariaDB databases.

## Decoder Database (Read-Only)

Database name format: `XChain_{CHAIN}_{NETWORK}_Decoder` (e.g., `XChain_BTC_Mainnet_Decoder`)

The indexer reads decoded transaction data and block information from this database. It never writes to it.

## Indexer Database (Read-Write)

Database name format: `XChain_{CHAIN}_{NETWORK}_Indexer` (e.g., `XChain_BTC_Mainnet_Indexer`)

The indexer creates and manages all tables in this database. SQL schema files live in `src/sql/*.sql` and are loaded by `db.js` to initialize the database on first startup. Tables are organized into several categories:

### Core Tables

| Table | Purpose |
|---|---|
| `blocks` | Block metadata: block_index, block_time, ledger hash, actions hash |
| `transactions` | Transaction records: tx_index, tx_hash, source, block_index |
| `actions` | All processed actions: action_index, tx_index, action type, block_index |

### Ledger Tables

| Table | Purpose |
|---|---|
| `credits` | Token credits (incoming amounts) |
| `debits` | Token debits (outgoing amounts) |
| `escrows` | Token escrows (held amounts for DEX orders, swaps) |
| `balances` | Computed address balances per token (derived from credits - debits) |
| `fees` | Gas fee records (XCHAIN token charges). Post-activation rows include unified gas columns: `gas_cost`, `gas_price`, `xchain_amount`, `payment_mode`, `fee_preference`, `fee_version`. |

### Action-Specific Tables

| Table | Purpose |
|---|---|
| `addresses` | ADDRESS action preferences (require memo, etc.) |
| `airdrops` | AIRDROP distribution records |
| `batches` | BATCH action container records |
| `broadcasts` | BROADCAST messages and oracle feeds |
| `callbacks` | CALLBACK action records |
| `destroys` | DESTROY (burn) records |
| `dispensers` | DISPENSER vending machine definitions |
| `dispenser_cancels` | DISPENSER cancellation records |
| `dispenser_closes` | DISPENSER close events |
| `dispenser_edits` | DISPENSER modification records |
| `dispenser_expires` | DISPENSER expiration events |
| `dispenser_statuses` | DISPENSER status change history |
| `dispenses` | Individual dispense events triggered by sends |
| `dividends` | DIVIDEND distribution records |
| `files` | FILE upload metadata |
| `issues` | ISSUE (token creation/update) records |
| `links` | LINK cross-reference records |
| `lists` | LIST definitions |
| `list_edits` | LIST modification records |
| `list_items` | LIST member items |
| `list_items_invalid` | Rejected LIST items |
| `messages` | MESSAGE records (plaintext and encrypted) |
| `mints` | MINT supply creation records |
| `orders` | ORDER (DEX) listing records |
| `order_cancels` | ORDER cancellation records |
| `order_edits` | ORDER modification records |
| `order_expires` | ORDER expiration events |
| `order_matches` | ORDER match (trade execution) records |
| `order_statuses` | ORDER status change history |
| `sends` | SEND transfer records |
| `sleeps` | SLEEP action records |
| `swaps` | SWAP (cross-chain) records |
| `swap_cancels` | SWAP cancellation records |
| `swap_edits` | SWAP modification records |
| `swap_expires` | SWAP expiration events |
| `swap_matches` | SWAP match records |
| `swap_statuses` | SWAP status change history |
| `sweeps` | SWEEP transfer records |
| `tokens` | Authoritative token state (supply, decimals, owner, locks, description) |

### State Tables

| Table | Purpose |
|---|---|
| `events` | Event tracking for reorgs and system events |
| `markets` | DEX market data (last price, volume, order depth) |

### Index Tables (Lookup Acceleration)

| Table | Purpose |
|---|---|
| `index_actions` | Normalized action type strings |
| `index_addresses` | Normalized address strings → integer IDs |
| `index_coins` | Normalized coin name strings |
| `index_fiats` | Normalized fiat currency strings |
| `index_memos` | Normalized memo strings |
| `index_mime_types` | Normalized MIME type strings |
| `index_pubkeys` | Normalized public key strings → integer IDs (used by staking delegations) |
| `index_statuses` | Normalized status strings |
| `index_tickers` | Normalized ticker strings → integer IDs |
| `index_transactions` | Normalized transaction hash strings |

### Hub Staking Tables

| Table | Purpose |
|---|---|
| `stakes` | Active and historical capability-staking STAKE records (`version` 1=new / 2=top-up) — `signing_pubkey_id`, `amount`, `activation_block` (`block_index + 6`), `deactivation_block` (set on UNSTAKE), `status_id`, `source_id`. Capabilities (`price`, `cross_chain`, `oracle_publish`, `attestation`) are derived from a pubkey's aggregate active `amount` against the governance-configured minimums — there is no `tier` column. |
| `unstakes` | Capability UNSTAKE v0 records — `signing_pubkey_id`, `amount`, `cooldown_end_block`, `status_id`; links back to the originating stake by pubkey. The cooldown end is `block_index + STAKING.COOLDOWN_BLOCKS` — the cooldown length is governance-configurable via the `STAKING.COOLDOWN_BLOCKS` parameter (default 1000 blocks), not a hardcoded constant. Contract-targeted UNSTAKE v1 records do **not** appear here; they are written to `contract_unstakes` with a per-contract cooldown (see below). |
| `delegations` | Active and historical DELEGATE records — `signing_pubkey_id`, `activation_block`, `deactivation_block` (set on DELEGATE v2 revoke), `status_id` |
| `validator_rewards` | Per-validator accumulated rewards — `source_id`, `signing_pubkey_id`, `reward_type` (`oracle_round` or `cross_chain_attestation`), `round_reference`, `amount`, `block_index`. Populated by the hub's `RewardTracker` via the `pushvalidatorrewards` JSON-RPC endpoint. |
| `reward_claims` | COLLECT records — `source_id`, `amount`, `status_id`, `block_index` |

All staking tables enforce a **6-block activation/deactivation delay** via `activation_block` and `deactivation_block` columns. Active-stake queries filter by `activation_block <= current_block AND (deactivation_block IS NULL OR deactivation_block > current_block)` to prevent short-range BTC reorgs from affecting the active validator set.

### Contract-Staking Tables

Contract-targeted staking (STAKE v3 / UNSTAKE v1 / DELEGATE v1) is a developer primitive: any registered token can be staked against a smart contract, on any chain. These tables are entirely separate from the capability-staking tables above — they share no state, key off the target contract rather than a built-in capability, and use a per-contract cooldown instead of the global `STAKING.COOLDOWN_BLOCKS`. See `protocol/Contract_Staking.md` for the full spec.

| Table | Purpose |
|---|---|
| `contract_stakes` | STAKE v3 records — `action_index` (PK), `source_id`, `version`, `signing_pubkey_id`, `target_contract_index` (FK to `contracts.action_index`), `tick_id`, `amount`, `status_id`, `block_index`, `activation_block` (`block_index + 6`), `deactivation_block` (set on UNSTAKE v1). Active stake for a `(target_contract_index, signing_pubkey_id, tick_id)` triple is the SUM of active rows. |
| `contract_unstakes` | UNSTAKE v1 records — `action_index` (PK), `source_id`, `signing_pubkey_id`, `target_contract_index`, `tick_id`, `cooldown_end_block` (`block_index + contracts.cooldown_blocks` — the per-contract cooldown declared at deploy, **not** the global capability cooldown), `amount`, `status_id`, `block_index`. The block-end sweep credits the remaining (post-slash) amount back to the staker at `cooldown_end_block`. |
| `contract_delegations` | DELEGATE v1 records (signing-pubkey rotation on a contract-targeted stake) — `action_index` (PK), `source_id`, `signing_pubkey_id` (the new pubkey), `target_contract_index`, `tick_id`, `status_id`, `block_index`, `activation_block`, `deactivation_block` (set on revoke). |

### PRICE Action Table

| Table | Purpose |
|---|---|
| `prices` | Raw on-chain PRICE action log (one row per processed PRICE tx). v0 fields: `round_number`, `round_timestamp`, `pair_count`, `pairs_json`, `sig_count`, `sigs_json`. v1 fields: `coin_id`, `tick_id`, `fiat_id`, `value`, `fee`, `memo_id`. Shared: `version`, `source_id`, `validation_status` (PBFT signature check result), `status_id` |

After processing, the indexer pushes validated PRICE actions to `xchain-hub` which deduplicates and writes to the cross-chain `price_snapshots` / `oracle_prices` tables in the hub DB. The `prices` table itself is the per-chain action log; for cross-chain queries, the indexer reads from its **local hub DB** (synced from the hub).

### Virtual Machine Tables

| Table | Purpose |
|---|---|
| `contracts` | Deployed contract records — `action_index` (PK), `source_id` (owner), `code` (MEDIUMTEXT, decoded JS), `code_hash` (SHA-256), `api_version` (default 1), `status_id`, `block_index` |
| `contract_state` | Append-only key-value state — each row is one state write keyed by `contract_index` + `state_key`. Latest value per key found via `MAX(id)` subquery. `state_value` of NULL means deleted. Index: `(contract_index, state_key, id DESC)`. Rollback: `DELETE WHERE block_index >= ?` |
| `contract_executions` | EXECUTE/constructor call records — `action_index` (PK), `contract_index`, `caller_id`, `method_name`, `input_params`, `gas_used`, `gas_limit`, `status_id`, `error_message`, `emitted_count`, `block_index` |
| `contract_emissions` | Actions emitted by contract executions — `execution_index` (FK to contract_executions), `emitted_action` (e.g., 'SEND'), `action_index` (the emitted action's own index in the `actions` table), `position` (order within execution) |
| `deposits` | DEPOSIT records — `contract_index`, `source_id`, `tick_id`, `amount`, `status_id`, `block_index`, `action_index` (PK) |
| `withdrawals` | WITHDRAWAL records — `contract_index`, `source_id`, `tick_id`, `amount`, `status_id`, `block_index`, `action_index` (PK) |

**Note:** Contract token balances are tracked via the standard `balances` table using the contract's derived address (`C:<CHAIN>:<action_index>` in `index_addresses`). There is no separate `contract_balances` table. DEPOSIT creates credits/debits between the depositor and the derived address; WITHDRAW does the reverse.

### Mapping Tables (Cross-References)

| Table | Purpose |
|---|---|
| `mappings_actions` | Maps action_index → address and action_index → ticker for fast lookups |
| `mappings_files` | Maps file action_index → ticker for FILE↔ISSUE links |

## Rollback Behavior

During a blockchain reorganization, the `Rollback` class deletes data from two sets of tables:

**Block tables** (keyed by `block_index`): `blocks`, `transactions`

**Data tables** (keyed by `action_index`): All other tables listed above, including staking tables (`stakes`, `unstakes`, `delegations`, `validator_rewards`, `reward_claims`), the `prices` action log, and VM tables (`contracts`, `contract_state`, `contract_executions`, `contract_emissions`, `deposits`, `withdrawals`). The rollback deletes records where `action_index >= firstActionIndex` (the first action at or after the reorg block), then recalculates balances, token state, and `contract_balances` from the remaining ledger data.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
