<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Indexer Sync

## What is xchain-sync

xchain-sync is the database replication layer of the XChain Platform. It enables lightweight validators and other consumers to obtain and stay current with both the indexer database and the decoder database without running their own decoder+indexer stacks. The service runs as a single long-lived Node.js process with an embedded Express REST API and a WebSocket server, both served on the same port.

All REST and WebSocket endpoints include a `/:dbType/` path segment. The `dbType` parameter is either `indexer` (full table set, with transparency log) or `decoder` (8 of the 9 decoder DB tables; `mempool_transactions` is excluded because it is non-deterministic across nodes, and the transparency log is not applicable to decoder data).

The service operates in two modes. In **server mode**, it runs alongside authoritative indexers and decoders on an xchain-node, polls each database for new blocks, and serves the data to remote clients via REST snapshots and real-time WebSocket streaming. In **client mode**, it connects to one or more remote sync servers, downloads a full database snapshot for initial bootstrap, then subscribes to a WebSocket stream for ongoing block-by-block replication into a local MariaDB instance.

On startup, the service calls the local xchain-hub's `getallconfigs` JSON-RPC method to discover all installed chains and their indexer and decoder database connections. This means a single instance automatically serves all chains/networks installed on the node — if Bitcoin mainnet, Bitcoin testnet, and Dogecoin mainnet are all running, the sync service discovers and serves all three from one process, for both database types. It re-polls the hub every 5 minutes to detect newly installed chains without a restart.

Data integrity for the indexer is guaranteed by per-block chained SHA256 hashes (ledger, actions, contracts) that the indexer already computes. For the decoder, a single `block_hash` is used in place of the three indexer hashes. Each hash includes the previous block's hash, forming a hash chain. Clients verify this chain on every received block and can optionally cross-verify hashes from multiple independent sync sources to detect tampered data.

## Features

- **Dual mode** — server mode serves data from authoritative indexer and decoder databases; client mode replicates data into local MariaDB instances
- **Multi-chain single instance** — discovers all installed chains/networks via the hub and serves them from one process on one port
- **Hub auto-discovery** — calls xchain-hub `getallconfigs` at startup; re-polls every 5 minutes to detect newly installed chains
- **Full snapshot export** — compressed, streamed JSON database dumps for bootstrapping new validators
- **Incremental snapshots** — delta exports since any block height for catch-up after downtime
- **Real-time WebSocket streaming** — per-chain/network subscriptions for new blocks and reorg events
- **Hash chain verification** — leverages the indexer's existing per-block chained SHA256 hashes for data integrity
- **Cross-source comparison** — clients can sync from 2+ independent servers and compare block hashes
- **Transparency log** — append-only per-block hash record for public auditability
- **Rate limiting** — configurable per-IP limits on snapshot downloads and WebSocket connections
- **Reorg propagation** — detects chain reorganizations and broadcasts rollback events to subscribers
- **Automatic catch-up** — clients detect block gaps on reconnect and self-heal via incremental snapshots
- **Circuit-breaker DB connections** — automatic failure detection and recovery
- **Input validation** — SQL identifier sanitization, DDL whitelisting, WebSocket event schema validation
- **725 tests** — unit, integration, e2e, fuzz, chaos, mutation, boundary, security, performance, smoke

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Data pipeline position, dual-mode design, internal components, sync algorithms |
| [Configuration](CONFIGURATION.md) | Environment variables, hub discovery, database naming, defaults |
| [Operations](OPERATIONS.md) | Running, Docker, REST/WebSocket API reference, resilience, troubleshooting |

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/XChain-Platform/xchain-sync.git
cd xchain-sync
npm install
```

## Quick Start

Create a `.env` file with the required environment variables (see [Configuration](CONFIGURATION.md) for full details):

```env
SYNC_MODE=server
SYNC_API_PORT=3006

HUB_API_HOST=localhost
HUB_PORT=10000
```

In server mode, database credentials are discovered automatically from the hub — no database environment variables are needed.

Start the service:

```bash
npm run api
```

On startup, the service:
1. Validates required environment variables
2. Calls the hub's `getallconfigs` to discover installed chains and their indexer and decoder database connections
3. Opens a MariaDB connection pool per chain/network/dbType
4. In server mode: starts polling each indexer and decoder database for new blocks and serves REST + WebSocket APIs
5. In client mode: bootstraps from remote snapshot, then subscribes to real-time updates via WebSocket

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the sync service |
| `npm test` | Run unit tests |
| `npm run test:smoke` | Smoke tests (server + client startup, config loading) |
| `npm run test:integration` | Integration tests (requires MariaDB + running indexer) |
| `npm run test:e2e` | End-to-end tests (full server/client lifecycle) |
| `npm run test:security` | Security tests (validation, injection, auth) |
| `npm run test:fuzz` | Fuzz tests (property-based via fast-check) |
| `npm run test:fuzz:tier1` | Tier 1 fuzz (client applier, hash verifier) |
| `npm run test:fuzz:tier2` | Tier 2 fuzz (rollback, server poller, hub client) |
| `npm run test:fuzz:tier3` | Tier 3 fuzz (config parsing) |
| `npm run test:fuzz:quick` | Quick fuzz (100 iterations) |
| `npm run test:chaos` | Chaos engineering tests (DB failures, network partitions) |
| `npm run test:perf` | Performance tests (throughput, snapshots, scaling) |
| `npm run test:perf:quick` | Quick perf (50 blocks) |
| `npm run test:mutate` | Mutation tests (Stryker) |
| `npm run test:mutate:quick` | Quick mutation tests |
| `npm run test:mutate:check` | Incremental mutation tests |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `axios` | HTTP client for hub JSON-RPC calls |
| `express` | HTTP server for REST API endpoints |
| `express-rate-limit` | Per-IP rate limiting on snapshot endpoints |
| `helmet` | Security headers |
| `cors` | CORS middleware |
| `mariadb` | MariaDB connection pools (one per chain/network) |
| `ws` | WebSocket server for real-time block streaming |
| `dotenv` | Environment variable loading |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test framework |
| `chai` | Assertion library |
| `sinon` | Test mocking and stubbing |
| `fast-check` | Property-based (fuzz) testing |
| `proxyquire` | Module mocking for dependency injection |
| `@stryker-mutator/core` | Mutation testing framework |
| `@stryker-mutator/mocha-runner` | Stryker Mocha integration |

## Related Documentation

- [Data Pipeline](../../architecture/Data_Pipeline.md) — full platform data flow
- [xchain-indexer](../indexer/README.md) — upstream service that produces the data this service replicates
- [xchain-hub](../hub/README.md) — config oracle that provides chain discovery
- [xchain-explorer](../explorer/README.md) — alternative consumer of the same indexer data

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
