# XChain Platform — Overview

## What is XChain?

XChain is an open-source token protocol that runs on top of existing blockchains. It enables anyone to create, transfer, trade, and manage tokens without deploying a separate blockchain or smart contract. Token operations are encoded directly into standard blockchain transactions, making them as permanent and decentralized as the underlying chain itself.

The platform is designed to be **blockchain-agnostic**. Any Bitcoin-compatible blockchain can be added to the platform with a coin-specific configuration file — the core protocol, indexer logic, and ACTION commands remain identical across all chains. Today XChain supports Bitcoin, Litecoin, and Dogecoin, with the architecture ready to support additional blockchains.

The platform provides:

- **Token creation and management** — issue tokens with configurable supply, decimals, minting rules, and transfer restrictions
- **Multi-format transfers** — single sends, multi-sends, airdrops, dividends, and sweeps
- **Decentralized exchange (DEX)** — on-chain order books, automatic matching, and token vending machines (dispensers)
- **Cross-chain swaps** — trade tokens across any supported blockchains
- **On-chain data** — file uploads, encrypted messaging, broadcast oracles
- **Programmable token rules** — allow/block lists, minting windows, callbacks, sleep/resume

All of this is accomplished with 19 ACTION commands embedded in standard blockchain transactions. No sidechains, no bridges, no separate consensus mechanism.

## Supported Blockchains

The platform currently supports **Bitcoin**, **Litecoin**, and **Dogecoin** across mainnet, testnet, and regtest networks. The architecture is blockchain-agnostic — any Bitcoin-compatible chain can be added with a single configuration file. Regtest networks can also be used for private blockchain deployments.

See [Supported Blockchains](./BLOCKCHAINS.md) for the full list of supported chains, network types, requirements for adding new blockchains, and details on regtest and private deployments.

## How It Works

XChain data is embedded in blockchain transactions as small obfuscated payloads. A platform node watches the blockchain, extracts these payloads, decodes them into ACTION commands, validates them against protocol rules, and maintains the resulting token state in a database. Users and applications query this state through APIs.

### The Data Flow

```
                    ┌─────────────────────────────────────────────────┐
                    │              USER / APPLICATION                  │
                    └──────┬──────────────┬──────────────┬────────────┘
                           │              │              │
                    ┌──────▼──────┐       │       ┌──────▼──────┐
                    │  xchain-sdk │       │       │  xchain-    │
                    │  (generate  │       │       │  explorer   │
                    │   actions)  │       │       │  (query     │
                    └──────┬──────┘       │       │   state)    │
                           │              │       └──────▲──────┘
                    ┌──────▼──────┐       │              │
                    │  xchain-    │  Sign & Broadcast     │
                    │  encoder    │       │              │
                    │  (PSBT out) │       │              │
                    └──────┬──────┘       │              │
                           │              │              │
         ┌─────────────────▼──────────────▼──────┐       │
         │           Coin Node                   │       │
         │     (bitcoind / litecoind /           │       │
         │      dogecoind)                       │       │
         └──────┬─────────────────────┬──────────┘       │
                │                     │                  │
         ┌──────▼──────┐       ┌──────▼──────┐           │
         │  xchain-    │       │  xchain-    │           │
         │  utxo-      │       │  decoder    │           │
         │  tracker    │       │  (extract   │           │
         │  (UTXO &    │       │   ACTIONs)  │           │
         │   balance   │       └──────┬──────┘           │
         │   queries)  │              │                  │
         └─────────────┘       ┌──────▼──────┐           │
                               │  Decoder DB │           │
                               │  (MariaDB)  │           │
                               └──────┬──────┘           │
                                      │                  │
                               ┌──────▼──────┐           │
                               │  xchain-    │           │
                               │  indexer    │           │
                               │  (validate  │           │
                               │   & execute │           │
                               │   ACTIONs)  │           │
                               └──────┬──────┘           │
                                      │                  │
                               ┌──────▼──────┐           │
                               │  Indexer DB │───────────┘
                               │  (MariaDB)  │
                               └─────────────┘

         ┌─────────────┐       ┌──────────────┐  ┌─────────────────┐
         │  xchain-hub │       │  xchain-     │  │  xchain-        │
         │  (config &  │       │  regtest-    │  │  e2e-test       │
         │  cross-chain│       │  miner       │  │  (full-stack    │
         │  oracle)    │       │  (dev only)  │  │   test suite)   │
         └─────────────┘       └──────────────┘  └─────────────────┘

         ◄──────────── Managed by xchain-node (Docker) ───────────►
```

### Step by Step

