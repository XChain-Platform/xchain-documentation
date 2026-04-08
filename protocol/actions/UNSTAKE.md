<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - UNSTAKE
This action begins the unstaking cooldown period for a staked validator.

## PARAMS
| Name      | Type    | Description                                              |
| --------- | ------- | -------------------------------------------------------- |
| `VERSION` | String  | Format Version                                           |
| `TIER`    | Integer | Tier to unstake from (1=oracle, 2=cross-chain, 3=publisher) |

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

```
UNSTAKE|0|3
Begin unstaking from oracle publisher tier (Tier 3)
```

## Rules
- BTC chain only
- `TIER` must be `1`, `2`, or `3`
- Broadcasting address must have an active stake at the specified `TIER`
- The active stake lookup is gated by the activation delay — only fully-active stakes (where `activation_block <= current_block`) can be unstaked
- Begins the cooldown period; staked tokens are not immediately returned
- Only one active unstake cooldown is permitted per tier per address at a time

## Activation Delay (Removal from Validator Set)
- Validator removal does **not** take effect immediately — the validator continues to participate for **6 BTC blocks** after the UNSTAKE confirms
- Tracked via the `deactivation_block` column on the parent stake row (set to `block_index + 6`)
- Active-stake queries filter by `(deactivation_block IS NULL OR deactivation_block > current_block)`
- This prevents short-range BTC reorgs from affecting the active validator set

## Cooldown Period (Token Return)
- Separate from the activation delay — tracked via the `cooldown_end_block` column on the `unstakes` table
- Default cooldown: **1000 blocks** (configurable via `STAKING.COOLDOWN_BLOCKS`)
- After cooldown elapses, the staked XCHAIN tokens are returned to the broadcasting address

## Notes
- Two distinct delays apply on UNSTAKE:
  1. **6 blocks** — validator removal from the active set (BTC reorg safety)
  2. **1000 blocks** — XCHAIN token return (security cooldown)
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
