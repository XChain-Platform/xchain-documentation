<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Node

## What is xchain-node

xchain-node is the CLI management and orchestration tool for the XChain Platform. It installs, configures, and manages all XChain services — and the underlying coin nodes (bitcoind, litecoind, dogecoind) — as Docker containers. Operators interact with the platform primarily through xchain-node rather than managing individual containers directly.

Unlike other XChain services that run as long-lived processes, xchain-node is a command-line tool invoked on demand. It stores installation state in LevelDB and generates per-service Docker environment variables from a two-layer configuration system (hardcoded defaults + config file overrides).

## Features

- **Multi-chain orchestration** — a single installation manages Bitcoin, Litecoin, and Dogecoin simultaneously across mainnet, testnet, and regtest networks; each chain/network gets its own set of containers and Docker network
- **Order-independent argument parsing** — CLI arguments can be provided in any order; xchain-node auto-classifies each as service, coin, network, or branch name
- **Docker container lifecycle** — install, start, stop, restart, update, uninstall, and reset services with single commands
- **Configuration generation** — two-layer system merges hardcoded defaults with per-coin/network config file overrides; generates 40+ environment variables per service including ports, database credentials, and service URLs
- **Crypto node management** — downloads and builds Bitcoin Core, Litecoin, and Dogecoin binaries from official sources with SHA-256 hash verification
- **Database orchestration** — provisions a shared MariaDB container, creates per-service databases and users, and manages subnet-based access permissions
- **Bootstrap snapshots** — create and restore gzipped snapshots of UTXO tracker LevelDB, decoder, and indexer databases with SHA-256 integrity verification
- **Multi-pane log monitoring** — Blessed-based terminal UI displays live log output from up to 6 containers simultaneously in a split-screen layout
- **Pre-flight checks** — verifies Docker is installed and running, creates required directories, opens LevelDB, fetches remote version manifests, and creates Docker networks before any operation
- **State persistence** — LevelDB maps each installed module to its 64-character Docker container ID using composite keys (`MC{module};{coin};{network}`)
- **Hub and explorer auto-management** — automatically installs, updates, and configures the shared xchain-hub and xchain-explorer services as part of any installation
- **Container ID validation** — enforces `/^[a-f0-9]{64}$/` regex on all container IDs returned by Docker to prevent injection
- **Branch name validation** — enforces `/^[a-zA-Z0-9._\-\/]+$/` regex on all branch inputs to prevent shell injection
- **Port validation** — strict integer validation (1–65535) on all port values before they reach Docker command construction
- **execFile security** — all child process calls use `execFile` with array arguments instead of `exec` with shell strings, eliminating shell injection as a vulnerability class
- **1,148 tests** — unit, integration, e2e, smoke, fuzz, chaos, mutation, performance, and regression testing

## Commands

xchain-node is invoked from the command line:

```bash
xchain_node <command> [service] [chain] [network] [options]
```

Arguments are order-independent — `xchain_node start bitcoin mainnet xchain-encoder` and `xchain_node start xchain-encoder mainnet bitcoin` are equivalent.

### Service Management

| Command | Syntax | Description |
|---|---|---|
| `install` | `install <branch> <service> [chain] [network]` | Clone service repo, build Docker image, create and start container |
| `uninstall` | `uninstall <service> [chain] [network]` | Stop, kill, and remove container; delete LevelDB entry and module directory |
| `update` | `update <service> [chain] [network] [branch]` | Stop container, pull new code, rebuild image, start with same configuration |
| `start` | `start <service> [chain] [network]` | Start stopped container(s) by looking up container IDs from LevelDB |
| `stop` | `stop <service> [chain] [network]` | Stop running container(s) |
| `restart` | `restart <service> [chain] [network]` | Restart container(s) |
| `reset` | `reset <service> <chain> <network>` | Stop containers, clear data (volumes or databases), restart |
| `ps` | `ps` | Display status table of all installed services with versions and ports |

### Logging & Monitoring

| Command | Syntax | Description |
|---|---|---|
| `tail` | `tail [service] [chain] [network]` | Follow log output (like `docker logs -f`) with 10-line buffer |
| `logs` | `logs [service] [chain] [network]` | Display full log history |
| `monitor` | `monitor [service] [chain] [network]` | Split-screen Blessed TUI showing logs from up to 6 containers |
| `tailmonitor` | `tailmonitor [service] [chain] [network]` | Monitor with follow mode |

