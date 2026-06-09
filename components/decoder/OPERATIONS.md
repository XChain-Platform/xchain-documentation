<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Decoder — Operations

## Prerequisites

- Node.js >= 18
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
5. Creates all 8 tables if they don't exist
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
        "status": "ok",
        "decoderRunning": true,
        "synced": true,
        "error": null
    },
    "id": 1
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `string` | `"ok"` when decoder is running, `"error"` otherwise |
| `decoderRunning` | `boolean` | Whether the decoder process is alive |
| `synced` | `boolean` | Whether the decoder is within 3 blocks of the chain tip |
| `error` | `string\|null` | Error message if the decoder crashed |

### Security

The API includes:
- **Helmet** — sets secure HTTP headers
- **CORS** — enabled for cross-origin requests
- **Rate limiting** — 100 requests per minute per IP
- **Body size limit** — 100kb maximum request body

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

- All RPC calls have a 5-second HTTP timeout
- Failed calls are retried up to 10 times with 500ms backoff
- HTTP 429 (rate limited) triggers a longer 5-second backoff
- Connection aborts (ECONNABORTED) are retried with timeout warnings logged

### MariaDB

- Connection pool of 10 concurrent connections
- 30-second timeout for acquiring a connection from the pool
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
- Check for reorg loops — if the chain is continuously reorganizing, the decoder may repeatedly delete and re-parse the same block

### Database name rejected

- Database names must match `/^[A-Za-z0-9_]+$/` — no spaces, backticks, or special characters
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

| Condition | `status` | `decoderRunning` | `synced` |
|---|---|---|---|
| Normal operation, caught up | `ok` | `true` | `true` |
| Normal operation, catching up | `ok` | `true` | `false` |
| Decoder crashed | `error` | `false` | `false` |

Monitor the `events` table for REORG events, which indicate chain instability.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
