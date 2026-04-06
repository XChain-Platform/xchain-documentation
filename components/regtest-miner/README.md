<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Regtest Miner

## What is xchain-regtest-miner

xchain-regtest-miner is an auto-mining service for XChain Platform regtest development environments. In regtest mode, Bitcoin-family coin nodes (bitcoind, litecoind, dogecoind) do not mine blocks automatically — developers must mine manually via `generatetoaddress` or script the calls themselves. The regtest miner eliminates this friction by polling the mempool every second and mining blocks automatically whenever transactions are detected.

The miner uses an adaptive dual-timer system: when the first unconfirmed transaction appears, a 30-second max timer starts; each additional transaction resets a 5-second extension timer. Mining triggers when either timer expires. This batching strategy groups related transactions — such as a P2SH fund transaction and its corresponding spend — into the same block, which is important for correct platform behavior since some XChain encoding formats require both transactions to be confirmed together.

This service is testing infrastructure. It must not be run against mainnet or testnet nodes with real funds. Every other XChain service's test environment depends on the regtest miner for reliable block production.

## Features

- **Adaptive dual-timer mining** — 30-second max timer with 5-second extension on each new transaction, configurable at runtime via JSON-RPC
- **Automatic wallet management** — creates, loads, and funds a regtest wallet on startup; mines 101 bootstrap blocks on a fresh chain for coinbase maturity
- **JSON-RPC control API** — 6 endpoints for health checks, fund transfers, mempool stress testing, mining pause/resume, and timer configuration
- **Mempool stress testing** — `fill_mempool` constructs and broadcasts thousands of raw Bitcoin transactions using BIP32/BIP39 key derivation and PSBT signing for load testing
- **Exponential backoff** — automatic retry with capped exponential backoff (1s to 30s) on RPC connection failures, with counter reset on success
- **Graceful shutdown** — SIGTERM handler allows the current mining loop iteration to complete before exiting
- **Input validation** — rejects invalid addresses, amounts, timer values, and transaction quantities before any RPC call is made
- **Error sanitization** — RPC credentials are never exposed in error messages or console output
- **Concurrent call protection** — `fillMempool` mutex prevents overlapping stress test runs, with automatic `keepMining` flag restoration in a finally block
- **Docker-ready** — Alpine Node 20 image with non-root user, healthcheck via JSON-RPC ping, and hardened security headers (Helmet, CORS)
- **901 tests** — unit, integration, e2e, smoke, boundary, security, fuzz, chaos, performance, mutation, and regression testing

## How It Works

### Mining Loop

The miner's core loop runs every 1 second:

1. Poll `getrawmempool` to check for unconfirmed transactions
2. If new transactions are detected (mempool length increased):
   - On first detection: start the initial timer (default 30s) and the extension timer (default 5s)
   - On subsequent new transactions: reset only the extension timer
3. If either timer expires: call `generatetoaddress(1, walletAddress)` to mine a block, then reset all timers
4. If the mempool empties: clear all timers (no mining needed)

The loop skips mempool polling when `keepMining` is `false`, allowing external control of mining via the API.

### Wallet Lifecycle

On startup, `prepareWallet` follows a 4-branch decision tree:

1. **Wallet already loaded** — `getWalletInfo` succeeds → get a new address, check balance
2. **Wallet exists but not loaded** — `getWalletInfo` fails, `loadWallet` succeeds → get a new address
3. **No wallet** — both fail → `createWallet`, get a new address
4. **Balance check** — if balance is zero and chain height ≤ 100, mine 101 blocks for coinbase maturity; if height > 100, mine 1 block

### fillMempool Stress Testing

The `fillMempool` method constructs real Bitcoin transactions for mempool load testing:

1. Generate a BIP39 mnemonic and derive a BIP32 HD wallet (`m/44'/0'/0'/0`)
2. Request funding from the node wallet in chunks of up to 2,500 outputs each
3. Mine blocks to confirm funding transactions
4. Construct PSBTs distributing funds to derived addresses (one PSBT per chunk)
5. Sign, finalize, and broadcast each PSBT
6. Construct and broadcast individual spending transactions back to the main address

