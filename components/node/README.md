<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Node

## What is xchain-node

xchain-node is the CLI management and orchestration tool for the XChain Platform. It installs, configures, and manages all XChain services (and the underlying coin nodes (bitcoind, litecoind, dogecoind)) as Docker containers. Operators interact with the platform primarily through xchain-node rather than managing individual containers directly.

Unlike other XChain services that run as long-lived processes, xchain-node is a command-line tool invoked on demand. It stores installation state in a shared MariaDB database and generates per-service Docker environment variables from a two-layer configuration system (hardcoded defaults + config file overrides).

## Features

- **Multi-chain orchestration**: a single installation manages Bitcoin, Litecoin, and Dogecoin simultaneously across mainnet, testnet, and regtest networks; each chain/network gets its own set of containers and Docker network
- **Order-independent argument parsing**: CLI arguments can be provided in any order; xchain-node auto-classifies each as service, coin, network, or branch name
- **Docker container lifecycle**: install, start, stop, restart, update, uninstall, and reset services with single commands
- **Configuration generation**: two-layer system merges hardcoded defaults with per-coin/network config file overrides; generates 40+ environment variables per service including ports, database credentials, and service URLs
- **Crypto node management**: downloads and builds Bitcoin Core, Litecoin, and Dogecoin binaries from official sources with SHA-256 hash verification
- **Database orchestration**: provisions a shared MariaDB container, creates per-service databases and users, and manages subnet-based access permissions
- **Bootstrap snapshots**: create and restore gzipped snapshots of UTXO tracker data, decoder, and indexer databases with SHA-256 integrity verification
- **Multi-pane log monitoring**: Blessed-based terminal UI displays live log output from up to 6 containers simultaneously in a split-screen layout
- **Pre-flight checks**: verifies Docker is installed and running, creates required directories, opens a MariaDB connection, fetches remote version manifests, and creates Docker networks before any operation
- **State persistence**: MariaDB maps each installed module to its Docker container ID in the `xchain_node.modules` table, keyed by `(module, coin, network)`
- **Hub and explorer auto-management**: automatically installs, updates, and configures the shared xchain-hub and xchain-explorer services as part of any installation
- **execFile security**: all child process calls use `execFile` with array arguments instead of `exec` with shell strings, eliminating shell injection as a vulnerability class
- **Input validation**: branch name, port, and container ID validation with strict regex enforcement
- **1,148 tests**: unit, integration, e2e, smoke, fuzz, chaos, mutation, performance, and regression testing

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Data pipeline position, internal components, source files, runtime directory structure |
| [Configuration](CONFIGURATION.md) | Config file system, generated environment variables, naming conventions, internal constants |
| [Operations](OPERATIONS.md) | CLI commands reference, global options, parameters, troubleshooting |

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/XChain-Platform/xchain-node.git
cd xchain-node
npm install
npm link   # makes xchain-node available as a global CLI command
```

## Quick Start

Install all services for Bitcoin regtest:

```bash
xchain-node install master all bitcoin regtest
```

Check status:

```bash
xchain-node ps
```

Start/stop services:

```bash
xchain-node stop all bitcoin regtest
xchain-node start all bitcoin regtest
```

Monitor logs:

```bash
xchain-node tail xchain-decoder bitcoin regtest
xchain-node monitor all bitcoin regtest
```

## Scripts

| Command | Description |
|---|---|
| `npm test` | Unit tests (373 tests) |
| `npm run test:integration` | Integration tests (103 tests, 30s timeout) |
| `npm run test:smoke` | Smoke tests (159 tests, 5s timeout) |
| `npm run test:e2e` | End-to-end tests (57 tests, 30s timeout) |
| `npm run test:fuzz` | Fuzz tests (256 tests, 10s timeout) |
| `npm run test:chaos` | Chaos engineering tests (140 tests, 15s timeout) |
| `npm run test:boundary` | Boundary tests (10s timeout) |
| `npm run test:security` | Security tests (10s timeout) |
| `npm run test:regression` | Regression tests (60 tests, 10s timeout) |
| `npm run test:regression:p0` | Regression P0: critical gate (28 tests) |
| `npm run test:regression:p0p1` | Regression P0+P1: standard gate (52 tests) |
| `npm run test:mutation` | Mutation testing (Stryker Mutator, full) |
| `npm run test:mutation:config` | Mutation testing (ConfigService pilot) |
| `npm run test:all` | All tests (~1,148 tests) |
| `npm run benchmark` | Performance benchmarks (6 scenarios) |
| `npm run benchmark:quick` | Quick benchmarks |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `commander` | CLI argument parsing and command registration |
| `axios` | HTTP client for GitHub API and JSON-RPC calls |
| `blessed` | Terminal UI framework for multi-pane log monitoring |
| `chalk` | Terminal color output |
| `dotenv` | Environment variable loading from `.env` files |
| `enquirer` | Interactive prompts (password entry, confirmations) |
| `follow-redirects` | HTTP redirect handling for crypto node downloads |
| `mariadb` | MariaDB client for database provisioning and module state storage |
| `semver` | Semantic version comparison for update detection |

### Development

| Package | Purpose |
|---|---|
| `c8` | Code coverage (V8-native; run via `npm run coverage`) |
| `mocha` | Test framework |
| `chai` | Assertion library |
| `sinon` | Mocking, stubbing, and spying |
| `proxyquire` | Module dependency injection for testing |
| `@stryker-mutator/core` | Mutation testing framework |
| `@stryker-mutator/mocha-runner` | Mocha integration for Stryker |

## Related

- [Deployment Guide](../../operations/DEPLOYMENT.md): step-by-step production deployment walkthrough
- [Docker Guide](../../operations/DOCKER.md): Docker configuration details and volume management
- [Data Pipeline](../../architecture/Data_Pipeline.md): how services connect in the full platform flow
- [Encoder](../encoder/): constructs XChain transactions (depends on xchain-node for deployment)
- [Decoder](../decoder/): decodes mined blocks (depends on xchain-node for deployment)
- [Regtest Miner](../regtest-miner/): auto-mines blocks in regtest (managed by xchain-node)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
