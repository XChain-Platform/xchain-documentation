<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - DELEGATE
This action rotates the signing key for a staked validator.

## PARAMS
| Name                  | Type   | Description                          |
| --------------------- | ------ | ------------------------------------ |
| `VERSION`             | String | Format Version                       |
| `NEW_SIGNING_PUBKEY`  | String | New Ed25519 public key, 64 hex chars |

## Formats

### Version `0`
- `VERSION|NEW_SIGNING_PUBKEY`

## Examples
```
DELEGATE|0|abc123...def
Rotate to a new signing key without unstaking
```

## Rules
- BTC chain only
- Broadcasting address must have an active stake
- `NEW_SIGNING_PUBKEY` must be a valid 64-character hex-encoded Ed25519 public key
- `NEW_SIGNING_PUBKEY` must not already be in use by any active stake or delegation
- Replaces the previously registered signing key immediately upon indexing

## Notes
- Use `DELEGATE` to rotate signing keys for security hygiene without disrupting validator status
- The old signing key is invalidated as soon as the new key is registered
- Use `REVOKE_DELEGATION` to remove a delegated key without replacing it
- Does not affect staked token amounts or tier assignments

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
