<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Explorer — API Reference

## Overview

The explorer exposes a REST API for querying all XChain Platform state. Every endpoint returns JSON and uses parameterized SQL internally to prevent injection.

All API URLs follow the pattern:

```
GET /{COIN}/api/{method}/{query}/{type}
```

Where:
- **`{COIN}`** — Coin prefix identifying the chain and network (e.g., `BTC`, `TBTC`, `RDOGE`)
- **`{method}`** — The data category (e.g., `sends`, `balances`, `token`)
- **`{query}`** — The search value (address, block index, token ticker, tx hash, action index)
- **`{type}`** — The filter type that determines how `{query}` is interpreted (e.g., `address`, `block`, `token`)

### Coin Prefixes

| Network | Prefix |
|---|---|
| Bitcoin mainnet | `BTC` |
| Bitcoin testnet | `TBTC` |
| Bitcoin regtest | `RBTC` |
| Litecoin mainnet | `LTC` |
| Litecoin testnet | `TLTC` |
| Litecoin regtest | `RLTC` |
| Dogecoin mainnet | `DOGE` |
| Dogecoin testnet | `TDOGE` |
| Dogecoin regtest | `RDOGE` |

### Base URL

```
http://{host}:{port}/{COIN}/api/
```

---

## Response Format

### API Response

All API endpoints return:

```json
{
    "data": [ ... ],
    "total": 42,
    "runtime": "15ms"
}
```

| Field | Type | Description |
|---|---|---|
| `data` | array | Array of result objects (or a single object for detail endpoints) |
| `total` | number | Total number of matching records (for paginated endpoints) |
| `runtime` | string | Server-side query execution time |

### Error Responses

| Status | Cause |
|---|---|
| `400` | Bad request or database query error |
| `404` | Invalid endpoint path |
| `429` | Rate limit exceeded (500 requests per 60s window) |
| `503` | Coin not configured or database unavailable |

---

## Pagination

All list endpoints support pagination via query parameters:

| Parameter | Type | Description |
|---|---|---|
| `page` | number | Page number (1-based) |
| `limit` | number | Results per page (capped per endpoint) |
| `sortorder` | string | Sort direction: `ASC` or `DESC` |
| `start` | number | Row offset (alternative to `page`) |
| `length` | number | Row count (alternative to `limit`) |

**Result limits:**
- Most endpoints: max 100 results per page
- `getBalances` and `getHolders`: max 500 results per page

```bash
# Page 2 of sends, 25 per page, newest first
curl "http://localhost:8080/BTC/api/sends/bc1q.../address?page=2&limit=25&sortorder=DESC"
```

---

## System Endpoints

### Get Status

Returns configuration info about all supported and available coins.

```
GET /{COIN}/api/status
```

**Parameters:** None

**Response:**
```json
{
    "data": {
        "supported": ["BTC", "TBTC", "RBTC", "LTC", ...],
        "available": ["BTC", "RBTC"]
    }
}
```

---

### Get Network

Returns aggregate network statistics: total counts of each action type and overall network info.

```
GET /{COIN}/api/network
```

**Parameters:** None

**Response:**
```json
{
    "data": {
        "total_sends": 1234,
        "total_issues": 567,
        "total_orders": 89,
        "total_dispensers": 45,
        ...
    }
}
```

---

## Token Endpoints

### Get Token

Returns full token information for a single ticker.

```
GET /{COIN}/api/token/{tick}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `tick` | path | Token ticker name |

**Response fields:** Token metadata including supply, max supply, decimals, owner address, description, lock states, mint parameters, and creation info.

**Example:**
```bash
curl http://localhost:8080/BTC/api/token/MYTOKEN
```

```json
{
    "data": {
        "tick": "MYTOKEN",
        "max_supply": "1000000.00000000",
        "supply": "500000.00000000",
        "decimals": 8,
        "owner": "bc1q...",
        "description": "My token description",
        "lock_supply": 0,
        "lock_mint": 0,
        "lock_description": 0,
        "block_index": 800000,
        "action_index": 42
    }
}
```

---

### Get Tokens

Returns a list of tokens filtered by various criteria.

```
GET /{COIN}/api/tokens/{query}/{type}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `query` | path | Search value |
| `type` | path | Filter type (see below) |

**Type values:**

