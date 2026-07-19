<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Developer Quickstart

This guide walks you through creating your first XChain token using the SDK. You'll go from zero to an issued token on-chain in about 5 minutes.

## Prerequisites

- **Node.js** 22 (22.x LTS); Node 18 fails on the `mariadb` ESM package (`ERR_REQUIRE_ESM`); Node 24 cannot build `isolated-vm`. Node 22 is required.
- A running XChain platform (either local via [regtest](../developer-guide/Regtest_Development.md) or a public node)
- A Bitcoin/Litecoin/Dogecoin wallet with a funded address (for mainnet/testnet), or use regtest for free development

---

## Step 1: Install the SDK

```bash
npm install xchain-sdk
```

---

## Step 2: Initialize the SDK

The SDK connects to an XChain hub to discover all running services automatically.

```js
const XChainSDK = require('xchain-sdk');

const sdk = new XChainSDK({
  hubUrl: 'http://localhost:10000',  // xchain-hub address
});

// Initialize: fetches service endpoints from the hub
await sdk.init();
```

If you're not using a hub, you can provide service URLs directly:

```js
const sdk = new XChainSDK({
  explorerUrl: 'http://localhost:8080',
  encoderUrl:  'http://localhost:3003',
});
```

---

## Step 3: Create Your First Token

Use `sdk.issue()` to define a new token. This builds the ACTION string; it doesn't broadcast anything yet.

```js
const result = await sdk.issue({
  tick:        'MYTOKEN',      // Token ticker (up to 250 chars, no | ; . / chars)
  maxSupply:   '1000000',      // Maximum total supply
  decimals:    8,              // Decimal places (0–18)
  mintSupply:  '1000',         // How much each MINT action produces
  description: 'My first XChain token',
});

console.log(result.actionString);
// => "ISSUE|0|MYTOKEN|1000000|8|1000|My first XChain token"
```

The returned object contains:

| Field | Description |
|---|---|
| `action` | ACTION name (`ISSUE`) |
| `version` | Format version selected |
| `actionString` | The pipe-delimited ACTION string |
| `fields` | Parsed field map |
| `encoding` | Recommended encoding type (`OP_RETURN`, `P2SH`, etc.) |

---

## Step 4: Encode the ACTION into a Transaction

The ACTION string needs to be embedded in a blockchain transaction. The encoder service does this, and the SDK talks to it for you.

First, gather your UTXOs (the encoder client can fetch them from the UTXO tracker):

```js
const { utxos } = await sdk.encoder.getUTXOs('your-bitcoin-address');
```

Then create a PSBT (Partially Signed Bitcoin Transaction):

```js
const { psbt } = await sdk.encoder.createTx({
  data:   result.actionString,
  pubkey: 'your-compressed-public-key-hex',
  utxos:  utxos,
});

console.log(psbt);  // Hex-encoded PSBT ready for signing
```

---

## Step 5: Sign and Broadcast

The PSBT comes back unsigned. Sign it with your wallet software (any PSBT-compatible Bitcoin wallet works), then broadcast the signed transaction to the network.

```js
// Sign with your wallet (wallet-specific; this is a placeholder)
const signedPsbt = yourWallet.signPsbt(psbt);

// Broadcast the signed transaction
const txid = await yourWallet.broadcast(signedPsbt);
console.log('Transaction broadcast:', txid);
```

Once the transaction is confirmed in a block, the XChain decoder picks it up, the indexer processes it, and your token is live.

---

## Step 6: Verify Your Token

After confirmation (or instantly in regtest), query the explorer:

```js
// Get token details
const token = await sdk.explorer.getToken('MYTOKEN');
console.log(token);
// => { tick: 'MYTOKEN', maxSupply: '1000000', decimals: 8, ... }

// Get balances for an address
const balances = await sdk.explorer.getBalances('your-address');
console.log(balances);
// => [{ tick: 'MYTOKEN', amount: '0', ... }, ...]
```

---

## Step 7: Mint Some Supply

The ISSUE action defines the token. To actually put tokens in circulation, use MINT:

```js
const mintResult = await sdk.mint({
  tick: 'MYTOKEN',
  // mintSupply from the ISSUE action is used automatically
});

// Encode, sign, broadcast the PSBT the same way as above
const { utxos: mintUtxos } = await sdk.encoder.getUTXOs('your-address');
const { psbt } = await sdk.encoder.createTx({
  data:   mintResult.actionString,
  pubkey: 'your-compressed-public-key-hex',
  utxos:  mintUtxos,
});
```

Each MINT transaction adds `mintSupply` tokens to your address, up to `maxSupply`.

---

