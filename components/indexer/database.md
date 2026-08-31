<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Indexer: Database Schema

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
| `addresses` | One row per ADDRESS action, valid or not: the preferences a v0 sets (require memo, etc.) plus the status every ADDRESS reads back by. A v1 controller bind writes the row with no preferences; its binding lives in `address_controllers` |
| `airdrops` | AIRDROP distribution records |
| `batches` | BATCH action container records |
| `bet_feeds` | BET betting-market definitions (format 0). The creating `action_index` is the market's id |
| `bet_feed_statuses` | BET market lifecycle history (open, closed, resolved, resolved_void, cancelled, expired) |
| `bets` | Individual wagers placed on a market (format 2) |
| `bet_statuses` | Per-wager settlement history (open, won, lost, refunded) |
| `bet_cancels` | BET market cancellation records (format 1), which refund every open wager in full |
| `bet_resolves` | BET market resolution records (format 3), the only path that pays the oracle its fee |
| `broadcasts` | BROADCAST messages and general-purpose data feeds. Betting markets are `bet_feeds`, not broadcasts |
| `callbacks` | CALLBACK action records |
| `coinpays` | COINPAY native-coin payments settling an ORDER_MATCH obligation: the amount paid, its `txid`/`vout`, and the obligation it discharges. When one transaction settles more than one obligation, each row's `coin_amount`/`vout` name the specific output that paid THAT obligation, not just the transaction's first output. Testnet and regtest already behave this way; mainnet activates the change at `2026-08-16T00:00:00Z` |
| `destroys` | DESTROY (burn) records |
| `dispensers` | DISPENSER vending machine definitions |
| `dispenser_cancels` | DISPENSER cancellation records |
| `dispenser_closes` | DISPENSER close events |
| `dispenser_edits` | DISPENSER modification records |
| `dispenser_expires` | DISPENSER expiration events |
| `dispenser_statuses` | DISPENSER status change history |
| `dispenses` | Individual dispense events triggered by sends. `get_amount` records the coin attributed to that specific event; when one payment fills several dispenses in the same transaction, each row's `get_amount` is its share of the payment rather than the payment's full amount. Testnet and regtest already behave this way; mainnet activates the change at `2026-08-16T00:00:00Z` |
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
| `coinpay_obligations` | Native coin payment obligations created by an ORDER_MATCH: `payer_address_id` (coin-offering party), `payee_address_id` (token-selling party), `coin_id`, `coin_amount`, `expiration` (Unix timestamp) |
| `coinpay_statuses` | COINPay obligation status change history (pending_coinpay / fulfilled / expired / cancelled) |
| `coinpay_expires` | COINPAY_EXPIRE event records: each row links the expire action to the original obligation |
| `deploy_chunks` | Individual DEPLOY v4 carrier chunks for chunked smart contract upload. Keyed by `(source_id, code_hash, chunk_index)`; DEPLOY assembler reads only valid chunks and takes the lowest `action_index` per position |
| `anchor_actions` | Per-action ANCHOR records, keyed `(action_index, section_index)`. Versions: 0=checkpoint bundle, 1=archive head + publisher attestation, 2=archive continuation. Archive versions write one row at `section_index` 0; a v0 bundle writes one row per per-chain section, all sharing the bundle's `action_index`. Stores signed state hashes, `match_batch_seq`, `archive_b64` (gzip chunk), and `validator_signatures`. Enables full platform state recovery from a chain parse alone |
| `attests` | ATTEST action records (all versions). Version 0=request (emitted by a VM contract via `xchain.attestation.request`), version 1=response (validator PBFT bundle with `validator_signatures` JSON). Correlated by `request_id`; lifecycle tracked via `request_status` on v0 rows |
| `attest_validator_stats` | Cross-attestation accountability rollup keyed by `(validator_pubkey, provider_id)`. Tracks `fulfilled_count`, `missed_count`, `slashed_count`, and `quality_score` (0..1). Updated incrementally; recomputed from surviving records on reorg |
| `xcalls` | XCALL action records (v0=request, v2=expire). Each v0 row tracks a cross-chain contract call: `call_id`, `target_chain`, `target_contract_index`, `method`, `request_status` (pending/completed/expired), and the callback delivery outcome |
| `cross_chain_matches` | Hub-mirrored cross-chain DEX match rows. Populated by `hub_db_sync`; contains both legs (a/b chain, action_index, tick, amount, payout addresses) and the `validator_signatures` the hub federation signed |
| `cross_chain_settlements` | Settlement records for cross-chain DEX matches on this chain. One row per settled match leg; used for idempotency so a match is never applied twice. Rolled back by `action_index` |
| `cross_chain_calls` | Hub-mirrored cross-chain contract call rows (XCALL dispatch + result phases). Populated by `hub_db_sync` |
| `cross_chain_call_executions` | Records the system-injected XEXEC action that executed a cross-chain call on this chain. One row per `call_id` (idempotency) |
| `cross_chain_call_callbacks` | Records the system-injected callback EXECUTE delivered to the source contract after a cross-chain call result is processed. One row per `call_id` (idempotency) |
| `full_node_verifications` | Validated full-node possession-proof records. One row per (epoch, passing validator) from a NODEPROOF v0 verdict. Presence within `PROOF_WINDOW_BLOCKS` of a block gates the full-node reward tranche |
| `gated_files` | FILE v1 token-gated metadata: `gate_ticker`, `encryption_method`, `key_hash` (groups pack members), and `raw_data` (ciphertext bytes) |
| `pubkeys` | Address-to-public-key mapping, populated from the decoder at index time. Keyed by `address_id` |
| `icons` | Token icon cache: source URL, fetch/generation status, and generated PNG hash. Keyed by `token_id`; managed by the icon-fetch pipeline, not by block processing |

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
| `stakes` | Active and historical capability-staking STAKE records (`version` 1=new / 2=top-up): `signing_pubkey_id`, `amount`, `activation_block` (`block_index + 6`), `deactivation_block` (set on UNSTAKE), `status_id`, `source_id`. Capabilities (`price`, `cross_chain`, `oracle_publish`, `attestation`, `full_node`) are derived from a pubkey's aggregate active `amount` against the governance-configured minimums: there is no `tier` column. |
| `unstakes` | Capability UNSTAKE v0 records: `signing_pubkey_id`, `amount`, `cooldown_end_block`, `status_id`; links back to the originating stake by pubkey. The cooldown end is `block_index + STAKING.COOLDOWN_BLOCKS`; the cooldown length is governance-configurable via the `STAKING.COOLDOWN_BLOCKS` parameter (default 1000 blocks), not a hardcoded constant. Contract-targeted UNSTAKE v1 records do **not** appear here; they are written to `contract_unstakes` with a per-contract cooldown (see below). |
| `delegations` | Active and historical DELEGATE records: `signing_pubkey_id`, `activation_block`, `deactivation_block` (set on DELEGATE v2 revoke), `status_id` |
| `validator_rewards` | Per-validator accumulated rewards: `source_id`, `signing_pubkey_id`, `reward_type` (`oracle_round`, `oracle_base`, `oracle_full_node`, `attest_fee`, `anchor_bundle`, or `anchor_archive`), `round_reference`, `amount`, `block_index`. `oracle_round` / `oracle_base` / `oracle_full_node` and `attest_fee` rows are derived by the indexer during block processing (the oracle label depends on whether the full-node reward tier is active: see [COLLECT](../../protocol/actions/collect.md)); `anchor_bundle` and `anchor_archive` rows are pushed from the hub via `pushvalidatorrewards`. One `anchor_bundle` row is written per published bundle, keyed on the bundle's snapshot block, not one per chain. |
| `stake_key_revocations` | Records DELEGATE v2 revocations of the original stake signing key: `source_id`, `signing_pubkey_id`, `deactivation_block`, `action_index`, `block_index`, `status_id`. A later STAKE v2 (higher `action_index`) by the same `(source, pubkey)` clears the revocation. Queried via `createStakeKeyRevocation` / `getStakeKeyRevocation` in `db.js`. |
| `reward_claims` | COLLECT records: `source_id`, `amount`, `status_id`, `block_index` |

