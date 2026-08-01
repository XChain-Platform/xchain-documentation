<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - XCALL
This action lets a smart contract on one chain call a method on a contract deployed on another chain, then receive the outcome through a callback. The relay between chains is performed by the validator federation with no per-call on-chain transaction. See [Cross-Chain Contract Calls](../cross-chain-calls.md) for the full architecture, trust model, and latency.

## PARAMS
| Name                    | Type    | Description                                                                 |
| ----------------------- | ------- | --------------------------------------------------------------------------- |
| `VERSION`               | String  | Format Version                                                              |
| `CALL_ID`               | String  | 64-hex call identifier, derived from the emission (see Rules)               |
| `TARGET_CHAIN`          | String  | `COIN` network the target contract lives on (BTC, LTC, DOGE), not the calling chain |
| `TARGET_CONTRACT_INDEX` | Integer | `ACTION_INDEX` of the target contract's `DEPLOY` on `TARGET_CHAIN`          |
| `METHOD`                | String  | Method to call; must be in the target contract's `crossCallable` allowlist  |
| `PARAMS_JSON`           | String  | JSON array of up to 32 strings (each ≤ 1024 bytes) passed to `METHOD`        |
| `GAS_LIMIT`             | Integer | Target-side execution ceiling, pre-paid by the caller                       |
| `CALLBACK_METHOD`       | String  | Method on the calling contract that receives the result (required)          |
| `CALLBACK_PARAMS`  | String  | JSON array of strings echoed back to the callback                           |
| `DEADLINE_BLOCKS`       | Integer | Source-chain blocks to wait before the call expires                         |
| `CROSS_HOPS`            | Integer | Host-derived hop counter, capped at `XCALL_MAX_HOPS`                         |

## Formats

### Version `0` - Request (VM-emitted)
- `VERSION|CALL_ID|TARGET_CHAIN|TARGET_CONTRACT_INDEX|METHOD|PARAMS_JSON|GAS_LIMIT|CALLBACK_METHOD|CALLBACK_PARAMS|DEADLINE_BLOCKS|CROSS_HOPS`

### Version `2` - Expire (system-synthesized)
- `VERSION|CALL_ID`

## Examples
```
XCALL|0|3f2a9c...e91|LTC|8821|setPrice|["WOWCOIN","100"]|50000|onPriceSet|["job-7"]|200|1
A contract on BTC calls 'setPrice' on contract 8821 over on LTC, pre-paying 50000 gas, and asks for the result back via its own 'onPriceSet' method within 200 blocks
```

```
XCALL|2|3f2a9c...e91
System-synthesized when the deadline passes with no result; flips the request to expired and fires the callback with status 'expired'
```

