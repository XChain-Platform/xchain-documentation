<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

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
- The contract's derived address (`C:<CHAIN>:<CONTRACT_ACTION_INDEX>`) must hold a sufficient balance of `TICK` to cover `QUANTITY`
- No gas fee is charged; the on-chain transaction cost is sufficient
- `QUANTITY` must be a positive value with valid decimal format for the token

## Notes
- Withdrawn tokens are debited from the contract's **derived address** and credited to the contract owner's address in the standard ledger
- The solvency check uses the standard `balances` table via `getAddressBalances()` on the derived address
- Use `DEPOSIT` to add tokens to a contract's derived address
- Use `^` (caret) as a prefix when passing `TICK_ID` for the `TICK` field (e.g. `^1234` = `TICK_ID` 1234)
- Contracts may also return tokens to users via emitted SEND actions triggered by `EXECUTE`; `WITHDRAW` is specifically for owner-initiated withdrawals
- WITHDRAW does not require the contract to be active — owners can recover tokens from disabled contracts

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
