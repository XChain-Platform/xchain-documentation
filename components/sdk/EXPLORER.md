<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK — Explorer Reference

## Overview

The SDK's explorer client wraps the xchain-explorer REST API, providing typed methods for every query endpoint. All methods return parsed JSON and raise typed `SDKExplorerError` exceptions on failure.

The explorer client is instantiated automatically when `network` is provided in the SDK options. The correct coin prefix for all URL paths is derived from the `network` string — you never construct paths manually.

```js
const sdk = new XChainSDK({
    network:      'bitcoin-mainnet',
    explorerUrl:  'localhost',
    explorerPort: 8080
});

// Access explorer methods directly on the SDK instance
let balances = await sdk.explorer.getBalances('bc1q...');
```

---

## Coin Prefix Mapping

The `network` option controls which coin prefix is prepended to every API path (`/{PREFIX}/api/...`).

| Network string | Prefix |
|---|---|
| `bitcoin-mainnet` | `BTC` |
| `bitcoin-testnet` | `TBTC` |
| `bitcoin-regtest` | `RBTC` |
| `litecoin-mainnet` | `LTC` |
| `litecoin-testnet` | `TLTC` |
| `litecoin-regtest` | `RLTC` |
| `dogecoin-mainnet` | `DOGE` |
| `dogecoin-testnet` | `TDOGE` |
| `dogecoin-regtest` | `RDOGE` |

Passing an unrecognised network string throws `SDKExplorerError` with code `INVALID_NETWORK` at construction time.

---

## Pagination Options

Methods marked with `opts?` accept an optional query-options object for pagination and ordering. All fields are optional.

| Field | Type | Description |
|---|---|---|
| `page` | number | Page number (1-based) |
| `limit` | number | Results per page |
| `sortorder` | string | `'ASC'` or `'DESC'` |
| `start` | number | Row offset (alternative to `page`) |
| `length` | number | Row count (alternative to `limit`) |

```js
let sends = await sdk.explorer.getSends('bc1q...', 'address', {
    page: 2,
    limit: 25,
    sortorder: 'DESC'
});
```

---

## Methods

### Balance & Address

#### `getBalances(address, opts?)`
Returns all token balances held by an address.

- **Endpoint:** `GET /{COIN}/api/balances/{address}`  
- **`opts`:** pagination supported

#### `getAddress(address)`
Returns address summary information (total activity, first/last seen, etc.).

- **Endpoint:** `GET /{COIN}/api/address/{address}`

#### `getHolders(tick, opts?)`
Returns a ranked list of holders for the given token ticker.

- **Endpoint:** `GET /{COIN}/api/holders/{tick}`  
- **`opts`:** pagination supported

#### `getCredits(query, type, opts?)`
Returns credit records (incoming transfers, mints, airdrops, etc.) filtered by the given query and type.

- **Endpoint:** `GET /{COIN}/api/credits/{query}/{type}`  
- **`type` values:** `block`, `address`  
- **`opts`:** pagination supported

#### `getDebits(query, type, opts?)`
Returns debit records (outgoing transfers, destroys, fees, etc.).

- **Endpoint:** `GET /{COIN}/api/debits/{query}/{type}`  
- **`type` values:** `block`, `address`  
- **`opts`:** pagination supported

#### `getEscrows(query, type, opts?)`
Returns escrow records (tokens locked in dispensers or orders).

- **Endpoint:** `GET /{COIN}/api/escrows/{query}/{type}`  
- **`type` values:** `block`, `address`  
- **`opts`:** pagination supported

---

### Token

#### `getToken(tick)`
Returns full token information for the given ticker: supply, divisibility, owner, description, and metadata.

- **Endpoint:** `GET /{COIN}/api/token/{tick}`

#### `getTokens(query, type, opts?)`
Returns a list of tokens filtered by block, issuing address, parent token, or subtoken relationship.

- **Endpoint:** `GET /{COIN}/api/tokens/{query}/{type}`  
- **`type` values:** `block`, `address`, `token`, `subtoken`  
- **`opts`:** pagination supported

#### `getIssues(query, type, opts?)`
Returns ISSUE action records (token creation and additional issuance events).

- **Endpoint:** `GET /{COIN}/api/issues/{query}/{type}`  
- **`type` values:** `block`, `address`, `token`  
- **`opts`:** pagination supported

---

### Transaction & History

#### `getTransaction(query, type)`
Returns a decoded XChain transaction.

