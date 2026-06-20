<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - ORDER
This action creates a order to sell an item on the Decentralized Exchange (DEX).

## PARAMS
| Name                 | Type   | Description                                                        |
| -------------------- | ------ | ------------------------------------------------------------------ |
| `VERSION`            | String | Format Version                                                     |
| `GIVE_COIN`          | String | `COIN` name (BTC, LTC, DOGE, etc)                                  |
| `GIVE_TICK`          | String | Ticker name or Ticker ID                                           |
| `GIVE_AMOUNT`        | String | Quantity of `GIVE_TICK` to escrow in the orde                      |
| `GET_COIN`           | String | `COIN` name (BTC, LTC, DOGE, etc)                                  |
| `GET_TICK`           | String | Ticker name or Ticker ID                                           |
| `GET_AMOUNT`         | String | Quantity of `GET_TICK` requested in return                         |
| `GET_ADDRESS`        | String | Address to receive `GET_TICK` on `GET_COIN` network                |
| `EXPIRATION`         | String | Timestamp of when order should expire, in Unix time                |
| `ALLOW_LIST`         | String | `ACTION_INDEX` of a `LIST` of addresses allowed to match order     |
| `BLOCK_LIST`         | String | `ACTION_INDEX` of a `LIST` of addresses NOT allowed to match order |
| `GIVE_OWNERSHIP`     | String | When `1`, escrow ownership of `GIVE_TICK` instead of a balance amount (default `0`) |
| `GET_OWNERSHIP`      | String | When `1`, require the matcher to currently own `GET_TICK` and transfer that ownership (default `0`) |
| `MEMO`               | String | An optional memo to include                                        |
| `ORDER_ACTION_INDEX` | String | `ACTION_INDEX` of existing `ORDER`                                 |


## Formats

### Version `0` - Create Order
- `VERSION|GIVE_COIN|GIVE_TICK|GIVE_AMOUNT|GIVE_OWNERSHIP|GET_COIN|GET_TICK|GET_AMOUNT|GET_OWNERSHIP|GET_ADDRESS|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`

### Version `1` - Cancel Order
- `VERSION|ORDER_ACTION_INDEX|MEMO`

### Version `2` - Edit Order 
- `VERSION|ORDER_ACTION_INDEX|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`


## Examples
```
ORDER|0|BTC|RAREPEPE|1|BTC|PEPECASH|10000000.00000000||||Selling my RAREPEPE cuz mom in hospital
This example creates an order to sell 1 RAREPEPE for 10,000,000.00000000 PEPECASH and includes a memo
```

```
ORDER|0|BTC|PEPECOIN|1000|BTC||0.05000000||||Selling PEPECOIN for BTC
This example creates a native coin pair order: sell 1000 PEPECOIN tokens for 0.05 BTC.
GET_TICK is empty (native coin). Matched orders create a COINPay obligation instead of instant settlement.
```

```
ORDER|0|BTC||0.05000000|BTC|PEPECOIN|1000||||Buying PEPECOIN with BTC
This example offers 0.05 BTC to buy 1000 PEPECOIN tokens.
GIVE_TICK is empty (offering native coin). No token escrow occurs for the native coin side.
```

```
ORDER|1|1234|Closing order, no buyers, much disappoint
This example cancels the existing ORDER with `ACTION_INDEX` 1234 and includes a memo
```

```
ORDER|2|1234|4321|||Updating order to only sell to club member addresses
This example updates an existing `ORDER` with `ACTION_INDEX` 1234 and adds an `ACTION_INDEX` to `ALLOW_LIST` 4321 and includes a memo
```

```
ORDER|0|BTC|JDOG||1|BTC||0.50000000||||||Selling JDOG ownership for 0.5 BTC
This example sells ownership of the JDOG tick for 0.5 BTC. `GIVE_OWNERSHIP=1` with empty `GIVE_AMOUNT` escrows the ownership record. Native coin on the GET side creates a COINPay obligation on match; ownership is delivered when COINPay settles.
```

```
ORDER|0|BTC|JDOG||1|BTC|PEPECASH|10000000.00000000||||||Selling JDOG ownership for 10M PEPECASH
This example sells ownership of JDOG for 10,000,000 PEPECASH balance, settled atomically on match.
```

```
ORDER|0|BTC|PEPECASH|100000||BTC|JDOG||1|||||Bidding 100K PEPECASH for JDOG ownership
This example offers 100,000 PEPECASH for ownership of the JDOG tick. The matcher must currently own JDOG; on match, JDOG ownership transfers to this order's SOURCE.
```

