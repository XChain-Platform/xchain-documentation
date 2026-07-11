<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform UTXO Tracker

## What is xchain-utxo-tracker

xchain-utxo-tracker is the UTXO indexing service of the XChain Platform. It runs as a long-lived Node.js process that continuously polls a coin node (bitcoind, litecoind, or dogecoind) via JSON-RPC, decodes every block, and maintains a real-time index of all unspent transaction outputs (UTXOs) in a LevelDB database. The encoder queries this service to find spendable inputs when constructing transactions.

The tracker uses a compact binary key schema with 12 prefix types to store block metadata, transaction mappings, outputs, inputs, and reorg-recovery archives. All keys and values are raw binary Buffers (not hex strings), reducing database size by approximately 50% compared to string-based encoding. Transaction IDs are truncated to 8 bytes in index keys, further reducing the storage footprint.

In addition to confirmed block data, the tracker maintains a separate in-memory database for unconfirmed mempool transactions, updated every 60 seconds. This allows the encoder to distinguish between confirmed and pending UTXOs when selecting inputs.

## Features

- **Full UTXO index**: every unspent output indexed by SHA-256 scriptPubKey hash for fast address lookups
- **Compact binary encoding**: all LevelDB keys and values stored as raw binary Buffers with 12 prefix types, reducing DB size ~50%
- **Truncated txid keys**: transaction IDs stored as 8-byte truncations in index keys for further space savings
- **Active-UTXO-only storage**: only unspent outputs kept in the live index; spent outputs archived temporarily for reorg recovery
- **Real-time mempool tracking**: unconfirmed transactions tracked in a separate in-memory LevelDB, updated every 60 seconds
- **BigInt precision**: all balance calculations use BigInt arithmetic with `satoshiToDecimalString()` conversion, eliminating floating-point errors
- **Reorg handling**: maintains a per-chain undo history (BTC: 12 blocks, LTC: 48 blocks, DOGE: 120 blocks, overridable via `XCHAIN_UNDO_BLOCKS_<COIN>`) using K/M archive records and rolls back correctly on chain reorganization
- **Concurrent block prefetch**: pre-fetches up to 10 blocks concurrently via JSON-RPC batch requests with HTTP keep-alive
- **Batch writes**: LevelDB writes batched in groups of 200 blocks for throughput efficiency with atomic commit
- **Two-pass transaction processing**: outputs inserted before inputs within each block, correctly handling intra-block spends
- **Multi-chain support**: Bitcoin, Litecoin, and Dogecoin on mainnet, testnet, and regtest
- **AuxPoW block parsing**: Dogecoin and Litecoin HogEx block header stripping for correct decoding
- **Bootstrap support**: compressed tar archive backup and restore for fast initial sync without re-scanning the full chain
- **REST + JSON-RPC API**: dual interface for UTXO queries, balance lookups, address info, and bootstrap operations
- **Rolling ETA**: 1000-block rolling window with day/hour/minute display for sync progress estimation
- **750+ tests**: unit, integration, e2e, smoke, fuzz, chaos, performance, boundary, security, and regression testing

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Data pipeline position, internal components, LevelDB key schema, block processing loop, reorg handling, mempool tracking |
| [Configuration](CONFIGURATION.md) | Environment variables, internal constants, database paths |
| [Operations](OPERATIONS.md) | Running, Docker, REST and JSON-RPC API reference, resilience, troubleshooting |

## Installation

Clone the repository and install dependencies from within the `xchain-utxo-tracker` directory:

```bash
git clone https://github.com/XChain-Platform/xchain-utxo-tracker.git
cd xchain-utxo-tracker
npm install
```

## Quick Start

Create a `.env` file with the required environment variables (see [Configuration](CONFIGURATION.md) for full details):

```env
NETWORK=bitcoin-mainnet
NODE_URL=127.0.0.1
NODE_PORT=8332
NODE_USER=rpc
NODE_PASSWORD=rpc
UTXO_TRACKER_API_PORT=3001
```

