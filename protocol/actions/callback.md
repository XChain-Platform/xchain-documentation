<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - CALLBACK
This action performs a callback on a `TICK`. 

## PARAMS
| Name      | Type   | Description                 |
| --------- | ------ | --------------------------- |
| `VERSION` | String | Format Version              |
| `TICK`    | String | Ticker name or Ticker ID    |
| `MEMO`    | String | An optional memo to include |

## Formats

### Version `0`
- `VERSION|TICK|MEMO`

## Examples
```
CALLBACK|0|JDOG
This example calls back the JDOG token to the token owner address
```

## Rules
- `TICK` can only be called back after `CALLBACK_BLOCK`
- All `TICK` supply will be returned to `TICK` owner address
- All `TICK` supply holders will receive `CALLBACK_AMOUNT` of `CALLBACK_TICK` per `UNIT`

## Notes
- `CALLBACK` requires a fee. The fee may be paid in `XCHAIN` (deducted from the sender's balance) or in native coin via a qualified coin output in the same transaction; on Litecoin and Dogecoin the native-coin output is the only accepted form.
- The fee is priced on the unified gas schedule as `CALLBACK_BASE` plus `CALLBACK_PER_RECIPIENT` for each holder paid, from the `UNIFIED_FEES_SWEEP_CALLBACK` gate; before it, the fee was a flat charge per database hit. The base exists so the smallest callback still buys a native-coin fee output above the chain's dust threshold. See [Flag-Day Values](../flag-days.md) for where the gate stands on each network, and the hub's [gas schedule](../../components/hub/api.md) for the values.
- `UNIT` - A specific unit of measure (1 or 1.0)
- `CALLBACKS` respect `CALLBACK_TICK` `ALLOW_LIST` and `BLOCK_LIST` and will only distribute `CALLBACK_TICK` to authorized holders
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
