<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Node: Architecture

## Position in the Data Pipeline

xchain-node sits above all other XChain services. It does not participate in the data pipeline at runtime, instead, it provisions and manages the containers that form the pipeline:

```
                              ┌──────────────────────┐
                              │     xchain-node      │
                              │   (CLI orchestrator)  │
                              └──────────┬───────────┘
                                         │ installs / manages
              ┌────────────┬─────────────┼─────────────┬────────────┐
              ▼             ▼             ▼             ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Coin Node│ │ Decoder  │ │ Indexer  │ │ Explorer │ │   Hub    │
        │(bitcoind)│ │          │ │          │ │          │ │          │
        └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
              ▲             ▲             ▲             ▲            ▲
              │             │             │             │            │
              └─────────────┴─────────────┴─────────────┴────────────┘
                              Docker containers + networks
```

Each coin/network combination (e.g., bitcoin/regtest) gets its own Docker network. Shared services (database, hub, explorer) are connected to all coin/network networks.

## Internal Components

```
┌───────────────────────────────────────────────────────────────────────┐
│                           xchain-node                                 │
│                                                                       │
│  ┌─────────────┐    ┌────────────────────────────────────────────┐    │
│  │   cli.js     │    │          moduleOperations.js               │    │
│  │  Commander   │───►│  installModules / startModules /          │    │
│  │  21 commands │    │  stopModules / restartModules /            │    │
│  └─────────────┘    │  uninstallModules / resetModules           │    │
│         │            └──────────────┬────────────────────────────┘    │
│         │                           │                                 │
│  ┌──────▼──────┐         ┌─────────▼─────────┐                      │
│  │ precheck.js  │         │  ModuleService     │                      │
│  │ Docker check │         │  cloneGit()        │                      │
│  │ Dir creation │         │  buildAndUp()      │                      │
│  │ LevelDB open │         │  uninstallModule() │                      │
│  │ Version fetch│         └─────────┬─────────┘                      │
│  └──────────────┘                   │                                 │
│                          ┌──────────┼──────────┐                     │
│                          ▼          ▼          ▼                     │
│                   ┌────────┐ ┌──────────┐ ┌──────────┐               │
│                   │ Config │ │  Docker  │ │ Database │               │
│                   │Service │ │ Service  │ │ Service  │               │
│                   └────────┘ └──────────┘ └──────────┘               │
│                          ▲          ▲          ▲                     │
│                          │          │          │                     │
│                   ┌──────┴──┐ ┌─────┴────┐ ┌──┴───────┐             │
│                   │ Version │ │ Node     │ │ Bootstrap│             │
│                   │ Service │ │ Service  │ │ Service  │             │
│                   └─────────┘ └──────────┘ └──────────┘             │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  LevelUpDb   │  │  state.js    │  │  constants   │               │
│  │  MC key store│  │  singletons  │  │  enums/paths │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└───────────────────────────────────────────────────────────────────────┘
```

### Source Files

| File | Purpose |
|---|---|
| `src/index.js` | Entry point: loads dotenv, calls `parseCommand()` |
| `src/cli.js` | Commander.js CLI definitions (21 commands, global options, preAction hook) |
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

## Precheck Workflow

Every command runs `preCheck()` before execution:

1. Verify Docker is installed and accessible (`docker --version` + `docker ps`)
2. Create runtime directories: `data/`, `modules/`, `tmp/`, `tmp/containers_files/`
3. Open LevelDB database (`data/xchain_node/`)
4. Fetch remote service versions from GitHub (for install/update commands)
5. Query installed modules status from LevelDB + Docker inspect
6. Create base Docker network (`xchain-node`)
7. Install or update xchain-hub
8. Update hub and explorer configurations with current service endpoints

## LevelDB Key Schema

xchain-node uses a single LevelDB database to map installed modules to their Docker container IDs:

| Key Format | Example | Value |
|---|---|---|
| `MC{module};{coin};{network}` | `MCxchain-encoder;bitcoin;mainnet` | 64-char hex container ID |
| `MC{module};;` | `MCxchain-hub;;` | 64-char hex container ID (shared service) |

- `MC` prefix stands for "Module Container"
- Shared services (hub, explorer, database) use empty coin and network fields
- `getAllModuleContainers(coin, network)` always includes shared services in filtered results

## Runtime Directory Structure

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
│   └── ...  (9 files total, one per coin/network combo)
├── crypto_nodes/               # Crypto node Dockerfiles and configs
│   ├── bitcoin/
│   │   ├── Dockerfile
│   │   ├── bitcoin-mainnet.conf
│   │   ├── bitcoin-testnet.conf
│   │   └── bitcoin-regtest.conf
│   ├── dogecoin/
│   └── litecoin/
└── tmp/                        # Temporary files during install/update
    ├── xchain-*/               # Temporary clones for version checking
    └── containers_files/       # Staging area for docker cp operations
```

## Docker Network Topology

Each coin/network combination gets its own Docker network. Shared services are connected to all networks:

```
┌─ xchain-node-bitcoin-mainnet ───────────────────────────┐
│  encoder, decoder, utxo-tracker, indexer, node           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ database ├─┤   hub    ├─┤ explorer │ (shared, also  │
│  └──────────┘ └──────────┘ └──────────┘  connected to   │
└──────────────────────────────────────────  other nets)───┘

┌─ xchain-node-bitcoin-regtest ───────────────────────────┐
│  encoder, decoder, utxo-tracker, indexer, node,          │
│  regtest-miner                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ database ├─┤   hub    ├─┤ explorer │ (same shared   │
│  └──────────┘ └──────────┘ └──────────┘  containers)    │
└──────────────────────────────────────────────────────────┘
```

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
