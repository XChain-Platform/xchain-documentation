# XChain Platform Hub

## What is xchain-hub

xchain-hub is the configuration oracle and cross-chain coordinator of the XChain Platform. It runs as a long-lived Node.js/Express process backed by a single LevelDB instance and serves a JSON-RPC API that all other services poll for shared configuration, endpoint discovery, pricing data, and cross-chain action coordination.

One hub instance serves the entire deployment — all chains (BTC, LTC, DOGE) and all networks share the same process and storage.

## Features

- **Config store** — JSON-RPC CRUD API for key-value configuration parameters used by all services
- **Service discovery** — other services poll the hub to find hostnames, ports, and connection details for their dependencies
- **Fiat pricing** — current cryptocurrency price data for BTC, LTC, and DOGE in supported fiat currencies
- **Cross-chain coordination** — SWAP matching across different blockchains; hub tracks pending cross-chain actions and notifies the relevant indexers
- **Single instance** — one LevelDB database serves all chains and networks simultaneously
- **LevelDB storage** — no SQL dependencies; all data lives in a single embedded key-value store

## Key Schema

Configuration parameters are stored using a structured key format:

```
P:{coin}-{network}-{module}:{paramName}
```

Examples:

| Key | Description |
|---|---|
| `P:BTC-mainnet-decoder:rpcHost` | RPC host for the BTC mainnet decoder |
| `P:LTC-regtest-explorer:port` | Port for the LTC regtest explorer |
| `P:DOGE-testnet-indexer:dbHost` | Database host for the DOGE testnet indexer |

This structure allows `getAllConfig()` to return all parameters for a given coin-network-module triplet in a single call, which is the most common access pattern.

## API

The hub exposes a JSON-RPC API. Core methods:

| Method | Description |
|---|---|
| `getAllConfig` | Return all parameters for a given coin, network, and module |
| `getParam` | Return a single parameter value by key |
| `setParam` | Set a parameter value |
| `deleteParam` | Delete a parameter |
| `getPrice` | Return current fiat price for a coin |
| `setPrice` | Update fiat price data (called by price feed integrations) |
| `getSwapQueue` | Return pending cross-chain SWAP actions |
| `submitSwap` | Submit a cross-chain SWAP for coordination |

## Service Discovery Pattern

Services that support hub-based config discovery call `getAllConfig()` at startup and periodically (typically every 60 seconds) to pick up configuration changes without a restart. This allows operators to update connection strings, ports, or credentials through the hub rather than redeploying each service individually.

Services that do not support hub discovery (or in single-chain deployments) can fall back to a local `config.json` file.

## Cross-Chain Coordination

The SWAP action allows tokens on different blockchains to be exchanged trustlessly. Because the blockchains are independent, an intermediary is needed to match swap intents across chains and signal each chain's indexer when a matching pair is found. The hub fulfills this role in the current architecture.

See [Decentralization](DECENTRALIZATION.md) for the planned evolution of this coordination mechanism.

## Storage

All data is stored in a single LevelDB directory. LevelDB is an embedded key-value store — there is no separate database process. The LevelDB path is configurable.

## Configuration

| Parameter | Description |
|---|---|
| `port` | JSON-RPC API port |
| `dbPath` | Path to the LevelDB data directory |

## Installation

Clone the repository and install dependencies from within the `xchain-hub` directory:

```bash
git clone https://github.com/XChain-platform/xchain-hub.git
cd xchain-hub
npm install
npm run api
```

## Related

- [Decentralization](DECENTRALIZATION.md) — planned evolution of the hub toward a decentralized model
- [Cross-Chain Concepts](../../concepts/CROSS_CHAIN.md) — how cross-chain swaps work at the protocol level
- [Configuration Guide](../../operations/CONFIGURATION.md) — how to configure and manage hub parameters
