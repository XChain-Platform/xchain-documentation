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
| `MAX_HUB_WAIT_MS` | No | `300000` | Maximum milliseconds to wait for the hub to become reachable at startup before the process exits non-zero (5 minutes). The supervisor then restarts the container. |
| `MERKLE_EPOCH_SIZE` | No | `100` | Number of blocks per Merkle epoch in the transparency log. Changing this after a log already exists will make existing epoch roots inconsistent; only set at initial deploy. |
| `TRANSPARENCY_RATE_LIMIT` | No | `10` | Maximum transparency-proof endpoint requests per minute per IP. |
| `SYNC_META_RETENTION_BLOCKS` | No | `0` (off) | Transparency-log retention window in blocks. `0` or unset keeps the full log, so every historical inclusion proof stays serveable. A positive value prunes `sync_meta` rows older than the window at epoch boundaries, which bounds table growth and gives up proofs below the window. Committed Merkle roots (`merkle_epochs`) are kept either way. See [Indexer: Data Retention and Pruning](../indexer/data-retention.md). |

### Server Mode

By default, **no database environment variables are needed**. The service discovers all indexer and decoder database connections by calling the hub's `getallconfigs` method. The hub returns the `db_host`, `db_port`, `name` (database name), `user`, and `pass` for every installed indexer and decoder.

