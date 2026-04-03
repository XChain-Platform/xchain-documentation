<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Indexer Sync — Configuration

## Environment Variables

### Common (Both Modes)

These variables are required regardless of whether the service runs in server or client mode.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SYNC_MODE` | Yes | `server` | Operating mode: `server` or `client` |
| `SYNC_API_PORT` | Yes | `3006` | HTTP and WebSocket listen port |
| `HUB_API_HOST` | Yes | — | Hostname of the local xchain-hub instance |
| `HUB_PORT` | Yes | `10000` | Port of the local xchain-hub instance |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin |

### Server Mode

In server mode, **no database environment variables are needed**. The service discovers all indexer database connections by calling the hub's `getallconfigs` method. The hub returns the `db_host`, `db_port`, `name` (database name), `user`, and `pass` for every installed indexer.

| Variable | Required | Default | Description |
|---|---|---|---|
| `BLOCK_POLL_INTERVAL` | No | `3000` | Milliseconds between polls to each indexer database for new blocks |
| `WS_MAX_PER_IP` | No | `3` | Maximum simultaneous WebSocket connections per IP address |
| `SNAPSHOT_RATE_FULL` | No | `1` | Maximum full snapshot downloads per hour per IP |
| `SNAPSHOT_RATE_INCR` | No | `10` | Maximum incremental snapshot downloads per hour per IP |

### Client Mode

In client mode, the service connects to remote sync servers and replicates their data into local MariaDB databases.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SYNC_SOURCES` | Yes | — | Comma-separated list of remote sync server URLs (e.g., `http://sync1.example.com:3006,http://sync2.example.com:3006`). Minimum 1 required; 2+ recommended for cross-verification. |
| `VERIFY_HASHES` | No | `true` | When `true`, cross-verifies block hashes from multiple sources before applying. Requires 2+ sources. |
| `REPLICA_DB_HOST` | Yes | — | MariaDB hostname for local replica databases |
| `REPLICA_DB_PORT` | No | `3306` | MariaDB port |
| `REPLICA_DB_USER` | Yes | — | MariaDB username for replica databases |
| `REPLICA_DB_PASS` | Yes | — | MariaDB password |

## Hub Discovery

The service calls the local xchain-hub's `getallconfigs` JSON-RPC method at startup and every 5 minutes thereafter. The hub returns a nested configuration object:

```json
{
  "bitcoin": {
    "mainnet": {
      "xchain-indexer": {
        "host": "xchain-node-bitcoin-mainnet-xchain-indexer",
        "port": "3004",
        "db_host": "mariadb",
        "db_port": "3306",
        "name": "XChain_BTC_Mainnet_Indexer",
        "user": "xchain_indexer_bitcoin_mainnet",
        "pass": "xchain-password"
      }
    },
    "testnet": {
      "xchain-indexer": { ... }
    }
  },
  "dogecoin": {
    "mainnet": {
      "xchain-indexer": { ... }
    }
  }
}
```

The service iterates this response and, for each coin/network that has an `xchain-indexer` entry, extracts:

| Hub Field | Used For |
|---|---|
| `db_host` | MariaDB connection host |
| `db_port` | MariaDB connection port |
| `name` | Database name (e.g., `XChain_BTC_Mainnet_Indexer`) |
| `user` | Database username |
| `pass` | Database password |

A separate MariaDB connection pool is created per chain/network.

## Database Naming

The sync service uses the same database naming convention as the rest of the platform:

```
XChain_{TICKER}_{Network}_{Component}
```

| Chain | Ticker | Example Database Name |
|---|---|---|
| Bitcoin mainnet | BTC | `XChain_BTC_Mainnet_Indexer` |
| Bitcoin testnet | BTC | `XChain_BTC_Testnet_Indexer` |
| Litecoin mainnet | LTC | `XChain_LTC_Mainnet_Indexer` |
| Dogecoin mainnet | DOGE | `XChain_DOGE_Mainnet_Indexer` |
| Dogecoin regtest | DOGE | `XChain_DOGE_Regtest_Indexer` |

In **server mode**, the service reads from the authoritative indexer databases — the same ones the indexer writes to and the explorer reads from.

In **client mode**, the service creates replica databases with the same names and schema. The replicas contain an exact copy of the indexer data, allowing local queries with the same table structure and column names.

## Database Schema

The replica databases use the same 77-table schema as the authoritative indexer. The SQL table definitions are shipped with the sync service in `src/sql/` (copied from `xchain-indexer/src/sql/`). Tables include:

- **Core**: `blocks`, `transactions`, `actions`
- **Index/Dedup**: `index_addresses`, `index_tickers`, `index_transactions`, `index_actions`, `index_statuses`, `index_coins`, `index_fiats`, `index_memos`, `index_mime_types`, `index_pubkeys`
- **Ledger**: `credits`, `debits`, `escrows`, `balances`, `fees`, `tokens`
- **Action-specific**: `sends`, `issues`, `destroys`, `airdrops`, `dividends`, `orders`, `dispensers`, `swaps`, `broadcasts`, `messages`, `files`, `links`, `lists`, `callbacks`, `sleeps`, `sweeps`, `mints`, `batches`
- **Lifecycle**: `order_matches`, `order_expires`, `order_edits`, `order_cancels`, `order_statuses`, `swap_matches`, `swap_expires`, `swap_edits`, `swap_cancels`, `swap_statuses`, `dispenser_closes`, `dispenser_expires`, `dispenser_edits`, `dispenser_cancels`, `dispenser_statuses`, `dispenses`
- **COINPay**: `coinpays`, `coinpay_obligations`, `coinpay_expires`, `coinpay_statuses`
- **Staking**: `stakes`, `unstakes`, `delegations`, `validator_rewards`, `reward_claims`
- **VM**: `contracts`, `contract_state`, `contract_executions`, `contract_emissions`, `contract_balances`, `deposits`, `withdrawals`
- **Mapping**: `mappings_actions`, `mappings_files`
- **Other**: `addresses`, `markets`, `events`, `list_edits`, `list_items`, `list_items_invalid`

One additional table is used by the sync service itself:

- **`sync_meta`**: transparency log — `(block_index, block_time, ledger_hash, actions_hash, contract_hash, logged_at)`

## Connection Pool Configuration

Each chain/network gets its own MariaDB connection pool with these parameters (matching the indexer's `db.js` defaults):

| Parameter | Value | Description |
|---|---|---|
| `connectionLimit` | `10` | Maximum simultaneous connections |
| `connectTimeout` | `10000` | Connection timeout (ms) |
| `acquireTimeout` | `10000` | Pool acquisition timeout (ms) |
| `idleTimeout` | `60000` | Idle connection timeout (ms) |
| `insertIdAsNumber` | `true` | Return insert IDs as numbers (not BigInt) |
| `minDelayValidation` | `3000` | Minimum delay between connection validation checks (ms) |

## Circuit Breaker

Each connection pool has an independent circuit breaker:

| Parameter | Value | Description |
|---|---|---|
| `circuitThreshold` | `10` | Consecutive failures before opening the circuit |
| `circuitCooldown` | `30000` | Milliseconds before attempting a half-open retry |

When a circuit opens, all queries to that chain/network fail fast until the cooldown period expires. Other chains' circuits are unaffected.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
