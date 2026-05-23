<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Smart Contract Development Guide

This guide covers writing, deploying, and interacting with smart contracts on the XChain Platform.

## Prerequisites

- An address with XCHAIN tokens (for gas fees)
- Access to an encoder service (to broadcast transactions)
- Familiarity with JavaScript (ES2020)

## Writing a Contract

Contracts are plain JavaScript files that export either a function or an object with named methods. Every method receives the `xchain` gateway object as its sole argument.

### Minimal Contract

```javascript
module.exports = function(xchain) {
    xchain.log('hello from contract');
    return 'hello';
};
```

### Multi-Method Contract

```javascript
module.exports = {
    initialize: function(xchain) {
        xchain.state.set('owner', xchain.getSourceAddress());
        xchain.state.set('total', '0');
    },
    deposit: function(xchain) {
        var amount = xchain.getInputParam(0);
        xchain.require(amount, 'amount required');
        xchain.require(xchain.math.gt(amount, '0'), 'amount must be positive');

        var total = xchain.state.get('total') || '0';
        xchain.state.set('total', xchain.math.add(total, amount));
    },
    withdraw: function(xchain) {
        xchain.require(
            xchain.getSourceAddress() === xchain.state.get('owner'),
            'only owner can withdraw'
        );
        var amount = xchain.getInputParam(0);
        var tick = xchain.getInputParam(1);
        xchain.emit.send({
            destination: xchain.getSourceAddress(),
            tick: tick,
            quantity: amount
        });
    }
};
```

### Constructor

If a contract exports an `initialize` method and the DEPLOY action includes `CONSTRUCTOR_PARAMS`, the VM calls `initialize` immediately after deployment. Constructor state changes and emissions are processed atomically with the deployment — if the constructor fails, the contract is not deployed.

## Supported JavaScript

Contracts support **ES2020** syntax. This includes:

- `let`, `const`, arrow functions, template literals, destructuring
- `class` declarations and methods
- `for...of`, `for...in`, spread operator
- Optional chaining (`?.`) and nullish coalescing (`??`)
- `async`/`await` syntax is parseable but contracts execute synchronously — Promises never resolve

**Not supported:**
- ES2021+ features (class fields `#private`, `Object.hasOwn()`, top-level await)
- `import`/`export` (use `module.exports`)
- `require()`, `eval()`, `Function()` constructor

## All Arithmetic Must Use xchain.math

Native JavaScript arithmetic (`+`, `-`, `*`, `/`) uses IEEE 754 floating-point, which can produce subtly different results across V8 versions. This would cause contract hash divergence between indexer nodes.

```javascript
// WRONG — non-deterministic
var total = parseFloat(a) + parseFloat(b);

// CORRECT — deterministic
var total = xchain.math.add(a, b);
```

All `xchain.math` operations accept and return **strings**. This ensures no precision loss.

## State Management

The state API provides `get(key)`, `set(key, value)`, `has(key)`, and `delete(key)`. There is no `keys()` or `entries()` method — this is deliberate to avoid key-ordering non-determinism.

### Pattern: Manual Index for Collections

```javascript
// Adding a participant
var count = parseInt(xchain.state.get('participants_count') || '0');
xchain.state.set('participant_' + count, address);
xchain.state.set('participants_count', String(count + 1));

// Iterating participants
var count = parseInt(xchain.state.get('participants_count') || '0');
for (var i = 0; i < count; i++) {
    var addr = xchain.state.get('participant_' + i);
    // ... process addr
}
```

### Pattern: Duplicate Detection

Without `state.keys()`, use a reverse lookup to detect duplicates:

```javascript
if (xchain.state.has('participant_by_addr_' + addr))
    xchain.revert('already a participant');

xchain.state.set('participant_' + count, addr);
xchain.state.set('participant_by_addr_' + addr, String(count));
xchain.state.set('participants_count', String(count + 1));
```

### Pattern: JSON for Small Datasets

```javascript
xchain.state.set('config', JSON.stringify({ fee: '100', admin: 'addr1', paused: false }));
var config = JSON.parse(xchain.state.get('config'));
```

## Emitting Actions

Contracts emit platform actions using `xchain.emit.*`. Each emission costs 500 gas and is capped at 50 per execution.

```javascript
// Send tokens from the contract to an address
xchain.emit.send({
    destination: xchain.getSourceAddress(),
    tick: 'MYTOKEN',
    quantity: '100'
});

// Issue a new token
xchain.emit.issue({
    tick: 'NEWTOKEN',
    maxSupply: '1000000',
    decimals: '8',
    description: 'Created by contract'
});
```

Emitted actions use the contract's **derived address** (`C:<CHAIN>:<action_index>`) as the source. The contract can only spend tokens deposited to its derived address. The EXECUTE caller pays protocol fees on emitted actions.

