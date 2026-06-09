<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain VM — Architecture

## Execution Pipeline

```
Contract Source Code
    |
  acorn (parse AST, ES2020)
    |
  metering.js (inject __gas() calls at control flow points)
    |
  astring (regenerate source from modified AST)
    |
  isolated-vm (V8 isolate)
    |-- sandbox.js (strip non-deterministic globals)
    |-- gateway.js (inject xchain object via JSON bridge protocol)
    |-- gas.js (__gas -> chargeComputation on host side)
    '-- script.runSync() (execute with wall-clock timeout)
    |
  Collect results
    |-- state.js -> stateChanges, stateDeletes
    |-- collector.js -> emittedActions, logs
    '-- gas.js -> gasUsed
    |
  Return to indexer (execute.js)
```

## Internal Components

| File | Purpose |
|---|---|
| `index.js` | XChainVM class — main entry point, orchestrates isolate lifecycle, injects gateway, compiles and executes contracts |
| `isolate.js` | V8 isolate creation (`createIsolate`), throwaway isolate for syntax validation (`createThrowawayIsolate`), compilation (`compileScript`), cached data extraction, safe disposal |
| `sandbox.js` | Strips non-deterministic globals (Date, Math.random, setTimeout, etc.), replaces Math with frozen deterministic subset, preserves `Function` reference for contract wrapper |
| `metering.js` | AST-based gas injection — parses source with acorn, injects `__gas()` at control flow points, regenerates with astring. Also provides `hasGasIdentifier()` for deploy-time validation |
| `gas.js` | GasTracker class — validates gas schedule (non-negative integers), accumulates gas charges per operation, enforces ceiling, throws GasExhaustedError on overflow |
| `gateway.js` | Builds the `xchain` gateway object — context accessors, state CRUD, ledger queries, oracle, cross-chain, **external attestation (`xchain.attestation.*`)**, **contract-targeted staking (`xchain.contract.*`)**, emit API, math, control flow, logging |
| `gateway-emit.js` | Emit API builder — 16 action types (SEND through MESSAGE), parameter validation, gas charging |
| `math.js` | Deterministic math wrapping mathjs bignumber — all inputs/outputs are strings, wrapped in `safeMath` for ContractRevertError on failures |
| `state.js` | StateManager — reads from initial snapshot, tracks writes/deletes in dirty map, enforces key count, key size, and value size limits, provides `getChanges()` for result collection |
| `collector.js` | EmissionCollector — queues emitted actions (with emission cap), collects debug logs (100 entries, 1 KB UTF-8 each, with byte-aware truncation) |
| `validator.js` | ActionValidator — pre-validates emitted actions against the 16 allowed action types and checks params shape |
| `syntax.js` | Deploy-time validation — V8 syntax check (throwaway isolate), acorn metering pass (ES2020 ceiling), reserved `__gas` identifier detection, float literal warnings |
| `errors.js` | ContractRevertError (thrown by `revert()`/`require()`) and GasExhaustedError (thrown when gas ceiling exceeded) |

## JSON Bridge Protocol

The V8 isolate boundary in `isolated-vm` only allows primitive values (strings, numbers, booleans, null) to cross via `applySync`. Objects, arrays, and functions cannot be transferred directly. The VM uses a JSON-based bridge protocol to work around this limitation.

### How It Works

Each host-side gateway function is wrapped in a `bridge()` helper and injected into the isolate as an `ivm.Reference`. Inside the isolate, a corresponding `wrap()` helper converts each Reference into a callable function.

**Calling a gateway method (isolate → host):**

1. Contract calls `xchain.state.get('key')`
2. The isolate-side `wrap()` function JSON-serializes the arguments: `'["key"]'`
3. `ref.applySync(undefined, ['["key"]'])` sends the JSON string to the host
4. The host-side `bridge()` function parses the arguments: `JSON.parse('["key"]')` → `['key']`
5. The host calls the actual gateway function: `stateManager.get('key')`
6. The return value is JSON-encoded with a `\x01` prefix: `'\x01{"count":"5"}'` (all non-null/undefined returns use this encoding to prevent user data containing control characters from being misinterpreted as protocol markers)
7. The isolate-side `wrap()` detects the `\x01` prefix and `JSON.parse`s the result

**Return value encoding:**

| Prefix | Meaning | Example |
|---|---|---|
| `\x01` | JSON-encoded return value from gateway method (any type) | `'\x01"hello"'`, `'\x01["a","b"]'`, `'\x0142'` |
| `\x02` | JSON-encoded contract return value (from CONTRACT_WRAPPER) | `'\x02{"count":"5"}'` |
| `\x03` | Typed error encoding | `'\x03REVERT:not enough tokens'` |

**Error encoding:**

When a gateway method throws a typed error, the `bridge()` wrapper catches it and re-throws with a type prefix so `_classifyError` can identify it after the error loses its class crossing the boundary:

| Error Type | Encoded Message |
|---|---|
| `ContractRevertError` | `\x03REVERT:<reason>` |
| `GasExhaustedError` | `\x03GAS:<used>:<ceiling>` |

**Error classification hardening:** To prevent contracts from spoofing error types by throwing `new Error('\x03GAS:...')` directly, `_classifyError` verifies the `\x03` prefix against authoritative state: `\x03GAS` is only trusted when `gasTracker.used > gasTracker.ceiling`, and `\x03REVERT` is only trusted when the gateway's `revert()` or `require()` function was actually called (tracked via an execution context flag). Unverified `\x03`-prefixed errors fall through to generic error classification.