Setting `REPLICA_DB_HOST` overrides that default: the server instead connects to a local replica database, using `REPLICA_DB_HOST`/`REPLICA_DB_PORT`/`REPLICA_DB_USER`/`REPLICA_DB_PASS` in place of the hub-provided `db_host`/`db_port`/`user`/`pass` (the database name still comes from the hub, so the replica must use the same name). The hub is still queried, only to enumerate which chains/networks exist. This is how a re-serving tier, a box that already pulled the databases as a client, serves those local replicas onward to downstream clients instead of the authoritative DB coordinates. See [Operations: read-only-replica deployment](operations.md#read-only-replica-deployment) for the full pattern, including pairing this with `REPLICA_DB_READONLY` when the local replica is fed by something other than this process (for example MariaDB binlog replication).

| Variable | Required | Default | Description |
|---|---|---|---|
| `BLOCK_POLL_INTERVAL` | No | `3000` | Milliseconds between polls to each indexer database for new blocks |
| `DB_POOL_SIZE_INDEXER` | No | `12` | Maximum simultaneous connections per chain/network indexer pool. Sized for the poller's ~113-query-per-block fan-out plus concurrent snapshot streams. |
| `DB_POOL_SIZE_DECODER` | No | `6` | Maximum simultaneous connections per chain/network decoder pool (8 narrow tables, no action fan-out). |
| `DB_POOL_SIZE` | No | (per dbType) | Legacy flat override applied to every dbType when no `DB_POOL_SIZE_<DBTYPE>` is set. A server with 3 chains x 2 dbTypes opens 6 pools, so the per-dbType defaults cost 54 connections. |
| `DB_QUERY_TIMEOUT` | No | `30000` | Per-query timeout in milliseconds applied to every pool query. Raise only if legitimate long-running queries (e.g. full catalog scans) begin timing out. Also per dbType via `DB_QUERY_TIMEOUT_INDEXER` / `DB_QUERY_TIMEOUT_DECODER`. |
| `WS_MAX_PER_IP` | No | `100` | Maximum simultaneous WebSocket connections per IP address. The high default accommodates multi-chain validators that open one connection per chain/network/dbType from the same IP. |
| `SNAPSHOT_RATE_FULL` | No | `12` | Maximum full snapshot downloads per hour per IP per chain/network/dbType |
| `SNAPSHOT_RATE_INCR` | No | `600` | Maximum incremental snapshot downloads per hour per IP per chain/network/dbType |
| `WS_STATUS_INTERVAL` | No | `60000` | Milliseconds between periodic status broadcasts to WebSocket subscribers (60 seconds) |
| `WS_PING_INTERVAL` | No | `30000` | Milliseconds between WebSocket ping frames (30 seconds) |
| `WS_BACKPRESSURE_MAX_BYTES` | No | `16777216` | Buffered-send ceiling (bytes, default 16 MiB) for a slow WebSocket subscriber. A subscriber is dropped only when its buffer exceeds this AND is not draining (see below). Replaces the retired count-based `WS_BACKPRESSURE_LIMIT`, which dropped slow-but-draining replicas; the old variable is now ignored (a startup log notes this). |
| `WS_BACKPRESSURE_STALL_MS` | No | `30000` | How long (ms) an over-limit subscriber's send buffer may fail to drain before it is force-disconnected. The stall timer resets on any drop in buffered bytes. |
| `VALIDATOR_HEARTBEAT_TTL` | No | `60000` | Milliseconds before an unresponsive validator is marked `stale` in `/validator-status` (rather than deleted) |
| `EXPECTED_VALIDATORS` | No | `""` | Comma-separated list of expected validator IDs/pubkeys. When set, `/validator-status` reports an `expected_total` denominator and flags roster members that have never sent a heartbeat as `absent`. Unset means no roster check. |
| `REPLICA_DB_HOST` | No | None | Serves from a local replica database instead of the hub-provided authoritative database. When set, the server connects to this host using `REPLICA_DB_PORT`/`REPLICA_DB_USER`/`REPLICA_DB_PASS` instead of the hub's `db_host`/`db_port`/`user`/`pass` (the database name still comes from the hub). Unset (the default): the server connects to the hub-provided authoritative database, as described above. |
| `REPLICA_DB_PORT` | No | `3306` | MariaDB port for the local replica database. Only read when `REPLICA_DB_HOST` is set. |
| `REPLICA_DB_USER` | No | None | MariaDB username for the local replica database. Only read when `REPLICA_DB_HOST` is set; leaving it unset while `REPLICA_DB_HOST` is set fails the database connection. |
| `REPLICA_DB_PASS` | No | None | MariaDB password for the local replica database. Only read when `REPLICA_DB_HOST` is set; leaving it unset while `REPLICA_DB_HOST` is set fails the database connection. |
| `SYNC_REPLICA_MAX_LAG_S` | No | `120` | Replication freshness ceiling, in seconds, when the server's own database is a native SQL replica. Above this many seconds behind its source, `/status` reports `replica_stale: true` instead of certifying the served heights as current. Reading it needs the `SLAVE MONITOR` grant on MariaDB, or `REPLICATION CLIENT` on MySQL, for the server's database user; without that grant, or with the replication threads stopped, the status reads unknown and is reported stale rather than fresh. A database that is not a replica at all is unaffected. |
| `REPLICA_DB_READONLY` | No | `false` | Makes the transparency log serve-only, for a server process whose database is itself a replica (for example, kept current by MariaDB binlog replication) that this process must never write to. When `true` (also accepts `1`), the four `TransparencyLog` write entry points (`recordBlock`, `commitEpoch`, `pruneFrom`, `recommitEpoch`) and the startup gap-repair scan (`ServerPoller.backfillGaps`) all become no-ops. Every read path, proofs, epoch roots, the paginated log, and the `/transparency/*` endpoints, is unaffected. See [Operations: read-only-replica deployment](operations.md#read-only-replica-deployment) for the full pattern. |
| `SYNC_REPLICA_CONNECTION` | No | _(unset)_ | Name of the replication connection carrying the served schemas, on a multi-source replica. Unset reduces across every connection, worst-case: the server reads as stale if any connection is stopped, and reports the laggiest one. Naming a connection measures that stream alone, so an unrelated lagging connection cannot drag the reading; if the named connection is not present on the server, the status reads unknown and is reported stale rather than fresh. |

### Client Mode

In client mode, the service connects to remote sync servers and replicates their data into local MariaDB databases.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SYNC_SOURCES` | Yes | None | Comma-separated list of remote sync server URLs (e.g., `http://sync1.example.com:3006,http://sync2.example.com:3006`). Minimum 1 required; 2+ recommended for cross-verification. |
| `SYNC_EXCLUDE` | No | `""` | Comma-separated list of `coin:network:dbType` keys (e.g., `DOGE:testnet:indexer`) to skip during chain discovery. A listed chain starts no `ClientSync` and cannot crash-loop the process. Use this to temporarily exclude a fast chain (e.g. DOGE testnet with tens of millions of blocks) that cannot complete a full-snapshot bootstrap. |
| `SYNC_BOOTSTRAP_DEPTH_<CHAIN>_<NETWORK>` | No | unset | Per-chain opt-in for start-from-recent-height bootstrap. Set to a block count N (e.g., `SYNC_BOOTSTRAP_DEPTH_DOGE_TESTNET=50000`, or equivalently `SYNC_BOOTSTRAP_DEPTH_DOGECOIN_TESTNET=50000`) to seed an empty replica from `(sourceTip - N)` via one incremental snapshot instead of a full-history one. `<CHAIN>` accepts the ticker or the full coin name; both fold onto the ticker. A key that matches no chain the hub published is **refused at startup** (the process exits) rather than ignored, because an ignored key would fall back to depth 0, which is the full-history branch. **A truncated replica cannot answer pre-base history and its balances cover only the recent window; acceptable only for non-consensus explorer mirrors, never for a trusted validator.** |
| `VERIFY_HASHES` | No | `true` | When `true`, cross-verifies block hashes from multiple sources before applying. Requires 2+ sources. |
| `HALT_ON_DIVERGENCE` | No | `true` | **Security-critical. Default ON. Set to `false` only for read-only convenience mirrors whose state nothing downstream trusts.** When `true`, a confirmed cross-source hash divergence (two honest sources committed different ledger/actions/contract hashes for the same block) causes a durable halt instead of logging and silently stalling. |
| `VERIFY_RECOMPUTE` | No | `true` | **Security-critical. Default ON. Disabling is DECLARED UNSAFE for consensus-relevant replicas.** When `true`, each block's consensus hashes (ledger/actions/contract) are independently recomputed from the replicated rows and checked against the committed hash. This is the only mechanism that verifies the catch-up join block: with it disabled, a reorg that occurs while the client is disconnected is silently stitched onto the orphaned pre-reorg tip, permanently forking the replica. |
| `VERIFY_STATE_HASH` | No | `true` | **Security-critical. Default ON.** When `true`, the per-block state hash (covering in-place mutations and backdated refund credits not captured by the three consensus hashes) is recomputed on apply and checked. A mismatch triggers a durable halt. A NULL state hash (block from a source without the feature) is skipped, so enabling this can never false-halt against a back-level source. |
| `VERIFY_STATE_COMMITMENT` | No | `true` | **Security-critical. Default ON.** When `true`, the per-block SPV state-commitment roots (balances, block Merkle root) are recomputed over the replica and compared to the source's committed values. A mismatch triggers a durable halt. NULL roots (blocks before the flag-day) are skipped. **Set to `false` on truncated replicas** seeded via `SYNC_BOOTSTRAP_DEPTH_*`, because their incomplete balances history would produce wrong roots. |
| `INDEX_MAP_PARITY_CHECK` | No | `false` | **Advisory only; never halts.** When `true`, periodically checks that the replica's `index_addresses` id-to-address mapping matches the source's deterministic-subset checksum. A mismatch is logged and counted but never halted on. Off by default because computing it scans `index_addresses` (an index on `block_index` is advisable before enabling on a high-volume chain). |
| `TABLE_CONTENT_PARITY_CHECK` | No | `false` | **Advisory only; never halts.** When `true`, compares per-table content checksums between source and replica, not just the row counts published beside them: an equal-count content substitution in a table that no consensus hash reads passes every other check. Read on both sides (the server publishes the checksums on `/status`, a client at the same height recomputes and compares). A mismatch is logged and durably counted. Off by default because it reads a window of about 93 indexer tables per status poll. |
| `TABLE_CONTENT_PARITY_WINDOW` | No | `100` | How many blocks each content checksum spans, and for append-only lookups that carry no block column, how many ids. Server-side setting: the source publishes the window it used and a follower recomputes over that same span, so the two can never compare different spans and only the source needs tuning. Clamped to `[1, 10000]`, since `0` or a negative would silently disable the check while still reporting passes, and an unbounded value would read a table's whole history every poll. |
| `COMPLETENESS_CHECK_INTERVAL` | No | `3600000` | **Advisory only; never halts.** How often, in milliseconds, a live client re-runs the replica-completeness sweep against its primary source: the per-table row counts the source publishes on `/status`, compared against its own, which is the only check that sees a follower missing rows the consensus hashes cannot cover. `0` disables it. Runs only when the replica and the source are at the same height, because a shortfall while behind is ordinary lag. Deliberately slow by default: the sweep makes the source run a `COUNT(*)` per replicated table. |
| `VERIFY_CHECKPOINT_QUORUM` | No | `false` | **Default OFF.** When `true`, anchors the replica's independently recomputed `state_root` to the federation quorum: the client fetches the source's signed checkpoint, verifies its Ed25519 signatures against the pinned validator set in `pinnedValidators.js`, and halts if the quorum fails or the checkpoint's `state_root` disagrees with the replica's own computed root. Inert without a pinned set configured for the chain/network. |
| `CHECKPOINT_VERIFY_INTERVAL` | No | `50` | How often to probe the `/latest` checkpoint, measured in applied blocks. Only used when `VERIFY_CHECKPOINT_QUORUM=true`. |
| `REPLICA_DB_HOST` | Yes | None | MariaDB hostname for local replica databases. This variable, and the three below, are also honored in server mode as an opt-in override; see [Server Mode](#server-mode) above. |
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
| `CLIENT_SOURCE_STALE_MS` | No | `180000` | How long (ms) without any WebSocket event from the source (block pushes or the periodic status heartbeat) before the replica's `/status` reports `source_height_stale: true`. |
| `DISPENSERS_RECONCILE_EVERY` | No | `20` | Reconcile the decoder-replica `dispensers` table (which converges by snapshot, not the block stream) every Nth catch-up in steady state. |
| `DISPENSERS_RECONCILE_MAX_INTERVAL_MS` | No | `1800000` | Upper bound (ms, default 30 minutes) on time between `dispensers` reconciles regardless of catch-up cadence. |
| `CHECKPOINT_ANCHOR_URL` | No | None | Dedicated source URL for checkpoint fetches when `VERIFY_CHECKPOINT_QUORUM=true`; falls back to the first `SYNC_SOURCES` entry. The client rejects checkpoint sequence rollback and withholding from this source (advisory, does not halt). |
| `CHECKPOINT_SEED_<CHAIN>_<NETWORK>` | No | None | JSON override for the pinned checkpoint-quorum validator seed set (fail-closed: malformed JSON is an error, not a fallback). Used with `VERIFY_CHECKPOINT_QUORUM` to bootstrap trust on chains without a compiled-in pinned set. |
| `CHECKPOINT_FRESHNESS_BLOCKS` | No | `500` | Freshness bound, in applied blocks, for the checkpoint anchor. When the newest quorum checkpoint trails the replica tip by more than this, the anchor can no longer catch a forged tail, so the gap is logged. Advisory by default: withholding is not proof of forgery, and halting on absence would hand an attacker a DoS-halt. |
| `CHECKPOINT_FRESHNESS_STRICT` | No | `false` | Promote `CHECKPOINT_FRESHNESS_BLOCKS` from advisory to enforced. When `true`, a replica trailing the newest quorum-signed checkpoint by more than the bound refuses to serve the unanchored tail and halts durably with reason `checkpoint-freshness-stale`. Off by default because an always-on version lets a source that withholds fresh checkpoints halt the replica at will. Only enforced once the anchor has verified at least one checkpoint, so a replica that has never seen one is not halted at startup. |
| `SOURCE_QUORUM` | No | `0` (auto) | Number of agreeing sources required to accept a block in multi-source client mode. `0` derives the majority automatically, which tolerates `f` Byzantine sources at `N = 3f+1` (N=4 gives quorum 3). An explicit value is clamped to `[1, N]`. Setting it below the majority lets colluding sources out-vote the honest set; that is a deliberate operator choice, not a default. |
| `SOURCE_EVICT_THRESHOLD` | No | `3` | Strikes within `SOURCE_STRIKE_WINDOW` before a disagreeing source is evicted: its WebSocket is closed and not reconnected, it leaves the quorum denominator, and an alert fires on `/status`. Eviction preserves liveness against a Byzantine minority instead of halting on every contested block. Never evicts below two active sources, since one source is a blind posture. |
| `SOURCE_STRIKE_WINDOW` | No | `200` | Sliding window, in applied blocks, over which source strikes are counted toward `SOURCE_EVICT_THRESHOLD`. Older strikes are pruned, so a source that misbehaved long ago but has since been consistent is not evicted on stale strikes. |
| `VALIDATOR_ID` | No | system hostname | Stable identifier for this validator, sent with `POST /validator-heartbeat`. Set it explicitly; the hostname fallback changes if the host is renamed or recreated. |
| `SYNC_RATE_LIMIT_RPM` | No | `500` | API requests per minute per IP |
| `HUB_API_KEY` | No | None | API key sent to the hub as `x-api-key` during chain discovery (`getallconfigs`). Required whenever the hub runs keyed, which is always in validator mode. Treat as a credential. |
| `MAX_CONCURRENT_SNAPSHOTS` | No | pool size minus 2 | Maximum snapshot streams served concurrently per database, so a snapshot stampede cannot starve the block poller of its last connection. Clamped to `[1, poolSize - 1]`. On saturation the server answers `503` with `Retry-After` rather than queueing. |
| `STATE_TREE_METRIC_INTERVAL_MS` | No | `14400000` (4 h) | Interval for the state-tree orphan-statistics sweep. Set to `0` to disable. Decoder replicas are skipped (they have no `state_tree_*` tables). |
| `STATE_TREE_METRIC_MAX_NODES` | No | `2000000` | Node ceiling for a single state-tree metric pass, bounding the cost of the sweep on a large tree. |
| `SYNC_QUERY_METRIC_INTERVAL_MS` | No | `900000` (15 m) | Interval between `[METRIC] sync_action_scoped_queries_per_block` lines, which record how many action-scoped queries a block payload cost and how many of them returned rows. The per-table read loop grows with every replicated table added, so this is how the trend against poll cadence stays observable. Set to `0` to disable. Indexer pollers only (a decoder has no action-scoped tables). |

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

A separate MariaDB connection pool is created per chain/network/dbType.

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
- **Action-specific**: `sends`, `issues`, `destroys`, `airdrops`, `dividends`, `orders`, `dispensers`, `swaps`, `broadcasts`, `messages`, `files`, `links`, `lists`, `callbacks`, `sleeps`, `sweeps`, `mints`, `batches`, `bet_feeds`, `bets`
- **Lifecycle**: `order_matches`, `order_expires`, `order_edits`, `order_cancels`, `order_statuses`, `swap_matches`, `swap_expires`, `swap_edits`, `swap_cancels`, `swap_statuses`, `dispenser_closes`, `dispenser_expires`, `dispenser_edits`, `dispenser_cancels`, `dispenser_statuses`, `dispenses`, `bet_feed_statuses`, `bet_statuses`, `bet_cancels`, `bet_resolves`
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

Each chain/network/dbType gets its own MariaDB connection pool (from `db.js`, sized by `poolSizing.js`). Pool sizes are **per dbType**, because the two dbTypes carry very different loads: the indexer pool absorbs the poller's ~113-query-per-block fan-out plus any in-flight snapshot streams, while the decoder pool replicates 8 narrow tables.

| Parameter | indexer | decoder | Description |
|---|---|---|---|
| `connectionLimit` | `12` | `6` | Maximum simultaneous connections (override via `DB_POOL_SIZE_INDEXER` / `DB_POOL_SIZE_DECODER`, or `DB_POOL_SIZE` for both) |
| `connectTimeout` | `10000` | `10000` | Connection timeout (ms), override via `DB_CONNECT_TIMEOUT[_INDEXER|_DECODER]` |
| `acquireTimeout` | `10000` | `10000` | Pool acquisition timeout (ms), override via `DB_ACQUIRE_TIMEOUT[_INDEXER|_DECODER]` |
| `queryTimeout` | `30000` | `30000` | Per-query timeout (ms), override via `DB_QUERY_TIMEOUT[_INDEXER|_DECODER]` |
| `idleTimeout` | `60000` | `60000` | Idle connection timeout (ms) |
| `insertIdAsNumber` | `true` | `true` | Return insert IDs as numbers (not BigInt) |
| `bigIntAsNumber` | `true` | `true` | Return BIGINT columns as JS numbers instead of BigInt |
| `dateStrings` | `true` | `true` | Return DATETIME columns as MariaDB-format strings rather than JS Dates, avoiding ISO re-insert failures in strict mode |
| `minDelayValidation` | `3000` | `3000` | Minimum delay between connection validation checks (ms) |

Resolution order for every knob above: `<NAME>_<DBTYPE>`, then the flat `<NAME>`, then the per-dbType default. Values are clamped to `[2, 100]` so no single setting can starve the poller or exhaust MariaDB's `max_connections`.

Sizing budget: a source serving 3 chains x 2 dbTypes opens 6 pools, so the defaults cost 3 x (12 + 6) = 54 connections.

Measured on a regtest indexer schema with `test/perf/pool-fanout-load.js` (113 queries/block, 5 ms per query, median of 8 blocks): pool 3 = 213 ms/block, pool 5 = 129 ms, pool 12 = 55 ms, pool 20 = 34 ms. Run that script inside a container that already holds the DB credentials to re-measure on your own hardware before raising a pool.

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
