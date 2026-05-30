<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Data Pipeline

This document traces the end-to-end data flow from a user constructing a transaction to that transaction being queryable through the explorer. The pipeline is intentionally simple: blockchain data flows in one direction through a series of stateless or append-only services, with polling rather than an event bus at each seam.

## Example: Issuing a Token

The walkthrough below follows a single `ISSUE` action — a user creating a new token called `MYTOKEN` with 1,000,000 units and 8 decimal places.

---

### Step 1 — SDK Constructs the ACTION String

The developer calls the SDK's `issue()` method:

```js
sdk.issue({ tick: 'MYTOKEN', supply: 1000000, decimals: 8, ... })
```

The SDK formats this into a pipe-delimited ACTION string:

```
ISSUE|0|MYTOKEN|1000000|8|...
```

Before encoding, the SDK queries xchain-hub to retrieve current network configuration (fee rates, gas requirements, supported formats) and queries xchain-utxo-tracker to retrieve spendable UTXOs for the sender's address. For fee-bearing actions, the SDK also calls the hub's `getfeequote` method to calculate the native coin fee amount via the decentralized oracle (gas → XCHAIN → USD → native coin). These reads give the SDK everything it needs to build a valid encoding request, including the protocol fee output.

---

### Step 2 — Encoder Embeds the ACTION in a PSBT

The SDK calls the encoder's JSON-RPC API, passing the ACTION string, the sender's UTXOs, and their public key. The encoder:

1. **Selects a format** based on payload length:
   - `OP_RETURN` — up to 80 bytes per output (76 bytes user data + 4-byte XCHN prefix), single transaction
   - `multisig` — up to ~61 bytes per key, single transaction
   - `P2SH` — up to 476 bytes, two-transaction pattern
   - `P2WSH` — up to 9,956 bytes, two-transaction pattern

2. **Obfuscates the payload** using AES-128-CTR. The key is the first 16 hex characters of the first input's txid; the IV is the next 16. This is deterministic — any observer with the txid can reverse it — but it filters casual blockchain scanners.

3. **Prepends the magic prefix** `XCHN` (4 bytes) after obfuscation, so the decoder can identify XChain payloads.

4. **Returns an unsigned PSBT** (Partially Signed Bitcoin Transaction). For two-transaction formats, the encoder returns both PSBTs in sequence: a funding transaction and a reveal transaction.

The encoder is entirely stateless. It holds no database and takes no network calls to coin nodes. The same inputs always produce the same output.

---

### Step 3 — User Signs and Broadcasts

The caller (SDK, wallet, or custom client) signs the PSBT with the sender's private key and broadcasts the resulting transaction to the coin node's mempool via standard JSON-RPC (`sendrawtransaction`). For two-transaction formats, the funding transaction is broadcast first; the reveal transaction is broadcast only after the funding transaction confirms.

---

### Step 4 — Transaction Enters the Mempool and Gets Mined

