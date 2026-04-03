<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Smart Contracts

## Overview

The XChain Platform smart contract layer allows developers to deploy programmable logic on-chain. Unlike traditional smart contract platforms, XChain contracts cannot directly manipulate ledger state. Instead, they orchestrate the platform's existing ACTION commands — a contract can conditionally emit SENDs, MINTs, ORDERs, and any other ACTION, but every state change still flows through the same validated, audited action handlers used by regular transactions.

This design provides the expressiveness of a general-purpose programming language with the security guarantees of a fixed, battle-tested action set.

## What Makes This Different

Most blockchain platforms treat their virtual machine as the protocol itself. On Ethereum, for example, the EVM is the execution layer — smart contracts directly read and write storage slots, transfer balances, and create new contracts, all within a single monolithic state machine. The contract code *is* the protocol logic. This means every contract must correctly implement every safety check, and a bug in any contract can drain funds, corrupt state, or create tokens from thin air.

XChain takes a fundamentally different approach by **separating the smart contract layer from the protocol layer**. The protocol — the complete set of ACTION handlers (SEND, MINT, ISSUE, ORDER, DISPENSER, etc.) — exists as a fixed, validated rule engine inside the indexer. Smart contracts sit above this layer and can only interact with the ledger by emitting those same platform ACTIONs. A contract cannot credit a balance, move a token, or modify the order book directly. It must ask the protocol to do it, and the protocol applies the same validation rules it applies to any user-broadcast transaction.

In other words, XChain contracts are **orchestration logic**, not **state-mutation logic**.

### Benefits of This Separation

**Security through constraint.** A contract bug cannot bypass protocol rules. If the protocol says you cannot SEND more tokens than you hold, no contract can circumvent that — the emitted SEND will simply fail validation. The attack surface of a contract is limited to the logic within its own code; it cannot exploit the underlying ledger.

**Smaller audit surface.** Every state change on the platform flows through a known, finite set of ACTION handlers regardless of whether it was triggered by a user transaction or a contract. Auditing the protocol means auditing those handlers once. Contracts don't introduce new state-mutation paths — they compose existing ones.

**Protocol evolution without contract breakage.** Because contracts emit high-level ACTIONs rather than low-level state operations, the protocol team can optimize, patch, or extend action handlers without breaking deployed contracts. A performance improvement to the SEND handler benefits every contract that emits SENDs, automatically.

**Simpler contract development.** Contract authors don't need to implement token transfer logic, order matching, or balance accounting. They call `xchain.emit.send()` or `xchain.emit.order()` and the platform handles the rest. This dramatically reduces the surface area for developer error compared to platforms where contracts must manually manage storage slots and balance mappings.

**Deterministic composability.** Because contracts speak the same ACTION language as manual transactions, the output of a contract execution is indistinguishable from a sequence of user-broadcast actions. Explorers, indexers, and downstream tools don't need special handling for "contract-originated" vs. "user-originated" state changes — they're the same thing.

**Atomic rollback without partial state corruption.** If any emitted ACTION fails validation, the entire execution is rolled back — including state changes and all other emitted actions. Because the protocol validates actions as a batch after the VM returns (snapshot semantics), there is no risk of a contract observing partially-applied state mid-execution.

## How It Works

Contracts are written in JavaScript (ES2020) and deployed to the blockchain via the `DEPLOY` action. Once deployed, anyone can invoke a contract with an `EXECUTE` action, passing a method name and parameters. The contract runs inside a sandboxed V8 isolate within the indexer, reads platform state (balances, token info, block height), applies its logic, and emits zero or more platform ACTIONs in response. Those emitted actions are validated and executed through the same handlers as if a user had broadcast them directly.

```
User broadcasts EXECUTE action
    ↓
Indexer loads contract code + state from DB
    ↓
VM executes contract in sandboxed V8 isolate
    ↓
Contract reads state, does math, emits platform ACTIONs
    ↓
Each emitted ACTION validated and processed by existing handlers
    ↓
All succeed atomically, or all roll back
```

Contracts also maintain persistent key-value state across executions, enabling them to track conditions, accumulate data, and implement multi-step workflows.

## Contract Derived Addresses

Every deployed contract receives a **derived address** in the format `C:<CHAIN>:<action_index>` (e.g., `C:BTC:500`). This address participates in the standard balance system — contracts hold tokens at their derived address just like any other address in the ledger. There is no separate custody table.

- **DEPOSIT** credits the contract's derived address via standard credits/debits
- **WITHDRAW** debits the contract's derived address via standard credits/debits
- **Emitted actions** use the derived address as SOURCE — existing handlers see it as a regular address
- Cannot collide with real blockchain addresses (no valid base58 address starts with `C:`)
- Globally unique across chains — `C:BTC:500` and `C:DOGE:500` are distinct

