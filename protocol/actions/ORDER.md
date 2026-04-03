<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

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
| `MEMO`               | String | An optional memo to include                                        |
| `ORDER_ACTION_INDEX` | String | `ACTION_INDEX` of existing `ORDER`                                 |


## Formats

### Version `0` - Create Order
- `VERSION|GIVE_COIN|GIVE_TICK|GIVE_AMOUNT|GET_COIN|GET_TICK|GET_AMOUNT|GET_ADDRESS|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`

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

## Rules

### Native Coin Pairs
- An empty/null `GIVE_TICK` or `GET_TICK` indicates native coin (BTC/LTC/DOGE) on that side
- Both `GIVE_TICK` and `GET_TICK` cannot be empty simultaneously (coin-for-coin is a regular blockchain transaction)
- When `GIVE_TICK` is empty (offering native coin): no balance check, no escrow — the obligation to pay is created at match time and fulfilled via [`COINPAY`](./COINPAY.md)
- When `GET_TICK` is empty (requesting native coin): the `GIVE_TICK` tokens are escrowed normally
- Native coin amounts are validated using `COIN_DECIMALS` (8 decimal places for BTC/LTC/DOGE)
- Expiration fees are charged regardless of whether the order involves native coin
- When matched, native coin pairs create a `pending_coinpay` ORDER_MATCH instead of instant settlement
- Cancelling an order with pending COINPay obligations sets status to `cancelling` instead of `cancelled`; obligations must resolve before the order is finalized
- Order expiration with pending COINPay obligations sets status to `expiring`; same deferred finalization

## Notes
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
