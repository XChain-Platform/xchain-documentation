<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain VM Component

The `xchain-vm` module is a standalone JavaScript library that executes smart contracts in deterministic, sandboxed V8 isolates. It is the runtime engine for the XChain smart contract layer, everything else (the DEPLOY/EXECUTE action handlers, database tables, gas fee logic) lives in the indexer.

## What is xchain-vm

A pure function library. Takes contract code + state + inputs + block context. Returns new state + emitted actions + gas used. It has no awareness of the indexer, database, blockchain, or network. The indexer's `execute.js` handler is the bridge between the VM and the platform.

## Features

- **Deterministic execution**: identical results on every indexer node replaying the same block
- **V8 sandbox isolation**: contracts run in `isolated-vm` with a separate heap, no access to host process, filesystem, or network
- **AST-based gas metering**: `acorn` parses the source, injects `__gas()` at control flow points, `astring` regenerates, fully deterministic, not wall-clock
- **JSON bridge protocol**: host-side gateway functions communicate with the isolate via JSON-serialized arguments and type-prefixed return values
- **19 emittable action types**: SEND, DESTROY, ISSUE, MINT, ORDER, DISPENSER, DIVIDEND, AIRDROP, CALLBACK, FILE, LIST, COINPAY, SWEEP, LINK, BROADCAST, MESSAGE, VOTE, plus `emit.execute` (cross-contract call) and `emit.crossExecute` (cross-chain call via XCALL)
- **External attestation gateway**: `xchain.attestation.request(...)` and `getResponse(...)`. Contracts ask an HTTPS endpoint or an approved LLM, and the validator network writes a signed answer back on-chain that re-enters the contract through a callback. See [Smart Contracts; Attestation Framework](../../concepts/smart-contracts.md#asking-the-outside-world-the-attestation-framework).
- **Contract-targeted staking gateway**: `xchain.contract.getStake`, `getTotalStaked`, `getStakers`, `slash`. Any contract can declare itself stakeable at deploy time and slash its own stakers per its own rules. See [Smart Contracts; Stakeable Contracts](../../concepts/smart-contracts.md#stakeable-contracts).
- **Deterministic math**: `xchain.math.*` wraps mathjs bignumber with string I/O, no floating-point at the gateway boundary
- **Contract state management**: key-value store with dirty tracking, key count, key size, and value size limits
- **Deploy-time validation**: V8 syntax check, acorn metering pass, reserved identifier detection, float warnings
- **Per-block compilation cache**: V8 cached compilation data reused for hot contracts within a block

## Documentation

| Document | Description |
|---|---|
| [Architecture](architecture.md) | Execution pipeline, internal components, JSON bridge protocol, gas metering, sandbox security, compilation cache |
| [Configuration](configuration.md) | Constructor parameters, gas schedule, resource limits |
| [Operations](operations.md) | Indexer integration, error classification, atomicity guarantees, troubleshooting |

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
    code:               contractCode,
    state:              contractState,
    method:             methodName,
    params:             ['arg1', 'arg2'],
    caller:             sourceAddress,
    contractAddress:    'C:BTC:500',
    contractIndex:      500,                   // backs request-id derivation + slash auth
    txHash:             'txhash...',           // backs request-id derivation
    blockContext:       { height: 100, timestamp: 1700000000, hash: 'blockhash' },
    balances:           addressBalances,
    tokenInfo:          tokenInfoMap,
    oracleData:         oracleAccessor,
    crossChainData:     crossChainAccessor,
    attestationData:    attestationAccessor,    // backs xchain.attestation.getResponse
    contractStakeData:  contractStakeAccessor   // backs xchain.contract.*; scoped to THIS contract
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
| `npm test` | Unit tests (500+ tests, 30s timeout) |
| `npm run test:all` | All suites (2,028 tests) |
| `npm run test:e2e` | E2E tests only (64 tests) |
| `npm run smoke` | Smoke tests (10 tests, < 5s) |
| `npm run test:fuzz` | Fuzz / property-based tests (53 tests) |
| `npm run test:chaos` | Chaos engineering tests (76 tests) |
| `npm run test:regression:smoke` | P0 regression; VM boot, sandbox, execution (11 tests, < 50ms) |
| `npm run test:regression:core` | P0+P1 regression: + security, atomicity, determinism (31 tests, < 200ms) |
| `npm run test:regression:full` | P0-P3 regression: full functional + integration (100+ tests, < 1s) |
| `npm run test:regression:nightly` | Regression + E2E + fuzz + chaos phase 1 |
| `npm run test:regression:release` | All tests + mutation testing |
| `npm run mutation` | Mutation testing (Stryker, full suite) |
| `npm run bench:quick` | Pipeline + gateway benchmarks |

**Total: 2,028 tests** (measured 2026-07-27) across unit, E2E, security, fuzz, chaos, boundary, regression, and smoke.

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

- [Smart Contracts Concept](../../concepts/smart-contracts.md): gateway API reference, contract format, deterministic execution model, attestation framework, stakeable contracts
- [Contract Development Guide](../../developer-guide/smart-contract-development.md): writing, deploying, and debugging contracts
- [Gas and Fees](../../concepts/gas.md): gas economics, fee schedule, XCHAIN token
- [Indexer Architecture](../indexer/architecture.md): how the indexer integrates the VM
- [DEPLOY Action](../../protocol/actions/deploy.md): deploying a contract (including stakeable-contract metadata)
- [EXECUTE Action](../../protocol/actions/execute.md): calling a contract method
- [ATTEST Action](../../protocol/actions/attest.md): request/response/expire lifecycle behind `xchain.attestation.*`
- [LLM Provider](../../protocol/providers/llm.md): prompt envelope, approved models, judge-model consensus
- [Contract-Targeted Staking](../../protocol/contract-staking.md): wire spec for `xchain.contract.*`

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
