<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Batch Operations

BATCH lets you execute multiple XChain actions in a single blockchain transaction. All commands share one miner fee, one signature and one confirmation.

Two things to know before you build one:

- **Commands are not all-or-nothing.** Each command is checked and settled on its own, in order. If the fourth command fails, the first three still happened and the fifth is still attempted. You get one status per command, not one status for the batch.
- **You pay for every command, not for one.** Protocol fees add up across the batch. A batch of ten fee-bearing actions needs ten actions' worth of fee, not one.

A small number of problems do reject the whole batch before anything runs (see [What rejects the whole batch](#what-rejects-the-whole-batch)), but an ordinary validation failure in one command is not one of them.

---

## How BATCH Works

Internally, BATCH concatenates multiple action strings with semicolons:

```
BATCH|0|ISSUE|0|MYTOKEN|1000000|1000|8;MINT|0|MYTOKEN|5000
```

The indexer runs the commands in order. Each one gets its own action index, sees the state the commands before it left behind, and records its own valid or invalid result.

---

## The Batch Builder

Use the SDK's fluent batch builder to compose actions:

```js
const XChainSDK = require('@dankest-llc/xchain-sdk');
const sdk = new XChainSDK({ hubUrl: 'http://localhost:10000' });

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

## Common Pattern: A Parent Token and All of Its Children

A child token is one whose ticker contains a dot: `JDOG.1`, `JDOG.GOLD`, `JDOG.SEASON2`. Only the owner of `JDOG` can create them.

A batch may contain **one** ordinary (undotted) ISSUE, plus **as many child ISSUEs as you like**. So a collection that would otherwise be one transaction per child is one transaction for the whole set, and the parent can be created in the same transaction as its children:

```js
const builder = sdk.batch()
  .issue({ tick: 'JDOG', maxSupply: '1000000', maxMint: '1000', decimals: 8 });

for (let i = 1; i <= 50; i++) {
  builder.issue({ tick: `JDOG.${i}`, maxSupply: '1', decimals: 0, mintSupply: '1' });
}

const action = builder.build();   // 51 issuances, one transaction
```

What it costs you: **each child is charged its own issuance fee**, exactly as if you had sent it on its own. Batching saves you 50 miner fees and 50 confirmations, not 50 issuance fees. Fund the sending address for the whole set before you broadcast. If it runs out partway through, the children it could pay for are created and the rest are recorded invalid, so you can top up and send the remainder in a second batch.

Two limits to plan around:

- A batch holds at most **250 commands**, so a set of 500 children is two batches. The count includes the parent and any other commands in the same batch.
- The `^<id>` shorthand for a ticker is **not** a child ticker. Its dot is part of an id reference, so `^614.5` is rejected rather than treated as a child of anything. Write child tickers out in full.

You can also issue against the same child ticker more than once in one batch, which lets you create it, mint into it, lock it and hand it over as a single sequence.

*These rules are live on testnet and regtest today. On mainnet they are not yet switched on; until they are, mainnet allows one ISSUE per batch whether or not its ticker has a dot.*

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

Wake a token, update it, then re-pause it, in one transaction:

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
| Max one top-level ISSUE per batch | One undotted ticker can be created or updated per batch |
| Child ISSUEs are unlimited | An ISSUE whose ticker contains a dot (`JDOG.1`) does not use the top-level slot |
| Max 250 commands per batch | Counted over the whole semicolon-separated list, empty entries included, so a trailing `;` costs a slot |
| Max one MINT per batch | Only one MINT action allowed |
| No nested BATCH | BATCH cannot contain another BATCH |
| Max one FILE per batch | A BATCH can include at most one FILE action (one raw data payload per transaction) |
| No DEPLOY | The DEPLOY action is not permitted inside a BATCH by the SDK builder |
| Fees add up | Every command pays its own protocol fee; one command's worth of fee funds one command |

```js
// This would fail: two MINTs in one batch
const invalid = sdk.batch()
  .mint({ tick: 'TOKEN_A', amount: '100' })
  .mint({ tick: 'TOKEN_B', amount: '200' }) // second MINT -- batch will be invalid
  .build();
```

### What rejects the whole batch

Most failures affect one command. These reject the batch as a single record, before any command runs:

- an unknown BATCH format version
- a command naming an action the protocol does not recognize, which includes an empty command from a stray `;`
- more than one MINT, or more than one top-level ISSUE
- a nested BATCH
- more than 250 commands
- a sending address that is asleep
- a sending address that provably cannot afford even the cheapest command in the list

That last one is a lower bound, not a budget check. Fees are charged in list order against one running balance, so an address that can pay for some of the commands is let through and lands the ones it can pay for.

---

## Error Handling

A batch reports one result per command, so check them individually rather than reading a single verdict for the transaction. Validate your inputs before broadcasting:

```js
async function safeBroadcast(action) {
  // Pre-flight: check token exists and you have enough balance
  try {
    const token = await sdk.explorer.getToken('MYTOKEN');
    if (!token) throw new Error('Token does not exist');

    const balances = await sdk.explorer.getBalances('YOUR_ADDRESS');
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

Each action in a batch adds bytes to the embedded payload. OP_RETURN is limited to 80 bytes per output (76 bytes of user data plus the 4-byte XCHN prefix), so larger batches are automatically encoded as P2SH or P2WSH (two-transaction pattern). The encoder handles this transparently, check `psbt.format` in the response to see which encoding was used.

```js
const psbt = await sdk.encoder.createPSBT({ action: batchAction, ... });
console.log('Encoding format:', psbt.format);
// 'opreturn' | 'p2sh' | 'p2wsh'
```

P2SH and P2WSH require a second transaction to spend the script and reveal the data. The encoder returns both transactions if needed.

---

## Next Steps

- [Advanced_Token_Features.md](advanced-token-features.md): SLEEP patterns that rely on BATCH
- [Build_Your_First_Token.md](build-your-first-token.md): foundation for batch operations
- [Integration_Patterns.md](integration-patterns.md): airdrop and multi-send patterns

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
