<!--
Copyright © 2025–2026 Dankest, LLC
SPDX-License-Identifier: AGPL-3.0-or-later
Licensed under the GNU Affero GPL v3.0 or later; see LICENSE.md.
A commercial license is available, contact legal@dankest.llc.
-->

# Error Codes

Machine-readable error codes across the XChain Platform HTTP APIs. Stable: codes are append-only; a published code never changes meaning or disappears, so clients (including AI agents) can branch on them safely. Human-readable `error` / `message` text may be reworded at any time; never parse it.

## Explorer REST API

Errors are JSON objects:

```json
{ "error": "human-readable message", "code": "STABLE_CODE" }
```

| Code | HTTP status | Meaning | Retry? |
|---|---|---|---|
| `BAD_REQUEST` | 400 | The request could not be processed (malformed query, unknown lookup). **Historical: no explorer code path emits this code.** Every 400 now carries a narrower code: `MISSING_PARAMETER`, `INVALID_ACTION_INDEX`, `INVALID_BLOCK_INDEX`, or one of the `INVALID_*` codes further down, and an unknown lookup is a 404 `NOT_FOUND` | No: fix the request |
| `MISSING_PARAMETER` | 400 | A required query parameter is absent | No: add the parameter |
| `INVALID_ACTION_INDEX` | 400 | The action index is not a non-negative integer | No |
| `INVALID_BLOCK_INDEX` | 400 | The block index is not a non-negative integer | No |
| `RELAY_INVALID_PROTOCOL` | 400 | `/relay` only accepts http/https URLs | No |
| `RELAY_FETCH_FAILED` | 400 | `/relay` could not fetch the URL | Maybe; the upstream may be transient |
| `PATH_DENIED` | 403 | Path traversal outside the served directory | No |
| `RELAY_DENIED` | 403 | `/relay` refuses private/loopback/metadata destinations (SSRF guard) | No |
| `UNKNOWN_COIN` | 404 | The `{COIN}` prefix is not served by this explorer | No: check `/{COIN}/api/status` |
| `NOT_FOUND` | 404 | No row for that lookup | No |
| `CHECKPOINT_NOT_FOUND` | 404 | No quorum-signed checkpoint at that height | Maybe: checkpoints lag the tip |
| `RATE_LIMITED` | 429 | Per-IP request budget exhausted (default 500/min) | Yes: back off; honor `RateLimit-*` headers |
| `SERVER_ERROR` | 500 | Unexpected internal failure | Yes: with backoff |
| `UPSTREAM_ERROR` | 502 | The colocated indexer fee service failed | Yes: with backoff |
| `COIN_NOT_AVAILABLE` | 503 | Coin supported but not configured for data requests here | No: use another instance |
| `INDEXER_NOT_CONFIGURED` | 501 | Fee quote/schedule needs an indexer API this instance lacks | No: use another instance |
| `SERVICE_UNAVAILABLE` | 503 | The endpoint cannot serve this request | No |
| `INVALID_PARAMETER` | 400 | A query or body parameter is malformed, repeated, over-long, or outside its allowed values; the generic 400 when no narrower code below applies | No: fix the request |
| `INVALID_ACTION` | 400 | The `action` parameter names no known action (fee quote and preflight routes) | No |
| `INVALID_HEIGHT` | 400 | The `height` parameter is not a non-negative integer (proof routes) | No |
| `INVALID_LIMIT` | 400 | The `limit` parameter is not a non-negative integer (checkpoint list) | No |
| `INVALID_RANGE` | 400 | `from` and `to` are not both integers, or `to` is below `from` (block-range proof) | No |
| `INVALID_CONTRACT_INDEX` | 400 | The contract index is not a non-negative integer | No |
| `INVALID_KEY_NUL` | 400 | A contract state key contains a NUL byte | No |
| `KEY_TOO_LONG` | 400 | A contract state key exceeds the VM's maximum state-key size | No |
| `STAKES_BTC_ONLY` | 400 | Validator-set proofs are served for BTC only (`stakes_root` is BTC-only) | No |
| `BAD_METHOD` | 400 | Contract simulation: `method` is missing, too long, or contains wire delimiters | No |
| `BAD_PARAMS` | 400 | Contract simulation: `params` is not an array, has too many entries, an over-long entry, or a wire delimiter | No |
| `BAD_CALLER` | 400 | Contract simulation: `caller` is not an address string | No |
| `NO_CHECKPOINT` | 404 | No quorum-signed checkpoint at or above the requested height (proof routes) | Maybe: checkpoints lag the tip |
| `ACTION_NOT_FOUND` | 404 | No such action on this server (action proof) | No |
| `CHECKPOINT_PRE_COMMITMENT` | 409 | The checkpoint predates the state-commitment flag day, so it carries no committed roots to prove against | No: choose a later height |
| `ACTION_BLOCK_NOT_CHECKPOINTED` | 409 | The action's block is not checkpointed yet, so there is no signed `block_merkle_root` to bind the proof to | Yes: after a checkpoint covers the block |
| `SNAPSHOT_NOT_YET_CHECKPOINTED` | 409 | No BTC checkpoint exists at the snapshot height yet (validator-set proof) | Yes: after the chain advances |
| `CONTRACT_STATE_NOT_COMMITTED` | 409 | `contract_state_root` is not committed at this height, so absence cannot be proven | No: choose a later height |
| `ESCROW_LEAF_NOT_COMMITTED` | 409 | The locked-balance leaf is not committed at this height, so absence cannot be proven | No: choose a later height |
| `STATE_TOO_LARGE` | 413 | Contract simulation: the contract's state exceeds the simulation limits | No |
| `SERVER_BUSY` | 429 | The explorer's global in-flight request cap is reached and the request was shed; a second 429 distinct from the per-IP `RATE_LIMITED`, with a `Retry-After` header | Yes: back off; honor `Retry-After` |
| `VM_BUSY` | 429 | Contract simulation: too many concurrent simulations, globally or from this client | Yes: back off |
| `INTERNAL_ERROR` | 500 | An unhandled failure while serving a data request | Yes: with backoff |
| `DB_ERROR` | 500 | The database query behind a data request failed | Yes: with backoff |
| `PROOF_STATE_ROOT_MISMATCH` | 500 | The committed `state_root` does not match this server's local state tree | No: the operator must investigate |
| `ACTION_LEAF_NOT_FOUND` | 500 | The action row is not present in its block's leaf set (action proof) | No: the operator must investigate |
| `PROOF_BLOCK_MERKLE_MISMATCH` | 500 | The committed `block_merkle_root` does not match this server's local block tree (action proof) | No: the operator must investigate |
| `NO_STATE_TREE` | 501 | This server does not hold the state tree (proof routes need a full indexer database) | No: use another instance |
| `INDEXER_UNAVAILABLE` | 502 | The indexer API behind a validator-set proof is unreachable | Yes: with backoff |
| `INDEXER_AUTH_REQUIRED` | 503 | The indexer API behind a validator-set proof requires a key this explorer does not carry | No: operator configuration |
| `COIN_DATA_STALE` | 503 | Indexed data for this coin is stale beyond its maximum tip age and is refused rather than served as current. Distinct from `COIN_NOT_AVAILABLE`: a client retrying `COIN_NOT_AVAILABLE` is misconfigured, one retrying `COIN_DATA_STALE` is waiting out an outage | Yes: with backoff |
| `MIRROR_NOT_CONFIGURED` | 503 | Hub-mirror self-sync is configured for this coin but no hub endpoint is set, so consensus data is refused rather than served stale | No: operator configuration |
| `MIRROR_NOT_BOOTSTRAPPED` | 503 | The hub mirror has not completed its initial bootstrap, so consensus data is unavailable rather than served empty | Yes: with backoff |
| `MIRROR_STALE` | 503 | The hub mirror is stale beyond its configured lag and fail-closed is set | Yes: with backoff |
| `VM_QUERY_DISABLED` | 503 | Contract simulation is disabled on this explorer | No: use another instance |
| `VM_QUERY_VM_DRIFT` | 503 | Contract simulation is disabled because the deployed VM is not the canonical one | No: operator action |
| `VM_MODULE_UNAVAILABLE` | 503 | Contract simulation: the VM module is not available on this host | No: use another instance |

