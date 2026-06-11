<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - LINK
This action links actions using `ACTION_INDEX`, including linking actions across blockchains.

## PARAMS
| Name                 | Type   | Description                                 |
| -------------------- | ------ | ------------------------------------------- |
| `VERSION`            | String | Format Version                              |
| `COIN1`              | String | `COIN` name (BTC, LTC, DOGE, etc)           |
| `COIN1_ACTION_INDEX` | String | `ACTION_INDEX` of action on `COIN1` network |
| `COIN2`              | String | `COIN` name (BTC, LTC, DOGE, etc)           |
| `COIN2_ACTION_INDEX` | String | `ACTION_INDEX` of action on `COIN2` network |
| `MEMO`               | String | An optional memo to include                 |

## Formats

### Version `0`
- `VERSION|COIN1|COIN1_ACTION_INDEX|COIN2|COIN2_ACTION_INDEX|MEMO`

## Examples
```
LINK|0|BTC|1234|BTC|4321|Linking FILE upload to TICK
This example links a BTC `FILE` upload with `ACTION_INDEX` 1234 with a BTC `ISSUE` transaction on a `TICK` associated with `ACTION_INDEX` 4321
```

```
LINK|0|BTC|1234|DOGE|6666|Linking TICK with FILE upload on DOGE
This example links a BTC `FILE` upload with `ACTION_INDEX` 1234 with a DOGE `ISSUE` transaction on a `TICK` associated with `ACTION_INDEX` 6666
```

## Rules
- `COIN1` and `COIN2` values must be a valid coin network (BTC, LTC, DOGE, etc)
- `COIN1_ACTION_INDEX` must point to a valid `ACTION_INDEX` on the `COIN1` network
- `COIN2_ACTION_INDEX` must point to a valid `ACTION_INDEX` on the `COIN2` network
- When `COIN2_ACTION_INDEX` resolves to a local `ISSUE` (i.e. linking against a `TICK`):
    - `SOURCE` must be the current owner of that `TICK`
    - The `TICK`'s ownership must not be currently escrowed (`ORDER` / `SWAP` / `DISPENSER` with `GIVE_OWNERSHIP=1` is open against this `TICK`) — see [Token Ownership Sales](./ORDER.md#token-ownership-sales)
    - Cross-chain `ISSUE` targets cannot be validated locally; the owner / escrow checks are skipped when `COIN2` is not the local network

## Notes
- `LINK`'s primary use case is attaching a `FILE` to a `TICK` (logo, terms, documentation), but it is a generic action-to-action pointer and supports other pairings (cross-chain attestation, etc.)
- The owner-validation rule above makes `LINK` the official content-association mechanism for NFTs — only a token's owner can attach files to it. The protocol attaches no display semantics to linked files; what renders is decided by the token's [Token Information Standard](../Token_Information_Standard.md) metadata. See the [NFT Standard](../NFT_Standard.md).
- The same rule makes `LINK` the attestation mechanism for project registries — a `TICK`-type `LIST` linked to a token's `ISSUE` by its owner is that project's official-token roster. See the [Project Registry Standard](../Project_Registry.md).

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