| Type | Query interpretation | Description |
|---|---|---|
| `block` | Block index | Tokens created in a specific block |
| `address` | Address string | Tokens owned by an address |
| `token` | Ticker (wildcard) | Token search by name (supports partial matching) |
| `subtoken` | Parent ticker | Sub-tokens of a parent token |

**Pagination:** Supported

**Example:**
```bash
# All tokens owned by an address
curl "http://localhost:8080/BTC/api/tokens/bc1q.../address?limit=50"

# Search tokens by name
curl http://localhost:8080/BTC/api/tokens/MY/token
```

---

## Balance & Address Endpoints

### Get Balances

Returns all token balances held by an address.

```
GET /{COIN}/api/balances/{address}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `address` | path | Blockchain address |

**Pagination:** Supported (max 500 results)

**Response:** Array of balance objects with tick, balance amount, and token details.

**Example:**
```bash
curl http://localhost:8080/BTC/api/balances/bc1qexampleaddress
```

---

### Get Address

Returns summary information for an address.

```
GET /{COIN}/api/address/{address}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `address` | path | Blockchain address |

---

### Get Holders

Returns a ranked list of all holders for a given token.

```
GET /{COIN}/api/holders/{tick}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `tick` | path | Token ticker |

**Pagination:** Supported (max 500 results)

**Response:** Array of holder objects with address and balance, sorted by balance descending.

**Example:**
```bash
curl "http://localhost:8080/BTC/api/holders/MYTOKEN?limit=100"
```

---

### Get Credits

Returns credit records (incoming tokens: transfers, mints, airdrops, dispenser releases, escrow releases).

```
GET /{COIN}/api/credits/{query}/{type}
```

**Type values:** `block`, `address`

**Pagination:** Supported

---

### Get Debits

Returns debit records (outgoing tokens: transfers, destroys, fees, DEX funding).

```
GET /{COIN}/api/debits/{query}/{type}
```

**Type values:** `block`, `address`

**Pagination:** Supported

---

### Get Escrows

Returns escrow records (tokens locked in DEX orders, dispensers, or swaps).

```
GET /{COIN}/api/escrows/{query}/{type}
```

**Type values:** `block`, `address`

**Pagination:** Supported

---

## Transaction & History Endpoints

### Get Transaction

Returns a decoded XChain transaction with all associated actions.

```
GET /{COIN}/api/transaction/{query}/{type}
```

**Type values:**

| Type | Query interpretation |
|---|---|
| `tx_hash` | Transaction hash |
| `tx_index` | Transaction index number |

**Response fields:** tx_index, tx_hash, block_index, and an array of actions contained in the transaction.

**Example:**
```bash
curl http://localhost:8080/BTC/api/transaction/abc123.../tx_hash
```

---

### Get Action

Returns comprehensive details for a single XChain action by its action index. Includes the action record, associated credits, debits, escrows, and fees.

```
GET /{COIN}/api/action/{actionIndex}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `actionIndex` | path | The cross-chain action index number |

**Response:** Full action detail including the action type, all fields, transaction info, block info, and all ledger entries (credits, debits, escrows, fees) associated with this action.

**Example:**
```bash
curl http://localhost:8080/BTC/api/action/42
```

---

### Get Block

Returns block-level summary information.

```
GET /{COIN}/api/block/{blockIndex}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `blockIndex` | path | Block height |

**Response fields:** block_index, block_hash, block_time, transaction count, and action summary.

---

### Get History

Returns a unified history of all XChain activity matching the query. Combines all action types into a single chronological feed.

```
GET /{COIN}/api/history/{query}/{type}
```

**Type values:**

| Type | Query interpretation | Description |
|---|---|---|
| `block` | Block index | All actions in a specific block |
| `address` | Address string | All actions involving an address |
| `token` | Ticker name | All actions involving a token |
| `recent` | (ignored) | Most recent actions across all types |

**Pagination:** Supported

**Example:**
```bash
# Recent history for an address
curl "http://localhost:8080/BTC/api/history/bc1q.../address?limit=50&sortorder=DESC"

