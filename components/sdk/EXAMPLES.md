<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Examples

End-to-end usage examples for common XChain Platform SDK workflows.

## Table of Contents

- [Setup](#setup)
- [Query Balances](#query-balances)
- [Get Token Info](#get-token-info)
- [Send Tokens](#send-tokens)
- [Send Tokens with PSBT](#send-tokens-with-psbt)
- [Issue a New Token](#issue-a-new-token)
- [Update Token Description](#update-token-description)
- [Lock Token Properties](#lock-token-properties)
- [Mint Tokens](#mint-tokens)
- [Destroy Tokens](#destroy-tokens)
- [Create a Dispenser](#create-a-dispenser)
- [Cancel a Dispenser](#cancel-a-dispenser)
- [Place a DEX Order](#place-a-dex-order)
- [Cancel a DEX Order](#cancel-a-dex-order)
- [Batch Multiple Actions](#batch-multiple-actions)
- [Cross-Chain Swap](#cross-chain-swap)
- [Sweep All Balances](#sweep-all-balances)
- [Broadcast a Message](#broadcast-a-message)
- [Send a Plaintext Message](#send-a-plaintext-message)
- [Sleep / Pause an Address](#sleep--pause-an-address)
- [Create and Edit a List](#create-and-edit-a-list)
- [Pay Dividends](#pay-dividends)
- [Query Market Data](#query-market-data)
- [Query Transaction History](#query-transaction-history)
- [Validate Before Creating](#validate-before-creating)
- [Force Encoding Type](#force-encoding-type)
- [Error Handling](#error-handling)
- [Hub Discovery](#hub-discovery)
- [Request Logging](#request-logging)

---

## Setup

```js
const { XChainSDK } = require('xchain-sdk');

// Minimal — action string generation only (no network calls)
const sdk = new XChainSDK();

// With explorer (for querying blockchain data)
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    explorerPort: 8080
});

// With encoder (for generating PSBTs)
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    encoderUrl: 'encoder.xchain.io',
    encoderPort: 3000
});
```

---

## Query Balances

```js
const balances = await sdk.getBalances('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
console.log(balances);
// { total: 5, data: [{ tick: 'MYTOKEN', amount: '1000', ... }, ...] }

// With pagination
const page2 = await sdk.getBalances('bc1q...', { page: 2, limit: 50, sortorder: 'DESC' });
```

---

## Get Token Info

```js
const token = await sdk.getToken('MYTOKEN');
console.log(token.info.tick);       // 'MYTOKEN'
console.log(token.supply.current);  // '500000'
console.log(token.supply.max);      // '21000000'
console.log(token.locks.mint);      // true/false
```

---

## Send Tokens

```js
// Generate the ACTION string only (no PSBT)
const result = await sdk.send({
    tick: 'MYTOKEN',
    amount: '100',
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    memo: 'Payment for services'
});

console.log(result.actionString); // 'SEND|0|MYTOKEN|100|bc1q...|Payment for services'
console.log(result.version);     // 0
console.log(result.psbt);        // null (no encoder options provided)
```

---

## Send Tokens with PSBT

```js
// Generate ACTION string AND encode into a PSBT
const result = await sdk.send(
    {
        tick: 'MYTOKEN',
        amount: '100',
        destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    },
    {
        pubkey: 'your-public-key-or-address',
        change: 'your-change-address',
        rbf: true
    }
);

console.log(result.actionString); // 'SEND|0|MYTOKEN|100|bc1q...'
console.log(result.psbt);        // '70736274ff...' (hex-encoded PSBT)
console.log(result.encoding);    // 'OP_RETURN' (auto-selected)

// Sign the PSBT with your wallet and broadcast to the network
```

---

## Issue a New Token

```js
const result = await sdk.issue({
    tick: 'NEWTOKEN',
    maxSupply: '21000000',
    maxMint: '1000',
    decimals: 8,
    description: 'A new token on XChain',
    mintSupply: '0',
    lockMaxSupply: 1,
    lockDescription: 0
});

console.log(result.version);     // 0 (full create)
console.log(result.actionString); // 'ISSUE|0|NEWTOKEN|21000000|1000|8|A new token on XChain|0|...'
```

---

## Update Token Description

```js
// Only provide tick + description → SDK auto-selects v1 (shortest format)
const result = await sdk.issue({
    tick: 'NEWTOKEN',
    description: 'Updated description for my token'
});

console.log(result.version); // 1 (description update — much shorter than v0)
```

---

## Lock Token Properties

```js
const result = await sdk.issue({
    tick: 'NEWTOKEN',
    lockMaxSupply: 1,
    lockMint: 1,
    lockMintSupply: 0,
    lockMaxMint: 0,
    lockDescription: 1,
    lockSleep: 0,
    lockCallback: 0
});

console.log(result.version); // 3 (lock update format)
```

---

## Mint Tokens

```js
const result = await sdk.mint({
    tick: 'NEWTOKEN',
    amount: '1000',
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    memo: 'Initial mint'
});
```

---

## Destroy Tokens

```js
const result = await sdk.destroy({
    tick: 'NEWTOKEN',
    amount: '500',
    memo: 'Burning supply'
});
```

---

## Create a Dispenser

```js
const result = await sdk.dispenser({
    giveTick: 'MYTOKEN',
    giveAmount: '100',
    giveEscrow: '1000',
    getTick: 'PAYTOKEN',
    getAmount: '50',
    fiatCode: 'USD',
    fiatAmount: '10.00',
    memo: 'Token vending machine'
});
```

---

## Cancel a Dispenser

```js
// Provide only the dispenser action index → SDK selects v1 (cancel)
const result = await sdk.dispenser({
    dispenserActionIndex: 12345,
    memo: 'Closing dispenser'
});

console.log(result.version); // 1
```

---

## Place a DEX Order

```js
const result = await sdk.order({
    giveTick: 'TOKEN_A',
    giveAmount: '100',
    getTick: 'TOKEN_B',
    getAmount: '200',
    expiration: 1735689600,
    memo: 'Sell A for B'
});
```

---

## Cancel a DEX Order

```js
const result = await sdk.order({
    orderActionIndex: 99999,
    memo: 'Cancelling order'
});

console.log(result.version); // 1 (cancel format)
```

---

## Batch Multiple Actions

```js
// Fluent builder API
const result = await sdk.batch()
    .send({ tick: 'TOKEN_A', amount: '50', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
    .send({ tick: 'TOKEN_B', amount: '25', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
    .mint({ tick: 'TOKEN_C', amount: '1000', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
    .build();

console.log(result.action);       // 'BATCH'
console.log(result.actionString);  // 'BATCH|0|SEND|0|TOKEN_A|50|bc1q...;SEND|0|TOKEN_B|25|bc1q...;MINT|0|TOKEN_C|1000|bc1q...'

// With encoder to get a PSBT
const tx = await sdk.batch()
    .send({ tick: 'A', amount: '10', destination: 'bc1q...' })
    .destroy({ tick: 'B', amount: '5' })
    .build({ pubkey: 'your-pubkey' });

console.log(tx.psbt); // PSBT hex
```

---

## Cross-Chain Swap

```js
const result = await sdk.swap({
    giveTick: 'BTC_TOKEN',
    giveAmount: '100',
    getTick: 'LTC_TOKEN',
    getAmount: '500',
    expiration: 1735689600,
    memo: 'Cross-chain swap'
});
```

---

## Sweep All Balances

```js
const result = await sdk.sweep({
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    balances: 1,
    ownerships: 1,
    escrows: 0,
    memo: 'Moving everything to new address'
});
```

---

## Broadcast a Message

```js
const result = await sdk.broadcast({
    message: 'Hello XChain!',
    value: '42'
});
```

---

## Send a Plaintext Message

```js
const result = await sdk.message({
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    plaintextMessage: 'Hello, this is a direct message'
});

console.log(result.version); // 3 (plaintext format)
```

---

## Sleep / Pause an Address

```js
// Pause all actions from this address until block 800000
const result = await sdk.sleep({ resumeBlock: 800000 });

// Pause a specific token until block 800000
const result2 = await sdk.sleep({
    resumeBlock: 800000,
    tick: 'MYTOKEN'
});

console.log(result.version);  // 0 (address sleep)
console.log(result2.version); // 1 (tick sleep)
```

---

## Create and Edit a List

```js
// Create a TICK list
const create = await sdk.list({ type: 1, item: 'TOKEN_A,TOKEN_B,TOKEN_C' });

// Edit an existing list — add an item
const edit = await sdk.list({
    edit: 1,               // 1 = ADD
    listActionIndex: 12345,
    item: 'TOKEN_D'
});

console.log(create.version); // 0 (create)
console.log(edit.version);   // 1 (edit)
```

---

## Pay Dividends

```js
const result = await sdk.dividend({
    tick: 'MYTOKEN',
    dividendTick: 'PAYTOKEN',
    amount: '1',
    memo: 'Q1 dividend payout'
});
```

---

## Query Market Data

```js
// Get all markets
const markets = await sdk.getMarkets();

// Get markets for a specific token
const tokenMarkets = await sdk.getMarkets('MYTOKEN');

// Get a specific trading pair
const pair = await sdk.getMarket('TOKEN_A', 'TOKEN_B');

// Get the order book
const orderbook = await sdk.getOrderbook('TOKEN_A', 'TOKEN_B');

// Get trade history
const history = await sdk.getMarketHistory('TOKEN_A', 'TOKEN_B', null, {
    page: 1,
    limit: 50,
    sortorder: 'DESC'
});
```

---

## Query Transaction History

```js
// Get history for an address
const history = await sdk.getHistory('bc1q...', 'address', { limit: 20 });

// Get a specific transaction
const tx = await sdk.getTransaction('abc123...', 'tx_hash');

// Get a specific action by index
const action = await sdk.getAction(12345);

// Get sends for an address
const sends = await sdk.getSends('bc1q...', 'address', { sortorder: 'DESC' });

// Get all mints for a token
const mints = await sdk.getMints('MYTOKEN', 'token', { limit: 100 });
```

---

## Validate Before Creating

```js
// Dry-run validation — no action string generated, no errors thrown
const result = sdk.validateAction('send', {
    tick: 'MYTOKEN',
    amount: '100',
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
});

if (result.valid) {
    console.log('Input is valid, safe to create');
} else {
    console.log('Validation errors:', result.errors);
    // [{ code: 'MISSING_REQUIRED_FIELD', message: '...', details: {...} }]
}
```

---

## Force Encoding Type

```js
// Force P2SH encoding (even if data fits in OP_RETURN)
const result = await sdk.send(
    { tick: 'TOKEN', amount: '100', destination: 'bc1q...' },
    { pubkey: 'your-pubkey', encoding: 'P2SH' }
);
console.log(result.encoding); // 'P2SH'

// OP_RETURN — will throw if action string > 76 bytes
try {
    await sdk.issue(
        { tick: 'TOKEN', maxSupply: '21000000', maxMint: '1000', decimals: 8, description: 'A long description...' },
        { pubkey: 'your-pubkey', encoding: 'OP_RETURN' }
    );
} catch (e) {
    console.log(e.code);             // 'ENCODING_DATA_TOO_LARGE'
    console.log(e.details.suggestion); // 'P2SH'
}
```

---

## Error Handling

```js
const { XChainSDK, SDKValidationError, SDKEncoderError, SDKExplorerError } = require('xchain-sdk');

try {
    await sdk.send({ tick: 'BAD|TOKEN', amount: '100', destination: 'bc1q...' });
} catch (e) {
    if (e instanceof SDKValidationError) {
        console.log('Validation error:', e.code);    // 'FORBIDDEN_CHARACTER'
        console.log('Details:', e.details);           // { action: 'SEND', errors: [...] }
    } else if (e instanceof SDKEncoderError) {
        console.log('Encoder error:', e.code);        // 'ENCODER_RPC_ERROR'
    } else if (e instanceof SDKExplorerError) {
        console.log('Explorer error:', e.code);       // 'EXPLORER_HTTP_404'
    }
}
```

---

## Hub Discovery

```js
const sdk = new XChainSDK({
    network: 'bitcoin-regtest',
    hubUrl: 'hub.xchain.io',
    hubPort: 8001
});

// Fetch config from hub — resolves explorer + encoder endpoints automatically
await sdk.init();

// Now explorer and encoder are configured
const balances = await sdk.getBalances('bc1q...');
const tx = await sdk.send(
    { tick: 'TOKEN', amount: '100', destination: 'bc1q...' },
    { pubkey: 'your-pubkey' }
);
```

---

## Request Logging

```js
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    encoderUrl: 'encoder.xchain.io',
    hooks: {
        onRequest: (info) => {
            console.log(`[${info.service}] → ${info.method} ${info.url || ''}`);
        },
        onResponse: (info) => {
            console.log(`[${info.service}] ← ${info.status || 'OK'}`);
        },
        onError: (info) => {
            console.error(`[${info.service}] ERROR: ${info.error}`);
        },
        onRetry: (info) => {
            console.warn(`[${info.service}] Retry #${info.attempt} in ${info.delay}ms: ${info.error}`);
        }
    }
});
```

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
