# XCALL — Cross-Chain Contract Call

`XCALL` is the source-chain side of a cross-chain contract call: a smart
contract on chain X asynchronously invokes a method on a contract deployed on
chain Y, and later receives the outcome via a callback. The relay between the
chains is performed by the validator federation with **zero per-call on-chain
transactions** — see [Cross_Chain_Calls.md](../Cross_Chain_Calls.md) for the
full architecture, trust model, and latency characteristics.

## Versions

| Version | Phase | Origin |
|---|---|---|
| v0 | Request | VM emission only (`xchain.emit.crossExecute(...)`) — never decoded from the wire |
| v2 | Expire | System-synthesized when `deadline_block` passes — never user-broadcast |

There is no on-chain v1: the result returns as a quorum-signed hub-mirror row
(`cross_chain_calls`, phase `result`), and the callback is a system-injected
EXECUTE (the ATTEST-callback pattern).

## Formats

### v0 — Request (VM-emitted action row)

```
XCALL|0|CALL_ID|TARGET_CHAIN|TARGET_CONTRACT_INDEX|METHOD|PARAMS_JSON|GAS_LIMIT|CALLBACK_METHOD|CALLBACK_PARAMS_JSON|DEADLINE_BLOCKS|CROSS_HOPS
```

| Field | Rules |
|---|---|
| `CALL_ID` | 64-hex; MUST equal `sha256(network:source_chain:tx_hash:emitter_action_index:contract_index:emitter_position:target_chain)` — re-derived and verified by the indexer. Network + chains are bound in (unlike the ATTEST request_id) because BTC-family chains share tx-hash space. |
| `TARGET_CHAIN` | `BTC`/`LTC`/`DOGE`, ≠ the emitting chain |
| `TARGET_CONTRACT_INDEX` | Target contract's DEPLOY action_index on the target chain (existence is checked there, not here) |
| `METHOD` | ≤ 64 bytes, no `\|`; must be in the target contract's exported `crossCallable` allowlist |
| `PARAMS_JSON` | JSON array of ≤ 32 strings, each ≤ 1024 bytes, no `\|` |
| `GAS_LIMIT` | Integer in `[XCALL_MIN_GAS (5,000), XCALL_MAX_GAS (200,000)]` — the target-side execution ceiling, pre-paid by the caller |
| `CALLBACK_METHOD` | ≤ 64 bytes; REQUIRED — every call ends in exactly one callback |
| `CALLBACK_PARAMS_JSON` | JSON array of strings, ≤ 1024 bytes total; echoed back to the callback |
| `DEADLINE_BLOCKS` | Integer in `[10, 4000]` source-chain blocks |
| `CROSS_HOPS` | HOST-derived (context + 1), capped at `XCALL_MAX_HOPS (2)` — never trusted from the VM |

### v2 — Expire (system-synthesized)

```
XCALL|2|CALL_ID
```

Synthesized independently by every source-chain indexer at the first block with
`block_index > deadline_block` while the request is still `pending`. Flips the
request to `expired` and injects the callback with status `expired`.

## Relay rows (hub mirror, quorum-signed)

Both legs travel as immutable `cross_chain_calls` rows (`UNIQUE(call_id,
phase)`), signed 2f+1 by the `cross_chain` capability set and verified by every
indexer against the mirrored capability snapshot at the row's `snapshot_block`
before ANY effect is applied. Canonical signing strings (byte-identical across
the hub `CrossChainCallEngine`, indexer verifiers, ANCHOR archive verifier, and
recovery):

```
Dispatch: XCALL|DISPATCH|call_id|snapshot_block|network|source_chain|source_action_index|source_contract_index|target_chain|target_contract_index|method|sha256(params_json)|gas_limit|cross_hops|effective_time
Result:   XCALL|RESULT|call_id|snapshot_block|network|target_chain|result_status|sha256(return_payload_b64)|effective_time
```

Variable-length fields enter as sha256 so the canonical stays fixed-arity and
`|`-safe.

## Lifecycle (request status on the source chain)

```
                emit.crossExecute → on-chain XCALL v0 row
[pending] ───────────────────────────────────────────────► federation waits
    │                                                       CONF[source] depth,
    │ deadline_block passed                                 PBFTs dispatch row
    ▼                                                            │
[expired] ◄── XCALL v2 synthesis                                 ▼
    │         (callback status='expired')              target chain verifies sigs,
    │                                                  injects XEXEC at the first
    ▼                                                  block ≥ effective_time
 callback                                                        │
                                                                 ▼
[completed] ◄── result row verified, callback injected ◄── federation waits
                (exactly-once interlock vs expiry)         CONF[target] depth,
                                                           PBFTs result row
```

- **Exactly-once callback:** result delivery and deadline expiry share the
  request's status column; whichever reaches terminal first wins, the loser
  records itself as skipped. Both are block-height-driven (no wall clock).
- **Target-chain execution (`XEXEC`)** is an internal action (like
  CROSS_SETTLE): depth-0 EXECUTE under `gasCeiling = GAS_LIMIT`, synthetic
  chain/network-namespaced TX_HASH, `crossCallable` allowlist enforced, own
  savepoint. A failed run rolls its state back and the failure IS the relayed
  result. Idempotent + reorg-safe via `cross_chain_call_executions`.
- **Injection order/cap:** effective dispatch rows apply in `(snapshot_block, call_id)` order (quorum-agreed row content, hub-mirror-independent),
  `XCALL_MAX_CALLS_PER_BLOCK (25)` per block, overflow carries forward.

## Result statuses

`ok` | `reverted` | `out_of_gas` | `no_contract` | `not_callable` |
`payload_too_large` | `error` | `expired` (expiry path only)

Callback signature (string-coerced, ATTEST convention):

```
callbackMethod(call_id, target_chain, status, return_payload, ...callbackParams)
```

`return_payload` is the target method's JSON-serialized return value
(≤ `XCALL_MAX_RETURN_BYTES (1,024)`; oversize → `payload_too_large` with an
empty payload, state changes stand).

## Gas (no refunds in v1)

Charged at emit time, all from the caller's budget:

```
VM_EMISSION (500) + VM_XCALL_REQUEST (2,000) + GAS_LIMIT + VM_XCALL_CALLBACK (20,000)
```

Unused target-side gas is NOT refunded. The callback runs against the fixed
`VM_XCALL_CALLBACK` ceiling.

## Recoverability

The v0 request is an emitted action row — reproducible from a pure chain parse.
Both relay phases are included in the ANCHOR v1 archive (with their hub `id`
(provenance only; injection order is `(snapshot_block, call_id)`)) and rebuilt + signature-verified by
`xchain-indexer/src/recovery.js`, so a from-genesis reindex re-derives the
identical injected executions and callbacks.