Mining is paused during this process (`keepMining = false`) and automatically restored in a `finally` block.

## JSON-RPC API

The miner exposes a JSON-RPC 2.0 API via Express for test orchestration:

| Method | Parameters | Description |
|---|---|---|
| `ping` | — | Health check; returns `{status: "success"}` |
| `send_funds` | `address`, `amount` | Send regtest coins to a specified address via `sendtoaddress` |
| `fill_mempool` | `tx_quantity` | Broadcast multiple transactions to stress-test the mempool (1–50,000) |
| `continue_mining` | — | Resume auto-mining after a pause (sets `keepMining = true`) |
| `set_mining_time` | `max_time`, `tx_added_time` | Override timer durations in milliseconds (1,000–3,600,000) |
| `set_default_mining_time` | — | Reset timers to defaults (30,000 / 5,000 ms) |

The API server uses Helmet for security headers and CORS for cross-origin access.

## Configuration

All configuration is via environment variables (loaded from `.env` by dotenv):

| Variable | Required | Description |
|---|---|---|
| `NETWORK` | Yes | Must be `regtest`, `testnet`, or `mainnet` |
| `NODE_URL` | Yes | Coin node JSON-RPC hostname (non-localhost triggers credential warning) |
| `NODE_PORT` | Yes | Coin node JSON-RPC port (1–65535) |
| `NODE_USER` | Yes | RPC username |
| `NODE_PASSWORD` | Yes | RPC password |
| `REGTEST_MINER_API_PORT` | Yes | Miner JSON-RPC API listening port (1–65535) |

The miner validates all 6 variables on startup and exits with a clear error message if any are missing or invalid.

### Internal Constants

| Constant | Value | Description |
|---|---|---|
| `CHECK_BLOCK_DELAY_MS` | 1000 | Mempool polling interval (1 second) |
| `DEFAULT_MAX_TIME_TO_MINE_TXS` | 30000 | Max time before mining after first tx (30 seconds) |
| `DEFAULT_ADDED_TIME_TO_MINE_TXS` | 5000 | Extension time on each new tx (5 seconds) |
| `MIN_MINING_TIME` | 1000 | Minimum allowed timer value (1 second) |
| `MAX_MINING_TIME` | 3600000 | Maximum allowed timer value (1 hour) |
| `MAX_FILL_MEMPOOL_QUANTITY` | 50000 | Maximum transactions for fill_mempool |
| `MAX_SEND_RETRIES` | 50 | Maximum retry attempts for funding in fillMempool |
| `OUTPUTS_QUANTITY_PER_TX` | 2500 | Maximum outputs per PSBT in fillMempool |
| `MAX_BACKOFF_MS` | 30000 | Maximum exponential backoff delay (30 seconds) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  xchain-regtest-miner                    │
│                                                          │
│  ┌────────────┐    ┌──────────────────────┐              │
│  │  api.js     │    │ XChainRegtestMiner   │              │
│  │  (Express)  │───►│  - prepareWallet()   │              │
│  │  JSON-RPC   │    │  - start() loop      │              │
│  │  6 methods  │    │  - fillMempool()     │              │
│  └────────────┘    │  - setMiningTime()   │              │
│                     └─────────┬────────────┘              │
│                               │                           │
│                     ┌─────────▼────────────┐              │
│                     │ BlockchainConnector   │              │
│                     │  15 RPC methods       │              │
│                     │  axios + Basic Auth   │              │
│                     └─────────┬────────────┘              │
└───────────────────────────────┼──────────────────────────┘
                                │ HTTP JSON-RPC
                                ▼
                    ┌───────────────────────┐
                    │  Coin Node (regtest)  │
                    │  bitcoind / litecoind │
                    │  / dogecoind          │
                    └───────────────────────┘
