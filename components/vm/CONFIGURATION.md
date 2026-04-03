<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

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
        maxCodeSize:       65536
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
| Computation | `VM_COMPUTATION` | 1 | Charged at each `__gas()` injection point (loop iterations, branches, function calls) |
| State read | `VM_STATE_READ` | 100 | `state.get()`, `state.has()`, `getBalance()`, `getTokenInfo()` |
| State write | `VM_STATE_WRITE` | 200 | `state.set()` |
| State delete | `VM_STATE_DELETE` | 100 | `state.delete()` |
| Oracle read | `VM_ORACLE_READ` | 100 | `oracle.getPrice()`, `oracle.getPriceAtRound()` |
| Cross-chain read | `VM_CROSSCHAIN_READ` | 100 | `crossChain.getAttestation()`, `crossChain.isSettled()` |
| Action emission | `VM_EMISSION` | 500 | Each `emit.*()` call (SEND, MINT, ORDER, etc.) |

Context accessors (`getBlockHeight`, `getSourceAddress`, etc.), control flow (`revert`, `require`), and logging (`log`, `isLogFull`, `getLogCount`) are gas-free. `oracle.getSnapshotAge()` is also gas-free.

## Resource Limits

| Parameter | Key | Default | Description |
|---|---|---|---|
| Gas ceiling | `gasCeiling` | 1,000,000 | Maximum gas per execution. Primary execution bound. |
| CPU timeout | `maxCpuTimeMs` | 30,000 ms | Wall-clock timeout (safety net only — should never trigger under normal operation) |
| Memory | `maxMemory` | 8 MB | V8 isolate heap size limit. Exceeding triggers `out_of_memory` error. |
| Emissions | `maxEmissions` | 50 | Maximum platform actions a contract can emit per execution |
| State keys | `maxStateKeys` | 10,000 | Maximum key-value pairs a contract can store |
| State value size | `maxStateValueSize` | 65,536 bytes | Maximum size of a single state value (JSON-serialized) |
| Code size | `maxCodeSize` | 65,536 bytes | Maximum contract source code size at deployment |

### Additional Internal Limits

These limits are hardcoded in the VM and not configurable:

| Limit | Value | Location |
|---|---|---|
| Log entries per execution | 100 | `collector.js` |
| Log entry size | 1,024 bytes (truncated with `...(truncated)` marker) | `collector.js` |
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
| State value size | 64 KB per value | `StateManager.set()` throws on overflow |
| Code size | 64 KB per contract | Validated at deploy time |
| Log entries | 100 per execution | `EmissionCollector.addLog()` silently drops |

Gas is the primary execution bound. The wall-clock timeout exists only as a safety net for gas metering bugs — it should never trigger under normal operation.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
