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

```
EXECUTE|0|12345|increment
Execute the 'increment' method on contract 12345 with no parameters
```

## Rules
- Available on all chains
- The contract identified by `CONTRACT_ACTION_INDEX` must exist and be in an active (valid) state
- `METHOD` is required — if the contract exports a single function, the method name is ignored; if it exports an object, the named method must exist
- `SOURCE` address must hold sufficient XCHAIN tokens to cover the gas fee
- Gas fee is calculated as the actual gas consumed during VM execution, multiplied by the gas price
- If execution fails (revert, out of gas, runtime error), the caller is still charged gas up to the failure point
- All state changes and emitted actions are processed atomically via a database savepoint:
  - If any emitted action fails validation, ALL state changes and ALL earlier emissions are rolled back
  - The caller's gas is still charged (outside the savepoint)
- Contracts can emit up to 50 platform actions per execution
- The contract's derived address (`C:<CHAIN>:<CONTRACT_ACTION_INDEX>`) is used as the source for all emitted actions — the contract can only spend tokens deposited to its derived address
- `PARAMS` beyond `METHOD` are pipe-delimited and passed to the contract as an array of strings

## Notes
- `CONTRACT_ACTION_INDEX` refers to the action index recorded when the contract was deployed via `DEPLOY`
- The VM executes inside a sandboxed V8 isolate — no access to the host process, filesystem, or network
- Execution is deterministic — all indexer nodes produce identical results for the same block
- Each emitted action gets its own action_index and is processed through the same handler as user-submitted actions
- Emitted actions are recorded in the `contract_emissions` table, linking them to the parent execution
- Use `DEPOSIT` to fund a contract with tokens before calling methods that emit token transfers
- Gas schedule constants (`VM_EXECUTE_BASE`, `VM_COMPUTATION`, `VM_STATE_READ`, `VM_STATE_WRITE`, `VM_EMISSION`, etc.) are defined in the gas schedule configuration

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
