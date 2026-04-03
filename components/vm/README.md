<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain VM Component

The `xchain-vm` module is a standalone JavaScript library that executes smart contracts in deterministic, sandboxed V8 isolates. It is the runtime engine for the XChain smart contract layer — everything else (the DEPLOY/EXECUTE action handlers, database tables, gas fee logic) lives in the indexer.

## What It Is

A pure function library. Takes contract code + state + inputs + block context. Returns new state + emitted actions + gas used.

## What It Is Not

It has no awareness of the indexer, database, blockchain, or network. It does not read from or write to MariaDB. The indexer's `execute.js` handler is the bridge between the VM and the platform.

## Architecture

```
Contract Source Code
    ↓
  acorn (parse AST)
    ↓
  metering.js (inject __gas() calls at control flow points)
    ↓
  astring (regenerate source from modified AST)
    ↓
  isolated-vm (V8 isolate)
    ├── sandbox.js (strip non-deterministic globals)
    ├── gateway.js (inject xchain object via ivm.Reference callbacks)
    ├── gas.js (__gas → chargeComputation on host side)
    └── script.runSync() (execute with wall-clock timeout)
    ↓
  Collect results
    ├── state.js → stateChanges, stateDeletes
    ├── collector.js → emittedActions, logs
    └── gas.js → gasUsed
    ↓
  Return to indexer (execute.js)
```

## Module Interface

```javascript
const XChainVM = require('xchain-vm');

const vm = new XChainVM({
    gasSchedule: config['GAS_SCHEDULE'],
    gasCeiling:  1000000,
    limits: {
        maxCpuTimeMs:      30000,
        maxMemory:         8,
        maxEmissions:      50,
        maxStateKeys:      10000,
        maxStateValueSize: 65536,
        maxCodeSize:       65536
    }
});

const result = await vm.execute({
    code:             contractCode,
    state:            contractState,
    method:           methodName,
    params:           ['arg1', 'arg2'],
    caller:           sourceAddress,
    contractAddress:  'C:BTC:500',
    blockContext:     { height: 100, timestamp: 1700000000, hash: 'blockhash' },
    balances:         addressBalances,
    tokenInfo:        tokenInfoMap,
    oracleData:       oracleAccessor,
    crossChainData:   crossChainAccessor
});

// result = {
//     success:        boolean,
//     error:          string|null,
//     gasUsed:        number,
//     returnValue:    string|null,
//     stateChanges:   [{ key, value }],
//     stateDeletes:   [key],
//     emittedActions: [{ action, params }],
//     logs:           [string]
// }
```

## Internal Components

| File | Purpose |
|---|---|
| `index.js` | XChainVM class — main entry point, orchestrates execution |
| `isolate.js` | V8 isolate creation, compilation, disposal |
| `sandbox.js` | Strips non-deterministic globals (Date, Math.random, setTimeout, etc.) |
| `metering.js` | AST-based gas injection — parses with acorn, injects `__gas()` calls, regenerates with astring |
| `gas.js` | GasTracker — accumulates gas charges, enforces ceiling |
| `gateway.js` | Builds the `xchain` gateway object for contract interaction |
| `gateway-emit.js` | Emit API — 16 action types with parameter validation |
| `math.js` | Deterministic math wrapping mathjs bignumber (string I/O) |
| `state.js` | StateManager — dirty tracking, key count limits, value size limits |
| `collector.js` | EmissionCollector — action queue and log collection |
| `validator.js` | ActionValidator — pre-validates emitted actions |
| `syntax.js` | Deploy-time validation (V8 + acorn syntax, `__gas` check, float warnings) |
| `errors.js` | ContractRevertError, GasExhaustedError |

## Gas Metering

The VM uses **AST-based gas injection** rather than wall-clock timing. Before execution, the contract source is:

1. Parsed into an AST by acorn (ES2020)
2. Walked to inject `__gas(1)` calls at control flow points (loop iterations, function entries, branches, call sites)
3. Regenerated as JavaScript via astring

The injected `__gas()` function calls the host-side `GasTracker.chargeComputation()` via a synchronous `ivm.Reference` callback. This makes gas metering fully deterministic — every node charges the same gas for the same code.

Injection points: `for`, `while`, `do-while`, `for-in`, `for-of` (per iteration), function/arrow entry, `if`/`else`, `switch` cases, ternary operators, `try`/`catch`/`finally` blocks, call expressions, and deeply nested binary expressions (depth > 10).

## Sandbox Security

The V8 isolate provides hardware-level isolation (separate heap, no shared objects). Additionally:

- **Stripped:** Date, Math.random, setTimeout/setInterval, process, require, eval, Function constructor, fetch, WeakRef, FinalizationRegistry, Proxy, console
- **Preserved:** Array, Object, String, Number, Boolean, BigInt, JSON, Map, Set, Symbol, Error, RegExp, parseInt, parseFloat
- **Replaced:** Math (deterministic subset only — floor, ceil, round, abs, min, max, sqrt)
- **Gateway methods** are injected as `ivm.Reference` sync callbacks — they execute on the host side when the contract calls them

## Compilation Cache

The VM maintains a per-block compilation cache (`beginBlock()`/`endBlock()`) that stores V8 cached compilation data for contracts executed multiple times in the same block. The cache key is `contractIndex:codeHash`. This eliminates redundant compilation for hot contracts (e.g., a popular AMM called 50 times in one block).

## Integration with the Indexer

The VM is instantiated once in `actions.js` and shared across all action handlers:

- `execute.js` calls `vm.execute()` for EXECUTE actions, then processes state changes and emissions via savepoints
- `deploy.js` calls `vm.validateSyntax()` for DEPLOY actions, and `vm.execute()` for constructor execution
- `XChainIndexer.js` calls `vm.beginBlock()` and `vm.endBlock()` in the block processing loop

## Dependencies

| Package | Purpose |
|---|---|
| `isolated-vm` | V8 isolate sandbox (native C++ module) |
| `mathjs` | Deterministic bignumber arithmetic |
| `acorn` | JavaScript parser for AST-based gas injection |
| `acorn-walk` | AST walker |
| `astring` | AST-to-source code generator |

## Related

- [Smart Contracts Concept](../../concepts/SMART_CONTRACTS.md) — gateway API reference and contract format
- [Contract Development Guide](../../developer-guide/SMART_CONTRACT_DEVELOPMENT.md) — writing and deploying contracts
- [Gas and Fees](../../concepts/GAS.md) — VM gas schedule
- [Indexer Database](../indexer/DATABASE.md) — VM-related table schemas

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
