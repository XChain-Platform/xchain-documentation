<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Decoder: Operations

## Prerequisites

- Node.js >= 22
- MariaDB server
- A running coin node (bitcoind, litecoind, or dogecoind) with JSON-RPC enabled

## Running the Decoder

```bash
npm run api
# or directly:
node ./src/api.js
```

On startup, the decoder:
1. Loads environment variables from `.env`
2. Starts the Express JSON-RPC API server on `DECODER_API_PORT`
3. Validates the database name (alphanumeric + underscores only)
4. Creates the database if it doesn't exist
5. Creates all 9 tables if they don't exist
6. Waits for the coin node to reach 99% verification progress
7. Begins parsing from the configured start block (or last parsed block + 1)

## Docker

The decoder includes a `docker-compose.yml` for containerized deployment:

```bash
docker-compose up --build
```

The Dockerfile copies the source into the container and runs `npm run api`. Environment variables can be passed via `docker-compose.yml` or a mounted `.env` file.

## Stopping

The decoder handles graceful shutdown via SIGTERM and SIGINT signals:

1. Sets the `stopFlag` to true
2. The main polling loop exits after the current iteration completes
3. Mempool updates are cancelled
4. All database connections are released

In Docker, `docker stop` sends SIGTERM, triggering the graceful shutdown path.

## API

The decoder exposes a minimal JSON-RPC API for health monitoring:

### `ping`

Basic health check.

**Request:**
```json
{
    "jsonrpc": "2.0",
    "method": "ping",
    "id": 1
}
```

**Response:**
```json
{
    "jsonrpc": "2.0",
    "result": { "status": "success" },
    "id": 1
}
```

### `health`

Detailed health status including decoder state.

**Request:**
```json
{
    "jsonrpc": "2.0",
    "method": "health",
    "id": 1
}
```

