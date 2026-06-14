<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - DEPLOY
This action deploys a smart contract to the XChain VM. Two formats:

- **v0 — standard deployment.** Non-stakeable.
- **v1 — stakeable-contract deployment.** Adds `COOLDOWN_BLOCKS` + `SLASH_DESTINATION` metadata so the contract can accept [STAKE](STAKE.md) v3 actions targeting it.

## PARAMS
| Name                  | Type    | Description                                                                |
| --------------------- | ------- | -------------------------------------------------------------------------- |
| `VERSION`             | String  | Format Version (0 = standard, 1 = stakeable)                               |
| `CODE_ENCODING`       | String  | Hex-encoded UTF-8 contract source code                                     |
| `GAS_LIMIT`           | Integer | Maximum gas units allowed for deployment                                   |
| `CONSTRUCTOR_PARAMS`  | String  | Optional constructor parameters (pipe-delimited in v0; single field in v1) |
| `COOLDOWN_BLOCKS`     | Integer | v1 only — unstaking cooldown for STAKE v3 against this contract (1..100000) |
| `SLASH_DESTINATION`   | String  | v1 only — address that receives slashed stake. Pass `BURN` to send to the chain's configured burn address. Optional — defaults to BURN if `COOLDOWN_BLOCKS` is set without a destination. |

## Formats

### Version `0` — Standard (non-stakeable)
- `VERSION|CODE_ENCODING|GAS_LIMIT|CONSTRUCTOR_PARAMS`

### Version `1` — Stakeable contract
- `VERSION|CODE_ENCODING|GAS_LIMIT|CONSTRUCTOR_PARAMS|COOLDOWN_BLOCKS|SLASH_DESTINATION`
- Both staking fields are optional in the wire format. A v1 DEPLOY with empty `COOLDOWN_BLOCKS` is treated the same as a v0 deploy (the contract is *not* stakeable). `SLASH_DESTINATION` without `COOLDOWN_BLOCKS` is rejected as `invalid: SLASH_DESTINATION (requires COOLDOWN_BLOCKS)`.

## Examples
```
DEPLOY|0|<hex_code>|200000|arg1|arg2
Deploy a non-stakeable contract with constructor arguments
```

```
DEPLOY|0|<hex_code>|100000|
Deploy a non-stakeable contract with no constructor parameters
```

```
DEPLOY|1|<hex_code>|200000||1000|BURN
Deploy a stakeable contract: 1000-block cooldown on STAKE v3 unstakes,
slashed tokens go to the chain's burn address
```

```
DEPLOY|1|<hex_code>|200000||100|bc1q...recipient
Deploy a stakeable contract: 100-block cooldown, slashed tokens routed
to a specific recipient address (not BURN)
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

### Permissions manifest (optional)
- A contract may export a **permissions manifest** alongside its methods to declare its own bound; the indexer reads it deterministically at deploy time (by instantiating the module top-level — no method runs, so it works even without a constructor) and persists it to the `contract_permissions` table. Both fields are optional:
  - `permissions` — an array of action-type strings (e.g. `['SEND','ISSUE']`). The contract may emit **only** these action types, on **every** path (constructor, `EXECUTE`, or controller `guard`); any other emission is rejected fail-closed. Absent ⇒ unrestricted (the default); `[]` ⇒ the contract may emit nothing.
  - `maxTakeBps` — an integer in `[0, 10000]` that **tightens** this contract's controller royalty cap to `min(CONTROLLER_MAX_TAKE_BPS, maxTakeBps)`. Absent ⇒ the global cap applies. See [Controller-Bound Tokens](../Controller_Bound_Tokens.md#permissions-manifest).
- A **malformed manifest** (`permissions` not an array of strings, or `maxTakeBps` not an integer in range) rejects the deployment with `invalid: CONTRACT_MANIFEST (<reason>)`. The manifest is **immutable** after deployment (the code is immutable).

### Stakeable contracts (v1 staking fields)
- `COOLDOWN_BLOCKS` must be an integer in `[1, 100000]`. Sets the unstaking cooldown for STAKE v3 actions against this contract (overrides the global `STAKING.COOLDOWN_BLOCKS` for v3 unstakes on this contract).
- `SLASH_DESTINATION` accepts either an address (must be valid on the deploying chain) or the literal sentinel `BURN`. The sentinel resolves to the chain's configured burn address.
- If `COOLDOWN_BLOCKS` is set but `SLASH_DESTINATION` is empty, the indexer defaults `SLASH_DESTINATION` to the chain's burn address.
- A contract deployed with both staking fields can receive STAKE v3 actions targeting it; without them, STAKE v3 rejects with `invalid: TARGET_CONTRACT_INDEX (contract is not stakeable)`.
- Stakeable-contract metadata is **immutable** after deployment — there is no mechanism to update `COOLDOWN_BLOCKS` or `SLASH_DESTINATION` later.

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

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
