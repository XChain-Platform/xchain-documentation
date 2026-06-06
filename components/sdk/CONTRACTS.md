<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK — Smart Contract Integration

This document covers the SDK's integration with the XChain VM smart contract system: deploying contracts, executing methods, managing contract token balances, querying contract data, and using the contract authoring utilities.

---

## Overview

The XChain VM allows JavaScript smart contracts to run on the XChain Platform. Contracts execute deterministically inside sandboxed V8 isolates and can interact with the ledger by emitting platform actions (SEND, ISSUE, MINT, etc.) through the `xchain` gateway object.

The SDK provides three layers of contract support:

| Layer | What it provides |
|-------|-----------------|
| **Action primitives** | `sdk.deploy()`, `sdk.execute()`, `sdk.deposit()`, `sdk.withdraw()` — same pattern as all other SDK actions |
| **Contract client** | `sdk.contract(actionIndex)` — bound client for repeated interactions with a specific contract |
| **Authoring utilities** | `sdk.contracts.validate()`, `sdk.contracts.encode()`, etc. — tools for contract authors |

**Important:** The SDK constructs transactions; it does **not** execute contracts. Contract execution happens later, when the indexer processes the confirmed blockchain transaction. A successful `sdk.execute()` call means the transaction was built and encoded, not that the contract logic succeeded.

---

## Actions

### DEPLOY

Deploy a new smart contract. The SDK accepts raw JavaScript source via the `code` parameter and hex-encodes it automatically.

```js
let result = await sdk.deploy({
    code: contractSource,      // raw JS — SDK hex-encodes it
    gasLimit: 200000,
    constructorParams: ['arg1', 'arg2']
}, { pubkey: 'yourPubkey', encoding: 'P2WSH' });
```

DEPLOY payloads are almost always larger than 76 bytes of user data (the OP_RETURN limit; 80 bytes total per output), so OP_RETURN encoding will be rejected. Use P2SH or P2WSH.

