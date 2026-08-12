<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform UTXO Tracker: Configuration Reference

## Environment Variables

Configuration is loaded from a `.env` file via `dotenv`. All variables are read in `src/api.js` at startup.

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `NETWORK` | Blockchain network identifier | `bitcoin-mainnet`, `dogecoin-testnet`, `litecoin-regtest` |
| `NODE_URL` | Coin node JSON-RPC hostname | `127.0.0.1` |
| `NODE_PORT` | Coin node JSON-RPC port | `8332` |
| `NODE_USER` | Coin node RPC username | `rpc` |
| `NODE_PASSWORD` | Coin node RPC password | `rpc` |
| `UTXO_TRACKER_API_PORT` | API server listening port | `3001` |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `AUX_POW` | Enable AuxPoW block header stripping (required for Dogecoin and Litecoin HogEx blocks) | `undefined` (falsy) |
| `UTXO_TRACKER_API_KEY` | Bearer token required on all admin JSON-RPC methods (`getbootstrap`, `getbootstrapstatus`, `restorebootstrap`, `getbootstraprestorestatus`, `get_input_from_key_pattern`). When unset these methods fail closed (HTTP 401). Read-only UTXO/balance queries are unaffected. | `""` (disabled) |
| `UTXO_MAX_PAGE_LIMIT` | Maximum page size a caller may request via `?limit=`. Caps a single request so a caller cannot trigger an OOM by requesting one giant page. Independent of `UTXO_MAX_ADDRESS_OUTPUTS`. | `10000` |
| `UTXO_MAX_ADDRESS_OUTPUTS` | Hard ceiling on outputs materialized for a single-address unbounded query; above this limit `/utxos` and `get_balance` return HTTP 413: callers must page via `?limit=&after=` | `500000` |
| `CORS_ORIGIN` | Allowed CORS origin. Set to a specific origin string to enable cross-origin requests. Disabled (no CORS header) when unset. | `""` (disabled) |
| `XCHAIN_UNDO_BLOCKS_BTC` | Override the BTC reorg recovery window (blocks) | `12` |
| `XCHAIN_UNDO_BLOCKS_LTC` | Override the LTC reorg recovery window (blocks) | `48` |
| `XCHAIN_UNDO_BLOCKS_DOGE` | Override the DOGE reorg recovery window (blocks) | `120` |
| `UTXO_TRACKER_RATE_LIMIT_RPM` | API requests per minute per IP | `500` |
| `UTXO_TRACKER_NODE_RPC_STALE_MS` | Staleness window for the tracker`s last usable node-tip read, after which `health` reports the node RPC stale. Five times the loop`s `BLOCKCHAIN_INFO_REFRESH_MS` (30s), so a slow or skipped poll never trips it and only a sustained outage does. | `150000` |
| `UTXO_MAX_RPC_BATCH` | Maximum calls accepted in one inbound JSON-RPC batch (array body). The router runs `Promise.all` over every element, so without this cap a single unauthenticated ~100kb POST fans out into thousands of concurrent read scans and node RPCs. Mirrors the decoder and encoder batch guards. | `20` |
| `XCHAIN_COINBASE_MATURITY` | Confirmations a coinbase output needs before `getUtxosAddress` will serve it as spendable. The consensus rule is 100 on BTC/LTC/DOGE and their testnet/regtest variants; serving an immature coinbase hands the caller an input every node rejects. Lower it only for test harnesses that mine short chains. | `100` |
| `XCHAIN_MAX_BLOCK_FETCH_RETRIES` | Attempts to fetch a block at one height before giving up. Raise it for slow-recovering nodes. Retries sleep 3000 ms apart. | `20` |
| `BOOTSTRAP_RESTORE_ALLOW_UNVERIFIED` | Set to `1` to let `restorebootstrap` proceed when the archive has no `.sha256` sidecar. **Off by default and deliberately so:** the restore performs a destructive `/data` wipe, and without the sidecar the archive cannot be checked for truncation or tampering first. The correct fix is to publish a `.sha256` next to the archive; this flag exists as a last resort and logs a warning when used. | _(unset, fails closed)_ |
| `BOOTSTRAP_RESTORE_ALLOW_UNSIGNED` | Set to `1` to let `restorebootstrap` proceed when the archive has no `.sig` signature file, or when no bootstrap signing public key is pinned. **Off by default and deliberately so:** the restore performs a destructive `/data` wipe, and an archive`s own checksums prove only that it is internally consistent, never who published it. Publish a `.sig` next to the archive instead; this flag is the last resort. | _(unset, fails closed)_ |
| `UTXO_TRACKER_BOOTSTRAP_PUBKEY` | Path to the bootstrap signing public key used to verify an archive`s signature, overriding the key pinned at `src/config/bootstrap_signing_pubkey.pem`. Swapping it moves the trust root off the pinned key, so treat it as a trust decision, not a path setting. | _(the pinned `src/config/bootstrap_signing_pubkey.pem`)_ |
| `LEVELDB_CACHE_BYTES` | LevelDB block-cache size in bytes | `4294967296` (4 GiB) |
| `LEVELDB_WRITE_BUFFER_BYTES` | LevelDB write-buffer size in bytes | `67108864` (64 MiB) |
| `NODE_RPC_TIMEOUT` | HTTP timeout in milliseconds for JSON-RPC calls to the coin node | `30000` |
| `DEBUG_TRACE` | Set to `1`/`true` for verbose tracker tracing on stdout. Debug only. | _(unset)_ |
| `TRACE_UTXO` | Set to `1`/`true` for per-output LevelDB tracing (one line per `insertOutput`, per staged deletion, and a summary per transaction). Debug only; kept behind a flag so production cost is zero. | _(unset)_ |
| `UTXO_TRACKER_MAX_CONCURRENT_PROBES` | Concurrency cap for cheap probe requests, gated separately so a monitoring flood cannot consume the budget real queries need. Past the cap a probe is refused immediately with `429` and `Retry-After: 1` rather than queued. `0` disables the cap. | `16` |
| `UTXO_TRACKER_MAX_CONCURRENT_REQUESTS` | Concurrency cap for everything that is not a probe, with the same immediate-`429` behaviour. `0` disables the cap. | `100` |