# Recent global activity
curl "http://localhost:8080/BTC/api/history/0/recent?limit=20"
```

---

## ACTION-Specific Endpoints

All ACTION-specific endpoints share the same URL pattern and accept pagination:

```
GET /{COIN}/api/{action_plural}/{query}/{type}
```

Each returns records of the corresponding ACTION type. The `{type}` parameter controls how `{query}` is interpreted.

### Sends

Token transfer records.

```
GET /{COIN}/api/sends/{query}/{type}
```

| Type | Query interpretation | Description |
|---|---|---|
| `block` | Block index | Sends in a specific block |
| `address` | Address | Sends where address is source or destination |
| `source` | Address | Sends from this address |
| `destination` | Address | Sends to this address |
| `token` | Ticker | Sends of a specific token |

**Example:**
```bash
curl "http://localhost:8080/BTC/api/sends/bc1q.../address?limit=25&sortorder=DESC"
```

---

### Issues

Token creation and update records (ISSUE action).

```
GET /{COIN}/api/issues/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Issues in a specific block |
| `address` | Issues by an address |
| `token` | Issues for a specific token |

---

### Mints

Token minting records.

```
GET /{COIN}/api/mints/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Mints in a specific block |
| `address` | Mints by or to an address |
| `source` | Mints initiated by this address |
| `destination` | Mints received at this address |
| `token` | Mints of a specific token |

---

### Destroys

Token burn/destroy records.

```
GET /{COIN}/api/destroys/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Destroys in a specific block |
| `address` | Destroys by an address |
| `token` | Destroys of a specific token |

---

### Orders

DEX order records (create, with status info).

```
GET /{COIN}/api/orders/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Orders in a specific block |
| `address` | Orders by an address |
| `token` | Orders involving a specific token |

**Response includes:** give/get coin, give/get tick, give/get amounts, expiration, status, and computed price fields.

---

### Order Matches

Records of matched (filled) orders.

```
GET /{COIN}/api/order_matches/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Order matches in a specific block |

---

### Order Cancels

Records of cancelled orders.

```
GET /{COIN}/api/order_cancels/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Order cancels in a specific block |
| `address` | Order cancels by an address |

---

### Order Edits

Records of edited orders.

```
GET /{COIN}/api/order_edits/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Order edits in a specific block |
| `address` | Order edits by an address |

---

### Order Expires

Records of expired orders.

```
GET /{COIN}/api/order_expires/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Order expirations in a specific block |
| `address` | Order expirations for an address |

---

### COINPay

Native coin payment actions that fulfill ORDER_MATCH obligations.

```
GET /{COIN}/api/coinpays/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | COINPay actions in a specific block |
| `address` | COINPay actions involving an address |

**Response includes:** obligation action_index, coin amount, txid, vout, status, block, timestamp.

```
GET /{COIN}/api/coinpay_expires/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | COINPay expirations in a specific block |
| `address` | COINPay expirations for an address |

```
GET /{COIN}/api/coinpay_obligations/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | COINPay obligations created in a specific block |
| `address` | COINPay obligations where this address is the payer or payee |

**Response includes:** payer address, payee address, coin, coin amount, expiration timestamp, status (pending_coinpay/fulfilled/expired).

---

### Dispensers

Vending-machine style token dispensers.

```
GET /{COIN}/api/dispensers/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Dispensers created in a specific block |
| `address` | Dispensers created by an address |
| `source` | Dispensers where this address is the source |
| `destination` | Dispensers where this address is the dispenser address |
| `token` | Dispensers for a specific token |

**Response includes:** give/get coin, give/get tick, give/get amounts, escrow amount, fiat pricing, status, expiration, allow/block lists.

---

### Dispenses

Records of dispenser purchases (triggered when someone sends the required amount to a dispenser address).

```
GET /{COIN}/api/dispenses/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Dispenses in a specific block |
| `address` | Dispenses involving an address (source or destination) |
| `source` | Dispenses from this address |
| `destination` | Dispenses to this address |
| `token` | Dispenses of a specific token |

---

### Dispenser Cancels

```
GET /{COIN}/api/dispenser_cancels/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Dispenser cancels in a specific block |
| `address` | Dispenser cancels by an address |

---

### Dispenser Closes

```
GET /{COIN}/api/dispenser_closes/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Dispenser closes in a specific block |
| `address` | Dispenser closes by an address |

---

### Dispenser Edits

```
GET /{COIN}/api/dispenser_edits/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Dispenser edits in a specific block |
| `address` | Dispenser edits by an address |

---

### Dispenser Expires

```
GET /{COIN}/api/dispenser_expires/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Dispenser expirations in a specific block |
| `address` | Dispenser expirations for an address |