Staking tables enforce an activation/deactivation delay via `activation_block` and `deactivation_block` columns. Capability staking (`stakes`) is BTC-only and uses a fixed **6-block** delay. Contract-targeted staking (`contract_stakes`) runs on every chain and uses the per-chain `STAKING.ACTIVATION_DELAY_BLOCKS` default, calibrated for equivalent ~60-min reorg protection (**6 blocks on BTC, 24 on LTC, 60 on DOGE**); see `protocol/Contract_Staking.md`. Active-stake queries filter by `activation_block <= current_block AND (deactivation_block IS NULL OR deactivation_block > current_block)` to prevent short-range reorgs from affecting the active validator set.

### Contract-Staking Tables

Contract-targeted staking (STAKE v3 / UNSTAKE v1 / DELEGATE v1) is a developer primitive: any registered token can be staked against a smart contract, on any chain. These tables are entirely separate from the capability-staking tables above; they share no state, key off the target contract rather than a built-in capability, and use a per-contract cooldown instead of the global `STAKING.COOLDOWN_BLOCKS`. See `protocol/Contract_Staking.md` for the full spec.

| Table | Purpose |
|---|---|
| `contract_stakes` | STAKE v3 records: `action_index` (PK), `source_id`, `version`, `signing_pubkey_id`, `target_contract_index` (FK to `contracts.action_index`), `tick_id`, `amount`, `status_id`, `block_index`, `activation_block` (`block_index + ACTIVATION_DELAY_BLOCKS`, per-chain: 6 BTC / 24 LTC / 60 DOGE), `deactivation_block` (set on UNSTAKE v1). Active stake for a `(target_contract_index, signing_pubkey_id, tick_id)` triple is the SUM of active rows. |
| `contract_unstakes` | UNSTAKE v1 records (`action_index` (PK), `source_id`, `signing_pubkey_id`, `target_contract_index`, `tick_id`, `cooldown_end_block` (`block_index + contracts.cooldown_blocks`) the per-contract cooldown declared at deploy, **not** the global capability cooldown), `amount`, `status_id`, `block_index`. The block-end sweep credits the remaining (post-slash) amount back to the staker at `cooldown_end_block`. |
| `contract_delegations` | DELEGATE v1 records (signing-pubkey rotation on a contract-targeted stake): `action_index` (PK), `source_id`, `signing_pubkey_id` (the new pubkey), `target_contract_index`, `tick_id`, `status_id`, `block_index`, `activation_block`, `deactivation_block` (set on revoke). |
| `contract_delegation_rotations` | Journal of the rotations the block-start sweep materializes onto the stake ledger: `id` (PK), `target_table` (`contract_stakes` or `contract_unstakes`), `delegation_action_index`, `stake_action_index`, `prev_signing_pubkey_id`, `new_signing_pubkey_id`, `block_index`. When a delegation's `activation_block` is reached, the delegated pubkey is written onto the rows themselves so the VM stake snapshot, the UNSTAKE aggregate and the SLASH deduction all agree on one key; the still-slashable cooldown rows rotate too, so a rotation cannot shield locked tokens from a slash. `prev_signing_pubkey_id` is what a reorg copies back. Gated by the `CONTRACT_DELEGATION_MATERIALIZE` flag day (see [Flag Days](../../protocol/flag-days.md)); empty below it. |

