<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - DEPOSIT
This action transfers tokens from the broadcasting address into a contract's custody via its derived address.

## PARAMS
| Name                    | Type    | Description                               |
| ----------------------- | ------- | ----------------------------------------- |
| `VERSION`               | String  | Format Version                            |
| `CONTRACT_ACTION_INDEX` | Integer | Action index of the deployed contract     |
| `TICK`                  | String  | Ticker name or Ticker ID                  |
| `QUANTITY`              | String  | Amount of `TICK` to deposit               |

## Formats

### Version `0`
- `VERSION|CONTRACT_ACTION_INDEX|TICK|QUANTITY`

## Examples
```
DEPOSIT|0|12345|MYTOKEN|1000
Deposit 1000 MYTOKEN into contract 12345 (credits C:BTC:12345 on Bitcoin; the prefix varies by chain: C:BTC:, C:LTC:, C:DOGE:)
```

```
DEPOSIT|0|12345|^99|500
Deposit 500 of the token with TICK_ID 99 into contract 12345
```

## Rules
- Available on all chains
- The contract identified by `CONTRACT_ACTION_INDEX` must exist and be in an active state
- `SOURCE` address must hold a sufficient balance of `TICK` to cover `QUANTITY`
- From the [`CONTROLLER_CUSTODY_GUARD` flag day](../flag-days.md), a deposit runs the token's `transfer` or `all` controller guard and then the depositor's own address controller guard. The guarded move is from the depositor (`SOURCE`) to the contract custody address `C:<CHAIN>:<index>`, where `<index>` is `CONTRACT_ACTION_INDEX`. See the [controller guard model](../controller-bound-tokens.md).
- The metered guard gas for both runs is paid by `SOURCE` in `GAS` and burned. The action fails with `insufficient funds (guard gas)` when `SOURCE` cannot cover the reservation.
- An unbound token moved by an unbound address runs neither guard and pays no guard gas.
- `QUANTITY` must be a positive value with valid decimal format for the token

## Notes
- Deposited tokens are credited to the contract's **derived address** (`C:<CHAIN>:<CONTRACT_ACTION_INDEX>`) in the standard ledger; a debit is created for SOURCE and a credit for the derived address
- The contract's balance is tracked in the standard `balances` table, the same as any other address. There is no separate custody table.
- Use `WITHDRAW` to return tokens from the contract back to the contract owner. Only the contract deployer (the address that originally broadcast the `DEPLOY`) may call `WITHDRAW`; no other address can withdraw from the contract.
- Use `^` (caret) as a prefix when passing `TICK_ID` for the `TICK` field (e.g. `^1234` = `TICK_ID` 1234)
- Contracts may use deposited balances in method logic triggered via `EXECUTE`, emitted actions spend from the derived address

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
