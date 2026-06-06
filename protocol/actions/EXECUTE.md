<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

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
- The VM executes inside a sandboxed V8 isolate — no access to the host process, filesystem, or network. Contracts that need outside-world data emit `ATTEST v0` requests via `xchain.attestation.request(...)`; the validator network delivers the answer asynchronously through a system-synthesized EXECUTE — see below.
- Execution is deterministic — all indexer nodes produce identical results for the same block
- Each emitted action gets its own action_index and is processed through the same handler as user-submitted actions
- Emitted actions are recorded in the `contract_emissions` table, linking them to the parent execution
- Use `DEPOSIT` to fund a contract with tokens before calling methods that emit token transfers
- Gas schedule constants (`VM_EXECUTE_BASE`, `VM_COMPUTATION`, `VM_STATE_READ`, `VM_STATE_WRITE`, `VM_EMISSION`, `VM_ATTEST_REQUEST`, etc.) are defined in the gas schedule configuration

## System-Synthesized EXECUTE (attestation callbacks)
When an `ATTEST v1` response (or `ATTEST v2` expiry) is accepted on-chain, the indexer synthesizes a fresh `EXECUTE` invoking the original `xchain.attestation.request(..., callbackMethod, callbackParams, ...)`. This is the same EXECUTE action used by users — same handler, same gas accounting, same emission semantics — with two differences:

- **No external `SOURCE`.** The synthesized EXECUTE's `SOURCE` is set to the contract's own derived address. Inside the callback, `xchain.getSourceAddress() === xchain.getContractAddress()`.
- **Pre-built parameter list.** The first four params are always `[request_id, provider_id, status, response_payload]`; the original `callbackParams` from the v0 request follow.

Status values (`xchain.getInputParam(2)`): `ok` (response payload valid), `timeout`, `no_quorum`, `provider_error`, or `expired` (deadline reached with no v1).

Callback execution is wrapped in its own savepoint — if the callback method throws, runs out of gas, or otherwise fails, the response row in `attestation_responses` is still durably recorded (so the validator network isn't asked to redo the work), and the contract's own state changes from the callback roll back. The v0 → v1 → callback chain is atomic for the v1 record but graceful-degrade for the callback's side effects.

See [`ATTEST.md`](./ATTEST.md) for the wire-level lifecycle.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
