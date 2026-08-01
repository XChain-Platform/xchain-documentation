<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK: Wallet Sessions

A Wallet Session binds a WIF private key to an SDK instance, creating a stateful object that tracks the session's address, public key, and UTXOs. This provides a natural "I am this address, do things" mental model.

---

## Creating a Session

```js
const session = sdk.session('your-wif-key');

console.log(session.address); // derived address (p2pkh by default)
console.log(session.pubkey);  // hex-encoded public key
```

### Options

```js
const session = sdk.session('your-wif-key', {
    addressType:    'p2pkh',   // 'p2pkh' (default), 'p2wpkh', or 'p2sh-p2wpkh'
    waitForIndexer: true,      // default for all submit calls
    timeout:        120000,    // default timeout for indexer confirmation
    pollInterval:   2000,      // default poll interval
    requireValid:   true       // default validity check
});
```

---

## Submitting Actions

Every action method on a session goes through the full lifecycle (encode → sign → broadcast → wait):

```js
// Send tokens
await session.send({ tick: 'MYTOKEN', amount: '100', destination: 'bc1q...' });

// Issue a new token
await session.issue({ tick: 'NEWTOKEN', maxSupply: '1000000', decimals: 8 });

// Place a DEX order
await session.order({
    giveTick: 'TOKENA', giveAmount: '100',
    getTick: 'TOKENB', getAmount: '200'
});
```

### Available Action Methods

Thirty of the 31 action types are available as convenience methods. `BATCH` is
the exception: it is composed with the SDK's batch builder
(`sdk.batch().send({...}).mint({...}).build()`) rather than by a session method.

| Category | Methods |
|---|---|
| Token lifecycle | `send`, `issue`, `mint`, `destroy`, `transfer` |
| Trading | `order`, `swap`, `coinpay`, `dispenser` |
| Distribution | `dividend`, `airdrop`, `sweep` |
| Communication | `broadcast`, `message`, `file` |
| Utility | `list`, `link`, `callback`, `sleep`, `address` |
| Oracle | `price` |
| Governance | `vote` |
| Betting | `bet` |
| Staking (BTC) | `stake`, `unstake`, `delegate`, `collect` |
| Contract-targeted staking | `stakeToContract`, `unstakeFromContract`, `delegateForContract` |
| Chunked deploy | `deployChunk` |
| Smart contracts | `deploy`, `execute`, `deposit`, `withdraw` |

### Contract-Targeted Staking and Chunked Deploy

Three convenience methods handle protocol-version-pinned variants that differ from the base staking and deploy actions:

- **`session.stakeToContract(params)`** submits a `STAKE VERSION=3` action targeting a specific deployed contract. Required params: `AMOUNT`, `SIGNING_PUBKEY`, `TARGET_CONTRACT_INDEX`, `TICK`.
- **`session.unstakeFromContract(params)`** submits an `UNSTAKE VERSION=1` action to withdraw stake from a contract. Required params: `SIGNING_PUBKEY`, `TARGET_CONTRACT_INDEX`, `TICK`.
- **`session.delegateForContract(params)`** submits a `DELEGATE VERSION=1` action to delegate stake within a contract. Required params: `SIGNING_PUBKEY`, `TARGET_CONTRACT_INDEX`, `TICK`.
- **`session.deployChunk(params)`** submits a `DEPLOY VERSION=4` carrier for one base64 code slice of a chunked contract deploy (contracts larger than the OP_RETURN limit). Use `sdk.deployContract()` for the high-level chunked deploy workflow; `deployChunk` is the per-slice primitive.

These methods force the `VERSION` field so callers cannot accidentally route to the wrong protocol variant. All other session options (UTXO caching, `waitForIndexer`, encoder overrides) apply normally.

### Generic Submit

For any action type, use `submit()` directly:

```js
await session.submit(
    { action: 'SEND', params: { tick: 'TOKEN', amount: '50', destination: 'bc1q...' } },
    { encoding: 'OP_RETURN' },  // optional encoder overrides
    { timeout: 60000 }          // optional submit overrides
);
```

---

## UTXO-Aware Transaction Chaining

Sessions maintain an in-memory UTXO cache that enables rapid sequential transactions without waiting for each one to confirm:

```js
const session = sdk.session(wif);

// These can be sent back-to-back without double-spending
await session.send({ tick: 'TOKEN', amount: '10', destination: addr1 });
await session.send({ tick: 'TOKEN', amount: '20', destination: addr2 });
await session.send({ tick: 'TOKEN', amount: '30', destination: addr3 });
```

The cache automatically:
- Loads UTXOs from the UTXO tracker on first use
- Marks spent UTXOs after each transaction
- Tracks speculative change outputs from recently broadcast transactions
- Prevents double-spend by filtering out already-used UTXOs

### Manual UTXO Refresh

```js
// Force a fresh UTXO fetch from the tracker
await session.refreshUTXOs();
```

---

## Explorer Queries (Scoped to Session Address)

```js
const balances   = await session.getBalances();
const history    = await session.getHistory();
const credits    = await session.getCredits('address');
const debits     = await session.getDebits('address');
const sends      = await session.getSends();
const orders     = await session.getOrders();
const swaps      = await session.getSwaps();
const dispensers = await session.getDispensers();
```

All queries are automatically scoped to the session's address.

---

## Fee Estimation

```js
const estimate = await session.estimateFees({
    action: 'SEND',
    params: { tick: 'TOKEN', amount: '100', destination: 'bc1q...' }
});
console.log(`Fee: ${estimate.fee} satoshis`);
```

The session automatically fills in `pubkey` and `change` from the session credentials.

---

## Session Properties

| Property | Type | Description |
|---|---|---|
| `sdk` | `XChainSDK` | Parent SDK instance |
| `wif` | `string` | WIF private key |
| `pubkey` | `string` | Hex-encoded public key |
| `publicKey` | `Buffer` | Raw public key buffer |
| `address` | `string` | Derived address |
| `compressed` | `boolean` | Whether the key is compressed |

---

## Related Documentation

- [Transaction Lifecycle](lifecycle.md): `submitAction` details, fee estimation, progress callbacks
- [Workflows](workflows.md): multi-step recipes that use sessions internally
- [Wallet & Auth](wallet.md): key management, address derivation, PSBT signing

---

## Agent Sessions

`sdk.agentSession(wif, policy)` is the policy-bounded variant of `sdk.session()` designed for automated agents. It wraps the same key in a declarative spending policy, action allowlist, per-action and per-window amount caps, destination allowlist, and a human-in-the-loop confirmation hook, checked at every `submit()` call. Fail-closed: no `allowedActions` list means nothing is allowed; a corrupt usage-state file blocks all submits rather than silently resetting the window.

See [Agent Wallets](../../ai-agents/agent-wallets.md) for the full reference.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
