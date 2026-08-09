<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

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

## Notes
- `COMMANDS` are separated by a semi-colon `;`
- **Sub-action normalization (flag-day gated):** until the `BATCH_SUBACTION_NORMALIZATION` activation (mainnet: the coordinated [contract-era flag day](../flag-days.md#contract-era-flag-day); testnet/regtest active from genesis), sub-actions inside a `BATCH` are NOT normalized the way top-level actions are. `ACTION` aliases (`TRANSFER`, `ADDR`, `DROP`, `CAST`, `MSG`) invalidate the whole `BATCH` (`invalid: ACTION (unknown)`), and legacy `ISSUE`/`MINT`/`SEND` params that omit the `VERSION` field are misparsed (the first param is read as the format version). Until activation, always use canonical `ACTION` names and an explicit `VERSION` in every `BATCH` command on mainnet. At/after activation, sub-actions get the same alias rewrite and legacy VERSION-0 injection as top-level actions.
- A `BATCH` may contain at most one `FILE` action. The decoder stores one `raw_data` payload per transaction, so a second `FILE` in the same `BATCH` would fail at the `FILE` handler rather than the `BATCH` validator. This is an architectural limit of the wire format, not an explicit `actionLimits` rule in `batch.js`.
- A `FILE` may be batched with other actions, most commonly a `MESSAGE` v2 (ECIES) carrying the file's symmetric key, so that publishing a [token-gated file](../token-gated-content.md) and committing the key happen atomically in one transaction.
- `BATCH(SEND, MESSAGE)` is the canonical composition for transferring a token that has [active gated content](./send.md), the `MESSAGE` is required and re-encrypts the content keys to the recipient.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
