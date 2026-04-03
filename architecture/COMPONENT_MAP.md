<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Component Map

This document describes all 11 XChain Platform services, their roles, inputs, outputs, and connections. Services are grouped by function. For detailed documentation on any individual service, see the corresponding subdirectory under [`../components/`](../components/).

---

## Service Groups

| Group | Services |
|---|---|
| Core Pipeline | decoder, indexer, explorer |
| Transaction Creation | encoder, utxo-tracker, sdk |
| Data Replication | indexer-sync |
| Infrastructure | hub, node, regtest-miner, e2e-test |

---

## Core Pipeline

These three services form the backbone of the platform. Data flows from coin node through decoder and indexer to explorer in one direction only.

### xchain-decoder

| | |
|---|---|
| **Purpose** | Polls a coin node for blocks, extracts XChain transactions, writes raw decoded data |
| **Inputs** | Coin node JSON-RPC (`getblockcount`, `getblockhash`, `getblock`, `getrawtransaction`) |
| **Outputs** | Decoder MariaDB (`XChain_{CHAIN}_{NETWORK}_Decoder`) |
| **Storage** | MariaDB (relational; blocks, transactions, decoded ACTION strings) |
| **Communication** | Outbound JSON-RPC to coin node; no inbound API |

Key technical details:

- Parses transactions using bitcoinjs-lib with coin-specific pre-processing: Litecoin requires stripping the HogEx flag; Dogecoin requires stripping AuxPoW merge-mining headers.
- Deobfuscates each output using AES-128-CTR with a key derived from the first input's txid. Identifies XChain payloads by the `XCHN` magic prefix.
- Detects chain reorganizations by comparing stored block hashes. On reorg, rolls back to the last common ancestor before resuming.
- Tracks the mempool separately to support the dispenser protocol (unconfirmed transaction response).
- Runs as one instance per chain/network combination.

See [`../components/decoder/`](../components/decoder/) for full documentation.

---

### xchain-indexer

| | |
|---|---|
| **Purpose** | Reads decoded ACTIONs from the Decoder DB, validates them, executes business logic, writes final state |
| **Inputs** | Decoder MariaDB (SQL polling every 5 seconds) |
| **Outputs** | Indexer MariaDB (`XChain_{CHAIN}_{NETWORK}_Indexer`) |
| **Storage** | MariaDB (60+ tables: core, ledger, action-specific, index, mapping) |
| **Communication** | Outbound SQL reads from Decoder DB; no inbound API |

Key technical details:

- Routes each ACTION string to one of 20 dedicated handler classes (`IssueAction`, `SendAction`, `OrderAction`, etc.).
- Validates all fields before execution. Invalid actions are recorded with status `invalid` and produce no ledger effects.
- Maintains a double-entry ledger: every token movement is a credit to one address and a debit from another. Balance = SUM(credits) - SUM(debits). A sanity check asserts `token_supply == net ledger total` after each issuance.
- Holds XCHAIN gas in escrow for time-bounded operations (orders, dispensers). Releases escrow on expiration or cancellation.
- DEX matching engine handles `ORDER` and `SWAP` actions, matching bids and asks within each block.
- Processes expirations after each block: open orders and active dispensers past their block height are closed automatically.
- All writes for a block are wrapped in a single MariaDB transaction. Either the full block commits or it rolls back entirely.
- On reorg, rolls back across 40+ tables in a single transaction, then re-processes from the reorg block.
- Watchdog timer (5-minute default) restarts the indexer if it hangs during block processing.
- Runs as one instance per chain/network combination.

See [`../components/indexer/`](../components/indexer/) for full documentation.

---

### xchain-explorer

| | |
|---|---|
| **Purpose** | Serves REST endpoints, JSON-RPC 2.0, and a web UI over the Indexer DB |
| **Inputs** | Indexer MariaDB (direct SQL reads); xchain-hub (config sync every 60s) |
| **Outputs** | HTTP responses (REST, JSON-RPC, HTML) |
| **Storage** | None (stateless read layer) |
| **Communication** | Inbound HTTP from clients; outbound SQL to Indexer DB; outbound JSON-RPC to xchain-hub |

Key technical details:

- Over 50 REST endpoints covering tokens, balances, orders, dispensers, transactions, events, market data, and more.
- JSON-RPC 2.0 interface compatible with Counterparty-style tooling.
- Bootstrap-based web UI with Highcharts for order book and market price visualization.
- Reads configuration from xchain-hub every 60 seconds (fee schedules, supported parameters, fiat pricing).
- Approximately 5,500 lines of SQL query logic. All queries are parameterized; no ORM.
- Supports SSL/TLS termination.
- Runs as one instance per chain/network combination.

See [`../components/explorer/`](../components/explorer/) for full documentation.

---

## Data Replication

### xchain-indexer-sync

| | |
|---|---|
| **Purpose** | Replicates indexer databases to validators and consumers for lightweight chain verification |
| **Inputs** | Indexer MariaDB (SQL polling per chain/network), xchain-hub (JSON-RPC config discovery) |
| **Outputs** | REST API (snapshots, status, transparency log), WebSocket (real-time block and reorg streaming) |
| **Storage** | MariaDB (same 77-table schema as indexer — one replica DB per chain/network) |
| **Communication** | Inbound REST + WebSocket from validators/consumers; outbound JSON-RPC to hub; outbound SQL reads from indexer DBs |

Key technical details:

- Runs as a single instance serving all chains/networks on the node — discovers installed indexers by calling the hub's `getallconfigs` method.
- Operates in two modes: **server mode** (polls indexer databases and serves data) and **client mode** (replicates from remote sync servers).
- Polls each indexer database for new blocks every 3 seconds (configurable). Builds a complete block payload from all affected tables and broadcasts to WebSocket subscribers.
- Full snapshots are streamed as gzip-compressed JSON for bootstrapping new validators.
- Incremental snapshots provide deltas since a given block height for catch-up after downtime.
- Data integrity is verified using the indexer's existing per-block chained SHA256 hashes (ledger, actions, contracts). No additional Merkle tree implementation needed.
- Clients can sync from 2+ independent sources and cross-verify block hashes to detect tampered data.
- Reorg detection mirrors the indexer's pattern: detects rollbacks in the source database and broadcasts reorg events. Clients roll back their local replicas using the same table lists as the indexer's `Rollback.js`.

See [`../components/indexer-sync/`](../components/indexer-sync/) for full documentation.

---

## Transaction Creation

These services support the construction and submission of XChain transactions.

### xchain-encoder

| | |
|---|---|
| **Purpose** | Converts an ACTION string + UTXOs + public key into an unsigned PSBT |
| **Inputs** | JSON-RPC calls from SDK or callers (ACTION string, UTXOs, pubkey) |
| **Outputs** | Unsigned PSBT (one or two transactions depending on format) |
| **Storage** | None (fully stateless) |
| **Communication** | Inbound JSON-RPC; no outbound calls |

Key technical details:

- Selects encoding format based on payload size: `OP_RETURN` (≤76 bytes, 1 tx), `multisig` (~61 bytes/key, 1 tx), `P2SH` (≤476 bytes, 2 tx), `P2WSH` (≤9,956 bytes, 2 tx).
- P2SH and P2WSH use a two-transaction pattern: fund tx commits funds to a script; reveal tx spends it, embedding the data in the unlocking script.
- Obfuscates payloads with AES-128-CTR. Key and IV are derived from the first input's txid — deterministic and reversible by any party with the txid.
- Available as a Node.js JSON-RPC service and as a browser bundle via webpack.
- The encoder itself has no per-chain specialization; coin node interaction happens at the caller level.

See [`../components/encoder/`](../components/encoder/) for full documentation.

---

### xchain-utxo-tracker

| | |
|---|---|
| **Purpose** | Indexes all UTXOs from a coin node and serves address/balance/UTXO queries |
| **Inputs** | Coin node JSON-RPC (block polling); JSON-RPC queries from SDK and encoder |
| **Outputs** | JSON-RPC API (UTXO lookups, address balances) |
| **Storage** | LevelDB (prefix-keyed; blocks, transactions, inputs, outputs, hints) |
| **Communication** | Outbound JSON-RPC to coin node; inbound JSON-RPC from SDK/encoder |

Key technical details:

- LevelDB key schema uses single-character prefixes: `B`=block, `T`=transaction, `I`=input, `O`=output, `H`/`J`=address hints.
- Processes blocks in batches of 100, writing each batch atomically to LevelDB.
- Maintains 10 blocks of undo history to support chain reorganization rollback.
- Tracks the mempool for real-time unconfirmed UTXO state.
- Supports bootstrap from tar archives to avoid re-indexing from genesis.
- Outputs are indexed by scriptPubKey hash, enabling efficient address lookups.
- Runs as one instance per chain/network combination.

See [`../components/utxo-tracker/`](../components/utxo-tracker/) for full documentation.

---

### xchain-sdk

| | |
|---|---|
| **Purpose** | Developer SDK for constructing and submitting XChain actions |
| **Inputs** | Developer calls (action parameters); JSON-RPC from encoder and explorer |
| **Outputs** | Signed or unsigned transactions; query responses |
| **Storage** | None (stateless) |
| **Communication** | Outbound JSON-RPC to encoder, explorer, hub; optional inbound JSON-RPC (microservice mode) |

Key technical details:

- Exposes 19 action construction methods (one per ACTION type) and 40 explorer query wrappers.
- Batch builder allows multiple actions to be combined into a single `BATCH` action string.
- Discovers service endpoints via xchain-hub.
- Implements retry with exponential backoff and connection pooling for all outbound calls.
- Supports request hooks (pre/post processing middleware).
- Three deployment modes: Node.js library, JSON-RPC microservice, browser bundle via webpack.

See [`../components/sdk/`](../components/sdk/) for full documentation.

---

## Infrastructure

These services manage deployment, configuration, and testing.

### xchain-hub

| | |
|---|---|
| **Purpose** | Config oracle, service registry, fiat pricing relay, cross-chain SWAP coordinator |
| **Inputs** | JSON-RPC CRUD calls from all other services; external fiat price feeds |
| **Outputs** | Config values, service endpoints, fiat prices, SWAP coordination data |
| **Storage** | LevelDB (`P:{coin}-{network}-{module}:{paramName}` key schema) |
| **Communication** | Inbound JSON-RPC from all services; outbound HTTP for fiat pricing |

Key technical details:

- Single instance serves all chains and networks simultaneously.
- Stores per-module configuration as key-value pairs: fee rates, gas token address, supported encoding formats, network parameters.
- Acts as the service discovery registry — services register their endpoints on startup and look up peers.
- Coordinates cross-chain SWAP actions by holding SWAP state across two chains.
- Explorer and SDK poll the hub every 60 seconds to refresh their config caches.

See [`../components/hub/`](../components/hub/) for full documentation.

---

### xchain-node

| | |
|---|---|
| **Purpose** | CLI tool for installing, configuring, and managing all platform services as Docker containers |
| **Inputs** | Operator CLI commands |
| **Outputs** | Running Docker containers; status reports |
| **Storage** | Local config files |
| **Communication** | Docker Engine API; downloads service images from registry |

Key technical details:

- Downloads and configures coin nodes (bitcoind, litecoind, dogecoind) alongside all platform services.
- Creates Docker containers with a consistent naming scheme: `xchain-node-{service}-{coin}-{network}`.
- All containers share a Docker bridge network, enabling DNS-based service discovery.
- Blessed TUI provides a real-time status dashboard in the terminal.
- Supports create, start, stop, update, and monitor operations per container.
- A single xchain-node installation can manage multiple chains and networks simultaneously.

See [`../components/node/`](../components/node/) for full documentation.

---

### xchain-regtest-miner

| | |
|---|---|
| **Purpose** | Auto-mines mempool transactions for regtest development environments |
| **Inputs** | Coin node JSON-RPC (mempool polling every 1 second) |
| **Outputs** | Mined blocks via `generatetoaddress` |
| **Storage** | None |
| **Communication** | Outbound JSON-RPC to coin node; inbound JSON-RPC control API |

Key technical details:

- On detecting mempool transactions, waits up to 30 seconds (resetting to 5 seconds on each new arrival) before mining.
- Inbound JSON-RPC control API: `ping`, `send_funds`, `fill_mempool`, `continue_mining`, `set_mining_time`.
- Only used in regtest; not deployed in testnet or mainnet environments.