### Bulk-Sync Variables

On first startup with an empty database the tracker automatically runs a parallel bulk-sync pipeline before starting the normal incremental API. The following variables tune that pipeline. They have no effect when the database is already populated.

| Variable | Description | Default |
|---|---|---|
| `BULK_SYNC_WORKERS` | Number of parallel worker processes for the bulk parse phase | `6` |
| `BULK_SYNC_CHUNK_SIZE` | Number of blocks per worker chunk | `10000` |
| `BULK_SYNC_RAM_BUDGET` | Memory budget in MB for the merge/load phase | `4096` |
| `BULK_SYNC_TIP_SAFETY` | Number of blocks before the node tip to stop the bulk dump (avoids indexing an unstable tip) | `10` |
| `BULK_SYNC_BATCH_SIZE` | Number of UTXO records per LevelDB write batch during load | `10000` |
| `BULK_SYNC_WORK_DIR` | Working directory for bulk-sync intermediate files | `/data/xchain-utxo-tracker/_bulk-sync-work` |

### Supported Network Values

| Network | Value |
|---|---|
| Bitcoin mainnet | `bitcoin-mainnet` |
| Bitcoin testnet | `bitcoin-testnet` |
| Bitcoin regtest | `bitcoin-regtest` |
| Dogecoin mainnet | `dogecoin-mainnet` |
| Dogecoin testnet | `dogecoin-testnet` |
| Dogecoin regtest | `dogecoin-regtest` |
| Litecoin mainnet | `litecoin-mainnet` |
| Litecoin testnet | `litecoin-testnet` |
| Litecoin regtest | `litecoin-regtest` |

## Internal Constants

These values are defined in `src/XChainUtxoTracker.js` and are not configurable via environment variables.

### Polling and Sync

| Constant | Value | Description |
|---|---|---|
| `CHECK_BLOCK_DELAY_MS` | `1000` | Milliseconds between block polling cycles |
| `MIN_VERIFICATION_PROGRESS_TO_PARSE` | `0.99` | Minimum node sync progress before tracker starts indexing |
| `SYNCED_THRESHOLD` | `3` | Number of blocks behind tip to consider "synced" |
| `MEMPOOL_INTERVAL` | `60000` | Milliseconds between mempool updates (60 seconds) |
| `MEMPOOL_BATCH_SIZE` | `1000` | Maximum transactions fetched per mempool batch |

### Block Processing

| Constant | Value | Description |
|---|---|---|
| `DB_TRANSACTION_BLOCKS_QUANTITY` | `200` | Number of blocks per LevelDB batch commit |
| `PREFETCH_SIZE` | `10` | Number of blocks pre-fetched concurrently |
| `ETA_WINDOW_BLOCKS` | `1000` | Rolling window size for sync ETA calculation |
| `DEFAULT_UNDO_BLOCKS` | BTC: `12` / LTC: `48` / DOGE: `120` | Per-chain K/M archive retention window; override per coin via `XCHAIN_UNDO_BLOCKS_BTC`, `XCHAIN_UNDO_BLOCKS_LTC`, `XCHAIN_UNDO_BLOCKS_DOGE` |

### Storage

| Constant | Value | Description |
|---|---|---|
| `REMOVE_SPENT` | `true` | When enabled, spent outputs are removed from O/H and archived in K/M |
| `SATOSHI_BIGINT` | `100000000n` | Satoshi-to-coin conversion factor (BigInt) |
| `SATOSHI_UNIT` | `100000000.0` | Satoshi-to-coin conversion factor (float, used only for display) |

### Database Paths

| Path | Description |
|---|---|
| `/data/xchain-utxo-tracker` | Main LevelDB database (persistent, disk-backed via `classic-level`) |
| In-memory only | Mempool database (volatile, `memory-level`-backed, recreated on startup) |
| `/bootstrap/xchain-utxo-tracker/` | Bootstrap backup archive storage |

### RPC Connection

| Constant | Value | Description |
|---|---|---|
| HTTP Keep-Alive | Enabled | Persistent connections to coin node |
| Max sockets | `25` | Maximum concurrent HTTP connections to coin node |
| Timeout | `30000` | Axios request timeout in milliseconds |
| `getRawTransaction` retries | `10` | Retry count with 500ms backoff |
| `getBlockHeader` retries | `10` | Retry count on ECONNABORTED only (no sleep between attempts) |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
