<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - DEPLOY
This action deploys a smart contract to the XChain VM.

## PARAMS
| Name                  | Type    | Description                                        |
| --------------------- | ------- | -------------------------------------------------- |
| `VERSION`             | String  | Format Version                                     |
| `CODE_ENCODING`       | String  | Hex-encoded UTF-8 contract source code             |
| `GAS_LIMIT`           | Integer | Maximum gas units allowed for deployment           |
| `CONSTRUCTOR_PARAMS`  | String  | Optional pipe-delimited constructor parameters     |

## Formats

### Version `0`
- `VERSION|CODE_ENCODING|GAS_LIMIT|CONSTRUCTOR_PARAMS`

## Examples
```
DEPLOY|0|<hex_code>|200000|arg1|arg2
Deploy a contract with hex-encoded source code, a gas limit of 200000, and constructor arguments
```

```
DEPLOY|0|<hex_code>|100000|
Deploy a contract with no constructor parameters
```

## Rules
- Available on all chains
- `CODE_ENCODING` must be valid hex-encoded UTF-8 JavaScript source code and must not exceed 64KB (65536 bytes decoded)
- `GAS_LIMIT` must be a positive integer
- The VM validates syntax before charging gas:
  1. V8 compilation check — rejects JavaScript syntax errors
  2. Acorn metering pass — rejects syntax beyond ES2020 (the supported syntax set)
  3. Reserved identifier check — rejects code containing `__gas` (reserved for gas metering)
- If syntax validation fails, the deployment is rejected with `invalid: CODE_ENCODING (<reason>)` and no gas is charged
- A non-blocking float usage warning is generated if decimal number literals are detected (visible in the execution record)
- A gas fee is charged at deployment: `VM_DEPLOY_BASE + (code_bytes * VM_DEPLOY_PER_BYTE)`
- `SOURCE` address must hold sufficient XCHAIN tokens to cover the gas fee
- If `CONSTRUCTOR_PARAMS` is provided, the VM executes the contract's `initialize` method immediately after deployment:
  - Constructor gas is added to the deployment gas: `total_gas = deploy_gas + constructor_gas`
  - If the constructor fails (reverts, out of gas, etc.), the entire deployment is rolled back — the contract is not stored
  - The caller pays the combined gas even on constructor failure
- A **derived address** is created for the contract in the format `C:<CHAIN>:<ACTION_INDEX>` (e.g., `C:BTC:500`). This address participates in the standard balance system for token custody via DEPOSIT/WITHDRAW.

## Notes
- The deployed contract is assigned an action index derived from the transaction that contains this action
- `CODE_ENCODING` is hex-encoded UTF-8 — decode with `Buffer.from(hex, 'hex').toString('utf8')`
- The `contracts` table stores the decoded plain-text JavaScript, not the hex encoding
- The `api_version` field (default 1) determines which gateway API version the contract targets
- Use `EXECUTE` to call methods on a deployed contract
- Use `DEPOSIT` and `WITHDRAW` to transfer token balances into and out of the contract's derived address
- Deployed contracts are **immutable** — there is no mechanism to update code after deployment
- `VM_DEPLOY_BASE` and `VM_DEPLOY_PER_BYTE` constants are defined in the gas schedule configuration

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
