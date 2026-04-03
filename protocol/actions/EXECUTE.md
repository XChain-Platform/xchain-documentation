<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - EXECUTE
This action executes a method on a deployed XChain VM contract.

## PARAMS
| Name                    | Type    | Description                                        |
| ----------------------- | ------- | -------------------------------------------------- |
| `VERSION`               | String  | Format Version                                     |
| `CONTRACT_ACTION_INDEX` | Integer | Action index of the deployed contract              |
| `METHOD`                | String  | Method name to call on the contract                |
| `PARAMS`                | String  | Additional pipe-delimited method parameters        |

## Formats

### Version `0`
- `VERSION|CONTRACT_ACTION_INDEX|METHOD|PARAMS...`

## Examples
```
EXECUTE|0|12345|transfer|addr1|100
Execute the 'transfer' method on contract 12345, passing 'addr1' and '100' as parameters
```

```
EXECUTE|0|12345|balanceOf|addr1
Execute the 'balanceOf' method on contract 12345, passing 'addr1' as a parameter
```

## Rules
- Available on all chains
- The contract identified by `CONTRACT_ACTION_INDEX` must exist and be in an active state
- A gas fee is charged: `EXECUTE_BASE + metered gas consumed by the method`
- `SOURCE` address must hold sufficient XCHAIN tokens to cover the gas fee
- If the gas consumed during execution exceeds the metered limit, the execution fails and gas is still charged
- `PARAMS` may be empty if the called method requires no arguments

## Notes
- `CONTRACT_ACTION_INDEX` refers to the action index recorded when the contract was deployed via `DEPLOY`
- Method parameters beyond `METHOD` are pipe-delimited and parsed in order by the contract
- Use `DEPOSIT` to fund a contract with tokens before calling methods that require a balance
- `EXECUTE_BASE` constant is defined in the hub config

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