From this point, the transaction is a normal blockchain transaction. Miners pick it up, include it in a block, and the block propagates across the network. In regtest environments, xchain-regtest-miner handles this step automatically (see [Regtest Variant](#regtest-variant) below).

---

### Step 5 — Decoder Polls, Identifies, and Stores

The decoder polls the coin node every few seconds via JSON-RPC (`getblockcount`, `getblockhash`, `getblock`, `getrawtransaction`). When it finds a new block:

1. **Parses each transaction** using bitcoinjs-lib. Coin-specific pre-processing is applied first:
   - Litecoin: strip the HogEx flag from the block header before parsing
   - Dogecoin: strip AuxPoW merge-mining headers before parsing

2. **Scans outputs** for the `XCHN` magic prefix after deobfuscation. Deobfuscation uses the first input's txid, so the decoder must retrieve the full transaction (including inputs) to reconstruct the key and IV.

3. **Writes raw data** to the Decoder MariaDB (`XChain_{CHAIN}_{NETWORK}_Decoder`). The decoder stores the block, the transaction metadata, and the raw decoded ACTION string. It does not interpret or validate the ACTION content — that is the indexer's job.

4. **Detects reorgs** by comparing stored block hashes to the chain tip. If a reorg is detected, the decoder rolls back to the last common block before continuing.

5. **Tracks the mempool** separately for the dispenser protocol, which needs to respond to unconfirmed transactions.

---

### Step 6 — Indexer Polls, Validates, and Executes

The indexer polls the Decoder DB every 5 seconds. When it finds a new decoded action it has not yet processed:

1. **Routes** the ACTION string to the appropriate handler class (one of 20 action handlers — `IssueAction`, `SendAction`, `OrderAction`, etc.).

2. **Validates** all fields. For `ISSUE`, this means checking: the ticker does not already exist, the sender holds enough XCHAIN gas to pay the fee, the supply and decimals are within protocol limits, and the format string is well-formed.

3. **Executes** the business logic atomically:
   - Creates a token record in the tokens table
   - Creates ledger entries: a credit for the minted supply to the sender's address
   - Deducts the gas fee (a debit from the sender's XCHAIN balance, credit to the gas address)
   - Records the action in the actions table with status `valid`

4. **Writes to the Indexer DB** (`XChain_{CHAIN}_{NETWORK}_Indexer`) inside a single database transaction. All writes for a block either commit together or roll back together.

5. **Handles validation failures** gracefully: an action that fails validation is written to the actions table with status `invalid`, and no ledger entries are created. The block still commits.

6. **Processes expirations** after each block: open orders, active dispensers, COINPay obligations, and other time-bounded objects are checked against the current block height and expired if necessary.

7. **Detects reorgs** by monitoring the Decoder DB for block hash changes. On reorg, the indexer rolls back across 40+ tables in a single transaction.

The indexer is deterministic: given the same Decoder DB contents, it will always produce the same Indexer DB state. There is no external I/O during block processing.

---

### Step 7 — Explorer Serves the Data

The explorer reads directly from the Indexer DB. It exposes:

- **REST endpoints** — over 50 routes covering tokens, balances, orders, transactions, dispensers, and more
- **JSON-RPC 2.0** — for programmatic access following the same interface used by Counterparty-compatible tools
- **Bootstrap web UI** — browser interface with Highcharts for market data visualization

A query like `GET /token/MYTOKEN` triggers a SQL read against the Indexer DB and returns the token record created in Step 6. Because the explorer reads directly from MariaDB (no caching layer), it reflects the state of the last committed indexer block.

The explorer syncs configuration from xchain-hub every 60 seconds — fee schedules, supported chains, and oracle price data. The hub is a decentralized validator network providing PBFT-consensus config, price oracle (trimmed median aggregation across 36 COIN/FIAT pairs), on-chain PRICE v0 publishing via the `oracle_publish` capability, cross-chain attestation, external attestation framework (`http_get`/`llm` providers), and governance. Consumers connect to multiple hub endpoints via `HUB_VALIDATORS` for high availability.

### PRICE Oracle Data Flow

In addition to the validation pipeline above, oracle price data flows separately:

```
Validators with `price` capability fetch from CoinGecko/CMC
  → PBFT consensus on prices (signs canonical PRICE v0 payload)
    → A validator with `oracle_publish` capability writes PRICE v0 to a chain
      → That chain's decoder + indexer process the action
        → Indexer validates PBFT signatures, writes to local prices table
          → Indexer pushes validated round to xchain-hub
            → Hub deduplicates by round_number, writes to price_snapshots
              → Hub broadcasts new row to all indexers' local hub DB copies
                → Indexers query their local hub DB for fee validation,
                  FIAT dispenser settlement, and VM oracle queries
```

Capability assignment is governed entirely by stake amount — a validator with sufficient aggregate stake against its pubkey qualifies for every capability whose `min_stake` it meets. Self-tests are local to each hub and gate participation, not the federation-wide quorum count.

User TOKEN/FIAT oracles (PRICE v1) follow a similar flow but skip the PBFT signature requirement — any address can publish, and the hub enforces a 24-hour lock window on subsequent updates to prevent dispenser front-running.

### Step 7b — WebSocket Pushes Real-Time Events

The explorer's WebSocket server polls the Indexer DB every 5 seconds for new blocks and actions (the same DB the REST API reads from). When changes are detected, it pushes events to subscribed clients:

- **NEW_BLOCK** / **NEW_ACTION** — raw block and action events
- **Lifecycle events** — ORDER_MATCH, COINPAY_REQUIRED, SWAP_MATCH, DISPENSE, etc.
- **Entity updates** — ADDRESS_UPDATE, TOKEN_UPDATE, MARKET_UPDATE, DISPENSER_UPDATE

Clients subscribe to channels with filters (action types, statuses, token tickers) so they only receive relevant events. On reconnect, clients can request catch-up of missed events via `since_action_index`.

See the [Explorer WebSocket API Reference](../components/explorer/WEBSOCKET.md) and [SDK WebSocket Client](../components/sdk/WEBSOCKET.md) for details.

---

## Pipeline ASCII Diagram

```
  Developer / Wallet
        |
        |  ACTION string
        v
  +-----------+       +---------------+
  |  xchain   |------>|  xchain-hub   |  (config, oracle prices, fee quotes)
  |    sdk    |       | (validator    |
  |           |       |  network)     |
  |           |       +---------------+
  |           |------>+------------------+
  |           |       | xchain-utxo-     |  (UTXOs for sender)
  +-----------+       | tracker  LevelDB |
        |             +------------------+
        |  PSBT request (ACTION + UTXOs + pubkey)
        v
  +-----------+
  |  xchain-  |  (stateless; AES-128-CTR obfuscation)
  |  encoder  |
  +-----------+
        |
        |  unsigned PSBT
        v
  Developer signs + broadcasts
        |
        v
  Coin Node (bitcoind / litecoind / dogecoind)
   mempool → block
        |
        |  JSON-RPC polling
        v
  +-----------+       +----------------------+
  |  xchain-  |------>|  Decoder MariaDB     |
  |  decoder  |       |  XChain_{C}_{N}_     |
  |           |       |  Decoder             |
  +-----------+       +----------------------+
                                |
                                |  SQL polling (every 5s)
                                v
                      +-----------+       +----------------------+
                      |  xchain-  |------>|  Indexer MariaDB     |
                      |  indexer  |       |  XChain_{C}_{N}_     |
                      |           |       |  Indexer             |
                      +-----------+       +----------------------+
                                                    |
                                        +-----------+-----------+
                                        |                       |
                                        |  direct SQL reads     |  SQL polling (every 3s)
                                        v                       v
                              +-----------+           +------------------+
                              |  xchain-  |           |  xchain-indexer- |
                              |  explorer |           |  sync            |
                              +-----------+           +------------------+
                                    |                       |
                        REST / JSON-RPC / Web UI    REST / WebSocket API
                                    |                       |
                                Clients             Validator replicas
```

---

## Polling Intervals and the Absence of an Event Bus

Each seam in the pipeline uses polling rather than push notifications or a message queue. This is a deliberate trade-off:

- **Simplicity**: no broker infrastructure (Kafka, RabbitMQ, Redis Pub/Sub) to deploy, monitor, or tune. Each service can be started, stopped, or restarted independently without affecting others.
- **Auditability**: the Decoder DB is a complete, queryable record of every raw ACTION the decoder has ever seen. The Indexer DB is a complete record of every validated state transition. Both are inspectable with standard SQL tools.
- **Determinism**: because the indexer only reads from the Decoder DB and applies deterministic logic, running it again from scratch against the same Decoder DB always produces identical output.

The cost is latency: a transaction confirmed in a block will not appear in the explorer until the decoder poll finds the block (~seconds), the indexer poll picks up the decoded row (~5 seconds), and the explorer serves the next query. In practice this is 10–30 seconds of additional latency beyond block confirmation, which is acceptable for a protocol where block times are measured in minutes.

---

## Regtest Variant

In a local development environment, the full pipeline runs identically but with two additions:

- **xchain-regtest-miner** polls the coin node's mempool every 1 second. When it detects pending transactions, it waits up to 30 seconds (resetting to 5 seconds on each new arrival) and then calls `generatetoaddress` to mine a block. This means developers do not have to manually mine blocks.

- **xchain-e2e-test** drives the entire stack using a Mocha test suite. Tests construct actions via BIP39/BIP32 wallets, broadcast them, wait for the pipeline to process them, and assert the resulting explorer state. Tests run in order and share state across the suite — each test builds on the blockchain and indexer state left by the previous one.

In regtest, all services point to `Regtest` network databases (`XChain_BTC_Regtest_Decoder`, `XChain_BTC_Regtest_Indexer`, etc.), keeping regtest data fully isolated from testnet and mainnet.

---

## Determinism

The indexer's output is fully determined by its input (the Decoder DB) and its code. There is no randomness, no external API calls during block processing, and no dependency on wall-clock time beyond block heights. This means:

- **Replay**: destroy the Indexer DB, run the indexer from block 0 against the existing Decoder DB, and the result is bit-for-bit identical.
- **Verification**: multiple independent indexer instances reading the same Decoder DB will converge to the same state.
- **Auditability**: a disputed balance or token state can be traced back through ledger entries to the exact action and block that caused it.

The Decoder DB itself is rebuilt from the blockchain: destroy the Decoder DB, run the decoder from block 0, and it re-derives the same rows from on-chain data. Together, the two-stage pipeline means the full indexer state is reproducible from the raw blockchain alone.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