Errors on the Explorer WebSocket channel (`INVALID_CHANNEL`, `INVALID_TYPE`, `INVALID_ACTION`, `INVALID_PARAMS`, `SUBSCRIPTION_LIMIT`) are a separate surface with its own message shape; they are documented in [Explorer WebSocket](../components/explorer/websocket.md), not here.

## JSON-RPC services (encoder, hub, SDK API)

JSON-RPC 2.0 error objects:

```json
{ "jsonrpc": "2.0", "id": 1, "error": { "code": -32602, "message": "..." } }
```

| Code | Meaning | Used by | Retry? |
|---|---|---|---|
| `-32700` | Parse error: invalid JSON | all | No |
| `-32600` | Invalid request envelope | all | No |
| `-32601` | Method not found | all | No |
| `-32602` | Invalid params (validation failure) | all | No: fix params |
| `-32603` | Internal error (node RPC failure, encoder failure) | all | Yes: with backoff |
| `-32000` | Server error | all | Yes: with backoff |
| `-32001` | Unauthorized: missing/invalid API key (`x-api-key` for encoder/hub, `Authorization: Bearer` for SDK API) | all | No: fix credentials |
| `-32029` | Too many requests (rate limit) | encoder | Yes: back off |
| `-32010` | Operational error: an expected, caller-actionable condition (`create_tx`, `create_envelope_cancel_tx`). `error.data.reason` carries a stable code from the table below; branch on it, never on `message` | encoder | Depends on `reason` (see below) |

