<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - DIVIDEND
This action pays a dividend to holders of `TICK`.

## PARAMS
| Name            | Type   | Description                            |
| --------------- | ------ | -------------------------------------- |
| `VERSION`       | String | Format Version                         |
| `TICK`          | String | Ticker name or Ticker ID               |
| `DIVIDEND_TICK` | String | The `TICK` that dividends are paid in  |
| `AMOUNT`        | String | Amount of `TICK` to pay out per `UNIT` |
| `MEMO`          | String | An optional memo to include            |

## Formats

### Version `0`
- `VERSION|TICK|DIVIDEND_TICK|AMOUNT|MEMO`

## Examples
```
DIVIDEND|0|BRRR|BACON|1
This example pays a dividend of 1 BACON token to every holder of 1 BRRR token
```

```
DIVIDEND|0|TEST|BACON|0.5
This example pays a dividend of 0.5 BACON token to every holder of 1 TEST token
```

## Rules

## Notes
- `DIVIDEND` requires an `XCHAIN` fee based on number of database hits
- `UNIT` - A specific unit of measure (1 or 1.0)
- To send `TICK` to a large number of users, see the `AIRDROP` or `SEND` commands
- If `TICK` is divisible and `DIVIDEND_TICK` is non-divisble, quantities whose calculated share rounds to 0 will receive no `DIVIDEND_TICK`. Such holders are excluded from the recipient list entirely, so they do **not** count toward the per-recipient fee charged to `SOURCE`
- `SOURCE` address is excluded from receiving dividends
- Any `ADDRESS` may pay out a `DIVIDEND` on any `TICK`
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
