<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - UNSTAKE
This action begins the unstaking cooldown period for a staked validator.

## PARAMS
| Name      | Type    | Description             |
| --------- | ------- | ----------------------- |
| `VERSION` | String  | Format Version          |
| `TIER`    | Integer | Tier to unstake from    |

## Formats

### Version `0`
- `VERSION|TIER`

## Examples
```
UNSTAKE|0|1
Begin unstaking from oracle tier (Tier 1)
```

```
UNSTAKE|0|2
Begin unstaking from cross-chain tier (Tier 2)
```

## Rules
- BTC chain only
- Broadcasting address must have an active stake at the specified `TIER`
- Begins the cooldown period; staked tokens are not immediately returned
- Only one active unstake cooldown is permitted per tier per address at a time

## Notes
- After the cooldown period expires, staked tokens are returned to the broadcasting address
- During the cooldown period the validator is removed from the active validator set
- Use `STAKE` to re-stake after the cooldown period completes
- Use `CLAIM_REWARDS` to collect any accrued rewards before or after unstaking

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