## Rules
- `XCALL` is never broadcast by users. Version `0` is emitted only from inside a contract via `xchain.emit.crossExecute(...)`; Version `2` is synthesized independently by every indexer once the deadline passes. `XCALL` emissions are disallowed from a `DEPLOY` constructor
- `CALL_ID` must equal `sha256(network:source_chain:tx_hash:root_action_index:contract_index:emitter_path:emitter_position:target_chain)` (colon-delimited) and is re-derived and verified by the indexer. Network and both chains are bound in because BTC-family chains share tx-hash space. The `root_action_index` (the root on-chain action) plus the `emitter_path` (the `>`-joined per-execution call path, empty for a root action) and `emitter_position` keep the id deterministic across nodes while disambiguating nested emissions; the emitting sub-action's own per-emission `action_index` is not bound in
- `TARGET_CHAIN` must be a supported coin network other than the calling chain
- `METHOD` is ≤ 64 bytes and must be exported in the target contract's `crossCallable` allowlist; the target contract's existence is checked on `TARGET_CHAIN`, not the calling chain
- `PARAMS_JSON` is a JSON array of ≤ 32 strings, each ≤ 1024 bytes, with no `|`
- `GAS_LIMIT` is an integer in `[XCALL_MIN_GAS, XCALL_MAX_GAS]` (5,000 to 200,000), pre-paid by the caller
- `CALLBACK_METHOD` is required: every call ends in exactly one callback
- `DEADLINE_BLOCKS` is an integer in `[10, 4000]` source-chain blocks
- `CROSS_HOPS` is derived by the host (the caller's hop count plus one), capped at `XCALL_MAX_HOPS` (2), and is never trusted from the VM
- Effective dispatches apply in `(snapshot_block, call_id)` order, up to `XCALL_MAX_CALLS_PER_BLOCK` (25) per block; any overflow carries forward to the next block
- Exactly-once callback: result delivery and deadline expiry share the request's status column, so whichever reaches a terminal state first wins and the loser records itself as skipped. Both are driven by block height, never wall-clock time

## Result statuses
The callback receives exactly one status: `ok`, `reverted`, `out_of_gas`, `no_contract`, `not_callable`, `payload_too_large`, `error`, or `expired` (expiry path only).

The callback is invoked using the ATTEST-callback convention:
- `CALLBACK_METHOD(call_id, target_chain, status, return_payload, ...CALLBACK_PARAMS)`

`return_payload` is the target method's JSON-serialized return value (≤ `XCALL_MAX_RETURN_BYTES`, 1,024 bytes). An oversized return yields `payload_too_large` with an empty payload; the target-side state changes still stand.

## Gas
Charged at emit time, entirely from the caller's budget:
- `VM_EMISSION (500) + VM_XCALL_REQUEST (2,000) + GAS_LIMIT + VM_XCALL_CALLBACK (20,000)`

Unused target-side gas is not refunded in v1. The callback runs against the fixed `VM_XCALL_CALLBACK` ceiling.

## Notes
- There is no on-chain Version `1`. The result comes back as a quorum-signed hub-mirror row (`cross_chain_calls`, phase `result`), and the callback is delivered as a system-injected `EXECUTE`, the same pattern used for attestation callbacks (see [`EXECUTE`](./execute.md) and [`ATTEST`](./attest.md))
- Both relay legs travel as immutable `cross_chain_calls` rows (`UNIQUE(call_id, phase)`), signed 2f+1 by the `cross_chain` capability set and verified by every indexer against the mirrored capability snapshot at the row's `snapshot_block` before any effect is applied. The canonical signing strings are:
  ```
  Dispatch: XCALL|DISPATCH|call_id|snapshot_block|network|source_chain|source_action_index|source_contract_index|target_chain|target_contract_index|method|sha256(params_json)|gas_limit|cross_hops|effective_time
  Result:   XCALL|RESULT|call_id|snapshot_block|network|target_chain|result_status|sha256(return_payload_b64)|effective_time
  ```
  Variable-length fields enter as a `sha256` digest so the canonical string stays fixed-arity and `|`-safe
- Target-side execution (`XEXEC`) is an internal action: a depth-0 `EXECUTE` under `gasCeiling = GAS_LIMIT`, with a synthetic chain/network-namespaced `TX_HASH`, the `crossCallable` allowlist enforced, and its own savepoint. A failed run rolls its state back and that failure becomes the relayed result. It is idempotent and reorg-safe via `cross_chain_call_executions`
- Lifecycle (source-chain request status): a request starts `pending`. The federation waits for source-chain confirmation depth, then signs the dispatch row; the target chain verifies signatures and injects `XEXEC` at the first block at or after `effective_time`, then the federation waits for target-chain depth and signs the result row. The request becomes `completed` when a verified result arrives, or `expired` once `DEADLINE_BLOCKS` passes with no result

  ```mermaid
  stateDiagram-v2
      [*] --> Pending
      state Pending {
          [*] --> AwaitingDispatch
          AwaitingDispatch --> DispatchSigned: source confirmation depth reached,<br>federation signs dispatch row
          DispatchSigned --> XEXECInjected: target chain verifies signatures,<br>injects XEXEC at first block at or after effective_time
          XEXECInjected --> ResultSigned: target-chain depth reached,<br>federation signs result row
      }
      Pending --> Completed: verified result arrives
      Pending --> Expired: DEADLINE_BLOCKS passes with no result
      Completed --> [*]
      Expired --> [*]
  ```
- Recoverability: the Version `0` request is reproducible from a pure chain parse, and both relay phases are included in the ANCHOR v1 archive and rebuilt and signature-verified by `xchain-indexer/src/recovery.js`, so a from-genesis reindex re-derives identical injected executions and callbacks

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