1. **Construct** — The user (or SDK) builds an ACTION string following the protocol specification — a pipe-delimited command like `SEND|0|MYTOKEN|100|bc1qrecipient`
2. **Encode** — The encoder embeds the ACTION string into a PSBT (Partially Signed Bitcoin Transaction). The data is obfuscated with AES-128-CTR encryption and written into the transaction outputs using one of four encoding methods (OP_RETURN, P2SH, P2WSH, or multisign)
3. **Sign & Broadcast** — The user signs the PSBT with their wallet's private key and broadcasts the completed transaction to the blockchain network
4. **Confirm** — The transaction is included in a block by miners (or auto-mined in regtest by xchain-regtest-miner)
5. **Decode** — The decoder polls the coin node for new blocks, scans each transaction for the `XCHN` magic prefix, decrypts the obfuscated data, and writes the raw decoded ACTION data to the Decoder database
6. **Index** — The indexer reads decoded transactions from the Decoder database, validates each ACTION against protocol rules (checking balances, permissions, token state, allow/block lists, sleep states), executes valid actions (updating the ledger, matching DEX orders, processing expirations), and writes the authoritative state to the Indexer database
7. **Query** — The explorer reads from the Indexer database and exposes the data through 50+ REST/JSON-RPC endpoints, and a web-based block explorer with market data, transaction history, and token analytics

Every step after broadcast is fully deterministic — given the same blockchain data, every indexer will produce identical state. This means anyone can independently verify the state by running their own node.

## Architecture

### Component Overview

The platform is composed of independent microservices, each with a single responsibility. They communicate through databases and JSON-RPC APIs, and are deployed as Docker containers managed by xchain-node. The entire platform is written in Node.js with no TypeScript — raw JavaScript throughout.

### Core Pipeline

These three services form the backbone of the platform. They process blockchain data in sequence, transforming raw block data into queryable token state.

#### xchain-decoder