---

### Swaps

Cross-chain token swap records.

```
GET /{COIN}/api/swaps/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Swaps in a specific block |
| `address` | Swaps by an address |
| `token` | Swaps involving a specific token |

**Response includes:** give/get coin, give/get tick, give/get amounts, get address, expiration, status, allow/block lists.

---

### Swap Matches

```
GET /{COIN}/api/swap_matches/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Swap matches in a specific block |

---

### Swap Cancels

```
GET /{COIN}/api/swap_cancels/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Swap cancels in a specific block |
| `address` | Swap cancels by an address |

---

### Swap Edits

```
GET /{COIN}/api/swap_edits/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Swap edits in a specific block |
| `address` | Swap edits by an address |

---

### Swap Expires

```
GET /{COIN}/api/swap_expires/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Swap expirations in a specific block |
| `address` | Swap expirations for an address |

---

### Sweeps

Records of SWEEP actions (transfer all assets to a destination).

```
GET /{COIN}/api/sweeps/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Sweeps in a specific block |
| `address` | Sweeps by an address |
| `source` | Sweeps from this address |
| `destination` | Sweeps to this address |

---

### Dividends

Proportional distribution records.

```
GET /{COIN}/api/dividends/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Dividends in a specific block |
| `address` | Dividends by an address |
| `token` | Dividends of a specific token |

---

### Airdrops

Airdrop distribution records.

```
GET /{COIN}/api/airdrops/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Airdrops in a specific block |
| `address` | Airdrops by an address |
| `token` | Airdrops of a specific token |

---

### Broadcasts

On-chain broadcast/oracle data.

```
GET /{COIN}/api/broadcasts/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Broadcasts in a specific block |
| `address` | Broadcasts by an address |

---

### Messages

On-chain encrypted or plaintext messages.

```
GET /{COIN}/api/messages/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Messages in a specific block |
| `address` | Messages where address is source or destination |
| `source` | Messages from this address |
| `destination` | Messages to this address |

---

### Files

On-chain file attachments.

```
GET /{COIN}/api/files/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Files in a specific block |
| `address` | Files uploaded by an address |
| `token` | Files associated with a specific token |

**Response includes:** file name, mime type, title, memo, and action metadata.

---

### Callbacks

Token callback action records.

```
GET /{COIN}/api/callbacks/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Callbacks in a specific block |
| `address` | Callbacks by an address |
| `token` | Callbacks for a specific token |

---

### Sleeps

Address or token pause records.

```
GET /{COIN}/api/sleeps/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Sleeps in a specific block |
| `address` | Sleeps by an address |
| `token` | Sleeps for a specific token |

---

### Addresses

ADDRESS action records (address preference configuration).

```
GET /{COIN}/api/addresses/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Address actions in a specific block |
| `address` | Address actions by an address |

---

### Batches

BATCH action records (multi-action transactions).

```
GET /{COIN}/api/batches/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Batches in a specific block |
| `address` | Batches by an address |

---

### Links

Cross-chain link records.

```
GET /{COIN}/api/links/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Links in a specific block |
| `address` | Links by an address |

---

### Lists

Address or tick list management records.

```
GET /{COIN}/api/lists/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Lists in a specific block |
| `address` | Lists by an address |

---

### Fees

Fee records (XCHAIN gas token charges).

```
GET /{COIN}/api/fees/{query}/{type}
```

| Type | Description |
|---|---|
| `block` | Fees in a specific block |
| `address` | Fees charged to an address |
| `source` | Fees from this address |
| `destination` | Fees to this address |
| `token` | Fees for a specific token |

---

### Mempool

Pending unconfirmed transaction data.

```
GET /{COIN}/api/mempool/{query}/{type}
```

| Type | Description |
|---|---|
| `address` | Mempool transactions for an address |
| `token` | Mempool transactions for a token |

> **Note:** This endpoint is reserved for future implementation.

---

## Market Endpoints

The explorer provides market data endpoints for the on-chain DEX (ORDER-based trading).

### List Markets

Returns all active trading pairs, or all markets involving a specific token.

```
GET /{COIN}/api/markets
GET /{COIN}/api/markets/{tick}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `tick` | path (optional) | Filter to markets involving this token |

