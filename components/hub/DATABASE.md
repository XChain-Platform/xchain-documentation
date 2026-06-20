<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Hub: Database Schema

The hub uses a single MariaDB database (e.g., `XChain_Hub`) for all state. The database and all tables are auto-created on first startup. SQL schema files live in `src/sql/*.sql` and are loaded by `db.js`.

## Config Tables

| Table | Purpose |
|---|---|
| `configs` | Service configuration parameters per coin/network/module |
| `consensus_state` | PBFT sequence number and view persistence |

### `configs`

Stores connection parameters (hosts, ports, credentials) for all XChain services. Other services poll this table via `getallconfigs` for service discovery.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `coin` | `VARCHAR(16) NOT NULL` | Chain identifier (BTC, LTC, DOGE) |
| `network` | `VARCHAR(16) NOT NULL` | Network (mainnet, testnet, regtest) |
| `module` | `VARCHAR(64) NOT NULL` | Service name (decoder, indexer, explorer, etc.) |
| `param_name` | `VARCHAR(32) NOT NULL` | Parameter name (host, port, db_name, etc.) |
| `param_value` | `TEXT` | Parameter value |
| `updated_at` | `TIMESTAMP` | Last modification time |

**Unique key:** `(coin, network, module, param_name)`

### `consensus_state`

Persists PBFT state so validators resume at the correct sequence after restart.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `key_name` | `VARCHAR(64) NOT NULL UNIQUE` | State key (e.g., `seq`, `view`) |
| `value` | `TEXT NOT NULL` | State value |
| `updated_at` | `TIMESTAMP` | Last modification time |

## Validator Tables

| Table | Purpose |
|---|---|
| `validators` | Active validator registry with Ed25519 pubkeys |
| `p2p_peers` | Known P2P peers and last-seen timestamps |

### `validators`

Registered validators participating in consensus, oracle rounds, and cross-chain attestation.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `signing_pubkey` | `CHAR(64) NOT NULL UNIQUE` | Ed25519 public key (hex) |
| `addr` | `VARCHAR(255) NOT NULL` | Validator address |
| `status` | `ENUM('active','suspended','removed')` | Current status (default: `active`) |
| `created_at` | `TIMESTAMP` | Registration time |
| `updated_at` | `TIMESTAMP` | Last modification time |

### `p2p_peers`

Tracks known peers in the gossip network for reconnection and discovery.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `addr` | `VARCHAR(255) NOT NULL UNIQUE` | Peer address (host:port) |
| `validator_id` | `VARCHAR(255) NOT NULL` | Associated validator identifier |
| `last_seen_at` | `TIMESTAMP NULL` | Last successful communication |
| `is_seed` | `TINYINT(1)` | Whether this is a seed node (default: 0) |
| `created_at` | `TIMESTAMP` | First discovery time |
| `updated_at` | `TIMESTAMP` | Last modification time |

## Oracle Tables

| Table | Purpose |
|---|---|
| `oracle_submissions` | Per-validator price submissions per round |
| `price_snapshots` | Finalized oracle prices after PBFT consensus (cross-chain unified view) |
| `oracle_prices` | User TOKEN/FIAT oracle prices (PRICE v1) with 24-hour lock window |

### `oracle_submissions`

Raw price submissions from validators during each oracle round.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `round_number` | `BIGINT NOT NULL` | Oracle round number |
| `coin_pair` | `VARCHAR(20) NOT NULL` | Price pair (BTC/USD, LTC/USD, DOGE/USD) |
| `validator_pubkey` | `CHAR(64) NOT NULL` | Submitting validator's pubkey |
| `price` | `VARCHAR(40) NOT NULL` | Submitted price (8 decimal precision) |
| `sources` | `INT NOT NULL` | Number of price sources used (default: 0) |
| `submitted_at` | `TIMESTAMP` | Submission time |

**Keys:** `(round_number, coin_pair)`, `(validator_pubkey)`

### `price_snapshots`

