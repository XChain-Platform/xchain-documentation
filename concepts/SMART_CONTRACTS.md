<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Smart Contracts (Planned)

## Overview

The XChain Platform is planning a smart contract layer that will allow developers to deploy programmable logic on-chain. Unlike traditional smart contract platforms, XChain contracts cannot directly manipulate ledger state. Instead, they orchestrate the platform's existing 19 ACTION commands — a contract can conditionally emit SENDs, MINTs, ORDERs, and any other ACTION, but every state change still flows through the same validated, audited action handlers used by regular transactions.

This design provides the expressiveness of a general-purpose programming language with the security guarantees of a fixed, battle-tested action set.

## How It Works

Contracts are written in JavaScript and deployed to the blockchain via a new `DEPLOY` action. Once deployed, anyone can invoke a contract with an `EXECUTE` action, passing parameters. The contract runs inside a sandboxed VM within the indexer, reads platform state (balances, token info, block height), applies its logic, and emits zero or more platform ACTIONs in response. Those emitted actions are validated and executed through the same handlers as if a user had broadcast them directly.

```
User broadcasts EXECUTE action
    ↓
Indexer loads contract code + state
    ↓
VM executes contract in sandboxed isolate
    ↓
Contract emits platform ACTIONs (SEND, MINT, ORDER, etc.)
    ↓
Each emitted ACTION validated and processed by existing handlers
    ↓
All succeed atomically, or all roll back
```

Contracts also maintain persistent key-value state across executions, enabling them to track conditions, accumulate data, and implement multi-step workflows.

## Bounded Execution

The VM uses **bounded execution** rather than unbounded Turing-complete computation. Contracts are standard JavaScript, but execution is constrained by hard limits on CPU time, memory, emitted actions, and state size. This guarantees that every contract execution terminates within predictable resource bounds — eliminating the gas estimation uncertainty common in other platforms.

Every indexer node that replays the blockchain will produce identical results, preserving the platform's core property of deterministic state.

## What Contracts Enable

Contracts unlock use cases that are impossible with individual ACTION transactions:

- **Conditional logic** — "Execute this SEND only if the caller holds at least 1000 of token X"
- **Token vesting** — Automatically release tokens on a schedule based on block height
- **Automated market makers** — Continuous-pricing liquidity pools using constant-product formulas, going beyond the fixed-price ORDER and DISPENSER actions
- **Multi-condition escrow** — Release funds when multiple independent conditions are met (oracle confirmation, time elapsed, multi-party approval)
- **Governance (DAOs)** — Token-weighted voting with on-chain proposal and execution
- **Cross-chain orchestration** — Combined with the [decentralized hub](../components/hub/DECENTRALIZATION.md), contracts could coordinate actions across multiple chains

## Security Model

- **Action Gateway** — Contracts can only affect ledger state through the existing ACTION system. There is no raw state access or escape hatch.
- **Caller attribution** — Every emitted action is tagged with the contract's address. Contracts cannot impersonate other addresses.
- **Validation reuse** — Emitted actions pass through the same validation logic as user-broadcast actions. A contract cannot emit an invalid SEND.
- **Atomicity** — If any emitted action fails, the entire contract execution rolls back.
- **No recursion (initially)** — Contract execution cannot trigger other contracts within the same block, preventing reentrancy attacks. Cross-contract calls are planned for a later phase with a call-depth limit.
- **Deterministic sandbox** — No network access, no filesystem, no randomness, no timers. The only inputs are block context, contract state, and caller parameters.

## Implementation Phases

| Phase | Scope |
|---|---|
| **Phase 0** | Foundation — VM runtime integration into the indexer, DEPLOY action |
| **Phase 1** | Read-only contracts — can query state but cannot emit actions |
| **Phase 2** | Limited state-mutating contracts — can emit a subset of actions (SEND, DESTROY) |
| **Phase 3** | Full action set — contracts can emit any of the 19 ACTION types |
| **Phase 4** | Cross-contract calls, hub integration, advanced features |

Future evolution includes TypeScript support (compiled to JS at deploy time), an optional WebAssembly backend for higher-performance contracts, and zero-knowledge proof verification.

## Status

The smart contract VM is in the design phase. The full architecture plan, including detailed execution models, gas economics, database schema, and security analysis, is maintained internally.

## Related

- [ACTIONs](ACTIONS.md) — the 19 platform actions that contracts orchestrate
- [Metalayer](METALAYER.md) — how XChain runs above existing blockchains
- [Security Model](SECURITY_MODEL.md) — platform trust assumptions and safety guarantees
- [Ledger](LEDGER.md) — the double-entry system that contracts interact with through emitted actions

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
