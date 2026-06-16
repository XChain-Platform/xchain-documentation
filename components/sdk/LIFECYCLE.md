<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK: Transaction Lifecycle

The SDK provides a Transaction Lifecycle Manager that handles the complete flow of submitting an XChain action to the blockchain (from creation through to indexer confirmation) in a single call.

---

## The Problem

Without the lifecycle manager, submitting an action requires multiple manual steps:

1. Create the action string (`sdk.createAction()`)
2. Encode it into a PSBT (`encoder.createTx()`)
3. Sign the PSBT (`wallet.signPsbt()`)
4. Broadcast the transaction (`encoder.broadcastTx()`)
5. If P2SH/P2WSH encoding: execute phase 2 (`encoder.spendP2sh()` → sign → broadcast)
6. Wait for the indexer to process the transaction (poll `explorer.getTransaction()`)

The lifecycle manager wraps all of this into `sdk.submitAction()`.

---

## submitAction

```js
const result = await sdk.submitAction(
    { action: 'SEND', params: { tick: 'MYTOKEN', amount: '100', destination: 'bc1q...' } },
    { pubkey: '02abc123...' },
    { wif: 'your-wif-key' }
);

console.log(result.txid);         // final transaction hash
console.log(result.actionString); // 'SEND|0|MYTOKEN|100|bc1q...'
console.log(result.encoding);    // 'OP_RETURN'
console.log(result.indexed);     // action data from the indexer
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `actionData` | `{ action, params }` | Action name and parameters (same shape as `createAction`, without `encoder`) |
| `encoderOpts` | `object` | Encoder options: `pubkey` (required), `change`, `utxos`, `encoding`, `fee`, `feePerKb`, etc. |
| `opts` | `object` | Lifecycle options (see below) |

### Lifecycle Options (`opts`)

| Option | Type | Default | Description |
|---|---|---|---|
| `wif` | `string` | *(required)* | WIF private key for signing |
| `waitForIndexer` | `boolean` | `true` | Wait for the indexer to process the transaction |
| `timeout` | `number` | `120000` | Milliseconds to wait for indexer confirmation |
| `pollInterval` | `number` | `2000` | Milliseconds between explorer poll attempts |
| `requireValid` | `boolean` | `true` | Reject if the indexed action has status `'invalid'` |
| `onProgress` | `function` | None | Callback for lifecycle step notifications |

### Return Value

```js
{
    txid:         'abc123...',       // final transaction hash (phase 2 for P2SH)
    actionString: 'SEND|0|...',     // serialized ACTION string
    action:       'SEND',           // ACTION name
    version:      0,                // protocol version used
    encoding:     'OP_RETURN',      // encoding type used
    signed:       { txHex, txid, psbtHex },  // signed transaction details
    spentInputs:  [{ txid, vout }], // UTXOs consumed
    indexed:      { ... }           // action data from indexer (null if waitForIndexer=false)
}
```

### Progress Callback

Track lifecycle steps in real-time:

```js
await sdk.submitAction(actionData, encoderOpts, {
    wif: myWIF,
    onProgress: (step, data) => {
        console.log(`Step: ${step}`, data);
    }
});
```

Steps emitted: `creating`, `encoding`, `signing`, `broadcasting`, `p2sh_spending` (if P2SH), `waiting`, `confirmed`.

### P2SH Two-Phase Handling

When the encoder selects P2SH or P2WSH encoding (for large action strings), `submitAction` automatically handles the two-transaction pattern:

1. Phase 1: broadcast the funding transaction
2. Phase 2: call `spendP2sh()`, sign, and broadcast the spend transaction
3. The returned `txid` is the phase 2 transaction (which the indexer looks for)

No special handling is needed by the caller.

---

## Fee Estimation

Estimate fees before committing to a transaction:

```js
const estimate = await sdk.estimateFees(
    { action: 'SEND', params: { tick: 'MYTOKEN', amount: '100', destination: 'bc1q...' } },
    { pubkey: '02abc123...' }
);

console.log(estimate.fee);          // fee in satoshis
console.log(estimate.encoding);     // encoding type that would be used
console.log(estimate.inputTotal);   // total input value
console.log(estimate.outputTotal);  // total output value
```

The returned `psbt` can be signed directly to avoid a second encode call:

```js
const estimate = await sdk.estimateFees(actionData, encoderOpts);
if (estimate.fee < maxAcceptableFee) {
    const signed = sdk.signPsbt(estimate.psbt, wif);
    await sdk.broadcastTx(signed.txHex);
}
```

---

## waitForAction

Wait for a specific transaction to be indexed, independently of `submitAction`:

```js
// Wait for a transaction by hash
const action = await sdk.waitForAction('abc123...txhash', {
    timeout: 60000,
    pollInterval: 1000
});
console.log(action.action_index);

// Wait for a specific action_index
const action = await sdk.waitForActionIndex(12345);
```

Uses WebSocket events when the WebSocket client is connected, with polling fallback. Both strategies run simultaneously, whichever resolves first wins.

---

## Related Documentation

- [Wallet Sessions](SESSIONS.md): bound wallet sessions that use `submitAction` internally
- [Workflows](WORKFLOWS.md): multi-step recipes built on the lifecycle manager
- [Encoder](ENCODER.md): encoding types, options, P2SH two-phase details
- [Errors](ERRORS.md): `SDKActionError` for lifecycle failures

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
