<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - BATCH
This action batch executes multiple `ACTION` commands in a single transaction.

## PARAMS
| Name      | Type   | Description                       |
| --------- | ------ | --------------------------------- |
| `VERSION` | String | Format Version                    |
| `COMMAND` | String | Any valid `ACTION` with `PARAMS`  |

## Formats

### Version `0`
- `VERSION|COMMAND;COMMAND`

## Examples
```
BATCH|0|MINT|0|XCHAIN|100;ISSUE|0|JDOG
This example mints 100 XCHAIN tokens and issues the JDOG token
```

## Rules
- Can only use one `MINT` action in a `BATCH` action
- Can only use one `ISSUE` action in a `BATCH` action
- Can not use `BATCH` as a action in a `BATCH` action
- Can not use `FILE` as a action in a `BATCH`

## Notes
- `COMMANDS` are separated by a semi-colon `;`

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
