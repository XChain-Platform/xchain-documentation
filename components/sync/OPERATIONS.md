<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Indexer Sync — Operations

## Prerequisites

- **Node.js** >= 18
- **MariaDB** (accessible from the service)
- **xchain-hub** — must be running and reachable at `HUB_API_HOST:HUB_PORT`
- **xchain-indexer** / **xchain-decoder** — at least one indexer or decoder must be installed and running (server mode only)

## Running the Service

### Server Mode

Server mode is used on an xchain-node alongside authoritative indexers. The service polls indexer databases for new blocks and serves them to remote clients.

```bash
# Set environment variables
export SYNC_MODE=server
export SYNC_API_PORT=3006
export HUB_API_HOST=localhost
export HUB_PORT=10000

# Start the service
npm run api
```

The service discovers all installed chains/networks from the hub automatically. No database credentials are needed in the environment — they come from the hub config.

### Client Mode

Client mode is used on validator nodes or any machine that needs a replica of the indexer data. It downloads data from remote sync servers.

```bash
# Set environment variables
export SYNC_MODE=client
export SYNC_API_PORT=3006
export HUB_API_HOST=localhost
export HUB_PORT=10000
export SYNC_SOURCES=http://sync1.example.com:3006,http://sync2.example.com:3006
export VERIFY_HASHES=true
export REPLICA_DB_HOST=localhost
export REPLICA_DB_PORT=3306
export REPLICA_DB_USER=xchain_sync
export REPLICA_DB_PASS=your_password

# Start the service
npm run api
```

On first start with an empty database, the client downloads a full snapshot. Subsequent starts detect existing data and perform an incremental catch-up.

## Docker

### Installation via xchain-node

```bash
xchain-node install <branch> xchain-sync
```

This creates a single container (`xchain-node-xchain-sync`) that is connected to all Docker networks for all installed chains, allowing it to reach the MariaDB instance and the hub.

### Manual Docker Build

```bash
cd xchain-sync
docker build . -t xchain-sync
docker run -d \
  -e SYNC_MODE=server \
  -e SYNC_API_PORT=3006 \
  -e HUB_API_HOST=xchain-node-xchain-hub \
  -e HUB_PORT=10000 \
  -p 3006:3006 \
  --network xchain-node-bitcoin-mainnet \
  xchain-sync
```

For multi-chain support, the container must be connected to each chain's Docker network:

```bash
docker network connect xchain-node-dogecoin-mainnet <container_id>
docker network connect xchain-node-litecoin-mainnet <container_id>
```

### Port Mapping

| Internal Port | Default External Port | Purpose |
|---|---|---|
| `3006` | `3006` | REST API + WebSocket (shared port) |

## Authentication

When the `SYNC_API_KEY` environment variable is set, all REST and WebSocket endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

Requests without a valid token receive a `401 Unauthorized` response. When `SYNC_API_KEY` is not set, authentication is disabled and all endpoints are open.

## REST API Reference

### `GET /status`

Returns sync status for all discovered chains/networks, nested by coin → network → dbType.

**Request:**
```
GET /status
```

**Response:**
```json
{
  "bitcoin": {
    "mainnet": {
      "indexer": {
        "block_height": 893000,
        "block_time": 1743690000,
        "ledger_hash": "a1b2c3d4e5f6...",
        "actions_hash": "f6e5d4c3b2a1...",
        "contract_hash": "1a2b3c4d5e6f..."
      },
      "decoder": {
        "block_height": 893000,
        "block_time": 1743690000,
        "block_hash": "d4e5f6a1b2c3..."
      }
    }
  },
  "dogecoin": {
    "mainnet": { ... }
  },
  "last_updated": "2026-04-03T12:00:00.000Z"
}
```

### `GET /status/:dbType/:chain/:network`

Returns sync status for a specific dbType/chain/network combination. `:dbType` must be `indexer` or `decoder`.

**Request:**
```
GET /status/indexer/bitcoin/mainnet
```

**Response (dbType=indexer):**
```json
{
  "chain": "bitcoin",
  "network": "mainnet",
  "dbType": "indexer",
  "block_height": 893000,
  "block_time": 1743690000,
  "ledger_hash": "a1b2c3d4e5f6...",
  "actions_hash": "f6e5d4c3b2a1...",
  "contract_hash": "1a2b3c4d5e6f...",
  "last_updated": "2026-04-03T12:00:00.000Z"
}
```

