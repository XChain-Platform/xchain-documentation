<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Indexer — Architecture

## Position in the Data Pipeline

```
Coin Node (bitcoind / litecoind / dogecoind)
    ↓  JSON-RPC polling
xchain-decoder  →  Decoder DB (MariaDB)
    ↓  SQL reads
xchain-indexer  →  Indexer DB (MariaDB)
    ↓  SQL reads
xchain-explorer  →  REST / JSON-RPC / Web UI
```

The indexer sits between the decoder and the explorer. It reads raw decoded transaction data from the Decoder database (read-only access), processes each transaction through the appropriate ACTION handler, and writes the resulting state to the Indexer database. The explorer then reads from the Indexer database to serve API queries and render the web interface.

## Internal Components

```
┌─────────────────────────────────────────────────────────┐
│                      api.js                             │
│              Express + JSON-RPC server                  │
│         Validates env vars, starts indexer              │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  XChainIndexer                          │
│              Main orchestrator class                    │
│        Block polling loop (5s interval)                 │
│     Reorg detection → block processing → sanity check  │
├──────────────┬──────────────┬───────────────────────────┤
│              │              │                           │
│  ┌───────────▼──┐  ┌───────▼────────┐  ┌──────────────┐│
│  │   Actions    │  │   Database     │  │  Rollback    ││
│  │  20 handlers │  │  2 pool conns  │  │  Atomic undo ││
│  │  + aliases   │  │  (decoder+idx) │  │  by block    ││
│  └──────┬───────┘  └───────┬────────┘  └──────────────┘│
│         │                  │                           │
│  ┌──────▼───────┐  ┌───────▼────────┐  ┌──────────────┐│
│  │   Utility    │  │    Mapper      │  │  Protocol    ││
│  │  Math, timer │  │  action_index  │  │  Changes     ││
│  │  Expirations │  │  ↔ addr/tick   │  │  Activation  ││
│  │  Ledger ops  │  │  mappings      │  │  by version  ││
│  └──────────────┘  └────────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Source Files

| File | Class | Role |
|---|---|---|
| `src/api.js` | — | Entry point: Express server + JSON-RPC, env var validation, indexer startup |
| `src/XChainIndexer.js` | `XChainIndexer` | Main orchestrator: block polling loop, reorg detection, block processing pipeline |
| `src/actions.js` | `Actions` | Loads all 20+ action handler classes, routes transactions to the correct handler |
| `src/db.js` | `Database` | MariaDB connection pool management, all SQL queries, table creation, sanity checks |
| `src/config.js` | — | Merges environment variables with coin-specific config into a single config object |
| `src/configs/BTC.js` | — | Bitcoin-specific: fee schedules, BURN/GAS/DONATE addresses per network |
| `src/configs/LTC.js` | — | Litecoin-specific configuration |
| `src/configs/DOGE.js` | — | Dogecoin-specific configuration |
| `src/utility.js` | `Utility` | BigNumber math, timer functions, expiration/cancellation processing, ledger operations |
| `src/mapper.js` | `Mapper` | Creates action_index ↔ address/tick cross-reference mappings |
| `src/rollback.js` | `Rollback` | Handles blockchain reorganizations: deletes affected records, recalculates balances |
| `src/protocol_changes.js` | `ProtocolChanges` | Defines supported actions and their activation rules (version, block, timestamp) |

## Action Handlers (`src/actions/*.js`)

Each ACTION type has its own class file. Every handler follows the same pattern:

1. Receive `params` (pipe-delimited fields), `data` (transaction metadata), and `error` (pre-existing validation error)
2. Parse and validate all fields against protocol rules
3. Check token existence, balances, permissions, sleep states, allow/block lists
4. Write the action record to its corresponding table (e.g., `sends`, `issues`, `orders`)
5. Process ledger changes (credits, debits, escrows)
6. Update balances and token state
7. Create action mappings for indexing

Actions with automatic lifecycle events have companion handlers:

| Primary Action | Companion Handlers |
|---|---|
| `DISPENSER` | `dispenser_close.js`, `dispenser_expire.js`, `dispense.js` |
| `ORDER` | `order_expire.js`, `order_match.js` |
| `SWAP` | `swap_expire.js`, `swap_match.js` |

Action aliases provide backward compatibility and shorthand:

| Alias | Resolves To |
|---|---|
| `DEPLOY` | `ISSUE` |
| `TRANSFER` | `SEND` |
| `ADDR` | `ADDRESS` |
| `DROP` | `AIRDROP` |
| `CAST` | `BROADCAST` |
| `MSG` | `MESSAGE` |

## Block Processing Pipeline

Each iteration of the main loop performs these steps in order:

### 1. Reorg Detection

The indexer reads the last reorg block from the Decoder database. If a reorganization is detected and the indexer has already processed past that block, the `Rollback` class:

- Identifies the first `action_index` at or after the reorg block
- Collects all affected addresses, tickers, and market pairs
- Deletes all records from data tables where `action_index >= firstActionIndex`
- Deletes all records from block tables where `block_index >= reorgBlock`
- Recalculates balances for all affected addresses
- Recalculates token state for all affected tickers
- Updates DEX market information
- Runs a sanity check to verify consistency
- All operations are wrapped in a single database transaction

### 2. Transaction Processing

For each unprocessed block:

- Fetch all decoded transactions for the block from the Decoder database
- Begin a database transaction (all writes for a block are atomic)
- For each transaction:
  - Parse the pipe-delimited ACTION data
  - Resolve any action aliases
  - Verify the ACTION is defined and activated for the current block
  - Create `tx_index` and `action_index` records
  - Route to the appropriate action handler via `Actions.processAction()`

### 3. Expiration and Cancellation Processing

After all transactions in a block are processed:

- **Expirations**: Check for expired ORDERs, SWAPs, and DISPENSERs based on block time
- **Cancellations**: Check for cancelled DISPENSERs based on configurable delay timers

### 4. Block Finalization

- Create a `blocks` record with SHA-256 hashes of the ledger (credits/debits/escrows) and actions tables for the block
- Update DEX market information (order books, last price, volume)
- Run a sanity check verifying all token supplies match their ledger totals

### 5. Watchdog Timeout

The entire block processing pipeline runs under a configurable timeout (`BLOCK_PROCESS_TIMEOUT`, default 5 minutes). If a block takes longer than this, the indexer throws an error and rolls back the transaction, preventing deadlocks or infinite loops from stalling the indexer.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
