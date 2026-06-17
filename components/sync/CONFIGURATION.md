<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Indexer Sync: Configuration

## Environment Variables

### Common (Both Modes)

These variables are required regardless of whether the service runs in server or client mode.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SYNC_MODE` | Yes | `server` | Operating mode: `server` or `client` |
| `SYNC_API_PORT` | Yes | `3006` | HTTP and WebSocket listen port |
| `HUB_VALIDATORS` | No | `""` | Comma-separated hub URLs. Takes priority over `HUB_API_HOST`/`HUB_PORT` when set. Use this for multi-hub topologies. |
| `HUB_API_HOST` | Yes | None | Hostname of the local xchain-hub instance (used when `HUB_VALIDATORS` is not set) |
| `HUB_PORT` | Yes | `10000` | Port of the local xchain-hub instance |
| `HUB_REPOLL_INTERVAL` | No | `300000` | Milliseconds between hub re-polls for chain discovery (5 minutes) |
| `CORS_ORIGIN` | No | `false` | Allowed CORS origin. Set to a specific origin string to enable cross-origin requests. Disabled when not set. |
| `SYNC_API_KEY` | No | None | API key for Bearer token authentication on REST and WebSocket endpoints. Disabled when not set. |
| `HUB_PROTOCOL` | No | `http` | Protocol for hub connection: `http` or `https` |
| `TRUST_PROXY` | No | `false` | Trust `x-forwarded-for` header for IP-based rate limiting (enable only behind a reverse proxy) |

### Server Mode

In server mode, **no database environment variables are needed**. The service discovers all indexer and decoder database connections by calling the hub's `getallconfigs` method. The hub returns the `db_host`, `db_port`, `name` (database name), `user`, and `pass` for every installed indexer and decoder.

| Variable | Required | Default | Description |
|---|---|---|---|
| `BLOCK_POLL_INTERVAL` | No | `3000` | Milliseconds between polls to each indexer database for new blocks |
| `WS_MAX_PER_IP` | No | `100` | Maximum simultaneous WebSocket connections per IP address. The high default accommodates multi-chain validators that open one connection per chain/network/dbType from the same IP. |
| `SNAPSHOT_RATE_FULL` | No | `12` | Maximum full snapshot downloads per hour per IP per chain/network/dbType |
| `SNAPSHOT_RATE_INCR` | No | `600` | Maximum incremental snapshot downloads per hour per IP per chain/network/dbType |
| `WS_STATUS_INTERVAL` | No | `60000` | Milliseconds between periodic status broadcasts to WebSocket subscribers (60 seconds) |
| `WS_PING_INTERVAL` | No | `30000` | Milliseconds between WebSocket ping frames (30 seconds) |
| `WS_BACKPRESSURE_LIMIT` | No | `50` | Number of consecutive buffered sends before a slow subscriber is force-disconnected |
| `VALIDATOR_HEARTBEAT_TTL` | No | `60000` | Milliseconds before an unresponsive validator is marked `stale` in `/validator-status` (rather than deleted) |
| `EXPECTED_VALIDATORS` | No | `""` | Comma-separated list of expected validator IDs/pubkeys. When set, `/validator-status` reports an `expected_total` denominator and flags roster members that have never sent a heartbeat as `absent`. Unset means no roster check. |

### Client Mode

In client mode, the service connects to remote sync servers and replicates their data into local MariaDB databases.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SYNC_SOURCES` | Yes | None | Comma-separated list of remote sync server URLs (e.g., `http://sync1.example.com:3006,http://sync2.example.com:3006`). Minimum 1 required; 2+ recommended for cross-verification. |
| `VERIFY_HASHES` | No | `true` | When `true`, cross-verifies block hashes from multiple sources before applying. Requires 2+ sources. |
| `HALT_ON_DIVERGENCE` | No | `true` | **Security-critical. Default ON. Set to `false` only for read-only convenience mirrors whose state nothing downstream trusts.** When `true`, a confirmed cross-source hash divergence (two honest sources committed different ledger/actions/contract hashes for the same block) causes a durable halt instead of logging and silently stalling. |
| `VERIFY_RECOMPUTE` | No | `true` | **Security-critical. Default ON. Disabling is DECLARED UNSAFE for consensus-relevant replicas.** When `true`, each block's consensus hashes (ledger/actions/contract) are independently recomputed from the replicated rows and checked against the committed hash. This is the only mechanism that verifies the catch-up join block: with it disabled, a reorg that occurs while the client is disconnected is silently stitched onto the orphaned pre-reorg tip, permanently forking the replica. |
| `VERIFY_STATE_HASH` | No | `true` | **Security-critical. Default ON.** When `true`, the per-block state hash (covering in-place mutations and backdated refund credits not captured by the three consensus hashes) is recomputed on apply and checked. A mismatch triggers a durable halt. A NULL state hash (block from a source without the feature) is skipped, so enabling this can never false-halt against a back-level source. |
| `REPLICA_DB_HOST` | Yes | None | MariaDB hostname for local replica databases |
| `REPLICA_DB_PORT` | No | `3306` | MariaDB port |
| `REPLICA_DB_USER` | Yes | None | MariaDB username for replica databases |
| `REPLICA_DB_PASS` | Yes | None | MariaDB password |
| `MAX_ROLLBACK_DEPTH` | No | `100` | Maximum rollback depth (in blocks) accepted from a single source |
| `HASH_CONFIRM_STRICT` | No | `false` | When `true`, reject blocks if cross-source verification times out (instead of applying from primary) |
| `HASH_CONFIRM_TIMEOUT` | No | `5000` | Milliseconds to wait for cross-source hash confirmation before timing out (5 seconds) |
| `CLIENT_RECONNECT_DELAY` | No | `5000` | Milliseconds to wait before reconnecting after a WebSocket disconnect (5 seconds) |
| `BOOTSTRAP_MAX_RETRIES` | No | `5` | Extra full-rotation bootstrap rounds to attempt after the first (0 means no retry). On exhaustion the process exits so the supervisor can restart. |
| `BOOTSTRAP_RETRY_BASE_MS` | No | `2000` | Initial backoff delay in ms before the first bootstrap retry; doubles each round |
| `BOOTSTRAP_RETRY_MAX_MS` | No | `60000` | Backoff ceiling in ms for bootstrap retries (60 seconds) |
| `WS_MAX_PAYLOAD` | No | `1048576` | Maximum incoming WebSocket message size in bytes (1 MB) |
| `SNAPSHOT_MAX_CONTENT` | No | `536870912` | Maximum HTTP response size for snapshot downloads in bytes (512 MB) |