**Response:** Array of market objects with tick1, tick2, and pricing information.

**Example:**
```bash
# All markets
curl http://localhost:8080/BTC/api/markets

# Markets involving MYTOKEN
curl http://localhost:8080/BTC/api/markets/MYTOKEN
```

---

### Get Market

Returns summary information for a specific trading pair.

```
GET /{COIN}/api/market/{tick1}/{tick2}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `tick1` | path | First token in the pair |
| `tick2` | path | Second token in the pair |

**Response:** Market summary with last price, volume, and price computed in both directions (tick1→tick2 and tick2→tick1).

**Example:**
```bash
curl http://localhost:8080/BTC/api/market/TOKENA/TOKENB
```

---

### Get Market History

Returns trade history (filled orders) for a market pair. Optionally filter to a single address.

```
GET /{COIN}/api/market/{tick1}/{tick2}/history
GET /{COIN}/api/market/{tick1}/{tick2}/history/{address}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `tick1` | path | First token in the pair |
| `tick2` | path | Second token in the pair |
| `address` | path (optional) | Filter to trades by this address |

**Pagination:** Supported

**Example:**
```bash
# All trades for a pair
curl "http://localhost:8080/BTC/api/market/TOKENA/TOKENB/history?limit=50"

# Trades by a specific address
curl http://localhost:8080/BTC/api/market/TOKENA/TOKENB/history/bc1q...
```

---

### Get Market Orders

Returns open orders for a market pair. Optionally filter to a single address.

```
GET /{COIN}/api/market/{tick1}/{tick2}/orders
GET /{COIN}/api/market/{tick1}/{tick2}/orders/{address}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `tick1` | path | First token in the pair |
| `tick2` | path | Second token in the pair |
| `address` | path (optional) | Filter to orders by this address |

**Pagination:** Supported

**Example:**
```bash
curl http://localhost:8080/BTC/api/market/TOKENA/TOKENB/orders
```

---

### Get Market Orderbook

Returns the aggregated order book for a market pair, split into bids and asks.

```
GET /{COIN}/api/market/{tick1}/{tick2}/orderbook
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `tick1` | path | First token in the pair |
| `tick2` | path | Second token in the pair |

**Response:**
```json
{
    "data": {
        "asks": [
            { "price": "0.50", "amount": "100" },
            ...
        ],
        "bids": [
            { "price": "0.45", "amount": "200" },
            ...
        ]
    }
}
```

**Example:**
```bash
curl http://localhost:8080/BTC/api/market/TOKENA/TOKENB/orderbook
```

---

## DataTables Explorer Endpoints

In addition to the REST API, the explorer provides a parallel set of endpoints designed for the web UI's jQuery DataTables integration. These endpoints use cursor-based pagination and return arrays instead of objects for compact transmission.

### URL Pattern

```
GET /{COIN}/explorer/{method}/{query}/{type}
```

### Response Format

```json
{
    "recordsTotal": 42,
    "recordsFiltered": 42,
    "data": [
        [1, "field1|field2|field3", 100],
        ...
    ],
    "runtime": "12ms"
}
```

Data arrays use pipe-delimited strings for multi-value fields.

### Pagination Parameters

| Parameter | Type | Description |
|---|---|---|
| `action` | string | Paging direction: `first`, `last`, `next`, `prev` |
| `offset` | number | Current cursor position (action_index or block_index) |
| `start` | number | Starting record offset |
| `length` | number | Records per page (max 100) |

### Available Explorer Endpoints

All REST API action endpoints have a corresponding Explorer endpoint:

