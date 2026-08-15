<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Explorer: API Reference

## Overview

The explorer exposes a REST API for querying all XChain Platform state. Every endpoint returns JSON and uses parameterized SQL internally to prevent injection.

All API URLs follow the pattern:

```
GET /{COIN}/api/{method}/{query}/{type}
```

Where:
- **`{COIN}`**: Coin prefix identifying the chain and network (e.g., `BTC`, `TBTC`, `RDOGE`)
- **`{method}`**: The data category (e.g., `sends`, `balances`, `token`)
- **`{query}`**: The search value (address, block index, token ticker, tx hash, action index)
- **`{type}`**: The filter type that determines how `{query}` is interpreted (e.g., `address`, `block`, `token`)

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

For the public XChain Platform (mainnet or testnet), query the hosted explorer directly:

```
https://explorer.xchain.io/{COIN}/api/
```

For a self-hosted or local explorer instance:

```
http://{host}:{port}/{COIN}/api/
```

The examples below use `http://localhost:8080` for a self-hosted instance; against the public platform, substitute `https://explorer.xchain.io` (no port).

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

Returns configuration and sync health information for all supported and available coins.

```
GET /{COIN}/api/status
```

**Parameters:** None

**Response:**
```json
{
    "data": {
        "supported": { "BTC": "BTC (mainnet)", "RBTC": "BTC (regtest)", ... },
        "available": { "BTC": "BTC (mainnet)" },
        "hub_config_fetched_at": "2026-06-13T12:00:00.000Z",
        "hub_config_age_seconds": 42,
        "last_block": { "BTC": 893000, "RBTC": 41 },
        "last_block_time": { "BTC": 1718280000, "RBTC": 1718080000 },
        "decoder_tip": { "BTC": 893000, "RBTC": 41 },
        "decoder_lag_blocks": { "BTC": 0, "RBTC": 0 },
        "tip_age_seconds": { "BTC": 120, "RBTC": 200120 },
        "tip_future_seconds": { "BTC": 0, "RBTC": 0 },
        "stale": { "BTC": false, "RBTC": true },
        "replica_halted": { "BTC": false, "RBTC": null },
        "chain_tip": { "BTC": 893000, "RBTC": 41 },
        "chain_lag_blocks": { "BTC": 0, "RBTC": 0 },
        "decoder_health": { "BTC": "healthy", "RBTC": "healthy" }
    }
}
```

The example above shows the gate in action: `RBTC` has a frozen tip, so it is
`stale` and absent from `available`, while still listed in `supported`.

| Field | Description |
|---|---|
| `supported` | Every coin code the explorer's config defines, mapped to its display name. Static: the freshness gate never removes a coin from here |
| `available` | The subset of coins this instance currently serves as up-to-date data, mapped to display names. Computed per request: it starts from the configured availability map and then drops every coin the freshness gate marks `stale`, so a coin can leave `available` and stay in `supported` |
| `hub_config_fetched_at` | ISO-8601 timestamp of the last successful hub config fetch; `null` if hub has never responded |
| `hub_config_age_seconds` | Seconds since last hub config fetch; `null` if no fetch has occurred |
| `last_block` | Per-coin latest block index written to the indexer DB |
| `last_block_time` | Per-coin unix timestamp of that block |
| `decoder_tip` | Per-coin highest block the decoder has processed; `null` if the decoder DB is unreachable |
| `decoder_lag_blocks` | `decoder_tip − last_block` (how far the indexer trails the decoder); `null` when either value is unavailable |
| `tip_age_seconds` | Per-coin wall-clock seconds since `last_block_time`; `null` when no usable `block_time` was read. Never negative: a tip dated ahead of this host reads `0` here and reports its skew in `tip_future_seconds`. Unlike `decoder_lag_blocks` this catches a joint indexer plus decoder freeze, because it measures against the local clock rather than against the other replica |
| `tip_future_seconds` | Per-coin seconds the newest indexed block is dated *ahead* of this host's clock; `0` when it is not ahead, `null` when no usable `block_time` was read. A non-zero value means host clock drift or a chain with lax timestamp rules, and that `tip_age_seconds` is clamped rather than measured |
| `stale` | Per-coin freshness verdict: `true` when `tip_age_seconds` has passed that coin's threshold, and also `true` when `tip_future_seconds` has passed that coin's future-skew tolerance. Fails closed, so a missing or unreadable `block_time` also reads `true`. Only coins this instance actually measures (those with a live connection pool) appear here |
| `replica_halted` | Per-coin durable consensus-divergence halt verdict, read from the sync client's `sync_halt` table on the same replica this instance reads (`true` when an active, uncleared halt row exists). A halted replica keeps reporting a small lag until its source mints past it, so this catches what neither `stale` nor `tip_age_seconds` can see; it composes with `stale` rather than replacing it (this field flags the halt immediately, `stale`/`available` only drop the coin once its tip actually ages out). `true`/`false` only once the table was read successfully; `null` when the signal could not be determined (no live pool, the table doesn't exist on this replica, or the read failed), and `null` is never coerced to `false`. Only coins this instance measures appear here |
| `chain_tip` | Per-coin chain tip as reported by the decoder's own health endpoint (what the coin node sees) |
| `chain_lag_blocks` | `chain_tip − decoder_tip` (how far the decoder trails the chain) |
| `decoder_health` | Per-coin decoder health string: `"healthy"`, `"unhealthy"` (decoder up but reporting problems), `"node-stale"` (the decoder's cached coin-node height is frozen, so `chain_tip` and `chain_lag_blocks` are nulled), `"unreachable"` (decoder not responding), or `"unconfigured"` (no decoder endpoint resolves for this coin, from either the explorer's configuration or `DECODER_API_URL[_<COIN>_<NETWORK>]`; see [Configuration](configuration.md)) |

