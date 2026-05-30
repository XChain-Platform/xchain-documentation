<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Build a Dispenser

A dispenser is a token vending machine. You escrow tokens into it, set a price in another token (or in coin), and anyone who sends the required amount to the dispenser address automatically receives the dispensed tokens. No counterparty needed.

This tutorial assumes you already have a token. If not, complete [Build_Your_First_Token.md](Build_Your_First_Token.md) first.

---

## Prerequisites

- SDK connected to regtest (see [Regtest_Development.md](Regtest_Development.md))
- `MYTOKEN` exists and you hold at least `100` units
- You hold UTXO(s) to cover the transaction fee

---

## Step 1: Understand the Parameters

A dispenser has two sides:

- **Give side** (`GIVE_COIN`, `GIVE_TICK`, `GIVE_AMOUNT`, `GIVE_ESCROW`) — the token you are selling. You escrow `GIVE_ESCROW` units up front. Each trigger dispenses `GIVE_AMOUNT`.
- **Get side** (`GET_COIN`, `GET_TICK`, `GET_AMOUNT`, `GET_ADDRESS`) — what buyers must send to trigger the dispenser, and where they send it.

Additional controls:
- `EXPIRATION` — Unix timestamp when the dispenser closes automatically
- `ALLOW_LIST` / `BLOCK_LIST` — restrict which addresses can trigger it
- Maximum 1,000 dispenses per dispenser

---

## Step 2: Create the Dispenser

```js
const XChainSDK = require('xchain-sdk');
const sdk = new XChainSDK({ hubUrl: 'http://localhost:35500' });

// Sell 10 MYTOKEN per 0.001 BTC
// Escrow 100 MYTOKEN upfront (enough for 10 dispenses)
const dispenserAction = sdk.dispenser({
  giveCoin: 'BTC',
  giveTick: 'MYTOKEN',
  giveAmount: '10',          // tokens dispensed per trigger
  giveEscrow: '100',         // total escrowed; dispenser closes when exhausted
  getCoin: 'BTC',
  getTick: '',               // empty = native coin (BTC)
  getAmount: '0.001',        // buyer must send exactly 0.001 BTC
  getAddress: 'YOUR_ADDRESS', // address that receives BTC payments
  // expiration: Math.floor(Date.now() / 1000) + 86400 * 7, // 1 week, optional
});
// Returns: "DISPENSER|0|BTC|MYTOKEN|10|100|BTC||0.001|YOUR_ADDRESS|..."

const psbt = await sdk.encoder.createPSBT({
  action: dispenserAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});

const txid = await signAndBroadcast(psbt.psbt);
await mineBlock();

console.log('Dispenser created, txid:', txid);
```

When this transaction confirms, the indexer escrows 100 MYTOKEN from your balance into the dispenser. The tokens are no longer in your regular balance — they are held by the dispenser until dispensed or returned.

---

## Step 3: Find the Dispenser's ACTION_INDEX

You need the `ACTION_INDEX` to reference this dispenser for future edits or cancellations.

```js
const actions = await sdk.explorer.getTransaction(txid, 'tx_hash');
const dispenserActionIndex = actions[0].action_index;
console.log('Dispenser action_index:', dispenserActionIndex);

// Or look up all dispensers for a token
const dispensers = await sdk.explorer.getDispensers('MYTOKEN', 'token', {
  page: 1,
  limit: 10,
});
console.log('Open dispensers:', dispensers);
// [{
//   action_index: 1234,
//   give_tick: 'MYTOKEN',
//   give_amount: '10',
//   give_escrow: '100',
//   get_amount: '0.001',
//   get_address: 'YOUR_ADDRESS',
//   dispenses: 0,
//   status: 'open',
//   ...
// }]
```

---

## Step 4: Trigger the Dispenser

Anyone can trigger the dispenser by sending exactly `getAmount` of `getTick` (in this case 0.001 BTC) to `getAddress`. This is a plain coin transfer — no XChain action needed from the buyer.