### Snapshot Semantics

Emitted actions are queued during execution and processed **after** the VM returns. A contract cannot observe the effects of its own emissions within the same execution. `getBalance()` reflects the state at the start of execution.

### Atomicity

If any emitted action fails validation (e.g., insufficient balance), ALL state changes and ALL earlier emissions are rolled back. The caller is still charged gas.

## Deploying a Contract

1. Write your contract as a JavaScript file
2. Hex-encode the UTF-8 source: `Buffer.from(source, 'utf8').toString('hex')`
3. Broadcast a DEPLOY action: `DEPLOY|0|<hex_code>|<gas_limit>|<constructor_params>`

The indexer validates the code syntax before charging gas. If syntax is invalid, the deployment is rejected without cost.

### Deploy-Time Validation

The VM performs three checks before deployment:

1. **V8 syntax check** — the code must parse as valid JavaScript
2. **Acorn metering pass** — the code must be parseable by acorn (ES2020 maximum)
3. **Reserved identifier check** — the code must not use `__gas` (reserved for gas metering)

A non-blocking **float warning** is also generated if decimal number literals are detected in the code. This warning appears in the execution record but does not prevent deployment.

## Gas Costs

| Operation | Gas |
|---|---|
| Computation (per control flow point) | 1 |
| State read (`state.get`, `state.has`, `getBalance`, `getTokenInfo`) | 100 |
| State write (`state.set`) | 200 |
| State delete (`state.delete`) | 100 |
| Oracle read | 100 |
| Cross-chain read | 100 |
| Action emission | 500 |

The gas ceiling is **1,000,000** per execution. Deployment gas is calculated as `VM_DEPLOY_BASE + (code_bytes * VM_DEPLOY_PER_BYTE)`, plus constructor gas if a constructor runs.

## Debugging

- Use `xchain.log()` to add messages to the execution log (up to 100 entries, 1KB each)
- Logs are preserved even when execution fails — check the execution record in the explorer
- Use `xchain.revert('descriptive message')` for clear error reporting
- The explorer shows full execution details: gas used, state changes, emitted actions, error messages

## Limitations

- **No cross-contract calls** — `emit.execute()` is not available in API version 1. Contracts cannot invoke other contracts.
- **No `state.keys()`** — contracts must manage their own key indexing for collections
- **Immutable code** — deployed contracts cannot be updated. Use the proxy pattern for upgradeability.
- **No network access** — contracts cannot make HTTP calls, read files, or access external data (use oracles)
- **Synchronous only** — no `async`/`await` execution; Promises never resolve in the sandbox

## Example: Token Vesting Contract

```javascript
module.exports = {
    initialize: function(xchain) {
        xchain.state.set('beneficiary', xchain.getInputParam(0));
        xchain.state.set('token', xchain.getInputParam(1));
        xchain.state.set('totalAmount', xchain.getInputParam(2));
        xchain.state.set('startBlock', String(xchain.getBlockHeight()));
        xchain.state.set('vestingBlocks', xchain.getInputParam(3) || '1000');
        xchain.state.set('claimed', '0');
    },
    claim: function(xchain) {
        xchain.require(
            xchain.getSourceAddress() === xchain.state.get('beneficiary'),
            'only beneficiary can claim'
        );

        var currentBlock = xchain.getBlockHeight();
        var startBlock = parseInt(xchain.state.get('startBlock'));
        var vestingBlocks = parseInt(xchain.state.get('vestingBlocks'));
        var totalAmount = xchain.state.get('totalAmount');
        var claimed = xchain.state.get('claimed');

        var elapsed = currentBlock - startBlock;
        var vested;
        if (elapsed >= vestingBlocks) {
            vested = totalAmount;
        } else {
            vested = xchain.math.divide(
                xchain.math.multiply(totalAmount, String(elapsed)),
                String(vestingBlocks)
            );
        }

        var claimable = xchain.math.subtract(vested, claimed);
        xchain.require(xchain.math.gt(claimable, '0'), 'nothing to claim');

        xchain.state.set('claimed', xchain.math.add(claimed, claimable));
        xchain.emit.send({
            destination: xchain.state.get('beneficiary'),
            tick: xchain.state.get('token'),
            quantity: claimable
        });
    }
};
```

## Related

- [Smart Contracts Concept](../concepts/Smart_Contracts.md) — architecture and gateway API reference
- [Gas and Fees](../concepts/GAS.md) — gas economics
- [DEPLOY Action](../protocol/actions/DEPLOY.md) — deployment protocol spec
- [EXECUTE Action](../protocol/actions/EXECUTE.md) — execution protocol spec

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