See [ACTIONS.md — DEPLOY](ACTIONS.md#deploy) for full parameter reference.

### EXECUTE

Call a method on a deployed contract.

```js
let result = await sdk.execute({
    contractActionIndex: 12345,
    method: 'transfer',
    params: ['bc1q...', '100']
}, { pubkey: 'yourPubkey' });
```

The `params` array is variable-length — each element becomes a separate pipe-delimited field in the action string. Short EXECUTE calls (few params, short method name) can fit in OP_RETURN.

See [ACTIONS.md — EXECUTE](ACTIONS.md#execute) for full parameter reference.

### DEPOSIT

Transfer tokens from your address into a contract's custody.

```js
let result = await sdk.deposit({
    contractActionIndex: 12345,
    tick: 'MYTOKEN',
    quantity: '1000'
}, { pubkey: 'yourPubkey' });
```

### WITHDRAW

Withdraw tokens from a contract back to the contract owner.

```js
let result = await sdk.withdraw({
    contractActionIndex: 12345,
    tick: 'MYTOKEN',
    quantity: '500'
}, { pubkey: 'yourPubkey' });
```

Only the address that broadcast the original DEPLOY can withdraw.

---

## Contract Client

For repeated interactions with a specific contract, create a bound client:

```js
const amm = sdk.contract(12345);
```

The client exposes:

| Method | Creates action | Description |
|--------|---------------|-------------|
| `amm.call(method, params?, encoder?)` | EXECUTE | Call a contract method |
| `amm.deposit(tick, quantity, encoder?)` | DEPOSIT | Fund the contract |
| `amm.withdraw(tick, quantity, encoder?)` | WITHDRAW | Withdraw from the contract |
| `amm.getInfo()` | — | Query contract metadata from the explorer |
| `amm.getState(key?)` | — | Query contract state (all keys or one key) |
| `amm.getExecutions(opts?)` | — | Query execution history |
| `amm.getBalance(tick?)` | — | Query contract token balances |

```js
// Execute a swap
await amm.call('swap', ['TOKENA', '100'], { pubkey: 'pk' });

// Check the contract's token balances
let balances = await amm.getBalance();

// Read a specific state key
let reserveA = await amm.getState('reserveA');
```

---

## Contract Authoring Utilities

The `sdk.contracts` namespace provides tools for contract authors. These are pure functions — they do not require `isolated-vm` or any native modules.

### `sdk.contracts.encode(sourceCode)`

Hex-encode UTF-8 contract source for DEPLOY payloads.

```js
let hex = sdk.contracts.encode('module.exports = {}');
// '6d6f64756c652e6578706f727473203d207b7d'
```

### `sdk.contracts.decode(hexString)`

Decode hex back to UTF-8 source for inspection.

```js
let source = sdk.contracts.decode(hex);
// 'module.exports = {}'
```

### `sdk.contracts.validate(sourceCode)`

Lightweight syntax pre-validation using acorn (no V8 required). Checks for:
- JavaScript syntax errors
- Code size limit (64KB)
- Reserved `__gas` identifier usage
- Float literal warnings

```js
let result = sdk.contracts.validate(sourceCode);
// { valid: true }
// { valid: true, warnings: ['Float literal (0.5) at line 3 — use xchain.math...'] }
// { valid: false, error: 'Syntax error: Unexpected token (2:5)' }
```

**Note:** This is a best-effort check. Passing `validate()` does not guarantee deployment success — the authoritative validation happens in the indexer's VM.

**Requires:** `acorn` and `acorn-walk` packages. If not installed, `validate()` returns an error message explaining the missing dependency.

### `sdk.contracts.checkFloatUsage(sourceCode)`

Detect float literals in contract source. Contracts should use `xchain.math` for all arithmetic — native floating-point breaks determinism.

```js
let warnings = sdk.contracts.checkFloatUsage('var price = 1.5;');
// ['Float literal (1.5) at line 1 — use xchain.math for deterministic arithmetic']
```

### `sdk.contracts.checkCodeSize(sourceCode)`

Check if the source is within the 64KB byte limit.

```js
let result = sdk.contracts.checkCodeSize(sourceCode);
// { bytes: 1234, withinLimit: true, limit: 65536 }
```

### `sdk.contracts.suggestGasLimit(sourceCode)`

Heuristic gas limit suggestion based on code size and complexity (number of functions, loops, emit calls, state operations).

```js
let result = sdk.contracts.suggestGasLimit(sourceCode);
// { suggested: 120000, rationale: '850 bytes, 3 functions, 1 loops, 2 emit calls, 4 state ops' }
```

This is a rough estimate — actual gas consumption depends on runtime execution paths.

---

## Explorer Methods

The SDK provides these explorer methods for querying VM data:

| Method | Description |
|--------|-------------|
| `sdk.getContract(actionIndex)` | Contract metadata (address, owner, status, deploy block) |
| `sdk.getContracts(query?, type?, opts?)` | List contracts, optionally filtered |
| `sdk.getContractState(actionIndex, key?)` | Contract state (all keys or one key) |
| `sdk.getContractBalance(actionIndex, tick?)` | Contract token balances |
| `sdk.getExecution(actionIndex)` | Single execution result |
| `sdk.getExecutions(contractActionIndex?, opts?)` | Execution history |
| `sdk.getDeposits(query, type, opts?)` | Deposit records |
| `sdk.getWithdrawals(query, type, opts?)` | Withdrawal records |

---

## Transaction vs. Execution

This is the most important conceptual distinction:

1. **Transaction success** = the PSBT was constructed, signed, and confirmed on-chain.
2. **Execution success** = the contract logic ran without errors inside the VM.

These are **independent**. A transaction can confirm successfully but the contract execution can still fail (revert, out of gas, timeout, etc.). Failed executions discard all state changes and emitted actions but still consume the transaction fee.

To check whether a contract execution succeeded:

```js
let exec = await sdk.getExecution(actionIndex);
if (exec.success) {
    console.log('Gas used:', exec.gasUsed);
    console.log('Return value:', exec.returnValue);
} else {
    // Possible errors: 'revert: ...', 'out_of_gas: ...', 'timeout: ...', 'error: ...'
    console.log('Failed:', exec.error);
}
```

---

## BATCH Integration

EXECUTE, DEPOSIT, and WITHDRAW can be included in BATCH transactions:

```js
await sdk.batch()
    .execute({ contractActionIndex: 123, method: 'doSomething' })
    .deposit({ contractActionIndex: 123, tick: 'TOKEN', quantity: '100' })
    .send({ tick: 'TOKEN', amount: '50', destination: 'addr...' })
    .build({ pubkey: 'yourPubkey' });
```

DEPLOY is **not** allowed in BATCH (payloads are too large).

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