### Why Not ExternalCopy?

`ivm.ExternalCopy` can clone plain data objects across the boundary, but it cannot clone function closures. The math API (`buildMathAPI()`) returns functions wrapped in `safeMath()` closures, making `ExternalCopy` fail with "could not be cloned". The JSON bridge avoids this by injecting each math method as an individual `bridge()` Reference.

## AST-Based Gas Metering

The VM uses deterministic, structure-based gas metering rather than wall-clock timing. Before execution, the contract source is transformed in three phases:

### Phase 1: Control Flow Injection

The AST is walked with `acorn-walk` and `__gas(1)` calls are injected at:

- **Function entry** — declarations, expressions, and arrow functions (after directive prologue)
- **Loop iterations** — `for`, `while`, `do-while`, `for-in`, `for-of` (top of body). Indexed `for` loops additionally inject a charge into the update expression (`for (…; i++)` → `for (…; (__gas(1), i++))`), so each `for` iteration costs **2 × `VM_COMPUTATION`** (body + update) while `while`/`do-while`/`for-in`/`for-of` cost 1×
- **Branches** — `if`/`else` blocks, `switch` cases (non-empty), ternary operators (wraps test)
- **Exception handling** — `try`, `catch`, `finally` blocks
- Single-statement bodies are wrapped in `BlockStatement` to safely prepend the gas call

### Phase 2: Deep Binary Expression Handling

Binary expression chains deeper than 10 levels (e.g., `a + b + c + d + ...` with 11+ terms) get a gas injection at the depth-10 boundary. This prevents deeply nested expressions from consuming unbounded computation without being metered.

### Phase 3: Call Expression Injection

Every `CallExpression` (except `__gas` calls themselves) is wrapped as `(__gas(1), originalCall())`. This uses `acorn-walk.ancestor` to find the parent node and replace the call in-place.

The injected `__gas()` function is an `ivm.Reference` callback that calls `GasTracker.chargeComputation()` on the host side, with typed error encoding for `GasExhaustedError`.

## Sandbox Security

The V8 isolate provides hardware-level isolation (separate heap, no shared objects). The sandbox script runs inside the isolate before any contract code and strips non-deterministic APIs:

**Stripped:**
- Timers: `Date`, `setTimeout`, `setInterval`, `setImmediate`, `clearTimeout`, `clearInterval`, `clearImmediate`
- Async: `queueMicrotask`
- Memory: `WeakRef`, `FinalizationRegistry`
- Proxies: `Proxy`
- Network: `fetch`, `XMLHttpRequest`, `WebSocket`
- Concurrency: `SharedArrayBuffer`, `Atomics`
- Eval/constructors: `eval`, `Function` (global reference set to `undefined`)
- System: `console`, `process`, `require`, `importScripts`

**Preserved:**
- `Array`, `Object`, `String`, `Number`, `Boolean`, `BigInt`, `JSON`, `Map`, `Set`, `Symbol`, `Error`, `RegExp`, `parseInt`, `parseFloat`

**Replaced:**
- `Math` — replaced with a frozen deterministic subset: `floor`, `ceil`, `round`, `abs`, `min`, `max`, `sqrt`, `pow`, `sign`, `trunc`, `log`, `log2`, `log10`, plus constants `PI` and `E`. The object is frozen with `Object.freeze()` to prevent mutation.

### Function Constructor Preservation

The sandbox strips `Function` from the global scope and kills `Function.prototype.constructor` to prevent escape via `new Function('return process')()`. However, the CONTRACT_WRAPPER needs `Function` to compile contract code. The sandbox saves a private reference as `globalThis.__Function` before stripping. The contract wrapper consumes and deletes this reference immediately, so contract code never has access to it.

## Compilation Cache

The VM maintains a per-block compilation cache to avoid redundant V8 compilation for contracts called multiple times in the same block:

- `vm.beginBlock()` — initializes a new `Map` for the cache
- `vm.endBlock()` — clears the cache

**Cache key:** `contractIndex:codeHash` where `codeHash` is the SHA-256 of the original (pre-metering) source code.

**Cache value:** V8 cached compilation data extracted via `script.createCachedData()`. On cache hit, this data is passed to `compileScriptSync()` to skip full compilation.

**Cache bound:** The cache is limited to `maxBlockCacheSize` entries (default 1,000) per block. When the limit is reached, new unique contracts skip the cache but still execute normally. This prevents memory exhaustion from blocks with thousands of unique contracts.

This eliminates redundant compilation for hot contracts (e.g., a popular AMM called 50 times in one block).

## Contract Wrapper

The CONTRACT_WRAPPER script runs the contract code inside the isolate and routes method calls:

1. Creates a `module` and `exports` object
2. Uses the preserved `__Function` reference to compile the metered contract code as a function body with `module`, `exports`, and `xchain` parameters
3. Executes the compiled function
4. Routes based on export type:
   - **Function export:** calls the function directly with `xchain` (method param is ignored)  
   - **Object export:** looks up the named method on the object, throws `'unknown method'` if not found  
   - **Other:** throws `'contract must export a function or object'`
5. JSON-serializes the return value with a `\x02` prefix before crossing the isolate boundary

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
