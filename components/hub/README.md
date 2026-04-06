<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Hub

## What is xchain-hub

xchain-hub is the configuration oracle and cross-chain coordinator of the XChain Platform. It runs as a long-lived Node.js/Express process backed by MariaDB and serves a JSON-RPC API that all other services poll for shared configuration, endpoint discovery, pricing data, and cross-chain action coordination.

One hub instance serves the entire deployment — all chains (BTC, LTC, DOGE) and all networks share the same process and database.

## Features

- **Config store** — JSON-RPC API for service configuration parameters used by all platform services
- **Service discovery** — other services poll the hub to find hostnames, ports, and connection details for their dependencies
- **MariaDB storage** — relational config storage with upsert semantics, connection pooling, and circuit breaker
- **Fiat pricing** (planned) — current cryptocurrency price data for BTC, LTC, and DOGE via decentralized oracle
- **Cross-chain coordination** (planned) — SWAP matching across different blockchains via PBFT-attested validator consensus

## Database Schema

Configuration parameters are stored in the `configs` table in a MariaDB database (`XChain_Hub`):

| Column | Type | Description |
|---|---|---|
| `coin` | VARCHAR(16) | Coin identifier (BTC, LTC, DOGE) |
| `network` | VARCHAR(16) | Network (mainnet, testnet, regtest) |
| `module` | VARCHAR(64) | Service name (xchain-decoder, xchain-indexer, etc.) |
| `param_name` | VARCHAR(32) | Parameter name (host, port, db_host, etc.) |
| `param_value` | TEXT | Parameter value |
| `updated_at` | TIMESTAMP | Last update timestamp |

The table has a unique constraint on `(coin, network, module, param_name)` for upsert behavior.

## API

The hub exposes a JSON-RPC API over HTTP. Current methods:

| Method | Description |
|---|---|
| `ping` | Health check — returns `{status: "success"}` |
| `getallconfigs` | Return all config parameters as a nested object: `{coin: {network: {module: {param: value}}}}` |
| `updateconfig` | Upsert config parameters from a nested JSON object |

Planned methods (decentralization phases):

| Method | Description |
|---|---|
| `getPrice` | Return current price for a coin pair from the decentralized oracle |
| `getFeeQuote` | Calculate native coin fee amount for a given action |
| `getPriceSnapshots` | Return finalized price snapshots for a range of oracle rounds |

## Service Discovery Pattern

Services that support hub-based config discovery call `getallconfigs` at startup and periodically (typically every 60 seconds) to pick up configuration changes without a restart. This allows operators to update connection strings, ports, or credentials through the hub rather than redeploying each service individually.

**Consumers:** xchain-explorer, xchain-node, xchain-e2e-test, xchain-indexer-sync.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_HOST` | No | `0.0.0.0` | Host to bind the API server |
| `HUB_PORT` | Yes | — | Port for the JSON-RPC API |
| `HUB_DB_HOST` | Yes | — | MariaDB host |
| `HUB_DB_PORT` | Yes | — | MariaDB port |
| `HUB_DB_NAME` | Yes | — | MariaDB database name (e.g., `XChain_Hub`) |
| `HUB_DB_USER` | Yes | — | MariaDB username |
| `HUB_DB_PASS` | Yes | — | MariaDB password |

## Installation

```bash
git clone https://github.com/XChain-platform/xchain-hub.git
cd xchain-hub
npm install
# Create .env with the variables above
npm run api
```

The hub automatically creates the database and tables on first startup.

## Multi-Instance Deployment

Multiple hub instances can run against the same MariaDB database for high availability. No consensus is required — all instances read from and write to the same database.

Consumer services specify multiple hub endpoints via the `HUB_VALIDATORS` environment variable:

```env
HUB_VALIDATORS=hub1.local:10000,hub2.local:10000,hub3.local:10000
```

Consumers try each endpoint in order and fall back to the next if one is unreachable. If `HUB_VALIDATORS` is not set, consumers fall back to the legacy `HUB_API_HOST:HUB_PORT` variables.

Services that support `HUB_VALIDATORS`: xchain-explorer, xchain-indexer-sync, xchain-node, xchain-e2e-test, xchain-sdk.

## Related

- [Decentralization](DECENTRALIZATION.md) — planned evolution of the hub toward a decentralized validator network
- [Cross-Chain Concepts](../../concepts/CROSS_CHAIN.md) — how cross-chain swaps work at the protocol level
- [Configuration Guide](../../operations/CONFIGURATION.md) — how to configure and manage hub parameters

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
