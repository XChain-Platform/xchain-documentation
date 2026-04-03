<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

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
| `stakes` | Active and historical STAKE records — amount, status, block_index |
| `unstakes` | UNSTAKE records — links back to the originating stake |
| `delegations` | Active and historical DELEGATE records — validator pubkey (via `index_pubkeys`), delegated amount, status |
| `validator_rewards` | Per-validator accumulated reward totals, updated each block |
| `reward_claims` | CLAIM_REWARDS records — amount claimed, block_index |

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

**Data tables** (keyed by `action_index`): All other tables listed above, including staking tables (`stakes`, `unstakes`, `delegations`, `validator_rewards`, `reward_claims`) and VM tables (`contracts`, `contract_state`, `contract_executions`, `contract_emissions`, `deposits`, `withdrawals`). The rollback deletes records where `action_index >= firstActionIndex` (the first action at or after the reorg block), then recalculates balances, token state, and `contract_balances` from the remaining ledger data.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