| | |
|---|---|
| **Purpose** | Extracts XChain transactions from blockchain blocks |
| **Input** | Blockchain data via coin node JSON-RPC |
| **Output** | Decoded ACTION data written to Decoder database (MariaDB) |
| **Storage** | MariaDB (Decoder database) |
| **Repository** | [xchain-decoder](https://github.com/XChain-platform/xchain-decoder/) |

The decoder is a long-running polling process that watches a coin node for new blocks. For each block, it:

- Fetches the full block data via JSON-RPC (`getblock`, `getrawtransaction`)
- Parses each transaction using bitcoinjs-lib, handling chain-specific quirks (Litecoin's HogEx flag, Dogecoin's AuxPoW headers)
- Scans transaction outputs for XChain protocol data
- Deobfuscates payloads using AES-128-CTR (key/IV derived from the first input's txid)
- Verifies the `XCHN` magic prefix
- Reassembles multi-output data (P2SH/P2WSH/multisign payloads may span multiple outputs)
- Writes decoded ACTION strings, source/destination addresses, and block metadata to the Decoder database
- Detects chain reorganizations and records reorg blocks for the indexer to handle
- Tracks mempool transactions for real-time dispenser protocol support

The decoder normalizes all data into indexed tables — addresses, transaction hashes, and block data are stored with integer IDs for efficient lookups.

#### xchain-indexer

| | |
|---|---|
| **Purpose** | Validates and executes ACTION commands, maintains authoritative token state |
| **Input** | Decoded ACTION data from the Decoder database |
| **Output** | Token state, balances, DEX orders, ledger entries written to Indexer database |
| **Storage** | MariaDB (Indexer database) with 60+ tables |
| **Repository** | [xchain-indexer](https://github.com/XChain-platform/xchain-indexer/) |
| **Documentation** | [Indexer Developer Guide](./components/indexer/) |

The indexer is the most complex component. It reads decoded transactions and applies the full protocol logic:

- **ACTION routing** — Each transaction is parsed and routed to one of 20 action handlers, each in its own class file
- **Validation** — Every field is validated against protocol rules: token existence, balance sufficiency, address permissions, sleep states, allow/block lists, format correctness
- **Ledger operations** — Valid actions generate credits (tokens added), debits (tokens removed), and escrows (tokens locked). Balances are computed as `SUM(credits) - SUM(debits)`
- **DEX matching** — The ORDER and SWAP handlers automatically match compatible offers and execute trades
- **Expiration processing** — After each block, expired orders, swaps, and dispensers are processed and escrowed tokens are released
- **Sanity checking** — After every block, the indexer verifies that every token's supply equals its net ledger total. A mismatch indicates a bug and triggers a rollback
- **Atomic block processing** — All writes for a block are wrapped in a single database transaction. Failures roll back the entire block cleanly
- **Reorg handling** — When the decoder reports a reorganization, the indexer rolls back all affected data, recalculates balances and token state, and re-indexes from the fork point
- **Watchdog timeout** — A configurable per-block timeout (default 5 minutes) prevents deadlocks or infinite loops

The indexer's database contains 60+ tables organized into core tables (blocks, transactions, actions), ledger tables (credits, debits, escrows, balances, fees), action-specific tables (one per ACTION type plus status/edit/cancel/expire tables), index tables (normalized string lookups), and mapping tables (action↔address↔ticker cross-references).

#### xchain-explorer

| | |
|---|---|
| **Purpose** | REST/JSON-RPC APIs and web UI for querying platform state |
| **Input** | Reads from the Indexer database |
| **Output** | HTTP responses (JSON APIs and HTML pages) |
| **Storage** | None (reads Indexer DB directly) |
| **Repository** | [xchain-explorer](https://github.com/XChain-platform/xchain-explorer/) |

The explorer provides three interfaces:

- **REST API** — 50+ endpoints for querying balances, tokens, transactions, history, markets, and more
- **JSON-RPC API** — Same functionality accessible via JSON-RPC 2.0 POST requests
- **Web UI** — Bootstrap-based block explorer with token pages, address pages, transaction details, market charts (Highcharts), and search

The explorer supports config discovery from the hub with a 60-second sync interval, SSL/TLS for production deployments, and a market data relay endpoint for price feeds. The database layer uses raw parameterized SQL with ~5,500 lines of query logic — no ORM.

### Transaction Creation Services

These services help users construct and broadcast XChain transactions.

#### xchain-encoder

| | |
|---|---|
| **Purpose** | Encodes ACTION data into unsigned PSBTs |
| **Input** | ACTION string + UTXOs + public key |
| **Output** | Unsigned PSBT (base64) ready for wallet signing |
| **Storage** | None (stateless) |
| **Repository** | [xchain-encoder](https://github.com/XChain-platform/xchain-encoder/) |

The encoder takes an ACTION string and produces an unsigned PSBT that a wallet can sign and broadcast. It handles:

- **Format auto-selection** — Automatically picks the most efficient encoding format based on payload size
- **AES-128-CTR obfuscation** — Encrypts the ACTION data using the first input's txid
- **Four encoding methods** — OP_RETURN (≤76 bytes, single transaction), P2SH (larger payloads, two transactions), P2WSH (SegWit variant), multisign (largest payloads, single transaction)
- **UTXO management** — Selects inputs, calculates fees, handles change outputs

The encoder runs as a JSON-RPC API server and is also available as a browser bundle via webpack for client-side PSBT generation.

#### xchain-utxo-tracker

| | |
|---|---|
| **Purpose** | Indexes all UTXOs and serves balance/UTXO queries for the encoder |
| **Input** | Blockchain data via coin node JSON-RPC |
| **Output** | UTXO and balance queries via JSON-RPC API |
| **Storage** | LevelDB |
| **Repository** | [xchain-utxo-tracker](https://github.com/XChain-platform/xchain-utxo-tracker/) |

The UTXO tracker maintains a real-time index of all unspent transaction outputs on the blockchain. This is essential for constructing new transactions — you need to know which UTXOs an address controls to build valid inputs.

- **Real-time indexing** — Polls the coin node and parses blocks, writing UTXOs to LevelDB in batches of 100 blocks
- **Key schema** — Prefix-based LevelDB keys: `B`=block, `T`=tx, `I`=input, `O`=output, `H`/`J`=hints
- **Reorg handling** — Maintains a 10-block undo history for rolling back reorganized blocks
- **Mempool tracking** — Tracks unconfirmed transactions in a separate in-memory database
- **Bootstrap support** — Can restore from compressed tar archives for fast initial sync
- **Outputs indexed by scriptPubKey hash** — Enables efficient lookup by address

#### xchain-sdk

| | |
|---|---|
| **Purpose** | Developer SDK for generating XChain actions and querying blockchain data |
| **Input** | Action parameters from the developer's application |
| **Output** | ACTION strings, PSBTs, explorer query results |
| **Storage** | None (stateless) |
| **Repository** | [xchain-sdk](https://github.com/XChain-platform/xchain-sdk/) |
| **Documentation** | [SDK Developer Guide](./components/sdk/) |

The SDK is the primary developer interface to the platform. It provides:

- **19 action convenience methods** — `sdk.send()`, `sdk.issue()`, `sdk.mint()`, `sdk.order()`, etc.
- **Automatic format selection** — Picks the smallest encoding format version for each action to minimize transaction size
- **Fluent batch builder** — `sdk.batch().send({...}).mint({...}).build()` for multi-action transactions
- **Explorer client** — 40 query methods for balances, tokens, transactions, markets, and history with automatic pagination
- **Encoder client** — PSBT generation with pre-flight validation
- **Hub discovery** — Auto-resolve service endpoints from xchain-hub with live config polling
- **Retry with backoff** — Handles HTTP 429/502/503/504, respects `Retry-After` headers
- **Request lifecycle hooks** — `onRequest`, `onResponse`, `onError`, `onRetry` callbacks for logging and instrumentation
- **Connection pooling** — HTTP keep-alive for high-throughput applications
- **Three usage modes** — Node.js library import, JSON-RPC microservice, and browser bundle

The SDK validates all inputs locally before making any network requests, catching errors like invalid ticker names, missing required fields, and BATCH constraint violations at construction time.

### Infrastructure Services

#### xchain-hub

| | |
|---|---|
| **Purpose** | Configuration oracle and cross-chain action coordinator |
| **Storage** | LevelDB |
| **Repository** | [xchain-hub](https://github.com/XChain-platform/xchain-hub/) |

The hub is the shared configuration store for the platform. It provides:

- **Service discovery** — Other services (explorer, SDK) poll the hub to discover API endpoints, ports, and connection details
- **COIN pricing data** — Fiat pricing information for supported cryptocurrencies
- **Cross-chain coordination** — Coordinates SWAP matching across different blockchains
- **CRUD via JSON-RPC** — Simple key-value store with JSON-RPC interface for reading and writing config parameters

Config keys follow the format `P:{coin}-{network}-{module}:{paramName}`. The hub is typically shared across all chains — a single hub instance serves the entire platform deployment.

#### xchain-node

| | |
|---|---|
| **Purpose** | CLI tool for installing, configuring, and managing all XChain services |
| **Storage** | LevelDB (state persistence) |
| **Repository** | [xchain-node](https://github.com/XChain-platform/xchain-node/) |

The node manager is the orchestration tool that makes running the platform practical. It handles:

- **Installation** — Downloads and configures coin nodes (bitcoind, litecoind, dogecoind) and all XChain services
- **Docker orchestration** — Creates, starts, stops, updates, and monitors Docker containers named `xchain-node-{service}-{coin}-{network}`
- **Terminal UI** — Blessed-based TUI for monitoring all service statuses in real time
- **Auto-update** — Fetches remote version information and updates containers
- **Pre-flight checks** — Verifies Docker is installed, required directories exist, and network connectivity is available
- **Multi-chain support** — A single node installation can run services for Bitcoin, Litecoin, and Dogecoin simultaneously

#### xchain-regtest-miner

| | |
|---|---|
| **Purpose** | Auto-mines blocks for regtest development environments |
| **Storage** | None (stateless) |
| **Repository** | [xchain-regtest-miner](https://github.com/XChain-platform/xchain-regtest-miner/) |

In regtest mode, blocks are not mined automatically — they must be generated manually. The regtest miner provides:

- **Mempool monitoring** — Checks the mempool every second for new transactions
- **Batched mining** — Waits up to 30 seconds (with a 5-second reset timer on each new transaction) before mining, allowing related transactions to be included in the same block
- **JSON-RPC methods** — `ping`, `send_funds`, `fill_mempool`, `continue_mining`, `set_mining_time` for test automation
- **Wallet management** — Constructs raw PSBTs for funding test addresses

#### xchain-e2e-test

| | |
|---|---|
| **Purpose** | End-to-end test suite exercising the full platform stack |
| **Repository** | [xchain-e2e-test](https://github.com/XChain-platform/xchain-e2e-test/) |

The E2E test suite runs against a live regtest deployment and verifies the entire pipeline:

- Creates BIP39/BIP32 wallets programmatically
- Funds addresses through the regtest miner
- Constructs and broadcasts XChain transactions
- Polls the indexer until records appear
- Verifies token state, balances, and transaction status
- Tests are ordered and share state — later tests build on wallets and tokens created by earlier tests

### Multi-Chain, Multi-Network Deployment

Every pipeline component (decoder, indexer, explorer, UTXO tracker) runs as a separate instance per chain and network. The deployment scales linearly with the number of supported chains. A full mainnet deployment indexing all three currently supported chains runs:

```
3 coin nodes       (bitcoind, litecoind, dogecoind)
3 decoders         → 3 Decoder databases
3 indexers         → 3 Indexer databases
3 explorers
3 UTXO trackers
3 encoders
1 hub              (shared across all chains)
1 node manager
```

Adding a fourth blockchain would simply add another set of pipeline services. The hub, node manager, and SDK require no changes — only a new coin configuration file.

A minimal development setup might run a single chain on regtest:

```
1 coin node        (bitcoind -regtest)
1 decoder          → 1 Decoder database
1 indexer          → 1 Indexer database
1 explorer
1 UTXO tracker
1 encoder
1 hub
1 regtest miner
1 e2e test suite
```

A private enterprise deployment could run a single chain in regtest mode with no connection to any public network — the same full-featured platform in a completely controlled environment.

### Database Architecture

The platform uses two database technologies:

**MariaDB** — Used by the decoder, indexer, and explorer for relational data. Database names follow the convention `XChain_{CHAIN}_{NETWORK}_{COMPONENT}`:

| Database | Written By | Read By |
|---|---|---|
| `XChain_BTC_Mainnet_Decoder` | xchain-decoder | xchain-indexer |
| `XChain_BTC_Mainnet_Indexer` | xchain-indexer | xchain-explorer |
| `XChain_LTC_Mainnet_Decoder` | xchain-decoder | xchain-indexer |
| `XChain_LTC_Mainnet_Indexer` | xchain-indexer | xchain-explorer |
| `XChain_DOGE_Mainnet_Decoder` | xchain-decoder | xchain-indexer |
| `XChain_DOGE_Mainnet_Indexer` | xchain-indexer | xchain-explorer |

All SQL uses parameterized queries (no ORM). Big-number arithmetic uses the `mathjs` bignumber library to avoid JavaScript floating-point precision issues with token amounts.

**LevelDB** — Used by the hub, UTXO tracker, and node manager for key-value storage. LevelDB databases are stored in Docker volumes for persistence.

### Communication Patterns

Services communicate exclusively through:

- **MariaDB** — Decoder writes → Indexer reads → Explorer reads (unidirectional pipeline)
- **JSON-RPC over HTTP** — All service APIs use JSON-RPC 2.0 over HTTP POST. The encoder, UTXO tracker, hub, SDK, and regtest miner all expose JSON-RPC endpoints
- **Coin node JSON-RPC** — The decoder and UTXO tracker communicate with coin nodes using the standard Bitcoin JSON-RPC interface

There is no message queue, event bus, or pub/sub system. The indexer discovers new data by polling the Decoder database every 5 seconds. The explorer reads directly from the Indexer database with no caching layer.

### Docker Networking

All services run on a shared Docker network created by xchain-node. Container names follow the pattern `xchain-node-{service}-{coin}-{network}`, enabling DNS-based service discovery within the Docker network. Environment variables point each service to its dependencies by container name.

## Protocol

### ACTION Encoding

XChain ACTION data is embedded in blockchain transactions using a two-layer encoding scheme:

**Layer 1: Obfuscation**

The raw ACTION string is prepended with the 4-byte magic prefix `XCHN` and encrypted with AES-128-CTR. The key material comes from the first input's transaction ID:

- **Key**: First 16 hex characters of the txid
- **IV**: Next 16 hex characters of the txid

This is obfuscation, not security — anyone with the txid (which is public) can decrypt the data. The purpose is to prevent naive scanning and to make the protocol data opaque to tools that don't understand XChain.

**Layer 2: Transaction Embedding**

The obfuscated bytes are written into the transaction using one of four methods:

| Method | Max Data per Chunk | Transactions Required | Best For |
|---|---|---|---|
| `OP_RETURN` | 76 bytes | 1 | Most SENDs, simple ISSUEs, MINTs |
| `P2SH` | 476 bytes | 2 (fund + spend) | Medium actions, multi-sends |
| `P2WSH` | 9,956 bytes | 2 (fund + spend) | Large actions, long lists |
| `Multisign` | ~61 bytes per key | 1 | Alternative for larger payloads |

The encoder automatically selects the most efficient method based on payload size. OP_RETURN is preferred when the data fits because it requires only one transaction and doesn't lock up any funds.

For P2SH and P2WSH, the encoding uses a two-phase transaction pattern:
1. **Phase 1 (Fund)** — A transaction is created that locks funds to a script hash containing the ACTION data
2. **Phase 2 (Spend)** — A second transaction spends from that script, revealing the data in the scriptSig/witness

### ACTION Format

Every ACTION follows the same pipe-delimited format:

```
ACTION|VERSION|PARAM1|PARAM2|...
```

- **ACTION** — Command name in uppercase (SEND, ISSUE, MINT, ORDER, etc.)
- **VERSION** — Integer format version determining how parameters are interpreted
- **PARAMS** — Action-specific fields, each separated by a pipe character (`|`)

Multiple actions can be combined in a single transaction using the BATCH command:

```
BATCH|0;SEND|0|TOKEN1|100|addr1;SEND|0|TOKEN2|50|addr2
```

Sub-actions within a BATCH are separated by semicolons (`;`). BATCH has protocol constraints: no nested BATCHes, no FILE actions, at most one MINT, and at most one ISSUE per batch.

### The 19 ACTION Commands

| Category | Actions | What They Do |
|---|---|---|
| **Token Lifecycle** | ISSUE, MINT, DESTROY, CALLBACK, SLEEP | Create tokens, mint supply, burn supply, recall tokens, pause trading |
| **Transfers** | SEND, SWEEP, AIRDROP, DIVIDEND | Move tokens between addresses — individually, in bulk, or proportionally |
| **DEX** | ORDER, DISPENSER | Trade tokens on the decentralized exchange or via vending machines |
| **Cross-Chain** | SWAP | Trade tokens across any supported blockchains |
| **Data** | BROADCAST, MESSAGE, FILE | Publish messages, send encrypted communications, upload files |
| **Utility** | ADDRESS, BATCH, LINK, LIST | Configure preferences, batch operations, cross-reference actions, create lists |

Each ACTION supports one or more format versions. Format versions allow the same action to serve different use cases without changing the command name. For example, SEND has four versions:

| Version | Name | Use Case |
|---|---|---|
| `0` | Single Send | Send one token to one address |
| `1` | Multi-Send (Brief) | Send same token to multiple addresses |
| `2` | Multi-Send (Full) | Send different tokens to multiple addresses |
| `3` | Multi-Send + Memos | Different tokens with per-recipient memos |

See the [ACTION Command Specifications](./protocol/actions/) for the full protocol spec of each command.

### Token System

#### Creating Tokens

Any address can create a token by broadcasting an ISSUE action with a unique ticker name. The ISSUE action defines:

- **TICK** — Ticker name (1-250 characters from a defined character set)
- **MAX_SUPPLY** — Maximum supply that can ever exist (up to 10^21)
- **DECIMALS** — Decimal places (0-18)
- **MAX_MINT** — Maximum amount per MINT transaction
- **MINT_SUPPLY** — Amount to mint immediately on creation
- **DESCRIPTION** — Up to 250 characters
- **Locks** — Individual locks on MAX_SUPPLY, MINT, MINT_SUPPLY, MAX_MINT, DESCRIPTION, SLEEP, and CALLBACK — once locked, these parameters can never be changed
- **Access control** — ALLOW_LIST and BLOCK_LIST referencing LIST action indexes
- **Minting windows** — MINT_START_BLOCK and MINT_STOP_BLOCK define when minting is allowed
- **Per-address limits** — MINT_ADDRESS_MAX caps how much any single address can mint
- **Callbacks** — CALLBACK_BLOCK, CALLBACK_TICK, and CALLBACK_AMOUNT define recall terms

Token issuance requires paying a fee in the XCHAIN gas token. The token creator becomes the owner and can update non-locked parameters with subsequent ISSUE actions.

#### Token Rules and Restrictions

Ticker names must use characters from the allowed set (`a-zA-Z0-9~!@#$%^&*()_+-={}[]:<>.?`). The names `BTC`, `LTC`, `DOGE`, and `XCHAIN` are reserved by the protocol — only the designated GAS address on each chain can issue the `XCHAIN` token.

Tokens can reference other tokens by ticker name or by ticker ID (using the `^ID` syntax for numeric references). This prevents ambiguity if tickers contain special characters.

#### Transfers and Permissions

Before any transfer, the indexer validates:

1. The token exists
2. The sender has sufficient balance
3. The sender is not sleeping (ADDRESS action can pause an address)
4. The token is not sleeping (SLEEP action can pause a token)
5. The sender is authorized (passes allow/block list checks)
6. The recipient is authorized (passes allow/block list checks)
7. Memo requirements are met (recipient ADDRESS preferences may require a memo)

This validation happens for every SEND, AIRDROP, DIVIDEND, SWEEP, and any DEX operation that moves tokens.

### Gas Token (XCHAIN)

`XCHAIN` is the platform's native fee token. It exists on every supported chain independently — XCHAIN on one chain is a separate token from XCHAIN on another chain.

#### Fee Schedule

| Operation | Fee | Notes |
|---|---|---|
| Token issuance | `ISSUANCE_FEE_TOKEN` | Per chain (e.g., 1.0 XCHAIN on BTC) |
| Sub-token issuance | `ISSUANCE_FEE_SUBTOKEN` | Per chain (e.g., 0.5 XCHAIN on BTC) |
| DEX listing (extended) | `EXPIRATION_FEE_PER_DAY` | Charged per day beyond the free period |
| DEX listing (standard) | Free | Up to `EXPIRATION_FEE_FREE_DAYS` (e.g., 182 days on BTC) |

Fee amounts are configurable per chain in the coin-specific config files. Fees are recorded in the ledger as debits from the source address with credits split between two donation addresses: one for protocol development and one for community development.

#### Special Addresses

Each chain/network combination defines four special addresses:

| Address | Purpose |
|---|---|
| **BURN** | Tokens sent here are permanently destroyed |
| **GAS** | The only address authorized to issue the XCHAIN gas token |
| **DONATE1** | Receives protocol development fee share |
| **DONATE2** | Receives community development fee share |

### Decentralized Exchange (DEX)

The platform includes a built-in decentralized exchange with two trading mechanisms:

#### Order Book (ORDER)

- Users place buy/sell orders specifying a give token, give amount, get token, and get amount
- The indexer automatically matches compatible orders based on price
- Matched orders execute atomically — both sides complete or neither does
- Tokens are escrowed when an order is placed and released when matched or when the order expires/is cancelled
- Orders have configurable expiration periods

#### Dispensers (DISPENSER)

Dispensers are token vending machines:

- A user creates a dispenser defining: the token being dispensed, the price (in another token), and the quantity available
- Anyone can trigger a dispenser by sending the correct token and amount to the dispenser's address
- The dispenser automatically dispenses the configured token in return
- Dispensers can be edited, cancelled, or expire based on configuration
- A single dispenser can handle up to 1,000 dispenses

### Ledger Model

The indexer maintains a double-entry ledger for all token movements:

- **Credits** — Tokens added to an address: receiving a SEND, minting new tokens, receiving dividends, receiving an airdrop, receiving from a dispenser, receiving escrow releases
- **Debits** — Tokens removed from an address: sending tokens, destroying tokens, paying fees, funding dispensers, placing DEX orders
- **Escrows** — Tokens locked for pending operations: DEX orders (held until matched or expired), dispensers (held until dispensed or closed), cross-chain swaps (held until matched or expired)

Balances are computed as:

```
balance = SUM(credits) - SUM(debits)
```

Escrows are tracked separately and do not affect the balance formula but are subtracted from the available balance for new operations.

#### Sanity Checking

After every block, the indexer verifies that for every token:

```
token_supply = SUM(credits) - SUM(debits)
```

This runs inside the block's database transaction. If the check fails, the entire block is rolled back automatically. A sanity check failure indicates a bug in the indexer — no tokens can be created or destroyed except through valid protocol operations.

### Chain Reorganization Handling

Every database-backed component (decoder, indexer, UTXO tracker) handles blockchain reorganizations:

1. **Detection** — The decoder detects that the chain tip has changed to a different fork and records the reorg block number
2. **Rollback** — The indexer detects the reorg record, identifies all affected data (addresses, tickers, market pairs), and deletes records from 40+ tables within a single database transaction
3. **Recalculation** — Balances and token state are recalculated from the remaining ledger data
4. **Verification** — A sanity check confirms consistency after the rollback
5. **Re-indexing** — Normal block processing resumes from the fork point

Rollbacks are atomic — either the entire rollback succeeds or the database is left unchanged. The UTXO tracker maintains a 10-block undo history for efficient rollback of its LevelDB state.

### Protocol Versioning

The indexer uses a `ProtocolChanges` class to control when each ACTION becomes active. Every action is registered with:

- A semantic version of the indexer that introduced it
- Activation timestamps per network (mainnet, testnet, regtest)
- Activation block heights per network

An action is only processed if the current indexer version, block time, and block height all meet or exceed the registered thresholds. This allows new features to be deployed with a predictable activation schedule — new indexer versions can be released ahead of time and will automatically enable new features at the specified block.

All 19 user-facing actions are currently registered at version `1.0.0` with immediate activation (block 0, time 0). Future protocol upgrades will use non-zero activation values to coordinate network-wide feature rollouts.

## What You Can Build

### Token Platforms

Issue tokens with custom supply, decimals, minting rules, and transfer restrictions. Tokens can have:

- **Allow/block lists** — Restrict which addresses can send or receive the token
- **Minting windows** — Define start and stop blocks for when minting is allowed
- **Per-address mint limits** — Cap how much any single address can mint
- **Lockable parameters** — Permanently lock supply, minting, description, sleep, or callback settings to build trust
- **Ownership transfer** — Transfer token ownership to a new address
- **Callbacks** — Enable a mechanism to recall tokens from all holders after a specified block, exchanging them for a different token

Use SLEEP to pause all trading during specific events, or ADDRESS to configure per-address preferences like requiring a memo on all incoming transfers.

### Decentralized Exchanges

The built-in DEX supports on-chain order books with automatic matching:

- Place buy/sell orders with configurable expiration periods
- The indexer matches compatible orders automatically
- Token vending machines (DISPENSER) provide automated token sales — send the right amount of the right token and receive tokens back automatically
- Market data (last price, volume, order depth) is tracked and available through the explorer API

### Cross-Chain Trading

SWAP actions enable atomic token swaps between any supported blockchains:

- Create a swap offer on one chain specifying the desired token and amount on another chain
- The hub coordinates matching across chains
- Tokens are escrowed during the swap and released to the appropriate parties when both sides complete

### NFTs and Digital Assets

- Use **FILE** to upload data on-chain (file name, MIME type, title, content)
- Use **LINK** to associate files with tokens (e.g., link an image FILE to a token ISSUE)
- Use the **Token Information Standard** to attach rich metadata (images, audio, video, social links, contact info) to any token via JSON
- Supported metadata formats: direct image URLs, imgur, SoundCloud, YouTube, IPFS, Ordinals inscriptions

### Messaging and Oracles

- **MESSAGE** supports plaintext and encrypted messaging between addresses, with two encryption methods: Elliptic-curve Diffie-Hellman (ECDH) and Advanced Encryption Standard (AES)
- **BROADCAST** creates permanent on-chain messages and oracle feeds that other systems can consume — useful for price feeds, attestations, and public announcements
- Messages can be up to 1 MB in size

### Airdrops and Dividends

- **AIRDROP** distributes tokens to addresses in one or more lists — create a LIST of addresses once and reference it from multiple airdrops
- **DIVIDEND** pays proportionally to all holders of a token — every address holding the specified token receives a share proportional to their holdings
- Both operations validate balances and permissions for every recipient address

### Batch Operations

The **BATCH** action allows combining multiple operations in a single transaction:

- Issue a token and mint initial supply in one transaction
- Send tokens to multiple addresses with different tokens and amounts
- Combine administrative operations (update description + transfer ownership)
- Protocol constraints prevent abuse: no nested batches, no file uploads, limits on mint and issue operations per batch

## Tech Stack

| Technology | Used By | Purpose |
|---|---|---|
| **Node.js** | All services | Runtime environment (no TypeScript) |
| **Express** | All API services | HTTP server framework |
| **express-json-rpc-router** | All API services | JSON-RPC 2.0 request routing |
| **MariaDB** | Decoder, Indexer, Explorer | Relational data storage |
| **LevelDB** | Hub, UTXO Tracker, Node | Key-value storage |
| **bitcoinjs-lib** | Encoder, Decoder, UTXO Tracker | Bitcoin transaction parsing and construction |
| **mathjs** | Indexer, Explorer, SDK | Arbitrary-precision big-number arithmetic |
| **axios** | Decoder, Explorer, Hub, SDK | HTTP client for JSON-RPC calls |
| **helmet** | All API services | HTTP security headers |
| **cors** | All API services | Cross-Origin Resource Sharing |
| **dotenv** | All services | `.env` file configuration loading |
| **blessed** | Node | Terminal UI for monitoring |
| **Docker** | All services | Container deployment |

## Security Model

### Data Integrity

- **Deterministic processing** — Given the same blockchain data, every indexer produces identical state
- **Atomic transactions** — All database writes for a block are committed or rolled back as a unit
- **Sanity checking** — Per-block verification that token supplies match ledger totals
- **Parameterized SQL** — All database queries use parameterized statements to prevent SQL injection
- **Table whitelisting** — Rollback queries validate table names against a whitelist
- **Database name validation** — Database names are validated against `[A-Za-z0-9_]` before use

### Protocol Safety

- **Balance validation** — Every transfer verifies the sender has sufficient balance before execution
- **Replay protection** — Each action is assigned a unique, sequential `action_index`
- **Permission enforcement** — Allow/block lists, sleep states, and address preferences are checked on every operation
- **Escrow accounting** — DEX orders and dispensers lock tokens in escrow, preventing double-spending

### Network Security

- **Helmet** — All API services use Helmet for HTTP security headers
- **CORS** — Configurable CORS origin restrictions
- **SSL/TLS** — Explorer supports SSL for production deployments
- **Circuit breaker** — Database connections use a circuit breaker pattern to prevent cascade failures

## Documentation

| Section | Description |
|---|---|
| [Getting Started](./getting-started/) | Platform intro, quickstarts for developers and operators, glossary |
| [Core Concepts](./concepts/) | Metalayer, tokens, ACTIONs, encoding, cross-chain, gas, security model |
| [Architecture](./architecture/) | Data pipeline, component map, database design |
| [Components](./components/) | Detailed docs for each of the 10 microservices |
| [Developer Guide](./developer-guide/) | Tutorials: build tokens, dispensers, query data, integrate |
| [User Guide](./user-guide/) | Capabilities, use cases, FAQ — no code required |
| [Protocol Spec](./protocol/) | 19 ACTION definitions, Token Information Standard, schemas |
| [Operations](./operations/) | Deployment, Docker, monitoring, upgrades, troubleshooting |
| [Supported Blockchains](./BLOCKCHAINS.md) | Supported chains/networks, adding new blockchains, regtest, private deployments |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
