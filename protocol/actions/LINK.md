<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - LINK
This action links actions using `ACTION_INDEX`, including linking actions across blockchains.

## PARAMS
| Name                 | Type   | Description                                 |
| -------------------- | ------ | ------------------------------------------- |
| `VERSION`            | String | Format Version                              |
| `COIN1`              | String | `COIN` name (BTC, LTC, DOGE, etc)           |
| `COIN1_ACTION_INDEX` | String | `ACTION_INDEX` of action on `COIN1` network |
| `COIN2`              | String | `COIN` name (BTC, LTC, DOGE, etc)           |
| `COIN2_ACTION_INDEX` | String | `ACTION_INDEX` of action on `COIN2` network |
| `MEMO`               | String | An optional memo to include                 |

## Formats

### Version `0`
- `VERSION|COIN1|COIN1_ACTION_INDEX|COIN2|COIN2_ACTION_INDEX|MEMO`

## Examples
```
LINK|0|BTC|1234|BTC|4321|Linking FILE upload to TICK
This example links a BTC `FILE` upload with `ACTION_INDEX` 1234 with a BTC `ISSUE` transaction on a `TICK` associated with `ACTION_INDEX` 4321
```

```
LINK|0|BTC|1234|DOGE|6666|Linking TICK with FILE upload on DOGE
This example links a BTC `FILE` upload with `ACTION_INDEX` 1234 with a DOGE `ISSUE` transaction on a `TICK` associated with `ACTION_INDEX` 6666
```

## Rules
- `COIN1` and `COIN2` values must be a valid coin network (BTC, LTC, DOGE, etc)
- `COIN1_ACTION_INDEX` must point to a valid `ACTION_INDEX` on the `COIN1` network
- `COIN2_ACTION_INDEX` must point to a valid `ACTION_INDEX` on the `COIN2` network

## Notes
- To link a `FILE` with a `TICK`, the `COIN2_ACTION_INDEX` must be a valid `ISSUE` action, and the `LINK` must be done by the current `TICK` owner.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