Finalized price data after PBFT consensus. Cross-chain unified view, populated by either the hub's local PBFT consensus (when running in validator mode) or by `PriceAggregator.receiveValidatedRound()` when an indexer pushes a validated PRICE v0 from any chain. Deduplicated by `round_number` (first valid submission wins).

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `round_number` | `BIGINT NOT NULL` | Oracle round number (= BTC block height) |
| `coin_pair` | `VARCHAR(20) NOT NULL` | Price pair (3 coins × 12 fiats = 36 supported) |
| `price` | `VARCHAR(40)` | Finalized price (8 decimal precision) |
| `reference_block` | `BIGINT NOT NULL` | BTC chain tip when round was triggered (no longer hardcoded to 0) |
| `reference_chain` | `VARCHAR(10) NOT NULL` | Reference chain (default: BTC) |
| `block_timestamp` | `BIGINT NOT NULL` | Block timestamp of reference (default: 0) |
| `validator_count` | `INT NOT NULL` | Number of validators in consensus |
| `consensus_round` | `INT` | Consensus round number (default: 1) |
| `consensus_proof` | `TEXT NOT NULL` | Serialized consensus proof; JSON array of `{pubkey, sig}` for PRICE v0 |
| `status` | `ENUM('finalized','skipped','disputed')` | Round outcome |
| `source_chain` | `VARCHAR(10) NOT NULL` | Chain that carried the PRICE v0 tx (audit/diagnostics, default: DOGE) |
| `source_action_index` | `BIGINT` | Action index of the PRICE v0 tx on source_chain (NULL for hub-finalized) |
| `created_at` | `TIMESTAMP` | Record creation time |

**Unique key:** `(round_number, coin_pair)`
**Keys:** `(coin_pair, reference_block)`, `(coin_pair, block_timestamp)`, `(status)`, `(source_chain)`

### `oracle_prices`

User TOKEN/FIAT oracle prices published via PRICE v1. Cross-chain aggregated by `PriceAggregator.receiveOraclePrice()` from all chains' indexers. Enforces 24-hour price lock window via `effective_at` column.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `source_address` | `VARCHAR(100) NOT NULL` | Oracle operator's address (PRICE v1 SOURCE) |
| `source_chain` | `VARCHAR(10) NOT NULL` | Chain on which the PRICE v1 tx was published |
| `coin` | `VARCHAR(10) NOT NULL` | Token's chain (BTC/LTC/DOGE) |
| `tick` | `VARCHAR(50) NOT NULL` | Token name (e.g. PEPECASH) |
| `fiat` | `VARCHAR(10) NOT NULL` | Fiat currency code (USD, JPY, EUR, etc.) |
| `value` | `VARCHAR(250) NOT NULL` | Price as decimal string |
| `fee` | `VARCHAR(250)` | Oracle usage fee as decimal (e.g. `0.01` = 1%) |
| `memo` | `VARCHAR(250)` | Optional description |
| `block_time` | `BIGINT UNSIGNED NOT NULL` | block_time of the publishing tx |
| `effective_at` | `BIGINT UNSIGNED NOT NULL` | When this price takes effect (`block_time` for first broadcast, `block_time + 86400` for updates) |
| `action_index` | `BIGINT UNSIGNED NOT NULL` | action_index of the PRICE v1 tx on source_chain |
| `created_at` | `TIMESTAMP` | Record creation time |

**Unique key:** `(source_chain, action_index)` (dedup)
**Keys:** `(source_address, coin, tick, fiat)`, `(coin, tick, fiat, effective_at)`, `(source_chain)`

## Cross-Chain Tables

| Table | Purpose |
|---|---|
| `attestations` | Cross-chain action attestation records |
| `swap_records` | SWAP lifecycle tracking |
| `reorg_attestations` | Confirmed blockchain reorg events |
| `cross_chain_matches` | PBFT-finalized DEX order match records (dispatch to indexers via hub-DB mirror) |
| `cross_chain_calls` | PBFT-finalized XCALL dispatch and result records (relay to indexers via hub-DB mirror) |

### `attestations`

Cross-chain action attestations verified by PBFT consensus. Each attestation confirms that an action on one chain is valid and can be recognized on another.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `attestation_id` | `VARCHAR(100) NOT NULL UNIQUE` | Format: `SOURCE:ACTION_INDEX:DEST` |
| `source_chain` | `VARCHAR(10) NOT NULL` | Originating chain (BTC, LTC, DOGE) |
| `source_action_index` | `BIGINT NOT NULL` | Action index on source chain |
| `dest_chain` | `VARCHAR(10) NOT NULL` | Destination chain |
| `confirmations` | `INT NOT NULL` | Confirmation count (default: 0) |
| `status` | `ENUM('pending','attested','rejected','expired')` | Attestation status (default: `pending`) |
| `validator_count` | `INT NOT NULL` | Number of validators in quorum (default: 0) |
| `consensus_proof` | `TEXT` | Serialized consensus proof |
| `created_at` | `TIMESTAMP` | Record creation time |
| `updated_at` | `TIMESTAMP` | Last modification time |

