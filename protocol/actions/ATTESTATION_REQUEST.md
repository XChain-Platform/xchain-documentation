<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - ATTESTATION_REQUEST
Emitted by the VM during EXECUTE when a contract calls `xchain.attestation.request(...)`. The indexer escrows the gas estimate and records a `pending` row; staked validators with the `attestation` capability pick the request up, fetch the off-chain payload via the named provider, and reach PBFT quorum on an ATTESTATION_RESPONSE.

Origin: VM emission only — user-broadcast ATTESTATION_REQUEST actions are rejected.

For the full design see `claude/reports/specs/2026-05-24_external-attestation-framework.md`.

## PARAMS
| Name                   | Type    | Description                                                              |
| ---------------------- | ------- | ------------------------------------------------------------------------ |
| `VERSION`              | Integer | Format version (0)                                                       |
| `REQUEST_ID`           | String  | 64-hex SHA-256 over `tx_hash || contract_index || emitter_position`      |
| `PROVIDER_ID`          | String  | Governance-registered provider (`http_get`, `llm`, …)                    |
| `REQUEST_PAYLOAD`      | String  | Provider-specific payload (URL for `http_get`, JSON envelope for `llm`)  |
| `CALLBACK_METHOD`      | String  | Contract method to invoke on response (≤64 chars)                        |
| `CALLBACK_PARAMS_JSON` | String  | JSON array of developer-supplied params, echoed back to callback         |
| `REDUNDANCY`           | Integer | Required validator signatures (1, 3, or 5)                               |
| `DEADLINE_BLOCKS`      | Integer | Blocks until the request auto-expires (provider's `deadline_window_blocks` cap) |

## Format

### Version `0`
- `ATTESTATION_REQUEST|0|REQUEST_ID|PROVIDER_ID|REQUEST_PAYLOAD|CALLBACK_METHOD|CALLBACK_PARAMS_JSON|REDUNDANCY|DEADLINE_BLOCKS`

## Example
```
ATTESTATION_REQUEST|0|abc...def|http_get|https://example.com/v1/score/42|handleResponse|["ctx-42"]|1|10
```

## Rules
- VM emission only — the `IS_EMISSION` flag must be set by `execute.processEmission`.
- `PROVIDER_ID` must be governance-registered (indexer validates against its provider registry).
- `REDUNDANCY` must appear in the provider's `allowed_redundancy` list.
- `REQUEST_PAYLOAD` size must be ≤ provider's `max_request_bytes`.
- `DEADLINE_BLOCKS` must be `> 0` and `≤` provider's `deadline_window_blocks`.
- `CONTRACT_INDEX` (carried via `EMITTER`) must reference an existing contract.
- `REQUEST_ID` is verified by re-deriving from `tx_hash || contract_index || emitter_position` (defends against compromised VM).

## Lifecycle
1. VM EXECUTE emits ATTESTATION_REQUEST → indexer stores with `request_status='pending'`.
2. Validators staked for `attestation` capability detect the request via the hub's `AttestationRound` polling.
3. Top-`REDUNDANCY` validators (deterministic leader sort by `SHA-256(request_id || pubkey)`) fetch via the provider and gossip ATTEST_PROPOSE.
4. Leader publishes ATTESTATION_RESPONSE on-chain with `REDUNDANCY` Ed25519 signatures.
5. Indexer flips request to `fulfilled` and injects a system EXECUTE invoking the callback.
6. If `DEADLINE_BLOCK` passes without a response, the indexer's per-block expiry pipeline synthesizes ATTESTATION_REQUEST_EXPIRE (flips status to `expired`, fires the callback with `status='expired'`).
