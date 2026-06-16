<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Indexer Sync — Operations

## Prerequisites

- **Node.js** >= 22
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

### `GET /health`

Lightweight liveness check with per-database circuit-breaker visibility. `GET /status` reports per-chain block heights and lag but not whether a database connection has tripped its circuit breaker open; when that happens the replicator stops applying blocks while the process stays up, so a bare liveness probe still looks fine. This endpoint surfaces the per-database circuit state so monitoring can tell a healthy replicator apart from one stalled on a database outage. Returns HTTP **503** (with the same body) when any database circuit is open.

**Request:**
```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "mode": "source",
  "databases": [
    { "chain": "bitcoin", "network": "mainnet", "dbType": "indexer", "circuit": "closed" },
    { "chain": "bitcoin", "network": "mainnet", "dbType": "decoder", "circuit": "closed" }
  ],
  "last_updated": "2026-04-03T12:00:00.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `string` | `"healthy"` when no database circuit is open; `"degraded"` otherwise (also sets HTTP 503). |
| `mode` | `string` | Configured `SYNC_MODE` (e.g. `"source"`, `"follower"`). |
| `databases` | `array` | One entry per discovered chain/network/dbType, each `{ chain, network, dbType, circuit }`. |
| `databases[].circuit` | `string\|null` | DB circuit-breaker state (`"closed"`, `"open"`, `"half-open"`), or `null` if unavailable. Any `"open"` value forces `status` to `"degraded"`. |
| `last_updated` | `string` | ISO-8601 timestamp the response was generated. |

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

### `POST /validator-heartbeat/:dbType/:chain/:network`

REST fallback to the WebSocket `heartbeat` message, for replicating clients that cannot hold a persistent WebSocket connection. A named validator POSTs its applied height so operators can observe its replication lag without an active subscription. **Server mode only.** Rate-limited per IP. `:dbType` must be `indexer` or `decoder`.

**Request:**
```
POST /validator-heartbeat/indexer/bitcoin/mainnet
Content-Type: application/json

