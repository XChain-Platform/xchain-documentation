<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Batch Operations

BATCH lets you execute multiple XChain actions in a single blockchain transaction. All commands share one transaction fee and confirm in the same block. If any command in the batch fails validation, the entire batch is rejected.

---

## How BATCH Works

Internally, BATCH concatenates multiple action strings with semicolons:

```
BATCH|0|ISSUE|0|MYTOKEN|1000000|1000|8;MINT|0|MYTOKEN|5000
```

The indexer processes each command in order, within the same "atomic" context. All succeed together or all fail together.

---

## The Batch Builder

Use the SDK's fluent batch builder to compose actions:

```js
const XChainSDK = require('xchain-sdk');
const sdk = new XChainSDK({ hubUrl: 'http://localhost:35500' });

const batchAction = sdk.batch()
  .issue({ tick: 'MYTOKEN', maxSupply: '1000000', maxMint: '1000', decimals: 8 })
  .mint({ tick: 'MYTOKEN', amount: '5000' })
  .build();

console.log(batchAction);
// "BATCH|0|ISSUE|0|MYTOKEN|1000000|1000|8|||...;MINT|0|MYTOKEN|5000"
```

Encode and broadcast it the same way as any action:

```js
const psbt = await sdk.encoder.createPSBT({
  action: batchAction,
  publicKey: 'YOUR_PUBLIC_KEY_HEX',
  utxos: yourUtxos,
});

const txid = await signAndBroadcast(psbt.psbt);
await mineBlock();
```

---

## Common Pattern: Issue + Mint

Issue a token and immediately mint initial supply in one transaction:

```js
const action = sdk.batch()
  .issue({
    tick: 'NEWTOKEN',
    maxSupply: '21000000',
    maxMint: '100',
    decimals: 8,
    description: 'https://example.com/token.png',
  })
  .mint({ tick: 'NEWTOKEN', amount: '1000000' })
  .build();
```

---

## Common Pattern: Multi-Send to Different Tokens

Send two different tokens in one transaction using SEND v2, or use separate SEND commands in a batch:

```js
// Two separate sends, different tokens, one transaction
const action = sdk.batch()
  .send({ tick: 'TOKEN_A', amount: '100', destination: 'bc1qaddress1...' })
  .send({ tick: 'TOKEN_B', amount: '50', destination: 'bc1qaddress2...' })
  .build();
```

---

## Common Pattern: Admin Update Under Sleep

Wake a token, update it, then re-pause it — all atomic:

```js
const action = sdk.batch()
  .sleep({ version: 1, tick: 'MYTOKEN', resumeBlock: '0' })        // wake
  .issue({ version: 1, tick: 'MYTOKEN', description: 'https://example.com/new.png' })
  .sleep({ version: 1, tick: 'MYTOKEN', resumeBlock: '-1' })       // sleep again
  .build();
```

---

## Common Pattern: Issue + Lock

Issue a fully locked token with no further changes possible:

```js
const action = sdk.batch()
  .issue({
    tick: 'IMMUTABLE',
    maxSupply: '1000000',
    decimals: 0,
    mintSupply: '1000000',
  })
  .issue({
    version: 3,
    tick: 'IMMUTABLE',
    lockMaxSupply: '1',
    lockMint: '1',
    lockDescription: '1',
    lockSleep: '1',
    lockCallback: '1',
  })
  .build();
```

---

## Constraints

| Rule | Detail |
|---|---|
| Max one ISSUE per batch | Only one token can be created or updated per batch transaction |
| Max one MINT per batch | Only one MINT action allowed |
| No nested BATCH | BATCH cannot contain another BATCH |
| No FILE | The FILE action is not permitted inside a BATCH |
| All-or-nothing | If one action fails, the entire batch is invalid |

```js
// This would fail — two MINTs in one batch
const invalid = sdk.batch()
  .mint({ tick: 'TOKEN_A', amount: '100' })
  .mint({ tick: 'TOKEN_B', amount: '200' }) // second MINT -- batch will be invalid
  .build();
```

---

## Error Handling

Because batches are all-or-nothing, validate your inputs before broadcasting:

```js
async function safeBroadcast(action) {
  // Pre-flight: check token exists and you have enough balance
  try {
    const token = await sdk.explorer.getToken({ tick: 'MYTOKEN' });
    if (!token) throw new Error('Token does not exist');

    const balances = await sdk.explorer.getBalances({ address: 'YOUR_ADDRESS' });
    const myBalance = balances.find(b => b.tick === 'MYTOKEN');
    if (!myBalance || Number(myBalance.amount) < 100) {
      throw new Error('Insufficient balance for batch');
    }
  } catch (err) {
    console.error('Pre-flight check failed:', err.message);
    return null;
  }

  const psbt = await sdk.encoder.createPSBT({
    action,
    publicKey: 'YOUR_PUBLIC_KEY_HEX',
    utxos: yourUtxos,
  });
  return signAndBroadcast(psbt.psbt);
}
```

---

## Transaction Size Considerations

Each action in a batch adds bytes to the embedded payload. OP_RETURN is limited to 80 bytes per output (76 bytes of user data plus the 4-byte XCHN prefix), so larger batches are automatically encoded as P2SH or P2WSH (two-transaction pattern). The encoder handles this transparently — check `psbt.format` in the response to see which encoding was used.

```js
const psbt = await sdk.encoder.createPSBT({ action: batchAction, ... });
console.log('Encoding format:', psbt.format);
// 'opreturn' | 'p2sh' | 'p2wsh'
```

P2SH and P2WSH require a second transaction to spend the script and reveal the data. The encoder returns both transactions if needed.

---

## Next Steps

- [Advanced_Token_Features.md](Advanced_Token_Features.md) — SLEEP patterns that rely on BATCH
- [Build_Your_First_Token.md](Build_Your_First_Token.md) — foundation for batch operations
- [Integration_Patterns.md](Integration_Patterns.md) — airdrop and multi-send patterns

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
