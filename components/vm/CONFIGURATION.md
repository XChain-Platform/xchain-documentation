<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain VM — Configuration Reference

## Constructor Parameters

The VM is configured at instantiation via a single config object:

```javascript
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
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `gasSchedule` | object | (required) | Per-operation gas costs (see Gas Schedule below) |
| `gasCeiling` | number | `1000000` | Maximum gas allowed per single contract execution |
| `limits` | object | (see below) | Resource limits for isolate execution |

The VM has no environment variables, configuration files, or runtime reconfiguration. All settings are fixed at construction time by the indexer.

## Gas Schedule

The gas schedule defines the cost of each metered operation. These values are set by the indexer's unified gas fee configuration and passed to the VM at construction.

| Operation | Key | Cost | Description |
|---|---|---|---|
| Computation | `VM_COMPUTATION` | 1 | Charged at each `__gas()` injection point (loop iterations, branches, function calls). Indexed `for` loops are charged **twice per iteration** — see note below |
| State read | `VM_STATE_READ` | 100 | `state.get()`, `state.has()`, `getBalance()`, `getTokenInfo()`, `attestation.getResponse()`, `contract.getStake()`, `contract.getTotalStaked()`, `contract.getStakers()` |
| State write | `VM_STATE_WRITE` | 200 | `state.set()` |
| State delete | `VM_STATE_DELETE` | 100 | `state.delete()` |
| Oracle read | `VM_ORACLE_READ` | 100 | `oracle.getPrice()`, `oracle.getPriceAtRound()` |
| Cross-chain read | `VM_CROSSCHAIN_READ` | 100 | `crossChain.getAttestation()`, `crossChain.isSettled()`, `crossChain.getCallResult()` |
| Action emission | `VM_EMISSION` | 500 | Each `emit.*()` call (SEND, MINT, ORDER, etc.); also charged on `attestation.request()` and `contract.slash()` |
| Attestation request | `VM_ATTEST_REQUEST` | 5000 | Additional fee on top of `VM_EMISSION` for `attestation.request()` — reflects the validator-network work that backs the eventual response |
| Cross-chain call request | `VM_XCALL_REQUEST` | 2000 | Additional fee on top of `VM_EMISSION` for `emit.crossExecute()` — the federation relay work. The call also pre-pays its remote `gasLimit` plus `VM_XCALL_CALLBACK`, with **no refund** of unused remote gas |
| Cross-chain callback ceiling | `VM_XCALL_CALLBACK` | 20000 | Fixed gas ceiling the result/expiry callback runs against on the source chain, pre-paid at `emit.crossExecute()` time |

Context accessors (`getBlockHeight`, `getSourceAddress`, etc.), control flow (`revert`, `require`), and logging (`log`, `isLogFull`, `getLogCount`) are gas-free. `oracle.getSnapshotAge()` is also gas-free.

> **Indexed `for` loops cost 2 × `VM_COMPUTATION` per iteration.** The metering transform injects a charge at the top of the loop body *and* a second charge into the update expression — `for (…; i++)` is rewritten as `for (…; (__gas(1), i++))` — so each iteration is metered twice. A `for` loop of N iterations therefore costs `2 × N × VM_COMPUTATION`. `while`, `do-while`, `for-in`, and `for-of` loops have no update expression and cost `1 × VM_COMPUTATION` per iteration. Budget gas ceilings for indexed `for` loops accordingly.

## Resource Limits

| Parameter | Key | Default | Description |
|---|---|---|---|
| Gas ceiling | `gasCeiling` | 1,000,000 | Maximum gas per execution. Primary execution bound. |
| Max call depth | `maxCallDepth` (`VM_MAX_CALL_DEPTH`) | 4 | Maximum call depth for `emit.execute` trees. A user-submitted EXECUTE is depth 0; each `emit.execute` hop adds 1. |
| Min call gas | `minCallGas` (`VM_MIN_CALL_GAS`) | 5,000 | Minimum `gasLimit` per `emit.execute` call. Bounds call-tree fan-out: every call costs at least `VM_EMISSION + VM_MIN_CALL_GAS` out of the caller's budget. |
| CPU timeout | `maxCpuTimeMs` | 30,000 ms | Wall-clock timeout (safety net only — should never trigger under normal operation) |
| Memory | `maxMemory` | 8 MB | V8 isolate heap size limit. Exceeding triggers `out_of_memory` error. |
| Emissions | `maxEmissions` | 50 | Maximum platform actions a contract can emit per execution |
| State keys | `maxStateKeys` | 10,000 | Maximum key-value pairs a contract can store |
| State value size | `maxStateValueSize` | 65,536 bytes | Maximum size of a single state value (JSON-serialized) |
| State key size | `maxStateKeySize` | 1,024 bytes | Maximum size of a single state key (UTF-8 encoded) |
| Code size | `maxCodeSize` | 65,536 bytes | Maximum contract source code size (enforced at both deploy and execute) |
| Block cache size | `maxBlockCacheSize` | 1,000 entries | Maximum compiled script entries cached per block |

### Additional Internal Limits

These limits are hardcoded in the VM and not configurable:

| Limit | Value | Location |
|---|---|---|
| Log entries per execution | 100 | `collector.js` |
| Log entry size | 1,024 bytes UTF-8 (truncated with `...(truncated)` marker) | `collector.js` |
| Return value size | 65,536 bytes (truncated) | `index.js` |
| Throwaway isolate memory | 8 MB | `isolate.js`, `syntax.js` |
| Binary expression metering depth | 10 | `metering.js` |

## Bounded Execution Summary

| Resource | Limit | Enforcement |
|---|---|---|
| Gas | 1,000,000 per execution | `GasTracker` throws `GasExhaustedError` |
| Memory | 8 MB per isolate | `isolated-vm` kills isolate |
| Wall-clock time | 30 seconds | `script.runSync()` timeout parameter |
| Emitted actions | 50 per execution | `EmissionCollector` throws on overflow |
| State keys | 10,000 per contract | `StateManager.set()` throws on overflow |
| State key size | 1 KB per key | `StateManager.set()` / `delete()` throws on overflow |
| State value size | 64 KB per value | `StateManager.set()` throws on overflow |
| Code size | 64 KB per contract | Validated at deploy time and enforced at execution |
| Block cache | 1,000 entries per block | Excess entries skip cache (non-fatal) |
| Log entries | 100 per execution | `EmissionCollector.addLog()` silently drops |

Gas is the primary execution bound. The wall-clock timeout exists only as a safety net for gas metering bugs — it should never trigger under normal operation.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
