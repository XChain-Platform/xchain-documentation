<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - SWEEP
This action transfers `TICK` balances, ownerships, and/or open-offer escrows from the `SOURCE` address to a `DESTINATION` address.

## PARAMS
| Name          | Type   | Description                                                                                                |
| ------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `VERSION`     | String | Format Version                                                                                             |
| `DESTINATION` | String | Address where swept tokens / ownerships / escrows are credited                                             |
| `BALANCES`    | String | Sweep `TICK` balances to `DESTINATION` (default `1`)                                                       |
| `OWNERSHIPS`  | String | Sweep `TICK` ownerships to `DESTINATION` (default `1`)                                                     |
| `ORDERS`      | String | Cancel open `ORDER`s from `SOURCE` and credit escrowed balance/ownership to `DESTINATION` (default `0`)    |
| `SWAPS`       | String | Cancel open `SWAP`s from `SOURCE` and credit escrowed balance/ownership to `DESTINATION` (default `0`)     |
| `DISPENSERS`  | String | Close open `DISPENSER`s from `SOURCE` and credit remaining escrow (balance or ownership) to `DESTINATION` (default `0`) |
| `MEMO`        | String | Optional memo to include                                                                                   |

## Formats

### Version `0`
- `VERSION|DESTINATION|BALANCES|OWNERSHIPS|ORDERS|SWAPS|DISPENSERS|MEMO`

## Examples
```
SWEEP|0|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|1|1|1|1|1
Full cleanup: sweeps balances + ownerships AND closes every open ORDER, SWAP, and DISPENSER from SOURCE. All escrowed balances and any escrowed ownerships route to DESTINATION.
```

```
SWEEP|0|1BoogrfDADPLQpq8LMASmWQUVYDp4t2hF9|0|1|0|0|0
Sweeps only `TICK` ownerships to DESTINATION; balances and open offers are untouched.
```

```
SWEEP|0|1HotWalletZZZZZZZZZZZZZZZZZZZZZZZ|1|0|1|0|0
Cleans out a hot address: sweeps all token balances and cancels any open ORDERs (escrow credited to DESTINATION), but leaves ownerships and dispensers in place.
```

```
SWEEP|0|1FinalAddressZZZZZZZZZZZZZZZZZZZZ|1|1|1|1|1|Retiring this address
All-in cleanup with a memo.
```

## Rules
- Each of `BALANCES`, `OWNERSHIPS`, `ORDERS`, `SWAPS`, `DISPENSERS` must be `0` or `1`
- `MEMO` characters **NOT** allowed are:
   - pipe `|` (used as field separator)
   - semicolon `;` (used as command separator)
- `BALANCES=1` and `OWNERSHIPS=1` only touch ticks where `SOURCE` currently holds the balance / is the current owner. Escrowed balances and escrowed ownerships are reachable only via the corresponding `ORDERS` / `SWAPS` / `DISPENSERS` flag, closing the offer is the only way to release the escrow.
- `ORDERS=1`: every open `ORDER` from `SOURCE` on the current chain is cancelled. The escrowed `GIVE_TICK` balance is credited to `DESTINATION`. If the order escrowed ownership (`GIVE_OWNERSHIP=1`), the ownership record is delivered to `DESTINATION`. Orders with pending `COINPAY` obligations follow the existing deferred-finalization rules in [`ORDER`](./ORDER.md).
- `SWAPS=1`: same as `ORDERS=1`, applied to open `SWAP`s. Escrowed balance or ownership routes to `DESTINATION`.
- `DISPENSERS=1`: every open `DISPENSER` from `SOURCE` is closed via the standard dispenser-close window (1 hour). Remaining escrowed balance or escrowed ownership is credited to `DESTINATION` (see [`DISPENSER`](./DISPENSER.md)).
- Escrow routing via `ORDERS` / `SWAPS` / `DISPENSERS` is independent of the `OWNERSHIPS` flag, escrowed ownership is in protocol custody, not in `SOURCE`'s ownership records, so `OWNERSHIPS=1` alone cannot reach it.

## Notes
- `DISPENSERS=1` closure is delayed by the standard dispenser-close window (1 hour). Escrow routing to `DESTINATION` happens at close time, not at sweep time.
- An offer's escrow is always routed by the offer-close path; `DESTINATION` becomes the new escrow recipient regardless of the `OWNERSHIPS` setting.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