**Keys:** `(source_chain, source_action_index)`, `(status)`

### `swap_records`

Tracks cross-chain SWAP lifecycle from initiation through settlement.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `source_chain` | `VARCHAR(10) NOT NULL` | Source chain |
| `source_action_index` | `BIGINT NOT NULL` | Source action index |
| `dest_chain` | `VARCHAR(10) NOT NULL` | Destination chain |
| `dest_action_index` | `BIGINT` | Destination action index (set on execution) |
| `attestation_id` | `VARCHAR(100)` | Linked attestation ID |
| `status` | `ENUM('initiated','attested','executed','settled','failed')` | SWAP status (default: `initiated`) |
| `created_at` | `TIMESTAMP` | Record creation time |
| `updated_at` | `TIMESTAMP` | Last modification time |

**Unique key:** `(source_chain, source_action_index)`  
**Keys:** `(status)`, `(attestation_id)`

### `reorg_attestations`

Records confirmed blockchain reorganization events that have been acknowledged by PBFT consensus. Used to roll back affected attestations and price data.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `reorg_id` | `VARCHAR(100) NOT NULL UNIQUE` | Unique reorg identifier |
| `source_chain` | `VARCHAR(10) NOT NULL` | Chain where reorg occurred |
| `reorg_height` | `BIGINT NOT NULL` | Block height of the reorg |
| `reorg_timestamp` | `BIGINT NOT NULL` | Timestamp of the reorg |
| `affected_chains` | `TEXT` | Chains affected by rollback |
| `validator_count` | `INT NOT NULL` | Number of validators in quorum (default: 0) |
| `consensus_proof` | `TEXT` | Serialized consensus proof |
| `status` | `ENUM('confirmed','rejected')` | Reorg acknowledgment status (default: `confirmed`) |
| `created_at` | `TIMESTAMP` | Record creation time |

**Keys:** `(source_chain)`, `(status)`

### `cross_chain_matches`