### Container Operations

| Command | Syntax | Description |
|---|---|---|
| `exec` | `exec <service> <chain> <network> <command>` | Execute a command inside a running container |
| `shell` | `shell <service> <chain> <network>` | Open an interactive shell in a container |

### Advanced Operations

| Command | Syntax | Description |
|---|---|---|
| `bootstrap` | `bootstrap <create\|restore> <service> <chain> <network>` | Create or restore gzipped bootstrap snapshots with SHA-256 verification |
| `e2etest` | `e2etest <chain> [testName]` | Run the xchain-e2e-test suite on a regtest network; supports `--grep` filtering |
| `rollback` | `rollback <block_index> <service> <chain> <network>` | Rollback to a specific block (placeholder — not yet implemented) |

### Global Options

| Option | Description |
|---|---|
| `-v, --verbose` | Print pre-check progress and additional debug output |
| `-i, --interactive` | Enable interactive TUI mode |
| `--no-bootstrap` | Skip bootstrap file downloads during installation |
| `--no-explorer` | Skip explorer installation |
| `-V, --version` | Display xchain-node version |

### Parameters

| Parameter | Valid Values |
|---|---|
| `service` | `node`, `xchain-encoder`, `xchain-decoder`, `xchain-utxo-tracker`, `xchain-indexer`, `xchain-hub`, `xchain-explorer`, `database`, `all` |
| `chain` | `bitcoin`, `litecoin`, `dogecoin`, `all` |
| `network` | `mainnet`, `testnet`, `regtest`, `all` |

When `all` is used, the command expands to every valid combination. Regtest-only services (`xchain-regtest-miner`, `xchain-e2e-test`) are automatically excluded from mainnet and testnet expansions.

## Configuration

### Config File System

xchain-node uses a two-layer configuration system:

1. **Hardcoded defaults** — defined in `ConfigService.js` for each module type
2. **Config file overrides** — read from `config/{coin}-{network}` files in `KEY=VALUE` format

Config files are plain text with one variable per line. Values containing `=` (such as base64 tokens) are handled correctly — only the first `=` on each line is treated as the separator. Blank lines and lines without `=` are skipped.

Example `config/bitcoin-mainnet`:

```
NODE_EXPOSED_PORT=8333
DUST_AMOUNT=546
```

### Generated Environment Variables

For each coin-specific service, xchain-node generates 40+ environment variables:

| Variable | Default | Description |
|---|---|---|
| `NETWORK` | `{network}` | Network identifier (mainnet, testnet, regtest) |
| `NODE_URL` | `node` | Coin node Docker hostname |
| `NODE_PORT` | 8332 / 18332 / 18444 | Coin node RPC port (per network) |
| `NODE_USER` | `rpc` | Coin node RPC username |
| `NODE_PASSWORD` | `rpc` | Coin node RPC password |
| `UTXO_TRACKER_URL` | `xchain-node-{coin}-{network}-xchain-utxo-tracker` | UTXO tracker Docker hostname |
| `UTXO_TRACKER_API_PORT` | `3001` | UTXO tracker API port |
| `DECODER_DB_NAME` | `XChain_{TICKER}_{Network}_Decoder` | Decoder database name |
| `DECODER_DB_HOST` | `mariadb` | MariaDB Docker hostname |
| `DECODER_DB_PORT` | `3306` | MariaDB port |
| `DECODER_DB_USER` | `xchain_decoder_{coin}_{network}` | Decoder DB username |
| `ENCODER_API_PORT` | `3003` | Encoder API port |
| `INDEXER_API_PORT` | `3004` | Indexer API port |
| `INDEXER_COIN` | `BTC` / `DOGE` / `LTC` | Coin ticker symbol |
| `INDEXER_DB_NAME` | `XChain_{TICKER}_{Network}_Indexer` | Indexer database name |
| `HUB_PORT` | `10000` | Hub API port |
| `REGTEST_MINER_API_PORT` | `3005` | Regtest miner port (regtest only) |

For shared services (hub, explorer, indexer-sync), a separate set of variables is generated without coin/network-specific values.

