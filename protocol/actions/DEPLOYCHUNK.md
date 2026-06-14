<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - DEPLOYCHUNK
Carries one ordered base64 slice of a smart contract's source code so a contract too large for a single [`DEPLOY`](./DEPLOY.md) action can be uploaded across several transactions and then assembled by a chunked DEPLOY (v2/v3).

A `DEPLOYCHUNK` runs no contract code — it only validates and stores its slice (and pays the per-byte gas for the bytes it puts on-chain). The slices are grouped by `CODE_HASH` (the sha256 of the fully assembled UTF-8 source), which is both the group id and the integrity check.

## PARAMS
| Name           | Type    | Description                                                                |
| -------------- | ------- | -------------------------------------------------------------------------- |
| `VERSION`      | String  | Format Version (0)                                                         |
| `CODE_HASH`    | String  | sha256 hex of the fully assembled UTF-8 source — the chunk-group id        |
| `CHUNK_INDEX`  | Integer | 0-based position of this slice within the group                           |
| `TOTAL_CHUNKS` | Integer | Declared number of slices in the group (`1..MAX_DEPLOY_CHUNKS`)            |
| `CODE_PART`    | String  | One base64 slice of `base64(code)`. Plain concatenation of all parts in `CHUNK_INDEX` order restores `base64(code)` exactly, so slices need not be 4-char aligned. |

## Formats

### Version `0`
- `VERSION|CODE_HASH|CHUNK_INDEX|TOTAL_CHUNKS|CODE_PART`

## Examples
```
DEPLOYCHUNK|0|4651d57c...b6021765|0|3|<base64_slice_0>
First of three slices for the contract whose assembled source hashes to 4651d5…
```
```
DEPLOYCHUNK|0|4651d57c...b6021765|2|3|<base64_slice_2>
Final slice of the same group
```

## Rules
- Available on all chains.
- `CODE_HASH` must be a 64-char lowercase sha256 hex string.
- `CHUNK_INDEX` and `TOTAL_CHUNKS` must be non-negative integers with `CHUNK_INDEX < TOTAL_CHUNKS`, and `TOTAL_CHUNKS` in `[1, MAX_DEPLOY_CHUNKS]`.
- `CODE_PART` must be a non-empty base64-alphabet string (`A–Za–z0–9+/=`) no larger than `MAX_DEPLOYCHUNK_PART_BYTES`. It is a *slice* of `base64(code)` and is **not** individually decoded — the assembling DEPLOY concatenates every slice then decodes and sha256-verifies the whole, so a corrupt or misordered slice surfaces as `invalid: CODE_HASH (assembly mismatch)` on the DEPLOY, not here.
- **Gas:** a valid `DEPLOYCHUNK` is charged `len(CODE_PART) × VM_DEPLOY_PER_BYTE` (valued at `GAS_PRICE`), payable in XCHAIN or — when a `FEE_DESTINATION` output is present — the native coin, exactly like DEPLOY. An invalid chunk is recorded with its rejection status and charged nothing.

## Notes
- Every chunk (valid or invalid) is recorded so the explorer can surface its status; a chunked DEPLOY assembles only the **valid** chunks, and if a deployer broadcasts the same `(source, CODE_HASH, CHUNK_INDEX)` more than once the lowest action index deterministically wins. A duplicate or invalid chunk can therefore never block a position from being filled by a valid earlier one.
- Submit the chunks **before** the assembling DEPLOY: a DEPLOY v2/v3 only consumes chunks recorded at a lower action index than itself (which also makes reorg rollback automatic — removing a chunk removes the dependent DEPLOY).
- The SDK orchestrates this automatically: `sdk.deployContract` uploads the necessary `DEPLOYCHUNK`s (awaiting indexer confirmation of each) and then submits the assembling DEPLOY, falling back to a single inline DEPLOY when the source fits one action.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
