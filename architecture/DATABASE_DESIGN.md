<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Database Design

XChain uses two database technologies — MariaDB for relational data and LevelDB for key-value data — with a strict separation between raw decoded data and validated indexer state.

## The Dual-Database Model

The core pipeline uses two MariaDB databases per chain/network: a Decoder DB and an Indexer DB. They serve different purposes and are owned by different services.

```
Blockchain
    |
    | (raw bytes, JSON-RPC)
    v
xchain-decoder
    |
    | writes raw decoded data
    v
Decoder MariaDB  (XChain_{CHAIN}_{NETWORK}_Decoder)
    |
    | polls every 5s
    v
xchain-indexer
    |
    | writes validated state
    v
Indexer MariaDB  (XChain_{CHAIN}_{NETWORK}_Indexer)
    |
    | direct SQL reads
    v
xchain-explorer  →  REST / JSON-RPC / Web UI
```

### Decoder DB

The Decoder DB is the decoder's output and the indexer's input. It stores:

- Block records (height, hash, timestamp)
- Transaction records (txid, block height, sender addresses)
- Raw decoded ACTION strings, exactly as extracted from the transaction

The Decoder DB does **not** interpret or validate ACTION content. It is a faithful transcription of what the decoder found on-chain. Because the source of truth is the blockchain itself, the Decoder DB can be destroyed and rebuilt from scratch by re-running the decoder from block 0.

### Indexer DB

The Indexer DB is the indexer's output and the explorer's input. It stores the validated, processed state of all XChain actions: token records, ledger entries, order books, balances, and more.

The Indexer DB contains business logic outcomes — tokens that passed validation, balances after debits and credits, orders that matched. Because it is derived deterministically from the Decoder DB, it can also be rebuilt from scratch.

The separation serves several purposes:

- **Separation of concerns**: the decoder focuses on extraction; the indexer focuses on validation. Bugs in one do not compromise the other.
- **Rebuildability**: either database can be rebuilt independently. Rebuild the Decoder DB from the blockchain; rebuild the Indexer DB from the Decoder DB.
- **Auditability**: the raw decoded ACTION string in the Decoder DB can always be compared against the indexer's interpretation of it, making disputes traceable.

---

## Naming Convention

All MariaDB databases follow a structured naming convention:

```
XChain_{CHAIN}_{NETWORK}_{COMPONENT}
```

| Segment | Values |
|---|---|
| `CHAIN` | `BTC`, `LTC`, `DOGE` |
| `NETWORK` | `Mainnet`, `Testnet`, `Regtest` |
| `COMPONENT` | `Decoder`, `Indexer` |

### Full Database Name Matrix

| Chain | Mainnet Decoder | Mainnet Indexer | Regtest Decoder | Regtest Indexer |
|---|---|---|---|---|
| Bitcoin | `XChain_BTC_Mainnet_Decoder` | `XChain_BTC_Mainnet_Indexer` | `XChain_BTC_Regtest_Decoder` | `XChain_BTC_Regtest_Indexer` |
| Litecoin | `XChain_LTC_Mainnet_Decoder` | `XChain_LTC_Mainnet_Indexer` | `XChain_LTC_Regtest_Decoder` | `XChain_LTC_Regtest_Indexer` |
| Dogecoin | `XChain_DOGE_Mainnet_Decoder` | `XChain_DOGE_Mainnet_Indexer` | `XChain_DOGE_Regtest_Decoder` | `XChain_DOGE_Regtest_Indexer` |

Testnet databases follow the same pattern with `Testnet` as the network segment.

For the full specification, see [`../protocol/Database_Naming_Structure.md`](../protocol/Database_Naming_Structure.md).

---

## MariaDB: Relational Storage

MariaDB is used wherever the data is relational and queryable: the Decoder DB, the Indexer DB, and indirectly by the explorer.

All SQL is written as raw parameterized queries using the `mariadb` npm package. There is no ORM. All numeric amounts (token quantities, fees, balances) are handled using `mathjs` bignumber arithmetic throughout the indexer and explorer to avoid floating-point precision loss.

### Indexer DB Table Categories

The Indexer DB has 60+ tables organized into five categories:

**Core tables** — track the blocks, transactions, and actions that have been processed:

- `blocks` — one row per processed block (height, hash, timestamp, processing status)
- `transactions` — one row per transaction containing a valid XChain action
- `actions` — one row per decoded action (raw string, action type, validity, block height)

**Ledger tables** — the double-entry accounting system:

- `credits` — every inflow of tokens to an address (mint, receive, escrow release)
- `debits` — every outflow of tokens from an address (send, fee, escrow lock)
- `escrows` — tokens locked pending order matching, dispenser activity, or swap completion
- `balances` — materialized view of current holdings per address per ticker (computed from credits minus debits)
- `fees` — gas fees collected per action

Every token movement creates both a credit and a debit entry. The invariant `token_supply == SUM(all credits) - SUM(all debits)` is checked after issuance actions.

**Action-specific tables** — one or more tables per ACTION type, storing the parameters and state for each action kind. For actions that can be edited, cancelled, or expired, additional status tables track state transitions. Examples include tables for orders, dispensers, dividends, airdrops, broadcasts, files, links, lists, callbacks, swaps, and sweeps.

**Index tables** — normalized string lookups to avoid repeating variable-length strings (tickers, addresses, hashes) across every row. Numeric foreign keys reference these tables from the core and ledger tables.

**Mapping tables** — join tables that associate actions with their related addresses and tickers, supporting efficient queries like "all actions involving address X" or "all actions for ticker Y."

---

## LevelDB: Key-Value Storage

LevelDB is used for services that need fast key-value access without relational joins.

### xchain-utxo-tracker

Stores the full UTXO set of the monitored coin node. Key schema uses single-character prefixes:

| Prefix | Contents |
|---|---|
| `B` | Block records (height → hash) |
| `T` | Transaction records (txid → metadata) |
| `I` | Input records (txid:vout → spending txid) |
| `O` | Output records (txid:vout → value, scriptPubKey) |
| `H` / `J` | Address hints (scriptPubKey hash → txids) |

Writes are batched in groups of 100 blocks. Ten blocks of undo data are retained to support reorg rollback.

### xchain-hub

Stores service configuration and cross-chain coordination state. Key schema:

```
P:{coin}-{network}-{module}:{paramName}
```

Example: `P:BTC-Mainnet-indexer:gasFee` stores the current gas fee for the Bitcoin mainnet indexer module.

---

## Atomic Block Processing

Every write the indexer makes for a given block is wrapped in a single MariaDB transaction. All ledger entries, action records, token state changes, and expiration updates for a block either commit together or roll back together. There is no partial block state.

On chain reorganization, the indexer rolls back across all 40+ affected tables in a single transaction, restoring the database to the state it was in before the reorged blocks were processed.

---

## Further Reading

- Full Indexer DB schema and table definitions: [`../components/indexer/DATABASE.md`](../components/indexer/DATABASE.md)
- Database naming specification: [`../protocol/Database_Naming_Structure.md`](../protocol/Database_Naming_Structure.md)

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
