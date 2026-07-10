<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Regtest Miner

## What is xchain-regtest-miner

xchain-regtest-miner is an auto-mining service for XChain Platform regtest development environments. In regtest mode, Bitcoin-family coin nodes (bitcoind, litecoind, dogecoind) do not mine blocks automatically, developers must mine manually via `generatetoaddress` or script the calls themselves. The regtest miner eliminates this friction by polling the mempool every second and mining blocks automatically whenever transactions are detected.

The miner uses an adaptive dual-timer system: when the first unconfirmed transaction appears, a 30-second max timer starts; each additional transaction resets a 5-second extension timer. Mining triggers when either timer expires. This batching strategy groups related transactions (such as a P2SH fund transaction and its corresponding spend) into the same block, which is important for correct platform behavior since some XChain encoding formats require both transactions to be confirmed together.

This service is testing infrastructure. It must not be run against mainnet or testnet nodes with real funds. Every other XChain service's test environment depends on the regtest miner for reliable block production.

## Features

- **Adaptive dual-timer mining**: 30-second max timer with 5-second extension on each new transaction, configurable at runtime via JSON-RPC
- **Automatic wallet management**: creates, loads, and funds a regtest wallet on startup; mines 101 bootstrap blocks on a fresh chain for coinbase maturity
- **JSON-RPC control API**: 9 endpoints for health checks, status reporting, fund transfers, mempool stress testing, mining pause/resume, timer configuration, and block generation
- **Mempool stress testing**: `fill_mempool` constructs and broadcasts thousands of raw Bitcoin transactions using BIP32/BIP39 key derivation and PSBT signing for load testing
- **Exponential backoff**: automatic retry with capped exponential backoff (1s to 30s) on RPC connection failures, with counter reset on success
- **Graceful shutdown**: SIGTERM handler allows the current mining loop iteration to complete before exiting
- **Input validation**: rejects invalid addresses, amounts, timer values, and transaction quantities before any RPC call is made
- **Error sanitization**: RPC credentials are never exposed in error messages or console output
- **Concurrent call protection**: `fillMempool` mutex prevents overlapping stress test runs, with automatic `keepMining` flag restoration in a finally block
- **Docker-ready**: Alpine Node 22 image with non-root user, healthcheck via JSON-RPC ping, and hardened security headers (Helmet, CORS)
- **800+ tests**: unit, integration, e2e, smoke, boundary, security, fuzz, chaos, performance, mutation, and regression testing

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Component diagram, source files, mining loop, wallet lifecycle, fillMempool |
| [Configuration](CONFIGURATION.md) | Environment variables, internal constants |
| [Operations](OPERATIONS.md) | JSON-RPC API endpoints, startup sequence, Docker, troubleshooting |

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/XChain-Platform/xchain-regtest-miner.git
cd xchain-regtest-miner
npm install
```

## Quick Start

Create a `.env` file:

```env
NETWORK=regtest
NODE_URL=localhost
NODE_PORT=18444
NODE_USER=rpc
NODE_PASSWORD=rpc
REGTEST_MINER_API_PORT=3005
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
| `npm test` | All tests (800+ tests) |
| `npm run test:smoke` | Smoke tests (10+ tests, 10s timeout) |
| `npm run test:e2e` | End-to-end tests (30s timeout) |
| `npm run test:security` | Security tests (input validation, error sanitization, env validation, API hardening, resource exhaustion) |
| `npm run test:fuzz` | Fuzz tests (property-based via fast-check, unlimited timeout) |
| `npm run test:fuzz:quick` | Quick fuzz (60s timeout) |
| `npm run test:chaos` | Chaos engineering tests (RPC disruption, response corruption, auth failures, process lifecycle) |
| `npm run test:performance` | Performance tests (block generation latency, mempool processing, fillMempool scaling) |
| `npm run test:mutation` | Mutation testing (Stryker Mutator, full service) |
| `npm run test:mutation:unit` | Unit-only mutation testing (fast feedback) |
| `npm run test:regression` | Regression tests; T1 standard gate (130+ tests, < 2 min) |
| `npm run test:regression:t0` | Regression T0: critical gate (40+ tests, < 15s) |
| `npm run test:regression:t1` | Regression T1: standard (130+ tests, < 2 min) |
| `npm run test:regression:t2` | Regression T2: full E2E (140+ tests, < 10 min) |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `axios` | HTTP client for JSON-RPC calls to coin node |
| `bitcoinjs-lib` | Bitcoin primitives; PSBT construction, transaction parsing, address generation |
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

- [Regtest Development Guide](../../developer-guide/Regtest_Development.md): full guide to setting up a local regtest environment
- [E2E Tests](../e2e-test/); the test suite that depends on the regtest miner for block production
- [Data Pipeline](../../architecture/Data_Pipeline.md): how the regtest miner fits into the full platform flow
- [Encoder](../encoder/): constructs XChain transactions that the miner includes in blocks
- [Decoder](../decoder/): decodes mined blocks to extract XChain ACTION data

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
