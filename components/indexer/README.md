<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Indexer

## What is xchain-indexer

xchain-indexer is the state-processing engine of the XChain Platform. It reads decoded blockchain transactions from the Decoder database, validates and executes each ACTION according to protocol rules, maintains authoritative token state (balances, supplies, ownership, DEX orders, dispensers) in a separate MariaDB database, and makes that indexed data available for querying by xchain-explorer. The indexer runs as a long-lived Node.js process with an embedded Express JSON-RPC API server.

Every XChain ACTION; SEND, ISSUE, MINT, ORDER, DISPENSER, SWAP, ANCHOR, XCALL, SLASH, BET, and 38 more, passes through the indexer. The indexer determines whether the action is valid (checking balances, permissions, token rules, allow/block lists, sleep states), records the action with its status, updates the ledger (credits, debits, escrows), recalculates balances, and runs a sanity check after every block to guarantee consistency between token supplies and ledger totals.

## Features

- **48 record types processed by the indexer** (of which 35 are wire-decoded ACTIONs; the rest are derived/system rows such as ORDER_MATCH, DISPENSE, COLLECT, `*_EXPIRE`, UNKNOWN, XEXEC, and XCALL - see `concepts/ACTIONS.md` for the canonical wire-decoded count): ADDRESS, AIRDROP, ANCHOR, ATTEST, BATCH, BET, BET_EXPIRE, BROADCAST, CALLBACK, COINPAY, COINPAY_EXPIRE, COLLECT, CROSS_SETTLE, DELEGATE, DEPLOY, DEPOSIT, DESTROY, DISPENSE, DISPENSER, DISPENSER_CLOSE, DISPENSER_EXPIRE, DIVIDEND, EXECUTE, FILE, ISSUE, LINK, LIST, MESSAGE, MINT, NODEPROOF, ORDER, ORDER_EXPIRE, ORDER_MATCH, PRICE, SEND, SLASH, SLEEP, STAKE, SWAP, SWAP_EXPIRE, SWAP_MATCH, SWEEP, UNKNOWN, UNSTAKE, VOTE, WITHDRAW, XCALL, XEXEC
- **Multi-chain support**: Bitcoin, Litecoin, and Dogecoin on mainnet, testnet, and regtest
- **Atomic block processing**: every block is wrapped in a database transaction; failures roll back cleanly
- **Block reorganization handling**: detects reorgs from the Decoder DB, rolls back affected data, and re-indexes
- **Double-entry ledger**: all token movements recorded as credits, debits, and escrows
- **Sanity checking**: after every block, verifies token supplies match the sum of credits minus debits
- **DEX engine**: ORDER matching, SWAP matching, DISPENSER triggering with automatic expiration
- **Staking**: capability staking (STAKE v1/v2, UNSTAKE v0, DELEGATE v0/v2, COLLECT) is BTC-only; contract-targeted staking (STAKE v3, UNSTAKE v1, DELEGATE v1/v3) works on any chain
- **Virtual Machine**: DEPLOY, EXECUTE, DEPOSIT, WITHDRAW with isolated-vm sandbox and gas metering
- **Unified Gas Fee Schedule**: gas-based fee system for VM and staking actions, replaces per-action flat fees post-activation
- **Protocol versioning**: actions are gated by the indexer's own protocol version (21 at `0.1.0`, 15 at `0.2.0`, all with zero activation heights); block-height and timestamp flag-days gate behaviour changes to already-live actions, per network
- **Action mapping**: creates address↔ticker↔action_index cross-references for fast lookups
- **Circuit-breaker DB connections**: automatic failure detection and recovery for database connectivity
- **Watchdog timeout**: configurable per-block processing timeout detects deadlocks
- **5,571 tests** (measured 2026-07-27): unit, integration, e2e, fuzz, chaos, mutation, boundary, smoke, performance, regression

## Documentation

| Document | Description |
|---|---|
| [Architecture](architecture.md) | Data pipeline, internal components, action handlers, block processing pipeline |
| [Configuration](configuration.md) | Environment variables, coin-specific config, indexer constants |
| [Actions](actions.md) | All 48 record types, categories, format versions, protocol versioning |
| [Database](database.md) | Full schema reference: core, ledger, action, state, index, and mapping tables |
| [Ledger](ledger.md) | Double-entry ledger, balance calculation, sanity checks, gas token fees |
| [Operations](operations.md) | Running, Docker, API endpoints, resilience, troubleshooting |

## Installation

Clone the repository and install dependencies from within the `xchain-indexer` directory:

```bash
git clone https://github.com/XChain-Platform/xchain-indexer.git
cd xchain-indexer
npm install
```

## Quick Start

Create a `.env` file with the required environment variables (see [Configuration](configuration.md) for full details):

```env
DECODER_DB_HOST=127.0.0.1
DECODER_DB_PORT=3306
DECODER_DB_NAME=XChain_BTC_Mainnet_Decoder
DECODER_DB_USER=xchain_reader
DECODER_DB_PASS=your_password

INDEXER_DB_HOST=127.0.0.1
INDEXER_DB_PORT=3306
INDEXER_DB_NAME=XChain_BTC_Mainnet_Indexer
INDEXER_DB_USER=xchain_writer
INDEXER_DB_PASS=your_password

INDEXER_API_PORT=3004
INDEXER_COIN=BTC
INDEXER_NETWORK=mainnet
```

> **Optional: Hub database variables.** If `HUB_DB_HOST` and `HUB_DB_NAME` are not set, the indexer logs a `WARNING: HUB_DB_HOST / HUB_DB_NAME not set` message at startup and reads price/oracle tables from its own local database instead. This is correct for single-host deployments. On a distributed node where the hub runs on a separate host, set these variables (along with `HUB_DB_PORT`, `HUB_DB_USER`, `HUB_DB_PASS`) to avoid using stale or absent fee/price data. See [Configuration](configuration.md) for the full variable list.

Start the indexer:

```bash
npm run api
```

On startup, the indexer:
1. Validates all required environment variables
2. Starts the Express JSON-RPC API server
3. Verifies the Decoder database exists and probes its schema (tables must exist before block processing begins), then creates the Indexer database if it doesn't exist
4. Creates all required tables if they don't exist
5. Begins the block polling loop

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the indexer and API server |
| `npm test` | Run unit tests (4,977 tests) |
| `npm run test:integration` | Integration tests (213 tests, requires MariaDB) |
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

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
