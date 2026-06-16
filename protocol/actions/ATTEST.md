<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - ATTEST

External-data attestation lifecycle in a single action with three version-discriminated phases:

- **v0:** Request.** VM emission only. Emitted by `xchain.attestation.request(...)` during EXECUTE. Indexer escrows the gas estimate and records a `pending` row; staked validators with the `attestation` capability pick the request up.
- **v1:** Response.** Broadcast by the leader validator on behalf of the PBFT quorum. Carries the agreed-upon response body plus Ed25519 signatures.
- **v2:** Expire.** System-injected synthetic action. Fired by the indexer's per-block expiry pipeline when a v0 request passes its `DEADLINE_BLOCK` without an accepted v1 response. Not user-broadcastable.

For the full design see `claude/reports/specs/2026-05-24_external-attestation-framework.md`.

## PARAMS
| Name                   | Type    | Versions | Description                                                              |
| ---------------------- | ------- | -------- | ------------------------------------------------------------------------ |
| `VERSION`              | Integer | all      | Format version (0=request, 1=response, 2=expire)                         |
| `REQUEST_ID`           | String  | all      | 64-hex SHA-256 over `tx_hash ‖ action_index ‖ contract_index ‖ emitter_position`        |
| `PROVIDER_ID`          | String  | 0, 1     | Governance-registered provider (`http_get`, `llm`, …)                    |
| `REQUEST_PAYLOAD`      | String  | 0        | Provider-specific payload (URL for `http_get`, JSON envelope for `llm`)  |
| `CALLBACK_METHOD`      | String  | 0        | Contract method to invoke on response (≤64 chars)                        |
| `CALLBACK_PARAMS_JSON` | String  | 0        | JSON array of developer-supplied params, echoed back to callback (each element string-coerced at injection: see §Effects) |
| `REDUNDANCY`           | Integer | 0        | Required validator signatures (1, 3, or 5)                               |
| `DEADLINE_BLOCKS`      | Integer | 0        | Blocks until the request auto-expires (provider's `deadline_window_blocks` cap) |
| `FEE_TICK`             | String  | 0        | *(optional)* Tick the attestation fee is paid in. **v1 consensus accepts only the GAS tick (XCHAIN).** Required when `FEE_AMOUNT > 0`. |
| `FEE_AMOUNT`           | String  | 0        | *(optional)* Attestation fee, precision ≤ the GAS tick's own decimals (8 for the production XCHAIN genesis issuance). `> 0` escrows the fee from `FEE_PAYER` at request time. Absent / `0` ⇒ feeless (zero behavior change). |
| `RESPONSE_PAYLOAD`     | String  | 1        | Response body (base64-encoded on the wire; decoded to UTF-8 for storage and callback delivery). Absent in v0. |
| `STATUS`               | String  | 1        | `ok` \| `timeout` \| `no_quorum` \| `provider_error` \| `expired`        |
| `META`                 | String  | 1        | Provider-defined metadata (HTTP status code for `http_get`; model ID for `llm`) |
| `SIG_COUNT`            | Integer | 1        | Number of (pubkey, sig) pairs that follow                                |
| `PUBKEY_n`             | String  | 1        | 64-hex Ed25519 pubkey, qualified for `attestation` at the request block  |
| `SIG_n`                | String  | 1        | 128-hex Ed25519 signature over the canonical message                     |

## Formats

### Version `0`: Request (VM-emitted)
- `ATTEST|0|REQUEST_ID|PROVIDER_ID|REQUEST_PAYLOAD|CALLBACK_METHOD|CALLBACK_PARAMS_JSON|REDUNDANCY|DEADLINE_BLOCKS[|FEE_TICK|FEE_AMOUNT]`
- The trailing `FEE_TICK|FEE_AMOUNT` pair is optional. A feeless request omits them entirely (the SDK serializer trims trailing empties), so feeless v0 wire strings are **byte-identical** to the pre-fee format. No migration.

### Version `1`: Response (validator-broadcast, variable-length signature list)
- `ATTEST|1|REQUEST_ID|PROVIDER_ID|RESPONSE_PAYLOAD|STATUS|META|SIG_COUNT|PUBKEY1|SIG1|PUBKEY2|SIG2|...`

### Version `2`: Expire (system-synthesized; never user-broadcast)
- `ATTEST|2|REQUEST_ID`

## Examples

```
ATTEST|0|abc...def|http_get|https://example.com/v1/score/42|handleResponse|["ctx-42"]|1|10
VM-emitted request for an off-chain HTTP GET, single-validator redundancy, 10-block deadline, feeless
```

```
ATTEST|0|abc...def|http_get|https://example.com/v1/score/42|handleResponse|["ctx-42"]|1|10|XCHAIN|0.5
Same request carrying a 0.5 XCHAIN attestation fee (escrowed from FEE_PAYER at request time)
```

```
ATTEST|1|abc...def|http_get|{"score":7}|ok|200|1|a1b2...|c3d4...
Validator-broadcast response with one Ed25519 signature
```

```
ATTEST|2|abc...def
System-synthesized expiry for request abc...def
```

## Canonical signing message (v1)
Each `SIG_n` covers the canonical bytes:

```
request_id || provider_id || sha256(response_payload) || status || meta
```

Where `sha256(response_payload)` is the lowercase hex digest of the **raw response bytes** (after base64-decoding the wire field).

## Rules

### Version 0 (request)
- VM emission only, the `IS_EMISSION` flag must be set by `execute.processEmission`. User-broadcast v0 is rejected.
- `PROVIDER_ID` must be governance-registered (indexer validates against its provider registry).
- `REDUNDANCY` must appear in the provider's `allowed_redundancy` list.
- `REQUEST_PAYLOAD` size must be ≤ provider's `max_request_bytes`.
- `DEADLINE_BLOCKS` must be `> 0` and `≤` provider's `deadline_window_blocks`.
- `CONTRACT_INDEX` (carried via `EMITTER`) must reference an existing contract.
- `REQUEST_ID` is verified by re-deriving from `tx_hash ‖ action_index ‖ contract_index ‖ emitter_position` (defends against compromised VM).

#### Fee fields (v0, optional)
- `FEE_TICK`, when present, must equal the GAS tick (XCHAIN): `invalid: FEE_TICK (only XCHAIN accepted)` otherwise. Arbitrary fee ticks are a post-launch rule loosening; the wire carries the tick now so no future format change is needed.
- `FEE_AMOUNT` must parse to a precision no finer than the GAS tick's own decimals: `invalid: FEE_AMOUNT (precision > N dp)` otherwise (N = `min(8, gasDecimals)`). The escrow/debit/credit ledger rows round to the tick's decimals, so a finer fee would be **charged rounded** while `attests.fee_amount` kept the unrounded string, desyncing the reward split from the escrow. The production XCHAIN genesis issuance is pinned to **8 decimals**, so in production the cap is 8 dp; on the decimals-0 regtest GAS tick the cap is 0 (integer fees only). The VM gateway (`xchain.attestation.request`) additionally rejects > 8 dp at emit time as an outer sanity bound.
- `FEE_AMOUNT > 0` requires a non-null `FEE_TICK`: `invalid: FEE_TICK (required when FEE_AMOUNT > 0)`.
- `FEE_PAYER` (the contract address emitting the request) must hold `≥ FEE_AMOUNT` of the GAS tick: `invalid: insufficient funds (FEE_AMOUNT)` otherwise. As with any failed emission validation, this fails the whole enclosing EXECUTE.
- A valid `FEE_AMOUNT > 0` debits `FEE_PAYER` and writes an escrow row at the v0 `action_index`. Absent / `0` ⇒ feeless, no ledger movement.

### Version 1 (response)
- Indexer rejects if `REQUEST_ID` doesn't match a `pending` row from a prior v0.
- `PROVIDER_ID` must equal the request's provider.
- Indexer's `BLOCK_INDEX` must be ≤ the request's `DEADLINE_BLOCK`.
- Each `PUBKEY_n` is checked against the `attestation` capability snapshot at the *request's* block_index (not the response's; every hub must compute the same set).
- Each `SIG_n` must Ed25519-verify against the canonical message under `PUBKEY_n`.
- Valid signature count must be `≥ REDUNDANCY` (the request's `REDUNDANCY` parameter). Sub-quorum responses are rejected; the request remains pending.

### Version 2 (expire)
- Never user-broadcast: `VALID_ACTION_NAMES` accepts `ATTEST` for the decoder's v0/v1 paths, but v2 is rejected if it appears in a user transaction.
- Synthesized once per stale pending request: indexer queries `SELECT * FROM attestation_requests WHERE request_status='pending' AND deadline_block < <current_block>` and synthesizes one v2 per row.
- `REQUEST_ID` must match an existing `pending` row.

## Lifecycle
1. VM EXECUTE emits ATTEST v0 → indexer stores in `attestation_requests` with `request_status='pending'`.
2. Validators staked for `attestation` capability detect the request via the hub's `AttestationRound` polling.
3. Top-`REDUNDANCY` validators (deterministic leader sort by `SHA-256(request_id ‖ pubkey)`) fetch via the provider and gossip ATTEST_PROPOSE.
4. Leader publishes ATTEST v1 on-chain with `REDUNDANCY` Ed25519 signatures.
5. On a terminal v1 the indexer flips the request to `fulfilled` (`STATUS=ok`) or `errored` (a genuinely terminal failure such as `expired`) and injects a system EXECUTE invoking the callback. A *retryable* v1 (`STATUS` of `no_quorum`, `timeout`, or `provider_error`) is recorded but leaves `request_status='pending'`, so the responsible set can attempt another round before the deadline; no callback fires yet.
6. If `DEADLINE_BLOCK` passes while still `pending` (no terminal v1, or only retryable rounds), the indexer's per-block expiry pipeline synthesizes ATTEST v2 (flips status to `expired`, fires the callback with `status='expired'`).

## Effects on v1 with valid signatures
- Persists into `attestation_responses` with the agreed body + sigs (always, including retryable rounds, for audit).
- Terminal statuses flip the matching `attestation_requests` row: `fulfilled` (`STATUS=ok`) or `errored` (a terminal failure such as `expired`).
- Retryable statuses (`no_quorum`, `timeout`, `provider_error`) leave `request_status='pending'` untouched so a later round can still reach quorum before the deadline (or the v2 expiry path takes over). No status flip and no callback for these.
- On a terminal status only, synthesizes an EXECUTE injecting the callback with:
  - `[request_id, provider_id, status, response_payload, ...original_callback_params]`
  - Every `original_callback_params` element is coerced to a string before injection (the VM parameter bus is string-typed), so a request that supplied `[42, true, null]` reaches the callback as `['42', 'true', 'null']`. Contracts must re-parse numeric or boolean context with `parseInt`, `parseFloat`, or `JSON.parse` as needed.
  - `SOURCE = contract_address` so `xchain.getSourceAddress() === xchain.getContractAddress()` inside the callback.
- Callback wrapped in a savepoint, failure does NOT roll back the response row.

## Effects on v2 (expire)
- Creates an entry in the `actions` table (gets a new `action_index` so the synthetic event is replay-deterministic and rollback-correct).
- Flips matching `attestation_requests.request_status` from `pending` to `expired`.
- Synthesizes an EXECUTE injecting the contract's callback with:
  - `[request_id, provider_id, 'expired', '', ...original_callback_params]`
  - As on the v1 path, every `original_callback_params` element is coerced to a string before injection, re-parse typed context inside the callback.
  - `SOURCE = contract_address` (matches the v1 callback convention).
- Callback wrapped in a savepoint, failure does not roll back the status flip.

## Fee flow

When a v0 request carries `FEE_AMOUNT > 0`, the fee is escrowed from `FEE_PAYER` at request time and disposed of when the request reaches a terminal state. All movements are GAS-denominated (XCHAIN). Settlement is deterministic across validators (`bcmulfloor` to GAS decimals; remainder dust stays in the REWARD pool).

| Event | Fee movement |
|---|---|
| v0 valid, `FEE_AMOUNT > 0` | Debit `FEE_PAYER` + escrow row (at the v0 `action_index`). |
| v1 → `fulfilled` (`STATUS=ok`) | Release escrow → credit the REWARD pool; one `validator_rewards` row per responsible-set pubkey (`reward_type='attest_fee'`, `round_reference=`request `action_index`), each `bcmulfloor(bcdiv(fee, N, 18), '1', 8)`. Floor dust stays in the pool. Empty responsible set ⇒ full fee stays in the pool. |
| v1 → `errored` (terminal non-ok, e.g. `expired`) | Release escrow → refund `FEE_PAYER` (service not rendered). |
| v1 retryable (`no_quorum` / `timeout` / `provider_error`) | No movement: escrow stays locked, request stays `pending`. |
| v2 expiry (synthesized) | Release escrow → refund `FEE_PAYER`. |

`validator_rewards` rows are paid out to stakers via `COLLECT` (the same path as protocol rewards, hence the XCHAIN-only constraint, since that chain has no per-row tick column). A reorg mid-fulfillment rolls back the release + reward rows generically (credits/debits/escrows by `action_index`, rewards by `block_index`) and resets `request_status` to `pending`; the earlier v0 escrow row survives.

## Notes
- `REQUEST_ID` is the cross-version foreign key; every v1 / v2 must reference an existing v0.
- The `attestation_requests` and `attestation_responses` table names are unchanged from the pre-consolidation design; only the wire action name collapsed.
- The optional `FEE_TICK`/`FEE_AMOUNT` request fee (above) is live. The separate `gas_escrow` (callback-gas) field remains stubbed at `'0'`, real callback-gas escrow is Phase 3 economic work, independent of the request fee.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