- **Endpoint:** `GET /{COIN}/api/transaction/{query}/{type}`  
- **`type` values:** `tx_hash`, `tx_index`

#### `getAction(actionIndex)`
Returns a single XChain action by its cross-chain action index.

- **Endpoint:** `GET /{COIN}/api/action/{actionIndex}`

#### `getBlock(blockIndex)`
Returns block-level summary and the list of XChain actions in that block.

- **Endpoint:** `GET /{COIN}/api/block/{blockIndex}`

#### `getHistory(query, type, opts?)`
Returns a unified history of all XChain activity matching the query.

- **Endpoint:** `GET /{COIN}/api/history/{query}/{type}`  
- **`type` values:** `block`, `address`, `token`, `recent`  
- **`opts`:** pagination supported

---

### ACTION-Specific Query Methods

All 20 action-specific methods share the same signature:

```
get<Action>(query, type, opts?) → GET /{COIN}/api/<action>s/{query}/{type}
```

Each returns records of the corresponding ACTION type. Pagination is supported via `opts`.

| Method | Endpoint path segment | Notes |
|---|---|---|
| `getAddresses(query, type, opts?)` | `/addresses/` | ADDRESS action records |
| `getAirdrops(query, type, opts?)` | `/airdrops/` | AIRDROP action records |
| `getBatches(query, type, opts?)` | `/batches/` | BATCH action records |
| `getBroadcasts(query, type, opts?)` | `/broadcasts/` | BROADCAST action records |
| `getCallbacks(query, type, opts?)` | `/callbacks/` | CALLBACK action records |
| `getDestroys(query, type, opts?)` | `/destroys/` | DESTROY action records |
| `getDispensers(query, type, opts?)` | `/dispensers/` | DISPENSER action records |
| `getDispenses(query, type, opts?)` | `/dispenses/` | DISPENSE event records |
| `getDividends(query, type, opts?)` | `/dividends/` | DIVIDEND action records |
| `getFees(query, type, opts?)` | `/fees/` | FEE records |
| `getFiles(query, type, opts?)` | `/files/` | FILE action records |
| `getLinks(query, type, opts?)` | `/links/` | LINK action records |
| `getLists(query, type, opts?)` | `/lists/` | LIST action records |
| `getMessages(query, type, opts?)` | `/messages/` | MESSAGE action records |
| `getMints(query, type, opts?)` | `/mints/` | MINT action records |
| `getOrders(query, type, opts?)` | `/orders/` | ORDER action records |
| `getSends(query, type, opts?)` | `/sends/` | SEND action records |
| `getSleeps(query, type, opts?)` | `/sleeps/` | SLEEP action records |
| `getSwaps(query, type, opts?)` | `/swaps/` | SWAP action records |
| `getSweeps(query, type, opts?)` | `/sweeps/` | SWEEP action records |

**Common `type` values for action queries:** `block`, `address`, `token` (not every action supports every type — refer to the xchain-explorer API for per-action valid types).

---

### Market

#### `getMarkets(tick?)`
Returns all active markets, or all markets for a specific token if `tick` is provided.

- **Endpoint (all markets):** `GET /{COIN}/api/markets`  
- **Endpoint (by token):** `GET /{COIN}/api/markets/{tick}`

#### `getMarket(tick1, tick2)`
Returns summary information for the trading pair `tick1`/`tick2`.

- **Endpoint:** `GET /{COIN}/api/market/{tick1}/{tick2}`

#### `getMarketHistory(tick1, tick2, address?, opts?)`
Returns trade history for a market pair. Optionally filter to a single address.

- **Endpoint (all):** `GET /{COIN}/api/market/{tick1}/{tick2}/history`  
- **Endpoint (by address):** `GET /{COIN}/api/market/{tick1}/{tick2}/history/{address}`  
- **`opts`:** pagination supported

#### `getMarketOrders(tick1, tick2, address?, opts?)`
Returns open orders for a market pair. Optionally filter to a single address.

- **Endpoint (all):** `GET /{COIN}/api/market/{tick1}/{tick2}/orders`  
- **Endpoint (by address):** `GET /{COIN}/api/market/{tick1}/{tick2}/orders/{address}`  
- **`opts`:** pagination supported

#### `getOrderbook(tick1, tick2)`
Returns the aggregated order book (bids and asks) for a market pair.

- **Endpoint:** `GET /{COIN}/api/market/{tick1}/{tick2}/orderbook`

---

### Contract / VM

