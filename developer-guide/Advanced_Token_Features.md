<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Advanced Token Features

This guide covers the full range of controls available when issuing and managing tokens: access lists, mint windows, lockable parameters, callbacks, sleep, sub-tokens, and ownership transfer.

For basic token creation, see [Build_Your_First_Token.md](Build_Your_First_Token.md).

---

## Allow Lists and Block Lists

Restrict which addresses may interact with your token by attaching an address LIST to it. The LIST must be created in a confirmed transaction before you reference its `ACTION_INDEX` in ISSUE.

### Creating an Address List

```js
const XChainSDK = require('xchain-sdk');
const sdk = new XChainSDK({ hubUrl: 'http://localhost:35500' });

// TYPE 2 = ADDRESS list
const listAction = sdk.list({
  type: 2,
  items: [
    'bc1qapprovedaddress1...',
    'bc1qapprovedaddress2...',
    'bc1qapprovedaddress3...',
  ],
});

const listPsbt = await sdk.encoder.createPSBT({
  action: listAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});
const listTxid = await signAndBroadcast(listPsbt.psbt);
await mineBlock();

const listActions = await sdk.explorer.getActions({ txid: listTxid });
const allowListIndex = listActions[0].action_index;
```

### Attaching the List to a Token

```js
const issueAction = sdk.issue({
  tick: 'MYTOKEN',
  maxSupply: '1000000',
  decimals: 8,
  allowList: allowListIndex,  // only these addresses can receive or send MYTOKEN
  // blockList: blockListIndex, // alternative: deny-list instead of allow-list
});
```

### Updating Lists After Issue

Use ISSUE v5 to change the allow/block list without affecting other token parameters:

```js
// Create a new, expanded list first
const newListAction = sdk.list({
  type: 2,
  items: ['bc1qnewaddress...'],
  // Extend an existing list by referencing it:
  // edit: 1,              // 1=ADD
  // listActionIndex: allowListIndex,
});
const newListPsbt = await sdk.encoder.createPSBT({ action: newListAction, ... });
const newListTxid = await signAndBroadcast(newListPsbt.psbt);
await mineBlock();
const newListActions = await sdk.explorer.getActions({ txid: newListTxid });
const newListIndex = newListActions[0].action_index;

// Update the token to point to the new list
const updateListAction = sdk.issue({
  version: 5,
  tick: 'MYTOKEN',
  allowList: newListIndex,
});
```

---

## Minting Windows

Control when public minting is allowed using `mintStartBlock` and `mintStopBlock`. These are block heights.

```js
// Allow minting between block 800000 and 810000 only
const issueAction = sdk.issue({
  tick: 'FAIRTOKEN',
  maxSupply: '21000000',
  maxMint: '100',       // anyone can mint up to 100 per MINT tx
  decimals: 0,
  mintStartBlock: '800000',
  mintStopBlock: '810000',
});
```

Update mint parameters at any time (while they are not locked) using ISSUE v2:

```js
const updateMintAction = sdk.issue({
  version: 2,
  tick: 'FAIRTOKEN',
  mintStartBlock: '820000',
  mintStopBlock: '830000',
  memo: 'Reopening mint window for second round',
});
```

---

## Per-Address Mint Limit

Prevent any single address from minting more than a set amount across all their MINT transactions:

```js
const issueAction = sdk.issue({
  tick: 'FAIRTOKEN',
  maxSupply: '1000000',
  maxMint: '1000',
  mintAddressMax: '1000',  // each address can mint at most 1000 total, ever
});
```

---

## Locking Parameters

Lock flags are permanent and irreversible. Once set to `'1'`, they cannot be unset.

| Lock flag | What it prevents |
|---|---|
| `lockMaxSupply` | Increasing `MAX_SUPPLY` |
| `lockMaxMint` | Changing `MAX_MINT` |
| `lockMint` | Any further MINT transactions |
| `lockMintSupply` | Using `MINT_SUPPLY` in future ISSUE calls |
| `lockDescription` | Changing the token description |
| `lockSleep` | Using the SLEEP action on this token |
| `lockCallback` | Using the CALLBACK action on this token |

```js
// Issue a fully immutable token
const issueAction = sdk.issue({
  tick: 'HARDCAP',
  maxSupply: '21000000',
  decimals: 8,
  mintSupply: '21000000',  // mint entire supply immediately
  lockMaxSupply: '1',
  lockMint: '1',
  lockMintSupply: '1',
  lockDescription: '1',
  lockSleep: '1',
  lockCallback: '1',
});
```

Apply locks after the fact with ISSUE v3 (you cannot unlock):

```js
const lockAction = sdk.issue({
  version: 3,
  tick: 'MYTOKEN',
  lockMaxSupply: '1',
  lockMaxMint: '1',
});
```

