<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - MINT
This action mints `TICK` supply.

> **Wallet issuer flow.** The [xchain-wallet](https://github.com/XChain-Platform/xchain-wallet) *Manage Token* surface (reached from *My Tokens*) wraps `MINT` in a guided UI with owner-gate and confirm-prelude steps, alongside the other issuer actions (`ISSUE`, `DESTROY`, `DIVIDEND`, `AIRDROP`, `BROADCAST`, supply/description locks, ownership transfer, dispenser creation). The protocol fields below remain canonical; the wallet is one of several clients that can build a `MINT` transaction.

## PARAMS
| Name          | Type   | Description                          |
| ------------- | ------ | ------------------------------------ |
| `VERSION`     | String | Format Version                       |
| `TICK`        | String | Ticker name or Ticker ID             |
| `AMOUNT`      | String | Amount of `TICK` to mint             |
| `DESTINATION` | String | Address to transfer minted `TICK` to |
| `MEMO`        | String | An optional memo to include          |

## Formats

### Version `0`
- `VERSION|TICK|AMOUNT|DESTINATION|MEMO`

## Examples
```
MINT|0|JDOG|1
This example mints 1 JDOG `token` to the broadcasting address
```

```
MINT|0|BRRR|10000000000000|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev
This example mints 10,000,000,000,000 BRRR tokens and transfers them to 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev 
```

## Rules
- `TICK` supply may be minted until `MAX_SUPPLY` is reached.
- Transactions that attempt to mint supply beyond `MAX_SUPPLY` shall be considered invalid and ignored.
- If the token sets `MINT_ADDRESS_MAX`, the total an address has minted plus the new `AMOUNT` must not exceed it. At/after the `MINT_SELF_MINTED_ONLY` flag-day only mints the address itself broadcast count toward its allowance; before it, `MINT` supply the address received as another mint's `DESTINATION` also counts.
- If the token binds a `mint`-class controller (or the catch-all `all`), the contract's `guard` runs before the mint settles and may `revert` it; `SOURCE` pays the bounded guard gas. See [Controller-Bound Tokens](../Controller_Bound_Tokens.md).

## Notes
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)
- Use `^` (caret) as prefix when passing an `ADDRESS_ID` for `DESTINATION` (^57 = `ADDRESS_ID` 57); see [Index ID References](../Index_Id_References.md)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