PBFT-finalized DEX order match records. Each row represents a single fill between two orders (one on each chain). The `id` column doubles as the mirror cursor (`since_id`) used by indexers to stream new rows; rows are append-only. A match may be retracted (e.g. after a reorg) by a follow-up row with `status = 'retracted'`; indexers apply rows in `id` order.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT` | Mirror cursor (since_id) and primary key |
| `match_id` | `VARCHAR(80) NOT NULL UNIQUE` | Deterministic hash of both order refs and `snapshot_block` |
| `snapshot_block` | `BIGINT UNSIGNED NOT NULL` | BTC-anchored block; selects the cross_chain validator set for signature verification |
| `network` | `VARCHAR(20) NOT NULL` | mainnet / testnet / regtest; signed into the canonical so a match cannot settle off-network |
| `a_chain` | `VARCHAR(10) NOT NULL` | Canonical-lower side chain (e.g. BTC) |
| `a_action_index` | `BIGINT UNSIGNED NOT NULL` | Action index of the order on side A's chain |
| `a_kind` | `VARCHAR(10) NOT NULL` | `swap` (full single-fill) or `order` (partial-fillable); default `swap` |
| `a_tick` | `VARCHAR(255)` | Token symbol on side A; NULL = native coin |
| `a_amount` | `VARCHAR(250) NOT NULL` | Fill amount settled in this match |
| `a_filled_before` | `VARCHAR(250) NOT NULL` | Side A's cumulative committed fill before this match (default `0`) |
| `a_ownership` | `TINYINT(1) NOT NULL` | Ownership flag (default 0) |
| `a_payout_addr` | `VARCHAR(255) NOT NULL` | Side A's receive address on side B's chain |
| `b_chain` | `VARCHAR(10) NOT NULL` | Canonical-higher side chain (e.g. LTC) |
| `b_action_index` | `BIGINT UNSIGNED NOT NULL` | Action index of the order on side B's chain |
| `b_kind` | `VARCHAR(10) NOT NULL` | `swap` or `order`; default `swap` |
| `b_tick` | `VARCHAR(255)` | Token symbol on side B; NULL = native coin |
| `b_amount` | `VARCHAR(250) NOT NULL` | Fill amount settled in this match |
| `b_filled_before` | `VARCHAR(250) NOT NULL` | Side B's cumulative committed fill before this match (default `0`) |
| `b_ownership` | `TINYINT(1) NOT NULL` | Ownership flag (default 0) |
| `b_payout_addr` | `VARCHAR(255) NOT NULL` | Side B's receive address on side A's chain |
| `effective_time` | `BIGINT UNSIGNED NOT NULL` | Wall-clock instant at which indexers apply this match (shared clock across chains) |
| `finalizing_view` | `INT NOT NULL` | PBFT view the round finalized at (signed into the EQUIV canonical; default 0) |
| `validator_signatures` | `TEXT NOT NULL` | JSON array of `{pubkey, sig}` (2f+1 signatures over the canonical match) |
| `status` | `VARCHAR(20) NOT NULL` | `finalized` or `retracted` (default `finalized`) |
| `batch_root` | `VARCHAR(64)` | Retained for rows stamped by the retired XDEXANCHOR audit publisher |
| `anchor_txid` | `VARCHAR(64)` | DOGE ANCHOR txid (ANCHOR v1 archive back-fill; legacy XDEXANCHOR rows too) |
| `batch_seq` | `BIGINT UNSIGNED` | ANCHOR v1 archive batch this match was published in (hub-side only) |
| `archived_status` | `VARCHAR(20)` | Match status at last archive publish (a later retraction re-archives the row) |
| `created_at` | `TIMESTAMP NOT NULL` | Record creation time |

**Keys:** `(match_id)` unique, `(snapshot_block)`, `(a_chain, a_action_index)`, `(b_chain, b_action_index)`, `(effective_time)`, `(status)`

### `cross_chain_calls`

PBFT-finalized XCALL dispatch and result records. Each XCALL produces two rows in this table (one per `phase`): a `dispatch` row that target-chain indexers apply to inject the call, and a `result` row that source-chain indexers apply to fire the requester's callback. The `id` column is both the mirror cursor (`since_id`) and the indexers' deterministic injection-order key.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT` | Mirror cursor (since_id) and injection-order key; primary key |
| `call_id` | `VARCHAR(80) NOT NULL` | Deterministic identifier derived from the source-chain VM run |
| `phase` | `VARCHAR(10) NOT NULL` | `dispatch` or `result` |
| `snapshot_block` | `BIGINT UNSIGNED NOT NULL` | BTC-anchored block; selects the cross_chain validator set for signature verification |
| `network` | `VARCHAR(20) NOT NULL` | mainnet / testnet / regtest; signed into the canonical |
| `source_chain` | `VARCHAR(10) NOT NULL` | Chain where the XCALL v0 request originated |
| `source_action_index` | `BIGINT UNSIGNED NOT NULL` | On-chain XCALL v0 action index (retraction key) |
| `source_contract_index` | `BIGINT UNSIGNED NOT NULL` | Requesting contract's action index on the source chain |
| `target_chain` | `VARCHAR(10) NOT NULL` | Chain where the call is executed |
| `target_contract_index` | `BIGINT UNSIGNED NOT NULL` | Target contract's action index on the target chain |
| `method` | `VARCHAR(64) NOT NULL` | Contract method being called |
| `params_json` | `TEXT NOT NULL` | JSON array of string params (SHA-256'd into the canonical) |
| `gas_limit` | `BIGINT UNSIGNED NOT NULL` | Caller-funded target-side gas ceiling |
| `cross_hops` | `INT NOT NULL` | Ping-pong recursion bound signed into the canonical (default 0) |
| `effective_time` | `BIGINT UNSIGNED NOT NULL` | Apply at first block_time >= this value (dispatch: target chain; result: source chain) |
| `finalizing_view` | `INT NOT NULL` | PBFT view the round finalized at (signed into the EQUIV canonical; default 0) |
| `status` | `VARCHAR(20) NOT NULL` | Row lifecycle: `finalized` or `retracted` (default `finalized`) |
| `result_status` | `VARCHAR(20)` | Result phase only: `ok`, `reverted`, `out_of_gas`, `no_contract`, `not_callable`, `payload_too_large`, or `error` |
| `return_payload_b64` | `TEXT` | Result phase only; base64 return value (SHA-256'd into the canonical) |
| `validator_signatures` | `TEXT NOT NULL` | JSON array of `{pubkey, sig}` (2f+1 Ed25519 signatures over the phase canonical) |
| `batch_seq` | `BIGINT UNSIGNED` | ANCHOR archive batch this row was committed in (hub-side only) |
| `archived_status` | `VARCHAR(20)` | Status at archive publish; a drift re-archives the row (hub-side only) |
| `anchor_txid` | `VARCHAR(80)` | DOGE ANCHOR txid of the archiving transaction (hub-side audit; not mirrored) |
| `created_at` | `TIMESTAMP NOT NULL` | Record creation time |

**Unique key:** `(call_id, phase)`. **Keys:** `(source_chain, source_action_index)`, `(target_chain, phase)`, `(effective_time)`, `(status)`, `(batch_seq)`

## Governance Tables

| Table | Purpose |
|---|---|
| `governance_proposals` | Parameter change proposals |
| `governance_votes` | Validator votes on proposals |

### `governance_proposals`

Off-chain governance proposals for modifying hub parameters. Proposals have a voting period (default 7 days) and require 2/3+ validator approval.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `proposal_id` | `VARCHAR(100) NOT NULL UNIQUE` | Unique proposal identifier |
| `proposer_pubkey` | `CHAR(64) NOT NULL` | Proposer's Ed25519 pubkey |
| `parameter` | `VARCHAR(100) NOT NULL` | Parameter being changed |
| `current_value` | `TEXT` | Current value of the parameter |
| `proposed_value` | `TEXT NOT NULL` | Proposed new value |
| `rationale` | `TEXT` | Reason for the proposed change |
| `status` | `ENUM('voting','passed','failed','expired')` | Proposal status (default: `voting`) |
| `voting_start` | `TIMESTAMP NOT NULL` | Start of voting period |
| `voting_end` | `TIMESTAMP NOT NULL` | End of voting period |
| `activation_block` | `BIGINT NULL DEFAULT NULL` | Block-anchored activation height for `CAPABILITY_<CAP>_MIN_STAKE` proposals; every hub resolves the threshold for block N as the latest `activation_block <= N`, keeping the capability validator set federation-deterministic. NULL for proposals predating this column or carrying no activation height. |
| `applied_at` | `TIMESTAMP NULL` | When the change was applied (if passed) |
| `created_at` | `TIMESTAMP` | Record creation time |

**Keys:** `(parameter)`, `(status)`

### `governance_votes`

Individual validator votes cast on governance proposals.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `proposal_id` | `VARCHAR(100) NOT NULL` | Proposal being voted on |
| `voter_pubkey` | `CHAR(64) NOT NULL` | Voter's Ed25519 pubkey |
| `vote` | `ENUM('approve','reject')` | Vote cast |
| `signature` | `TEXT NOT NULL` | Ed25519 signature of the vote |
| `created_at` | `TIMESTAMP` | When the vote was cast |

**Unique key:** `(proposal_id, voter_pubkey)`; one vote per validator per proposal

## Incentive Tables

| Table | Purpose |
|---|---|
| `validator_rewards` | Per-round oracle reward accounting |
| `slash_proposals` | Detected validator misbehavior records |

### `validator_rewards`

Tracks XCHAIN rewards earned by validators for participating in oracle rounds. Rewards are distributed equally among all participants in a finalized round.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `validator_pubkey` | `CHAR(64) NOT NULL` | Validator's Ed25519 pubkey |
| `round_number` | `BIGINT NOT NULL` | Oracle round that generated the reward |
| `reward_type` | `VARCHAR(20) NOT NULL` | Reward type (default: `oracle_round`) |
| `amount` | `VARCHAR(40) NOT NULL` | Reward amount (8 decimal precision) |
| `block_index` | `BIGINT NULL` | On-chain block index where the reward was settled (NULL for pending rewards) |
| `batch_seq` | `BIGINT NULL` | ANCHOR archive batch associated with this reward (NULL when not yet archived) |
| `claimed` | `TINYINT(1) NOT NULL` | Whether the reward has been claimed (default: 0) |
| `created_at` | `TIMESTAMP` | Record creation time |

**Unique key:** `(validator_pubkey, round_number, reward_type)`. **Keys:** `(validator_pubkey)`, `(round_number)`, `(validator_pubkey, claimed)`, `(batch_seq)`

### `slash_proposals`

Records detected validator misbehavior for governance review. The hub detects violations but does not execute slashing directly, actual slashing occurs via the indexer's staking contract.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `validator_pubkey` | `CHAR(64) NOT NULL` | Offending validator's pubkey |
| `offense_type` | `VARCHAR(30) NOT NULL` | Type: `price_deviation`, `repeated_deviation`, `non_participation` |
| `round_number` | `BIGINT` | Round where offense occurred |
| `evidence` | `TEXT` | Serialized evidence details |
| `status` | `ENUM('pending','approved','rejected','expired')` | Proposal status (default: `pending`) |
| `created_at` | `TIMESTAMP` | Detection time |

**Keys:** `(validator_pubkey)`, `(status)`

## Checkpoint Tables

| Table | Purpose |
|---|---|
| `state_checkpoints` | Quorum-signed per-chain ledger/actions/contract hash snapshots; mirrored to indexers |
| `capability_snapshots` | Per-block capability validator sets locked at BTC-anchored block boundaries |

### `state_checkpoints`

Quorum-signed block-level hash checkpoints for each chain. Rows are append-only; a reorged height is superseded by a new row with a higher `checkpoint_seq`. Readers resolve "the" checkpoint for a height as `MAX(checkpoint_seq)`. The `id` column is the mirror cursor (`since_id`) used by the xchain-sync replication layer.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT` | Mirror cursor (since_id) and primary key |
| `chain` | `VARCHAR(10) NOT NULL` | Chain being checkpointed (BTC, LTC, DOGE) |
| `network` | `VARCHAR(20) NOT NULL` | mainnet / testnet / regtest; signed into the canonical |
| `block_index` | `BIGINT UNSIGNED NOT NULL` | Checkpointed block height on `chain` |
| `block_hash` | `VARCHAR(64) NOT NULL` | Chain block hash at `block_index` |
| `ledger_hash` | `VARCHAR(64) NOT NULL` | Indexer `blocks.ledger_hash` (chained) at `block_index` |
| `actions_hash` | `VARCHAR(64) NOT NULL` | Indexer `blocks.actions_hash` (chained) at `block_index` |
| `contract_hash` | `VARCHAR(64) NOT NULL` | Indexer `blocks.contract_hash` (chained) at `block_index` |
| `checkpoint_seq` | `BIGINT UNSIGNED NOT NULL` | Monotonic sequence per `(chain, network)`; replay guard |
| `snapshot_block` | `BIGINT UNSIGNED NOT NULL` | BTC block selecting the `oracle_publish` validator set for signature verification |
| `state_root` | `CHAR(64)` | SPV light-client state root (SMT over balances and stakes); NULL before the CHECKPOINT_COMMITMENT flag-day |
| `state_root_version` | `TINYINT UNSIGNED` | `merkle.js STATE_ROOT_VERSION` the state root was computed under; NULL before flag-day |
| `block_merkle_root` | `CHAR(64)` | SPV per-block content Merkle root; NULL before flag-day |
| `block_merkle_version` | `TINYINT UNSIGNED` | `merkle.js BLOCK_MERKLE_VERSION`; NULL before flag-day |
| `validator_signatures` | `TEXT NOT NULL` | JSON array of `{pubkey, sig}` (2f+1 signatures over the XCHECKPOINT canonical) |
| `anchor_txid` | `VARCHAR(64)` | DOGE ANCHOR txid once published on-chain (hub-side audit only) |
| `created_at` | `TIMESTAMP NOT NULL` | Record creation time |

**Unique key:** `(chain, network, block_index, checkpoint_seq)`. **Keys:** `(chain, network, checkpoint_seq)`

### `capability_snapshots`

Records which validators qualified for each capability at a given BTC-anchored block boundary. The hub queries the indexer's `getcapabilityvalidators` RPC and writes one row per qualifying pubkey. All consensus engines read from this table (via `CapabilitySnapshot.getSnapshot()`) to lock the quorum set at a specific block so every hub in the federation sees the same set even as stake drifts mid-round.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT` | Mirror cursor (since_id) and primary key |
| `snapshot_block` | `BIGINT UNSIGNED NOT NULL` | BTC-anchored block boundary this set is locked at |
| `capability` | `VARCHAR(20) NOT NULL` | Capability name (e.g. `cross_chain`) |
| `signing_pubkey` | `VARCHAR(64) NOT NULL` | Ed25519 validator pubkey (64 hex chars) |
| `amount` | `VARCHAR(250) NOT NULL` | Source aggregate active stake at the block (quorum weight under STAKE_WEIGHTED_QUORUM) |
| `source` | `VARCHAR(255) NOT NULL` | Staking address (source) this key signs for; quorum weight is per-source, not per-key. Empty string on pre-activation rows. (default `''`) |
| `created_at` | `TIMESTAMP NOT NULL` | Record creation time |

**Unique key:** `(snapshot_block, capability, signing_pubkey)`. **Keys:** `(capability, snapshot_block)`

## Validator State Tables

| Table | Purpose |
|---|---|
| `validator_capabilities` | Per-validator capability qualification and self-test status (local hub view) |

### `validator_capabilities`

Tracks the current qualification and self-test status of each capability for this hub's local validator identity. One row per `(signing_pubkey, capability)` pair. Updated after each stake poll and self-test cycle. This is a local bookkeeping table; it is not mirrored to other hubs.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `signing_pubkey` | `CHAR(64) NOT NULL` | Ed25519 signing pubkey (64 hex chars) |
| `capability` | `ENUM('price','cross_chain','oracle_publish','attestation','full_node') NOT NULL` | Capability being tracked |
| `qualified` | `TINYINT(1) NOT NULL` | Stake amount meets `min_stake[capability]` (default 0) |
| `self_test_ok` | `TINYINT(1) NOT NULL` | Latest `selfTest()` passed (default 0) |
| `enabled` | `TINYINT(1) NOT NULL` | Operator has not opted out via `DISABLED_CAPABILITIES` (default 1) |
| `self_test_at` | `TIMESTAMP NULL` | When the self-test was last run |
| `self_test_msg` | `VARCHAR(255)` | Failure reason from the most recent self-test (NULL on success) |
| `qualified_at_block` | `BIGINT UNSIGNED NULL` | On-chain block where qualification was last computed |
| `created_at` | `TIMESTAMP` | Record creation time |
| `updated_at` | `TIMESTAMP` | Last modification time (auto-updated) |

**Unique key:** `(signing_pubkey, capability)`. **Keys:** `(qualified, capability)`, `(self_test_ok, capability)`, `(enabled, capability)`

## Telemetry Tables

| Table | Purpose |
|---|---|
| `telemetry_pings` | Anonymous installation and heartbeat events from xchain-node installs |

### `telemetry_pings`

Stores anonymous telemetry events submitted by `xchain-node` installs. The connecting IP is never stored; only a keyed HMAC-SHA256 hash is retained (using `TELEMETRY_IP_SALT`) to count distinct sources without logging identifiable data.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT` | Primary key |
| `install_id` | `CHAR(36) NOT NULL` | Anonymous UUID generated once per xchain-node installation |
| `country` | `CHAR(2)` | Two-letter country code derived from the connecting IP at ingest; the raw IP is then discarded |
| `region` | `VARCHAR(16)` | Subdivision/state code, best-effort and often NULL, paired with country |
| `ip_hash` | `CHAR(64)` | Keyed HMAC-SHA256(`TELEMETRY_IP_SALT`, ip); counts distinct sources without storing the IP |
| `node_version` | `VARCHAR(32)` | xchain-node version string |
| `os_platform` | `VARCHAR(32)` | `os.platform()` result (linux, darwin, win32) |
| `os_release` | `VARCHAR(64)` | `os.release()` result |
| `arch` | `VARCHAR(16)` | `os.arch()` result (x64, arm64) |
| `docker_version` | `VARCHAR(32)` | Docker engine version (best-effort) |
| `modules` | `JSON` | Array of `{module, coin, network, version, running}` objects |
| `event` | `VARCHAR(24)` | Event type: `install`, `update`, `start`, or `heartbeat` |
| `created_at` | `TIMESTAMP` | Record creation time |

**Keys:** `(install_id)`, `(country)`, `(ip_hash)`, `(created_at)`

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