> `lockMaxSupply` cannot be set to `1` until the minimum token supply threshold exists.

---

## Callback Mechanism

CALLBACK lets the token owner recall all tokens from holders, optionally exchanging them for a different token.

### Configuring Callback at Issue Time

```js
const issueAction = sdk.issue({
  tick: 'REDEEMABLE',
  maxSupply: '10000',
  decimals: 0,
  callbackBlock: '900000',   // CALLBACK can only be triggered after this block
  callbackTick: 'XCHAIN',    // holders receive XCHAIN when recalled
  callbackAmount: '2',       // 2 XCHAIN per 1 REDEEMABLE returned
});
```

### Updating Callback Parameters

Use ISSUE v4 (only allowed while supply is not yet distributed):

```js
const updateCallbackAction = sdk.issue({
  version: 4,
  tick: 'REDEEMABLE',
  callbackBlock: '950000',
  callbackTick: 'XCHAIN',
  callbackAmount: '3',
});
```

### Executing the Callback

After `callbackBlock` has passed, trigger it:

```js
const callbackAction = sdk.callback({ tick: 'REDEEMABLE' });

const psbt = await sdk.encoder.createPSBT({
  action: callbackAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});
await signAndBroadcast(psbt.psbt);
await mineBlock();
```

All holder balances of `REDEEMABLE` are zeroed. Each holder receives 3 `XCHAIN` per unit returned (respecting `XCHAIN`'s own allow/block lists). CALLBACK charges an XCHAIN gas fee proportional to the number of holders.

---

## Sleep and Resume

Pause all trading activity on a token until a future block height. Useful for scheduled maintenance or emergency halts.

```js
// Pause MYTOKEN until block 810000
const sleepAction = sdk.sleep({
  version: 1,          // version 1 = sleep a TICK; version 0 = sleep an address
  tick: 'MYTOKEN',
  resumeBlock: '810000',
});

const psbt = await sdk.encoder.createPSBT({
  action: sleepAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});
await signAndBroadcast(psbt.psbt);
```

Resume immediately:

```js
const wakeAction = sdk.sleep({ version: 1, tick: 'MYTOKEN', resumeBlock: '0' });
```

Pause indefinitely (until owner sends another SLEEP to wake):

```js
const pauseForever = sdk.sleep({ version: 1, tick: 'MYTOKEN', resumeBlock: '-1' });
```

Note: SLEEP does not prevent DISPENSER dispenses, ORDER matches, or SWAP matches, as interrupting those could cost users funds.

Use BATCH to pause, make changes, and re-pause atomically:

```js
const batchAction = sdk.batch()
  .sleep({ version: 1, tick: 'MYTOKEN', resumeBlock: '0' })     // wake first
  .issue({ version: 1, tick: 'MYTOKEN', description: 'https://example.com/new-icon.png' })
  .sleep({ version: 1, tick: 'MYTOKEN', resumeBlock: '-1' })    // pause again
  .build();
```

---

## Sub-Tokens

XChain supports hierarchical token namespaces via the `.` separator. A sub-token's ticker contains a period, creating a parent-child relationship.

```js
// First, own MYPROJECT
const parentIssue = sdk.issue({ tick: 'MYPROJECT', maxSupply: '1' });

// Then issue sub-tokens
const subIssue = sdk.issue({
  tick: 'MYPROJECT.GOLD',   // sub-token of MYPROJECT
  maxSupply: '10000',
  decimals: 8,
});
```

Sub-token rules are governed by the parent token's owner. The period character `.` is reserved and cannot appear in a ticker except as the parent-child separator.

---

## Ownership Transfer

### Transfer Ownership Only

Use ISSUE v0 with the `transfer` field to move ownership to another address. The new owner can then make future ISSUE updates.

```js
const transferOwnershipAction = sdk.issue({
  tick: 'MYTOKEN',
  transfer: 'bc1qnewowneraddress...',
});
```

### Sweep All Balances and Ownerships

SWEEP moves everything from your address — all token balances, token ownerships, and optionally escrowed amounts — to a destination address in one transaction:

```js
const sweepAction = sdk.sweep({
  destination: 'bc1qnewaddress...',
  balances: '1',    // transfer all token balances
  ownerships: '1',  // transfer all token ownerships
  escrows: '1',     // transfer escrowed tokens (e.g., dispenser escrows) after delay
});

const psbt = await sdk.encoder.createPSBT({
  action: sweepAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});
await signAndBroadcast(psbt.psbt);
```

Escrowed tokens from dispensers are released to the destination address after a set delay following SWEEP.

---

## Next Steps

- [Batch_Operations.md](Batch_Operations.md) — combine advanced operations atomically
- [Build_A_Dispenser.md](Build_A_Dispenser.md) — sell tokens with access control
- [Integration_Patterns.md](Integration_Patterns.md) — building on top of these features

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
