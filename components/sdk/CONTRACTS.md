<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK: Smart Contract Integration

This document covers the SDK's integration with the XChain VM smart contract system: deploying contracts, executing methods, managing contract token balances, querying contract data, and using the contract authoring utilities.

---

## Overview

The XChain VM allows JavaScript smart contracts to run on the XChain Platform. Contracts execute deterministically inside sandboxed V8 isolates and can interact with the ledger by emitting platform actions (SEND, ISSUE, MINT, etc.) through the `xchain` gateway object.

The SDK provides three layers of contract support:

| Layer | What it provides |
|-------|-----------------|
| **Action primitives** | `sdk.deploy()`, `sdk.execute()`, `sdk.deposit()`, `sdk.withdraw()`: same pattern as all other SDK actions |
| **Contract client** | `sdk.contract(actionIndex)`: bound client for repeated interactions with a specific contract |
| **Authoring utilities** | `sdk.contracts.validate()`, `sdk.contracts.encode()`, etc.: tools for contract authors |

**Important:** The SDK constructs transactions; it does **not** execute contracts. Contract execution happens later, when the indexer processes the confirmed blockchain transaction. A successful `sdk.execute()` call means the transaction was built and encoded, not that the contract logic succeeded.

---

## Actions

### DEPLOY

Deploy a new smart contract. The SDK accepts raw JavaScript source via the `code` parameter and base64-encodes it automatically.

```js
let result = await sdk.deploy({
    code: contractSource,      // raw JS (SDK base64-encodes it)
    gasLimit: 200000,
    constructorParams: ['arg1', 'arg2']
}, { pubkey: 'yourPubkey', encoding: 'P2WSH' });
```

DEPLOY payloads are almost always larger than 76 bytes of user data (the OP_RETURN limit; 80 bytes total per output), so OP_RETURN encoding will be rejected. Use P2SH or P2WSH.

#### Chunked DEPLOY for large contracts

A single DEPLOY action can carry at most 8,192 bytes of compiled action data. Contracts whose base64-encoded source exceeds that ceiling (roughly 6 KB of raw source) require the chunked deploy workflow. Use `sdk.deployContract(wif, deployParams, deposits?, opts?)` rather than `sdk.deploy()` directly: it calls `chunkHelper.planDeploy()` to decide which path to take.

**Single-shot path (fits in one action):** `sdk.deployContract` falls through to a normal `sdk.deploy()` call. DEPLOY v0 (no constructor) or v1 (with constructor) are emitted inline.

**Chunked path (6 KB to 64 KB raw source):** two phases are submitted on-chain:

1. **Carrier phase (DEPLOY v4):** the base64 source is split into ordered slices of up to 7,800 bytes each (max 16 slices). Each slice is broadcast as a DEPLOY v4 carrier action and waited on individually so all carriers have lower action indexes than the assembling action.
2. **Assemble phase (DEPLOY v2 or v3):** a final DEPLOY v2 (or v3 for staking contracts) carries only the `CODE_HASH` (SHA-256 of the UTF-8 source). The indexer locates the carriers by code hash, concatenates the slices in order, verifies the hash, and runs the normal deploy flow.

```js
// sdk.deployContract handles the path selection automatically.
// Pass raw 'code' (not a pre-encoded base64 string).
let result = await sdk.deployContract(
    wif,
    { code: contractSource, gasLimit: 200000, constructorParams: ['arg1'] },
    [{ tick: 'MYTOKEN', quantity: '1000' }]   // optional initial deposits
);
// result.chunks  - array of carrier submitResults (empty for single-shot)
// result.deploy  - the assemble (or single-shot) submitResult
// result.deposits - deposit submitResults
```

Contracts larger than 64 KB (base64-encoded source requiring more than 16 slices) are rejected at the planning stage with an error before any transaction is submitted.

See [ACTIONS.md; DEPLOY](ACTIONS.md#deploy) for full parameter reference.

### EXECUTE

Call a method on a deployed contract.

```js
let result = await sdk.execute({
    contractActionIndex: 12345,
    method: 'transfer',
    params: ['bc1q...', '100']
}, { pubkey: 'yourPubkey' });
```

The `params` array is variable-length; each element becomes a separate pipe-delimited field in the action string. Short EXECUTE calls (few params, short method name) can fit in OP_RETURN.

See [ACTIONS.md; EXECUTE](ACTIONS.md#execute) for full parameter reference.

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
| `amm.getInfo()` | None | Query contract metadata from the explorer |
| `amm.getState(key?)` | None | Query contract state (all keys or one key) |
| `amm.getExecutions(opts?)` | None | Query execution history |
| `amm.getBalance(tick?)` | None | Query contract token balances |

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

The `sdk.contracts` namespace provides tools for contract authors. These are pure functions; they do not require `isolated-vm` or any native modules.

### `sdk.contracts.encode(sourceCode)`

Base64-encode UTF-8 contract source for DEPLOY payloads.

```js
let b64 = sdk.contracts.encode('module.exports = {}');
// 'bW9kdWxlLmV4cG9ydHMgPSB7fQ=='
```

### `sdk.contracts.decode(b64String)`

Decode base64 back to UTF-8 source for inspection.

```js
let source = sdk.contracts.decode(b64);
// 'module.exports = {}'
```

### `sdk.contracts.validate(sourceCode)`

Pre-flight syntax and rule validation (no V8 or `isolated-vm` required). Delegates to `contract/lint-core.js`, a byte-identical vendored copy of the indexer's lint core, so a passing result here means the contract clears the indexer's syntax gate exactly - except the V8-only compile step, which can only run at deploy time.

Checks for:
- Code size limit (64 KB)
- JavaScript syntax errors and unsupported syntax (ES2020 maximum, via acorn)
- Reserved identifier usage (`__gas` and allocator metering helpers)
- Banned transcendental Math calls (`Math.sqrt`, `Math.pow`, `Math.log`, etc.)
- Banned native-DoS literals (BigInt and RegExp literals)
- Banned async surface (`async`, `await`, `Promise`)
- Float literal warnings (advisory; does not block deployment)
- Logic-level advisories: `crossCallable` integrity, unbounded loops, unchecked `state.get` dereferences, missing input validation

```js
let result = sdk.contracts.validate(sourceCode);
// { valid: true }
// { valid: true, warnings: ['WARNING: decimal number literal (0.5) detected at line 3...'] }
// { valid: false, error: 'banned API: Math.sqrt at line 5; ...' }
```

**Note:** This covers all acorn-detectable checks but not the V8 compile step (step 1 in the indexer). A passing `validate()` result is a strong pre-flight signal, not a deployment guarantee.

**Requires:** `acorn`, `acorn-walk`, and `astring` packages (hard dependencies; installed with the SDK).

### `sdk.contracts.checkFloatUsage(sourceCode)`

Detect float literals in contract source. Contracts should use `xchain.math` for all arithmetic, native floating-point breaks determinism.

```js
let warnings = sdk.contracts.checkFloatUsage('var price = 1.5;');
// ['Float literal (1.5) at line 1: use xchain.math for deterministic arithmetic']
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

This is a rough estimate, actual gas consumption depends on runtime execution paths.

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
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
