<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Frequently Asked Questions

---

## General

### What is XChain?

XChain is a token protocol that runs on top of existing blockchains — Bitcoin, Litecoin, and Dogecoin. It lets anyone create and manage digital tokens, trade them on a built-in decentralized exchange, and store data permanently on-chain, all using standard blockchain transactions. There is no separate XChain blockchain. Instead, XChain embeds its instructions invisibly inside normal Bitcoin, Litecoin, and Dogecoin transactions, and a network of indexer nodes reads and executes those instructions. The result is a full-featured token platform with the security and permanence of the world's most established blockchains underneath it.

### Is XChain its own blockchain?

No. XChain is a protocol layer that sits on top of existing blockchains. It does not have its own miners, its own blocks, or its own consensus mechanism. When you create a token or make a transfer on XChain, you are sending a normal Bitcoin (or Litecoin or Dogecoin) transaction — it just happens to carry XChain instructions inside it. The coin network provides the security; XChain provides the token logic.

### Which blockchains does XChain support?

XChain currently supports Bitcoin, Litecoin, and Dogecoin, including their respective test networks. The protocol is designed to work with any Bitcoin-compatible blockchain, so adding new chains is a straightforward configuration change rather than a major engineering effort.

### Is XChain decentralized?

Token operations on XChain are fully decentralized — they are recorded on the underlying blockchain and processed by the rules of the protocol, with no company or individual able to alter the results. Anyone can run their own XChain node and independently verify every token balance and transaction. The XChain Hub is a decentralized validator network operating via PBFT consensus, providing configuration, pricing, and cross-chain coordination without a central point of control.

### Do I need to run my own node to use XChain?

No. You can use public explorer instances to view token balances, transaction history, and market data without running anything yourself. For sending transactions, you can use any compatible wallet or application. If you want complete sovereignty — meaning you verify everything yourself and do not rely on any external service — you can run your own full XChain node. Running your own node gives you first-party data that you can trust completely, independent of any third party.

---

## Tokens

### How much does it cost to create a token?

Creating a token requires a fee paid in XCHAIN — the platform's gas token. The exact amount varies by blockchain. You also need a small amount of the underlying coin (BTC, LTC, or DOGE) to pay the standard miner transaction fee. Check the current fee schedule in the XChain Explorer for your chain of choice.

### Can I change my token's settings after creation?

Yes, for any settings that have not been locked. You can update the description, adjust minting windows, modify access lists, and change other parameters at any time as the token owner. The only settings you cannot change are ones you have explicitly locked — locking is a permanent, one-way action.

### What happens if I lock a parameter?

Locking a parameter makes it permanent. No future update — not from you, not from anyone — can change that parameter. This is intentional: locking is how you make provable, unbreakable guarantees about your token. If you lock the max supply, it is mathematically impossible for more tokens to be created beyond that ceiling. If you are unsure whether to lock something, do not lock it yet. You can always lock later, but you cannot unlock.

### Can someone steal my tokens?

Your tokens are controlled by your blockchain address, and your address is controlled by your private key. As long as your private key is secure, your tokens are secure. No one can move your tokens without your private key. XChain itself has no ability to freeze, seize, or move your tokens — there is no admin key, no backdoor, and no company with override access. The same rules that secure Bitcoin balances secure XChain token balances.

### What are sub-tokens?

Sub-tokens are tokens whose names contain a period, like `BRAND.GOLD` or `PLATFORM.MEMBERSHIP`. The naming convention groups related tokens under a shared prefix. Sub-tokens are cheaper to create than top-level tokens. Owning a top-level token does not automatically give you control over sub-tokens with that prefix — but if you own the top-level token, you can establish that association as a convention for your ecosystem.

### Can a token be permanently destroyed?

Yes. The DESTROY action lets a token holder permanently burn a specified amount of their own tokens. Destroyed tokens are removed from circulation and cannot be recovered. The CALLBACK action is different — it is a force-recall initiated by the token issuer that collects tokens from all holders and pays them a specified amount in return.

---

## Trading

### How does the DEX work?

The XChain DEX is an on-chain order book. When you place a buy or sell order, it is recorded on the blockchain. The indexer automatically matches orders by best price. When a match is found, the trade executes without any human involvement — your escrowed tokens go to the buyer, and the payment goes to you. There is no company operating the exchange, no account required, and no possibility of the order book being manipulated after the fact.

### What is a dispenser?

A dispenser is a token vending machine. You set it up with a token, a price in coin (BTC, LTC, or DOGE), and a maximum number of sales. Anyone who sends the correct amount of coin to the dispenser address automatically receives the tokens. It works 24 hours a day without any action from you. Dispensers are useful for token sales, fundraisers, and any situation where you want reliable, always-on availability at a fixed price.

### Can I trade tokens across different blockchains?

Yes. The SWAP action allows cross-chain atomic exchanges — you can trade a token on Bitcoin for a token on Litecoin, for example. The trade is atomic, meaning both sides complete or neither does. Your tokens are held in protocol-level escrow on your own blockchain throughout the process; they never pass through a third party. See the [Cross-Chain guide](./CROSS_CHAIN.md) for a full explanation.

### Are my tokens safe while a trade is in progress?

Yes. When you place a sell order or set up a swap, your tokens are moved into protocol-level escrow. This is not a company holding your tokens — it is the protocol itself locking them against your order. They can only be released in two ways: to the counterparty when the trade completes, or back to you when the order expires or you cancel it. There is no third party who can access or misappropriate them.

### Can I cancel an order once it is placed?

Yes. You can cancel any of your open orders at any time before they are filled. When you cancel, your escrowed tokens are immediately returned to your available balance. You do not need anyone's permission to cancel your own order.

---

## Technical (Simplified)

### How is XChain data stored on the blockchain?

XChain instructions are embedded in standard blockchain transactions using a few different methods — small amounts of data can go directly in a special output called OP_RETURN, while larger payloads use a two-step process involving standard transaction types that any Bitcoin-compatible wallet can create. The underlying coin nodes store these as normal transactions and have no idea they contain XChain instructions. XChain nodes read the raw transaction data and decode the embedded payload.

### What if the blockchain reorganizes?

Blockchain reorganizations ("reorgs") happen occasionally — a chain of blocks gets replaced by a longer competing chain. XChain handles this automatically. The platform's decoder and indexer monitor the chain for reorgs and automatically roll back their state to the point of the fork, then reprocess the correct chain. From a user perspective, a recent transaction might briefly disappear and then reappear (or disappear permanently if it was in the orphaned chain), just as with standard coin transactions.

### Can I verify token balances and history myself?

Yes — and this is one of XChain's core design goals. Because the platform's rules are deterministic, anyone who processes the same blockchain data will arrive at exactly the same state. If you run your own full XChain node, you independently derive every token balance and transaction record from the raw blockchain. You do not have to trust any explorer, any API, or any company. Your node and a node on the other side of the world will agree on every balance and every history, because they both follow the same rules against the same blockchain data.

### What happens to my tokens if XChain services go offline?

Your tokens are recorded in blockchain transactions that exist permanently on Bitcoin, Litecoin, or Dogecoin. If every XChain indexer in the world went offline today, the raw data would still be on the blockchain. When any indexer comes back online and replays the chain from the beginning, it would reconstruct the complete current state of all tokens, balances, and history. There is nothing to lose because there is nothing stored only in XChain infrastructure — the blockchain is the only authoritative record.

---

*See also: [Creating Tokens](./Creating_Tokens.md) | [Trading](./TRADING.md) | [Cross-Chain](./CROSS_CHAIN.md) | [Use Cases](./Use_Cases.md)*

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