### Naming Conventions

| Entity | Pattern | Example |
|---|---|---|
| Docker image | `xchain-node-{coin}-{network}-{service}` | `xchain-node-bitcoin-mainnet-xchain-encoder` |
| Docker network | `xchain-node-{coin}-{network}` | `xchain-node-bitcoin-mainnet` |
| Database name | `XChain_{TICKER}_{Network}_{Service}` | `XChain_BTC_Mainnet_Decoder` |
| Database user | `xchain_{service}_{coin}_{network}` | `xchain_decoder_bitcoin_mainnet` |
| LevelDB key | `MC{module};{coin};{network}` | `MCxchain-encoder;bitcoin;mainnet` |
| Shared services | `xchain-node-{service}` (no coin/network) | `xchain-node-database` |

### Internal Constants

| Constant | Value | Location | Description |
|---|---|---|---|
| `NODE_PREFIX` | `xchain-node` | constants.js | Prefix for all Docker container and network names |
| `SEP` | `-` | constants.js | Separator for Docker naming |
| `DB_SEP` | `_` | constants.js | Separator for database naming |
| `DB_NAME` | `xchain_node` | constants.js | LevelDB database directory name |

## Architecture

```
                              ┌──────────────────────┐
                              │     xchain-node      │
                              │    CLI + Orchestrator │
                              └──────────┬───────────┘
                                         │
              ┌──────────────────────────┬┴──────────────────────────┐
              │                          │                           │
    ┌─────────▼─────────┐    ┌───────────▼──────────┐    ┌──────────▼──────────┐
    │   ConfigService    │    │   ModuleService      │    │   DockerService     │
    │  - resolveArgs()   │    │  - cloneGit()        │    │  - buildAndUp()     │
    │  - getDefaultConfig│    │  - buildAndUp()      │    │  - start/stop/kill  │
    │  - filterParams()  │    │  - uninstallModule() │    │  - exec/shell       │
    │  - validatePort()  │    │  - getModuleBranch() │    │  - logContainer()   │
    └───────────────────┘    └──────────────────────┘    │  - startMonitor()   │
                                                          └─────────────────────┘
              ┌──────────────────────────┬──────────────────────────┐
              │                          │                          │
    ┌─────────▼─────────┐    ┌───────────▼──────────┐    ┌─────────▼──────────┐
    │  DatabaseService   │    │   NodeService        │    │  BootstrapService  │
    │  - buildDatabase() │    │  - getCryptoNode()   │    │  - create/restore  │
    │  - setDbParams()   │    │  - buildCryptoNode() │    │  - SHA-256 verify  │
    │  - addUser()       │    │  - downloadNode()    │    │  - tar.gz archive  │
    └───────────────────┘    └──────────────────────┘    └──────────────────────┘

              ┌──────────────────────────┬──────────────────────────┐
              │                          │                          │
    ┌─────────▼─────────┐    ┌───────────▼──────────┐    ┌─────────▼──────────┐
    │   StatusService    │    │   VersionService     │    │   HubService       │
    │  - getStatus()     │    │  - checkRemoteVer()  │    │  - installHub()    │
    │  - formatTable()   │    │  - getLocalVer()     │    │  - updateHub()     │
    └───────────────────┘    │  - getContainerVer() │    │  - updateConfig()  │
                              └──────────────────────┘    └──────────────────────┘
```

### Source Files

