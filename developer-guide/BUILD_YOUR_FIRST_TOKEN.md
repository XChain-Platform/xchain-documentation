<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Build Your First Token

This tutorial walks you through creating a token on XChain from scratch, using a local regtest environment. By the end you will have issued a token, minted supply, sent tokens to another address, and verified the result through the explorer.

For environment setup, see [REGTEST_DEVELOPMENT.md](REGTEST_DEVELOPMENT.md).

---

## Prerequisites

- Local regtest stack running (`node xchain-node install --regtest`)
- Node.js installed
- `xchain-sdk` installed in your project

```bash
npm install xchain-sdk
```

---

## Step 1: Connect the SDK

Point the SDK at your local regtest hub. The hub handles config discovery for all other services automatically.

```js
const XChainSDK = require('xchain-sdk');

const sdk = new XChainSDK({
  hubUrl: 'http://localhost:35500',
});
```

If you prefer to skip hub discovery and talk directly to each service:

```js
const sdk = new XChainSDK({
  encoderUrl: 'http://localhost:35400',
  explorerUrl: 'http://localhost:35300',
});
```

You will also need a funded address and its public key. Fund a test address via the regtest miner:

```js
// Fund your test address with 1 BTC
const response = await fetch('http://localhost:38332', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'send_funds',
    params: { address: 'YOUR_ADDRESS', amount: 1.0 },
  }),
});
```

---

## Step 2: (Optional) Create an Allow List

You can restrict who can interact with your token by creating an address LIST first. The ACTION_INDEX of that list is then passed to ISSUE. Skip this step if you want an open token.

```js
// Build the LIST action string
const listAction = sdk.list({
  type: 2, // 2 = ADDRESS list
  items: [
    'bc1qallowedaddress1...',
    'bc1qallowedaddress2...',
  ],
});
// Returns: "LIST|0|2|bc1qallowedaddress1...|bc1qallowedaddress2..."

// Encode to PSBT
const listPsbt = await sdk.encoder.createPSBT({
  action: listAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});

// Sign and broadcast (using your wallet/signing library)
const listTxid = await signAndBroadcast(listPsbt.psbt);
console.log('LIST txid:', listTxid);

// Mine the transaction in regtest
await fetch('http://localhost:38332', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ method: 'continue_mining', params: {} }),
});

// Look up the ACTION_INDEX of the confirmed LIST
// The ACTION_INDEX is assigned by the indexer after confirmation
const listActions = await sdk.explorer.getActions({ txid: listTxid });
const listActionIndex = listActions[0].action_index;
console.log('LIST action_index:', listActionIndex);
```

---

## Step 3: Issue the Token

The ISSUE action creates a new token. Every field beyond `tick` is optional — omit what you don't need.

```js
const issueAction = sdk.issue({
  tick: 'MYTOKEN',        // ticker name, 1-250 chars, alphanumeric + special chars
  maxSupply: '1000000',   // maximum tokens that can ever exist
  maxMint: '1000',        // max a single MINT can add (enables fair minting by anyone)
  decimals: 8,            // decimal places (0-18, cannot change after supply exists)
  description: 'https://example.com/mytoken-icon.png', // URL to 48x48 icon or JSON metadata
  mintSupply: '10000',    // mint this amount immediately to yourself
  // allowList: listActionIndex,  // uncomment if you created a list in Step 2
  // lockMaxSupply: '1',          // set to '1' to permanently cap total supply
});
// Returns: "ISSUE|0|MYTOKEN|1000000|1000|8|https://example.com/mytoken-icon.png|10000|..."
```

**Parameter notes:**
- `maxSupply` — the hard ceiling. Once set and locked, can never increase.
- `maxMint` — controls each MINT call's cap. If omitted, only the token owner can mint.
- `decimals` — cannot be changed after any supply exists. Choose carefully.
- `description` — up to 250 characters. No pipe `|` or semicolon `;` allowed. Typically a URL to an icon or JSON metadata file.
- `mintSupply` — instantly mints tokens to your address as part of the ISSUE transaction.

```js
// Encode the ISSUE action to a PSBT
const issuePsbt = await sdk.encoder.createPSBT({
  action: issueAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
  feeRate: 10, // sat/vbyte, optional
});
// Returns: { psbt: 'base64...', format: 'opreturn' }

console.log('PSBT format:', issuePsbt.format); // 'opreturn', 'p2sh', or 'p2wsh'
```

Behind the scenes, the encoder fetches your UTXOs from the UTXO tracker, builds a Bitcoin transaction with the ACTION data embedded (AES-128-CTR obfuscated, prefixed with `XCHN`), and returns a base64-encoded PSBT for you to sign.

---

## Step 4: Sign and Broadcast

Sign the PSBT with your private key using any Bitcoin library, then broadcast it.