**Freshness gate.** The threshold behind `stale` is `EXPLORER_TIP_MAX_AGE_S`
(6 hours by default), overridable per coin with `EXPLORER_TIP_MAX_AGE_S_<COIN>`
and disabled entirely with `0`. A tip dated ahead of the host is gated the other
way by `EXPLORER_TIP_MAX_FUTURE_SKEW_S` (2 hours by default, per coin with
`EXPLORER_TIP_MAX_FUTURE_SKEW_S_<COIN>`, `0` to disable): skew past it reads
`stale`, so a frozen chain cannot sit behind a future-dated block forever. See
[configuration.md](configuration.md#environment-variables). A client that wants
only current data should read `available` rather than `supported`, and treat a
coin's disappearance from `available` as a transient outage of this instance,
not as the coin being unknown.

---

### Get Network

Returns aggregate network statistics, coin identity/pricing, fee guidance, and finality settings.

```
GET /{COIN}/api/network
```

**Parameters:** None

**Response:**
```json
{
    "data": {
        "totals": {
            "total_sends": 1234,
            "total_issues": 567,
            "total_orders": 89,
            "total_dispensers": 45
        },
        "network": {
            "block": 893000,
            "block_time": 1718280000,
            "unconfirmed": 3,
            "fee": { "low": 1, "medium": 2, "high": 5 }
        },
        "coin": {
            "name": "Bitcoin",
            "symbol": "BTC",
            "price": { "btc": "1.00000000", "usd": "68420.00" }
        },
        "xchain": {
            "name": "XChain",
            "symbol": "XCHAIN",
            "price": { "btc": "0.00000000", "usd": "0.00" }
        },
        "finality": { "BTC": 6, "LTC": 12, "DOGE": 60 }
    }
}
```

| Field | Description |
|---|---|
| `totals` | Per-action-type record counts for this coin |
| `network.block` | Latest indexed block height |
| `network.block_time` | Unix timestamp of the latest indexed block |
| `network.unconfirmed` | Count of rows in the decoder's `mempool_transactions` table |
| `network.fee` | Suggested sat/vByte fee tiers (low/medium/high) from the encoder; falls back to `{1,2,3}` |
| `coin.price.usd` | Live USD price from the xchain-hub oracle (mainnet coins only; `"0.00"` for testnet/regtest or when no oracle price is available) |
| `finality` | Recommended confirmation depths before treating a receipt as final; mirrors hub cross-chain thresholds; can be overridden via `XCHAIN_CONFIRMATIONS_<COIN>` env vars |

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

Returns summary information for an address, including native-coin balance and UTXO counts sourced from the coin's `xchain-utxo-tracker` (the explorer itself is DB-only and never talks to a node).

```
GET /{COIN}/api/address/{address}
```

**Parameters:**
| Parameter | Location | Description |
|---|---|---|
| `address` | path | Blockchain address |

**Response fields:** `address`, `type`, `balances` (`confirmed`/`pending`/`received`), `utxos` (`confirmed`/`pending`), `estimated_value` (`btc`/`usd`, from the hub price oracle; `null` when no price is available), `tracker_available`, `mempool_ready`.

`tracker_available` is `false` when no UTXO tracker is configured for the coin or it is unreachable; the balance and UTXO fields are then `null` (the UI shows "Unavailable") rather than placeholder values.

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

### Get Actions

Returns all actions across all types, with optional filters for block, transaction, and token.

```
GET /{COIN}/api/actions[?blockIndex=N&txid=TX_HASH&tick=TOKEN]
```

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `blockIndex` | number | Filter to actions in a specific block |
| `txid` | string | Filter to actions in a specific transaction (by hash) |
| `tick` | string | Filter to actions involving a specific token ticker |

**Pagination:** Supported

**Response:** Array of action objects, each including `action_index`, `action` (type name), `action_format`, `source`, `block_index`, `timestamp`, `tx_hash`, and `tx_index`.

**Example:**
```bash
# All actions in a block
curl "http://localhost:8080/BTC/api/actions?blockIndex=800000"

# All actions involving a token
curl "http://localhost:8080/BTC/api/actions?tick=MYTOKEN"
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

**Response includes:** obligation action_index, coin amount, txid, vout, status, block, timestamp. When one transaction settles more than one obligation, `coin_amount`/`vout` name the specific output that paid THIS obligation, not just the transaction's first output. Testnet and regtest already behave this way; mainnet activates the change at `2026-08-16T00:00:00Z`.

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

**Response includes:** give/get coin, give/get tick, give/get amounts, source, destination, status, block, timestamp. When one payment fills several dispenses in the same transaction, `get_amount` is the coin attributed to that dispense, not the full payment. Testnet and regtest already behave this way; mainnet activates the change at `2026-08-16T00:00:00Z`.

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

### Bet Feeds (Betting Markets)

Parimutuel betting markets, created by the BET action (format 0). A market's `action_index` IS its
identifier: bets and oracle actions reference it as `feed_action_index`.

```
GET /{COIN}/api/bet_feeds/{query}/{type}
GET /{COIN}/api/bet_feeds
```

| Type | Description |
|---|---|
| `block` | Markets created in a specific block |
| `address` | Markets created by an address (that address is the market's oracle) |
| `source` | Markets where this address is the source |
| `token` | Markets denominated in a specific token |
| `status` | Markets in a given lifecycle state: `open`, `closed`, `resolved`, `resolved_void`, `cancelled`, `expired` |

**Response includes:** action index, source (the oracle), label, outcomes, tick, fee (the oracle's cut
as a percent of the pot), deadline, refund window, expire_at, minimum amount, allow/block lists,
details, feed status, closed_block, terminal_block, plus the usual block, transaction and status
fields.

The unfiltered form returns the most recent markets across every source.

---

### Get Bet Feed

A single market by the action index that created it.

```
GET /{COIN}/api/bet_feed/{action_index}
```

Returns the same fields as above, with `outcomes` split back into an array in wire order so a caller
can render the options without re-parsing the stored comma-joined list.

---

### Bets

Individual wagers placed on a market (BET format 2). A bet is final once confirmed: there is no
bettor-side cancel.

```
GET /{COIN}/api/bets/{query}/{type}
GET /{COIN}/api/bets
```

| Type | Description |
|---|---|
| `block` | Bets placed in a specific block |
| `address` | Bets placed by an address |
| `feed` | Bets placed on a specific market, by that market's action index |
| `token` | Bets denominated in a specific token |
| `status` | Bets in a given settlement state: `open`, `won`, `lost`, `refunded` |

**Response includes:** action index, feed action index, bettor address, outcome, tick, amount, bet
status, settled_block.

Payouts credit the address that PLACED the bet, automatically at resolution. There is no claim
action, so a settled bet shows up as a `bet_status` flip plus a credit, never as a user-submitted
collection.

---

### Oracle Track Record

The per-address record of whoever creates markets. This is what a bettor reads to judge an oracle
before staking on one of their markets.

```
GET /{COIN}/api/oracle/{address}
```

**Response includes:** address, total_feeds, active_feeds (open plus closed), counts per lifecycle
status, fees_earned per token (tick, resolves, amount), and a `reputation_caveat` string.

Fees are earned on the resolve path only: a void, a cancel and an expiry all pay the oracle nothing.
The caveat field is returned because the record is per-address with no bonding, and addresses are
free to create, so an empty history means unknown rather than safe.

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

Pending unconfirmed transaction data. Rows come from the decoder's `mempool_transactions` table and are **pre-validation**: the decoder writes whatever it parses from a mempool transaction; the indexer may still reject it at confirmation time.

```
GET /{COIN}/api/mempool/{query}/{type}
```

| Type | Description |
|---|---|
| `address` | Mempool transactions where the source address or any decoded segment matches the query |
| `token` | Mempool transactions where any decoded segment matches the token ticker (case-insensitive) |

**Response fields:** `tx_hash`, `source`, `action` (decoded action name), `data` (full pipe-delimited action string). No `destination` field, destinations are embedded in the `data` string.

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

## Governance (VOTE) Endpoints

VOTE actions create token-weighted polls, cast ballots, and delegate voting power. These endpoints read the indexer's `polls`, `votes`, and `poll_results` tables. The web UI exposes them at `/{COIN}/polls` and `/{COIN}/votes` under the Governance nav entry.

### List Polls

Returns a paginated list of polls.

```
GET /{COIN}/api/polls/{query}/{type}
GET /{COIN}/api/polls
```

**Type values:**

| Type | Query interpretation | Description |
|---|---|---|
| `block` | Block index | Polls created in a specific block |
| `tick` | Token ticker | Polls weighted by a specific token |
| `status` | Status string | Polls with a specific poll status |
| `source` | Address | Polls created by a specific address |

When called without `{query}/{type}`, returns recent polls (paginated).

**Pagination:** Supported

**Response fields:** `action`, `action_index`, `action_format`, `source`, `tick`, `end_block`, `options`, `max_selections`, `tally_mode`, `weight_mode`, `quorum`, `min_voters`, `question`, `poll_status`, `winning_option`, `total_weight`, `total_voters`, `quorum_met`, `min_voters_met`, `deposit_amount`, `callback_contract_index`, `callback_method`, `finalized_action_index`, `block_index`, `timestamp`, `tx_hash`, `tx_index`, `status`.

---

### Get Poll

Returns a single poll by its creating action index.

```
GET /{COIN}/api/poll/{actionIndex}
```

---

### Get Poll Results

Returns the finalized per-option tallies for a poll (one row per option). Empty until the poll is finalized.

```
GET /{COIN}/api/poll/{actionIndex}/results
```

**Response fields:** `poll_index`, `option_index`, `total_weight`, `voter_count`, `finalize_action_index`, `block_index`, `status`.

---

### List Votes

Returns a paginated list of ballots (one row per poll + voter + chosen option).

```
GET /{COIN}/api/votes/{query}/{type}
```

**Type values:**

| Type | Query interpretation | Description |
|---|---|---|
| `address` | Address | Ballots cast by a specific voter |
| `poll` | Poll action index | Ballots cast in a specific poll |
| `block` | Block index | Ballots cast in a specific block |

**Pagination:** Supported

**Response fields:** `action`, `action_index`, `action_format`, `source`, `poll_index`, `choice`, `share`, `memo`, `block_index`, `timestamp`, `tx_hash`, `tx_index`, `status`.

**Example:**
```bash
# Recent polls
curl "http://localhost:8080/BTC/api/polls?limit=10"

# Ballots in poll 1234
curl "http://localhost:8080/BTC/api/votes/1234/poll"
```

---

## ANCHOR Endpoints

ANCHOR actions are the periodic on-chain checkpoints published to the DOGE chain by the validator federation. These endpoints read the `anchor_actions` table.

### List Anchors

Returns a paginated list of ANCHOR checkpoint records.

```
GET /{COIN}/api/anchors/{query}/{type}
GET /{COIN}/api/anchors
```

**Parameters:**

| Parameter | Location | Description |
|---|---|---|
| `query` | path | Filter value (block index, chain code, network name, or status string) |
| `type` | path | Filter type (see below) |

**Type values:**

| Type | Query interpretation | Description |
|---|---|---|
| `block` | Block index | ANCHOR actions published in a specific block |
| `chain` | Chain code (e.g. `BTC`) | ANCHOR actions for a specific coin chain |
| `network` | Network name (e.g. `mainnet`) | ANCHOR actions for a specific network |
| `status` | Status string | ANCHOR actions with a specific status |

When called without `{query}/{type}`, returns recent ANCHOR actions (paginated).

**Pagination:** Supported

**Response fields:** `action`, `action_index`, `action_format`, `version`, `chain`, `network`, `block_index`, `block_hash`, `ledger_hash`, `actions_hash`, `contract_hash`, `checkpoint_seq`, `snapshot_block`, `state_root`, `state_root_version`, `block_merkle_root`, `block_merkle_version`, `validator_signatures`, `timestamp`, `tx_hash`, `tx_index`, `status`.

**Example:**
```bash
# Recent ANCHOR actions
curl "http://localhost:8080/RDOGE/api/anchors?limit=10"

# ANCHOR actions for BTC chain
curl "http://localhost:8080/RDOGE/api/anchors/BTC/chain"

# ANCHOR actions for a specific block
curl "http://localhost:8080/RDOGE/api/anchors/800000/block"
```

---

## Checkpoint Verification Endpoints

The explorer exposes quorum-signed state checkpoints for light-client verification. Checkpoint data is read from the hub-mirrored `state_checkpoints` table.

On nodes that maintain their own checkpoint mirror (self-sync mode, see the Configuration page), these endpoints return HTTP 503 with code `MIRROR_NOT_BOOTSTRAPPED` until the mirror's first snapshot download completes, and afterwards include two extra response fields: `mirror_bootstrapped` (always `true` once serving) and `mirror_lag_seconds` (how far the mirror trails the hub's feed). Operators can additionally opt into HTTP 503 `MIRROR_STALE` on excessive lag. Nodes reading an externally-maintained hub schema return neither the extra fields nor the 503s.

### Hub-Mirror Status

```
GET /{COIN}/api/hub-mirror/status
```

Reports the self-synced mirror's state for this coin, or `{ "enabled": false }` when the coin is served from an externally-maintained schema.

**Response:**
```json
{
    "enabled": true,
    "target": { "host": "localhost", "name": "XChain_Hub_Mirror" },
    "bootstrapDrained": true,
    "streamWatermark": 1751804000,
    "mirrorLagSeconds": 4
}
```

---

### List Checkpoints

```
GET /{COIN}/api/checkpoints[?limit=N]
```

Returns the latest quorum-signed state checkpoints for the coin's chain. Default limit is 10.

**Response:**
```json
{
    "checkpoints": [ ... ],
    "count": 5
}
```

---

### Verify Checkpoint

```
GET /{COIN}/api/checkpoint/{blockIndex}/verify
```

Re-verifies the checkpoint at `blockIndex` server-side and returns everything a client needs to verify it independently.

**Response fields:**

| Field | Description |
|---|---|
| `checkpoint` | Raw checkpoint row (block_index, block_hash, ledger_hash, actions_hash, ...) |
| `canonical` | Canonical signing payload (pipe-delimited string over checkpoint fields) |
| `validators` | Array of validator pubkeys that signed this checkpoint |
| `quorum` | Required signature count for 2f+1 consensus |
| `valid_sigs` | Count of signatures that verified successfully |
| `verified` | `true` when `valid_sigs >= quorum` |

Returns HTTP 404 with `{ "error": "No checkpoint at this height", "code": "CHECKPOINT_NOT_FOUND" }` when no checkpoint exists at the requested height.

---

### Get Checkpoint Range

Returns a forward-ordered slice of quorum-signed checkpoints between two block heights. Intended for light-client forward-following: a client fetching the next N checkpoints after its last known one.

```
GET /{COIN}/api/checkpoints/range?from={fromBlock}&to={toBlock}
```

**Query parameters:**

| Parameter | Required | Description |
|---|---|---|
| `from` | Yes | Start block height (inclusive) |
| `to` | Yes | End block height (inclusive); must be `>= from` |

**Response:**
```json
{
    "checkpoints": [ { "chain": "BTC", "network": "mainnet", "block_index": 800000, ... }, ... ],
    "count": 5
}
```

Each checkpoint object contains the same fields as the response from `GET /{COIN}/api/checkpoints`: `chain`, `network`, `block_index`, `block_hash`, `ledger_hash`, `actions_hash`, `contract_hash`, `checkpoint_seq`, `snapshot_block`, `state_root`, `state_root_version`, `block_merkle_root`, `block_merkle_version`, and `validator_signatures` (parsed as a JSON array).

The result is capped at 500 checkpoints per request. If the range spans more than 500 checkpoint heights, only the first 500 are returned.

Returns HTTP 400 when `from` or `to` are missing, non-integer, or `to < from`.

**Example:**
```bash
# Checkpoints from block 800000 to 801000
curl "http://localhost:8080/BTC/api/checkpoints/range?from=800000&to=801000"
```

---

## SPV Light-Client Proof Endpoints

These endpoints build read-only Merkle proofs that a light client verifies locally against a quorum-signed checkpoint's committed `state_root` or `block_merkle_root`. The server never asks the client to trust its word; all verification happens client-side.

Proof endpoints require a **full indexer DB** with the `state_tree_nodes` table (not replicated by `xchain-sync`). A thin replica returns HTTP 501 with code `NO_STATE_TREE`.

### Balance Proof

Returns a Sparse Merkle Tree (SMT) inclusion (or non-inclusion) proof for an address/tick balance, bound to the nearest signed checkpoint at or above the requested height.

```
GET /{COIN}/api/proof/balance/{address}/{tick}[?height=N]
```

**Parameters:**

| Parameter | Location | Required | Description |
|---|---|---|---|
| `address` | path | Yes | Blockchain address to prove a balance for |
| `tick` | path | Yes | Token ticker |
| `height` | query | No | Minimum block height for the checkpoint; omit to use the latest checkpoint |

**Response** (success):
```json
{
    "proof": {
        "chain": "BTC", "network": "mainnet", "height": 800000,
        "address": "bc1q...", "tick": "MYTOKEN", "amount": "100.00000000",
        "smt_proof": { "key": "...", "leaf_value": "...", "compressed": [...] },
        "sub_root_path": { "index": 0, "siblings": [...] },
        "balances_root": "...", "stakes_root": "...",
        "state_root": "...", "state_root_version": 1
    },
    "checkpoint": { "block_index": 800000, "state_root": "...", "validator_signatures": [...], ... }
}
```

A non-held balance returns `leaf_value: null` (non-inclusion proof) and `amount: "0"`.

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `NO_CHECKPOINT` | No signed checkpoint at or above the requested height |
| 409 | `CHECKPOINT_PRE_COMMITMENT` | Checkpoint predates the state-commitment activation (no committed roots) |
| 501 | `NO_STATE_TREE` | Server does not hold the state tree; point a full indexer DB at this instance |
| 500 | `PROOF_STATE_ROOT_MISMATCH` | Server state tree disagrees with the signed checkpoint |

---

### Action Inclusion Proof

Returns a fixed-Merkle-tree inclusion proof for an action row within its block, bound to the checkpoint that commits that block's `block_merkle_root`.

```
GET /{COIN}/api/proof/action/{actionIndex}
```

**Parameters:**

| Parameter | Location | Description |
|---|---|---|
| `actionIndex` | path | The action index number |

**Response** (success):
```json
{
    "proof": {
        "chain": "BTC", "network": "mainnet", "height": 800000, "action_index": 42,
        "tx_index": 5, "action": "SEND",
        "leaf": "...",
        "merkle_proof": { "index": 3, "siblings": [...] },
        "block_merkle_root": "...", "block_merkle_version": 1
    },
    "checkpoint": { "block_index": 800000, "block_merkle_root": "...", "validator_signatures": [...], ... }
}
```

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `ACTION_NOT_FOUND` | No action with this index on this server |
| 409 | `ACTION_BLOCK_NOT_CHECKPOINTED` | The action's block has no signed checkpoint with a `block_merkle_root` |
| 409 | `CHECKPOINT_PRE_COMMITMENT` | Checkpoint predates the state-commitment activation |
| 501 | `NO_STATE_TREE` | Server does not hold the state tree |
| 500 | `PROOF_BLOCK_MERKLE_MISMATCH` | Server block tree disagrees with the signed checkpoint |

---

### Validator-Set Proof

Returns SMT proofs for each validator's stake weight, bound to the BTC checkpoint at the given snapshot height. BTC-only (the `stakes_root` is BTC-anchored per protocol spec).

```
GET /BTC/api/proof/validator-set?height={snapshotBlock}[&capabilities=oracle_publish,cross_chain]
```

**Query parameters:**

| Parameter | Required | Description |
|---|---|---|
| `height` | Yes | BTC snapshot block height (must match a BTC checkpoint's `block_index`) |
| `capabilities` | No | Comma-separated capability names to prove; defaults to `oracle_publish,cross_chain` |

**Notes:**
- Requires `INDEXER_API_URL` to be configured (to fetch live stake weights). Returns HTTP 501 with code `INDEXER_NOT_CONFIGURED` otherwise.
- Returns HTTP 400 with code `STAKES_BTC_ONLY` when called on a non-BTC coin prefix.

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `STAKES_BTC_ONLY` | Must call on a BTC coin prefix |
| 409 | `SNAPSHOT_NOT_YET_CHECKPOINTED` | No BTC checkpoint at this height yet |
| 409 | `CHECKPOINT_PRE_COMMITMENT` | Checkpoint predates state-commitment activation |
| 501 | `NO_STATE_TREE` | Server does not hold the state tree |
| 501 | `INDEXER_NOT_CONFIGURED` | No indexer API URL configured for this coin/network |
| 502 | `INDEXER_UNAVAILABLE` | Indexer API did not respond |

---

### Contract-State Proof

```
GET /{COIN}/api/proof/contract-state/{contractIndex}/{key}
```

**Status: Not yet implemented.** The contract state root is committed as EMPTY in `state_root_version` 1 (spec D1). This endpoint returns HTTP 501 with code `UNSUPPORTED_VERSION` until a future protocol version activates contract-state commitments.

---

## Additional REST Endpoints

The following endpoints are registered and active. Detailed documentation is in the linked spec files.

### Native-Coin Fee (Explorer Proxy)

```
GET /{COIN}/api/feequote?action=ISSUE&params=0|NEWTICK&source=...&feeOutputSats=...
GET /{COIN}/api/feeschedule
GET /{COIN}/api/preflight?action=SEND&params=...&source=...&feeMode=xchain|native
POST /{COIN}/api/preflight   {"action":"BATCH","params":"...","source":"...","feeMode":"xchain"}
GET /{COIN}/api/oraclefeequote?oracleAddress=...&giveTick=...&fiatCode=USD&giveEscrow=1000
```

Proxied to the colocated indexer's `feequote` / `feeschedule` / `preflight` / `oraclefeequote` JSON-RPC. Returns `503` when no `INDEXER_API_URL` is configured. See [CONFIGURATION.md](configuration.md) for `INDEXER_API_URL_<COIN>_<NETWORK>`.

`preflight` answers "would the indexer accept this action?" independently of native-fee support, returning `{ supported, valid, status, error, guardInert, feeExempt, denied, xchainFee, feeMode, feeTick, feeTokenBalance, feeAffordable, blockIndex, blockTime }`. `xchainFee` is the protocol fee the action would owe as an XCHAIN-denominated decimal string, taken from the same dry-run that produced the verdict, so a confirm screen can disclose the fee without a second call to `feequote` (it is `null` when the run staged no fee record, and absent when no verdict was produced). Sizing a native-coin fee output still needs `feequote`, which prices that fee against the oracle.

The dry-run settles that fee the way `feeMode` says the real transaction will, because the two modes give different answers: `xchain` debits the payer's XCHAIN balance (so a payer who cannot cover the fee is told `invalid` here, before signing anything), while `native` pays a coin output to the fee destination and never touches that balance. Omit `feeMode` to get the chain's own default, which is `native` on LTC/DOGE (they have no XCHAIN fee lane) and the XCHAIN debit on BTC. `feeTokenBalance` reports the payer's balance of `feeTick` at the quoted height, and `feeAffordable` says whether it covers `xchainFee`; `feeAffordable` is `null` in native mode, since that balance is not what pays.

A `BATCH` of non-VM sub-commands is pre-flighted too, and answers an extra `subCommands` array: one verdict per sub-command, in list order, each `{ position, action, status, refused }`. Read that rather than the batch-level `valid`, because sub-commands are not atomic, so a batch can be accepted while individual commands in it are not. A batch carrying a VM-reaching sub-command is still refused outright, naming it in `deniedSubAction`. Batches with Mode B dispensers also answer `oracleFeesOwed`, the total oracle usage fee owed per oracle address; it is disclosed so a composer can size the outputs, not judged.

`POST` takes the same four fields as a JSON body and returns the same verdict. Use it for anything that will not fit a query string: a 250-command batch (the consensus maximum) runs to roughly 17,500 characters, and a `GET` that long is refused with a bare `431` by the HTTP server before the endpoint is reached. `params` is capped at the protocol's own action-payload ceiling on both transports, so the proxy never refuses on length something the indexer would have judged.

`oraclefeequote` sizes the up-front native-coin output a Mode B dispenser owes the oracle operator it names in `ORACLE_ADDRESS`, returning `{ valid, error, oracleAddress, blockTime, requiredFeeNative, requiredFeeSats, belowDust, note }`. The indexer computes it from the same code path it validates with, so an output sized from the quote is accepted on chain.

---

### Price and Price Snapshots

```
GET /{COIN}/api/prices/{query}/{type}
GET /{COIN}/api/price_snapshots/{query}/{type}
```

USD-denominated prices and the raw PRICE v0 oracle snapshots (PBFT-signed) behind them. `prices` `type` values: `block`, `address`, `source`, `token`. `price_snapshots` `type` values: `pair`, `round`, `status`.

---

### Cross-Chain Matches and Settlements

```
GET /{COIN}/api/cross_chain_matches/{query}/{type}
GET /{COIN}/api/cross_chain_settlements/{query}/{type}
```

Cross-chain DEX match and settlement records. `type` values for matches: `match`, `block`, `status`; for settlements: `match`, `block`.

---

### VM / Contract Endpoints

```
GET /{COIN}/api/contracts[/{query}/{type}]
GET /{COIN}/api/contract/{TICK}
GET /{COIN}/api/contract/{TICK}/state[/{type}]
GET /{COIN}/api/contract/{TICK}/balance[/{type}]
GET /{COIN}/api/executions[/{query}/{type}]
GET /{COIN}/api/execution/{query}
GET /{COIN}/api/deploy_chunks
```

Smart contract (DEPLOY / CALL) data. `contracts` and `executions` `type` values: `block`, `address`, `contract` (or `source` for contracts). Single-contract detail, sandbox state, and per-contract token balance via the `contract/*` routes. `deploy_chunks` lists chunked upload records for large contracts.

---

### Deposit and Withdrawal Endpoints

```
GET /{COIN}/api/deposits/{query}/{type}
GET /{COIN}/api/withdrawals/{query}/{type}
```

Contract deposit and withdrawal records. `type` values: `block`, `address`, `source`, `contract`.

---

### Staking and Validator Endpoints

```
GET /{COIN}/api/stakes[/{query}/{type}]
GET /{COIN}/api/validators
GET /{COIN}/api/delegations/{query}/{type}
GET /{COIN}/api/delegation_revocations[/{query}/{type}]
GET /{COIN}/api/rewards/{query}/{type}
GET /{COIN}/api/collects[/{query}/{type}]
GET /{COIN}/api/full_node_verifications[/{query}/{type}]
GET /{COIN}/api/contract_stakes[/{query}/{type}]
GET /{COIN}/api/contract_unstakes[/{query}/{type}]
GET /{COIN}/api/contract_delegations[/{query}/{type}]
GET /{COIN}/api/slash_events[/{query}/{type}]
```

Validator federation data. `validators` rows are the on-chain active set, and each one also carries the hub federation registry's view of the same signing pubkey: `hub_addr` (the validator's network address), `hub_chains` (the chains it serves) and `hub_status` (its registration status: `active`, `suspended`, `removed`, or `unregistered` when the registry does not list the pubkey). All three are `null` when no hub registry is reachable, which means unknown rather than unregistered. `stakes` and `delegations` `type` values: `block`, `address`, `source`. `rewards` `type` values: `address`, `source`. `delegation_revocations` (DELEGATE v2/v3 signing-key revocations) and `collects` (COLLECT validator reward claims) `type` values: `block`, `address`, `source`. `full_node_verifications` `type` values: `block`, `epoch`, `pubkey`, `address`. Contract-targeted staking (`contract_stakes`, `contract_unstakes`, `contract_delegations`) and `slash_events` support types: `block`, `address`, `contract`.

---

### Hub Federation and Governance Endpoints

```
GET /{COIN}/api/validator_capabilities[/{query}/{type}]
GET /{COIN}/api/governance_proposals[/{query}/{type}]
GET /{COIN}/api/governance_votes[/{query}/{type}]
GET /{COIN}/api/capability_slash_events[/{query}/{type}]
GET /{COIN}/api/oracle_prices[/{query}/{type}]
```

Hub-only federation state read from the co-located hub DB (tables that have no on-chain action). The hub's own validator registry has no endpoint or page of its own: its addr, chains and registration-status columns are folded onto `/{COIN}/api/validators` and the `/{COIN}/validators` page, so the on-chain active set and the hub registry read as one table. `validator_capabilities` `type` values: `capability`, `pubkey`. `governance_proposals` `type` values: `status`, `parameter`, `proposal`. `governance_votes` `type` values: `proposal`, `voter`. `capability_slash_events` (SLASH wire actions) `type` values: `block`, `capability`, `pubkey`, `address`. `oracle_prices` (user-published PRICE v1 rows, hub-mirrored) `type` values: `token`, `address`.

---

### Attestation Endpoints

```
GET /{COIN}/api/attestations[/{query}/{type}]
```

ATTEST v0 requests and v1 responses from the `attests` table. `type` values: `block`, `address`, `contract`.

---

### Cross-Chain Call Endpoints

```
GET /{COIN}/api/xcalls[/{query}/{type}]
GET /{COIN}/api/xcall/{callId}
```

VM-emitted cross-chain call records (XCALL). `xcalls` `type` values: `block`, `contract`, `status`. Single-call lifecycle lookup via `xcall/{callId}`.

---

### Controller-Bound Token Endpoints

```
GET /{COIN}/api/controllers
```

Controller bind/unbind event stream for controller-bound tokens. See `protocol/Controller_Bound_Tokens.md`.

---

### Project Registry

```
GET /{COIN}/api/project/{TICK}
```

Returns the current roster for a project token (tick). See `protocol/Project_Registry.md`.

---

### Public Key Lookup

```
GET /{COIN}/api/pubkey/{address}
```

Returns the on-chain-observed public key for `address`, or `null` if not yet seen.

---

### Token Search Types

The `/{COIN}/api/tokens/{query}/{type}` endpoint accepts the additional type value `nft`, which restricts results to NFT-enabled tokens. All other type values (`block`, `address`, `token`, `subtoken`) are unchanged.

---

### File Raw Endpoint

```
GET /{COIN}/api/file/{actionIndex}/raw
```

Returns the raw bytes for a FILE action.

- **Gated file**: returns the AES-256-GCM ciphertext (12-byte nonce || 16-byte GCM tag || ciphertext) as `application/octet-stream`. Holders decrypt client-side after receiving the symmetric key via an ECIES MESSAGE.
- **Non-gated file**: returns the stored bytes from the colocated decoder DB, served inline for safe media MIME types (image, audio, video, PDF, JSON). Unsafe types (HTML, SVG, XML, scripts, unknown) are forced to download as `application/octet-stream`. This is the resolution target for TIS `data_ref` entries using the `action:<index>` scheme, enabling NFT artwork to render directly in the browser.

Returns HTTP 404 when the `actionIndex` is unknown or the decoder DB is unreachable. Returns HTTP 400 for a non-numeric `actionIndex`.

---

### Relay and Icon Routes

```
GET  /relay?url={url}
GET  /icon/{path}
```

`/relay` fetches a remote JSON or PNG resource on behalf of the browser (a same-origin CORS proxy for TIS metadata and token icons hosted off-chain). Pass the target URL as the `url` query parameter. Private/loopback/metadata addresses are blocked. `/icon/{path}` serves cached token icon images. Both are non-coin-prefixed and registered at the root level.

---

### Machine-Readable Spec

```
GET /openapi.json
```

OpenAPI 3.1 specification for all explorer REST endpoints. Regenerated by `docs/openapi.build.js`; kept in sync with the route tables by `test/unit/openapi-coverage.test.js`.

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
| `/{COIN}/explorer/bet_feeds/{query}/{type}` | `/{COIN}/api/bet_feeds/{query}/{type}` |
| `/{COIN}/explorer/bets/{query}/{type}` | `/{COIN}/api/bets/{query}/{type}` |
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
| `/{COIN}/explorer/polls/{query}/{type}` | `/{COIN}/api/polls/{query}/{type}` |
| `/{COIN}/explorer/votes/{query}/{type}` | `/{COIN}/api/votes/{query}/{type}` |
| `/{COIN}/explorer/governance_votes/{query}/{type}` | `/{COIN}/api/governance_votes/{query}/{type}` |

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
| `ping` | Health check: returns a pong response |

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
| `GET /{COIN}/api/contract/{tick}` | Contract metadata |
| `GET /{COIN}/api/contract/{tick}/state` | Contract sandbox state |
| `GET /{COIN}/api/contract/{tick}/balance` | Contract token balances |
| `GET /{COIN}/api/execution/{query}` | Single execution record |
| `GET /{COIN}/api/xcall/{callId}` | Single cross-chain call lifecycle |
| `GET /{COIN}/api/project/{tick}` | Project registry roster for a token |
| `GET /{COIN}/api/poll/{actionIndex}` | Poll details by creating action index |
| `GET /{COIN}/api/poll/{actionIndex}/results` | Finalized per-option poll tallies |
| `GET /{COIN}/api/pubkey/{address}` | On-chain public key for an address |
| `GET /{COIN}/api/status` | Platform status |
| `GET /{COIN}/api/network` | Network statistics |
| `GET /{COIN}/api/validators` | Validator federation list |
| `GET /{COIN}/api/controllers` | Controller-bound token event stream |
| `GET /{COIN}/api/deploy_chunks` | Chunked DEPLOY upload records |
| `GET /{COIN}/api/actions` | All actions (filterable by block, txid, tick) |
| `GET /{COIN}/api/checkpoints` | Latest quorum-signed state checkpoints |
| `GET /{COIN}/api/checkpoints/range` | Slice of checkpoints between two heights (light-client sync) |
| `GET /{COIN}/api/checkpoint/{height}/verify` | Verify a checkpoint at a given height |
| `GET /{COIN}/api/proof/balance/{address}/{tick}` | SMT balance inclusion/non-inclusion proof |
| `GET /{COIN}/api/proof/action/{actionIndex}` | Block-content inclusion proof for an action |
| `GET /BTC/api/proof/validator-set` | Stake-weighted validator-set proof (BTC-only) |
| `GET /{COIN}/api/proof/contract-state/{idx}/{key}` | Contract-state proof (reserved; HTTP 501 in v1) |
| `GET /{COIN}/api/feequote` | Native-coin fee pre-flight quote |
| `GET /{COIN}/api/feeschedule` | Native-coin fee schedule |
| `GET /{COIN}/api/preflight` | Validity-first action pre-flight, independent of fee support |
| `POST /{COIN}/api/preflight` | Same pre-flight with the inputs in a JSON body, for actions too large for a URL |
| `GET /{COIN}/api/oraclefeequote` | Oracle usage-fee quote for a Mode B dispenser |
| `GET /{COIN}/api/file/{actionIndex}/raw` | Raw FILE action bytes (or gated ciphertext) |
| `GET /openapi.json` | OpenAPI 3.1 machine-readable spec |
| `GET /relay?url={url}` | Off-chain resource proxy (JSON/PNG, SSRF-guarded) |
| `GET /icon/{path}` | Token icon image |

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
| `GET /{COIN}/api/bet_feeds/...` | `block`, `address`, `source`, `token`, `status` |
| `GET /{COIN}/api/bets/...` | `block`, `address`, `feed`, `token`, `status` |
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

### VM / Contract List Endpoints

| Endpoint | Supported Types |
|---|---|
| `GET /{COIN}/api/contracts/...` | `block`, `address`, `source` |
| `GET /{COIN}/api/executions/...` | `block`, `address`, `contract` |
| `GET /{COIN}/api/deposits/...` | `block`, `address`, `source`, `contract` |
| `GET /{COIN}/api/withdrawals/...` | `block`, `address`, `source`, `contract` |

### Staking and Validator List Endpoints

| Endpoint | Supported Types |
|---|---|
| `GET /{COIN}/api/stakes/...` | `block`, `address`, `source` |
| `GET /{COIN}/api/delegations/...` | `block`, `address`, `source` |
| `GET /{COIN}/api/delegation_revocations/...` | `block`, `address`, `source` |
| `GET /{COIN}/api/rewards/...` | `address`, `source` |
| `GET /{COIN}/api/collects/...` | `block`, `address`, `source` |
| `GET /{COIN}/api/full_node_verifications/...` | `block`, `epoch`, `pubkey`, `address` |
| `GET /{COIN}/api/contract_stakes/...` | `block`, `address`, `contract` |
| `GET /{COIN}/api/contract_unstakes/...` | `block`, `address`, `contract` |
| `GET /{COIN}/api/contract_delegations/...` | `block`, `address`, `contract` |
| `GET /{COIN}/api/slash_events/...` | `block`, `address`, `contract` |

### ANCHOR and Attestation and Cross-Chain Call List Endpoints

| Endpoint | Supported Types |
|---|---|
| `GET /{COIN}/api/anchors/...` | `block`, `chain`, `network`, `status` |
| `GET /{COIN}/api/attestations/...` | `block`, `address`, `contract` |
| `GET /{COIN}/api/xcalls/...` | `block`, `contract`, `status` |

### Price and Oracle List Endpoints

| Endpoint | Supported Types |
|---|---|
| `GET /{COIN}/api/prices/...` | `block`, `address`, `source`, `token` |
| `GET /{COIN}/api/price_snapshots/...` | `pair`, `round`, `status` |

### Cross-Chain DEX List Endpoints

| Endpoint | Supported Types |
|---|---|
| `GET /{COIN}/api/cross_chain_matches/...` | `match`, `block`, `status` |
| `GET /{COIN}/api/cross_chain_settlements/...` | `match`, `block` |

### Governance List Endpoints

| Endpoint | Supported Types |
|---|---|
| `GET /{COIN}/api/polls/...` | `block`, `tick`, `status`, `source` |
| `GET /{COIN}/api/votes/...` | `address`, `poll`, `block` |
| `GET /{COIN}/api/validator_capabilities/...` | `capability`, `pubkey` |
| `GET /{COIN}/api/governance_proposals/...` | `status`, `parameter`, `proposal` |
| `GET /{COIN}/api/governance_votes/...` | `proposal`, `voter` |
| `GET /{COIN}/api/capability_slash_events/...` | `block`, `capability`, `pubkey`, `address` |
| `GET /{COIN}/api/oracle_prices/...` | `token`, `address` |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