## Step 8: Send Tokens

Transfer tokens to another address:

```js
const sendResult = await sdk.send({
  tick:        'MYTOKEN',
  amount:      '100',
  destination: 'recipient-bitcoin-address',
  memo:        'Optional memo',  // optional
});

// Encode, sign, broadcast as before
const { utxos: sendUtxos } = await sdk.encoder.getUTXOs('your-address');
const { psbt } = await sdk.encoder.createTx({
  data:   sendResult.actionString,
  pubkey: 'your-compressed-public-key-hex',
  utxos:  sendUtxos,
});
```

---

## Batching Multiple Actions

The batch builder lets you combine multiple actions into a single transaction, saving on-chain fees:

```js
const batchResult = await sdk.batch()
  .mint({ tick: 'MYTOKEN' })
  .send({ tick: 'MYTOKEN', amount: '50', destination: 'recipient-address' })
  .build();

console.log(batchResult.actionString);
// => "BATCH|0|MINT|0|MYTOKEN;SEND|0|MYTOKEN|50|recipient-address"
```

---

## Explorer Queries

The SDK provides 100+ explorer query methods:

```js
// Token information
await sdk.explorer.getToken('MYTOKEN');
await sdk.explorer.getTokens('your-address', 'address', { limit: 20, page: 1 });

// Balances
await sdk.explorer.getBalances('your-address');
await sdk.explorer.getBalances('your-address', { tick: 'MYTOKEN' });

// Transaction history
await sdk.explorer.getSends('MYTOKEN', 'token', { limit: 10 });
await sdk.explorer.getHistory('your-address', 'address');

// DEX
await sdk.explorer.getOrders('MYTOKEN', 'token');
await sdk.explorer.getDispensers('MYTOKEN', 'token');
```

---

## Error Handling

The SDK throws typed errors you can catch by class:

```js
const { SDKValidationError, SDKEncoderError } = require('xchain-sdk');

try {
  const result = await sdk.issue({ tick: 'MYTOKEN', maxSupply: '1000000' });
} catch (err) {
  if (err instanceof SDKValidationError) {
    console.error('Bad input:', err.message);
  } else if (err instanceof SDKEncoderError) {
    console.error('Encoder problem:', err.message);
  } else {
    throw err;
  }
}
```

---

## Development Tips

### Use Regtest for Free Development

Regtest is a local blockchain mode where blocks are mined on demand, coins have no real value, and you can test the full stack without spending anything. It's the fastest way to iterate.

See [Regtest Development](../developer-guide/Regtest_Development.md) for setup instructions.

### The SDK Has Three Modes

| Mode | How | When to use |
|---|---|---|
| Node.js library | `require('xchain-sdk')` | Application code, scripts |
| JSON-RPC microservice | `npm run api` in xchain-sdk | Any language via HTTP |
| Browser bundle | `dist/xchain_sdk.min.js` | Client-side web apps |

### 30 of the 34 Actions Have Convenience Methods

The SDK covers the 30 developer-invocable actions with convenience methods: `sdk.issue()`, `sdk.mint()`, `sdk.send()`, `sdk.sweep()`, `sdk.airdrop()`, `sdk.dividend()`, `sdk.order()`, `sdk.coinpay()`, `sdk.dispenser()`, `sdk.swap()`, `sdk.broadcast()`, `sdk.message()`, `sdk.file()`, `sdk.address()`, `sdk.link()`, `sdk.list()`, `sdk.sleep()`, `sdk.callback()`, `sdk.destroy()`, `sdk.price()`, `sdk.stake()`, `sdk.unstake()`, `sdk.delegate()`, `sdk.collect()`, `sdk.deploy()`, `sdk.execute()`, `sdk.deposit()`, `sdk.withdraw()`, `sdk.vote()`. `sdk.transfer()` is an alias for `sdk.send()`. `sdk.batch()` returns a builder for composing BATCH actions. The 4 remaining actions (ANCHOR, ATTEST, NODEPROOF, SLASH) are validator or system-emitted and are not user-broadcast; see [concepts/ACTIONS.md](../concepts/ACTIONS.md) for the full taxonomy.

---

## Next Steps

- [Full SDK Documentation](../components/sdk/): all methods, configuration options, error types, and examples
- [ACTION Concepts](../concepts/ACTIONS.md): conceptual overview of the 34 actions and the ACTION format
- [ACTION Protocol Specs](../protocol/actions/): per-action field-level formats and validation rules for all 34 actions
- [Regtest Development](../developer-guide/Regtest_Development.md): run a full local stack for free
- [Explorer API](../components/explorer/): all 200+ REST and JSON-RPC endpoints

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