```js
const { Psbt } = require('bitcoinjs-lib');

// Example with bitcoinjs-lib (adapt to your signing setup)
const psbt = Psbt.fromBase64(issuePsbt.psbt);
psbt.signAllInputs(yourKeyPair);
psbt.finalizeAllInputs();
const tx = psbt.extractTransaction();
const rawTx = tx.toHex();

// Broadcast via your coin node
const txid = await broadcastTransaction(rawTx);
console.log('ISSUE txid:', txid);
```

Mine it in regtest so it confirms:

```js
await fetch('http://localhost:38332', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ method: 'continue_mining', params: {} }),
});
```

---

## Step 5: Confirm the Token Exists

Once the block is mined, the decoder picks up the transaction and the indexer processes it. Query the explorer to verify:

```js
// Poll until the token appears (usually a few seconds on regtest)
async function waitForToken(tick, retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const token = await sdk.explorer.getToken({ tick });
      return token;
    } catch (err) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Token not found after waiting');
}

const token = await waitForToken('MYTOKEN');
console.log('Token created:', token);
// {
//   tick: 'MYTOKEN',
//   max_supply: '1000000',
//   decimals: 8,
//   supply: '10000',
//   owner: 'YOUR_ADDRESS',
//   ...
// }
```

---

## Step 6: Mint Additional Supply

If your token has `maxMint` set (and supply has not reached `maxSupply`), anyone can call MINT. As the owner, you can mint up to `maxSupply` regardless of `maxMint`.

```js
const mintAction = sdk.mint({
  tick: 'MYTOKEN',
  amount: '5000',
  // destination: 'bc1qanotheraddress...',  // optional, defaults to your address
});
// Returns: "MINT|0|MYTOKEN|5000"

const mintPsbt = await sdk.encoder.createPSBT({
  action: mintAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});

const mintTxid = await signAndBroadcast(mintPsbt.psbt);
await mineBlock();

// Verify updated supply
const updatedToken = await sdk.explorer.getToken({ tick: 'MYTOKEN' });
console.log('New supply:', updatedToken.supply); // '15000'
```

---

## Step 7: Send Tokens to Another Address

```js
const sendAction = sdk.send({
  tick: 'MYTOKEN',
  amount: '100',
  destination: 'bc1qrecipientaddress...',
  memo: 'First transfer',  // optional
});
// Returns: "SEND|0|MYTOKEN|100|bc1qrecipientaddress...|First transfer"

const sendPsbt = await sdk.encoder.createPSBT({
  action: sendAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});

const sendTxid = await signAndBroadcast(sendPsbt.psbt);
await mineBlock();
```

To send to multiple addresses in a single transaction, use SEND v1 (same token) or v2 (different tokens):

```js
// v1: same token to multiple addresses
const multiSend = sdk.send({
  version: 1,
  tick: 'MYTOKEN',
  recipients: [
    { amount: '50', destination: 'bc1qaddress1...' },
    { amount: '25', destination: 'bc1qaddress2...' },
  ],
});
```

---

## Step 8: Query Balances and History

```js
// Check your own balance
const myBalances = await sdk.explorer.getBalances({ address: 'YOUR_ADDRESS' });
console.log('My balances:', myBalances);
// [{ tick: 'MYTOKEN', amount: '14900', ... }, ...]

// Check recipient balance
const recipientBalances = await sdk.explorer.getBalances({
  address: 'bc1qrecipientaddress...',
});
console.log('Recipient balance:', recipientBalances);

// Full transaction history for your address
const history = await sdk.explorer.getHistory({
  address: 'YOUR_ADDRESS',
  page: 1,
  limit: 25,
});
console.log('History:', history);

// All token holders
const holders = await sdk.explorer.getHolders({ tick: 'MYTOKEN' });
console.log('Holders:', holders);
```

---

## What Happened Under the Hood

Each action you broadcast went through this pipeline:

1. **Encoder** — built a Bitcoin transaction embedding `XCHN`-prefixed, AES-128-CTR obfuscated ACTION data in an `OP_RETURN` output (or P2SH/P2WSH for larger payloads).
2. **Coin node** — accepted the transaction into its mempool; regtest-miner mined the block.
3. **Decoder** — polled the coin node via JSON-RPC, decoded the XChain payload, and wrote raw action records to its MariaDB.
4. **Indexer** — read the decoder DB, applied business logic (supply math, balance updates, ownership tracking), and wrote final state to the indexer MariaDB.
5. **Explorer** — exposed the indexer DB via REST API; the SDK's `explorer.*` calls hit these endpoints.

---

## Next Steps

- [BUILD_A_DISPENSER.md](BUILD_A_DISPENSER.md) — sell tokens automatically
- [ADVANCED_TOKEN_FEATURES.md](ADVANCED_TOKEN_FEATURES.md) — allow lists, mint windows, callbacks
- [BATCH_OPERATIONS.md](BATCH_OPERATIONS.md) — combine multiple actions in one transaction

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
