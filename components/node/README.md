# XChain Platform Node

## What is xchain-node

xchain-node is the CLI management and orchestration tool for the XChain Platform. It installs, configures, and manages all XChain services — and optionally the underlying coin nodes — as Docker containers. Operators interact with the platform primarily through xchain-node rather than managing individual containers directly.

## Features

- **Installation wizard** — interactive setup that downloads and configures coin nodes (bitcoind, litecoind, dogecoind) and all XChain service containers
- **Docker orchestration** — creates, starts, stops, updates, and monitors all containers
- **Terminal UI (TUI)** — Blessed-based real-time dashboard showing status, logs, and resource usage for all running services
- **Auto-update** — fetches remote version manifests, compares against running versions, and updates containers with a single command
- **Pre-flight checks** — verifies Docker is installed and running, required directories exist, and network connectivity is available before attempting installation or startup
- **Multi-chain** — a single installation manages BTC, LTC, and DOGE simultaneously; each chain runs its own set of containers
- **State persistence** — LevelDB stores installation state, configured parameters, and container metadata

## Container Naming

All managed containers follow a consistent naming convention:

```
xchain-node-{service}-{coin}-{network}
```

Examples:

| Container name | Description |
|---|---|
| `xchain-node-decoder-btc-mainnet` | BTC mainnet decoder |
| `xchain-node-indexer-ltc-regtest` | LTC regtest indexer |
| `xchain-node-explorer-doge-testnet` | DOGE testnet explorer |
| `xchain-node-hub` | Hub (shared across all chains) |

## Commands

xchain-node is invoked from the command line:

```bash
xchain-node <command> [options]
```

Key commands:

| Command | Description |
|---|---|
| `install` | Run the interactive installation wizard |
| `start` | Start all configured containers (or a specific service) |
| `stop` | Stop all running containers (or a specific service) |
| `status` | Show the current status of all containers |
| `update` | Pull latest images and restart updated containers |
| `monitor` | Open the real-time Blessed TUI dashboard |
| `logs` | Stream logs from a specific container |
| `config` | View or update configuration parameters |

## Installation Wizard

The installation wizard guides the operator through:

1. **Pre-flight checks** — Docker version, available disk space, network connectivity
2. **Chain selection** — which chains and networks to run (BTC, LTC, DOGE; mainnet, testnet, regtest)
3. **Coin node configuration** — RPC credentials, data directories, pruning settings
4. **Service configuration** — ports, database credentials, hub URL
5. **Container creation** — pulls images, creates Docker volumes, starts containers in dependency order
6. **Health verification** — waits for each container to pass its health check before proceeding

Configuration collected during installation is stored in LevelDB and can be reviewed or updated with `xchain-node config`.

## Terminal UI

The `monitor` command opens a full-terminal Blessed dashboard with:

- Per-container status (running, stopped, error)
- Recent log output for each service
- Block height and sync progress for decoders and UTXO trackers
- Resource usage (CPU, memory) per container
- Keyboard shortcuts for restarting, stopping, or viewing full logs for any service

## Auto-Update

`xchain-node update` fetches a version manifest from a remote URL, compares each service's current image tag against the latest published tag, and for any service with an available update:

1. Pulls the new image
2. Stops the running container
3. Starts a new container with the updated image and the same configuration
4. Verifies the container passes its health check

Updates are applied one service at a time to minimize downtime.

## Storage

xchain-node stores its own state in a LevelDB directory (separate from the LevelDB used by xchain-hub and xchain-utxo-tracker). This includes installation state, configured parameters, and a record of managed containers.

## Installation

```bash
git clone https://github.com/XChain-platform/xchain-node.git
cd xchain-node
npm install
npm link   # makes xchain-node available as a global CLI command
```

## Related

- [Deployment Guide](../../operations/DEPLOYMENT.md) — step-by-step production deployment walkthrough
- [Docker Guide](../../operations/DOCKER.md) — Docker configuration details and volume management
