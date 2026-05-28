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

Two of the gateway namespaces extend this synchronous picture in important ways:

- **`xchain.attestation.*`** — lets a contract ask a question of the outside world (HTTPS, AI) and receive the answer back as a separate, validator-signed EXECUTE later. Asynchronous; see [Asking the Outside World](#asking-the-outside-world--the-attestation-framework).
- **`xchain.contract.*`** — lets a contract that declared itself stakeable read its own stakers and slash them. Synchronous; see [Stakeable Contracts](#stakeable-contracts).

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

### Oracle (100 gas each)
| Method | Returns |
|---|---|
| `xchain.oracle.getPrice(coinPair)` | Price data or null |
| `xchain.oracle.getPriceAtRound(coinPair, round)` | Historical price or null |
| `xchain.oracle.getSnapshotAge()` | Blocks since last snapshot (number) |

### Cross-Chain (100 gas each)
| Method | Returns |
|---|---|
| `xchain.crossChain.getAttestation(chain, actionIndex)` | Attestation data or null |
| `xchain.crossChain.isSettled(chain, actionIndex)` | Boolean |

### External Attestation — asking the outside world (see [framework section below](#asking-the-outside-world--the-attestation-framework))
| Method | Gas | Description |
|---|---|---|
| `xchain.attestation.request(providerId, payload, callback, params, opts)` | 500 + provider escrow | Emit an ATTEST v0 request. Returns a deterministic 64-hex `requestId`. The response arrives later as a separate EXECUTE invoking `callback`. |
| `xchain.attestation.getResponse(requestId)` | 100 | Read a previously-stored response by request id. Returns `null` until the request is fulfilled. |

### Contract-Targeted Staking — readable + slashable from inside the staked-against contract (see [stakeable contracts section below](#stakeable-contracts))
| Method | Gas | Description |
|---|---|---|
| `xchain.contract.getStake(pubkey, token)` | 100 | Sum of active stake for `(pubkey, token)` targeting this contract. Returns `'0'` if none. |
| `xchain.contract.getTotalStaked(token)` | 100 | Total active stake of `token` across all stakers of this contract. |
| `xchain.contract.getStakers(token)` | 100 | Top stakers of `token` on this contract — `[{pubkey, amount}, ...]`, sorted descending, capped at 1000. |
| `xchain.contract.slash(pubkey, token, amount)` | 500 | Slash `amount` of `token` from one staker on this contract. Routed to the deploy-time `SLASH_DESTINATION`. Authorization is implicit. |

## Deterministic Execution

The VM guarantees identical results on every indexer node replaying the same block. This is achieved by:

- **Sandboxed V8 isolates** — contracts run in `isolated-vm` with a separate heap. No access to the host process, filesystem, or network.
- **Non-deterministic APIs stripped** — `Date`, `Math.random`, `setTimeout`, `setInterval`, `process`, `require`, `eval`, `Function`, `fetch`, `WeakRef`, `FinalizationRegistry`, `Proxy`, `SharedArrayBuffer`, `Atomics`, `queueMicrotask` are all removed. A deterministic `Math` subset (floor, ceil, round, abs, min, max, sqrt, pow, sign, trunc, log, log2, log10, plus constants PI and E) is preserved and frozen.
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
| State key size | 1 KB per key |
| State value size | 64 KB per value |
| Code size | 64 KB per contract |
| Log entries | 100 per execution (1 KB each) |

Gas is the primary execution bound. The wall-clock timeout exists only as a safety net for gas metering bugs — it should never trigger under normal operation.

## Asking the Outside World — The Attestation Framework

Most smart contract platforms can only see data already on-chain. XChain contracts can ask the outside world a question — an HTTPS endpoint, an AI prompt, anything a governance-approved provider knows how to answer — and receive a verified answer back on-chain.

This is built on two ideas. First, the contract doesn't talk to the outside world directly — the **validator network** does it on the contract's behalf. Second, no single validator's answer is trusted by itself; multiple validators fetch the answer independently and the network agrees on the result before it's written to the chain. The result is that the answer is reproducible — anyone replaying the chain arrives at the same outcome — even though the underlying fetch isn't.

### The Request → Callback Model

A smart contract can't pause and wait for an answer (the VM is synchronous, gas-bounded, and runs in a single block). So attestation uses an **asynchronous request-and-callback** pattern:

```
Block N:  Contract method calls xchain.attestation.request(...)
              → Emits ATTEST v0 (request) — contract method returns immediately

Block N+1..N+deadline:  Validators with the 'attestation' capability
                        each fetch the answer independently via the provider
                        → They gossip proposals and agree on the canonical response
                        → Leader broadcasts ATTEST v1 (response) with everyone's signatures

Some block N+k:  Indexer accepts the ATTEST v1
                 → Synthesizes a fresh EXECUTE calling the contract's callback method
                 → Callback receives: (requestId, providerId, status, response, ...originalParams)

If no v1 by the deadline:  Indexer synthesizes ATTEST v2 (expire)
                            → Callback fires anyway with status='expired'
```

The contract's first method (the one that called `request`) returns synchronously; its work in that block is done. The callback method runs in a separate EXECUTE later, when the answer is available. The callback runs as if the contract were calling itself — `xchain.getSourceAddress()` returns the contract's own derived address.

The platform always invokes the callback exactly once per request — on success, on provider error, or on expiry. A contract never has to poll, never has to clean up stale requests, and never gets a "no answer" silently.

### Providers

The set of providers is governance-controlled. Two ship in the initial release:

| Provider | What it does | Payload | Validator consensus |
|---|---|---|---|
| `http_get` | Fetches an HTTPS URL and returns the response body | URL string | Exact byte-equality across validators |
| `llm` | Sends a prompt to an approved language model | JSON envelope: `{prompt, max_tokens?, system?}` | Judge-model decides whether validators' answers mean the same thing |

The contract sends a string payload; the provider tells the validators how to interpret it. From the contract's point of view, the difference between providers is just the payload format and the consensus strategy. New providers can be added by governance without changing the contract API.

### Validator Consensus, in Plain Terms

The `redundancy` option in `xchain.attestation.request(..., { redundancy: N })` controls how many independent validators must agree before the response is written to chain. Three values are allowed:

- **`redundancy: 1`** — the cheapest path. One validator's answer becomes the final answer. No agreement round, no PBFT, no judge. Right for non-critical queries where speed and cost matter more than independent verification.
- **`redundancy: 3` or `5`** — multiple validators fetch independently. They exchange proposals and agree on a canonical answer. For `http_get`, "agree" means exact byte equality. For `llm`, a separate judge model decides whether the candidates are semantically equivalent. If quorum can't be reached the request expires on its deadline.

Higher redundancy doesn't change the API the contract sees — the callback signature is identical regardless. It just changes the trust model of the answer and the fee the request escrows.

### Worked Example: AI-Judged Yes/No

```javascript
module.exports = {
    askIsTrue: function(xchain) {
        var statement = xchain.getInputParam(0);   // e.g. "the sky is blue"

        xchain.attestation.request(
            'llm',
            JSON.stringify({
                prompt: 'Reply with only "1" if the following statement is true, "0" otherwise. Statement: ' + statement,
                max_tokens: 4
            }),
            'handleVerdict',
            [xchain.getSourceAddress(), statement],   // echoed back to handleVerdict
            { redundancy: 3, deadlineBlocks: 20 }
        );
    },

    handleVerdict: function(xchain) {
        var requestId      = xchain.getInputParam(0);
        var providerId     = xchain.getInputParam(1);
        var status         = xchain.getInputParam(2);   // 'ok' | 'expired' | 'no_quorum' | 'provider_error' | 'timeout'
        var response       = xchain.getInputParam(3);
        var originalCaller = xchain.getInputParam(4);
        var statement      = xchain.getInputParam(5);

        if (status !== 'ok') {
            xchain.log('verdict unavailable: ' + status);
            return;
        }

        var verdict = response.trim() === '1' ? 'true' : 'false';
        xchain.state.set('verdict_' + originalCaller, verdict);
        xchain.log(statement + ' → ' + verdict);
    }
};
```

The `askIsTrue` method emits ATTEST v0 and returns. A handful of blocks later, the validator network agrees on the model's answer (or fails to agree, in which case the request expires), and the indexer synthesizes a fresh EXECUTE invoking `handleVerdict`. The contract's verdict is then recorded in state.

### Cost Model

Each request escrows the provider's `per_call_base_fee_xchain` at emission time (LLM: 0.50 XCHAIN; http_get: 0.01 XCHAIN — governance can change these). On `ok`, the escrow is paid out to the responding validators. On expiry, the escrow currently sits — refund/redistribution is a future economic phase.

Provider-level limits the contract should know about:
- **`max_request_bytes`** — payload size cap (LLM and http_get: 8192). Enforced both by the VM (8192 platform cap) and the indexer (per-provider cap).
- **`allowed_redundancy`** — which `[1, 3, 5]` values the provider supports.
- **`deadline_window_blocks`** — how far in the future the deadline can be (per-provider cap; VM accepts [1, 100]).

### Limitations and Notes

- **Asynchronous only.** A contract cannot block on a result; it must continue and react in the callback.
- **One callback per request, eventually.** Either the response, or expiry. Never both, never silent.
- **Body size on response.** `RESPONSE_PAYLOAD` is UTF-8 inline in ATTEST v1 — large binary bodies are out of scope.
- **`getResponse(requestId)` is read-only.** It returns the previously-stored response after the callback has already fired, useful for contracts that want to revisit a past answer from a different method.

For the wire-level lifecycle see [`protocol/actions/ATTEST.md`](../protocol/actions/ATTEST.md); for provider-specific payloads see [`protocol/providers/`](../protocol/providers/).

## Stakeable Contracts

A contract can declare itself **stakeable** at deploy time. Anyone can then lock any token, on any chain, against the contract. The contract's own code decides what staking unlocks — access, voting weight, a share of rewards, qualification for something — and the contract can slash any of its stakers' locked tokens at any time. This is a general-purpose primitive for backing on-chain commitments with value.

This is layered above the existing capability-based validator staking (which is for hub validators only, XCHAIN-only, and uses different action versions). The two systems share no state — a pubkey staked in one does not count toward the other.

### Declaring a Contract Stakeable

Two fields, both optional, both locked permanently at deploy time:

| Field | Notes |
|---|---|
| `COOLDOWN_BLOCKS` | How long a staker waits between calling UNSTAKE and getting their tokens back. Bounded `[1, 100000]`. Omit to make the contract non-stakeable. |
| `SLASH_DESTINATION` | Where slashed tokens go — a specific address, or the keyword `BURN`. Defaults to `BURN` if cooldown is set without a destination. |

Both fields are immutable from deployment forward. Neither the contract author nor anyone else can change them. Stakers can audit both before locking anything up — they know the cooldown, they know the slash destination, they know what the contract's code does.

### Reading Stake State from Inside

```javascript
// What has this specific pubkey staked, in XCHAIN, against THIS contract?
var amount = xchain.contract.getStake(pubkey, 'XCHAIN');

// What is the total stake of XCHAIN across everyone, on THIS contract?
var total = xchain.contract.getTotalStaked('XCHAIN');

// Who are the top stakers of XCHAIN here?
var stakers = xchain.contract.getStakers('XCHAIN');
// → [{ pubkey: '...64hex...', amount: '500' }, ...]
```

`getStakers` is capped at the top 1000 entries — a contract should design its rules so it doesn't need to iterate every staker. Pre-activation stakes (within the 6-block activation window after STAKE) are not yet visible.

### Slashing

```javascript
xchain.contract.slash(pubkey, 'XCHAIN', '50');
```

- The slash can only target stakers of **this** contract. The accessor is scoped to the executing contract; cross-contract slashing isn't possible.
- Slashed tokens go to the destination locked at deploy time.
- The slash reaches active stakes first; if there's a remainder, it pulls from any cooldown-queued balance the staker has already begun withdrawing. (Stakers can't escape an imminent slash by unstaking.)
- Over-slash is silently capped at the staker's available balance — no error if you ask for more than they have.
- Atomic with the calling EXECUTE: if the method reverts after the slash, the slash rolls back too.

### What This Enables

- **Prediction markets** — participants stake tokens to back their claims; the contract slashes wrong ones and pays out correct ones from the slashed pool.
- **Security bonds** — a service operator stakes tokens as a deposit; users get paid from that bond if the service misbehaves.
- **Validator-style services on top of XChain** — a contract can run its own internal validator set (for a sidechain bridge, a relay, a federated oracle) backed by stake on any chain.
- **Reputation games** — communities stake against their own predictions or moderation decisions; reputation is calibrated by what gets slashed.
- **Conditional escrow with teeth** — two parties stake against a deal; an arbitrator (or [an AI judge](#asking-the-outside-world--the-attestation-framework)) decides if the deal was kept and slashes accordingly.
- **DAO membership locks** — members stake to participate; the DAO's contract slashes for spam or rule-breaking.

For the wire format, isolation rules, cooldown sweep behavior, and the on-chain `slash_events` table, see [`protocol/Contract_Staking.md`](../protocol/Contract_Staking.md).

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

**Programmable token logic:**
- **Conditional logic** — "Execute this SEND only if the caller holds at least 1000 of token X"
- **Token vesting** — Automatically release tokens on a schedule based on block height
- **Automated market makers** — Continuous-pricing liquidity pools using constant-product formulas
- **Multi-condition escrow** — Release funds when multiple conditions are met
- **Governance (DAOs)** — Token-weighted voting with on-chain proposal and execution
- **Cross-chain orchestration** — Combined with the hub, contracts can coordinate actions across chains

**Reaching the outside world** (via [the Attestation Framework](#asking-the-outside-world--the-attestation-framework)):
- **AI-judged contests, ranking, and moderation** — submit prompts to an approved language model and act on the verdict
- **Real-world data triggers** — insurance, parametric payouts, and prediction-market settlement driven by an HTTPS feed
- **News-sensitive treasuries** — adjust holdings based on AI summaries of headlines or social signals
- **Translation, classification, summarization** — any task that needs a model's judgment at machine speed
- **Dispute resolution** — submit both sides' claims to an AI judge and act on the verdict

**Bonded commitments and stake-backed services** (via [Stakeable Contracts](#stakeable-contracts)):
- **Prediction markets** — participants stake their predictions; wrong ones get slashed and redistributed
- **Security bonds** — service operators stake a deposit that pays users out on misbehavior
- **Validator-style services on top of XChain** — contracts run their own internal validator sets, backed by stake on any chain
- **Reputation games** — communities stake against their own decisions; reputation is calibrated by what gets slashed
- **DAO membership locks** — members stake to participate; bad-faith behavior is slashed by code

## Related

- [Gas and Fees](GAS.md) — gas economics for VM execution
- [ACTIONs](ACTIONS.md) — the platform actions that contracts orchestrate
- [Ledger](LEDGER.md) — the double-entry system that contracts interact with
- [DEPLOY Action](../protocol/actions/DEPLOY.md) — deploying a contract (including stakeable-contract metadata)
- [EXECUTE Action](../protocol/actions/EXECUTE.md) — calling a contract method
- [ATTEST Action](../protocol/actions/ATTEST.md) — the request/response/expire lifecycle behind `xchain.attestation.*`
- [LLM Provider](../protocol/providers/llm.md) — prompt envelope, approved models, judge-model consensus
- [Contract-Targeted Staking](../protocol/Contract_Staking.md) — wire spec for `xchain.contract.*`
- [Contract Development Guide](../developer-guide/Smart_Contract_Development.md) — writing and deploying contracts

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