### Slashing Tables

Two slashing systems produce distinct table families.

**Contract-targeted slashing** (triggered by a VM EXECUTE that calls `xchain.stake.slash`):

| Table | Purpose |
|---|---|
| `slash_events` | One row per VM-emitted slash: `execution_index` (the EXECUTE), `target_contract_index`, `signing_pubkey_id`, `tick_id`, `amount` slashed, and `destination_id` (resolved BURN address or custom destination) |
| `contract_slash_debits` | Append-only audit log of in-place `amount` reductions on `contract_stakes`/`contract_unstakes` rows. Stores `prev_amount` (pre-slash string) for byte-identical reorg restoration. Keyed by `block_index` for rollback |

**Capability-stake equivocation slashing** (permissionless SLASH wire action, WI-2 bump 2):

| Table | Purpose |
|---|---|
| `capability_slash_events` | One row per SLASH action: `signing_pubkey_id` (the equivocating validator), `capability` engine tag (e.g. XDEX/XCALL/XCHECKPOINT), `equiv_key` (the shared equivocation key), total `amount` burned, `bounty_amount` paid to the submitter, and `treasury_amount` |
| `capability_slash_debits` | Append-only audit log of in-place `amount` reductions on `stakes`/`unstakes` rows. Stores `prev_amount` for byte-identical reorg restoration. Keyed by `block_index` for rollback |

