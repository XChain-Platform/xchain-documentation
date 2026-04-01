# XChain Platform UTXO Tracker

## What is xchain-utxo-tracker

xchain-utxo-tracker is the UTXO indexing service of the XChain Platform. It runs as a long-lived Node.js process that continuously polls a coin node (bitcoind, litecoind, or dogecoind), parses every block, and maintains a real-time index of all unspent transaction outputs (UTXOs) in a LevelDB database. The encoder queries this service to find spendable inputs when constructing transactions.

## Features

- **Full UTXO index** — every unspent output indexed by scriptPubKey hash for fast address lookups
- **Real-time mempool tracking** — unconfirmed transactions tracked in a separate in-memory database
- **Reorg handling** — maintains a 10-block undo history and rolls back correctly on chain reorganization
- **Bootstrap support** — can restore from compressed tar archives for fast initial sync without re-scanning the full chain
- **Batch writes** — LevelDB writes are batched in groups of 100 blocks for throughput efficiency
- **JSON-RPC API** — endpoints for UTXO queries, balance queries, and address lookups

## How It Works

### Block polling

The tracker runs a polling loop that calls `getblockcount` to check for a new tip, fetches new blocks with `getblock` (verbosity 2), and processes each transaction in order. Blocks are written to LevelDB in batches of 100 to minimize write amplification.

### LevelDB key schema

All data is stored in a single LevelDB instance using prefix-based keys:

| Prefix | Type | Description |
|---|---|---|
| `B` | Block | Block metadata: height, hash, timestamp |
| `T` | Transaction | Transaction metadata indexed by txid |
| `I` | Input | Spent input records (used for undo/reorg) |
| `O` | Output | Unspent output records indexed by txid + vout |
| `H` | Hint | scriptPubKey hash → outpoint index for address lookups |
| `J` | Hint (secondary) | Secondary hint index for additional lookup patterns |

The `H`/`J` hint keys map a scriptPubKey hash to the set of outpoints (txid + vout) that pay to that script. This allows the tracker to answer "what UTXOs does address X have" without scanning all outputs.

### Reorg handling

The tracker stores the last 10 blocks' input records (`I` prefix keys) as an undo log. On detecting a reorg (the coin node reports a different block hash for a height the tracker has already indexed), the tracker rolls back each affected block by:

1. Re-spending the inputs that were consumed in the rolled-back block (restoring the `O` entries)
2. Removing the outputs created in the rolled-back block
3. Deleting the spent input records for the rolled-back block
4. Decrementing the tip height

After rolling back to the fork point, normal forward indexing resumes.

### Mempool tracking

In parallel with block polling, the tracker calls `getrawmempool` and `getrawtransaction` to track unconfirmed transactions. Mempool UTXOs are held in a separate in-memory database and are not written to LevelDB. When a transaction confirms (its block is processed), the mempool entry is removed and the confirmed UTXO is written to LevelDB.

This allows the encoder to check whether a UTXO is currently unconfirmed before selecting it as an input, reducing the risk of constructing transactions that conflict with pending mempool transactions.

### Bootstrap

For new deployments, syncing from block 0 can take a long time. The tracker supports restoring from a compressed tar archive of the LevelDB data directory. Operators can distribute a snapshot archive; the tracker verifies the snapshot tip and resumes normal polling from that height.

## API

The tracker exposes a JSON-RPC API. Key methods:

| Method | Description |
|---|---|
| `getUTXOs` | Return all UTXOs for an address |
| `getBalance` | Return total confirmed balance for an address |
| `getUnconfirmedBalance` | Return total unconfirmed balance for an address |
| `getUTXO` | Return a specific UTXO by txid and vout |
| `getBlockHeight` | Return the current indexed block height |
| `getMempool` | Return the current in-memory mempool state |

## Storage

All indexed data is stored in a LevelDB directory. LevelDB is an embedded key-value store — there is no separate database process. The LevelDB path is configurable and should be on a fast local disk.

## Configuration

| Parameter | Description |
|---|---|
| `coin` | Chain identifier — `BTC`, `LTC`, or `DOGE` |
| `network` | Network — `mainnet`, `testnet`, or `regtest` |
| `rpcHost` | Coin node JSON-RPC hostname |
| `rpcPort` | Coin node JSON-RPC port |
| `rpcUser` | Coin node RPC username |
| `rpcPass` | Coin node RPC password |
| `dbPath` | Path to the LevelDB data directory |
| `port` | JSON-RPC API port |

## Installation

Clone the repository and install dependencies from within the `xchain-utxo-tracker` directory:

```bash
git clone https://github.com/XChain-platform/xchain-utxo-tracker.git
cd xchain-utxo-tracker
npm install
npm run api
```

## Related

- [Encoder](../encoder/) — the primary consumer of UTXO tracker queries
- [Data Pipeline](../../architecture/DATA_PIPELINE.md) — how the UTXO tracker fits into the full platform flow
