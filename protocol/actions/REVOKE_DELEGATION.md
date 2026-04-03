<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - REVOKE_DELEGATION
This action revokes a previously delegated signing key.

## PARAMS
| Name              | Type   | Description                          |
| ----------------- | ------ | ------------------------------------ |
| `VERSION`         | String | Format Version                       |
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
- Broadcasting address must have an active delegation for the specified `SIGNING_PUBKEY`
- Once revoked, the key is immediately invalidated and cannot be used for signing
- Revoking the active signing key without a replacement leaves the stake without a valid signer

## Notes
- Use `REVOKE_DELEGATION` to invalidate a compromised or retired signing key
- After revocation, use `DELEGATE` to assign a new signing key if the stake is to remain active
- A stake with no valid signing key will not participate in validator duties until a new key is delegated

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