### Capability Snapshot Table

| Table | Purpose |
|---|---|
| `capability_snapshots` | Hub-mirrored validator capability snapshot. One row per `(snapshot_block, capability, signing_pubkey)`. Populated by `hub_db_sync`; lets a non-BTC indexer verify cross-chain match signatures without local capability stakes. `amount` is the source's aggregate active stake (the voting weight under STAKE_WEIGHTED_QUORUM) |

### Controller Policy Tables

| Table | Purpose |
|---|---|
| `token_controllers` | Append-only bind/unbind event log for token-level controller policies (ISSUE action). One row per event keyed by `(tick_id, action_class, contract_index)`. Effective controller at block X is the latest event at or before X; unbind rows gate only until `cooldown_end_block` |
| `address_controllers` | Append-only bind/unbind event log for address-level controller policies (ADDRESS action). Same append-only, read-time-cooldown model as `token_controllers` |
| `contract_permissions` | Per-contract permission manifest declared at DEPLOY time: `permissions` (JSON array of permitted emission action types; NULL = unrestricted), `max_take_bps` (per-contract royalty cap). Immutable after deploy |

### SPV Light-Client Tables

| Table | Purpose |
|---|---|
| `state_tree_roots` | Per-block light-client commitments: `balances_root` (SMT over balance+escrow leaves), `stakes_root` (BTC-only; EMPTY_SMT_ROOT on LTC/DOGE), `state_root` (fixed top-level root), and `block_merkle_root` (per-block content root). Written atomically with each block; rolled back by `block_index` |
| `state_tree_nodes` | Content-addressed, copy-on-write SMT internal node store. Keyed by `node_hash` (SHA-256); stores `left_hash`/`right_hash`. Append-only (INSERT IGNORE); orphaned nodes survive reorgs and are pruned later |
| `state_checkpoints` | Hub-mirrored federation state checkpoint rows. Append-only (supersede-by-seq semantics); not deleted on reorg (hub convergence handles stale rows). Contains `ledger_hash`, `actions_hash`, `contract_hash`, `state_root`, `block_merkle_root`, and `validator_signatures` |
| `escrow_leaf_journal` | Per-block history of the escrow leaf value for each `(address_id, tick_id)`, where the address is always the **locker** and never a recipient. `locked_amount` is the total open-remaining for that key, or `NULL` as a tombstone. The escrow sub-tree is built from this journal rather than from the live `escrows` ledger, because the ledger cannot answer what a leaf held as of a past height once orders have filled. `block_index` gives the touched set for one block and `(address_id, tick_id, id DESC)` serves both the latest value and the as-of-height read behind a proof. `action_index` is provenance only and is `NULL` for multi-action folds. **Written on the source indexer only**: `xchain-sync` replicates these rows rather than deriving them |

### Infrastructure and Utility Tables