**Response (dbType=decoder):**
```json
{
  "chain": "bitcoin",
  "network": "mainnet",
  "dbType": "decoder",
  "block_height": 893000,
  "block_time": 1743690000,
  "block_hash": "d4e5f6a1b2c3...",
  "last_updated": "2026-04-03T12:00:00.000Z"
}
```

Returns `400` if `:dbType` is not `indexer` or `decoder`. Returns `404` if the chain/network/dbType combination is not supported.

### `GET /schema/:dbType/:chain/:network`

Returns all table DDL statements (CREATE TABLE) for a specific dbType/chain/network. Used by clients to initialize replica database schema before downloading a snapshot. `:dbType` must be `indexer` or `decoder`.

**Request:**
```
GET /schema/indexer/bitcoin/mainnet
```

**Response:**
```json
{
  "chain": "bitcoin",
  "network": "mainnet",
  "dbType": "indexer",
  "tables": {
    "blocks": "CREATE TABLE `blocks` (...)",
    "transactions": "CREATE TABLE `transactions` (...)",
    ...
  }
}
```

Returns `400` if `:dbType` is invalid. Returns `404` if the chain/network/dbType combination is not supported. DDL statements are validated to reject anything other than `CREATE TABLE` (no triggers, procedures, views, or destructive statements).

### `GET /snapshot/:dbType/:chain/:network`

Downloads a full database snapshot for bootstrap. Rate-limited to `SNAPSHOT_RATE_FULL` per hour per IP (default: 1). `:dbType` must be `indexer` or `decoder`.

**Request:**
```
GET /snapshot/indexer/bitcoin/mainnet
```

**Response headers:**

- `Content-Type: application/json`
- `Content-Encoding: gzip`
- `X-Block-Height: 893000`
- `X-Ledger-Hash: a1b2c3d4e5f6...` *(indexer only)*
- `X-Actions-Hash: f6e5d4c3b2a1...` *(indexer only)*
- `X-Contract-Hash: 1a2b3c4d5e6f...` *(indexer only)*

The response body is a gzip-compressed JSON stream containing all table data in dependency order.

### `GET /snapshot/:dbType/:chain/:network/since/:blockHeight`

Downloads an incremental snapshot containing all data since the specified block height. Rate-limited to `SNAPSHOT_RATE_INCR` per hour per IP (default: 10). `:dbType` must be `indexer` or `decoder`.

**Request:**
```
GET /snapshot/indexer/bitcoin/mainnet/since/892000
```

**Response headers:**

- `Content-Type: application/json`
- `Content-Encoding: gzip`
- `X-Block-Height: 893000`
- `X-Since-Block: 892000`
- `X-Ledger-Hash: a1b2c3d4e5f6...` *(indexer only)*
- `X-Actions-Hash: f6e5d4c3b2a1...` *(indexer only)*
- `X-Contract-Hash: 1a2b3c4d5e6f...` *(indexer only)*
- `X-Block-Hash: d4e5f6a1b2c3...` *(decoder only)*

The response body format is the same as the full snapshot, but scoped to the delta since `:blockHeight`.

### `GET /transparency/:dbType/:chain/:network/roots`

Returns the transparency log — a paginated list of per-block hashes. **Indexer only** — returns `400` when `:dbType` is `decoder` (decoder data has no synthetic chain-of-state hashes).

**Request:**
```
GET /transparency/indexer/bitcoin/mainnet/roots?page=0&limit=100
```

**Response:**
```json
{
  "page": 0,
  "limit": 100,
  "total": 893000,
  "results": [
    {
      "block_index": 893000,
      "block_time": 1743690000,
      "ledger_hash": "a1b2c3d4e5f6...",
      "actions_hash": "f6e5d4c3b2a1...",
      "contract_hash": "1a2b3c4d5e6f...",
      "logged_at": "2026-04-03T12:00:00.000Z"
    },
    ...
  ]
}
```

Maximum `limit`: 1000.

**Error when dbType=decoder:**
```json
HTTP 400
{ "error": "Transparency log is indexer-only — decoder DB has no synthetic chain-of-state hashes" }
```

### `GET /transparency/:dbType/:chain/:network/proof/:block_index`

Returns a Merkle inclusion proof for a specific block. **Indexer only** — returns `400` when `:dbType` is `decoder`.

