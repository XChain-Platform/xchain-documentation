<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - DESTROY
This action destroys `TICK` supply.

> **Wallet issuer flow.** The [xchain-wallet](https://github.com/XChain-platform/xchain-wallet) *Manage Token* surface (reached from *My Tokens*) wraps `DESTROY` in a guided UI with owner-gate and confirm-prelude steps, alongside the other issuer actions (`ISSUE`, `MINT`, `DIVIDEND`, `AIRDROP`, `BROADCAST`, supply/description locks, ownership transfer, dispenser creation). The protocol fields below remain canonical; the wallet is one of several clients that can build a `DESTROY` transaction.

## PARAMS
| Name      | Type   | Description                 |
| --------- | ------ | --------------------------- |
| `VERSION` | String | Format Version              |
| `TICK`    | String | Ticker name or Ticker ID    |
| `AMOUNT`  | String | Amount of `TICK` to destroy |
| `MEMO`    | String | An optional memo to include |

## Formats

### Version `0`
- `VERSION|TICK|AMOUNT|MEMO`

### Version `1`
- `VERSION|TICK|AMOUNT|TICK|AMOUNT|MEMO`

### Version `2`
- `VERSION|TICK|AMOUNT|MEMO|TICK|AMOUNT|MEMO`


## Examples
```
DESTROY|0|BRRR|1
This example destroys 1 BRRR token from the broadcasting address
```

```
DESTROY|1|BRRR|1|GAS|10
This example destroys 1 BRRR token and 10 GAS tokens from the broadcasting address
```

```
DESTROY|2|BRRR|1|foo|GAS|10|bar
This example destroys 1 BRRR token with the memo `foo`, and 10 GAS tokens with the memo `bar` from the broadcasting address
```

## Rules
- Any destroyed `TICK` supply will be debited from broadcasting address balances

## Notes
- Format version `0` allows for a single destroy
- Format version `1` allows for repeating `TICK` and `AMOUNT` params to enable multiple destroys
- Format version `2` allows for repeating `TICK`, `AMOUNT`, and `MEMO` params to enable multiple destroys
- Format version `0` and `1` allow for a single optional `MEMO` field to be included as the last PARAM
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
