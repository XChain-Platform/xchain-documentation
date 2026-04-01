# XChain Platform Indexer

## What is xchain-indexer

xchain-indexer is the state-processing engine of the XChain Platform. It reads decoded blockchain transactions from the Decoder database, validates and executes each ACTION according to protocol rules, maintains authoritative token state (balances, supplies, ownership, DEX orders, dispensers) in a separate MariaDB database, and makes that indexed data available for querying by xchain-explorer. The indexer runs as a long-lived Node.js process with an embedded Express JSON-RPC API server.

Every XChain ACTION — SEND, ISSUE, MINT, ORDER, DISPENSER, SWAP, and 13 more — passes through the indexer. The indexer determines whether the action is valid (checking balances, permissions, token rules, allow/block lists, sleep states), records the action with its status, updates the ledger (credits, debits, escrows), recalculates balances, and runs a sanity check after every block to guarantee consistency between token supplies and ledger totals.

## Features

- **20 ACTION types** — ADDRESS, AIRDROP, BATCH, BROADCAST, CALLBACK, DESTROY, DISPENSER, DISPENSE, DIVIDEND, FILE, ISSUE, LINK, LIST, MESSAGE, MINT, ORDER, SEND, SLEEP, SWAP, SWEEP
- **Multi-chain support** — Bitcoin, Litecoin, and Dogecoin on mainnet, testnet, and regtest
- **Atomic block processing** — every block is wrapped in a database transaction; failures roll back cleanly
- **Block reorganization handling** — detects reorgs from the Decoder DB, rolls back affected data, and re-indexes
- **Double-entry ledger** — all token movements recorded as credits, debits, and escrows
- **Sanity checking** — after every block, verifies token supplies match the sum of credits minus debits
- **DEX engine** — ORDER matching, SWAP matching, DISPENSER triggering with automatic expiration
- **Protocol versioning** — actions activate at specific block heights or timestamps per network
- **Action mapping** — creates address↔ticker↔action_index cross-references for fast lookups
- **Circuit-breaker DB connections** — automatic failure detection and recovery for database connectivity
- **Watchdog timeout** — configurable per-block processing timeout detects deadlocks
- **958 tests** — unit, integration, e2e, fuzz, chaos, mutation, boundary, smoke, performance, regression

## Installation

Clone the repository and install dependencies from within the `xchain-indexer` directory:

```bash
git clone https://github.com/XChain-platform/xchain-indexer.git
cd xchain-indexer
npm install
```

## Quick Start

Create a `.env` file with the required environment variables (see [Configuration](CONFIGURATION.md) for full details):

```env
DECODER_DB_HOST=localhost
DECODER_DB_PORT=3306
DECODER_DB_NAME=XChain_BTC_Mainnet_Decoder
DECODER_DB_USER=xchain_reader
DECODER_DB_PASS=your_password

INDEXER_DB_HOST=localhost
INDEXER_DB_PORT=3306
INDEXER_DB_NAME=XChain_BTC_Mainnet_Indexer
INDEXER_DB_USER=xchain_writer
INDEXER_DB_PASS=your_password

INDEXER_API_PORT=3000
INDEXER_COIN=BTC
INDEXER_NETWORK=mainnet
```

Start the indexer:

```bash
npm run api
```

On startup, the indexer:
1. Validates all required environment variables
2. Starts the Express JSON-RPC API server
3. Creates the Indexer database if it doesn't exist
4. Creates all required tables if they don't exist
5. Begins the block polling loop

## Documentation Index

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Data pipeline, internal components, action handlers, block processing pipeline |
| [Configuration](CONFIGURATION.md) | Environment variables, coin-specific config, indexer constants |
| [Actions](ACTIONS.md) | All 20 ACTION types, categories, format versions, protocol versioning |
| [Database](DATABASE.md) | Full schema reference — core, ledger, action, state, index, and mapping tables |
| [Ledger](LEDGER.md) | Double-entry ledger, balance calculation, sanity checks, gas token fees |
| [Operations](OPERATIONS.md) | Running, Docker, API endpoints, resilience, troubleshooting |

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the indexer and API server |
| `npm test` | Run unit tests (~820 tests) |
| `npm run test:integration` | Integration tests (~929 tests, requires MariaDB) |
| `npm run test:e2e` | End-to-end tests (43 tests, requires full stack) |
| `npm run test:boundary` | Boundary condition tests |
| `npm run test:smoke` | Smoke tests (unit + connected) |
| `npm run test:security` | Security tests |
| `npm run test:fuzz` | Fuzz tests (property-based) |
| `npm run test:fuzz:quick` | Quick fuzz (1,000 iterations, tier1) |
| `npm run test:fuzz:full` | Full fuzz (10,000 iterations) |
| `npm run test:chaos` | Chaos engineering tests |
| `npm run test:mutation` | Mutation tests |
| `npm run test:mutation:tier1` | Tier1 mutation tests |
| `npm run test:mutation:report` | Mutation tests with coverage report |
| `npm run test:perf` | All performance tests |
| `npm run test:regression` | Regression tests (tagged across all suites) |
| `npm run test:regression:fast` | Fast regression (tier1 + tier4, unit only) |
| `npm run test:regression:full` | Full regression suite |
| `npm run test:nodb` | All tests that don't require a database |
| `npm run test:full` | Complete test suite |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `express` | HTTP server for the JSON-RPC API |
| `express-json-rpc-router` | JSON-RPC 2.0 request routing |
| `helmet` | HTTP security headers |
| `cors` | Cross-Origin Resource Sharing |
| `dotenv` | Environment variable loading from `.env` files |
| `mariadb` | MariaDB/MySQL client with connection pooling |
| `mathjs` | Arbitrary-precision arithmetic for token amounts and fees |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test framework |
| `sinon` | Mocking, stubbing, and spying for tests |
| `fast-check` | Property-based (fuzz) testing |
