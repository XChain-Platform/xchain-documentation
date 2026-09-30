<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - WITHDRAW
This action withdraws tokens from a contract's derived address back to the contract owner.

## PARAMS
| Name                    | Type    | Description                               |
| ----------------------- | ------- | ----------------------------------------- |
| `VERSION`               | String  | Format Version                            |
| `CONTRACT_ACTION_INDEX` | Integer | Action index of the deployed contract     |
| `TICK`                  | String  | Ticker name or Ticker ID                  |
| `QUANTITY`              | String  | Amount of `TICK` to withdraw              |

## Formats

### Version `0`
- `VERSION|CONTRACT_ACTION_INDEX|TICK|QUANTITY`

## Examples
```
WITHDRAW|0|12345|MYTOKEN|500
Withdraw 500 MYTOKEN from contract 12345 (debits C:BTC:12345, credits the owner)
```

```
WITHDRAW|0|12345|^99|250
Withdraw 250 of the token with TICK_ID 99 from contract 12345
```

## Rules
- Available on all chains
- The contract identified by `CONTRACT_ACTION_INDEX` must exist
- Only the contract owner (the address that broadcast the original `DEPLOY` action) may withdraw
- From the [`OWNER_WITHDRAW_OPT_IN` flag day](../flag-days.md), judged after the owner check: for a contract whose `DEPLOY` lands at or after the activation, WITHDRAW is valid only when the contract's exported meta declares `ownerWithdraw: true`; anything else (the key absent, `false`, or any non-`true` value) fails with `invalid: CONTRACT_ACTION_INDEX (owner withdraw not enabled)`. A contract deployed before the activation keeps the pre-flag-day behavior: the owner may withdraw regardless of meta. See [contract identity manifest](deploy.md#contract-identity-manifest-meta-required-at-the-flag-day).
- The contract's derived address (`C:<CHAIN>:<CONTRACT_ACTION_INDEX>`) must hold a sufficient balance of `TICK` to cover `QUANTITY`
- From the [`CONTROLLER_CUSTODY_GUARD` flag day](../flag-days.md), a withdrawal runs the token's `transfer` or `all` controller guard and then the withdrawer's own address controller guard. The guarded move is from the contract custody address `C:<CHAIN>:<index>` to the withdrawer (`SOURCE`), where `<index>` is `CONTRACT_ACTION_INDEX`. This applies to balances deposited before the flag day, and a denial leaves the balance in custody. See the [controller guard model](../controller-bound-tokens.md).
- The metered guard gas for both runs is paid by `SOURCE` in `GAS` and burned. The action fails with `insufficient funds (guard gas)` when `SOURCE` cannot cover the reservation.
- An unbound token moved by an unbound address runs neither guard and pays no guard gas.
- `QUANTITY` must be a positive value with valid decimal format for the token

## Notes
- Withdrawn tokens are debited from the contract's **derived address** and credited to the contract owner's address in the standard ledger
- The solvency check uses the standard `balances` table via `getAddressBalances()` on the derived address
- Use `DEPOSIT` to add tokens to a contract's derived address
- Use `^` (caret) as a prefix when passing `TICK_ID` for the `TICK` field (e.g. `^1234` = `TICK_ID` 1234)
- Contracts may also return tokens to users via emitted SEND actions triggered by `EXECUTE`; `WITHDRAW` is specifically for owner-initiated withdrawals
- WITHDRAW does not require the contract to be active; a disabled contract's owner can still recover tokens this way, but only when the contract is opted in (`meta.ownerWithdraw: true`) or was deployed before the `OWNER_WITHDRAW_OPT_IN` activation. A disabled contract that never opted in has no owner-side recovery path; its tokens leave only through the contract's own emitted SENDs, if its code still triggers any while disabled.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
