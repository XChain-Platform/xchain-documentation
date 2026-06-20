<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK: Batch Builder

The BatchBuilder is a fluent API for composing multiple XChain actions into a single BATCH transaction. It validates each sub-action individually, enforces the BATCH protocol constraints, and produces a ready-to-encode result.

---

## Overview

A BATCH transaction lets you include multiple independent XChain actions in one on-chain transaction. Each sub-action is fully validated and serialized, then the results are joined with `;` separators and wrapped in the BATCH action format. From the protocol's perspective, a BATCH is just an action whose `COMMAND` field is a semicolon-delimited string of fully-formed action strings.

The BatchBuilder handles all of this automatically:

- Validates each sub-action through the full pipeline (field validation + format selection + serialization)
- Enforces BATCH protocol constraints before building
- Returns the same `ActionResult` shape as `sdk.createAction()`

---

## Quick Start

```js
let result = await sdk.batch()
    .send({ tick: 'BTC.TOKEN', amount: 100, destination: 'addr1...' })
    .send({ tick: 'BTC.TOKEN', amount: 50,  destination: 'addr2...' })
    .build();

console.log(result.actionString);
// BATCH|0|SEND|0|BTC.TOKEN|100|addr1...;SEND|0|BTC.TOKEN|50|addr2...
```

---

## API Reference

### `sdk.batch()`

Returns a new `BatchBuilder` instance bound to the current SDK instance.

```js
let builder = sdk.batch();
```

---

### `.add(action, params)`

Add any action by name. `action` is case-insensitive. Returns the builder for chaining.

```js
builder.add('SEND', { tick: 'BTC.TOKEN', amount: 10, destination: 'addr...' });
builder.add('MINT', { tick: 'BTC.TOKEN', amount: 1000 });
```

---

### Convenience Methods

The following convenience methods are shorthand for `.add(action, params)`. All return the builder for chaining. There are 21 convenience methods; `.batch()` and `.deploy()` are intentionally omitted because nested BATCH and DEPLOY actions are not permitted inside a BATCH (see Constraints below). FILE is permitted (at most one per BATCH), so `.file()` is included.

| Method | Equivalent |
|--------|-----------|
| `.send(params)` | `.add('SEND', params)` |
| `.issue(params)` | `.add('ISSUE', params)` |
| `.mint(params)` | `.add('MINT', params)` |
| `.destroy(params)` | `.add('DESTROY', params)` |
| `.order(params)` | `.add('ORDER', params)` |
| `.broadcast(params)` | `.add('BROADCAST', params)` |
| `.dispenser(params)` | `.add('DISPENSER', params)` |
| `.dividend(params)` | `.add('DIVIDEND', params)` |
| `.sweep(params)` | `.add('SWEEP', params)` |
| `.swap(params)` | `.add('SWAP', params)` |
| `.callback(params)` | `.add('CALLBACK', params)` |
| `.sleep(params)` | `.add('SLEEP', params)` |
| `.airdrop(params)` | `.add('AIRDROP', params)` |
| `.message(params)` | `.add('MESSAGE', params)` |
| `.list(params)` | `.add('LIST', params)` |
| `.link(params)` | `.add('LINK', params)` |
| `.address(params)` | `.add('ADDRESS', params)` |
| `.execute(params)` | `.add('EXECUTE', params)` |
| `.deposit(params)` | `.add('DEPOSIT', params)` |
| `.withdraw(params)` | `.add('WITHDRAW', params)` |
| `.file(params)` | `.add('FILE', params)` |

---

### `.build(encoderOpts?)`

Validates all constraints, builds each sub-action, and returns the complete BATCH `ActionResult`.

- Runs `_validate()` to enforce BATCH protocol constraints
- Calls `sdk.actions.createAction()` for each sub-action (full validate + format select + serialize pipeline)
- Joins all sub-action strings with `;`
- Calls `sdk.createAction({ action: 'BATCH', params: { command }, encoder: encoderOpts })` to produce the final result

If `encoderOpts` is provided (e.g. `{ pubkey: '...', utxos: [...] }`), the SDK will submit the BATCH to the encoder and return a PSBT. Without `encoderOpts`, the result contains only the serialized action string.

```js
// Serialize only
let result = await builder.build();

// Generate a PSBT via the encoder
let result = await builder.build({
    pubkey: '03abc...',
    utxos: [{ txid: '...', vout: 0, value: 100000 }]
});
```

---

### `.reset()`

Clears all queued actions and returns the builder for reuse. Does not affect the bound SDK instance.