In regtest, you can simulate this using the regtest miner's `send_funds`:

```js
// Simulate a buyer sending 0.001 BTC to the dispenser address
const response = await fetch('http://localhost:38332', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'send_funds',
    params: {
      address: 'YOUR_ADDRESS',  // the GET_ADDRESS
      amount: 0.001,
    },
  }),
});
await mineBlock();
```

When the indexer detects the inbound payment to `GET_ADDRESS`, it automatically credits the buyer with `GIVE_AMOUNT` (10 MYTOKEN) and reduces the escrow.

---

## Step 5: Verify the Dispense

```js
// Check buyer's balance
const buyerBalances = await sdk.explorer.getBalances('BUYER_ADDRESS');
console.log('Buyer received:', buyerBalances);
// [{ tick: 'MYTOKEN', amount: '10', ... }]

// Check dispenser status
const dispensers = await sdk.explorer.getDispensers('MYTOKEN', 'token');
const dispenser = dispensers.find(d => d.action_index === dispenserActionIndex);
console.log('Dispenses so far:', dispenser.dispenses); // 1
console.log('Remaining escrow:', dispenser.give_escrow); // 90
```

---

## Step 6: Refill the Dispenser (Edit)

Use DISPENSER v2 to add more tokens to the escrow or adjust the expiration.

```js
const editAction = sdk.dispenser({
  version: 2,
  dispenserActionIndex: dispenserActionIndex,
  giveEscrow: '200', // add 200 more MYTOKEN to escrow
  // expiration: newTimestamp,  // extend expiration, optional
});
// Returns: "DISPENSER|2|1234|200|..."

const editPsbt = await sdk.encoder.createPSBT({
  action: editAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});

await signAndBroadcast(editPsbt.psbt);
await mineBlock();
```

---

## Step 7: Cancel the Dispenser

Use DISPENSER v1 to close the dispenser. Escrowed tokens are returned to the address that created it.

```js
const cancelAction = sdk.dispenser({
  version: 1,
  dispenserActionIndex: dispenserActionIndex,
  memo: 'Closing for the season',
});
// Returns: "DISPENSER|1|1234|Closing for the season"

const cancelPsbt = await sdk.encoder.createPSBT({
  action: cancelAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});

await signAndBroadcast(cancelPsbt.psbt);
await mineBlock();

// Verify it closed and escrow returned
const myBalances = await sdk.explorer.getBalances('YOUR_ADDRESS');
console.log('Balance after cancel:', myBalances);
```

Note: after cancellation there is a set delay (approximately one hour in production, or a few blocks in regtest) before escrowed tokens are released. `ALLOW_LIST` and `BLOCK_LIST` edits also carry this same delay.

---

## Dispenser Patterns

**Sell for another token instead of coin:**

```js
const tokenForTokenDispenser = sdk.dispenser({
  giveCoin: 'BTC',
  giveTick: 'MYTOKEN',
  giveAmount: '10',
  giveEscrow: '100',
  getCoin: 'BTC',
  getTick: 'XCHAIN',         // buyer must pay in XCHAIN tokens
  getAmount: '5',
  getAddress: 'YOUR_ADDRESS',
});
```

**Private dispenser (allow list only):**

```js
// First create the allow list (see Advanced_Token_Features.md)
const privateDispenser = sdk.dispenser({
  giveCoin: 'BTC',
  giveTick: 'MYTOKEN',
  giveAmount: '10',
  giveEscrow: '100',
  getCoin: 'BTC',
  getTick: '',
  getAmount: '0.001',
  getAddress: 'YOUR_ADDRESS',
  allowList: allowListActionIndex,
});
```

---

## Next Steps

- [Advanced_Token_Features.md](Advanced_Token_Features.md) — allow/block lists, mint windows
- [Query_The_Explorer.md](Query_The_Explorer.md) — monitor dispenser state via API
- [Batch_Operations.md](Batch_Operations.md) — issue and create a dispenser in one transaction

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
