<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - SWAP
This action allows for swapping tokens across XChain platform supported blockchains.

## PARAMS
| Name                | Type   | Description                                                       |
| ------------------- | ------ | ----------------------------------------------------------------- |
| `VERSION`           | String | Format Version                                                    |
| `GIVE_COIN`         | String | `COIN` name (BTC, LTC, DOGE, etc)                                 |
| `GIVE_TICK`         | String | Ticker name or Ticker ID                                          |
| `GIVE_AMOUNT`       | String | Quantity of `GIVE_TICK` to escrow in the swap                     |
| `GET_COIN`          | String | `COIN` name (BTC, LTC, DOGE, etc)                                 |
| `GET_TICK`          | String | Ticker name or Ticker ID                                          |
| `GET_AMOUNT`        | String | Quantity of `GET_TICK` requested in return                        |
| `GET_ADDRESS`       | String | Address to receive `GET_TICK` on `GET_COIN` network               |
| `EXPIRATION`        | String | Timestamp of when swap should expire, in Unix time                |
| `ALLOW_LIST`        | String | `ACTION_INDEX` of a `LIST` of addresses allowed to match swap     |
| `BLOCK_LIST`        | String | `ACTION_INDEX` of a `LIST` of addresses NOT allowed to match swap |
| `GIVE_OWNERSHIP`    | String | When `1`, escrow ownership of `GIVE_TICK` instead of a balance amount (default `0`) |
| `GET_OWNERSHIP`     | String | When `1`, require the matcher to currently own `GET_TICK` and transfer that ownership (default `0`) |
| `MEMO`              | String | An optional memo to include                                       |
| `SWAP_ACTION_INDEX` | String | `ACTION_INDEX` of existing `SWAP`                                 |

## Formats

### Version `0` - Create Swap
- `VERSION|GIVE_COIN|GIVE_TICK|GIVE_AMOUNT|GIVE_OWNERSHIP|GET_COIN|GET_TICK|GET_AMOUNT|GET_OWNERSHIP|GET_ADDRESS|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`

### Version `1` - Cancel Swap
- `VERSION|SWAP_ACTION_INDEX|MEMO`

### Version `2` - Edit Swap
- `VERSION|SWAP_ACTION_INDEX|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`

## Examples
```
SWAP|0|BTC|RAREPEPE|1|BTC|PEPECASH|10000000.00000000|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev||||Swapping my RAREPEPE for 10M PEPECASH
This example creates a swap 1 RAREPEPE for 10,000,000.00000000 PEPECASH and includes a memo
```

```
SWAP|1|1234|Cancelling swap, no takers, much disappoint
This example cancels an existing SWAP with `ACTION_INDEX` 1234 and includes a memo
```

```
SWAP|2|1234|1767254400|||Extending SWAP until Jan 1 2026
This example updates an existing SWAP with `ACTION_INDEX` 1234, extends the `EXPIRATION` time, and includes a memo
```

```
SWAP|0|BTC|JDOG||1|LTC|WOWCOIN|5000000.00000000||LJDogZS6tQcSxwfxhv6XKKjcyicYA4Feev||||Selling JDOG ownership cross-chain for 5M WOWCOIN
This example sells JDOG (BTC-chain) ownership for 5,000,000 WOWCOIN on LTC. `GET_ADDRESS` is the LTC payout address for the matched WOWCOIN.
```

```
SWAP|0|BTC|JDOG||1|LTC|WOWPEPE||1|LJDogZS6tQcSxwfxhv6XKKjcyicYA4Feev||||Swap JDOG ownership for WOWPEPE ownership cross-chain
This example atomically swaps ownership of JDOG (BTC chain) for ownership of WOWPEPE (LTC chain). `GET_ADDRESS` is the LTC address that will become the new owner of WOWPEPE for this order's SOURCE.
```

## Rules
- `GET_COIN` value must be a valid coin network (BTC, LTC, DOGE, etc)
- `GET_ADDRESS` value must be a valid address on the given `GET_COIN` coin network (BTC, LTC, DOGE, etc.)
- `SWAP_ACTION_INDEX` must point to a valid `ACTION_INDEX` on the current `COIN` network

### Token Ownership Sales
- `GIVE_OWNERSHIP=1` requires SOURCE to be the current owner of `GIVE_TICK`; `GIVE_AMOUNT` must be empty; the ownership record moves into a protocol-held escrow state
- `GET_OWNERSHIP=1` requires the matcher's SOURCE to be the current owner of `GET_TICK`; `GET_AMOUNT` must be empty
- Ownership swaps are **single-fill only** — ownership is indivisible
- Native coin remains unsupported (consistent with existing SWAP behavior); use `ORDER` for ownership-for-coin sales
- Cross-chain ownership transfers honor the existing `GET_ADDRESS` requirement on `GET_COIN`
- While ownership is escrowed, the following actions targeting the escrowed `TICK` are rejected:
  - `ISSUE` Versions 1–5 (description/mint/lock/callback/list edits)
  - `CALLBACK`, `SLEEP`
  - `LINK` using this `TICK`'s `ISSUE` as `COIN2_ACTION_INDEX`
  - `FILE` with `GATE_TICKER` = this `TICK`
  - New child `ISSUE` using this `TICK` as a parent (period-separated name)
  - Additional `ORDER`/`SWAP`/`DISPENSER` ownership offers for this `TICK` from the original owner
- Holder-side actions are unaffected: `SEND`, `MINT` (if mint window open), `DIVIDEND` payouts, `DEPOSIT`/`WITHDRAW`, `DESTROY` of held balance
- Child `TICK`s (e.g. `JDOG.SUB1`) have independent ownership records and are **not** transferred when a parent's ownership is sold
- On match: ownership transfers atomically to the counterparty's SOURCE
- On cancel (Version 1) or `EXPIRATION`: ownership returns to the original SOURCE

### Sweep Closure
- When `SWEEP` is broadcast from this swap's SOURCE with `SWAPS=1`, the swap is cancelled and the escrowed `GIVE_TICK` balance (or `GIVE_OWNERSHIP` ownership record) is credited to the SWEEP `DESTINATION` rather than returned to SOURCE (see [`SWEEP`](./SWEEP.md))

## Notes
- `SWAP` DOES NOT work with native `COIN` (BTC, LTC, DOGE)
- Use a `DISPENSER` if you want to sell a `TICK` for `COIN` (BTC, LTC, DOGE)
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)
- `GET_ADDRESS` can be null if the `GET_COIN` network is the same as the `SWAP` transaction network (`SOURCE` is used by default)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
