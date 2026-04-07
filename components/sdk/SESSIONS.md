<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform SDK — Wallet Sessions

A Wallet Session binds a WIF private key to an SDK instance, creating a stateful object that tracks the session's address, public key, and UTXOs. This provides a natural "I am this address, do things" mental model.

---

## Creating a Session

```js
const session = sdk.session('your-wif-key');

console.log(session.address); // derived address (p2pkh by default)
console.log(session.pubkey);  // hex-encoded public key
```

### Options

```js
const session = sdk.session('your-wif-key', {
    addressType:    'p2pkh',   // 'p2pkh' (default), 'p2wpkh', or 'p2sh-p2wpkh'
    waitForIndexer: true,      // default for all submit calls
    timeout:        120000,    // default timeout for indexer confirmation
    pollInterval:   2000,      // default poll interval
    requireValid:   true       // default validity check
});
```

---

## Submitting Actions

Every action method on a session goes through the full lifecycle (encode → sign → broadcast → wait):

```js
// Send tokens
await session.send({ tick: 'MYTOKEN', amount: '100', destination: 'bc1q...' });

// Issue a new token
await session.issue({ tick: 'NEWTOKEN', maxSupply: '1000000', decimals: 8 });

// Place a DEX order
await session.order({
    giveTick: 'TOKENA', giveAmount: '100',
    getTick: 'TOKENB', getAmount: '200'
});
```

### Available Action Methods

All 29 action types are available as convenience methods:

| Category | Methods |
|---|---|
| Token lifecycle | `send`, `issue`, `mint`, `destroy`, `transfer` |
| Trading | `order`, `swap`, `coinpay`, `dispenser` |
| Distribution | `dividend`, `airdrop`, `sweep` |
| Communication | `broadcast`, `message`, `file` |
| Utility | `list`, `link`, `callback`, `sleep`, `address` |
| Staking (BTC) | `stake`, `unstake`, `delegate`, `revokeDelegation`, `claimRewards` |
| Smart contracts | `deploy`, `execute`, `deposit`, `withdraw` |

### Generic Submit

For any action type, use `submit()` directly:

```js
await session.submit(
    { action: 'SEND', params: { tick: 'TOKEN', amount: '50', destination: 'bc1q...' } },
    { encoding: 'OP_RETURN' },  // optional encoder overrides
    { timeout: 60000 }          // optional submit overrides
);
```

---

## UTXO-Aware Transaction Chaining

Sessions maintain an in-memory UTXO cache that enables rapid sequential transactions without waiting for each one to confirm:

```js
const session = sdk.session(wif);

// These can be sent back-to-back without double-spending
await session.send({ tick: 'TOKEN', amount: '10', destination: addr1 });
await session.send({ tick: 'TOKEN', amount: '20', destination: addr2 });
await session.send({ tick: 'TOKEN', amount: '30', destination: addr3 });
```

The cache automatically:
- Loads UTXOs from the UTXO tracker on first use
- Marks spent UTXOs after each transaction
- Tracks speculative change outputs from recently broadcast transactions
- Prevents double-spend by filtering out already-used UTXOs

### Manual UTXO Refresh

```js
// Force a fresh UTXO fetch from the tracker
await session.refreshUTXOs();
```

---

## Explorer Queries (Scoped to Session Address)

```js
const balances   = await session.getBalances();
const history    = await session.getHistory();
const credits    = await session.getCredits('address');
const debits     = await session.getDebits('address');
const sends      = await session.getSends();
const orders     = await session.getOrders();
const swaps      = await session.getSwaps();
const dispensers = await session.getDispensers();
```

All queries are automatically scoped to the session's address.

---

## Fee Estimation

```js
const estimate = await session.estimateFees({
    action: 'SEND',
    params: { tick: 'TOKEN', amount: '100', destination: 'bc1q...' }
});
console.log(`Fee: ${estimate.fee} satoshis`);
```

The session automatically fills in `pubkey` and `change` from the session credentials.

---

## Session Properties

| Property | Type | Description |
|---|---|---|
| `sdk` | `XChainSDK` | Parent SDK instance |
| `wif` | `string` | WIF private key |
| `pubkey` | `string` | Hex-encoded public key |
| `publicKey` | `Buffer` | Raw public key buffer |
| `address` | `string` | Derived address |
| `compressed` | `boolean` | Whether the key is compressed |

---

## Related Documentation

- [Transaction Lifecycle](LIFECYCLE.md) — `submitAction` details, fee estimation, progress callbacks
- [Workflows](WORKFLOWS.md) — multi-step recipes that use sessions internally
- [Wallet & Auth](WALLET.md) — key management, address derivation, PSBT signing

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