**Request:**
```
GET /transparency/indexer/bitcoin/mainnet/proof/893000
```

### `GET /transparency/:dbType/:chain/:network/root/latest`

Returns the latest committed Merkle root. **Indexer only** — returns `400` when `:dbType` is `decoder`.

**Request:**
```
GET /transparency/indexer/bitcoin/mainnet/root/latest
```

## WebSocket API Reference

### Subscribing

Connect to `ws://host:3006/subscribe/:dbType/:chain/:network`. `:dbType` must be `indexer` or `decoder`.

```
ws://sync.example.com:3006/subscribe/indexer/bitcoin/mainnet
ws://sync.example.com:3006/subscribe/decoder/bitcoin/mainnet
```

An optional `?sync_mode=` query parameter controls which tables are sent for `dbType=indexer`:
- `sync_mode=full` (default) — all tables for the chain
- `sync_mode=infra-only` — only cross-chain infrastructure tables (`stakes`, `delegations`, `validator_rewards`, `prices`, `reward_claims`, `index_pubkeys`, `index_addresses`, `index_actions`, `index_statuses`, `index_fiats`)

Per-IP connection limit: `WS_MAX_PER_IP` (default: 3).

### Message Types (Server to Client)

**Status** (sent on initial connection and every 60 seconds):

*dbType=indexer:*
```json
{
  "type": "status",
  "chain": "bitcoin",
  "network": "mainnet",
  "block_height": 893000,
  "block_time": 1743690000,
  "ledger_hash": "...",
  "actions_hash": "...",
  "contract_hash": "..."
}
```

*dbType=decoder:*
```json
{
  "type": "status",
  "chain": "bitcoin",
  "network": "mainnet",
  "block_height": 893000,
  "block_time": 1743690000,
  "block_hash": "..."
}
```

**Block** (sent when a new block is processed):

*dbType=indexer:*
```json
{
  "type": "block",
  "chain": "bitcoin",
  "network": "mainnet",
  "block_index": 893001,
  "block_time": 1743690060,
  "ledger_hash": "...",
  "actions_hash": "...",
  "contract_hash": "...",
  "data": {
    "blocks": [ ... ],
    "transactions": [ ... ],
    "actions": [ ... ],
    "index_addresses": [ ... ],
    "sends": [ ... ],
    "credits": [ ... ],
    "debits": [ ... ],
    "balances": [ ... ],
    ...
  }
}
```

*dbType=decoder:*
```json
{
  "type": "block",
  "chain": "bitcoin",
  "network": "mainnet",
  "block_index": 893001,
  "block_time": 1743690060,
  "block_hash": "...",
  "data": {
    "blocks": [ ... ],
    "transactions": [ ... ],
    "transaction_outputs": [ ... ],
    "dispensers": [ ... ],
    "index_addresses": [ ... ],
    "index_transactions": [ ... ],
    "pubkeys": [ ... ],
    "events": [ ... ]
  }
}
```

Tables with no rows for the block are omitted from `data` to minimize message size.

**Reorg** (sent when a chain reorganization is detected):
```json
{
  "type": "reorg",
  "chain": "bitcoin",
  "network": "mainnet",
  "block_index": 892990
}
```

### Message Types (Client to Server)

**Auth** (optional, sent within 5 seconds of connection):
```json
{
  "type": "auth",
  "pubkey": "ed25519_public_key_hex",
  "sig": "signature_of_timestamp_hex",
  "ts": 1743690000
}
```

Authenticated connections (validators) may receive priority handling.

### Backpressure

If a subscriber falls behind and accumulates more than 50 buffered messages, the server drops the connection. The client should reconnect and use the incremental snapshot endpoint to catch up on missed blocks before re-subscribing.

### Ping/Pong

The `ws` library's built-in ping/pong mechanism runs on a 30-second interval to detect dead connections. Connections that fail to respond to a ping are terminated.

## Decoder vs Indexer Response Schema Differences

When `dbType=decoder`, responses differ from `dbType=indexer` in two ways:

### Hash fields

Decoder responses carry a single `block_hash` in place of the three indexer hashes:

| Context | dbType=indexer | dbType=decoder |
|---|---|---|
| Status response | `ledger_hash`, `actions_hash`, `contract_hash` | `block_hash` |
| Block WebSocket event | `ledger_hash`, `actions_hash`, `contract_hash` | `block_hash` |
| Incremental snapshot headers | `X-Ledger-Hash`, `X-Actions-Hash`, `X-Contract-Hash` | `X-Block-Hash` |

