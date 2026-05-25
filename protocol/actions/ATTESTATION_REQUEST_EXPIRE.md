<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - ATTESTATION_REQUEST_EXPIRE
System-injected synthetic action. Fired by the indexer's per-block expiry pipeline when an ATTESTATION_REQUEST passes its `DEADLINE_BLOCK` without an accepted ATTESTATION_RESPONSE.

Not broadcast — emitted by `util.processAttestationExpirations` once per stale pending request, alongside the existing ORDER_EXPIRE / COINPAY_EXPIRE / DISPENSER_EXPIRE / DISPENSER_CLOSE synthetic actions.

For the full design see `claude/reports/specs/2026-05-24_external-attestation-framework.md` §11.

## Trigger
Per-block, after the regular transaction pass, the indexer queries:
```
SELECT * FROM attestation_requests
WHERE request_status = 'pending'
  AND deadline_block < <current_block_index>
```
and synthesizes one ATTESTATION_REQUEST_EXPIRE action per row.

## Effects
- Creates an entry in the `actions` table (gets a new `action_index` so the synthetic event is replay-deterministic and rollback-correct).
- Flips matching `attestation_requests.request_status` from `pending` to `expired`.
- Synthesizes an EXECUTE injecting the contract's callback with:
  - `[request_id, provider_id, 'expired', '', ...original_callback_params]`
  - `SOURCE = contract_address` (matches the ATTESTATION_RESPONSE callback convention).
- Callback wrapped in a savepoint — failure does not roll back the status flip.

## Notes
- No PARAMS — synthesized, not broadcast. Not in the decoder's `VALID_ACTION_NAMES` set.
- The contract callback runs in the same block as the expire (mirrors the indexer's pattern of synthesizing system actions inline during block processing — same as ORDER_MATCH, COINPAY_EXPIRE).
- Refund / escrow settlement on expiry is Phase 3 economic work (`gas_escrow` is currently stubbed at `'0'`).