## Contract Format

**Single-function contract:**
```javascript
module.exports = function(xchain) {
    // Contract logic — all methods share this single entry point
    var amount = xchain.getInputParam(0);
    xchain.emit.send({ destination: xchain.getSourceAddress(), tick: 'TOKEN', quantity: amount });
};
```

**Multi-method contract (recommended):**
```javascript
module.exports = {
    initialize: function(xchain) {
        xchain.state.set('owner', xchain.getSourceAddress());
        xchain.state.set('counter', '0');
    },
    increment: function(xchain) {
        var count = xchain.state.get('counter') || '0';
        count = xchain.math.add(count, '1');
        xchain.state.set('counter', count);
        return count;
    },
    getCount: function(xchain) {
        return xchain.state.get('counter');
    }
};
```

When `EXECUTE` is called with `method: 'increment'`, the VM loads the contract, finds the named method on the exported object, and calls it with the `xchain` gateway as the sole argument.

## The xchain Gateway

Every contract receives an `xchain` object providing access to platform data and operations:

### Context (0 gas)
| Method | Returns |
|---|---|
| `xchain.getBlockHeight()` | Current block height (number) |
| `xchain.getBlockTimestamp()` | Block timestamp in seconds (number) |
| `xchain.getBlockHash()` | Deterministic block hash (string) |
| `xchain.getSourceAddress()` | Address that sent the EXECUTE tx (string) |
| `xchain.getContractAddress()` | This contract's derived address (string) |
| `xchain.getInputParams()` | All method parameters (array of strings) |
| `xchain.getInputParam(i)` | Parameter at index i, or null (string) |
| `xchain.getInputParamCount()` | Number of parameters (number) |

### Ledger Queries (100 gas each)
| Method | Returns |
|---|---|
| `xchain.getBalance(address, tick)` | Balance of address for token, or null |
| `xchain.getTokenInfo(tick)` | Token metadata, or null |

### Contract State (metered)
| Method | Gas | Description |
|---|---|---|
| `xchain.state.get(key)` | 100 | Read a value, returns null if missing |
| `xchain.state.has(key)` | 100 | Check if key exists (boolean) |
| `xchain.state.set(key, value)` | 200 | Write a value (must be JSON-serializable) |
| `xchain.state.delete(key)` | 100 | Remove a key, returns true if existed |

### Action Emission (500 gas each)
| Method | Required Params |
|---|---|
| `xchain.emit.send(params)` | `destination`, `tick`, `quantity` |
| `xchain.emit.destroy(params)` | `tick`, `quantity` |
| `xchain.emit.issue(params)` | `tick` |
| `xchain.emit.mint(params)` | `tick`, `quantity` |
| `xchain.emit.order(params)` | `giveAmount`, `getAmount` |
| `xchain.emit.dispenser(params)` | — |
| `xchain.emit.dividend(params)` | `tick`, `dividendTick`, `quantity` |
| `xchain.emit.airdrop(params)` | `tick`, `quantity`, `listActionIndex` |
| `xchain.emit.callback(params)` | `tick` |
| `xchain.emit.file(params)` | — |
| `xchain.emit.list(params)` | — |
| `xchain.emit.coinpay(params)` | `orderMatchActionIndex` |
| `xchain.emit.sweep(params)` | `destination` |
| `xchain.emit.link(params)` | `coin1`, `coin1ActionIndex`, `coin2`, `coin2ActionIndex` |
| `xchain.emit.broadcast(params)` | — |
| `xchain.emit.message(params)` | `destination` |

### Deterministic Math
| Method | Description |
|---|---|
| `xchain.math.add(a, b)` | Addition (string → string) |
| `xchain.math.subtract(a, b)` | Subtraction |
| `xchain.math.multiply(a, b)` | Multiplication |
| `xchain.math.divide(a, b)` | Division (reverts on div by zero) |
| `xchain.math.mod(a, b)` | Modulo |
| `xchain.math.compare(a, b)` | Returns -1, 0, or 1 |
| `xchain.math.gt/gte/lt/lte/eq(a, b)` | Comparison (returns boolean) |
| `xchain.math.min/max(a, b)` | Minimum / maximum |
| `xchain.math.abs(a)` | Absolute value |
| `xchain.math.isZero(a)` | Check if zero (boolean) |

All math inputs and outputs are **strings**. This ensures deterministic precision using bignumber arithmetic. Native JavaScript arithmetic operators (`+`, `-`, `*`, `/`) use floating-point and may produce non-deterministic results across V8 versions.

### Control Flow (0 gas)
| Method | Description |
|---|---|
| `xchain.revert(reason)` | Abort execution with a reason string |
| `xchain.require(condition, reason)` | Abort if condition is falsy |

