<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action Specification

**Copyright © 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**  

Licensed under the **Dankest Community License**  
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).  

You may not use, modify, or distribute this material except in compliance with the License.  
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)

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
- `VERSION|FEE_PREFERENCE|REQUIRE_MEMO|MEMO`

## Examples
```
ADDRESS|0|1|0
This example sets the address to DESTROY fees
```

```
ADDRESS|0|2|0
This example sets the address to DONATE fees
```

```
ADDRESS|0|0|1
This example sets the address to require a `MEMO` on any received `SEND`
```

## `FEE_PREFERENCE` Options
- `1` = `FEE` is destroyed, lowering supply
- `2` = `FEE` to donated to protocol development (default)
- `3` = `FEE` to donated to community development

## `DISPENSER_PREFERENCE` Options
- `1` = Only Owner can open dispenser (default)
- `2` = Anyone can open dispenser

## Rules

## Notes
- `ADDR` `ACTION` can be used for shorter reference to `ADDRESS` `ACTION`

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