| File | Purpose |
|---|---|
| `src/index.js` | Entry point — loads dotenv, calls `parseCommand()` |
| `src/cli.js` | Commander.js CLI definitions (17 commands, global options, preAction hook) |
| `src/precheck.js` | Pre-command validation (Docker, directories, LevelDB, versions, networks) |
| `src/state.js` | Singleton state (LevelDB instance, cached modules, verbose flag) |
| `src/LevelUpDb.js` | LevelDB wrapper for module→container ID persistence |
| `src/config/constants.js` | Enums (Coin, Network, XChainService), paths, git URLs |
| `src/services/ConfigService.js` | Path/naming helpers, config generation, arg parsing, port validation |
| `src/services/DockerService.js` | Docker CLI wrappers (network, build, run, start, stop, exec, logs, monitor) |
| `src/services/ModuleService.js` | Git clone, Docker build/run, install/uninstall/update flows |
| `src/services/DatabaseService.js` | MariaDB container setup, user/password management, database creation |
| `src/services/StatusService.js` | Container status queries, version display, formatted table output |
| `src/services/VersionService.js` | Local/remote/container version checking via GitHub API |
| `src/services/NodeService.js` | Crypto node download and Docker image building |
| `src/services/HubService.js` | Hub installation, update, and JSON-RPC configuration |
| `src/services/ExplorerService.js` | Explorer installation and configuration |
| `src/services/BootstrapService.js` | Bootstrap snapshot create/restore with SHA-256 verification |
| `src/operations/moduleOperations.js` | Bulk operations (install/start/stop/restart/reset/exec/logs/monitor) |
| `src/HubConnector.js` | JSON-RPC 2.0 client for xchain-hub |
| `src/ExplorerConnector.js` | JSON-RPC 2.0 client for xchain-explorer |
| `src/GitHubDownloader.js` | GitHub release download with SHA-256 hash verification |
| `src/utils/helpers.js` | Utilities (sleep, stringToCoin, decompressTarGz) |

### Runtime Directory Structure

```
xchain-node/
├── modules/                    # Cloned XChain service repositories
│   ├── xchain-encoder/
│   ├── xchain-decoder/
│   ├── xchain-utxo-tracker/
│   ├── xchain-indexer/
│   ├── xchain-hub/
│   ├── xchain-explorer/
│   ├── xchain-regtest-miner/
│   └── xchain-e2e-test/
├── data/
│   ├── xchain_node/            # LevelDB (module→container ID mappings)
│   └── node/{coin}/{network}/  # Crypto node blockchain data
├── config/                     # Per-coin/network config overrides
│   ├── bitcoin-mainnet
│   ├── bitcoin-testnet
│   ├── bitcoin-regtest
│   ├── dogecoin-mainnet
│   └── ...
├── crypto_nodes/               # Crypto node Dockerfiles and configs
│   ├── bitcoin/
│   ├── dogecoin/
│   └── litecoin/
└── tmp/                        # Temporary files during install/update
```

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/XChain-platform/xchain-node.git
cd xchain-node
npm install
npm link   # makes xchain_node available as a global CLI command
```

## Quick Start

Install all services for Bitcoin regtest:

```bash
xchain_node install master all bitcoin regtest
```

Check status:

```bash
xchain_node ps
```

Start/stop services:

```bash
xchain_node stop all bitcoin regtest
xchain_node start all bitcoin regtest
```

Monitor logs:

```bash
xchain_node tail xchain-decoder bitcoin regtest
xchain_node monitor all bitcoin regtest
```

Execute a command inside a container:

```bash
xchain_node exec xchain-decoder bitcoin regtest "ls -la"
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
| `npm run test:regression` | Regression tests (60 tests, 10s timeout) |
| `npm run test:regression:p0` | Regression P0 — critical gate (28 tests) |
| `npm run test:regression:p0p1` | Regression P0+P1 — standard gate (52 tests) |
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
| `levelup` | LevelDB high-level interface |
| `leveldown` | LevelDB native bindings |
| `mariadb` | MariaDB/MySQL client for database provisioning |
| `semver` | Semantic version comparison for update detection |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test framework |
| `chai` | Assertion library |
| `sinon` | Mocking, stubbing, and spying |
| `proxyquire` | Module dependency injection for testing |
| `memdown` | In-memory LevelDB backend for tests |
| `@stryker-mutator/core` | Mutation testing framework |
| `@stryker-mutator/mocha-runner` | Mocha integration for Stryker |

## Related

- [Deployment Guide](../../operations/DEPLOYMENT.md) — step-by-step production deployment walkthrough
- [Docker Guide](../../operations/DOCKER.md) — Docker configuration details and volume management
- [Data Pipeline](../../architecture/DATA_PIPELINE.md) — how services connect in the full platform flow
- [Encoder](../encoder/) — constructs XChain transactions (depends on xchain-node for deployment)
- [Decoder](../decoder/) — decodes mined blocks (depends on xchain-node for deployment)
- [Regtest Miner](../regtest-miner/) — auto-mines blocks in regtest (managed by xchain-node)

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