```js
builder
    .send({ tick: 'BTC.TOKEN', amount: 10, destination: 'addr1...' })
    .build();

// Reuse the same builder
builder
    .reset()
    .mint({ tick: 'BTC.TOKEN', amount: 500 })
    .build();
```

---

### `.length`

Read-only property. Returns the number of actions currently queued in the builder.

```js
let builder = sdk.batch().send({...}).mint({...});
console.log(builder.length); // 2
```

---

## Constraints

The BATCH protocol enforces the following rules. Violations throw `SDKValidationError` with code `BATCH_CONSTRAINT` (or `BATCH_EMPTY`):

| Constraint | Error code | Notes |
|------------|------------|-------|
| At least one action required | `BATCH_EMPTY` | Calling `.build()` on an empty builder |
| No nested BATCH actions | `BATCH_CONSTRAINT` | BATCH inside BATCH is not allowed by the protocol |
| No DEPLOY actions | `BATCH_CONSTRAINT` | DEPLOY payloads are too large for BATCH |
| At most 1 FILE action | `BATCH_CONSTRAINT` | One rawData payload per transaction; `details.count` contains the actual count |
| At most 1 MINT action | `BATCH_CONSTRAINT` | `details.count` contains the actual count |
| At most 1 ISSUE action | `BATCH_CONSTRAINT` | `details.count` contains the actual count |

All sub-actions are also fully validated by the Validator before the BATCH is built. A bad field value in any sub-action will throw the corresponding `SDKValidationError` before `.build()` returns.

---

## Examples

### Multi-Send (send to two addresses)

```js
let result = await sdk.batch()
    .send({ tick: 'BTC.TOKEN', amount: 100, destination: 'addr1...' })
    .send({ tick: 'BTC.TOKEN', amount: 200, destination: 'addr2...' })
    .build();
```

### Issue + Mint in One Transaction

```js
let result = await sdk.batch()
    .issue({
        tick: 'MY.TOKEN',
        maxSupply: 1000000,
        decimals: 8
    })
    .mint({
        tick: 'MY.TOKEN',
        amount: 10000
    })
    .build();
```

### Error Handling: Constraint Violation

```js
const { SDKValidationError } = require('@xchain/sdk/src/errors');

try {
    await sdk.batch()
        .mint({ tick: 'BTC.TOKEN', amount: 100 })
        .mint({ tick: 'BTC.TOKEN', amount: 200 }) // second MINT (violates constraint)
        .build();

} catch (err) {
    if (err instanceof SDKValidationError && err.code === 'BATCH_CONSTRAINT') {
        console.error('Batch constraint violated:', err.message);
        // "BATCH can contain at most 1 MINT action"
        console.error('Actual count:', err.details.count); // 2
    }
}
```

### Builder Reuse with `reset()`

```js
let builder = sdk.batch();

// First batch
let result1 = await builder
    .send({ tick: 'BTC.TOKEN', amount: 50, destination: 'addr1...' })
    .build();

// Reset and reuse
let result2 = await builder
    .reset()
    .send({ tick: 'LTC.TOKEN', amount: 75, destination: 'addr2...' })
    .build();
```

### With Encoder Options (generate PSBT)

```js
let result = await sdk.batch()
    .send({ tick: 'BTC.TOKEN', amount: 100, destination: 'addr1...' })
    .destroy({ tick: 'BTC.TOKEN', amount: 10 })
    .build({
        pubkey: '03abcdef...',
        utxos: [
            { txid: 'aaabbb...', vout: 0, value: 546 },
            { txid: 'cccddd...', vout: 1, value: 100000 }
        ]
    });

console.log(result.psbt); // base64-encoded PSBT ready to sign
```

---

## Under the Hood

When `.build()` is called, the following steps happen in sequence:

1. `_validate()` checks BATCH protocol constraints (empty, nested BATCH, DEPLOY, FILE/MINT/ISSUE counts).
2. For each queued action, `sdk.actions.createAction({ action, params })` is called. This runs the full pipeline: field validation → format selection → serialization. The result's `actionString` is collected.
3. All `actionString` values are joined with `;`: `SEND|0|BTC.TOKEN|100|addr1...;SEND|0|BTC.TOKEN|50|addr2...`
4. The joined string is passed as the `command` param to `sdk.createAction({ action: 'BATCH', params: { command }, encoder: encoderOpts })`, which serializes the outer BATCH action: `BATCH|0|SEND|0|...;SEND|0|...`

The BATCH action itself uses format version 0 (`VERSION|COMMAND`), there is only one BATCH format.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
