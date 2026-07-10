<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Cross-Chain Swap

The SWAP action lets you trade a token on one chain for a token on a different chain (for example, `RAREPEPE` on Bitcoin for `LTCTOKEN` on Litecoin) without a centralized exchange. The xchain-hub coordinates matching across chains.

> **Important:** SWAP works only between XChain tokens. It does not support native coins (BTC, LTC, DOGE) directly. To sell a token for native coin, use a [DISPENSER](Build_A_Dispenser.md) instead.

---

## How It Works

1. Alice creates a SWAP offer on the Bitcoin chain, escrowing `GIVE_AMOUNT` of her token.
2. The hub sees the open swap and broadcasts it to Litecoin indexers.
3. Bob finds the swap and creates a matching SWAP on the Litecoin chain, escrowing his `GET_AMOUNT`.
4. The hub detects both sides and signals settlement.
5. Each indexer credits the counterparty: Alice receives `GET_AMOUNT` on Litecoin; Bob receives `GIVE_AMOUNT` on Bitcoin.
6. If no match occurs before expiration, tokens are returned automatically.

---

## Step 1: Create the Swap Offer (Chain A: Bitcoin)

Alice wants to trade 1 `RAREPEPE` (on BTC) for 1000 `LTCTOKEN` (on LTC).

```js
const XChainSDK = require('xchain-sdk');

// Alice's SDK, pointed at the Bitcoin regtest stack
const aliceSdk = new XChainSDK({ hubUrl: 'http://localhost:10000' });

const swapAction = aliceSdk.swap({
  giveCoin: 'BTC',
  giveTick: 'RAREPEPE',
  giveAmount: '1',
  getCoin: 'LTC',
  getTick: 'LTCTOKEN',
  getAmount: '1000',
  getAddress: 'ltc1qalicesltcaddress...',  // Alice's LTC address to receive tokens
  // expiration: Math.floor(Date.now() / 1000) + 86400 * 3, // 3-day window, optional
});
// Returns an action object; swapAction.actionString holds the wire string, e.g.:
// "SWAP|0|BTC|RAREPEPE|1||LTC|LTCTOKEN|1000||ltc1qalicesltcaddress...|..."

const psbt = await aliceSdk.encoder.createTx({
  data: swapAction.actionString,
  pubkey: 'ALICE_BTC_PUBLIC_KEY',
  utxos: aliceBtcUtxos,
});

const txid = await signAndBroadcast(psbt.psbt);
await mineBlock(); // mine on Bitcoin regtest

// Get the ACTION_INDEX for Bob to reference. getActions() returns { total, data },
// so the matching rows are under .data, not the response itself.
const swapActions = await aliceSdk.explorer.getActions({ txid });
const swapActionIndex = swapActions.data[0].action_index;
console.log('Swap ACTION_INDEX:', swapActionIndex);
```

Alice's `RAREPEPE` is now escrowed. The hub becomes aware of this open swap.

---

## Step 2: Bob Discovers the Swap

Bob's application queries the hub or explorer for open swaps that match his interests.

```js
// Bob's SDK, pointed at the Litecoin stack
const bobSdk = new XChainSDK({ hubUrl: 'http://localhost:10000' });

// Query open swaps wanting LTCTOKEN
const openSwaps = await aliceSdk.explorer.getActions({
  tick: 'RAREPEPE',
  // filter by action type on client
});
const swaps = openSwaps.data.filter(a => a.action === 'SWAP' && a.status === 'open');
console.log('Open swaps:', swaps);
// [{
//   action_index: 1234,
//   give_tick: 'RAREPEPE',
//   give_amount: '1',
//   get_coin: 'LTC',
//   get_tick: 'LTCTOKEN',
//   get_amount: '1000',
//   get_address: 'ltc1qalicesltcaddress...',
//   status: 'open',
//   expiration: 1767254400,
//   ...
// }]
```

---

## Step 3: Bob Matches the Swap (Chain B: Litecoin)

