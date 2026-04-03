<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - STAKE
This action stakes XCHAIN tokens for hub validation.

## PARAMS
| Name              | Type    | Description                                       |
| ----------------- | ------- | ------------------------------------------------- |
| `VERSION`         | String  | Format Version                                    |
| `TIER`            | Integer | Validation tier: 1=oracle, 2=cross-chain          |
| `CHAINS`          | String  | Comma-separated chains e.g. 'BTC,DOGE' (Tier 2 only) |
| `SIGNING_PUBKEY`  | String  | Ed25519 public key, 64 hex chars                  |

## Formats

### Version `0`
- `VERSION|TIER|CHAINS|SIGNING_PUBKEY`

## Examples
```
STAKE|0|1||abc123...def
Stakes for oracle validation tier (Tier 1); CHAINS is empty for Tier 1
```

```
STAKE|0|2|BTC,DOGE|abc123...def
Stakes for cross-chain validation tier (Tier 2) covering BTC and DOGE chains
```

## Rules
- BTC chain only
- `TIER` must be `1` (oracle) or `2` (cross-chain)
- `CHAINS` is required for Tier 2 and must list valid chain identifiers
- `CHAINS` must be empty for Tier 1
- `SIGNING_PUBKEY` must be a valid 64-character hex-encoded Ed25519 public key
- `SIGNING_PUBKEY` must be unique across all active stakes
- Broadcasting address must hold sufficient XCHAIN tokens for the selected tier

## Notes
- Staking locks XCHAIN tokens in exchange for validator eligibility and rewards
- Tier 1 (oracle) validators attest to on-chain state for the hub config oracle
- Tier 2 (cross-chain) validators coordinate cross-chain actions across the listed chains
- Use `UNSTAKE` to begin the cooldown period and recover staked tokens
- Use `DELEGATE` to rotate the signing key without unstaking

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
