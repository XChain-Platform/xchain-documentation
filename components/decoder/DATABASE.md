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
| `mempool_transactions` | Unconfirmed XChain transactions | `tx_hash_id` (unique) |
| `dispensers` | Active (unexpired) dispensers | `(tx_index, address_id)` |
| `transaction_outputs` | Outputs that paid to a dispenser address | `(tx_index, vout)` |
| `index_addresses` | Address string → integer ID lookup | `id` (auto-increment) |
| `index_transactions` | Transaction/block hash → integer ID lookup | `id` (auto-increment) |
| `events` | System events (reorgs, errors) | `id` (auto-increment) |

## Core Tables

### blocks

Stores one row per block that the decoder has processed.

| Column | Type | Description |
|---|---|---|
| `block_index` | `INTEGER UNSIGNED` | Block height (primary key) |
| `block_time` | `INTEGER UNSIGNED` | Block timestamp (unix epoch) |
| `block_hash_id` | `INTEGER UNSIGNED` | FK → `index_transactions.id` |
| `previous_block_hash_id` | `INTEGER UNSIGNED` | FK → `index_transactions.id` |

**Indexes:** `block_hash_id`, `previous_block_hash_id`

### transactions

Stores confirmed XChain transactions (transactions whose deobfuscated payload starts with `XCHN`).

| Column | Type | Description |
|---|---|---|
| `tx_index` | `INTEGER UNSIGNED` | Transaction index (primary key, auto-assigned) |
| `tx_hash_id` | `INTEGER UNSIGNED` | FK → `index_transactions.id` (unique) |
| `block_index` | `INTEGER UNSIGNED` | Block height containing this transaction |
| `source_id` | `INTEGER UNSIGNED` | FK → `index_addresses.id` (sender) |
| `destination_id` | `INTEGER UNSIGNED` | FK → `index_addresses.id` (receiver) |
| `amount` | `BIGINT` | BTC/LTC/DOGE amount in satoshis |
| `fee` | `BIGINT` | Transaction fee in satoshis |
| `data` | `MEDIUMTEXT` | Decoded ACTION string (e.g., `SEND\|0\|TOKEN\|1000`) |

**Indexes:** `tx_hash_id` (unique), `block_index`, `source_id`, `destination_id`

### mempool_transactions

Same structure as `transactions` but without `tx_index` or `block_index`. Rows are created when a transaction enters the mempool and deleted when it confirms (promoted to `transactions`) or drops out.

| Column | Type | Description |
|---|---|---|
| `tx_hash_id` | `INTEGER UNSIGNED` | FK → `index_transactions.id` (unique) |
| `source_id` | `INTEGER UNSIGNED` | FK → `index_addresses.id` |
| `destination_id` | `INTEGER UNSIGNED` | FK → `index_addresses.id` |
| `amount` | `BIGINT` | Amount in satoshis |
| `fee` | `BIGINT` | Fee in satoshis |
| `data` | `MEDIUMTEXT` | Decoded ACTION string |

**Indexes:** `tx_hash_id` (unique), `source_id`, `destination_id`

## DISPENSER Tables

### dispensers

Tracks active (unexpired) dispensers. A dispenser is created when the decoder encounters a `DISPENSER|0|...` action with valid fields. Expired dispensers are deleted at the start of each new block.

| Column | Type | Description |
|---|---|---|
| `tx_index` | `INTEGER UNSIGNED` | Transaction that created the dispenser |
| `address_id` | `INTEGER UNSIGNED` | FK → `index_addresses.id` (dispenser owner) |
| `expiration` | `BIGINT UNSIGNED` | Expiration as a raw Unix timestamp in seconds. Stored as an integer (**not** via `FROM_UNIXTIME()`) because `FROM_UNIXTIME()` caps at 2147483647 (Y2038) and returns `NULL` above that value, which would silently drop dispensers with far-future expirations. The raw `BIGINT UNSIGNED` column supports values up to 4294967295 (year 2106), matching the protocol's accepted range. |

**Primary Key:** `(tx_index, address_id)`

### transaction_outputs

Records outputs that paid to an active dispenser's address. These are detected during transaction parsing when `isThereADispenserForAddress()` returns true.

| Column | Type | Description |
|---|---|---|
| `tx_index` | `INTEGER UNSIGNED` | Transaction containing the output |
| `vout` | `INTEGER UNSIGNED` | Output index within the transaction |
| `destination_id` | `INTEGER UNSIGNED` | FK → `index_addresses.id` (dispenser address) |
| `amount` | `VARCHAR(250)` | Coin amount in decimal (e.g., `0.01000000`) |

**Primary Key:** `(tx_index, vout)`

## Index Tables

Index tables normalize frequently-repeated strings (addresses, transaction hashes) into integer IDs for storage efficiency and join performance. Both tables reserve `id=1` for a blank/null sentinel value.

### index_addresses

| Column | Type | Description |
|---|---|---|
| `id` | `INTEGER UNSIGNED AUTO_INCREMENT` | Address ID (primary key) |
| `address` | `VARCHAR(120)` | Address string |

**Indexes:** `address` (partial index on first 10 characters)

### index_transactions

| Column | Type | Description |
|---|---|---|
| `id` | `INTEGER UNSIGNED AUTO_INCREMENT` | Hash ID (primary key) |
| `hash` | `VARCHAR(250)` | Transaction or block hash |

**Indexes:** `hash` (partial index on first 20 characters)

## Events Table

### events

Records system events such as chain reorganizations.

| Column | Type | Description |
|---|---|---|
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT` | Event ID (primary key) |
| `time` | `DATETIME` | Event timestamp |
| `code` | `VARCHAR(32)` | Event type code (e.g., `REORG`) |
| `data` | `TEXT` | Event payload (JSON) |

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
