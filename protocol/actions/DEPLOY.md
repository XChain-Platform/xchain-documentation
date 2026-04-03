<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - DEPLOY
This action deploys a smart contract to the XChain VM.

## PARAMS
| Name                  | Type    | Description                                        |
| --------------------- | ------- | -------------------------------------------------- |
| `VERSION`             | String  | Format Version                                     |
| `CODE_ENCODING`       | String  | Hex-encoded contract bytecode                      |
| `GAS_LIMIT`           | Integer | Maximum gas units allowed for deployment           |
| `CONSTRUCTOR_PARAMS`  | String  | Optional JSON-encoded constructor parameters       |

## Formats

### Version `0`
- `VERSION|CODE_ENCODING|GAS_LIMIT|CONSTRUCTOR_PARAMS`

## Examples
```
DEPLOY|0|<hex_code>|200000|{"name":"MyToken"}
Deploy a contract with hex-encoded bytecode, a gas limit of 200000, and a JSON constructor argument
```

```
DEPLOY|0|<hex_code>|100000|
Deploy a contract with no constructor parameters
```

## Rules
- Available on all chains
- `CODE_ENCODING` must be valid hex-encoded contract bytecode and must not exceed 64KB (65536 bytes decoded)
- `GAS_LIMIT` must be a positive integer
- A gas fee is charged at deployment: `DEPLOY_BASE + (code_bytes * DEPLOY_PER_BYTE)`
- `SOURCE` address must hold sufficient XCHAIN tokens to cover the gas fee
- `CONSTRUCTOR_PARAMS` is optional; if omitted or empty, no constructor arguments are passed
- If the gas consumed during deployment exceeds `GAS_LIMIT`, the deployment fails and gas is still charged

## Notes
- The deployed contract is assigned an action index derived from the transaction that contains this action
- Use `EXECUTE` to call methods on a deployed contract
- Use `DEPOSIT` and `WITHDRAW` to transfer token balances into and out of contract custody
- `DEPLOY_BASE` and `DEPLOY_PER_BYTE` constants are defined in the hub config

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
