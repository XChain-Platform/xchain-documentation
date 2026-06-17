<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Query the Explorer

The explorer exposes the full indexed state of the XChain platform via a REST API. This tutorial covers reading that state via the SDK and via direct HTTP calls.

---

## SDK vs Direct HTTP

The SDK's `explorer` object is a thin wrapper around the REST API. Both approaches work; use the SDK when you want typed convenience methods with hub-based URL discovery, and direct HTTP when you need a simple script, a browser fetch, or a language other than Node.js.

```js
const XChainSDK = require('xchain-sdk');
const sdk = new XChainSDK({ hubUrl: 'http://localhost:35500' });

// SDK style
const token = await sdk.explorer.getToken('MYTOKEN');

// Equivalent direct HTTP
const response = await fetch('http://localhost:35300/BTC/api/token/MYTOKEN');
const token2 = await response.json();
```

---

## Token Information

```js
// SDK
const token = await sdk.explorer.getToken('MYTOKEN');

// curl
// curl http://localhost:35300/BTC/api/token/MYTOKEN

console.log(token);
// {
//   tick: 'MYTOKEN',
//   max_supply: '1000000',
//   decimals: 8,
//   supply: '15000',
//   owner: 'bc1q...',
//   description: 'https://example.com/icon.png',
//   lock_max_supply: 0,
//   lock_max_mint: 0,
//   mint_start_block: null,
//   mint_stop_block: null,
//   ...
// }
```

---

## Address Balances

```js
// SDK
const balances = await sdk.explorer.getBalances('bc1q...');

// curl
// curl http://localhost:35300/BTC/api/balances/bc1q.../

// With pagination
const page2 = await sdk.explorer.getBalances('bc1q...', {
  page: 2,
  limit: 25,
});
```

---

## Transaction History

```js
// All actions involving an address
const history = await sdk.explorer.getHistory('bc1q...', 'address', {
  page: 1,
  limit: 50,
});

// curl
// curl "http://localhost:35300/BTC/api/history/bc1q.../address?page=1&limit=50"

// Each entry includes action type, amounts, counterparty, block height, txid
history.forEach(entry => {
  console.log(`${entry.action}: ${entry.amount} ${entry.tick} at block ${entry.block_index}`);
});
```

---

## Token Holders

```js
// All addresses holding a token, sorted by balance descending
const holders = await sdk.explorer.getHolders('MYTOKEN', {
  page: 1,
  limit: 100,
});

// curl
// curl http://localhost:35300/BTC/api/holders/MYTOKEN

holders.forEach(h => {
  console.log(`${h.address}: ${h.amount}`);
});
```

---

## All Actions for a Token

```js
// Every action (ISSUE, MINT, SEND, etc.) that references a token
const actions = await sdk.explorer.getHistory('MYTOKEN', 'token', {
  page: 1,
  limit: 50,
});

// curl
// curl http://localhost:35300/BTC/api/history/MYTOKEN/token

// Filter by action type on the client side
const mints = actions.filter(a => a.action === 'MINT');
const sends = actions.filter(a => a.action === 'SEND');
```

---

## Market Data

```js
// Order book and recent trades for a trading pair
const markets = await sdk.explorer.getMarkets('MYTOKEN');

// curl
// curl http://localhost:35300/BTC/api/markets/MYTOKEN

console.log(markets);
// {
//   last_price: '0.001',
//   volume_24h: '15.5',
//   buy_orders: [...],
//   sell_orders: [...],
//   trades: [...]
// }
```

---

## Dispensers

```js
// All dispensers for a token
const dispensers = await sdk.explorer.getDispensers('MYTOKEN', 'token', {
  page: 1,
  limit: 25,
});

// curl
// curl http://localhost:35300/BTC/api/dispensers/MYTOKEN/token

// Open dispensers only
const openDispensers = dispensers.filter(d => d.status === 'open');
openDispensers.forEach(d => {
  console.log(
    `Dispenser ${d.action_index}: ${d.give_amount} ${d.give_tick}` +
    ` for ${d.get_amount} ${d.get_tick || 'BTC'}, ` +
    `${d.dispenses}/1000 dispenses, ${d.give_escrow} remaining`
  );
});
```

---

## Orders (DEX)

```js
// All open orders for a token
const orders = await sdk.explorer.getOrders('MYTOKEN', 'token', {
  page: 1,
  limit: 50,
});

// curl
// curl http://localhost:35300/BTC/api/orders/MYTOKEN/token

orders.forEach(o => {
  console.log(
    `Order ${o.action_index}: ` +
    `give ${o.give_amount} ${o.give_tick} for ${o.get_amount} ${o.get_tick}`
  );
});
```

---

## Pagination Pattern

All list endpoints support `page` and `limit`. The response includes total count for building pagination controls.

```js
async function fetchAllHolders(tick) {
  const limit = 100;
  let page = 1;
  const all = [];

  while (true) {
    const results = await sdk.explorer.getHolders(tick, { page, limit });
    all.push(...results.data);

    if (all.length >= results.total || results.data.length < limit) break;
    page++;
  }

  return all;
}

const allHolders = await fetchAllHolders('MYTOKEN');
console.log(`Total holders: ${allHolders.length}`);
```

---

## Transaction Lookup

Look up a specific transaction to get the action it contained:

```js
// curl
// curl http://localhost:35300/BTC/api/transaction/abc123.../tx_hash

const actions = await sdk.explorer.getTransaction('abc123...', 'tx_hash');
console.log('Actions in tx:', actions);
```

---

## Searching by Block

```js
// All actions in a specific block
// curl "http://localhost:35300/BTC/api/history/800000/block"

const blockActions = await sdk.explorer.getHistory(800000, 'block', {
  page: 1,
  limit: 50,
});
```

---

## Token-Gated Check Pattern

A common use case is checking whether an address holds a minimum balance before granting access:

```js
async function hasAccess(address, requiredTick, minimumAmount) {
  const balances = await sdk.explorer.getBalances(address);
  const entry = balances.find(b => b.tick === requiredTick);
  if (!entry) return false;

  // String comparison is insufficient for large numbers with decimals.
  // Use a big-number library.
  const { bignumber, largerEq } = require('mathjs');
  return largerEq(bignumber(entry.amount), bignumber(minimumAmount));
}

const canAccess = await hasAccess('bc1q...', 'MYTOKEN', '1');
console.log('Access granted:', canAccess);
```

This is the building block for token-gated systems. For production use, you also need wallet ownership proof (challenge-response signing), session management, and content delivery patterns. See [Pattern 3: Token-Gated Access](Integration_Patterns.md#pattern-3-token-gated-access) in the Integration Patterns guide for the complete implementation.

---

## Polling for State Changes

The explorer has no webhook support. Poll with a short interval to detect incoming actions:

```js
async function waitForIncomingTransfer(address, tick, afterBlock) {
  const poll = async () => {
    const history = await sdk.explorer.getHistory(address, 'address', { page: 1, limit: 10 });
    return history.find(
      h => h.action === 'SEND' && h.destination === address &&
           h.tick === tick && h.block_index > afterBlock
    );
  };

  let found;
  while (!found) {
    found = await poll();
    if (!found) await new Promise(r => setTimeout(r, 5000));
  }
  return found;
}
```

See [Integration_Patterns.md](Integration_Patterns.md) for more production-ready polling and event-detection patterns.

---

## Next Steps

- [Integration_Patterns.md](Integration_Patterns.md): using explorer queries in real applications
- [Build_A_Dispenser.md](Build_A_Dispenser.md): monitor dispenser state
- [Cross_Chain_Swap.md](Cross_Chain_Swap.md): query swaps across chains

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
