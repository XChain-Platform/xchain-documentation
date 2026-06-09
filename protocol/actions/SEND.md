<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - SEND
This action sends one or more `TICK` to an `ADDRESS`.

## PARAMS
| Name          | Type   | Description                 |
| ------------- | ------ | --------------------------- |
| `VERSION`     | String | Format Version              |
| `TICK`        | String | Ticker name or Ticker ID    |
| `AMOUNT`      | String | Amount of `TICK` to send    |
| `DESTINATION` | String | Address to send `TICK` to   |
| `MEMO`        | String | An optional memo to include |

## Formats

### Version `0` - Single Send
- `VERSION|TICK|AMOUNT|DESTINATION|MEMO`

### Version `1` - Multi-Send (Brief)
- `VERSION|TICK|AMOUNT|DESTINATION|AMOUNT|DESTINATION|MEMO`

### Version `2` - Multi-Send (Full)
- `VERSION|TICK|AMOUNT|DESTINATION|TICK|AMOUNT|DESTINATION|MEMO`

### Version `3` - Multi-Send (Full) with Multiple Memos
- `VERSION|TICK|AMOUNT|DESTINATION|MEMO|TICK|AMOUNT|DESTINATION|MEMO`


## Examples
```
SEND|0|JDOG|1|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev
This example sends 1 JDOG token to 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev
```

```
SEND|0|BRRR|5|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|BTNS is Awesome
This example sends 5 BRRR tokens to 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev with a memo
```

```
SEND|1|BRRR|5|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|1|1BoogrfDADPLQpq8LMASmWQUVYDp4t2hF9
This example sends 5 BRRR tokens to 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev and 1 BRRR token to 1BoogrfDADPLQpq8LMASmWQUVYDp4t2hF9
```

```
SEND|2|BRRR|5|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|TEST|1|1BoogrfDADPLQpq8LMASmWQUVYDp4t2hF9|BTNS is Awesome
This example sends 5 BRRR tokens to 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev and 1 TEST token to 1BoogrfDADPLQpq8LMASmWQUVYDp4t2hF9 with a memo
```

## Rules
- A `TICK` send shall only be considered valid if the `SOURCE` address has balances of the `TICK` to cover the send `AMOUNT`
- A `TICK` send that does _not_ have `AMOUNT` in the `SOURCE` address shall be considered invalid and ignored.
- A valid `TICK` send will debit the `TICK` `AMOUNT` from the `SOURCE` address balances
- A valid `TICK` send will credit the `TICK` `AMOUNT` to the `DESTINATION` address or addresses
- `MEMO` characters **NOT** allowed are :
   - pipe `|` (used as field separator)
   - semicolon `;` (used as command separator)
- **Token-gated transfer rule.** If `TICK` has at least one active gated [`FILE`](./FILE.md) (a `FILE` with a non-empty `GATE_TICKER = TICK` that has not been superseded), the `SEND` is only valid when it appears in the **same transaction** as a [`MESSAGE` v2](./MESSAGE.md) (ECIES) addressed to the `DESTINATION`. Typically the sending wallet composes this as `BATCH(SEND, MESSAGE)`. If the sibling `MESSAGE` is missing, the `SEND` is rejected; sibling actions (if any) survive. The indexer enforces the structural presence of the MESSAGE; the wallet enforces the cryptographic correctness of the key payload at unlock time. See [Token-Gated Content](../Token_Gated_Content.md).

## Notes
- `TRANSFER` action can be used for compatability with BRC20/SRC20 `TRANSFER`
- Format version `0` allows for a single send
- Format version `1` allows for repeating `AMOUNT` and `DESTINATION` params to enable multiple transfers
- Format version `2` allows for repeating `TICK`, `AMOUNT` and `DESTINATION` params to enable multiple transfers
- Format version `3` allows for repeating `TICK`, `AMOUNT`, `DESTINATION`, and `MEMO` params to enable multiple transfers
- Format version `0`, `1`, and `2` allow for a single optional `MEMO` field to be included as the last PARAM
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
