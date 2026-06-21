<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Hub

## What is xchain-hub

xchain-hub is the decentralized configuration oracle, price oracle, and cross-chain coordinator of the XChain Platform. It runs as a long-lived Node.js/Express process backed by MariaDB and serves a JSON-RPC API that all other platform services poll for shared configuration, endpoint discovery, pricing data, and cross-chain action coordination.

One hub instance serves the entire deployment, all chains (BTC, LTC, DOGE) and all networks (mainnet, testnet, regtest) share the same process and database. In validator mode, multiple hub instances form a P2P gossip network with PBFT consensus, Ed25519 identity, and Byzantine fault tolerance.

The hub operates in two modes. In **standalone mode** (no `P2P_VALIDATOR_ADDR` set), it functions as a simple MariaDB-backed config oracle, config reads and writes go directly to the database. In **validator mode**, config writes go through PBFT consensus, price data is aggregated from a decentralized oracle network, and cross-chain actions are attested by a validator quorum.

## Features

- **Config store**: JSON-RPC API for service configuration parameters used by all platform services
- **Service discovery**: other services poll the hub to find hostnames, ports, and connection details for their dependencies
- **PBFT consensus**: config writes go through a PRE_PREPARE → PREPARE → COMMIT consensus round requiring 2f+1 agreement
- **P2P gossip**: WebSocket-based peer mesh with heartbeat, exponential backoff reconnection, and message deduplication
- **Ed25519 validator identity**: cryptographic message signing and verification using Node.js built-in crypto
- **Leader rotation**: deterministic per-sequence leader from sorted validator set with view change on timeout
- **Decentralized price oracle**: validators fetch prices from CoinGecko and CoinMarketCap, aggregate via trimmed median (discard top/bottom 15%), finalize via PBFT consensus
- **Oracle rounds**: configurable round interval (default 10 minutes) with submission window (default 3 minutes)
- **Fee quotes**: calculates native coin fee amounts by converting gas units → XCHAIN → native coin via oracle prices
- **Cross-chain attestation**: PBFT-based consensus for cross-chain action verification with per-chain confirmation thresholds (BTC: 6, LTC: 12, DOGE: 60; configurable via `XCHAIN_CONFIRMATIONS_<COIN>`)
- **Per-chain-pair validators**: only validators supporting both chains participate in cross-chain attestation quorum
- **SWAP lifecycle tracking**: tracks cross-chain swaps through initiated → attested → executed → settled states
- **Reorg propagation**: cross-chain reorg detection with PBFT consensus, hub state rollback, and downstream notification
- **Governance**: off-chain PBFT voting for parameter changes with 7-day voting period, 2/3+ approval, 50% quorum
- **Reward tracking**: per-round XCHAIN rewards distributed equally among participating oracle validators
- **Slash detection**: price deviation (>5%), repeated deviation (3+ in 24h), and non-participation (30+ missed rounds) monitoring
- **Multi-instance**: multiple hub instances against shared MariaDB with consumer fallback via `HUB_VALIDATORS`
- **MariaDB storage**: 20 relational tables with connection pooling, circuit breaker, and exponential backoff
- **Single-node fallback**: all consensus-dependent operations fall back to direct execution when no peers are connected
- **2,400+ tests**: unit, integration, e2e, fuzz, chaos, boundary, smoke, regression, performance
- **Docker-ready**: Dockerfile for containerized deployment via xchain-node

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Subsystem design, source files, P2P gossip, PBFT consensus, oracle pipeline, cross-chain engine |
| [Configuration](CONFIGURATION.md) | Environment variables, standalone vs validator mode, database schema, connection pool |
| [API](API.md) | JSON-RPC method reference: config, validators, oracle, attestations, swaps, reorgs, governance |
| [Database](DATABASE.md) | Full schema reference: config, validators, oracle (price_snapshots, oracle_prices), attestations, governance |
| [Operations](OPERATIONS.md) | Running, Docker, validator key rotation, resilience, troubleshooting |
| [Decentralization](DECENTRALIZATION.md) | Evolution from centralized oracle to decentralized validator network (all phases complete) |

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/XChain-Platform/xchain-hub.git
cd xchain-hub
npm install
```

## Quick Start

### Standalone mode: config oracle only

Create a `.env` file with the required environment variables (see [Configuration](CONFIGURATION.md) for full details):

```env
HUB_HOST=0.0.0.0
HUB_PORT=10000
HUB_DB_HOST=127.0.0.1
HUB_DB_PORT=3306
HUB_DB_NAME=XChain_Hub
HUB_DB_USER=xchain
HUB_DB_PASS=password
```

Start the hub:

```bash
npm run api
```

The hub automatically creates the database and all tables on first startup. In standalone mode, config writes go directly to the database without consensus.

### Validator mode: P2P gossip, PBFT consensus, price oracle

Add P2P and oracle configuration to the `.env` file:

```env
HUB_HOST=0.0.0.0
HUB_PORT=10000
HUB_DB_HOST=127.0.0.1
HUB_DB_PORT=3306
HUB_DB_NAME=XChain_Hub
HUB_DB_USER=xchain
HUB_DB_PASS=password

