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
| `ACTION_NOT_YET_INDEXED` | 404 | The action index lies above what this explorer's indexer has committed so far; the body carries `indexed_through` and the response a `Retry-After` header | Yes: the indexer is catching up; honor `Retry-After` |
| `CHECKPOINT_NOT_FOUND` | 404 | No quorum-signed checkpoint at that height | Maybe: checkpoints lag the tip |
| `RATE_LIMITED` | 429 | Per-IP request budget exhausted (app-wide default 1080/min; some routes have tighter limits, see [explorer rate limiting](../components/explorer/configuration.md#rate-limiting)) | Yes: back off; honor `RateLimit-*` headers |
| `SERVER_ERROR` | 500 | Unexpected internal failure | Yes: with backoff |
| `UPSTREAM_ERROR` | 502 | The colocated indexer fee service failed. Four indexer proxy routes return it when their indexer call fails: native fee quote, oracle fee quote, fee schedule and action pre-flight (a validator-set proof reports the same failure as `INDEXER_UNAVAILABLE`) | Yes: with backoff |
| `COIN_NOT_AVAILABLE` | 503 | Coin supported but not configured for data requests here | No: use another instance |
| `INDEXER_NOT_CONFIGURED` | 501 | The route needs an indexer API this instance lacks for the coin/network: native and oracle fee quote, fee schedule, action pre-flight, and validator-set proof | No: use another instance |
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
| `STAKE_SNAPSHOT_TRUNCATED` | 409 | The indexer marked a capability's stake snapshot at this height truncated (the qualifying validator set overflowed its query cap), so the stake total would be under-counted and no proof is served (validator-set proof) | No: the same height keeps answering this until operators raise the indexer's query cap |
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
| `STAKE_SNAPSHOT_MALFORMED` | 500 | A capability's stake snapshot at this height cannot yield a stake total (a validator with a blank or missing source, or a missing, non-numeric or negative weight), so no proof is served (validator-set proof) | No: the operator must investigate |
| `NO_STATE_TREE` | 501 | This server does not hold the state tree (proof routes need a full indexer database) | No: use another instance |
| `INDEXER_UNAVAILABLE` | 502 | The indexer API behind a validator-set proof is unreachable | Yes: with backoff |
| `INDEXER_AUTH_REQUIRED` | 503 | The indexer API behind a validator-set proof requires a key this explorer does not carry | No: operator configuration |
| `INDEXER_STAKE_WEIGHTS_UNAVAILABLE` | 502 | The indexer could not supply a capability's stake set at this height (lagging, not ready, or the stake lookup failed), so no validator-set proof is served. The internal error carries a `:<capability>` suffix that the response code drops | Yes: with backoff |
| `COIN_DATA_STALE` | 503 | Indexed data for this coin is stale beyond its maximum tip age and is refused rather than served as current. Distinct from `COIN_NOT_AVAILABLE`: a client retrying `COIN_NOT_AVAILABLE` is misconfigured, one retrying `COIN_DATA_STALE` is waiting out an outage | Yes: with backoff |
| `MIRROR_NOT_CONFIGURED` | 503 | Hub-mirror self-sync is configured for this coin but no hub endpoint is set, so consensus data is refused rather than served stale | No: operator configuration |
| `MIRROR_NOT_BOOTSTRAPPED` | 503 | The hub mirror has not completed its initial bootstrap, so consensus data is unavailable rather than served empty | Yes: with backoff |
| `MIRROR_STALE` | 503 | The hub mirror is stale beyond its configured lag and fail-closed is set | Yes: with backoff |
| `VM_QUERY_DISABLED` | 503 | Contract simulation is disabled on this explorer | No: use another instance |
| `VM_QUERY_VM_DRIFT` | 503 | Contract simulation is disabled because the deployed VM is not the canonical one | No: operator action |
| `VM_MODULE_UNAVAILABLE` | 503 | Contract simulation: the VM module is not available on this host | No: use another instance |
| `INVALID_TICK` | 400 | Bridge panel routes (`GET /{COIN}/api/bridge-invariant/{tick}`, `GET /{COIN}/api/bridge-transfers/{tick}`): the `tick` path segment is empty, longer than 250 characters, or contains a control character | No: fix the request |
| `BRIDGE_INVARIANT_UNAVAILABLE` | 503 | `GET /{COIN}/api/bridge-invariant/{tick}`: this explorer has a hub endpoint, but the hub's bridge-invariant read failed (unreachable, refused, or a degraded health body in place of a result) or returned nothing usable. An explorer with no hub endpoint, or whose hub build predates the read, never answers this code: it answers HTTP 200 `{ "available": false, "reason" }` (see the bridge-invariant note below this table) | Maybe: a failed or degraded hub read may be transient; retry with backoff |
| `BRIDGE_TRANSFERS_UNAVAILABLE` | 503 | `GET /{COIN}/api/bridge-transfers/{tick}`: this explorer holds no hub-mirror source for the coin, or the bridge-transfer read failed | Maybe: a failed read may be transient; a coin with no mirror source answers this every time |
| `APPLIED_POLICY_UNAVAILABLE` | 503 | `GET /{COIN}/api/applied-policy/{tick}`: the coin has no checkpoint source, the explorer cannot read applied policy, or the read failed | Maybe: a failed read may be transient; a coin with no checkpoint source answers this every time |
| `INVALID_CURSOR` | 400 | Keyset paging on API list routes: `before` and `after` were both given (refused on any list, before its cursor support is checked), or the one given is not a single string of decimal digits below 2^53 (signed, fractional, exponent or hex notation, too large, or the parameter repeated). Refused before any query runs | No: fix the request |
| `CURSOR_UNSUPPORTED` | 400 | Keyset paging on API list routes: `before` or `after` was given on a list that does not page by cursor (a list whose rows can share an action index, such as sends; only lists whose OpenAPI entry documents `before`/`after` accept them). The cursor value is not inspected | No: page with `page` instead |
| `INVALID_SORTORDER` | 400 | List routes, API and explorer feeds alike: `sortorder` is neither `asc` nor `desc` in any letter case | No: fix the request |
| `INVALID_PAGE` | 400 | API list routes: `page` is not a whole number of at least 1 | No: fix the request |
| `PAGE_TOO_DEEP` | 400 | API list routes: the requested `page` starts past row 100000, the deepest row served by position. A request carrying `before` or `after` is not held to this cap | No: page by `before`/`after` where the list offers them |
| `INVALID_LENGTH` | 400 | Explorer list feeds (`/{COIN}/explorer/...`): `length` is not a whole number of at least 1 | No: fix the request |
| `INVALID_OFFSET` | 400 | Explorer list feeds on a cursor-paged list: the `offset` cursor a next or previous page continues from is not a whole number. A feed paged by row position never reads it | No: fix the request |
| `INVALID_ADDRESSES` | 400 | Batch address routes (`POST /{COIN}/api/balances`, `POST /{COIN}/api/coinpay_obligations`): the body's `addresses` field is missing, not an array, empty, or holds a non-string entry, and nothing is read. The SDK's client-side pre-flight throws the same code before a request is sent (see [SDK explorer methods](../components/sdk/explorer.md)) | No: fix the request |
| `TOO_MANY_ADDRESSES` | 400 | Batch address routes: more than 20 addresses in one body, counted before duplicates are collapsed, so a body of repeats is refused rather than quietly served | No: send at most 20 per request |
| `INVALID_ADDRESS` | 400 | Batch address routes: one entry is not a well-formed address; the offending entry is echoed (truncated) in the `error` text. Unrelated to the SDK library's own `INVALID_ADDRESS` typed error, which is a separate surface (see [SDK errors](../components/sdk/errors.md)) | No |
| `READ_FAILED` | 200 (per-address) | Batch address routes only: the fallback code inside a per-address `error` object when the inner read failed without supplying a code of its own. The whole-request status is still 200; branch on the entry's own `status` field | Depends on the entry's `status` |

The batch address routes fail at two layers, and a client has to read both. A whole-request refusal carries an HTTP 400 with one of the three codes above, or the coin gate's 503 (`COIN_NOT_AVAILABLE` / `COIN_DATA_STALE`), which answers the entire batch rather than being buried per address. Otherwise the response is HTTP 200 and each address may carry an `error` object of `{ code, error, status }`, where `code` is whatever the inner read returned, or `READ_FAILED` when it returned none. A 200 therefore does not mean every address succeeded.

The bridge-invariant route (`GET /{COIN}/api/bridge-invariant/{tick}`) answers HTTP 200 with `{ "available": false, "reason": "<reason>" }` in place of an invariant map when the explorer cannot ask the hub at all. That body means "could not ask", never "no copies exist", so check `available` before reading the body as a map. `reason` is a stable string, append-only like the codes above and scoped to this route:

- `HUB_NOT_CONFIGURED`: this explorer has no hub endpoint configured, so it answers this every time; use an explorer that has one. Unrelated to the SDK library's own `HUB_NOT_CONFIGURED` typed error, which is a separate surface (see [SDK errors](../components/sdk/errors.md)).
- `HUB_METHOD_MISSING`: every hub endpoint answered JSON-RPC `-32601` (method not found) for `getbridgeinvariant`, so the hub build predates the read; it answers this until the hub operator upgrades.

Errors on the Explorer WebSocket channel (`INVALID_CHANNEL`, `INVALID_TYPE`, `INVALID_ACTION`, `INVALID_PARAMS`, `SUBSCRIPTION_LIMIT`) are a separate surface with its own message shape; they are documented in [Explorer WebSocket](../components/explorer/websocket.md), not here.

## JSON-RPC services (encoder, hub, SDK API)

JSON-RPC 2.0 error objects:

```json
{ "jsonrpc": "2.0", "id": 1, "error": { "code": -32602, "message": "..." } }
```

The SDK treats every JSON-RPC body error as final: it does not automatically retry an error response. Callers own retries and may use the guidance below to decide whether and how to issue a new request. The `Retry?` column describes whether a caller-initiated retry may succeed, not SDK retry behavior.

| Code | Meaning | Used by | Retry? |
|---|---|---|---|
| `-32700` | Parse error: invalid JSON | all | No |
| `-32600` | Invalid request envelope | all | No |
| `-32601` | Method not found | all | No |
| `-32602` | Invalid params (validation failure) | all | No: fix params |
| `-32603` | Internal error (node transport failure, encoder failure). A coin-node verdict on a broadcast is `-32010`, not this code | all | Caller may retry with backoff |
| `-32000` | Server error | all | Yes: with backoff |
| `-32001` | Unauthorized: missing/invalid API key (`x-api-key` for encoder/hub, `Authorization: Bearer` for SDK API) | all | No: fix credentials |
| `-32029` | Too many requests (rate limit) | encoder, hub | Yes: back off |
| `-32005` | Too many requests (rate limit) on the **SDK API only**, which does not use `-32029`. Served as HTTP `429` with a `Retry-After` header carrying the seconds until the caller's window resets; the message names the limit and the window | SDK API | Yes: wait out `Retry-After`, then back off |
| `-32010` | Operational error: an expected, caller-actionable condition (`create_tx`, `create_envelope_cancel_tx`, `broadcast_tx`). `error.data.reason` carries a stable code from the table below; branch on it, never on `message` | encoder | Depends on `reason` (see below) |

Rate limiting is the one condition with two codes. A client that talks to more than one of
these services must treat `-32029` and `-32005` as the same condition, or key retry on the
HTTP `429` and the `Retry-After` header, which every one of them sets.

### Encoder operational reasons

A `-32010` error always carries `error.data.reason`, a stable string that is append-only like the numeric codes, plus the reason-specific fields listed here. The `message` is encoder-authored prose and may be reworded at any time.

| Reason | Meaning | `data` fields | Retry? |
|---|---|---|---|
| `INSUFFICIENT_FUNDS` | The selected inputs cannot cover the outputs plus fee, or every candidate input is reserved by a transaction built inside the reservation window | `required`, `available`, `outputs`, `fee`; `reservedCandidates` when every candidate is reserved | No: fund the address, or broadcast the pending transaction and wait for its change |
| `NO_UTXOS` | No UTXOs were provided and none were found for the address | none | No |
| `MAINNET_PRELAUNCH` | A mainnet encoder refuses to build any action outside the validator set (ANCHOR, PRICE format 0, NODEPROOF, ROLLCALL, quorum ATTEST) before the mainnet launch instant, unless its operator sets `ENCODER_MAINNET_PRELAUNCH_OVERRIDE` | `opens_at` (Unix seconds of the launch instant) | Yes: after `opens_at` |
| `NO_CONFIRMED_UTXO` | Input selection reached the maximum input count without enough value to fund the transaction | `selectedInputCount`, `maximum` | Yes: wait for a larger output to confirm, or consolidate the confirmed outputs |
| `CHANGE_ADDRESS_REQUIRED` | The build would burn significant satoshis as fee; supply a change address | none | No: supply `change` |
| `DUPLICATE_TRANSACTION` | A transaction with the same inputs and outputs (same txid) was built inside the reservation window | `txid` | No: broadcast the one already built, or change the inputs or outputs |
| `INPUT_RESERVED` | `options.exactInputs` names outpoints reserved by a transaction built inside the reservation window | `reserved` (outpoints) | No: broadcast that transaction and rebuild, or wait for the reservation to lapse |
| `INPUT_SELECTION_RACE` | Input selection raced a concurrent reservation, so the obfuscation key is bound to an outpoint that is not the first input | `expectedFirstInput`, `actualFirstInput` | Caller may retry the request |
| `UTXO_TRACKER_ERROR` | The UTXO tracker is unreachable or returned a malformed response | none | Caller may retry with backoff |
| `UTXO_TRACKER_STALE` | The tracker's view lags the node past the configured threshold, or is ahead of the node (an orphaned view), or the tracker reports `synced: false` (the remote tracker profile also refuses an absent `synced`) | `lag`, `tracker_height`, `node_height` | Caller may retry with backoff |
| `UTXO_TRACKER_HALTED` | The tracker is halted (for example after an unrecoverable reorg) | `lag`, `tracker_height`, `node_height`, `halt_reason` | No: operator action |
| `UTXO_TRACKER_NOT_READY` | The tracker has not reconverged its mempool, so an already-spent confirmed output cannot be filtered | `lag`, `tracker_height`, `node_height` | Caller may retry with backoff |
| `NODE_CHAIN_MISMATCH` | The coin node reports a chain that does not match the encoder's configured network, for example a mainnet encoder pointed at a testnet node. The check runs once per process and is skipped when no network is configured | none | No: operator action, point the encoder at a node on its own network |
| `ENVELOPE_RECOGNITION_UNKNOWN` | The node returned no chain height, so Taproot envelope recognition cannot be confirmed active | none | Caller may retry with backoff |
| `ENVELOPE_NOT_YET_ACTIVE` | Taproot envelope recognition is not active on this network yet, so the envelope is refused rather than built for decoders to ignore | `recognitionHeight`, `chainTip`, `blocksRemaining` | No: use P2WSH until the activation height |
| `ENVELOPE_CANCEL_BELOW_DUST` | The envelope-cancel sweep output would fall below the dust floor | `commitValue`, `fee`, `sweepValue` | No: spend via the reveal or CPFP |
| `ENVELOPE_CANCEL_OUTPOINT_RESERVED` | The commit outpoint the cancel would sweep is reserved by a different transaction built inside the reservation window | `outpoint` | No: broadcast that transaction and rebuild, or wait for the reservation to lapse. Replaying the same cancel is never refused |
| `NODE_REJECTED` | `broadcast_tx`: the coin node refused the signed transaction (for example a double-spend, dust output, or fee below the relay floor) | `node_code` (the node's RPC error code) | No: rebuild and re-sign |
| `TX_ALREADY_IN_CHAIN` | `broadcast_tx`: the coin node already knows the transaction, in its mempool or in a block | `node_code` (the node's RPC error code) | No: the transaction is already broadcast; track its txid |
| `UTXO_TRACKER_UNREACHABLE` | Remote tracker profile only (`UTXO_TRACKER_PROFILE=remote`): the tracker's `get_sync_status` or `get_utxos` call failed (a transport fault, an error reply or a malformed result), and this profile has no fallback. The default profile reports the same failure as `UTXO_TRACKER_ERROR` | none | Caller may retry with backoff |
| `UTXO_TRACKER_SYNC_MISSING` | Remote tracker profile only: the tracker returned an empty sync status, a `get_utxos` reply with no `sync` field, or a `sync` without a numeric `lag`, so the encoder refuses a view the tracker did not vouch for. The default profile builds in this case | none | No: operator action (upgrade or repair the tracker); a wallet may offer a manual retry |
| `TX_BELOW_MIN_STANDARD_SIZE` | A single-transaction build would serialize under the coin node's minimum non-witness (stripped) size, so the node would not relay it: Litecoin Core 82 bytes, Bitcoin Core 65, Dogecoin Core none. Input selection first takes another input so a funded change output lifts the build over the floor; this reason means no input was left to do that | `strippedSize` (predicted non-witness bytes), `minimum` (the node floor) | No: add an input, or leave enough for a change output above the dust floor plus its fee |

## Where the specs live

- Explorer OpenAPI: `https://explorer.xchain.io/openapi.json`
- Encoder OpenRPC: `https://encoder.xchain.io/{COIN}/openrpc.json` (e.g. `https://encoder.xchain.io/TBTC/openrpc.json`)
- Hub OpenRPC: `https://hub.xchain.io/openrpc.json`
- SDK API OpenRPC: served at `/openrpc.json` by `npm run api` (self-hosted)

The SDK library (as opposed to its API server) throws typed error classes instead (see [components/sdk/ERRORS.md](../components/sdk/errors.md).