Decoder data is fully deterministic from the coin node — there are no synthetic chain-of-state hashes — so the transparency log does not apply.

### Tables replicated

The decoder DB contains 9 tables. xchain-sync replicates 8 of them:

| Table | Replicated | Notes |
|---|---|---|
| `blocks` | Yes | Block-scoped |
| `transactions` | Yes | Block-scoped |
| `transaction_outputs` | Yes | TX-scoped |
| `dispensers` | Yes | TX-scoped |
| `index_addresses` | Yes | Append-only index |
| `index_transactions` | Yes | Append-only index |
| `pubkeys` | Yes | Append-only index |
| `events` | Yes | Operational/logging |
| `mempool_transactions` | **No** | Excluded — non-deterministic across nodes |

Additionally, the transparency log table (`sync_meta`) is **not** created for decoder replicas — it is indexer-only.

### Transparency endpoints return 400 for decoder

All three transparency endpoints reject `dbType=decoder` with HTTP 400:

```
GET /transparency/decoder/:chain/:network/roots       → 400
GET /transparency/decoder/:chain/:network/proof/:id   → 400
GET /transparency/decoder/:chain/:network/root/latest → 400
```

Error body:
```json
{ "error": "Transparency log is indexer-only — decoder DB has no synthetic chain-of-state hashes" }
```

## Resilience and Recovery

### Circuit Breaker

Each chain/network database connection has an independent circuit breaker. After 10 consecutive query failures, the circuit opens and all queries for that chain fail fast for 30 seconds. Other chains continue operating normally.

### WebSocket Reconnection (Client Mode)

If a WebSocket connection drops, the client waits 5 seconds and reconnects. On reconnection, it compares its last applied block height with the server's current height (via the initial `status` message). If there is a gap, it fetches an incremental snapshot via REST to fill it before resuming WebSocket-based sync.

### Hash Chain Verification

Every received indexer block includes three hashes (`ledger_hash`, `actions_hash`, `contract_hash`); decoder blocks carry a single `block_hash`. The client verifies that each hash's embedded `previous_hash` matches the hash stored for the prior block. A mismatch indicates:
- A missed reorg event (the server rolled back blocks the client didn't hear about)
- Data corruption or tampering

On mismatch, the client falls back to an incremental REST catch-up from the point of divergence.

### Cross-Source Verification

When `VERIFY_HASHES=true` and multiple `SYNC_SOURCES` are configured, the client waits for the same block from at least two sources and compares hashes. If they disagree, the block is held and a discrepancy alert is logged. The client does not apply contested blocks.

## Troubleshooting

### "Missing required environment variable: HUB_API_HOST"

The `HUB_API_HOST` environment variable is required in both modes. Set it to the hostname or IP of the local xchain-hub instance (or the Docker container name when running in Docker).

### "Error connecting to hub"

The hub must be running and reachable before the sync service starts. Verify with:

```bash
curl -X POST http://HUB_API_HOST:HUB_PORT -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","id":1}'
```

### "No indexer databases found in hub config"

The hub returned no entries with `xchain-indexer` modules. This means no indexers are installed on the node. Install at least one indexer via xchain-node first. Note that decoder DB replication also requires a corresponding `xchain-decoder` entry in the hub config.

### "Circuit breaker open for bitcoin/mainnet"

The database connection for this chain has failed 10+ times consecutively. Check that MariaDB is running and the credentials from the hub config are correct. The circuit will attempt a half-open retry after 30 seconds.

### "WebSocket connection dropped: backpressure limit exceeded"

The client is not processing blocks fast enough to keep up with the server. This can happen during initial sync if the client's MariaDB is slow. The client should reconnect and use an incremental snapshot to catch up.

### "Hash chain discontinuity at block N"

The `previous_hash` in block N doesn't match the stored hash for block N-1. This typically means a reorg event was missed during a WebSocket disconnection. The client will automatically attempt an incremental catch-up from the divergence point.

### "Hash mismatch between sources at block N"

Two sync sources disagree on the hashes for the same block. This indicates one source is serving incorrect data. The client holds the block and logs the discrepancy. Investigate which source is incorrect by comparing against a third source or checking the authoritative indexer (or decoder) directly.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
