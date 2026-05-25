<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Explorer

## What is xchain-explorer

xchain-explorer is the query and presentation layer of the XChain Platform. It reads from the Indexer database and exposes over 60 REST API endpoints, a JSON-RPC 2.0 interface, and a Bootstrap-based web block explorer — all from a single long-lived Node.js/Express process. The explorer never writes to any database.

The explorer is the primary integration point for wallets, exchanges, dApps, and any application that needs to query XChain state. Developers interact with the platform through the explorer's REST API (directly or via the xchain-sdk), making this the most externally-facing component of the stack.

## Features

- **Three interfaces** — REST API, JSON-RPC 2.0, and a web block explorer served from the same process
- **60+ REST endpoints** — tokens, balances, transactions, market data, DEX state, addresses, blocks, files, messages, and more
- **Multi-chain support** — Bitcoin, Litecoin, and Dogecoin on mainnet, testnet, and regtest (9 networks)
- **Read-only** — the explorer never writes to the Indexer database
- **Config discovery** — fetches configuration from xchain-hub on startup and refreshes every 60 seconds
- **SSL/TLS support** — serves both HTTP and HTTPS with configurable certificates
- **Rate limiting** — configurable request rate limiting (default 500 requests per minute)
- **CORS configuration** — allowed origins configurable per deployment
- **SSRF-protected relay** — proxy endpoint for external resources with private IP blocking
- **WebSocket API** — real-time event streaming via `/{COIN}/api/websocket` with channel subscriptions, action-type filtering, lifecycle events (ORDER_MATCH, COINPAY_REQUIRED, etc.), catch-up on reconnect, and snapshot-on-subscribe
- **Security headers** — Helmet middleware with Content Security Policy
- **Raw parameterized SQL** — approximately 5,800 lines of query logic with no ORM, preventing SQL injection
- **DataTables integration** — server-side pagination endpoints compatible with jQuery DataTables
- **Highcharts integration** — candlestick, market depth, and line charts in the web UI
- **Icon service** — serves token icons with automatic fallback to a default image
- **BigNumber precision** — all price and amount calculations use arbitrary-precision arithmetic via mathjs

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Data pipeline position, internal components, request processing pipeline, source files |
| [Configuration](CONFIGURATION.md) | Environment variables, config.json, hub discovery, SSL/TLS, CORS, rate limiting, coin config |
| [API Reference](API.md) | Complete REST API — all 60+ endpoints with paths, parameters, response formats, and examples |
| [WebSocket API](WEBSOCKET.md) | Real-time event streaming — connection, channels, subscriptions, filters, lifecycle events, catch-up |
| [Operations](OPERATIONS.md) | Running, Docker, SSL setup, security features, relay endpoint, troubleshooting |

## Installation

Clone the repository and install dependencies from within the `xchain-explorer` directory:

```bash
git clone https://github.com/XChain-Platform/xchain-explorer.git
cd xchain-explorer
npm install
```

## Quick Start

Create a `.env` file with the required environment variables (see [Configuration](CONFIGURATION.md) for full details):

```env
HUB_API_HOST=localhost
HUB_PORT=1984
EXPLORER_API_PORT_HTTP=8080
EXPLORER_API_PORT_HTTPS=8443
```

Or configure a local `src/config.json` with database connection details (see [Configuration](CONFIGURATION.md)).

Start the explorer:

```bash
npm run api
```

On startup, the explorer:
1. Loads environment variables and SSL certificates
2. Starts the Express server with security middleware (Helmet, CORS, rate limiting)
3. Registers the JSON-RPC router
4. Fetches configuration from xchain-hub (or falls back to local config.json)
5. Connects to the Indexer database(s)
6. Begins serving API requests and the web UI

### Querying the API

```bash
# Get token information
curl http://localhost:8080/BTC/api/token/MYTOKEN

# Get balances for an address
curl http://localhost:8080/BTC/api/balances/bc1qexampleaddress

# Get recent sends for an address
curl "http://localhost:8080/BTC/api/sends/bc1qexampleaddress/address?page=1&limit=25"

# Get DEX order book
curl http://localhost:8080/BTC/api/market/TOKENА/TOKENB/orderbook

# Get platform status
curl http://localhost:8080/BTC/api/status
```

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the explorer (HTTP + HTTPS servers) |
| `npm test` | Run unit tests |
| `npm run test:integration` | Integration tests (requires MariaDB with seed data) |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:boundary` | Boundary condition tests |
| `npm run test:smoke` | Smoke tests |
| `npm run test:security` | Security tests (SQL injection, SSRF, XSS prevention) |
| `npm run test:perf` | Performance tests |
| `npm run test:chaos` | Chaos engineering tests |
| `npm run test:mutation` | Mutation tests (StrykerJS) |
| `npm run test:regression` | Regression test suite (P0 + P1 + P2 tiers) |
| `npm run test:regression:p0` | Critical-path regression only (<1s) |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `express` | HTTP server for REST API, web UI, and JSON-RPC |
| `express-json-rpc-router` | JSON-RPC 2.0 request routing |
| `express-rate-limit` | Request rate limiting middleware |
| `helmet` | HTTP security headers and Content Security Policy |
| `cors` | Cross-Origin Resource Sharing |
| `dotenv` | Environment variable loading from `.env` files |
| `mariadb` | MariaDB client with connection pooling |
| `mathjs` | Arbitrary-precision arithmetic for token amounts and prices |
| `axios` | HTTP client for hub connectivity and relay proxy |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test framework |
| `chai` | Assertion library |
| `sinon` | Mocking, stubbing, and spying |
| `supertest` | HTTP assertion testing |
| `nock` | HTTP request mocking |
| `@stryker-mutator/core` | Mutation testing framework |

## Related

- [Indexer](../indexer/) — the service that produces the database the explorer reads
- [Indexer Database Schema](../indexer/DATABASE.md) — full schema reference for the underlying tables
- [Hub](../hub/) — config oracle the explorer polls for connection details
- [SDK](../sdk/) — developer SDK that wraps the explorer API with typed methods
- [SDK Explorer Reference](../sdk/EXPLORER.md) — SDK client documentation for these same endpoints

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
