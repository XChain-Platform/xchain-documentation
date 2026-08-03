<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/Trader_Identity.md @ 34639117 (worktree dirty) -->

# Trader identity (EU DSA)

Every major app store requires a trader or non-trader declaration under the EU Digital Services Act. A trader declaration publishes the entity name, postal address, email and phone number on the public listing, permanently. Chrome, Google Play and the App Store each ask separately, so this page is the single set of values used on all three, to keep them from diverging.

## The declaration

| Field | Value |
|---|---|
| Entity | Dankest, LLC |
| Street | 30 N Gould St Ste N |
| City | Sheridan |
| State | WY |
| Postal code | 82801 |
| Country | United States |
| Email | info@dankest.llc |
| Phone | +1 949-510-5364 |

As a block:

```
Dankest, LLC
30 N Gould St Ste N
Sheridan, WY 82801
United States
info@dankest.llc
+1 949-510-5364
```

## Why these values

**Entity: Dankest, LLC.** This is the legal entity that publishes XChain Wallet. "XChain" is the product name, carried by the item name on each store listing; the publisher of record is Dankest, LLC.

**The postal address is a registered agent's**, which is why it can be published permanently.

**The email, `info@dankest.llc`, is monitored.** It is the same address published on the Google Play listing, where a reviewer or regulator would cross-check it.

**The phone number is monitored directly.** If either contact ever changes, the update lands on every store listing in the same pass, so that one legal entity never shows two different public contacts across stores.

## How this is used

Any store form that asks for trader contact details uses these values, unchanged. If a console's form wants a different layout (a single line instead of a split address, for example), the values are reformatted, not re-sourced.

The published contacts are the channels DSA complaint and takedown notices arrive through, and some of those response windows are as short as seven days.
