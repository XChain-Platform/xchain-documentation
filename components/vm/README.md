<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain VM Component

The `xchain-vm` module is a standalone JavaScript library that executes smart contracts in deterministic, sandboxed V8 isolates. It is the runtime engine for the XChain smart contract layer — everything else (the DEPLOY/EXECUTE action handlers, database tables, gas fee logic) lives in the indexer.

## What is xchain-vm

A pure function library. Takes contract code + state + inputs + block context. Returns new state + emitted actions + gas used. It has no awareness of the indexer, database, blockchain, or network. The indexer's `execute.js` handler is the bridge between the VM and the platform.

## Features

- **Deterministic execution** — identical results on every indexer node replaying the same block
- **V8 sandbox isolation** — contracts run in `isolated-vm` with a separate heap, no access to host process, filesystem, or network
- **AST-based gas metering** — `acorn` parses the source, injects `__gas()` at control flow points, `astring` regenerates — fully deterministic, not wall-clock
- **JSON bridge protocol** — host-side gateway functions communicate with the isolate via JSON-serialized arguments and type-prefixed return values
- **16 emittable action types** — SEND, DESTROY, ISSUE, MINT, ORDER, DISPENSER, DIVIDEND, AIRDROP, CALLBACK, FILE, LIST, COINPAY, SWEEP, LINK, BROADCAST, MESSAGE
- **Deterministic math** — `xchain.math.*` wraps mathjs bignumber with string I/O, no floating-point at the gateway boundary
- **Contract state management** — key-value store with dirty tracking, key count, key size, and value size limits
- **Deploy-time validation** — V8 syntax check, acorn metering pass, reserved identifier detection, float warnings
- **Per-block compilation cache** — V8 cached compilation data reused for hot contracts within a block

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Execution pipeline, internal components, JSON bridge protocol, gas metering, sandbox security, compilation cache |
| [Configuration](CONFIGURATION.md) | Constructor parameters, gas schedule, resource limits |
| [Operations](OPERATIONS.md) | Indexer integration, error classification, atomicity guarantees, troubleshooting |

## Installation

```bash
cd xchain-vm
npm install
```

`isolated-vm` requires native C++ compilation. On Debian/Ubuntu: `build-essential`, `python3`, `libnghttp2-dev`, `libicu-dev`, `libbrotli-dev`, `libc-ares-dev`.

## Quick Start

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
        maxCodeSize:       65536,
        maxStateKeySize:   1024,
        maxBlockCacheSize: 1000
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

## Scripts

| Command | Description |
|---|---|
| `npm test` | Unit tests (580 tests, 30s timeout) |
| `npm run test:all` | Unit + E2E tests (644 tests) |
| `npm run test:e2e` | E2E tests only (64 tests) |
| `npm run smoke` | Smoke tests (10 tests, < 5s) |
| `npm run test:fuzz` | Fuzz / property-based tests (86 tests) |
| `npm run test:chaos` | Chaos engineering tests (92 tests) |
| `npm run test:regression:smoke` | P0 regression — VM boot, sandbox, execution (11 tests, < 50ms) |
| `npm run test:regression:core` | P0+P1 regression — + security, atomicity, determinism (45 tests, < 200ms) |
| `npm run test:regression:full` | P0-P3 regression — full functional + integration (152 tests, < 1s) |
| `npm run test:regression:nightly` | Regression + E2E + fuzz + chaos phase 1 |
| `npm run test:regression:release` | All tests + mutation testing |
| `npm run mutation` | Mutation testing (Stryker, full suite) |
| `npm run bench:quick` | Pipeline + gateway benchmarks |

**Total: 974 tests** across unit, E2E, security, fuzz, chaos, boundary, regression, and smoke.

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `isolated-vm` | V8 isolate sandbox (native C++ module) |
| `mathjs` | Deterministic bignumber arithmetic |
| `acorn` | JavaScript parser for AST-based gas injection |
| `acorn-walk` | AST walker |
| `astring` | AST-to-source code generator |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test framework |
| `fast-check` | Property-based / fuzz testing |
| `@stryker-mutator/core` | Mutation testing framework |

## Related

- [Smart Contracts Concept](../../concepts/Smart_Contracts.md) — gateway API reference, contract format, deterministic execution model
- [Contract Development Guide](../../developer-guide/Smart_Contract_Development.md) — writing, deploying, and debugging contracts
- [Gas and Fees](../../concepts/GAS.md) — gas economics, fee schedule, XCHAIN token
- [Indexer Architecture](../indexer/ARCHITECTURE.md) — how the indexer integrates the VM
- [DEPLOY Action](../../protocol/actions/DEPLOY.md) — deploying a contract
- [EXECUTE Action](../../protocol/actions/EXECUTE.md) — calling a contract method

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
