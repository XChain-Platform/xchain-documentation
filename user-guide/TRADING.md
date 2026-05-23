<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Trading on XChain

XChain has a decentralized exchange (DEX) built directly into the protocol. There is no company running it, no sign-up required, and no central server that can go down. All trading happens through blockchain transactions — your tokens never leave your control until a trade completes.

This guide covers the two main ways to trade on XChain: the **order book** and **dispensers**.

---

## What Is the XChain DEX?

The XChain DEX is an order-matching system embedded in the blockchain protocol itself. When you place a buy or sell order, that order is recorded on-chain. When a matching order appears, the exchange happens automatically — no human, company, or intermediary involved.

Think of it like a stock exchange that runs itself, where the rulebook is the protocol and the record-keeping is the blockchain. Nobody can manipulate the order of trades, cancel your order without your permission, or freeze your funds.

---

## Order Books

### Placing an Order

To trade on the order book, you place either a **buy order** (you want to acquire a token) or a **sell order** (you want to sell a token you hold).

When you place a sell order, the tokens you are selling are moved into **escrow** immediately. This is not a freeze by a company — it is a protocol-level hold. Your tokens are accounted for on-chain and will be automatically released to the buyer when a match occurs, or returned to you if you cancel or the order expires.

When you place a buy order, you specify what you want to buy, how much, and what you are willing to pay. The protocol matches your order against the best available sell order automatically.

### How Matching Works

The exchange matches orders by **best price first**. If you place a buy order at a price above what a seller is asking, the trade executes at the seller's price — you get the better deal. This is the same as how stock exchanges work: you always get the best available price, never worse than what you specified.

Matching happens as orders are processed by the indexer. You do not need to be online for a match to happen. Once your order is on-chain, it works automatically.

### Order Expiration

Orders do not stay open forever. When you place an order, you set an expiration. After that time (measured in blocks), any unfilled portion of your order is automatically cancelled and your escrowed tokens are returned. This prevents stale orders from clogging the exchange.

### Cancelling an Order

You can cancel any of your open orders at any time before they are filled. When you cancel, your escrowed tokens are immediately returned to your available balance. You do not need anyone's permission to cancel your own order.

### Safety During a Trade

Your tokens are never at risk during an open order. They sit in protocol-level escrow — not on a company's server, not in a wallet someone else controls. The protocol guarantees they can only be released in two ways: to a matching buyer, or back to you upon cancellation or expiration. There is no third outcome.

---

## Dispensers: Token Vending Machines

A dispenser is a different kind of trading mechanism. Instead of matching orders, a dispenser works like a **vending machine**: you set a price, and anyone who sends the right amount of coin (BTC, LTC, or DOGE) to your dispenser address automatically receives tokens in return.

### How Dispensers Work

You set up a dispenser by specifying:

- Which token you are selling
- How many tokens are dispensed per purchase
- The price in coin (what the buyer must send)
- How many times the dispenser can sell (up to 1,000 dispenses per vending machine)

Once the dispenser is active, anyone anywhere can buy from it simply by sending the right amount of coin to the dispenser address. The tokens are sent back automatically. No interaction with you is required — you do not need to be online, you do not need to approve anything.

### Benefits of Dispensers

Dispensers are ideal when you want a reliable, always-on way to sell tokens:

- **No counterparty needed.** The transaction is automatic — buyer sends coin, protocol sends tokens.
- **Always available.** Your dispenser works 24 hours a day, 7 days a week, without any action from you.
- **Fixed price clarity.** Buyers always know exactly what they will pay and what they will receive before sending anything.
- **Self-limiting.** When a dispenser runs out of tokens (after its maximum number of dispenses), it closes automatically. You can also cancel it manually at any time.

Think of a dispenser like a coin-operated machine at a store. You set it up once, fill it with tokens, set the price, and let it run. Each customer inserts their coins and gets what they paid for — automatically, reliably, without needing a clerk.

### Editing or Cancelling a Dispenser

You can update a dispenser's price or cancel it at any time. When you cancel, any tokens still in the dispenser are returned to your balance.

---

## Seeing the Market

All trading activity — order books, dispenser listings, transaction history, prices, and volume — is visible through the XChain Explorer. You do not need an account to view market data. Anyone can see:

- Current open orders for any token pair
- Recent trade history
- Dispenser listings and remaining capacity
- Price charts over time

This transparency is a core property of the protocol. All market data is derived directly from the blockchain — it cannot be altered, hidden, or selectively presented.

---

## Fees

The XChain DEX has a **tiered fee structure** for listings. On Bitcoin specifically, there is an introductory free tier for early listings — approximately the first six months of availability. After that window, paid tiers apply depending on the type and duration of your listing.

All DEX operations (placing orders, creating dispensers, cancelling) require a small XCHAIN gas fee, just like any other action on the platform.

Check the current fee schedule through the XChain Explorer or your wallet software for the latest amounts.

---

## Native Coin Pairs

In addition to trading tokens against other tokens, the XChain DEX supports trading tokens directly for native blockchain coins — BTC, LTC, or DOGE. This means you can sell your tokens for actual Bitcoin (or Litecoin or Dogecoin), or offer native coin to buy tokens.

### How It Works

Native coin trades use a **two-phase settlement model** because the indexer can control tokens (ledger entries) but cannot move native coins (that requires a separate transaction):

1. **Order creation**: The seller places an order offering tokens for native coin (e.g., "Sell 1000 PEPECOIN for 0.05 BTC"). The tokens are escrowed. The buyer places a matching order offering native coin.
2. **Match**: When orders match, the indexer creates a **COINPay obligation** instead of settling instantly. The seller's tokens stay escrowed. The buyer has 2 hours to pay.
3. **Payment**: The buyer sends a **COINPAY** transaction — a single blockchain transaction that includes both the COINPAY action data and a native coin output paying the seller.
4. **Settlement**: The indexer validates the payment and releases the escrowed tokens to the buyer.

### What If the Buyer Doesn't Pay?

If the buyer doesn't send a COINPAY within the 2-hour window, the obligation expires automatically. The seller's tokens are released back to their order (available for other buyers). The buyer's order remains open and can match with other sellers.

### Important: Late Payment Risk

If a COINPAY transaction is broadcast but confirms **after** the obligation has expired, the native coin reaches the seller but no tokens are released. The buyer loses their coin. To avoid this, always use appropriate miner fees for timely confirmation and avoid sending COINPAY close to the expiration deadline.

### How It Differs from Dispensers

| | Native Coin Orders | Dispensers |
|---|---|---|
| Settlement | Two-phase (match → COINPay → settlement) | Automatic (send coin → receive tokens) |
| Time limit | 2-hour COINPay window after match | None — always active |
| Price discovery | Order book matching | Fixed price |
| Flexibility | Partial fills, limit orders | Fixed rate, fixed quantity |

---

## Summary: Order Book vs. Dispenser

| | Order Book | Dispenser |
|---|---|---|
| Best for | Trading between two parties | Selling at a fixed price to anyone |
| How it works | Orders matched automatically | Buyer sends coin, tokens sent back |
| Requires counterparty? | Yes — someone must match your order | No — works automatically |
| Always active? | Until filled, cancelled, or expired | Yes, until depleted or cancelled |
| Price | Best available at time of match | Fixed when you set it up |

---

*See also: [Cross-Chain Trading](./CROSS_CHAIN.md) | [Creating Tokens](./Creating_Tokens.md) | [FAQ](./FAQ.md)*

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