| Explorer Endpoint | Corresponding API Endpoint |
|---|---|
| `/{COIN}/explorer/sends/{query}/{type}` | `/{COIN}/api/sends/{query}/{type}` |
| `/{COIN}/explorer/issues/{query}/{type}` | `/{COIN}/api/issues/{query}/{type}` |
| `/{COIN}/explorer/mints/{query}/{type}` | `/{COIN}/api/mints/{query}/{type}` |
| `/{COIN}/explorer/destroys/{query}/{type}` | `/{COIN}/api/destroys/{query}/{type}` |
| `/{COIN}/explorer/orders/{query}/{type}` | `/{COIN}/api/orders/{query}/{type}` |
| `/{COIN}/explorer/dispensers/{query}/{type}` | `/{COIN}/api/dispensers/{query}/{type}` |
| `/{COIN}/explorer/dispenses/{query}/{type}` | `/{COIN}/api/dispenses/{query}/{type}` |
| `/{COIN}/explorer/swaps/{query}/{type}` | `/{COIN}/api/swaps/{query}/{type}` |
| `/{COIN}/explorer/sweeps/{query}/{type}` | `/{COIN}/api/sweeps/{query}/{type}` |
| `/{COIN}/explorer/dividends/{query}/{type}` | `/{COIN}/api/dividends/{query}/{type}` |
| `/{COIN}/explorer/airdrops/{query}/{type}` | `/{COIN}/api/airdrops/{query}/{type}` |
| `/{COIN}/explorer/broadcasts/{query}/{type}` | `/{COIN}/api/broadcasts/{query}/{type}` |
| `/{COIN}/explorer/messages/{query}/{type}` | `/{COIN}/api/messages/{query}/{type}` |
| `/{COIN}/explorer/files/{query}/{type}` | `/{COIN}/api/files/{query}/{type}` |
| `/{COIN}/explorer/callbacks/{query}/{type}` | `/{COIN}/api/callbacks/{query}/{type}` |
| `/{COIN}/explorer/sleeps/{query}/{type}` | `/{COIN}/api/sleeps/{query}/{type}` |
| `/{COIN}/explorer/addresses/{query}/{type}` | `/{COIN}/api/addresses/{query}/{type}` |
| `/{COIN}/explorer/batches/{query}/{type}` | `/{COIN}/api/batches/{query}/{type}` |
| `/{COIN}/explorer/links/{query}/{type}` | `/{COIN}/api/links/{query}/{type}` |
| `/{COIN}/explorer/lists/{query}/{type}` | `/{COIN}/api/lists/{query}/{type}` |
| `/{COIN}/explorer/fees/{query}/{type}` | `/{COIN}/api/fees/{query}/{type}` |
| `/{COIN}/explorer/credits/{query}/{type}` | `/{COIN}/api/credits/{query}/{type}` |
| `/{COIN}/explorer/debits/{query}/{type}` | `/{COIN}/api/debits/{query}/{type}` |
| `/{COIN}/explorer/escrows/{query}/{type}` | `/{COIN}/api/escrows/{query}/{type}` |
| `/{COIN}/explorer/tokens/{query}/{type}` | `/{COIN}/api/tokens/{query}/{type}` |
| `/{COIN}/explorer/history/{query}/{type}` | `/{COIN}/api/history/{query}/{type}` |

Additional Explorer-only endpoints:

| Endpoint | Description |
|---|---|
| `/{COIN}/explorer/blocks/{query}` | Block listing with action counts |
| `/{COIN}/explorer/holders/{tick}` | Token holder list |
| `/{COIN}/explorer/balances/{address}/{type}` | Address balances |
| `/{COIN}/explorer/markets/{query}` | Market listing |
| `/{COIN}/explorer/search/{query}/{type}` | Cross-entity search |
| `/{COIN}/explorer/market/{tick1}/{tick2}/history` | Market trade history |
| `/{COIN}/explorer/market/{tick1}/{tick2}/history/{address}` | Market trade history by address |

### Search

The search endpoint supports multi-entity searching:

```
GET /{COIN}/explorer/search/{query}/{type}
```

| Type | Description |
|---|---|
| `address` | Search for addresses |
| `broadcast` | Search broadcasts |
| `token` | Search tokens by ticker |
| `transaction` | Search by transaction hash |

---

## JSON-RPC 2.0 Interface

The explorer also exposes a JSON-RPC 2.0 endpoint for programmatic access:

```
POST / (root path)
Content-Type: application/json

{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ping",
    "params": {}
}
```

### Available Methods

| Method | Description |
|---|---|
| `ping` | Health check — returns a pong response |

> **Note:** The JSON-RPC interface currently exposes only the `ping` method. The REST API is the primary interface for data queries.

---

## Complete Endpoint Quick Reference

### Single-Item Endpoints

