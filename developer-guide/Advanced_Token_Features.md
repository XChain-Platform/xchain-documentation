<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

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

const listActions = await sdk.explorer.getTransaction(listTxid, 'tx_hash');
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
const newListActions = await sdk.explorer.getTransaction(newListTxid, 'tx_hash');
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

A token has two separable things attached to it: the **balances** (who holds how many tokens) and the **ownership** (who can update the token's settings: minting windows, allow lists, lockable parameters, etc.). The two can be moved independently.

### Gift-Transfer Ownership

Use ISSUE v0 with the `transfer` field to move ownership to another address for free. The new owner can then make future ISSUE updates.

```js
const transferOwnershipAction = sdk.issue({
  tick: 'MYTOKEN',
  transfer: 'bc1qnewowneraddress...',
});
```

### Sell Ownership on the DEX

To *sell* ownership instead of gifting it, place an ORDER, SWAP, or DISPENSER with the `giveOwnership` flag set. The trade transfers the issuer role atomically with the payment. No off-chain trust is required.

**ORDER, list the ownership for sale at a fixed price:**

```js
const orderAction = sdk.order({
  giveCoin:      'BTC',
  giveTick:      'MYTOKEN',
  giveOwnership: '1',          // selling ownership, not balances
  // giveAmount must be empty when giveOwnership=1
  getCoin:       'BTC',
  getAmount:     '50000000',   // 0.5 BTC payment
  expiration:    '1000',
});
```

A buyer fills the order with the matching `getOwnership: '1'` side, and the ownership role transfers atomically with the payment.

**SWAP, match two known parties for an ownership trade:**

```js
const swapAction = sdk.swap({
  giveCoin:      'BTC',
  giveTick:      'MYTOKEN',
  giveOwnership: '1',
  getCoin:       'BTC',
  getTick:       'PAYTOKEN',
  getAmount:     '100',
  getAddress:    'bc1qbuyeraddress...',
});
```

**DISPENSER, first buyer to pay the asking price takes ownership:**

```js
const dispenserAction = sdk.dispenser({
  giveCoin:      'BTC',
  giveTick:      'MYTOKEN',
  giveOwnership: '1',          // single-shot ownership dispenser
  getCoin:       'BTC',
  getAmount:     '50000000',
  // giveAmount and giveEscrow must be empty for ownership dispensers
});
```

Ownership dispensers are single-shot: once the ownership has been claimed, the dispenser closes automatically (there is only one issuer role per token).

### Sweep: Move Balances, Ownerships, or Escrows in Bulk

SWEEP moves everything from your address to a destination in one transaction. The three categories are independent flags: you can sweep balances only, ownerships only, escrows only, or any combination.

```js
const sweepAction = sdk.sweep({
  destination: 'bc1qnewaddress...',
  balances:   '1',   // transfer all token balances
  ownerships: '1',   // transfer all token ownerships
  escrows:    '1',   // transfer escrowed tokens (e.g., dispenser escrows) after delay
});
```

Escrowed tokens from dispensers are released to the destination address after a set delay following SWEEP.

---

## Token-Gated Encrypted Files

Publish a file (or a whole pack of files) directly to the blockchain, encrypted such that only holders of a specific token can decrypt it. The decryption key is automatically re-encrypted to each new holder on every transfer, so a buyer of the token receives the unlock as part of the same transaction. No download server, no key escrow service, no off-chain infrastructure.

This composes three primitives: the FILE action (carries the encrypted bytes plus three new gating fields), the MESSAGE v2 action in ECIES mode (carries the encrypted key handoff), and the BATCH action (composes the two atomically). The SDK exposes a `gatedFile` helper for the encryption side.

### Publishing a Single Encrypted File

The issuer publishes the encrypted file and a self-MESSAGE that records the key (encrypted to the issuer's own address, so the issuer can retrieve it later to deliver to buyers on transfer).

```js
const XChainSDK = require('xchain-sdk');
const fs = require('fs');
const sdk = new XChainSDK({ hubUrl: 'http://localhost:35500' });

// 1. Encrypt the file plaintext under a fresh symmetric key
const plaintext = fs.readFileSync('./album.flac');
const { ciphertext, key, keyHash } = sdk.gatedFile.encryptFileBytes(plaintext);

// 2. Build the gated FILE action with the ciphertext as rawData
const fileAction = sdk.file({
  name:             'album.flac',
  type:             'audio/flac',
  title:            'Sealed Album',
  memo:             '',
  gateTicker:       'ALBUMTOKEN',   // only holders of ALBUMTOKEN can decrypt
  encryptionMethod: 1,              // 1 = AES-256-GCM
  keyHash:          keyHash,        // hex sha256(key)
  rawData:          ciphertext,
});

// 3. Self-MESSAGE: encrypt the key to your own address so you can recover it later.
//    Encode the key as the binary handoff payload before ECIES-encrypting it.
const handoffPayload = sdk.gatedFile.serializeKeyPayload([key]);

const selfMessageAction = sdk.message({
  coin:             'BTC',
  destination:      'bc1qyourissueraddress...',
  encryptionMethod: 1,                 // 1 = ECIES (MESSAGE v2)
  binary:           true,              // use binary mode (required for handoff payload)
  plaintext:        handoffPayload,
});

// 4. Bundle the two into one BATCH and broadcast atomically.
const batchAction = sdk.batch().file(fileAction).message(selfMessageAction).build();
const psbt = await sdk.encoder.createPSBT({
  action:    batchAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos:     yourUtxos,
});
await signAndBroadcast(psbt.psbt);
```

After confirmation, the file ciphertext lives on-chain forever, and the issuer can retrieve the symmetric key any time by decrypting their own self-MESSAGE.

### Publishing a Pack (Multiple Files, One Key)

A pack is two or more gated FILE actions that share the same `keyHash`. Owning the token decrypts every file in the pack with one key.

```js
const stems    = fs.readFileSync('./stems.zip');
const liner    = fs.readFileSync('./liner-notes.pdf');
const cover    = fs.readFileSync('./cover.png');

// One key, three ciphertexts
const { ciphertexts, key, keyHash } = sdk.gatedFile.encryptPack([stems, liner, cover]);

// Publish each file under the shared keyHash (order does not matter)
const fileActions = ciphertexts.map((ct, i) => sdk.file({
  name:             ['stems.zip', 'liner-notes.pdf', 'cover.png'][i],
  type:             ['application/zip', 'application/pdf', 'image/png'][i],
  title:            'Sealed Pack',
  memo:             '',
  gateTicker:       'ALBUMTOKEN',
  encryptionMethod: 1,
  keyHash:          keyHash,        // same hash for every file in the pack
  rawData:          ct,
}));

// Self-MESSAGE records the single shared key
const handoffPayload = sdk.gatedFile.serializeKeyPayload([key]);
const selfMessage = sdk.message({
  coin:             'BTC',
  destination:      'bc1qyourissueraddress...',
  encryptionMethod: 1,
  binary:           true,
  plaintext:        handoffPayload,
});

// Broadcast each FILE in its own transaction; the self-MESSAGE can ride with the last one.
// (Files are too large to fit many in one BATCH; broadcast one at a time.)
```

### Transferring a Gated Token

The protocol enforces a rule on SENDs of tokens with active gated content: every SEND must be paired with a MESSAGE v2 to the recipient carrying the key handoff. The wallet builds the BATCH; the indexer rejects the SEND if the matching MESSAGE is missing.

```js
const handoffPayload = sdk.gatedFile.serializeKeyPayload([key]);  // sender must already have key

const transferBatch = sdk.batch()
  .send({ coin: 'BTC', destination: 'bc1qbuyeraddress...', tick: 'ALBUMTOKEN', amount: '1' })
  .message({
    coin:             'BTC',
    destination:      'bc1qbuyeraddress...',
    encryptionMethod: 1,
    binary:           true,
    plaintext:        handoffPayload,
  })
  .build();
```

The wallet must already hold the unlocked key; a wallet that has never decrypted the content has nothing to re-encrypt to the new holder. Wallets should block compose at the UI level for tokens they haven't unlocked yet, rather than producing an indexer-rejected transaction.

### Holder-Side Unlock

Unlocking is entirely client-side. No on-chain transaction is required.

```js
const messages = await sdk.explorer.getMessages('bc1qmyaddress...', 'destination');
const keyBytes = [];
for (const msg of messages) {
  try {
    const plaintext = sdk.messaging.eciesDecryptBytes(msg.encrypted_message, myPrivateKey);
    keyBytes.push(...sdk.gatedFile.parseKeyPayload(plaintext));   // returns array of 32-byte keys
  } catch { /* not for me; skip */ }
}

// For each gated FILE the holder cares about, find the matching key by hashing each candidate.
const file = await sdk.explorer.getAction(fileActionIndex);
for (const k of keyBytes) {
  if (sdk.gatedFile.verifyKey(k, file.key_hash)) {
    const ciphertext = await sdk.explorer.getGatedFileRaw(fileActionIndex);
    const plaintext  = sdk.gatedFile.decryptFileBytes(ciphertext, k);
    // ... use the decrypted bytes
    break;
  }
}
```

### Selling a Gated Token

The most common gated-content flow is also the most powerful one: list the gating token on a dispenser or in an order. The buyer sends payment; the platform's transfer rule guarantees they receive the decryption key in the same transaction.

```js
// Sell ALBUMTOKEN for 0.01 BTC; first buyer gets the album
const dispenserAction = sdk.dispenser({
  giveCoin:    'BTC',
  giveTick:    'ALBUMTOKEN',
  giveAmount:  '1',
  giveEscrow:  '100',          // max 100 sales from this dispenser
  getCoin:     'BTC',
  getAmount:   '1000000',      // 0.01 BTC
});
```

If you want to sell the **entire content archive** (keys, future republish rights, everything), pair this with [Sell Ownership on the DEX](#sell-ownership-on-the-dex) above.

### Notes and Constraints

- **Issuer-only publishing.** A gated FILE must be broadcast from the same address that issued the gating token. Third parties cannot gate arbitrary content to popular tickers as spam.
- **First-access lock, not DRM.** A holder who decrypts has the bytes forever and can rehost them. The chain reflects who *currently* holds the token, not who has ever read the content.
- **No key rotation.** If a key leaks, the only recourse is to republish under a new key. Old ciphertexts remain on-chain but become useless.
- **Loss of address = loss of access.** Same custody model as the token itself.

For the protocol-level spec (wire format, handoff payload layout, indexer validation rules), see [`protocol/Token_Gated_Content.md`](../protocol/Token_Gated_Content.md).

---

## Next Steps

- [Batch_Operations.md](Batch_Operations.md): combine advanced operations atomically
- [Build_A_Dispenser.md](Build_A_Dispenser.md): sell tokens with access control
- [Integration_Patterns.md](Integration_Patterns.md): building on top of these features

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