**Response:**
```json
{
    "jsonrpc": "2.0",
    "result": {
        "status": "healthy",
        "phase": "running",
        "synced": true,
        "last_processed_block": 900123,
        "node_height": 900124,
        "lag": 1,
        "lastProcessedBlock": 900123,
        "chainTipBlock": 900124,
        "blockLag": 1,
        "lag_blocks": 1,
        "rpc_errors": 0,
        "parse_errors": 0,
        "error": null
    },
    "id": 1
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `string` | `"healthy"` when the decoder is running and MariaDB is reachable; `"unhealthy"` otherwise |
| `phase` | `string` | `"running"` when the DB probe succeeds; `"starting"` while the decoder is still connecting to MariaDB; `"db-unreachable"` when the probe fails |
| `synced` | `boolean` | Whether the decoder is within 3 blocks of the chain tip |
| `last_processed_block` | `integer\|null` | Last block index written to the decoder DB (from `getSyncStatus()`) |
| `node_height` | `integer\|null` | Current tip reported by the coin node (from `getSyncStatus()`) |
| `lag` | `integer\|null` | Blocks behind tip from `getSyncStatus()` |
| `lastProcessedBlock` | `integer\|null` | Alias for `last_processed_block` (convenience copy) |
| `chainTipBlock` | `integer\|null` | Alias for `node_height` (convenience copy) |
| `blockLag` | `integer\|null` | Alias for `lag` (convenience copy) |
| `lag_blocks` | `integer\|null` | Live lag computed from internal decoder state; `null` when either height is still unknown (before the first `getBlockchainInfo`, or nothing processed yet) rather than a misleading `0`. May differ slightly from `lag` during rapid catch-up |
| `node_height_stale` | `boolean` | Present and `true` when the last successful node-tip poll is more than two refresh intervals old (node outage): `node_height` is then frozen, so a zero `lag` does not mean caught-up |
| `rpc_errors` | `integer` | Combined RPC error count from the decoder and its `BlockchainConnector` |
| `parse_errors` | `integer` | Number of transactions quarantined due to parse failures |
| `error` | `string\|null` | Error message if the decoder crashed, otherwise `null` |

### `GET /status` (REST)

Returns HTTP 200 with `{status: "healthy", db, running}` when the decoder is running and MariaDB is reachable, or HTTP 503 otherwise. Distinct from the JSON-RPC `health` method so load balancers and uptime monitors can rely on the HTTP status code directly (a plain GET against the JSON-RPC root always answers 200). Point load balancers and uptime monitors here; point Docker HEALTHCHECKs at `GET /live`.

### `GET /live` (REST)

The liveness probe, and the route the Docker HEALTHCHECK runs. Everything `/status` reports, plus `stalled`, `last_processed_block`, `node_height`, `lag`, `parse_errors`, and `rpc_errors`. Returns HTTP 503 when the decoder is not running, MariaDB is unreachable, **or** the block loop is stalled.

Stalled means the loop is alive and retrying but no longer making progress the chain is waiting on: either one height has failed to fetch on many consecutive attempts, or nothing advanced for `DECODER_STALL_ALERT_MS` (default 15 minutes) while the node tip was fresh and visibly ahead. The block loop never skips a block on a fetch or parse fault, because skipping would corrupt the index, so a deterministic fault at one height retries forever with the process alive and the DB answering. That case is invisible to `/status`, which is why autoheal probes `/live` instead.

A frozen node tip (node outage) is deliberately **not** stalled: both sides stop and a restart fixes nothing. Tune the window per host with `DECODER_STALL_ALERT_MS`, and the consecutive-fetch-failure threshold with `DECODER_STALL_FETCH_ATTEMPTS` (default 20 attempts, about one minute).

### `getlatestblock`

Returns the decoder's latest parsed block alongside the coin-node's tip, useful for monitoring decoder-to-node lag in a single call.

**Request:**
```json
{
    "jsonrpc": "2.0",
    "method": "getlatestblock",
    "id": 1
}
```

**Response:**
```json
{
    "jsonrpc": "2.0",
    "result": {
        "block_index": 900123,
        "node_block_index": 900124,
        "is_synced": true
    },
    "id": 1
}
```

| Field | Type | Description |
|---|---|---|
| `block_index` | `integer\|null` | Last block index written to the decoder DB |
| `node_block_index` | `integer\|null` | Current tip reported by the coin node |
| `is_synced` | `boolean` | Whether the decoder is within 3 blocks of the chain tip |

### Security

The API includes:
- **Helmet**: sets secure HTTP headers
- **CORS**: enabled for cross-origin requests
- **Rate limiting**: 100 requests per minute per IP
- **Body size limit**: 100kb maximum request body

## Schema Migrations

The decoder ships with a migration system that tracks and applies schema changes to existing databases. Two migration modes exist:

- **Auto migrations** (tagged `mode=auto`) are applied automatically at every startup. These are additive and idempotent (guarded with `IF NOT EXISTS`).
- **Manual migrations** (tagged `mode=manual`) require an explicit operator run. These cover destructive or data-backfill changes that must not run unattended.

To apply pending manual migrations:

```bash
node src/migrate.js
# or: npm run migrate
```

The run holds a database-scoped advisory lock so concurrent processes cannot apply the same migration twice. Each applied migration is recorded in the `schema_migrations` table with its filename, SHA-256 checksum, mode, and timestamp. Re-running the command is safe; only pending migrations are applied.

Take a backup and stop the decoder before running manual migrations, since some involve full table rebuilds.

## Reorg Handling

Chain reorganizations are detected automatically during the block polling loop:

1. Before writing a new block, the decoder compares the `previous_block_hash` from the coin node with the hash stored in the database for the previous block
2. If they don't match, a reorganization has occurred
3. The decoder deletes the invalid block (and all its transactions) from the database
4. A REORG event is recorded in the `events` table with the affected block height
5. The polling loop resumes, re-parsing from the corrected chain

The indexer monitors the decoder's `blocks` table and independently handles reorg rollback of its own state.

## Mempool Tracking

Mempool tracking activates when the decoder is synced (within 3 blocks of the tip):

- **Poll interval:** every 60 seconds  
- **Batch size:** 1000 transactions per RPC batch  
- **Comparison method:** binary search against sorted txid lists  
- **Cleanup:** stale mempool entries (no longer in node's mempool) are deleted each cycle

Mempool tracking pauses if the decoder falls more than 3 blocks behind the tip, and resumes automatically when caught up.

## Connection Resilience

### Coin Node (JSON-RPC)

- All RPC calls have a 30-second HTTP timeout by default (overridable via `NODE_RPC_TIMEOUT`)
- Failed calls are retried up to 10 times with 500ms backoff
- HTTP 429 (rate limited) triggers a longer 5-second backoff
- Connection aborts (ECONNABORTED) are retried with timeout warnings logged

### MariaDB

- Connection pool of 10 concurrent connections
- 30-second query execution timeout (configurable via `DB_QUERY_TIMEOUT`)
- Transaction locking via a queue-based mutex prevents concurrent block commits and mempool updates from interleaving
- On connection failure, errors are logged with `e.code` (not full error object, to avoid credential leakage)

## Troubleshooting

### Decoder won't start parsing

- Verify the coin node is accessible at `NODE_URL:NODE_PORT`
- Check that `verificationprogress` is >= 0.99 (run `bitcoin-cli getblockchaininfo`)
- If using Dogecoin, ensure `AUX_POW` is set in the environment

### Decoder is stuck / not advancing

- Check coin node connectivity (the decoder logs RPC timeout warnings)
- Verify MariaDB is accessible and the connection pool isn't exhausted
- Check for reorg loops, if the chain is continuously reorganizing, the decoder may repeatedly delete and re-parse the same block

### Database name rejected

- Database names must match `/^[A-Za-z0-9_]+$/`. No spaces, backticks, or special characters
- Follow the naming convention: `XChain_{CHAIN}_{NETWORK}_Decoder`

### Mempool not updating

- Mempool tracking only runs when the decoder is synced (within 3 blocks of tip)
- Check that the 60-second interval hasn't been interrupted by a long block parse
- Verify `getRawMempool` RPC is accessible

### High memory usage

- Large mempool batches (>10,000 unconfirmed txs) can cause temporary memory spikes during the batch-fetch phase
- The 1000-tx chunk size limits peak memory per batch

## Monitoring

The `health` API endpoint provides the key monitoring signals:

| Condition | `status` | `synced` |
|---|---|---|
| Normal operation, caught up | `"healthy"` | `true` |
| Normal operation, catching up | `"healthy"` | `false` |
| Decoder crashed | `"unhealthy"` | `false` |

Monitor the `events` table for REORG events, which indicate chain instability.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