```
ORDER|0|BTC|JDOG||1|BTC|PEPECOIN||1|||||Swapping JDOG ownership for PEPECOIN ownership
This example trades ownership of JDOG for ownership of PEPECOIN. Both sides escrow ownership; on match, ownerships swap atomically.
```

## Rules

### Native Coin Pairs
- An empty/null `GIVE_TICK` or `GET_TICK` indicates native coin (BTC/LTC/DOGE) on that side
- Both `GIVE_TICK` and `GET_TICK` cannot be empty simultaneously (coin-for-coin is a regular blockchain transaction)
- When `GIVE_TICK` is empty (offering native coin): no balance check, no escrow; the obligation to pay is created at match time and fulfilled via [`COINPAY`](./COINPAY.md)
- When `GET_TICK` is empty (requesting native coin): the `GIVE_TICK` tokens are escrowed normally
- Native coin amounts are validated using `COIN_DECIMALS` (8 decimal places for BTC/LTC/DOGE)
- Expiration fees are charged regardless of whether the order involves native coin
- When matched, native coin pairs create a `pending_coinpay` ORDER_MATCH instead of instant settlement
- Cancelling an order with pending COINPay obligations sets status to `cancelling` instead of `cancelled`; obligations must resolve before the order is finalized
- Order expiration with pending COINPay obligations sets status to `expiring`; same deferred finalization

### Token Ownership Sales
- `GIVE_OWNERSHIP=1` requires SOURCE to be the current owner of `GIVE_TICK`; `GIVE_AMOUNT` must be empty; the ownership record moves into a protocol-held escrow state. [`SWAP`](./SWAP.md) and [`DISPENSER`](./DISPENSER.md) support the same `GIVE_OWNERSHIP=1` flag and place ownership into the same escrow state; all three actions share the "only one open ownership offer at a time" constraint described below.
- `GET_OWNERSHIP=1` requires the matcher's SOURCE to be the current owner of `GET_TICK`; `GET_AMOUNT` must be empty
- Ownership orders are **single-fill only**, ownership is indivisible; the entire order matches against one counterparty or none (no partial fills on the balance side either)
- While ownership is escrowed, the following actions targeting the escrowed `TICK` are rejected:
  - `ISSUE` Versions 0-6 (all edits to an existing tick: description, mint params, lock params, callback params, list params, controller bind/unbind, and re-issuance by the current owner)
  - `CALLBACK`, `SLEEP`
  - `LINK` using this `TICK`'s `ISSUE` as `COIN2_ACTION_INDEX`
  - `FILE` with `GATE_TICKER` = this `TICK`
  - New child `ISSUE` using this `TICK` as a parent (period-separated name)
  - Additional `ORDER`/`SWAP`/`DISPENSER` ownership offers for this `TICK` from the original owner
- Holder-side actions are unaffected: `SEND`, `MINT` (if mint window open), `DIVIDEND` payouts, `DEPOSIT`/`WITHDRAW`, `DESTROY` of held balance
- Child `TICK`s (e.g. `JDOG.SUB1`) have independent ownership records and are **not** transferred when a parent's ownership is sold, sell each child separately if needed
- On match: ownership transfers atomically to the counterparty's SOURCE
- On cancel (Version 1) or `EXPIRATION`: ownership returns to the original SOURCE
- When matched against a native-coin counterparty: ownership remains in escrow as a `pending_coinpay` obligation and is delivered to the buyer once `COINPAY` settles; if the obligation expires or is cancelled, ownership returns to the original SOURCE

### Sweep Closure
- When `SWEEP` is broadcast from this order's SOURCE with `ORDERS=1`, the order is cancelled and the escrowed `GIVE_TICK` balance (or `GIVE_OWNERSHIP` ownership record) is credited to the SWEEP `DESTINATION` rather than returned to SOURCE (see [`SWEEP`](./SWEEP.md))

## Notes
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)
- Use `^` (caret) as prefix when passing an `ADDRESS_ID` for `GET_ADDRESS` (^57 = `ADDRESS_ID` 57); see [Index ID References](../Index_Id_References.md)
- **Cross-chain orders** (`GET_COIN` ≠ the posting chain) escrow the GIVE side locally and are
  matched + settled by the validator federation. Not the local DEX. The match is delivered to
  each chain and settled from escrow with no per-trade on-chain transaction. See
  [Cross-Chain DEX](../Cross_Chain_DEX.md).

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