| Endpoint | Description |
|---|---|
| `GET /{COIN}/api/action/{index}` | Action details by action_index |
| `GET /{COIN}/api/address/{address}` | Address summary |
| `GET /{COIN}/api/balances/{address}` | All token balances for an address |
| `GET /{COIN}/api/block/{index}` | Block summary by height |
| `GET /{COIN}/api/holders/{tick}` | All holders of a token |
| `GET /{COIN}/api/token/{tick}` | Token metadata and supply |
| `GET /{COIN}/api/status` | Platform status |
| `GET /{COIN}/api/network` | Network statistics |

### Market Endpoints

| Endpoint | Description |
|---|---|
| `GET /{COIN}/api/markets` | All active markets |
| `GET /{COIN}/api/markets/{tick}` | Markets for a token |
| `GET /{COIN}/api/market/{t1}/{t2}` | Market pair summary |
| `GET /{COIN}/api/market/{t1}/{t2}/history` | Trade history |
| `GET /{COIN}/api/market/{t1}/{t2}/history/{addr}` | Trade history by address |
| `GET /{COIN}/api/market/{t1}/{t2}/orders` | Open orders |
| `GET /{COIN}/api/market/{t1}/{t2}/orders/{addr}` | Open orders by address |
| `GET /{COIN}/api/market/{t1}/{t2}/orderbook` | Aggregated order book |

### List Endpoints (all support `/{query}/{type}` and pagination)

| Endpoint | Supported Types |
|---|---|
| `GET /{COIN}/api/sends/...` | `block`, `address`, `source`, `destination`, `token` |
| `GET /{COIN}/api/issues/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/mints/...` | `block`, `address`, `source`, `destination`, `token` |
| `GET /{COIN}/api/destroys/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/orders/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/order_matches/...` | `block` |
| `GET /{COIN}/api/order_cancels/...` | `block`, `address` |
| `GET /{COIN}/api/order_edits/...` | `block`, `address` |
| `GET /{COIN}/api/order_expires/...` | `block`, `address` |
| `GET /{COIN}/api/coinpays/...` | `block`, `address` |
| `GET /{COIN}/api/coinpay_expires/...` | `block`, `address` |
| `GET /{COIN}/api/coinpay_obligations/...` | `block`, `address` |
| `GET /{COIN}/api/dispensers/...` | `block`, `address`, `source`, `destination`, `token` |
| `GET /{COIN}/api/dispenses/...` | `block`, `address`, `source`, `destination`, `token` |
| `GET /{COIN}/api/dispenser_cancels/...` | `block`, `address` |
| `GET /{COIN}/api/dispenser_closes/...` | `block`, `address` |
| `GET /{COIN}/api/dispenser_edits/...` | `block`, `address` |
| `GET /{COIN}/api/dispenser_expires/...` | `block`, `address` |
| `GET /{COIN}/api/swaps/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/swap_matches/...` | `block` |
| `GET /{COIN}/api/swap_cancels/...` | `block`, `address` |
| `GET /{COIN}/api/swap_edits/...` | `block`, `address` |
| `GET /{COIN}/api/swap_expires/...` | `block`, `address` |
| `GET /{COIN}/api/sweeps/...` | `block`, `address`, `source`, `destination` |
| `GET /{COIN}/api/dividends/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/airdrops/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/broadcasts/...` | `block`, `address` |
| `GET /{COIN}/api/messages/...` | `block`, `address`, `source`, `destination` |
| `GET /{COIN}/api/files/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/callbacks/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/sleeps/...` | `block`, `address`, `token` |
| `GET /{COIN}/api/addresses/...` | `block`, `address` |
| `GET /{COIN}/api/batches/...` | `block`, `address` |
| `GET /{COIN}/api/links/...` | `block`, `address` |
| `GET /{COIN}/api/lists/...` | `block`, `address` |
| `GET /{COIN}/api/fees/...` | `block`, `address`, `source`, `destination`, `token` |
| `GET /{COIN}/api/credits/...` | `block`, `address` |
| `GET /{COIN}/api/debits/...` | `block`, `address` |
| `GET /{COIN}/api/escrows/...` | `block`, `address` |
| `GET /{COIN}/api/history/...` | `block`, `address`, `token`, `recent` |
| `GET /{COIN}/api/tokens/...` | `block`, `address`, `token`, `subtoken` |
| `GET /{COIN}/api/transaction/...` | `tx_hash`, `tx_index` |
| `GET /{COIN}/api/mempool/...` | `address`, `token` |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
