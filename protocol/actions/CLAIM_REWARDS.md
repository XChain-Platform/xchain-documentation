<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - CLAIM_REWARDS
This action withdraws all accrued validator rewards to the broadcasting address.

## PARAMS
| Name      | Type   | Description    |
| --------- | ------ | -------------- |
| `VERSION` | String | Format Version |

## Formats

### Version `0`
- `VERSION`

## Examples
```
CLAIM_REWARDS|0
Claim all accrued validator rewards for the broadcasting address
```

## Rules
- BTC chain only
- Broadcasting address must have an active stake
- Broadcasting address must have unclaimed rewards greater than 0
- Rewards are credited to the broadcasting address upon indexing

## Notes
- Rewards accrue continuously while the address holds an active stake
- All pending rewards are claimed in a single action; partial claims are not supported
- Rewards may be claimed at any time while a stake is active
- Rewards can also be claimed after initiating `UNSTAKE` during the cooldown period

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
