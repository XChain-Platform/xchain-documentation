<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Indexer Sync

## What is xchain-indexer-sync

xchain-indexer-sync is the database replication layer of the XChain Platform. It enables lightweight validators and other consumers to obtain and stay current with indexer database state without running their own decoder+indexer stacks. The service runs as a single long-lived Node.js process with an embedded Express REST API and a WebSocket server, both served on the same port.

The service operates in two modes. In **server mode**, it runs alongside authoritative indexers on an xchain-node, polls each indexer database for new blocks, and serves the data to remote clients via REST snapshots and real-time WebSocket streaming. In **client mode**, it connects to one or more remote sync servers, downloads a full database snapshot for initial bootstrap, then subscribes to a WebSocket stream for ongoing block-by-block replication into a local MariaDB instance.

On startup, the service calls the local xchain-hub's `getallconfigs` JSON-RPC method to discover all installed chains and their indexer database connections. This means a single instance automatically serves all chains/networks installed on the node — if Bitcoin mainnet, Bitcoin testnet, and Dogecoin mainnet are all running, the sync service discovers and serves all three from one process. It re-polls the hub every 5 minutes to detect newly installed chains without a restart.

Data integrity is guaranteed by the indexer's existing per-block chained SHA256 hashes (ledger, actions, contracts). Each block's hash includes the previous block's hash, forming a hash chain. Clients verify this chain on every received block and can optionally cross-verify hashes from multiple independent sync sources to detect tampered data.

## Features

- **Dual mode** — server mode serves data from authoritative indexer databases; client mode replicates data into local MariaDB instances
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

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Data pipeline position, dual-mode design, internal components, sync algorithms |
| [Configuration](CONFIGURATION.md) | Environment variables, hub discovery, database naming, defaults |
| [Operations](OPERATIONS.md) | Running, Docker, REST/WebSocket API reference, resilience, troubleshooting |

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/XChain-platform/xchain-indexer-sync.git
cd xchain-indexer-sync
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
2. Calls the hub's `getallconfigs` to discover installed chains and indexer database connections
3. Opens a MariaDB connection pool per chain/network
4. In server mode: starts polling each indexer database for new blocks and serves REST + WebSocket APIs
5. In client mode: bootstraps from remote snapshot, then subscribes to real-time updates via WebSocket

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the sync service |
| `npm test` | Run unit tests |
| `npm run test:integration` | Integration tests (requires MariaDB + running indexer) |

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
| `sinon` | Test mocking and stubbing |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
