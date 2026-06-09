<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain VM — Operations

## Prerequisites

- **Node.js** v18+ (V8 engine compatibility)
- **Native build tools** for `isolated-vm` compilation: `build-essential`, `python3`, `libnghttp2-dev`, `libicu-dev`, `libbrotli-dev`, `libc-ares-dev` (Debian/Ubuntu)
- The VM is a library dependency of `xchain-indexer` — it is not run as a standalone process

## Installation

```bash
cd xchain-vm
npm install
```

If `isolated-vm` fails to compile, ensure the native build prerequisites are installed. The module requires C++ compilation against the system's V8 headers.

## Running Tests

```bash
npm test                      # unit tests (580 tests, 30s timeout)
npm run test:all              # unit + E2E (644 tests)
npm run test:regression:core  # P0+P1 regression — security + smoke (45 tests, < 200ms)
npm run test:regression:full  # P0-P3 regression — full suite (152 tests, < 1s)
npm run test:fuzz             # property-based / fuzz tests (86 tests)
npm run test:chaos            # chaos engineering (92 tests)
npm run mutation              # mutation testing (Stryker)
```

The VM maintains **974 total tests** across unit, E2E, security, fuzz, chaos, boundary, regression, and smoke suites. Tests that require `isolated-vm` are automatically skipped in the standard suite if the native module is not available. The regression suite (`test/regression/`) uses a fail-loud check — it throws a fatal error instead of silently skipping, since regression tests must never pass vacuously.

## Integration with the Indexer

The VM is instantiated once in the indexer's `actions.js` and shared across all action handlers for the lifetime of the indexer process.

### Lifecycle

1. **Startup:** Indexer creates `new XChainVM({ gasSchedule, gasCeiling, limits })` from its configuration
2. **Per block:** Indexer calls `vm.beginBlock()` before processing transactions, `vm.endBlock()` after
3. **DEPLOY action:** `deploy.js` calls `vm.validateSyntax(code)` to validate contract source, then `vm.execute()` to run the constructor
4. **EXECUTE action:** `execute.js` calls `vm.execute()` with the contract code, current state, method name, parameters, and block context
5. **Result processing:** The indexer applies `stateChanges` and `stateDeletes` to the database, processes `emittedActions` through standard action handlers, and records `gasUsed` for fee charging

### Data Flow

```
Indexer (execute.js)
    |
    |-- Loads contract code + state from DB
    |-- Builds balances, tokenInfo, oracleData, crossChainData
    |
    '-> vm.execute({ code, state, method, params, caller, ... })
            |
            '-> Returns { success, error, gasUsed, returnValue,
                          stateChanges, stateDeletes, emittedActions, logs }
    |
    |-- On success: apply state changes, process emissions, charge gas
    '-- On failure: discard state/emissions, charge gas up to failure point
```

## Error Classification

The VM classifies execution failures into five categories:

| Error Type | Result Prefix | Cause |
|---|---|---|
| Contract revert | `revert: <reason>` | `xchain.revert(reason)` or `xchain.require(false, reason)` |
| Gas exhaustion | `out_of_gas: used X of Y` | Gas ceiling exceeded during execution |
| Wall-clock timeout | `timeout: wall-clock safety net triggered` | Execution exceeded `maxCpuTimeMs` (safety net only) |
| Memory exhaustion | `out_of_memory: isolate memory limit exceeded` | V8 isolate heap exceeded `maxMemory` |
| Runtime error | `error: <message>` | Any other JavaScript error (undefined variable, type error, etc.) |

Errors thrown inside the V8 isolate lose their JavaScript class identity when crossing the isolate boundary. The VM uses a message-encoding scheme (see [ARCHITECTURE.md](ARCHITECTURE.md#json-bridge-protocol)) to preserve error type information.

## Atomicity Guarantees

On any failure (revert, gas exhaustion, timeout, memory, runtime error):

- **State changes** are discarded — `stateChanges` and `stateDeletes` are empty arrays
- **Emitted actions** are discarded — `emittedActions` is an empty array
- **Logs are preserved** — `logs` contains all `xchain.log()` output up to the failure point
- **Gas is charged** — `gasUsed` reflects consumption up to the failure point

The indexer uses database savepoints to ensure these guarantees extend to the persistent state.

## Syntax Validation (Deploy-Time)

Before a contract is deployed, `vm.validateSyntax(code)` runs three checks:

1. **V8 syntax check** — compiles the code in a throwaway 8 MB isolate to catch syntax errors
2. **Acorn metering pass** — runs `meterCode()` to ensure acorn can parse the source (effective ES2020 ceiling)
3. **Reserved identifier check** — rejects code containing the `__gas` identifier (used internally by the gas metering system)

`vm.checkFloatWarnings(code)` additionally scans for non-integer number literals and returns warnings (non-blocking).

## Troubleshooting

### isolated-vm won't compile

**Symptoms:** `npm install` fails with C++ compilation errors.

**Fix:** Install native build tools:
```bash
# Debian/Ubuntu
sudo apt-get install build-essential python3 libnghttp2-dev libicu-dev libbrotli-dev libc-ares-dev

# macOS
xcode-select --install
```

### Contract hits gas limit unexpectedly

**Symptoms:** Contract returns `out_of_gas` with relatively simple logic.

**Cause:** Gas is charged at every control flow point, function call, and loop iteration. Deeply nested loops or many function calls accumulate gas quickly. Note that indexed `for` loops are charged **twice per iteration** — once for the loop body and once for the update expression (`i++`) — so a `for` loop costs double what an equivalent `while` loop costs. Deeply nested `for` loops are the most common cause of unexpected exhaustion.

**Fix:** Optimize contract logic — reduce loop iterations, minimize function call depth, batch state reads.

### Contract returns "unknown method"

**Symptoms:** `error: unknown method: <name>` in execution result.

**Cause:** The contract exports an object but the method name in the EXECUTE action doesn't match any property on the exported object.

**Fix:** Verify the method name matches a property on `module.exports`. Method names are case-sensitive.

### Contract returns "contract must export a function or object"

**Symptoms:** `error: contract must export a function or object` in execution result.

**Cause:** The contract code doesn't assign a function or object to `module.exports`.

**Fix:** Ensure the contract sets `module.exports = function(xchain) { ... }` or `module.exports = { methodName: function(xchain) { ... } }`.

### Sandbox escape attempt detected

**Symptoms:** Contract tries to access `process`, `require`, `Date`, `Math.random`, or `Function` and gets `undefined` or an error.

**Cause:** The sandbox strips all non-deterministic and dangerous APIs. This is working as intended.

**Note:** Contracts should use `xchain.getBlockTimestamp()` instead of `Date`, `xchain.math.*` instead of native arithmetic operators, and `xchain.log()` instead of `console.log`.

### State value rejected

**Symptoms:** Contract execution fails with "state value cannot be null or undefined", "state value cannot be NaN or Infinity", "state value must be JSON-serializable", or "state value exceeds max size".

**Fix:** Ensure all values passed to `xchain.state.set()` are non-null, finite, JSON-serializable, and under 64 KB when serialized. Use `xchain.state.delete()` to remove keys instead of setting to null.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
