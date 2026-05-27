<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - ATTEST

External-data attestation lifecycle in a single action with three version-discriminated phases:

- **v0 — Request.** VM emission only. Emitted by `xchain.attestation.request(...)` during EXECUTE. Indexer escrows the gas estimate and records a `pending` row; staked validators with the `attestation` capability pick the request up.
- **v1 — Response.** Broadcast by the leader validator on behalf of the PBFT quorum. Carries the agreed-upon response body plus Ed25519 signatures.
- **v2 — Expire.** System-injected synthetic action. Fired by the indexer's per-block expiry pipeline when a v0 request passes its `DEADLINE_BLOCK` without an accepted v1 response. Not user-broadcastable.

For the full design see `claude/reports/specs/2026-05-24_external-attestation-framework.md`.

## PARAMS
| Name                   | Type    | Versions | Description                                                              |
| ---------------------- | ------- | -------- | ------------------------------------------------------------------------ |
| `VERSION`              | Integer | all      | Format version (0=request, 1=response, 2=expire)                         |
| `REQUEST_ID`           | String  | all      | 64-hex SHA-256 over `tx_hash ‖ contract_index ‖ emitter_position`        |
| `PROVIDER_ID`          | String  | 0, 1     | Governance-registered provider (`http_get`, `llm`, …)                    |
| `REQUEST_PAYLOAD`      | String  | 0        | Provider-specific payload (URL for `http_get`, JSON envelope for `llm`)  |
| `CALLBACK_METHOD`      | String  | 0        | Contract method to invoke on response (≤64 chars)                        |
| `CALLBACK_PARAMS_JSON` | String  | 0        | JSON array of developer-supplied params, echoed back to callback         |
| `REDUNDANCY`           | Integer | 0        | Required validator signatures (1, 3, or 5)                               |
| `DEADLINE_BLOCKS`      | Integer | 0        | Blocks until the request auto-expires (provider's `deadline_window_blocks` cap) |
| `RESPONSE_PAYLOAD`     | String  | 1        | Inline response body (UTF-8). Binary bodies not supported in v0.         |
| `STATUS`               | String  | 1        | `ok` \| `timeout` \| `no_quorum` \| `provider_error` \| `expired`        |
| `META`                 | String  | 1        | Provider-defined metadata (HTTP status code for `http_get`; model ID for `llm`) |
| `SIG_COUNT`            | Integer | 1        | Number of (pubkey, sig) pairs that follow                                |
| `PUBKEY_n`             | String  | 1        | 64-hex Ed25519 pubkey, qualified for `attestation` at the request block  |
| `SIG_n`                | String  | 1        | 128-hex Ed25519 signature over the canonical message                     |

## Formats

### Version `0` — Request (VM-emitted)
- `ATTEST|0|REQUEST_ID|PROVIDER_ID|REQUEST_PAYLOAD|CALLBACK_METHOD|CALLBACK_PARAMS_JSON|REDUNDANCY|DEADLINE_BLOCKS`

### Version `1` — Response (validator-broadcast, variable-length signature list)
- `ATTEST|1|REQUEST_ID|PROVIDER_ID|RESPONSE_PAYLOAD|STATUS|META|SIG_COUNT|PUBKEY1|SIG1|PUBKEY2|SIG2|...`

### Version `2` — Expire (system-synthesized; never user-broadcast)
- `ATTEST|2|REQUEST_ID`

## Examples

```
ATTEST|0|abc...def|http_get|https://example.com/v1/score/42|handleResponse|["ctx-42"]|1|10
VM-emitted request for an off-chain HTTP GET, single-validator redundancy, 10-block deadline
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

Where `sha256(response_payload)` is the lowercase hex digest of the UTF-8 response bytes.

## Rules

### Version 0 (request)
- VM emission only — the `IS_EMISSION` flag must be set by `execute.processEmission`. User-broadcast v0 is rejected.
- `PROVIDER_ID` must be governance-registered (indexer validates against its provider registry).
- `REDUNDANCY` must appear in the provider's `allowed_redundancy` list.
- `REQUEST_PAYLOAD` size must be ≤ provider's `max_request_bytes`.
- `DEADLINE_BLOCKS` must be `> 0` and `≤` provider's `deadline_window_blocks`.
- `CONTRACT_INDEX` (carried via `EMITTER`) must reference an existing contract.
- `REQUEST_ID` is verified by re-deriving from `tx_hash ‖ contract_index ‖ emitter_position` (defends against compromised VM).

### Version 1 (response)
- Indexer rejects if `REQUEST_ID` doesn't match a `pending` row from a prior v0.
- `PROVIDER_ID` must equal the request's provider.
- Indexer's `BLOCK_INDEX` must be ≤ the request's `DEADLINE_BLOCK`.
- Each `PUBKEY_n` is checked against the `attestation` capability snapshot at the *request's* block_index (not the response's — every hub must compute the same set).
- Each `SIG_n` must Ed25519-verify against the canonical message under `PUBKEY_n`.
- Valid signature count must be `≥ REDUNDANCY` (the request's `REDUNDANCY` parameter). Sub-quorum responses are rejected; the request remains pending.

### Version 2 (expire)
- Never user-broadcast — `VALID_ACTION_NAMES` accepts `ATTEST` for the decoder's v0/v1 paths, but v2 is rejected if it appears in a user transaction.
- Synthesized once per stale pending request: indexer queries `SELECT * FROM attestation_requests WHERE request_status='pending' AND deadline_block < <current_block>` and synthesizes one v2 per row.
- `REQUEST_ID` must match an existing `pending` row.

## Lifecycle
1. VM EXECUTE emits ATTEST v0 → indexer stores in `attestation_requests` with `request_status='pending'`.
2. Validators staked for `attestation` capability detect the request via the hub's `AttestationRound` polling.
3. Top-`REDUNDANCY` validators (deterministic leader sort by `SHA-256(request_id ‖ pubkey)`) fetch via the provider and gossip ATTEST_PROPOSE.
4. Leader publishes ATTEST v1 on-chain with `REDUNDANCY` Ed25519 signatures.
5. Indexer flips request to `fulfilled` (or `errored` for non-`ok` STATUS) and injects a system EXECUTE invoking the callback.
6. If `DEADLINE_BLOCK` passes without a v1, the indexer's per-block expiry pipeline synthesizes ATTEST v2 (flips status to `expired`, fires the callback with `status='expired'`).

## Effects on v1 with valid signatures
- Persists into `attestation_responses` with the agreed body + sigs.
- Flips matching `attestation_requests` row to `fulfilled` (if `STATUS=ok`) or `errored` (other statuses).
- Synthesizes an EXECUTE injecting the callback with:
  - `[request_id, provider_id, status, response_payload, ...original_callback_params]`
  - `SOURCE = contract_address` so `xchain.getSourceAddress() === xchain.getContractAddress()` inside the callback.
- Callback wrapped in a savepoint — failure does NOT roll back the response row.

## Effects on v2 (expire)
- Creates an entry in the `actions` table (gets a new `action_index` so the synthetic event is replay-deterministic and rollback-correct).
- Flips matching `attestation_requests.request_status` from `pending` to `expired`.
- Synthesizes an EXECUTE injecting the contract's callback with:
  - `[request_id, provider_id, 'expired', '', ...original_callback_params]`
  - `SOURCE = contract_address` (matches the v1 callback convention).
- Callback wrapped in a savepoint — failure does not roll back the status flip.

## Notes
- `REQUEST_ID` is the cross-version foreign key — every v1 / v2 must reference an existing v0.
- The `attestation_requests` and `attestation_responses` table names are unchanged from the pre-consolidation design; only the wire action name collapsed.
- Refund / escrow settlement on expiry is Phase 3 economic work (`gas_escrow` is currently stubbed at `'0'`).

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
