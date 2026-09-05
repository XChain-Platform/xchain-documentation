<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform UTXO Tracker: Configuration Reference

## Environment Variables

Configuration is loaded from a `.env` file via `dotenv`. All variables are read in `src/api.js` at startup.

**Running under `xchain-node`, set these in `config/<coin>-<network>`, not in your shell.** The tracker runs in a container, so an exported variable in the shell that starts the CLI never reaches it. The config file is read as plain `KEY=VALUE` lines and every key is passed through to the container environment, including the ones documented here and any the tracker adds later, so no allowlist has to be updated first. Credentials belong in the `config/<coin>-<network>.local` sidecar instead, which takes precedence. For example, to give a tracker on a shared 8 GB board a smaller cache and sort budget than it would derive on its own:

```
LEVELDB_CACHE_BYTES=268435456
BULK_SYNC_RAM_BUDGET=768
```

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
| `CORS_ORIGIN` | Allowed CORS origins: either one origin, or a comma-separated allowlist matched per origin, for example `capacitor://localhost,https://localhost,https://explorer.xchain.io`. Browser shells need the list form because each surface sends a different origin. Entries are trimmed and blank ones dropped, so an empty or all-blank value disables CORS (no CORS header) exactly as leaving it unset does. `*` means "any origin" only when it is the entire value; inside a list it stays a literal entry no browser sends, so `*,https://x` grants `https://x` and nothing more. | `""` (disabled) |
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
| `LEVELDB_CACHE_BYTES` | LevelDB block-cache size in bytes. This is native memory, outside the V8 heap, and during a chain backfill it is the largest single contributor to the tracker's resident size. Set it only to override the derived default below. | a quarter of the memory budget, between 128 MiB and 4 GiB |
| `LEVELDB_WRITE_BUFFER_BYTES` | LevelDB write-buffer size in bytes | `67108864` (64 MiB) |
| `HEAP_FLUSH_THRESHOLD_MB` | Heap size, in MB, at which a partially-staged block batch is flushed early instead of accumulating to the full 200-block batch. Guards against a dense run of blocks pushing the V8 heap past its ceiling mid-parse. | an eighth of the memory budget, between 256 MB and 2048 MB |
| `NODE_RPC_TIMEOUT` | HTTP timeout in milliseconds for JSON-RPC calls to the coin node | `30000` |
| `DEBUG_TRACE` | Set to `1`/`true` for verbose tracker tracing on stdout. Debug only. | _(unset)_ |
| `TRACE_UTXO` | Set to `1`/`true` for per-output LevelDB tracing (one line per `insertOutput`, per staged deletion, and a summary per transaction). Debug only; kept behind a flag so production cost is zero. | _(unset)_ |
| `UTXO_TRACKER_MAX_CONCURRENT_PROBES` | Concurrency cap for cheap probe requests, gated separately so a monitoring flood cannot consume the budget real queries need. Past the cap a probe is refused immediately with `429` and `Retry-After: 1` rather than queued. `0` disables the cap. | `16` |
| `UTXO_TRACKER_MAX_CONCURRENT_REQUESTS` | Concurrency cap for everything that is not a probe, with the same immediate-`429` behaviour. `0` disables the cap. | `100` |

### Memory Budget

The two largest allocations the tracker makes, the LevelDB block cache and the staged write batch, are sized from a **memory budget** rather than fixed. The budget is the memory this process may actually use: normally the host's RAM, but the cgroup limit instead whenever one binds below it. That distinction matters because inside a container the host total is what a process sees by default, so a tracker under `--memory 2g` on a large machine would otherwise size itself for the machine and be killed by the kernel, repeatedly, without ever completing a batch.

At startup the tracker logs the budget it resolved, which value bound it, and the sizes it derived:

```
memory budget 8192MB (host memory); LevelDB block cache 2048MB, heap-flush threshold 1024MB, bulk-sync RAM budget 4096MB
```

Read that line first when a tracker is killed for memory: on a capped container the numbers cannot be inferred from the host.

| Budget | Block cache | Heap-flush threshold | Bulk-sync RAM budget |
|---|---|---|---|
| 16 GB and above | 4 GiB | 2048 MB | 4096 MB |
| 8 GB | 2 GiB | 1024 MB | 4096 MB |
| 4 GB | 1 GiB | 512 MB | 2048 MB |
| 2 GB (for example a `--memory 2g` container) | 512 MB | 256 MB | 1024 MB |

Hosts at or above 16 GB derive exactly the values the tracker used before the budget existed, so an already-tuned server keeps its behaviour; only smaller hosts scale down. Setting `LEVELDB_CACHE_BYTES`, `HEAP_FLUSH_THRESHOLD_MB` or `BULK_SYNC_RAM_BUDGET` overrides the derivation outright, which is the right move when you have measured your own workload. Note that a container memory limit alone is not a substitute: capping a tracker whose cache is still sized for the host trades a slow backfill for a restart loop.

The bulk-sync figure is the budget handed to the **orchestrator subprocess** that runs on an empty database, not to the tracker itself. It is derived here because a subprocess sized independently of the cgroup is killed just as dead: a tracker capped at 2 GB was handing its own child a 4 GB sort budget, and the kernel killed it at the merge every time. Both the parent and the child have to fit inside one limit, so the child gets half the budget and the parent keeps its cache and staged batch inside the rest.

### Bulk-Sync Variables

On first startup with an empty database the tracker automatically runs a parallel bulk-sync pipeline before starting the normal incremental API. The following variables tune that pipeline. They have no effect when the database is already populated.

| Variable | Description | Default |
|---|---|---|
| `BULK_SYNC_WORKERS` | Number of parallel worker processes for the bulk parse phase | `6` |
| `BULK_SYNC_CHUNK_SIZE` | Number of blocks per worker chunk | `10000` |
| `BULK_SYNC_RAM_BUDGET` | Memory budget in MB for the merge/load phase, handed to the orchestrator subprocess. Set it only to override the derived default; see [Memory Budget](#memory-budget) for why a flat value is unsafe on a capped container. | half the memory budget, between 512 MB and 4096 MB |
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
| `DEFAULT_UNDO_BLOCKS` | BTC: `12` / LTC: `120` / DOGE: `120` | Per-chain K/M archive retention window; override per coin via `XCHAIN_UNDO_BLOCKS_BTC`, `XCHAIN_UNDO_BLOCKS_LTC`, `XCHAIN_UNDO_BLOCKS_DOGE` |

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
