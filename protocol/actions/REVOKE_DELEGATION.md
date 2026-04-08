<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - REVOKE_DELEGATION
This action revokes a previously delegated signing key.

## PARAMS
| Name              | Type   | Description                                |
| ----------------- | ------ | ------------------------------------------ |
| `VERSION`         | String | Format Version                             |
| `SIGNING_PUBKEY`  | String | Ed25519 public key to revoke, 64 hex chars |

## Formats

### Version `0`
- `VERSION|SIGNING_PUBKEY`

## Examples
```
REVOKE_DELEGATION|0|abc123...def
Revoke the specified signing key from the broadcasting address's stake
```

## Rules
- BTC chain only
- Broadcasting address must have an active delegation for the specified `SIGNING_PUBKEY` (gated by the 6-block activation delay)

## Deactivation Delay
- Revocation does **not** take effect immediately — the key remains active for **6 BTC blocks** after REVOKE_DELEGATION confirms
- Tracked via the `deactivation_block` column on the `delegations` table (set to `block_index + 6`)
- This prevents short-range BTC reorgs from leaving a stake without a valid signer
- After the delay elapses, the key is fully invalidated and can no longer be used for signing

## Notes
- The 6-block delay means that for emergency key compromise scenarios, the operator must:
  1. Broadcast `DELEGATE` with a new key (takes 6 blocks to activate)
  2. Broadcast `REVOKE_DELEGATION` for the old key (takes 6 blocks to deactivate)
  3. During the overlap window, both keys are valid — the new key takes effect ~6 blocks before the old key is fully revoked
- A stake with no valid signing key will not participate in validator duties until a new key is delegated
- The 6-block window matches all other validator state changes (STAKE, UNSTAKE, DELEGATE) for consistency

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