```

### Source Files

| File | Lines | Purpose |
|---|---|---|
| `src/api.js` | 170 | Environment validation, Express server, JSON-RPC routing, miner lifecycle |
| `src/XChainRegtestMiner.js` | 489 | Mining loop, wallet management, fillMempool, timer control |
| `src/BlockchainConnector.js` | 486 | JSON-RPC 2.0 client wrapping 15 Bitcoin Core methods with retry logic |

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/XChain-platform/xchain-regtest-miner.git
cd xchain-regtest-miner
npm install
```

## Quick Start

Create a `.env` file:

```env
NETWORK=regtest
NODE_URL=localhost
NODE_PORT=18443
NODE_USER=rpc
NODE_PASSWORD=rpc
REGTEST_MINER_API_PORT=3001
```

Start the miner:

```bash
npm run api
```

On startup, the miner:
1. Validates all 6 required environment variables
2. Creates or loads the `xchain_regtest_wallet` wallet
3. Mines 101 bootstrap blocks if the chain is fresh (coinbase maturity)
4. Begins the 1-second mempool polling loop
5. Starts the Express JSON-RPC API server

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the miner and JSON-RPC API server |
| `npm test` | All tests (~901 tests) |
| `npm run test:smoke` | Smoke tests (12 tests, 10s timeout) |
| `npm run test:e2e` | End-to-end tests (30s timeout) |
| `npm run test:security` | Security tests (input validation, error sanitization, env validation, API hardening, resource exhaustion) |
| `npm run test:fuzz` | Fuzz tests (property-based via fast-check, unlimited timeout) |
| `npm run test:fuzz:quick` | Quick fuzz (60s timeout) |
| `npm run test:chaos` | Chaos engineering tests (RPC disruption, response corruption, auth failures, process lifecycle) |
| `npm run test:performance` | Performance tests (block generation latency, mempool processing, fillMempool scaling) |
| `npm run test:mutation` | Mutation testing (Stryker Mutator, full service) |
| `npm run test:mutation:unit` | Unit-only mutation testing (fast feedback) |
| `npm run test:regression` | Regression tests — T1 standard gate (134 tests, < 2 min) |
| `npm run test:regression:t0` | Regression T0 — critical gate (45 tests, < 15s) |
| `npm run test:regression:t1` | Regression T1 — standard (134 tests, < 2 min) |
| `npm run test:regression:t2` | Regression T2 — full E2E (147 tests, < 10 min) |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `axios` | HTTP client for JSON-RPC calls to coin node |
| `bitcoinjs-lib` | Bitcoin primitives — PSBT construction, transaction parsing, address generation |
| `bip32` | BIP32 HD wallet key derivation for fillMempool |
| `bip39` | BIP39 mnemonic seed generation for fillMempool |
| `ecpair` | ECDSA key pair creation and PSBT signing |
| `tiny-secp256k1` | Elliptic curve math backend for BIP32 and ECPair |
| `express` | HTTP server for JSON-RPC API |
| `express-json-rpc-router` | JSON-RPC 2.0 request routing middleware |
| `helmet` | HTTP security headers (CSP, X-Frame-Options, etc.) |
| `cors` | Cross-Origin Resource Sharing middleware |
| `dotenv` | Environment variable loading from `.env` files |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test framework (with `--timeout 0` for long-running tests) |
| `sinon` | Mocking, stubbing, and spying for unit and integration tests |
| `fast-check` | Property-based (fuzz) testing with automatic shrinking |
| `@stryker-mutator/core` | Mutation testing framework |
| `@stryker-mutator/mocha-runner` | Mocha integration for Stryker |

## Related

- [Regtest Development Guide](../../developer-guide/REGTEST_DEVELOPMENT.md) — full guide to setting up a local regtest environment
- [E2E Tests](../e2e-test/) — the test suite that depends on the regtest miner for block production
- [Data Pipeline](../../architecture/DATA_PIPELINE.md) — how the regtest miner fits into the full platform flow
- [Encoder](../encoder/) — constructs XChain transactions that the miner includes in blocks
- [Decoder](../decoder/) — decodes mined blocks to extract XChain ACTION data

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