See [`../components/regtest-miner/`](../components/regtest-miner/) for full documentation.

---

### xchain-e2e-test

| | |
|---|---|
| **Purpose** | End-to-end Mocha test suite that exercises the full platform stack |
| **Inputs** | Live regtest environment (all services running) |
| **Outputs** | Pass/fail test results |
| **Storage** | None |
| **Communication** | JSON-RPC to encoder, explorer, hub; indirect via SDK |

Key technical details:

- Uses BIP39/BIP32 wallet generation to create deterministic test addresses.
- Tests run in order and share blockchain and indexer state — each test builds on the output of prior tests.
- Discovers service endpoints from xchain-hub.
- Requires xchain-regtest-miner to be running to advance blocks.

See [`../components/e2e-test/`](../components/e2e-test/) for full documentation.

---

## Full Connection Diagram

```
                         +------------------+
                         |   xchain-hub     |  (LevelDB)
                         |  config + disco  |
                         +------------------+
                           ^    ^    ^    ^
                    config |    |    |    | config
                           |    |    |    |
         +-----------+     |    |    |    |     +-----------+
         | xchain-   |-----+    |    |    +-----| xchain-   |
         |   sdk     |          |    |          | explorer  |
         +-----------+          |    |          +-----------+
               |                |    |                |
               | JSON-RPC       |    |         SQL    |
               v                |    |         reads  v
         +-----------+          |    |     +------------------+
         | xchain-   |          |    |     | Indexer MariaDB  |
         |  encoder  |          |    |     | XChain_{C}_{N}_  |
         +-----------+          |    |     | Indexer          |
               |                |    |     +------------------+
               | PSBT           |    |                ^
               v                |    |         SQL    |
         User signs +           |    |         writes |
         broadcasts             |    |     +-----------+
               |                |    |     | xchain-   |
               v                |    +-----| indexer   |
         +-----------+          |          +-----------+
         | Coin Node |          |                ^
         | (bitcoind |          |          SQL   |
         |  etc.)    |          |          reads |
         +-----------+          |     +------------------+
               ^    |           |     | Decoder MariaDB  |
               |    | JSON-RPC  |     | XChain_{C}_{N}_  |
          mine |    | polling   |     | Decoder          |
               |    v           |     +------------------+
         +-----------+          |                ^
         | regtest-  |          |         SQL    |
         |  miner    |          |         writes |
         +-----------+          |     +-----------+
                                +-----| xchain-   |
         +-----------+                | decoder   |
         | utxo-     |<-- polling ----+-----------+
         | tracker   |-- LevelDB         ^
         +-----------+                   |
               ^                  JSON-RPC polling
               | JSON-RPC                |
               | queries           +-----------+
               +-------------------| Coin Node |
                                   +-----------+
```

---

## Multi-Chain Deployment

Each core pipeline service (decoder, indexer, explorer, utxo-tracker, encoder) runs as a separate instance per chain/network combination. xchain-hub runs as a single shared instance across all chains.

A full mainnet deployment across all three supported chains requires:

| Service | Instances | Notes |
|---|---|---|
| Coin nodes | 3 | One each for Bitcoin, Litecoin, Dogecoin |
| xchain-decoder | 3 | One per coin |
| xchain-indexer | 3 | One per coin |
| xchain-explorer | 3 | One per coin |
| xchain-utxo-tracker | 3 | One per coin |
| xchain-encoder | 3 | One per coin (or shared if stateless routing used) |
| xchain-hub | 1 | Shared across all chains |
| xchain-node | 1 | Manages all containers |

Adding a new chain means adding one more set of pipeline instances (coin node + decoder + indexer + explorer + utxo-tracker + encoder) and registering them with the hub.

---

## Deployment Configurations

**Minimal (regtest development):**
- 1 coin node (regtest)
- decoder + indexer + explorer + encoder + utxo-tracker (all pointing to regtest)
- xchain-hub
- xchain-regtest-miner
- xchain-e2e-test (run on demand)

**Full mainnet:**
- 3 coin nodes + full pipeline set per coin + xchain-hub + xchain-node
- No regtest-miner or e2e-test in production

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