## Hub Discovery

The service calls the local xchain-hub's `getallconfigs` JSON-RPC method at startup and every 5 minutes thereafter. The hub returns an envelope `{ configs, seq, watermark }`, where `configs` holds the nested configuration tree:

```json
{
  "configs": {
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
  },
  "seq": 42,
  "watermark": 1717400000
}
```

The nested config tree lives under `result.configs` (not at the top level). `seq` is the last committed consensus sequence number; `watermark` is an epoch-seconds high-water mark of the configs table. A consumer may retain `watermark` and pass it back as the `since_updated_at` request param on its next `getallconfigs` call to receive only the rows that changed since the previous poll (delta polling); omitting it returns the full tree.

The service iterates `result.configs` and, for each coin/network that has an `xchain-indexer` or `xchain-decoder` entry, extracts the following fields and creates a separate `Database` instance with the corresponding `dbType` (`indexer` or `decoder`):

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

| Chain | Ticker | dbType | Example Database Name |
|---|---|---|---|
| Bitcoin mainnet | BTC | indexer | `XChain_BTC_Mainnet_Indexer` |
| Bitcoin mainnet | BTC | decoder | `XChain_BTC_Mainnet_Decoder` |
| Bitcoin testnet | BTC | indexer | `XChain_BTC_Testnet_Indexer` |
| Litecoin mainnet | LTC | indexer | `XChain_LTC_Mainnet_Indexer` |
| Dogecoin mainnet | DOGE | indexer | `XChain_DOGE_Mainnet_Indexer` |
| Dogecoin regtest | DOGE | decoder | `XChain_DOGE_Regtest_Decoder` |

In **server mode**, the service reads from the authoritative indexer and decoder databases; the same ones the indexer/decoder write to.

In **client mode**, the service creates replica databases with the same names and schema. Indexer replicas contain an exact copy of the indexer data; decoder replicas contain 8 of the 9 decoder tables (`mempool_transactions` excluded).

## Database Schema

### Indexer replicas

Indexer replica databases use the same full schema as the authoritative indexer. The SQL table definitions are shipped with the sync service in `src/sql/`. Tables include:

- **Core**: `blocks`, `transactions`, `actions`
- **Index/Dedup**: `index_addresses`, `index_tickers`, `index_transactions`, `index_actions`, `index_statuses`, `index_coins`, `index_fiats`, `index_memos`, `index_mime_types`, `index_pubkeys`
- **Ledger**: `credits`, `debits`, `escrows`, `balances`, `fees`, `tokens`
- **Action-specific**: `sends`, `issues`, `destroys`, `airdrops`, `dividends`, `orders`, `dispensers`, `swaps`, `broadcasts`, `messages`, `files`, `links`, `lists`, `callbacks`, `sleeps`, `sweeps`, `mints`, `batches`
- **Lifecycle**: `order_matches`, `order_expires`, `order_edits`, `order_cancels`, `order_statuses`, `swap_matches`, `swap_expires`, `swap_edits`, `swap_cancels`, `swap_statuses`, `dispenser_closes`, `dispenser_expires`, `dispenser_edits`, `dispenser_cancels`, `dispenser_statuses`, `dispenses`
- **COINPay**: `coinpays`, `coinpay_obligations`, `coinpay_expires`, `coinpay_statuses`
- **Staking**: `stakes`, `unstakes`, `delegations`, `validator_rewards`, `reward_claims`
- **VM**: `contracts`, `contract_state`, `contract_executions`, `contract_emissions`, `deposits`, `withdrawals`
- **Mapping**: `mappings_actions`, `mappings_files`
- **Other**: `addresses`, `markets`, `events`, `list_edits`, `list_items`, `list_items_invalid`

One additional table is used by the sync service itself for indexer replicas only:

- **`sync_meta`**: transparency log (`(block_index, block_time, ledger_hash, actions_hash, contract_hash, logged_at)`) **indexer only**, not created for decoder replicas

### Decoder replicas

Decoder replica databases use a smaller schema derived from the decoder DB. Of the 9 tables in the decoder DB, xchain-sync replicates 8 (`mempool_transactions` is excluded as it is non-deterministic across nodes):

- `blocks`, `transactions`, `transaction_outputs`, `dispensers`
- `index_addresses`, `index_transactions`, `pubkeys`, `events`

The transparency log table (`sync_meta`) is not created for decoder replicas.

**Note on `dispensers` replication:** `dispensers` is present in the replica but does NOT ride the per-block WebSocket stream. The decoder soft-expires dispenser rows each block (updating `expired_block_index`) and defers hard-purges to a separate job; neither mutation is block-bound. Streaming only inserted rows would cause a follower's count to grow monotonically above the source. Instead, `dispensers` converges to the current source state via full snapshot only. Do not use the per-block row count for `dispensers` as a completeness signal.

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

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
