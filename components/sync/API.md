<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->

# XChain Platform Sync: API Reference

## Overview

`xchain-sync` replicates the indexer and decoder databases from authoritative
source nodes to validators and ecosystem replicas. It serves two surfaces over
one shared port (`3006`):

- a **REST API** for snapshots, status, schema, and operator control, and
- a **WebSocket API** for real-time block streaming.

A replicating client bootstraps from a REST snapshot, then subscribes over
WebSocket for live blocks, falling back to the incremental snapshot endpoint to
fill any gap after a disconnect. This reference catalogs the endpoints and the
WebSocket protocol; for deployment, server/client modes, and worked examples see
[`OPERATIONS.md`](./OPERATIONS.md).

**Path parameters used throughout:**
- `:dbType` is `indexer` or `decoder`.
- `:chain` is `bitcoin`, `litecoin`, or `dogecoin`.
- `:network` is `mainnet`, `testnet`, or `regtest`.

## Authentication

When `SYNC_API_KEY` is set, every REST and WebSocket endpoint requires a bearer
token:

```
Authorization: Bearer <SYNC_API_KEY>
```

Requests without a valid token receive `401 Unauthorized`. When `SYNC_API_KEY`
is unset, authentication is disabled and all endpoints are open. WebSocket
clients may additionally send an Ed25519 `auth` message after connecting (see
below); authenticated validators may receive priority handling.

## REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness plus per-database circuit-breaker state. Returns `503` (same body) when any database circuit is open, so monitoring can tell a healthy replicator from one stalled on a database outage that a bare liveness probe would miss. |
| GET | `/status` | Per-chain applied block heights and per-subscriber lag across every served combination. |
| GET | `/status/:dbType/:chain/:network` | The same status for a single combination. |
| GET | `/catalog` | The `(dbType, chain, network)` combinations this server serves. |
| GET | `/snapshot/:dbType/:chain/:network` | Full database snapshot for bootstrapping a fresh replica. |
| GET | `/snapshot/:dbType/:chain/:network/since/:blockHeight` | Incremental snapshot of everything after `:blockHeight`, used to fill a gap after a disconnect before re-subscribing. |
| GET | `/schema/:dbType/:chain/:network` | The expected table schema, so a client can self-heal a drifted replica. |
| POST | `/validator-heartbeat/:dbType/:chain/:network` | REST fallback to the WebSocket `heartbeat`, for clients that cannot hold a persistent socket. The validator POSTs its applied height. **Server mode only**, rate-limited per IP. |
| GET | `/validator-status` | Per-validator heartbeat state (applied height + computed lag) for every chain, nested coin to network to dbType. **Server mode only.** |
| GET | `/validator-status/:dbType/:chain/:network` | The same for a single combination. |
| POST | `/halt/clear/:dbType/:chain/:network` | Clear a consensus-divergence halt on a client after operator investigation. A halted client detected a hash mismatch between sources and stopped applying blocks; restart the service after clearing for a clean catch-up. |

## WebSocket API

### Subscribing

```
ws://host:3006/subscribe/:dbType/:chain/:network
```

For `dbType=indexer`, an optional `?sync_mode=` query parameter selects the
tables streamed: `full` (default, all tables) or `infra-only` (only the
cross-chain infrastructure tables: `stakes`, `delegations`, `validator_rewards`,
`prices`, `reward_claims`, and the `index_*` lookup tables). Per-IP connection
limit: `WS_MAX_PER_IP` (default 100).

### Server to client

- **`status`** sent on connect and every 60 seconds. Carries `block_height`,
  `block_time`, and the consensus hashes: `ledger_hash` / `actions_hash` /
  `contract_hash` for `indexer`, or `block_hash` for `decoder`.
- **`block`** sent per processed block. Same identity fields as `status` plus a
  `data` object of changed rows by table; tables with no rows for the block are
  omitted to keep messages small.
- **`reorg`** sent when a reorganization is detected, carrying the
  `block_index` from which the client must roll back.

### Client to server

- **`auth`** (optional, within 5s of connecting): `{ type, pubkey, sig, ts }`,
  an Ed25519 signature over the timestamp. Authenticated validators may get
  priority handling.
- **`heartbeat`** (optional): `{ type: "heartbeat", appliedBlock }` reports the
  highest block the client has fully applied, so the server can compute lag
  (`lag = lastSentBlock - appliedBlock`) and surface it in `GET /status` and the
  validator-status endpoints. Best-effort: the server silently ignores malformed
  or unknown messages, and a client that never heartbeats still receives blocks
  but reports `null` lag. Use this (or the `POST /validator-heartbeat` fallback)
  to stay visible to operators.

### Backpressure and reconnection

If a subscriber accumulates more than 50 buffered messages, the server drops the
connection. The client should reconnect (the reference client waits 5 seconds),
compare its last applied height against the initial `status` message, fetch an
incremental snapshot via `/snapshot/.../since/:blockHeight` to fill any gap, and
then resume the subscription.

## Machine-readable spec

Unlike the encoder and hub (which serve OpenRPC) and the explorer (OpenAPI),
`xchain-sync` does not yet ship a machine-readable API spec. Generating one
(OpenAPI for the REST surface, plus an AsyncAPI or prose schema for the
WebSocket messages) is a tracked documentation gap.