### Logging (0 gas, capped at 100 entries)
| Method | Description |
|---|---|
| `xchain.log(...args)` | Append to debug log (visible in execution record) |
| `xchain.isLogFull()` | Check if log cap reached |
| `xchain.getLogCount()` | Current log count |

### Oracle (100 gas each, stub until Track B)
| Method | Returns |
|---|---|
| `xchain.oracle.getPrice(coinPair)` | Price data or null |
| `xchain.oracle.getPriceAtRound(coinPair, round)` | Historical price or null |
| `xchain.oracle.getSnapshotAge()` | Blocks since last snapshot (number) |

### Cross-Chain (100 gas each, stub until Phase 4)
| Method | Returns |
|---|---|
| `xchain.crossChain.getAttestation(chain, actionIndex)` | Attestation data or null |
| `xchain.crossChain.isSettled(chain, actionIndex)` | Boolean |

## Deterministic Execution

The VM guarantees identical results on every indexer node replaying the same block. This is achieved by:

- **Sandboxed V8 isolates** — contracts run in `isolated-vm` with a separate heap. No access to the host process, filesystem, or network.
- **Non-deterministic APIs stripped** — `Date`, `Math.random`, `setTimeout`, `setInterval`, `process`, `require`, `eval`, `Function`, `fetch`, `WeakRef`, `FinalizationRegistry`, `Proxy` are all removed. A deterministic `Math` subset (floor, ceil, round, abs, min, max, sqrt) is preserved.
- **AST-based gas metering** — contract source is parsed with acorn, `__gas()` calls are injected at control flow points, and the source is regenerated. Gas charges are based on code structure, not wall-clock time.
- **String-only math** — all token amounts pass through `xchain.math.*` which wraps `mathjs` bignumber with string I/O. No floating-point at the gateway boundary.
- **Synchronous execution** — all isolated-vm APIs are synchronous. No event loop interleaving during contract execution.

### Snapshot Semantics

Emitted actions are queued during execution but NOT processed until after the VM returns. A contract cannot observe the effects of its own emissions — `getBalance()` and `getTokenInfo()` reflect the state at the start of execution. This is permanent for api_version 1.

## Bounded Execution

Every contract execution is bounded by hard limits:

| Resource | Default Limit |
|---|---|
| Gas ceiling | 1,000,000 per execution |
| Memory | 8 MB per isolate |
| Wall-clock timeout | 30 seconds (safety net only) |
| Emitted actions | 50 per execution |
| State keys | 10,000 per contract |
| State value size | 64 KB per value |
| Code size | 64 KB per contract |
| Log entries | 100 per execution (1 KB each) |

Gas is the primary execution bound. The wall-clock timeout exists only as a safety net for gas metering bugs — it should never trigger under normal operation.

## Error Handling

| Error Type | Result | State Changes |
|---|---|---|
| `xchain.revert(reason)` | `revert: <reason>` | Rolled back |
| Gas exhausted | `out_of_gas: used X of Y` | Rolled back |
| Wall-clock timeout | `timeout: wall-clock safety net triggered` | Rolled back |
| Runtime error (e.g., undefined variable) | `error: <message>` | Rolled back |

On any failure, all state changes and emitted actions are discarded. The caller is still charged gas up to the failure point. Debug logs are preserved for troubleshooting.

## API Versioning

Contracts declare their target API version via the `api_version` field in the DEPLOY action. Version 1 is the initial gateway as documented here. Future versions may add new methods, change gas costs, or modify behavior. Old contracts continue running against the API version they were deployed with.

## Contract Immutability

Deployed contracts are **immutable** in API version 1. There is no mechanism to update a contract's code after deployment. Developers who need upgradeability can implement a proxy pattern where the contract's logic delegates to a state-stored reference that an admin can update.

## What Contracts Enable

- **Conditional logic** — "Execute this SEND only if the caller holds at least 1000 of token X"
- **Token vesting** — Automatically release tokens on a schedule based on block height
- **Automated market makers** — Continuous-pricing liquidity pools using constant-product formulas
- **Multi-condition escrow** — Release funds when multiple conditions are met
- **Governance (DAOs)** — Token-weighted voting with on-chain proposal and execution
- **Cross-chain orchestration** — Combined with the hub, contracts can coordinate actions across chains

## Related

- [Gas and Fees](GAS.md) — gas economics for VM execution
- [ACTIONs](ACTIONS.md) — the platform actions that contracts orchestrate
- [Ledger](LEDGER.md) — the double-entry system that contracts interact with
- [DEPLOY Action](../protocol/actions/DEPLOY.md) — deploying a contract
- [EXECUTE Action](../protocol/actions/EXECUTE.md) — calling a contract method
- [Contract Development Guide](../developer-guide/SMART_CONTRACT_DEVELOPMENT.md) — writing and deploying contracts

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