| Table | Purpose |
|---|---|
| `pending_hub_pushes` | Durable retry queue for PRICE v0/v1 pushes to the hub. Rows are deleted on successful delivery; failures stay and are retried with backoff by `HubPushQueue`. Rolled back by `action_index` so queued pushes for orphaned actions are purged on reorg |
| `recovery_pending_rewards` | Recovery-only staging table for archived validator reward rows. Populated by `recovery.js` before a reindex; rewards are materialized into `validator_rewards` when the source address first receives its deterministic in-block index ID. NOT replicated by `xchain-sync` |
| `oracle_prices` | Local mirror of the hub's `oracle_prices` table (PRICE v1 user oracle rows). Populated by `hub_db_sync`. Rolled back on reorg by `(source_chain, action_index)` |
| `price_snapshots` | Local mirror of the hub's `price_snapshots` table (PRICE v0 consensus rounds). Populated by `hub_db_sync`. Rolled back on reorg by `reference_block` |
| `anchor_reward_attestations` | Local mirror of the hub's table of the same name: quorum-attested ANCHOR publisher rewards. Populated by `hub_db_sync`, INSERT-IGNORE, never retracted |
| `anchor_reward_reconcile_log` | Pre-image log of validator-reward rows deleted when an ANCHOR reconciles a contested publisher. Stores each deleted row's exact `amount` string and its original `reward_block_index`, so a reorg restore re-inserts it byte-identically, and only when the earn-block itself survives |
| `cross_chain_call_rejections` | Refused XCALL dispatch injections, one row per `call_id`, with the refusal `reason` family, human-readable `detail`, and the attempt count and first/last block. Makes a call that never lands diagnosable instead of silently absent |
| `push_generations` | Per-coin monotonic counter bumped on every rollback and never decremented. Stamped onto hub pushes so the hub can fence stale pushes from an orphaned range (its `price_ingest_watermarks` side) |

### Governance Tables (VOTE)

Token-weighted polls. Each table is keyed by the `action_index` of the VOTE version that wrote it, and rolled back by `block_index`.

| Table | Purpose |
|---|---|
| `polls` | Poll definitions written by VOTE v0. The creating `action_index` is the poll's id |
| `votes` | Individual ballots (VOTE v1): the poll, the voter, the chosen option index, and its `share` (relative weight in split mode, `1` in approval mode) |
| `poll_results` | Per-option tallies written by the system-injected VOTE v2 finalize: counted `total_weight`, distinct `voter_count`, and the `resolved_block` used as the reorg-rollback reset key |
| `vote_delegations` | Standing delegations set or cleared by VOTE v3. A NULL `delegate_address_id` means the delegation was revoked; the latest row per delegator and governance token wins |

### PRICE Action Table

| Table | Purpose |
|---|---|
| `prices` | Raw on-chain PRICE action log (one row per processed PRICE tx). v0 fields: `round_number`, `round_timestamp`, `pair_count`, `pairs_json`, `sig_count`, `sigs_json`. v1 fields: `coin_id`, `tick_id`, `fiat_id`, `value`, `fee`, `memo_id`. Shared: `version`, `source_id`, `validation_status` (PBFT signature check result), `status_id` |

After processing, the indexer pushes validated PRICE actions to `xchain-hub` which deduplicates and writes to the cross-chain `price_snapshots` / `oracle_prices` tables in the hub DB. The `prices` table itself is the per-chain action log; for cross-chain queries, the indexer reads from its **local hub DB** (synced from the hub).

### Virtual Machine Tables

