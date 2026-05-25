<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - ATTESTATION_RESPONSE
Broadcast by the leader validator (lowest SHA-256 hash of `request_id || pubkey` among the top-`REDUNDANCY` responsible validators) on behalf of the PBFT quorum. Carries the agreed-upon response body plus Ed25519 signatures from each signing validator.

For the full design see `claude/reports/specs/2026-05-24_external-attestation-framework.md`.

## PARAMS
| Name              | Type    | Description                                                            |
| ----------------- | ------- | ---------------------------------------------------------------------- |
| `VERSION`         | Integer | Format version (0)                                                     |
| `REQUEST_ID`      | String  | 64-hex matching an existing `pending` attestation_requests row         |
| `PROVIDER_ID`     | String  | Must match the request's provider                                      |
| `RESPONSE_PAYLOAD`| String  | Inline response body (UTF-8). Binary bodies not supported in v0.       |
| `STATUS`          | String  | `ok` \| `timeout` \| `no_quorum` \| `provider_error` \| `expired`        |
| `META`            | String  | Provider-defined metadata (HTTP status code for `http_get`; model ID for `llm`) |
| `SIG_COUNT`       | Integer | Number of (pubkey, sig) pairs that follow                              |
| `PUBKEY_n`        | String  | 64-hex Ed25519 pubkey, qualified for `attestation` at the request block |
| `SIG_n`           | String  | 128-hex Ed25519 signature over the canonical message                   |

## Format

### Version `0` (variable-length signature list)
- `ATTESTATION_RESPONSE|0|REQUEST_ID|PROVIDER_ID|RESPONSE_PAYLOAD|STATUS|META|SIG_COUNT|PUBKEY1|SIG1|PUBKEY2|SIG2|...`

## Canonical signing message
Each `SIG_n` covers the canonical bytes:

```
request_id || provider_id || sha256(response_payload) || status || meta
```

Where `sha256(response_payload)` is the lowercase hex digest of the UTF-8 response bytes.

## Example
```
ATTESTATION_RESPONSE|0|abc...def|http_get|{"score":7}|ok|200|1|a1b2...|c3d4...
```

## Rules
- Indexer rejects if `REQUEST_ID` doesn't match a `pending` row.
- `PROVIDER_ID` must equal the request's provider.
- Indexer's `BLOCK_INDEX` must be ≤ the request's `DEADLINE_BLOCK`.
- Each `PUBKEY_n` is checked against the `attestation` capability snapshot at the *request's* block_index (not the response's — every hub must compute the same set).
- Each `SIG_n` must Ed25519-verify against the canonical message under `PUBKEY_n`.
- Valid signature count must be `≥ REDUNDANCY` (the request's `REDUNDANCY` parameter). Sub-quorum responses are rejected; the request remains pending.

## Effects on STATUS=`valid`
- Persists into `attestation_responses` with the agreed body + sigs.
- Flips matching `attestation_requests` row to `fulfilled` (if `STATUS=ok`) or `errored` (other statuses).
- Synthesizes an EXECUTE injecting the callback with:
  - `[request_id, provider_id, status, response_payload, ...original_callback_params]`
  - `SOURCE = contract_address` so `xchain.getSourceAddress() === xchain.getContractAddress()` inside the callback.
- Callback is wrapped in a savepoint — failure does NOT roll back the response row.
