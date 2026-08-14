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

```
BATCH|0|ISSUE|0|JDOG;ISSUE|0|JDOG.1;ISSUE|0|JDOG.2;ISSUE|0|JDOG.3
This example registers the JDOG parent token and three of its children in one transaction
```

## Rules
- Can only use one top-level (undotted) `ISSUE` action in a `BATCH` action
- Child `ISSUE` actions, whose `TICK` contains a `.` (for example `JDOG.1`), are exempt from that limit: a `BATCH` may carry any number of them, subject to the command cap below
- Can only use one `MINT` action in a `BATCH` action
- Can not use `BATCH` as a action in a `BATCH` action
- A `BATCH` may carry at most 250 commands

## Notes
- `COMMANDS` are separated by a semi-colon `;`
- **Sub-commands are not atomic.** Each command is validated and settled on its own, in list order, and each gets its own `ACTION_INDEX` and its own status. A command that fails is recorded invalid by itself; the commands before it stand and the commands after it are still attempted. What the transaction guarantees is a shared sender, a shared confirmation and a shared position in the block, not all-or-nothing settlement. Some faults do reject the whole `BATCH` as a single record before any command runs (see the batch-level rejections below), but a per-command validation failure is not one of them.
- **Bulk child issuance (flag-day gated).** At/above the `BATCH_ISSUANCE_LIMITS` activation, an `ISSUE` whose `TICK` contains a `.` no longer consumes the single top-level `ISSUE` slot, so `ISSUE JDOG; ISSUE JDOG.1; ISSUE JDOG.2; ...` is one transaction rather than one transaction per child. The parent may be registered in the same `BATCH` as its children: a command reads the state left by every command before it, so a parent written at a lower action index is already visible to the child that follows. Repeated `ISSUE` commands against the SAME dotted `TICK` are also legal in one `BATCH`, which is what lets create, add supply, lock and transfer-ownership run as a sequence.
- **A caret `TICK` is never exempt.** In the `^<id>` form the dot is an id separator, not a namespace separator (see [Index ID References](../index-id-references.md)), so `^614.5` counts against the top-level limit rather than being treated as a child. An `ISSUE` whose `TICK` is a caret form containing a `.` is invalid (`invalid: TICK (caret dot)`).
- **Command cap.** A `BATCH` may carry at most 250 commands. The count is the raw `;`-separated list after the `BATCH|<VERSION>|` prefix, **including empty elements**, so 250 commands followed by a trailing `;` counts as 251 and is over the cap. The cap is checked FIRST, before every other batch-level rule, so a `BATCH` that breaks the cap and some other rule reports the cap (`invalid: COMMAND (limit)`). It is a denial-of-service bound rather than a product quota: an issuer with 500 children uses two transactions. Both the cap and the child exemption activate together at `BATCH_ISSUANCE_LIMITS`.
- **Fees and settlement value are accounted cumulatively across the batch.** One command's worth of native-coin fee funds ONE sub-command, not all of them. The same running tally covers the settlement value a `COINPAY` or a `DISPENSE` draws down and the per-oracle fee outputs a `DISPENSER` pays. Fund a `BATCH` for the sum of its commands, not for one of them; a command that reaches an exhausted fee pool fails with a fee error while its siblings stand.
- **Batch-level rejections** invalidate the whole `BATCH` as one record, before any command runs: an unknown `VERSION`, a command naming an action that is not enabled (an empty command counts), more than one `MINT` or top-level `ISSUE`, a nested `BATCH`, a sleeping `SOURCE`, going over the command cap, and a source that provably cannot pay for even the cheapest command in the list (`invalid: GAS (insufficient)`). That last check is a lower bound only: gas is billed greedily in list order against one running balance, so a source that can afford some of the commands is let through and lands exactly the ones it can pay for.
- **Activation.** The child-issuance exemption, the caret-dot rejection, the 250-command cap, the cumulative fee and settlement accounting, and the aggregate gas pre-check all activate together at `BATCH_ISSUANCE_LIMITS`. That gate is **active from genesis on testnet and regtest**, and on **mainnet it activates at `2026-08-16T00:00:00Z`**. Sub-command output capture (`BATCH_SUBCOMMAND_OUTPUT_CAPTURE_ACTIVATION`, which is what lets a batched `COINPAY` or `DISPENSER` be seen at all) activates at the **same instant** on mainnet, so the two halves of batch behavior arrive together rather than leaving a window where one is live and the other is not. Below that instant, mainnet history keeps the behavior it always had: one `ISSUE` per `BATCH` (dotted or not), no command cap, and per-command fee checks that each read the transaction's untouched value. Blocks before the instant are unaffected, which is why the instant was set in the future rather than backdated. The non-atomic settlement described above is not gated: it has always been how a `BATCH` behaves.
- **Sub-action normalization (flag-day gated):** until the `BATCH_SUBACTION_NORMALIZATION` activation (mainnet: the coordinated [contract-era flag day](../flag-days.md#contract-era-flag-day); testnet/regtest active from genesis), sub-actions inside a `BATCH` are NOT normalized the way top-level actions are. `ACTION` aliases (`TRANSFER`, `ADDR`, `DROP`, `CAST`, `MSG`) invalidate the whole `BATCH` (`invalid: ACTION (unknown)`), and legacy `ISSUE`/`MINT`/`SEND` params that omit the `VERSION` field are misparsed (the first param is read as the format version). Until activation, always use canonical `ACTION` names and an explicit `VERSION` in every `BATCH` command on mainnet. At/after activation, sub-actions get the same alias rewrite and legacy VERSION-0 injection as top-level actions.
- A `BATCH` may contain at most one `FILE` action. The decoder stores one `raw_data` payload per transaction, so a second `FILE` in the same `BATCH` would fail at the `FILE` handler rather than the `BATCH` validator. This is an architectural limit of the wire format, not an explicit `actionLimits` rule in `batch.js`.
- A `FILE` may be batched with other actions, most commonly a `MESSAGE` v2 (ECIES) carrying the file's symmetric key, so that publishing a [token-gated file](../token-gated-content.md) and committing the key happen in one transaction. The two commands still settle independently, so check that both were recorded valid rather than assuming the pair moved as a unit.
- `BATCH(SEND, MESSAGE)` is the canonical composition for transferring a token that has [active gated content](./send.md), the `MESSAGE` is required and re-encrypts the content keys to the recipient.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
