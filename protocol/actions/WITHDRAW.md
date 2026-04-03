<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - WITHDRAW
This action withdraws tokens from a contract's custody back to the contract owner.

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
Withdraw 500 MYTOKEN from the custody of contract 12345 to the contract owner
```

```
WITHDRAW|0|12345|^99|250
Withdraw 250 of the token with TICK_ID 99 from the custody of contract 12345
```

## Rules
- Available on all chains
- The contract identified by `CONTRACT_ACTION_INDEX` must exist and be in an active state
- Only the contract owner (the address that broadcast the original `DEPLOY` action) may withdraw
- The contract must hold a sufficient custody balance of `TICK` to cover `QUANTITY`
- No gas fee is charged; the on-chain transaction cost is sufficient
- `QUANTITY` must be a positive value

## Notes
- Withdrawn tokens are credited to the contract owner's address
- Use `DEPOSIT` to add tokens to a contract's custody balance
- Use `^` (caret) as a prefix when passing `TICK_ID` for the `TICK` field (e.g. `^1234` = `TICK_ID` 1234)
- Contracts may also return tokens to users via internal logic triggered by `EXECUTE`; `WITHDRAW` is specifically for owner-initiated withdrawals

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
