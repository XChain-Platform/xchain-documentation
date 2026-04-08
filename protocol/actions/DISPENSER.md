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

```
DISPENSER|0|BTC|PEPECASH|100|100|BTC||0|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|USD|0.05|0|||Selling PEPECASH for $0.05 USD each
This example creates a FIAT dispenser that escrows 100 PEPECASH tokens and dispenses 100 at a time when a buyer sends BTC equivalent to $0.05 USD per token. GET_AMOUNT is set to 0 because the effective BTC price is determined dynamically via oracle price snapshots.
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

## FIAT Dispensers

FIAT dispensers allow token sellers to price their tokens in a traditional currency (e.g., USD, JPY) while accepting payment in the native coin (BTC, LTC, DOGE). This enables non-XChain users to trigger a dispense by sending a simple bare coin payment — no XChain transaction required.

### How It Works
1. The dispenser creator sets `FIAT_CODE` (e.g., `USD`) and `FIAT_AMOUNT` (e.g., `0.05`) — the FIAT price per `GIVE_AMOUNT` of tokens
2. A buyer checks the current oracle price for the coin/FIAT pair (e.g., BTC/USD), calculates the BTC equivalent, and sends that amount to the dispenser address
3. When the payment confirms in a block, the system performs **reverse price matching** to determine how many token units to dispense

### Reverse Price Matching
Because blockchain payments can take time to confirm, the oracle price may change between when the buyer sends the payment and when it lands in a block. The system handles this by searching historical oracle price snapshots within a **24-hour window** (86400 seconds) before the payment's `block_time`.

**Algorithm:**
1. Retrieve all finalized oracle price snapshots for the coin/FIAT pair within the 24-hour window, ordered newest-first
2. For each snapshot (newest to oldest):
   - Calculate `btc_per_token = FIAT_AMOUNT / snapshot.price`
   - Calculate `units = floor(COIN_AMOUNT / btc_per_token)`
   - If `units >= 1`: **match found** — dispense `units × GIVE_AMOUNT` tokens
3. The first (most recent) matching snapshot is used — the buyer most likely used the latest price they saw
4. If no snapshot produces at least 1 unit, the dispense is invalid

### Overpayment / Tips
If a buyer sends slightly more coin than the exact calculated amount, the system floors the unit count and absorbs the excess as overpayment. The extra amount does not trigger additional dispenses. For example, if the exact cost for 5 units is 0.000005 BTC and the buyer sends 0.0000055 BTC, the system dispenses 5 units.

### Recommendations
- Buyers should send with a high transaction fee to ensure confirmation within the 24-hour price window
- If a payment is stuck in the mempool for longer than 24 hours, no matching price snapshot will be found and the dispense will be invalid

### Dispenser Close Window
Dispensers have a 1-hour close delay (`DISPENSER_CLOSE_DELAY`). When a dispenser is cancelled or runs out of tokens, it enters a "cancelling" state for 1 hour before fully closing. FIAT dispense payments that confirm during this window are still processed normally — the dispenser honors pending dispenses until the close window elapses.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
