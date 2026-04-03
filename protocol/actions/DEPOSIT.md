<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - DEPOSIT
This action transfers tokens from the broadcasting address into a contract's custody.

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
Deposit 1000 MYTOKEN into the custody of contract 12345
```

```
DEPOSIT|0|12345|^99|500
Deposit 500 of the token with TICK_ID 99 into the custody of contract 12345
```

## Rules
- Available on all chains
- The contract identified by `CONTRACT_ACTION_INDEX` must exist and be in an active state
- `SOURCE` address must hold a sufficient balance of `TICK` to cover `QUANTITY`
- No gas fee is charged; the on-chain transaction cost is sufficient
- `QUANTITY` must be a positive value

## Notes
- Deposited tokens are held in the contract's custody balance and are no longer spendable by the broadcasting address until withdrawn
- Use `WITHDRAW` to return tokens from contract custody back to the contract owner
- Use `^` (caret) as a prefix when passing `TICK_ID` for the `TICK` field (e.g. `^1234` = `TICK_ID` 1234)
- Contracts may use deposited balances in method logic triggered via `EXECUTE`

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
