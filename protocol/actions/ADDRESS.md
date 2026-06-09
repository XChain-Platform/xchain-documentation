<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action Specification

**Copyright © 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**  

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)  
with a commercial license available for proprietary use.  

You may use, modify, and distribute this material under the terms of the License.  
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).

# XChain Platform Action - ADDRESS
This action configures address specific options.

## PARAMS
| Name                   | Type   | Description                               |
| ---------------------- | ------ | ------------------------------------------|
| `VERSION`              | String | Format Version                            |
| `FEE_PREFERENCE`       | String | Set preference for how `FEE` is used      |
| `REQUIRE_MEMO`         | String | Require a `MEMO` on any received `SEND`   |
| `DISPENSER_PREFERENCE` | String | Set preference for how dispensrs are used |
| `MEMO`                 | String | An optional memo to include               |

## Formats

### Version `0`
- `VERSION|FEE_PREFERENCE|REQUIRE_MEMO|DISPENSER_PREFERENCE|MEMO`

## Examples
```
ADDRESS|0|1||0
This example sets the address to DESTROY fees
```

```
ADDRESS|0|2||0
This example sets the address to DONATE fees
```

```
ADDRESS|0||1|
This example sets the address to require a `MEMO` on any received `SEND`
```

```
ADDRESS|0|||2|
This example allows anyone to open a dispenser on this address
```

## `FEE_PREFERENCE` Options
- `1` = `FEE` is destroyed, lowering supply
- `2` = `FEE` to donated to protocol development (default)
- `3` = `FEE` to donated to community development

## `DISPENSER_PREFERENCE` Options
- `1` = Only owner can open dispenser on this address (default)
- `2` = Anyone can open dispenser on this address

## Rules

## Notes
- `ADDR` `ACTION` can be used for shorter reference to `ADDRESS` `ACTION`
- Leaving `DISPENSER_PREFERENCE` blank in a subsequent `ADDRESS` action does not clear an existing preference — it preserves the most recent non-blank value

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