{
  "validator_id": "my-validator-01",
  "applied_height": 893000,
  "applied_block_time": 1743690000
}
```

- `validator_id` — non-empty string, max 256 chars (stable identifier for the validator).
- `applied_height` — non-negative integer; the highest block height fully applied to the replica.
- `applied_block_time` — optional number (Unix time of the applied block); may be omitted or `null`.

If a `SYNC_API_KEY` is configured, send it as `Authorization: Bearer <key>`.

**Response:**
```json
{ "ok": true }
```

Returns `400` if `:dbType` is invalid or any field fails validation, `403` if not in server mode, `404` if the chain/network/dbType combination is not supported, and `503` if the broadcaster is not yet initialized.

Entries are evicted automatically once their `last_seen` exceeds `VALIDATOR_HEARTBEAT_TTL`, so a validator must keep POSTing (or keep its WebSocket heartbeats flowing) to stay visible.

### `GET /validator-status` and `GET /validator-status/:dbType/:chain/:network`

Returns the per-validator heartbeat state recorded via `POST /validator-heartbeat`, including each validator's applied height and computed block lag. **Server mode only.** The no-argument form returns all chains nested by coin → network → dbType; the parameterized form returns a single combination.

**Request:**
```
GET /validator-status
GET /validator-status/indexer/bitcoin/mainnet
```

**Response (parameterized form):**
```json
{
  "chain": "bitcoin",
  "network": "mainnet",
  "dbType": "indexer",
  "validators": {
    "my-validator-01": {
      "applied_height": 893000,
      "applied_block_time": 1743690000,
      "last_seen": "2026-04-03T12:00:00.000Z",
      "lag_blocks": 0
    }
  },
  "last_updated": "2026-04-03T12:00:00.000Z"
}
```

`lag_blocks` is `source block_height − applied_height` (clamped at 0), or `null` when the source height or the validator's applied height is unknown. A validator that has never sent a heartbeat does not appear in `validators` at all. Returns `400` if `:dbType` is invalid, `403` if not in server mode, `404` if the chain/network/dbType combination is not supported, and `503` if the broadcaster is not yet initialized.

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

Returns a Merkle inclusion proof for a specific block within a committed epoch. **Indexer only** — returns `400` when `:dbType` is `decoder`. Only available in server mode — returns `403` in client mode.

**URL parameters:**

| Parameter | Description |
|---|---|
| `:dbType` | Must be `indexer` — decoder DB has no transparency log |
| `:chain` | Coin name (`bitcoin`, `dogecoin`, `litecoin`) |
| `:network` | Network name (`mainnet`, `testnet`, `regtest`) |
| `:block_index` | Integer block index to generate a proof for |

**Request:**
```
GET /transparency/indexer/bitcoin/mainnet/proof/893000
```

**Response (200):**
```json
{
  "blockIndex": 893000,
  "epoch": 8930,
  "leaf": "sha256-hex-of-concatenated-block-hashes...",
  "merkleRoot": "sha256-hex-merkle-tree-root...",
  "proof": [
    { "hash": "sha256-hex-sibling...", "position": "left" },
    { "hash": "sha256-hex-sibling...", "position": "right" }
  ],
  "verified": true
}
```

`proof` is an array of `{ hash, position }` steps that reconstruct the Merkle root from the leaf. `position` is `"left"` or `"right"` indicating the sibling's side. `verified` confirms that the included proof reconstructs `merkleRoot`.

**Error responses:**

```
HTTP 403  { "error": "Transparency log only available in server mode" }
HTTP 400  { "error": "Transparency log is indexer-only" }
HTTP 404  { "error": "Chain/network not found" }
```

A block that exists in `sync_meta` but whose epoch has not yet been committed returns `200` with `{ "error": "epoch not yet committed" }` — epochs are committed when the last block in the epoch (a multiple of the epoch size, default 100) is recorded.

### `GET /transparency/:dbType/:chain/:network/root/latest`

Returns the latest committed Merkle root. When no epoch has been committed yet (the log is empty or no epoch boundary has been crossed), returns `null` values rather than an error. **Indexer only** — returns `400` when `:dbType` is `decoder`. Only available in server mode — returns `403` in client mode.

**URL parameters:**

| Parameter | Description |
|---|---|
| `:dbType` | Must be `indexer` — decoder DB has no transparency log |
| `:chain` | Coin name (`bitcoin`, `dogecoin`, `litecoin`) |
| `:network` | Network name (`mainnet`, `testnet`, `regtest`) |

**Request:**
```
GET /transparency/indexer/bitcoin/mainnet/root/latest
```

**Response (200, when at least one epoch is committed):**
```json
{
  "id": 8930,
  "epoch": 8930,
  "start_block": 892901,
  "end_block": 893000,
  "merkle_root": "sha256-hex-merkle-tree-root...",
  "leaf_count": 100,
  "created_at": "2026-04-03T12:00:00.000Z"
}
```

**Response (200, when the log is empty or no epoch has been committed):**
```json
{ "epoch": null, "merkle_root": null }
```

**Error responses:**

```
HTTP 403  { "error": "Transparency log only available in server mode" }
HTTP 400  { "error": "Transparency log is indexer-only" }
HTTP 404  { "error": "Chain/network not found" }
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

**Heartbeat** (optional, sent by replicating clients to report applied-block progress):
```json
{
  "type": "heartbeat",
  "appliedBlock": 893000
}
```

A replicating client (validator or ecosystem replicator) sends this message to tell the server how far it has applied blocks to its own replica DB. `appliedBlock` is the highest block height the client has fully applied; it must be a number. The server records the value against that connection and uses it to compute per-subscriber lag (`lag = lastSentBlock − appliedBlock`), surfaced through the `GET /status` response and the validator-status endpoints.

The message is **best-effort and optional** at the protocol level: the channel is otherwise server→client push-only, and the server **silently ignores** malformed JSON or any message whose `type` is not `heartbeat` (or whose `appliedBlock` is not a number) — no acknowledgement or protocol-level error is returned. A client that never sends heartbeats stays connected and keeps receiving blocks, but its `appliedBlock`/`lag` will report as `null` (never reported), so it can appear stale or unmonitored in the status output even though the connection is healthy. Clients that want their replication progress visible to operators **must** send heartbeats (or use the `POST /validator-heartbeat` REST fallback below).

The reference client (`ClientSync`) sends a heartbeat whenever at least 10 blocks have been applied since its last report, and otherwise arms a 5-second timer so a slow trickle of blocks is still reported without a per-block send.

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
| `dispensers` | Yes (snapshot only) | Excluded from the per-block stream — the decoder prunes expired dispensers each block with a count-reducing DELETE that streaming inserts can't represent, so it converges via the full snapshot instead |
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

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
