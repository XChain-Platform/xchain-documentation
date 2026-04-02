<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Decoder

## What is xchain-decoder

xchain-decoder is the transaction extraction service of the XChain Platform. It runs as a long-lived Node.js process that continuously polls a coin node (bitcoind, litecoind, or dogecoind) via JSON-RPC, parses every block, identifies XChain-encoded transactions, deobfuscates the embedded ACTION payloads, and writes the raw decoded data to a MariaDB Decoder database. The indexer then reads this database to process protocol logic.

The decoder's job is extraction only — it does not interpret action semantics. It transforms raw blockchain data into clean, normalized rows that the indexer can process efficiently.

## Features

- **Multi-chain support** — Bitcoin, Litecoin, and Dogecoin on mainnet, testnet, and regtest
- **AES-128-CTR deobfuscation** — derives key and IV from the first input's txid (first 16 hex chars = key, next 16 = IV)
- **Magic prefix verification** — confirms `XCHN` (4 bytes) after deobfuscation before accepting a transaction
- **Four encoding formats** — detects and reassembles OP_RETURN, P2SH, P2WSH, and multisig payloads
- **Chain-specific parsing** — Litecoin strips the HogEx flag; Dogecoin strips AuxPoW headers before passing blocks to bitcoinjs-lib
- **Block reorganization detection** — identifies chain tip changes and records the reorg block so the indexer can roll back
- **Mempool tracking** — maintains an index of unconfirmed transactions for real-time dispenser protocol support
- **Normalized storage** — addresses, transaction hashes, and block data stored with integer IDs for join efficiency

## How It Works

### Polling loop

The decoder runs a continuous polling loop against the coin node's JSON-RPC interface. Each iteration calls `getblockcount` to check for a new tip, fetches the block hash with `getblockhash`, retrieves the full block with `getblock` (verbosity 2), and processes each transaction in order.

### Transaction parsing

Each transaction is parsed with bitcoinjs-lib. Before parsing:

- **Litecoin** — the HogEx witness flag is stripped from the raw transaction bytes, as Litecoin uses a non-standard variant that bitcoinjs-lib does not natively support
- **Dogecoin** — AuxPoW headers are stripped from block data, because merge-mined blocks embed auxiliary proof-of-work data that precedes the standard block header

After parsing, the decoder scans each transaction's outputs looking for XChain payloads.

### Deobfuscation

XChain data is obfuscated using AES-128-CTR before embedding in the transaction. The decoder reverses this:

1. Takes the txid of the first input of the spending transaction
2. Uses the first 16 hex characters as the 8-byte AES key
3. Uses the next 16 hex characters as the 8-byte IV
4. Decrypts the payload
5. Checks for the `XCHN` magic prefix — transactions without this prefix are skipped

### Multi-output reassembly

For P2SH and P2WSH encodings, the ACTION payload is split across a two-transaction pattern: a funding transaction that locks funds to a script hash, and a spending transaction that reveals the full script in the scriptSig or witness. The decoder identifies the spend transaction, extracts and concatenates the script chunks, then deobfuscates the assembled payload.

For multisig encodings, data is embedded across multiple public key positions in a single transaction's outputs.

### Writing to the database

After successful deobfuscation and prefix verification, the decoder writes a row to the Decoder DB containing:

- The raw ACTION string (pipe-delimited, e.g. `SEND|1|TOKEN|100|destination`)
- Source address (derived from the first input)
- Destination address (from relevant outputs)
- Transaction hash (normalized to an integer ID)
- Block height, block hash, block timestamp
- Transaction index within the block

### Reorg detection

Before writing each new block, the decoder checks that the previous block's hash in the Decoder DB matches what the coin node reports. A mismatch indicates a chain reorganization. The decoder records the reorg block height so the indexer can roll back its state to that point, then re-indexes from there.

### Mempool tracking

In parallel with block polling, the decoder tracks unconfirmed transactions using `getrawmempool` and `getrawtransaction`. This is required for the dispenser protocol, which must detect incoming payments in real time before they confirm. Mempool rows are marked unconfirmed and promoted to confirmed status when their block is processed.

## Database

The decoder writes to a MariaDB database named following the convention:

```
XChain_{CHAIN}_{NETWORK}_Decoder
```

Examples: `XChain_BTC_Mainnet_Decoder`, `XChain_LTC_Regtest_Decoder`

The decoder writes to this database; the indexer reads from it. The decoder does not read from the indexer database.

## Configuration

The decoder reads from a local `config.json` or environment variables:

| Parameter | Description |
|---|---|
| `coin` | Chain identifier — `BTC`, `LTC`, or `DOGE` |
| `network` | Network — `mainnet`, `testnet`, or `regtest` |
| `rpcHost` | Coin node JSON-RPC hostname |
| `rpcPort` | Coin node JSON-RPC port |
| `rpcUser` | Coin node RPC username |
| `rpcPass` | Coin node RPC password |
| `dbHost` | MariaDB hostname |
| `dbPort` | MariaDB port |
| `dbUser` | MariaDB username |
| `dbPass` | MariaDB password |

## API

The decoder exposes a JSON-RPC API for internal service queries. Endpoints allow callers to check current sync status (block height, chain tip) and query mempool state. The API is consumed primarily by the indexer and by monitoring tooling.

## Installation

Clone the repository and install dependencies from within the `xchain-decoder` directory:

```bash
git clone https://github.com/XChain-platform/xchain-decoder.git
cd xchain-decoder
npm install
npm run api
```

## Related

- [Data Pipeline](../../architecture/DATA_PIPELINE.md) — how the decoder fits into the full ingestion flow
- [Indexer](../indexer/) — the service that consumes decoder output and processes action logic
- [Encoder](../encoder/) — how XChain payloads are constructed for embedding

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