| Table | Purpose |
|---|---|
| `contracts` | Deployed contract records: `action_index` (PK), `source_id` (owner), `code` (MEDIUMTEXT, decoded JS), `code_hash` (SHA-256), `api_version` (default 1), `status_id`, `block_index` |
| `contract_state` | Append-only key-value state; each row is one state write keyed by `contract_index` + `state_key`. Latest value per key found via `MAX(id)` subquery. `state_value` of NULL means deleted. Index: `(contract_index, state_key, id DESC)`. Rollback: `DELETE WHERE block_index >= ?` |
| `contract_executions` | EXECUTE/constructor call records: `action_index` (PK), `contract_index`, `caller_id`, `method_name`, `input_params`, `gas_used`, `gas_limit`, `status_id`, `error_message`, `emitted_count`, `block_index` |
| `contract_emissions` | Actions emitted by contract executions: `execution_index` (FK to contract_executions), `emitted_action` (e.g., 'SEND'), `action_index` (the emitted action's own index in the `actions` table), `position` (order within execution) |
| `deposits` | DEPOSIT records: `contract_index`, `source_id`, `tick_id`, `amount`, `status_id`, `block_index`, `action_index` (PK) |
| `withdrawals` | WITHDRAWAL records: `contract_index`, `source_id`, `tick_id`, `amount`, `status_id`, `block_index`, `action_index` (PK) |

**Note:** Contract token balances are tracked via the standard `balances` table using the contract's derived address (`C:<CHAIN>:<action_index>` in `index_addresses`). There is no separate `contract_balances` table. DEPOSIT creates credits/debits between the depositor and the derived address; WITHDRAW does the reverse.

### Mapping Tables (Cross-References)

| Table | Purpose |
|---|---|
| `mappings_actions` | Maps action_index → address and action_index → ticker for fast lookups |
| `mappings_files` | Maps file action_index → ticker for FILE↔ISSUE links |

## Rollback Behavior

During a blockchain reorganization, the `Rollback` class deletes data from two sets of tables:

**Block tables** (keyed by `block_index`): `blocks`, `transactions`

**Data tables** (keyed by `action_index`): All other tables listed above, including staking tables (`stakes`, `unstakes`, `delegations`, `validator_rewards`, `reward_claims`, `stake_key_revocations`), contract-staking tables (`contract_stakes`, `contract_unstakes`, `contract_delegations`), slashing tables (`slash_events` and `contract_slash_debits` are block-scoped; see below), the `prices` action log, VM tables (`contracts`, `contract_state`, `contract_executions`, `contract_emissions`, `deposits`, `withdrawals`, `contract_permissions`, `deploy_chunks`), attestation tables (`attests`, `anchor_actions`), cross-chain tables (`xcalls`, `cross_chain_settlements`, `cross_chain_call_executions`, `cross_chain_call_callbacks`), and controller/policy tables (`token_controllers`, `address_controllers`, `full_node_verifications`, `gated_files`, `pending_hub_pushes`). The rollback deletes records where `action_index >= firstActionIndex` (the first action at or after the reorg block), then recalculates balances, token state, and markets from the remaining ledger data.

Several tables require special handling beyond a simple bulk delete:

- **`slash_events`, `contract_slash_debits`, `capability_slash_events`, `capability_slash_debits`, `contract_delegation_rotations`, `state_tree_roots`**: Deleted by `block_index` (not `action_index`) because slashes, signing-key rotations and light-client roots are block-scoped.
- **`contract_stakes`, `contract_unstakes`, `stakes`, `unstakes`, `delegations`, `contract_delegations`**: In-place `deactivation_block` stamps written by orphaned UNSTAKE/DELEGATE-revoke actions are reset before the bulk delete. Similarly, in-place `amount` reductions from orphaned SLASH executions are restored from the corresponding `*_slash_debits` rows before those rows are deleted, and in-place `signing_pubkey_id` rotations from an orphaned DELEGATE v1 materialization are restored from `contract_delegation_rotations`.
- **`attests` (v0 rows), `xcalls` (v0 rows)**: Request-status flips (`fulfilled`/`errored`/`expired` and `completed`/`expired`) written as in-place UPDATEs on surviving rows are reset to `pending` before the bulk delete, keyed on `resolved_block >= reorgBlock`.
- **`price_snapshots`, `oracle_prices`**: Not deleted by the generic loops; deleted separately by `reference_block`/`(source_chain, action_index)` respectively.
- **`attest_validator_stats`**: A cross-attestation aggregate with no `action_index` or `block_index` FK; recomputed from surviving response and expired-request rows via `_recomputeAttestationValidatorStats`.
- **`state_checkpoints`, `capability_snapshots`**: Intentionally NOT deleted on reorg. Both use append-only / supersede-by-seq semantics so stale rows are harmless; hub-driven convergence closes any divergence window.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
