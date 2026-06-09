<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK — Cross-Chain Helpers

The `CrossChainHelper` class coordinates actions across multiple SDK instances connected to different blockchains (Bitcoin, Litecoin, Dogecoin).

---

## Setup

Create one SDK instance per chain, then pass them to the helper:

```js
const { XChainSDK, CrossChainHelper } = require('xchain-sdk');

const btcSdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'btc-explorer.example.com',
    encoderUrl: 'btc-encoder.example.com'
});

const ltcSdk = new XChainSDK({
    network: 'litecoin-mainnet',
    explorerUrl: 'ltc-explorer.example.com',
    encoderUrl: 'ltc-encoder.example.com'
});

const bridge = new CrossChainHelper({ BTC: btcSdk, LTC: ltcSdk });
```

Keys can be coin symbols (`BTC`, `LTC`, `DOGE`) or full network strings (`bitcoin-mainnet`).

---

## createSwap

Create a cross-chain swap offer on the "give" chain:

```js
const result = await bridge.createSwap({
    giveCoin:   'BTC',
    giveTick:   'TOKEN_A',
    giveAmount: '100',
    getCoin:    'LTC',
    getTick:    'TOKEN_B',
    getAmount:  '200',
    wif:        btcWIF,
    expiration: 850000
});

console.log(result.swap.txid);
```

---

## link

Create a LINK between actions on two different chains:

```js
const result = await bridge.link({
    coin1:            'BTC',
    coin1ActionIndex: 12345,
    coin2:            'LTC',
    coin2ActionIndex: 67890,
    wif:              btcWIF,
    submitOn:         'BTC'   // which chain submits the LINK (defaults to coin1)
});

console.log(result.txid);
```

---

## parallel

Execute actions on multiple chains simultaneously:

```js
const results = await bridge.parallel([
    {
        chain: 'BTC',
        wif: btcWIF,
        actionData: { action: 'SEND', params: { tick: 'TOKENA', amount: '50', destination: btcAddr } }
    },
    {
        chain: 'LTC',
        wif: ltcWIF,
        actionData: { action: 'SEND', params: { tick: 'TOKENB', amount: '100', destination: ltcAddr } }
    }
]);

console.log(results[0].txid); // BTC transaction
console.log(results[1].txid); // LTC transaction
```

All actions are submitted concurrently via `Promise.all`.

---

## waitForAll

Wait for transactions on multiple chains to be indexed:

```js
const actions = await bridge.waitForAll([
    { chain: 'BTC', txid: 'abc123...' },
    { chain: 'LTC', txid: 'def456...' }
], { timeout: 60000 });

console.log(actions[0]); // BTC action data
console.log(actions[1]); // LTC action data
```

---

## getAllBalances

Get token balances across all configured chains:

```js
const balances = await bridge.getAllBalances('bc1qmyaddress...');

console.log(balances.BTC);  // BTC chain balances
console.log(balances.LTC);  // LTC chain balances (or { error: '...' } if query failed)
```

Note: the address must be valid on each chain's network.

---

## Error Handling

- `SDKConfigError('CHAIN_NOT_CONFIGURED')` — thrown when referencing a chain not in the `sdkMap`
- `SDKConfigError('INVALID_SDK_MAP')` — thrown if fewer than 2 SDK instances are provided
- Individual action errors from each chain propagate through `parallel()` and other methods

---

## Related Documentation

- [Transaction Lifecycle](LIFECYCLE.md) — `submitAction` used by each chain's session
- [Wallet Sessions](SESSIONS.md) — sessions created internally for each action
- [Workflows](WORKFLOWS.md) — single-chain multi-step recipes
- [Actions](ACTIONS.md) — SWAP and LINK action parameters

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
