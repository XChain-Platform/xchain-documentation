<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Decoder: Database Schema

The decoder writes to a single MariaDB database. The indexer reads from this database (read-only from the indexer's perspective).

## Database Naming

```
XChain_{CHAIN}_{NETWORK}_Decoder
```

Examples: `XChain_BTC_Mainnet_Decoder`, `XChain_LTC_Regtest_Decoder`, `XChain_DOGE_Testnet_Decoder`

The database and all tables are auto-created on startup if they don't exist. Schema definitions live in `src/sql/*.sql`.

## Table Overview

| Table | Purpose | Primary Key |
|---|---|---|
| `blocks` | One row per parsed block | `block_index` |
| `transactions` | Confirmed XChain transactions | `tx_index` |
| `mempool_transactions` | Unconfirmed XChain transactions (raw strings, no FK ids) | `tx_hash` (unique) |
| `dispensers` | Open and soft-expired dispensers | `(tx_index, address_id)` |
| `transaction_outputs` | Outputs that paid to a dispenser address | `(tx_index, vout)` |
| `index_addresses` | Address string to integer ID lookup | `id` (auto-increment) |
| `index_transactions` | Transaction/block hash to integer ID lookup | `id` (auto-increment) |
| `events` | System events (reorgs, errors) | `id` (auto-increment) |
| `pubkeys` | Source-address public keys captured during parsing | `address_id` |

## Core Tables

### blocks

Stores one row per block that the decoder has processed.

| Column | Type | Description |
|---|---|---|
| `block_index` | `BIGINT UNSIGNED` | Block height (primary key) |
| `block_time` | `BIGINT UNSIGNED` | Block timestamp (unix epoch) |
| `block_hash_id` | `BIGINT UNSIGNED` | FK to `index_transactions.id` |
| `previous_block_hash_id` | `BIGINT UNSIGNED` | FK to `index_transactions.id` |

**Indexes:** `block_hash_id`, `previous_block_hash_id`

### transactions

Stores confirmed XChain transactions (transactions whose deobfuscated payload starts with `XCHN`).

| Column | Type | Description |
|---|---|---|
| `tx_index` | `BIGINT UNSIGNED` | Transaction index (primary key, auto-assigned) |
| `tx_hash_id` | `BIGINT UNSIGNED` | FK to `index_transactions.id` (unique) |
| `block_index` | `BIGINT UNSIGNED` | Block height containing this transaction |
| `source_id` | `BIGINT UNSIGNED` | FK to `index_addresses.id` (sender) |
| `destination_id` | `BIGINT UNSIGNED` | FK to `index_addresses.id` (receiver) |
| `amount` | `BIGINT` | BTC/LTC/DOGE amount in satoshis |
| `fee` | `BIGINT` | Transaction fee in satoshis |
| `data` | `MEDIUMTEXT` | Decoded ACTION string (e.g., `SEND\|0\|TOKEN\|1000`) |
| `raw_data` | `MEDIUMBLOB` | Raw payload bytes (preserved for binary payloads such as gated-FILE ciphertext) |

**Indexes:** `tx_hash_id` (unique), `block_index`, `source_id`, `destination_id`

### mempool_transactions

Holds unconfirmed XChain transactions. Rows are created when a transaction enters the mempool and deleted when it confirms (promoted to `transactions`) or drops out of the mempool.

**Important:** this table stores raw strings rather than FK integer IDs. Mempool arrival order is node-local and non-deterministic, while `index_addresses` and `index_transactions` are part of the replicated decoder set. Pre-allocating lookup IDs during mempool observation would let two nodes assign different AUTO_INCREMENT IDs to the same address or hash, causing silent divergence. IDs are allocated only during deterministic block-confirmation processing (see `insertTransaction`). This table is intentionally excluded from xchain-sync replication.

| Column | Type | Description |
|---|---|---|
| `tx_hash` | `VARCHAR(250)` | Raw transaction hash (NOT an `index_transactions` id) |
| `source` | `VARCHAR(120)` | Raw source address (NOT an `index_addresses` id) |
| `destination` | `VARCHAR(120)` | Raw destination address (NOT an `index_addresses` id) |
| `amount` | `BIGINT` | Amount in satoshis |
| `fee` | `BIGINT` | Fee in satoshis |
| `data` | `MEDIUMTEXT` | Decoded ACTION string |

**Indexes:** `tx_hash` (unique), `source`, `destination`

## DISPENSER Tables

### dispensers

Tracks open and soft-expired dispensers. A dispenser is created when the decoder encounters a `DISPENSER|0|...` action with valid fields. Rather than deleting a dispenser row on expiry, the decoder sets `expired_block_index` to the current block height (soft-expire), which allows a subsequent reorg to restore the dispenser by clearing that mark. Rows are hard-deleted once they are reorg-safe-deep (`DISPENSER_EXPIRE_SAFE_DEPTH = 100` blocks), bounding table growth.

| Column | Type | Description |
|---|---|---|
| `tx_index` | `BIGINT UNSIGNED` | Transaction that created the dispenser |
| `address_id` | `BIGINT UNSIGNED` | FK to `index_addresses.id` (dispenser owner) |
| `expiration` | `BIGINT UNSIGNED` | Expiration as a raw Unix timestamp in seconds. Stored as an integer (not via `FROM_UNIXTIME()`) because `FROM_UNIXTIME()` caps at 2147483647 (Y2038) and returns `NULL` above that value, which would silently drop dispensers with far-future expirations. The raw `BIGINT UNSIGNED` column supports values up to 4294967295 (year 2106), matching the protocol's accepted range. |
| `expired_block_index` | `BIGINT UNSIGNED DEFAULT NULL` | `NULL` for open dispensers. Set to the block height that soft-expired this row instead of hard-deleting it; a reorg's `deleteBlockByIndex` clears the mark for orphaned heights, restoring any dispenser that an orphaned block's non-monotonic timestamp expired. |

**Primary Key:** `(tx_index, address_id)`

**Indexes:** `dispensers_expired_block_index`, `dispensers_expiration`

### transaction_outputs

Records outputs that paid to an active dispenser's address. These are detected during transaction parsing when `isThereADispenserForAddress()` returns true. Also used to record outputs paying the native-coin fee destination (when `FEE_DESTINATION` is set), so the indexer can validate native-coin fee payments.

| Column | Type | Description |
|---|---|---|
| `tx_index` | `BIGINT UNSIGNED` | Transaction containing the output |
| `vout` | `BIGINT UNSIGNED` | Output index within the transaction |
| `destination_id` | `BIGINT UNSIGNED` | FK to `index_addresses.id` (dispenser or fee address) |
| `amount` | `VARCHAR(250)` | Coin amount in decimal (e.g., `0.01000000`) |

**Primary Key:** `(tx_index, vout)`

## Index Tables

Index tables normalize frequently-repeated strings (addresses, transaction hashes) into integer IDs for storage efficiency and join performance. Both tables reserve `id=1` for a blank/null sentinel value.

### index_addresses

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT` | Address ID (primary key) |
| `address` | `VARCHAR(120)` | Address string |

**Indexes:** `address` (full-column UNIQUE index; enforces one row per address and makes `INSERT IGNORE` upserts race-safe)

Row `id=1` is reserved as a blank/null sentinel (inserted at table creation with `address=''`).

### index_transactions

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT` | Hash ID (primary key) |
| `hash` | `VARCHAR(250)` | Transaction or block hash |

**Indexes:** `hash` (full-column UNIQUE index; enforces one row per hash and makes `INSERT IGNORE` upserts race-safe)

Row `id=1` is reserved as a blank/null sentinel (inserted at table creation with `hash=''`).

## Events Table

### events

Records system events such as chain reorganizations.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT` | Event ID (primary key) |
| `time` | `DATETIME` | Event timestamp |
| `code` | `VARCHAR(32)` | Event type code (e.g., `REORG`) |
| `data` | `MEDIUMTEXT` | Event payload (JSON). `MEDIUMTEXT` (16 MB cap) rather than `TEXT` (64 KB): a deep reorg serializes ~100 bytes per rolled-back block, so a >650-block reorg walk would overflow `TEXT` and silently truncate the only audit record. |

### pubkeys

Records the source-address public key captured when parsing a transaction whose first input exposes it in the scriptSig or witness. Used by xchain-sync to replicate the `source_pubkey` field per transaction to validators.

| Column | Type | Description |
|---|---|---|
| `address_id` | `BIGINT UNSIGNED NOT NULL` | PK, FK to `index_addresses.id` |
| `pubkey` | `VARCHAR(66) NOT NULL` | Compressed public key (hex) |

**Foreign key:** `address_id` references `index_addresses(id)`

## Schema Migrations

The decoder applies schema changes via a tracked migration system. Two paths exist:

- **Automatic (startup):** migrations tagged `-- xchain:migration mode=auto` in their header are applied by the normal startup sequence. These must be additive and idempotent.
- **Manual (operator):** migrations tagged `mode=manual` (destructive column-type changes, data backfills, dedup-then-unique) run only when an operator explicitly invokes:

  ```bash
  node src/migrate.js
  # or: npm run migrate
  ```

Each migration is recorded in the `schema_migrations` table (created automatically) and is applied at most once regardless of how many times the command is run. An advisory lock prevents concurrent migration runs. Migration files live in `src/sql/migrations/` and are applied in filename sort order.

Notable applied migrations:

| File | Mode | Effect |
|---|---|---|
| `2026-05-28-unique-index-tables.sql` | manual | De-duplicates `index_addresses`/`index_transactions` rows, then adds UNIQUE indexes |
| `2026-06-02-widen-ids-to-bigint.sql` | manual | Widens all `INTEGER UNSIGNED` id/key columns to `BIGINT UNSIGNED` across seven tables (`index_addresses`, `index_transactions`, `pubkeys`, `blocks`, `transactions`, `dispensers`, `transaction_outputs`). `mempool_transactions` is not included; the `2026-06-15-mempool-raw-strings.sql` migration later drops and recreates that table entirely with the correct types. |
| `2026-06-13-dispensers-expiration-bigint.sql` | manual | Changes `dispensers.expiration` from `DATETIME` to `BIGINT UNSIGNED` |
| `2026-06-15-events-data-mediumtext.sql` | auto | Widens `events.data` from `TEXT` to `MEDIUMTEXT` |
| `2026-06-15-mempool-raw-strings.sql` | manual | Drops and recreates `mempool_transactions` with raw `VARCHAR` columns instead of FK integer IDs |
| `2026-06-17-pubkeys-add-monotonic-id.sql` | auto | Adds `id BIGINT UNSIGNED AUTO_INCREMENT UNIQUE` to `pubkeys` for stable replication paging |

## Data Flow

```
Coin Node  →  BlockchainConnector  →  XChainDecoder.parseTransaction()
                                           │
                                    ┌──────┴──────┐
                                    │             │
                              blocks table   transactions table
                                    │             │
                              index_transactions  index_addresses
                                    │             │
                              dispensers     transaction_outputs
                                    │
                              events (reorgs)
```

## Satoshi Conversion

The `bigIntSatoshiToDecimalsString()` method converts satoshi values (integers or BigInts) to decimal strings with 8 decimal places:

| Input | Output |
|---|---|
| `100000000` | `"1.00000000"` |
| `50000000` | `"0.50000000"` |
| `1` | `"0.00000001"` |
| `0` | `"0.00000000"` |
| `-100000000` | `"-1.00000000"` |

This is used for the `amount` column in `transaction_outputs`.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