### Encoder operational reasons

A `-32010` error always carries `error.data.reason`, a stable string that is append-only like the numeric codes, plus the reason-specific fields listed here. The `message` is encoder-authored prose and may be reworded at any time.

| Reason | Meaning | `data` fields | Retry? |
|---|---|---|---|
| `INSUFFICIENT_FUNDS` | The selected inputs cannot cover the outputs plus fee, or every candidate input is reserved by a transaction built inside the reservation window | `required`, `available`, `outputs`, `fee`; `reservedCandidates` when every candidate is reserved | No: fund the address, or broadcast the pending transaction and wait for its change |
| `NO_UTXOS` | No UTXOs were provided and none were found for the address | none | No |
| `CHANGE_ADDRESS_REQUIRED` | The build would burn significant satoshis as fee; supply a change address | none | No: supply `change` |
| `DUPLICATE_TRANSACTION` | A transaction with the same inputs and outputs (same txid) was built inside the reservation window | `txid` | No: broadcast the one already built, or change the inputs or outputs |
| `INPUT_RESERVED` | `options.exactInputs` names outpoints reserved by a transaction built inside the reservation window | `reserved` (outpoints) | No: broadcast that transaction and rebuild, or wait for the reservation to lapse |
| `INPUT_SELECTION_RACE` | Input selection raced a concurrent reservation, so the obfuscation key is bound to an outpoint that is not the first input | `expectedFirstInput`, `actualFirstInput` | Yes: retry the request |
| `UTXO_TRACKER_ERROR` | The UTXO tracker is unreachable or returned a malformed response | none | Yes: with backoff |
| `UTXO_TRACKER_STALE` | The tracker's view lags the node past the configured threshold, or is ahead of the node (an orphaned view) | `lag`, `tracker_height`, `node_height` | Yes: with backoff |
| `UTXO_TRACKER_HALTED` | The tracker is halted (for example after an unrecoverable reorg) | `lag`, `tracker_height`, `node_height`, `halt_reason` | No: operator action |
| `UTXO_TRACKER_NOT_READY` | The tracker has not reconverged its mempool, so an already-spent confirmed output cannot be filtered | `lag`, `tracker_height`, `node_height` | Yes: with backoff |
| `ENVELOPE_RECOGNITION_UNKNOWN` | The node returned no chain height, so Taproot envelope recognition cannot be confirmed active | none | Yes: with backoff |
| `ENVELOPE_NOT_YET_ACTIVE` | Taproot envelope recognition is not active on this network yet, so the envelope is refused rather than built for decoders to ignore | `recognitionHeight`, `chainTip`, `blocksRemaining` | No: use P2WSH until the activation height |
| `ENVELOPE_CANCEL_BELOW_DUST` | The envelope-cancel sweep output would fall below the dust floor | `commitValue`, `fee`, `sweepValue` | No: spend via the reveal or CPFP |

## Where the specs live

- Explorer OpenAPI: `https://explorer.xchain.io/openapi.json`
- Encoder OpenRPC: `https://encoder.xchain.io/{COIN}/openrpc.json` (e.g. `https://encoder.xchain.io/TBTC/openrpc.json`)
- Hub OpenRPC: `https://hub.xchain.io/openrpc.json`
- SDK API OpenRPC: served at `/openrpc.json` by `npm run api` (self-hosted)

The SDK library (as opposed to its API server) throws typed error classes instead (see [components/sdk/ERRORS.md](../components/sdk/errors.md).
