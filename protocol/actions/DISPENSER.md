<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - DISPENSER
This action creates a dispenser (vending machine) to dispense `TICK` when triggered

## PARAMS
| Name                     | Type   | Description                                                                |
| ------------------------ | ------ | -------------------------------------------------------------------------- |
| `VERSION`                | String | Format Version                                                             |
| `GIVE_COIN`              | String | `COIN` name (BTC, LTC, DOGE, etc)                                          |
| `GIVE_TICK`              | String | Ticker name or Ticker ID                                                   |
| `GIVE_AMOUNT`            | String | Quantity of `GIVE_TICK` to `DISPENSE` when triggered                       |
| `GIVE_ESCROW`            | String | Quantity of `GIVE_TICK` to escrow in dispenser                             |
| `GET_COIN`               | String | `COIN` name (BTC, LTC, DOGE, etc)                                          |
| `GET_TICK`               | String | Ticker name or Ticker ID                                                   |
| `GET_AMOUNT`             | String | Quantity of `GET_COIN` or `GET_TICK` required to `DISPENSE`                |
| `GET_ADDRESS`            | String | Address for dispenser to operate on (default=`SOURCE`)                     |
| `FIAT_CODE`              | String | Code for `FIAT` currency your dispenser is priced in (USD, JPY, GPB, etc.) |
| `FIAT_AMOUNT`            | String | Amount of `FIAT` currency required to trigger a `DISPENSE`                 |
| `EXPIRATION`             | String | Timestamp of when dispenser should close, in Unix time                     |
| `ALLOW_LIST`             | String | `ACTION_INDEX` of a `LIST` of addresses allowed to trigger dispenser       |
| `BLOCK_LIST`             | String | `ACTION_INDEX` of a `LIST` of addresses NOT allowed to trigger a dispenser |
| `MEMO`                   | String | An optional memo to include                                                |
| `DISPENSER_ACTION_INDEX` | String | `ACTION_INDEX` of existing `DISPENSER`                                     |

## Formats

### Version `0` - Create Dispenser
- `VERSION|GIVE_COIN|GIVE_TICK|GIVE_AMOUNT|GIVE_ESCROW|GET_COIN|GET_TICK|GET_AMOUNT|GET_ADDRESS|FIAT_CODE|FIAT_AMOUNT|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`

### Version `1` - Cancel Dispenser
- `VERSION|DISPENSER_ACTION_INDEX|MEMO`

### Version `2` - Edit Dispenser
- `VERSION|DISPENSER_ACTION_INDEX|GIVE_ESCROW|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`


## Examples
```
DISPENSER|0|BTC|JDOG|1|10|BTC||0.01|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev||||||Creating JDOG dispensers at 0.01 BTC each
This example creates a dispenser, escrows 10 JDOG `tokens` in it, and dispense 1 JDOG token when 0.01 BTC is sent to 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev
```

```
DISPENSER|1|1234|Canceling JDOG Dispenser
This example cancels the dispenser in example 1 with `ACTION_INDEX` 1234
```

```
DISPENSER|2|1234|100||||Refilling with 100
This example refills a dispenser with `ACTION_INDEX` 1234 with 100 JDOG tokens
```

```
DISPENSER|2|1234|||9876|5432|Updating allow/block lists
This example updates the allow and block lists for dispenser with `ACTION_INDEX` 1234
```

## Rules
- Dispensers can be closed by the dispenser `GET_ADDRESS` or `SOURCE` address which first opened the dispenser
- If a dispenser is closed by the dispenser `GET_ADDRESS`, tokens escrowed in the dispenser are returned to `GET_ADDRESS`
- If a dispenser is closed by the dispenser `SOURCE`, tokens escrowed in the dispenser are returned to `SOURCE`

## Notes
- Can create a dispenser on any valid address (no new/empty address limitation like CP)
- Dispensers are closed and any escrowed funds returned after a set amount of time (1 hour)
- Dispenser `LIST` edits are delayed a set amount of time (1 hour)
- Dispensers are limited to a set maximum number of dispenses (1,000)
- `FIAT_CODE` accepts the following values:
  - `USD` = US Dollar
  - `CAD` = Canadian Dollar
  - `AUD` = Austrailian Dollar
  - `MXN` = Mexican Peso
  - `GBP` = Great Britian Pound
  - `JPY` = Japanese Yen
  - `CNY` = Chinese Yuan
  - `CHF` = Swiss Franc
  - `BRL` = Brazillian Real
  - `INR` = Indian Rupee
- `FIAT_AMOUNT` format is `X.XX`
- `EXPIRATION` begins the process of closing a dispenser after a set block delay
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)
- Any address can be configured to allow any user to open a dispenser on it via the `DISPENSER_PREFERENCE` param in the `ADDRESS` action.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
