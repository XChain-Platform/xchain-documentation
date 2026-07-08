<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Decoder

## What is xchain-decoder

xchain-decoder is the transaction extraction service of the XChain Platform. It runs as a long-lived Node.js process that continuously polls a coin node (bitcoind, litecoind, or dogecoind) via JSON-RPC, parses every block, identifies XChain-encoded transactions, deobfuscates the embedded ACTION payloads, and writes the raw decoded data to a MariaDB Decoder database. The indexer then reads this database to process protocol logic.

The decoder's job is extraction only; it does not interpret action semantics. It transforms raw blockchain data into clean, normalized rows that the indexer can process efficiently.

## Features

- **Multi-chain support**: Bitcoin, Litecoin, and Dogecoin on mainnet, testnet, and regtest
- **AES-128-CTR deobfuscation**: derives key and IV from the first input's txid (first 16 hex chars = key, next 16 = IV)
- **Magic prefix verification**: confirms `XCHN` (4 bytes) after deobfuscation before accepting a transaction
- **Four encoding formats**: detects and reassembles OP_RETURN, P2SH, P2WSH, and multisig payloads
- **Chain-specific parsing**: Litecoin strips the HogEx/MWEB flag; Dogecoin strips AuxPoW headers before passing blocks to bitcoinjs-lib
- **Block reorganization detection**: identifies chain tip changes and records the reorg block so the indexer can roll back
- **DISPENSER protocol**: parses DISPENSER actions and tracks active dispensers with expiration for real-time payment detection
- **Mempool tracking**: maintains an index of unconfirmed transactions, updated every 60 seconds when synced
- **Normalized storage**: addresses and transaction hashes stored in index tables with integer IDs for join efficiency
- **ACTION name validation**: 34-name whitelist (SEND, ISSUE, MINT, ORDER, ANCHOR, NODEPROOF, SLASH, VOTE, etc.) enforced before database writes
- **Graceful shutdown**: SIGTERM/SIGINT handlers complete in-flight work before exiting
- **750+ tests**: unit, integration, e2e, boundary, security, fuzz, chaos, regression, benchmarks, and mutation testing

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Data pipeline, internal components, polling loop, transaction parsing, deobfuscation |
| [Configuration](CONFIGURATION.md) | Environment variables, internal constants, network-specific settings |
| [Database](DATABASE.md) | Full schema reference: 9 tables covering blocks, transactions, dispensers, pubkeys, indexes, and events |
| [Operations](OPERATIONS.md) | Running, Docker, API endpoints, reorg handling, mempool, troubleshooting |

## Installation

Clone the repository and install dependencies from within the `xchain-decoder` directory:

```bash
git clone https://github.com/XChain-Platform/xchain-decoder.git
cd xchain-decoder
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
DECODER_DB_HOST=127.0.0.1
DECODER_DB_PORT=3306
DECODER_DB_NAME=XChain_BTC_Mainnet_Decoder
DECODER_DB_USER=root
DECODER_DB_PASS=
DECODER_API_PORT=3002
```

Start the decoder:

```bash
npm run api
```

On startup, the decoder:
1. Loads environment variables from `.env`
2. Starts the Express JSON-RPC API server
3. Creates the Decoder database and tables if they don't exist
4. Waits for the coin node to reach 99% sync progress
5. Begins the block polling loop

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the decoder and API server |
| `npm run test:smoke` | Smoke tests (50+ tests, no external services) |
| `npm run test:unit` | Unit tests (500+ tests, no external services) |
| `npm run test:security` | Security tests (75+ tests, no external services) |
| `npm run test:integration` | Integration tests (requires bitcoind regtest + MariaDB) |
| `npm run test:e2e` | End-to-end tests (requires full stack) |
| `npm run test:fuzz` | Fuzz tests (5 harnesses, 1000 iterations each) |
| `npm run test:fuzz:quick` | Quick fuzz (100 iterations) |
| `npm run test:chaos` | Chaos engineering tests (50+ tests) |
| `npm run test:regression` | Regression tests P0+P1 (60+ tests, fast) |
| `npm run test:regression:critical` | Regression tests P0 only (45+ tests, <1s) |
| `npm run test:regression:full` | Full regression suite (85+ tests) |
| `npm run test:bench` | Performance benchmarks (7 scenarios) |
| `npm run test:mutation` | Mutation testing (Stryker Mutator) |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `bitcoinjs-lib` | Transaction and block parsing |
| `tiny-secp256k1` | Elliptic curve operations (taproot support) |
| `bip32`, `bip39`, `bs58check`, `ecpair` | Key derivation and address encoding |
| `axios` | HTTP client for JSON-RPC calls to coin node |
| `express` | HTTP server for the JSON-RPC API |
| `express-json-rpc-router` | JSON-RPC 2.0 request routing |
| `helmet` | HTTP security headers |
| `cors` | Cross-Origin Resource Sharing |
| `express-rate-limit` | API rate limiting (100 req/min) |
| `mariadb` | MariaDB client with connection pooling |
| `dotenv` | Environment variable loading from `.env` files |
| `binary-search` | Efficient sorted-list operations for mempool diff |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test framework |
| `sinon` | Mocking, stubbing, and spying for tests |
| `@stryker-mutator/core` | Mutation testing framework |
| `@stryker-mutator/mocha-runner` | Mocha integration for Stryker |

## Related

- [Data Pipeline](../../architecture/Data_Pipeline.md): how the decoder fits into the full ingestion flow
- [Indexer](../indexer/); the service that consumes decoder output and processes action logic
- [Encoder](../encoder/): how XChain payloads are constructed for embedding

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