P2P_VALIDATOR_ADDR=validator1.example.com
P2P_PORT=10001
SEED_NODES=validator2.example.com:10001,validator3.example.com:10001
SIGNING_PRIVKEY_HEX=your_64_hex_char_ed25519_private_key_seed

COINGECKO_API_KEY=your_api_key
COINMARKETCAP_API_KEY=your_api_key
```

Validator mode activates the full P2P gossip layer, PBFT consensus, price oracle rounds, cross-chain attestation, reorg propagation, governance, and reward/slash tracking.

## Service Discovery Pattern

Services that support hub-based config discovery call `getallconfigs` at startup and periodically (typically every 60 seconds) to pick up configuration changes without a restart. This allows operators to update connection strings, ports, or credentials through the hub rather than redeploying each service individually.

**Consumers:** xchain-explorer, xchain-indexer, xchain-node, xchain-e2e-test, xchain-sync, xchain-sdk.

## Multi-Instance Deployment

Multiple hub instances can run against the same MariaDB database for high availability. In validator mode, instances also form a P2P mesh for consensus.

Consumer services specify multiple hub endpoints via the `HUB_VALIDATORS` environment variable:

```env
HUB_VALIDATORS=hub1.local:10000,hub2.local:10000,hub3.local:10000
```

Consumers try each endpoint in order and fall back to the next if one is unreachable. If `HUB_VALIDATORS` is not set, consumers fall back to the legacy `HUB_API_HOST:HUB_PORT` variables.

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the hub API server |
| `npm test` | Run unit tests (1,800+ tests) |
| `npm run test:integration` | Integration tests (70+ tests, requires MariaDB) |
| `npm run test:e2e` | End-to-end tests (70+ tests, requires full stack) |
| `npm run test:fuzz` | Fuzz tests (property-based via fast-check) |
| `npm run test:chaos` | Chaos engineering tests |
| `npm run test:smoke` | Smoke tests (quick sanity check) |
| `npm run test:regression` | Regression tests (tagged across all suites) |
| `npm run test:regression:p0` | P0-priority regression tests |
| `npm run test:regression:p0p1` | P0+P1 regression tests |
| `npm run test:perf` | All performance tests |
| `npm run test:mutate` | Mutation tests (Stryker) |
| `npm run test:mutate:pilot` | Pilot mutation tests (phase 1) |
| `npm run test:all` | Complete test suite |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `axios` | HTTP client for external price API calls (CoinGecko, CoinMarketCap) |
| `express` | HTTP server for JSON-RPC API |
| `express-json-rpc-router` | JSON-RPC 2.0 routing for the API server |
| `geoip-lite` | Self-contained country/region lookup; derives coarse geo from connecting IPs at telemetry ingest (raw IP is never stored) |
| `helmet` | HTTP security headers |
| `cors` | Cross-origin resource sharing |
| `mariadb` | MariaDB connection pool for config, validator, oracle, and governance data |
| `mathjs` | Bignumber arithmetic (via `bcmath.js`) used across oracle consensus, DEX settlement, attestation, and quorum calculations |
| `ws` | WebSocket server/client for P2P gossip layer |
| `express-rate-limit` | API rate limiting |
| `dotenv` | `.env` file loading for environment-based configuration |

### Development

| Package | Purpose |
|---|---|
| `c8` | Code-coverage instrumentation; used by the `coverage` npm script |
| `mocha` | Test framework |
| `chai` | Assertion library |
| `sinon` | Mocking, stubbing, and spying for tests |
| `fast-check` | Property-based (fuzz) testing |
| `nock` | HTTP request mocking for tests |
| `proxyquire` | Module dependency injection for tests |
| `@stryker-mutator/core` | Mutation testing framework |
| `@stryker-mutator/mocha-runner` | Stryker Mocha integration |

## Related Documentation

- [Decentralization](DECENTRALIZATION.md): evolution of the hub toward a decentralized validator network
- [Cross-Chain Concepts](../../concepts/CROSS_CHAIN.md): how cross-chain swaps work at the protocol level
- [Configuration Guide](../../operations/CONFIGURATION.md): how to configure and manage hub parameters
- [xchain-sync](../sync/README.md): database replication service used by validators

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