#### `getContract(contractActionIndex)`
Get contract metadata by its deploy ACTION_INDEX.

- **Endpoint:** `GET /{COIN}/api/contract/{contractActionIndex}`

#### `getContracts(query?, type?, opts?)`
Get a list of contracts, optionally filtered by owner address.

- **Endpoint:** `GET /{COIN}/api/contracts` or `GET /{COIN}/api/contracts/{query}/{type}`

#### `getContractState(contractActionIndex, key?)`
Get contract state entries (all keys or a specific key).

- **Endpoint:** `GET /{COIN}/api/contract/{contractActionIndex}/state` or `GET /{COIN}/api/contract/{contractActionIndex}/state/{key}`

#### `getContractBalance(contractActionIndex, tick?)`
Get contract token balances (all ticks or a specific tick).

- **Endpoint:** `GET /{COIN}/api/contract/{contractActionIndex}/balance` or `GET /{COIN}/api/contract/{contractActionIndex}/balance/{tick}`

#### `getExecution(executionActionIndex)`
Get a single execution result by its ACTION_INDEX.

- **Endpoint:** `GET /{COIN}/api/execution/{executionActionIndex}`

#### `getExecutions(contractActionIndex?, opts?)`
Get execution history for a contract.

- **Endpoint:** `GET /{COIN}/api/executions` or `GET /{COIN}/api/executions/{contractActionIndex}`

#### `getDeposits(query, type, opts?)`
Get deposit records filtered by query and type.

- **Endpoint:** `GET /{COIN}/api/deposits/{query}/{type}`

#### `getWithdrawals(query, type, opts?)`
Get withdrawal records filtered by query and type.

- **Endpoint:** `GET /{COIN}/api/withdrawals/{query}/{type}`

---

### Utility

#### `getStatus()`
Returns explorer health and sync status.

- **Endpoint:** `GET /{COIN}/api/status`

#### `search(query, type)`
Performs a cross-entity search. Note: this method uses the `/explorer/search/` path, not `/api/`.

- **Endpoint:** `GET /{COIN}/explorer/search/{query}/{type}`  
- **`type` values:** `address`, `broadcast`, `token`, `transaction`

```js
let result = await sdk.explorer.search('MYTOKEN', 'token');
```

---

## Error Handling

All explorer methods throw `SDKExplorerError` on failure. The error object has a `code` property for programmatic handling.

| Code | Cause |
|---|---|
| `EXPLORER_HTTP_404` | Resource not found (endpoint returned HTTP 404) |
| `EXPLORER_HTTP_503` | Explorer is unavailable or overloaded |
| `EXPLORER_HTTP_<N>` | Any other non-2xx HTTP response (code includes the status number) |
| `EXPLORER_TIMEOUT` | Request exceeded the configured timeout |
| `EXPLORER_NETWORK` | Connection refused, DNS failure, or other network-level error |
| `INVALID_NETWORK` | The `network` string passed to the SDK is not a recognised value |

```js
const { SDKExplorerError } = require('xchain-sdk');

try {
    let token = await sdk.explorer.getToken('UNKNOWNTICK');
} catch (err) {
    if (err instanceof SDKExplorerError) {
        if (err.code === 'EXPLORER_HTTP_404') {
            console.log('Token not found');
        } else {
            console.error('Explorer error:', err.code, err.message);
        }
    }
}
```

---

## Code Examples

### Query token balances for an address

```js
let balances = await sdk.explorer.getBalances('bc1qexampleaddress...');
// Returns array of { tick, balance, available, escrowed } objects
```

### Get full token information

```js
let token = await sdk.explorer.getToken('MYTOKEN');
console.log(token.supply, token.owner, token.divisible);
```

### Search for a token by ticker

```js
let result = await sdk.explorer.search('MYTOKEN', 'token');
```

### Paginated sends for an address

```js
let page1 = await sdk.explorer.getSends('bc1q...', 'address', {
    page: 1,
    limit: 50,
    sortorder: 'DESC'
});

// Fetch the next page
let page2 = await sdk.explorer.getSends('bc1q...', 'address', {
    page: 2,
    limit: 50,
    sortorder: 'DESC'
});
```

### Recent history across all actions

```js
let recent = await sdk.explorer.getHistory('recent', 'recent', { limit: 20 });
```

### Market order book

```js
let orderbook = await sdk.explorer.getOrderbook('MYTOKEN', 'OTHERTOKEN');
console.log(orderbook.bids, orderbook.asks);
```

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
