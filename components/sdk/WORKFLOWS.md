<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform SDK — Workflow Recipes

Workflow recipes are high-level helpers that compose multiple actions into common multi-step operations. Each recipe creates a wallet session internally and executes the steps sequentially with UTXO chaining.

All workflow methods are available directly on the SDK instance and also via `sdk.workflows`.

---

## issueAndDistribute

Issue a new token and immediately send it to multiple recipients:

```js
const result = await sdk.issueAndDistribute(
    wif,
    { tick: 'NEWTOKEN', maxSupply: '1000000', decimals: 8 },
    [
        { destination: 'bc1qaddr1...', amount: '500000' },
        { destination: 'bc1qaddr2...', amount: '300000' },
        { destination: 'bc1qaddr3...', amount: '200000' }
    ]
);

console.log(result.issue.txid);      // ISSUE transaction
console.log(result.sends[0].txid);   // first SEND transaction
console.log(result.sends.length);    // 3
```

---

## issueAndMint

Issue a new token and mint the initial supply in one flow:

```js
const result = await sdk.issueAndMint(
    wif,
    { tick: 'NEWTOKEN', maxSupply: '1000000', decimals: 8 },
    { amount: '100000', destination: 'bc1qrecipient...' }
);

console.log(result.issue.txid); // ISSUE transaction
console.log(result.mint.txid);  // MINT transaction
```

The `tick` field in mintParams is automatically filled from the issue params.

---

## createDispenser

Create a token dispenser:

```js
const result = await sdk.createDispenser(wif, {
    giveTick:   'MYTOKEN',
    giveAmount: '10',
    giveEscrow: '1000',
    getTick:    'BTC',
    getAmount:  '0.001',
    memo:       '10 MYTOKEN per 0.001 BTC'
});

console.log(result.txid);
```

---

## createOrder / cancelOrder

Place and cancel DEX orders:

```js
// Place an order
const result = await sdk.createOrder(wif, {
    giveTick:   'TOKENA',
    giveAmount: '100',
    getTick:    'TOKENB',
    getAmount:  '200',
    expiration: 850000
});

// Cancel the order (using the indexed action_index)
await sdk.cancelOrder(wif, result.indexed.action_index);
```

---

## stakeAndDelegate

Stake XCHAIN tokens and delegate a signing key in one flow (capability staking; BTC-only):

```js
const result = await sdk.stakeAndDelegate(
    wif,
    { version: 1, amount: '1000', signingPubkey: 'aabb...' },  // capabilities auto-qualified from amount; pubkey is 64 hex chars
    { newSigningPubkey: 'ccdd...' }  // optional — omit to skip delegation
);

console.log(result.stake.txid);
console.log(result.delegate.txid);   // null if delegateParams was omitted
```

---

## deployAndFund

Deploy a smart contract and optionally deposit initial tokens:

```js
const result = await sdk.deployAndFund(
    wif,
    {
        code: 'class MyContract { constructor() { this.count = 0; } increment() { this.count++; } }',
        gasLimit: 100000
    },
    [
        { tick: 'TOKENA', quantity: '1000' },
        { tick: 'TOKENB', quantity: '500' }
    ]
);

console.log(result.deploy.txid);
console.log(result.deploy.indexed.action_index);  // contract ACTION_INDEX
console.log(result.deposits.length);               // 2
```

The contract `action_index` from the deploy result is automatically used for the deposit operations.

---

## distributeDividend

Distribute a dividend to all holders of a token:

```js
const result = await sdk.distributeDividend(wif, {
    tick:         'HOLDERTOKEN',
    dividendTick: 'REWARDTOKEN',
    amount:       '10000'
});

console.log(result.txid);
```

---

## Custom Workflows

All recipes use `WalletSession` internally. You can compose your own multi-step workflows:

```js
const session = sdk.session(wif);

// Custom workflow: issue, mint, then create a dispenser
await session.issue({ tick: 'TOKEN', maxSupply: '1000000', decimals: 8 });
await session.mint({ tick: 'TOKEN', amount: '1000', destination: session.address });
await session.dispenser({
    giveTick: 'TOKEN', giveAmount: '10', giveEscrow: '1000',
    getTick: 'BTC', getAmount: '0.001'
});
```

---

## Related Documentation

- [Wallet Sessions](SESSIONS.md) — the session object used by all workflows
- [Transaction Lifecycle](LIFECYCLE.md) — `submitAction` details, fee estimation
- [Actions](ACTIONS.md) — parameter reference for each action type
- [Cross-Chain](CROSSCHAIN.md) — multi-chain coordination

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