Start the tracker:

```bash
npm run api
```

On startup, the tracker:
1. Loads environment variables from `.env`
2. Starts the Express REST + JSON-RPC API server
3. Opens (or creates) the LevelDB database at `/data/xchain-utxo-tracker`
4. Waits for the coin node to reach 99% sync progress
5. Reads the last checkpoint (`LAST_BLOCK_HEIGHT`, `LAST_BLOCK_HASH`) and resumes
6. Begins the block polling loop with concurrent prefetch

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the tracker and API server |
| `npm test` | Unit tests (400+ tests) |
| `npm run test:smoke` | Smoke tests (9+ tests) |
| `npm run test:integration` | Integration tests (65+ tests, requires LevelDB) |
| `npm run test:e2e` | End-to-end tests (30+ tests) |
| `npm run test:fuzz` | Fuzz tests (12 campaigns, 1000 iterations each) |
| `npm run test:fuzz:quick` | Quick fuzz (100 iterations) |
| `npm run test:fuzz:deep` | Deep fuzz (10,000 iterations) |
| `npm run test:perf` | Performance tests (20+ tests) |
| `npm run test:perf:quick` | Quick performance (small scale) |
| `npm run test:perf:deep` | Deep performance (large scale, 4 GB heap) |
| `npm run test:boundary` | Boundary condition tests (15+ tests) |
| `npm run test:security` | Security tests (50+ tests) |
| `npm run test:regression` | Regression tests (15+ tests) |
| `npm run test:chaos` | Chaos engineering tests (30+ tests) |
| `npm run test:all` | All unit + integration + e2e tests |
| `npm run test:unit:ondisk` | Unit tests running against on-disk ClassicLevel instead of in-memory |
| `npm run test:integration:ondisk` | Integration tests running against on-disk ClassicLevel |
| `npm run mutate` | Mutation testing (Stryker Mutator) |
| `npm run mutate:quick` | Quick mutation testing |
| `npm run mutate:p1` | P1 priority mutation testing |
| `npm run mutate:p2` | P2 priority mutation testing |
| `npm run mutate:p3` | P3 priority mutation testing |
| `npm run mutate:incremental` | Incremental mutation testing |
| `npm run mutate:custom` | Custom Buffer/encoding mutations |
| `npm run mutate:custom:p1` | Custom mutations scoped to P1 files (LevelUpDb, XChainUtxoTracker, bufferutils) |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `classic-level` | LevelDB backend for persistent on-disk storage |
| `memory-level` | In-memory LevelDB backend for mempool database |
| `bitcoinjs-lib` | Block and transaction parsing, address-to-scriptPubKey conversion |
| `tiny-secp256k1` | Elliptic curve operations |
| `bip32`, `bip39`, `bs58check`, `ecpair` | Key derivation and address encoding |
| `axios` | HTTP client for JSON-RPC calls to coin node |
| `express` | HTTP server for REST and JSON-RPC API |
| `express-json-rpc-router` | JSON-RPC 2.0 request routing |
| `helmet` | HTTP security headers |
| `cors` | Cross-Origin Resource Sharing |
| `binary-search` | Efficient sorted-list operations for mempool diff |
| `dotenv` | Environment variable loading from `.env` files |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test framework |
| `chai` | Assertion library |
| `sinon` | Mocking, stubbing, and spying for tests |
| `supertest` | HTTP endpoint testing |
| `fast-check` | Property-based (fuzz) testing |
| `autocannon` | HTTP load testing |
| `@stryker-mutator/core` | Mutation testing framework |
| `@stryker-mutator/mocha-runner` | Mocha integration for Stryker |

## Related

- [Encoder](../encoder/); the primary consumer of UTXO tracker queries
- [Decoder](../decoder/): also polls coin nodes, but extracts XChain ACTION data rather than UTXOs
- [Data Pipeline](../../architecture/Data_Pipeline.md): how the UTXO tracker fits into the full platform flow

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
