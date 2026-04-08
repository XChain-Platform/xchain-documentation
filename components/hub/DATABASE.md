<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Hub — Database Schema

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

Finalized price data after PBFT consensus. Cross-chain unified view — populated by either the hub's local PBFT consensus (when running in validator mode) or by `PriceAggregator.receiveValidatedRound()` when an indexer pushes a validated PRICE v0 from any chain. Deduplicated by `round_number` (first valid submission wins).

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
| `consensus_proof` | `TEXT NOT NULL` | Serialized consensus proof — JSON array of `{pubkey, sig}` for PRICE v0 |
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

**Unique key:** `(proposal_id, voter_pubkey)` — one vote per validator per proposal

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
| `claimed` | `TINYINT(1) NOT NULL` | Whether the reward has been claimed (default: 0) |
| `created_at` | `TIMESTAMP` | Record creation time |

**Keys:** `(validator_pubkey)`, `(round_number)`, `(validator_pubkey, claimed)`

### `slash_proposals`

Records detected validator misbehavior for governance review. The hub detects violations but does not execute slashing directly — actual slashing occurs via the indexer's staking contract.

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

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