Bob creates a matching SWAP on Litecoin with the mirrored token pair. The hub federation matches it to Alice's open offer automatically.

```js
// Bob matches Alice's swap
const matchAction = bobSdk.swap({
  giveCoin: 'LTC',
  giveTick: 'LTCTOKEN',
  giveAmount: '1000',
  getCoin: 'BTC',
  getTick: 'RAREPEPE',
  getAmount: '1',
  getAddress: 'bc1qbobsbtcaddress...',  // Bob's BTC address to receive RAREPEPE
  // No expiration needed: matching is immediate
});

const matchPsbt = await bobSdk.encoder.createTx({
  data: matchAction.actionString,
  pubkey: 'BOB_LTC_PUBLIC_KEY',
  utxos: bobLtcUtxos,
});

const matchTxid = await signAndBroadcast(matchPsbt.psbt);
await mineLtcBlock();
```

Bob's `LTCTOKEN` is now escrowed on Litecoin.

---

## Step 4: Settlement

The hub detects that both sides of the swap are in their respective confirmed blocks. It signals both indexers to settle:

- The Bitcoin indexer credits `bc1qbobsbtcaddress...` with 1 `RAREPEPE`.
- The Litecoin indexer credits `ltc1qalicesltcaddress...` with 1000 `LTCTOKEN`.

Both escrows are released and the swap closes automatically. No further action is required from either party.

```js
// Verify Alice received LTCTOKEN on LTC. getBalances() takes the address as a
// positional argument, not an options object.
const aliceLtcBalances = await bobSdk.explorer.getBalances('ltc1qalicesltcaddress...');
console.log('Alice LTC balances:', aliceLtcBalances);

// Verify Bob received RAREPEPE on BTC
const bobBtcBalances = await aliceSdk.explorer.getBalances('bc1qbobsbtcaddress...');
console.log('Bob BTC balances:', bobBtcBalances);
```

---

## Step 5: Cancelling or Editing a Swap

If no match arrives, Alice can cancel to recover her escrowed tokens:

```js
const cancelAction = aliceSdk.swap({
  version: 1,
  swapActionIndex: swapActionIndex,
  memo: 'No takers, cancelling',
});

const cancelPsbt = await aliceSdk.encoder.createTx({
  data: cancelAction.actionString,
  pubkey: 'ALICE_BTC_PUBLIC_KEY',
  utxos: aliceBtcUtxos,
});
await signAndBroadcast(cancelPsbt.psbt);
await mineBlock();
```

To extend the swap window:

```js
const editAction = await aliceSdk.swap({
  version: 2,
  swapActionIndex: swapActionIndex,
  expiration: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 more days
});

const editPsbt = await aliceSdk.encoder.createTx({
  data: editAction.actionString,
  pubkey: 'ALICE_BTC_PUBLIC_KEY',
  utxos: aliceBtcUtxos,
});
await signAndBroadcast(editPsbt.psbt);
await mineBlock();
```

---

## Rules and Constraints

- SWAP does not move native coin; only XChain tokens.
- `GET_ADDRESS` must be a valid address on `GET_COIN`'s network. If `GET_COIN` is the same network as the swap transaction, `GET_ADDRESS` can be omitted and the `SOURCE` address is used.
- Swap expiration is a Unix timestamp, not a block height.
- An `ALLOW_LIST` or `BLOCK_LIST` can restrict which counterparties can match your swap.
- The hub must be running and connected to both chains for cross-chain coordination to work.

---

## Same-Chain Swap

If both tokens are on the same chain, an ORDER is simpler and does not require hub coordination. See [Integration_Patterns.md](Integration_Patterns.md) for DEX patterns.

---

## Next Steps

- [Query_The_Explorer.md](Query_The_Explorer.md): discover and monitor open swaps
- [Integration_Patterns.md](Integration_Patterns.md): building a DEX frontend
- [Advanced_Token_Features.md](Advanced_Token_Features.md): allow/block lists for swaps

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
