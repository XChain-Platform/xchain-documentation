<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

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

### Can I sell encrypted content as a token?

Yes. You can publish a file — or a whole pack of files — to the blockchain encrypted, in a way that only people who hold a specific token can decrypt it. Then you put the token up for sale on the built-in exchange. Whoever buys the token automatically receives the decryption key as part of the same transaction; there is no separate download server, no key escrow service, and no membership database to maintain. If the buyer later sells the token, the key automatically transfers to the next holder, again all on-chain. This works for music, video, e-books, research papers, brand guidelines, board minutes — anything you can put in a file. See the [Token-Gated Encrypted Content](./Use_Cases.md#token-gated-encrypted-content-and-packs) use case for examples.

### Can I sell my token's issuer rights?

Yes. A token has two separate things attached to it: the *balances* (who holds how many tokens) and the *ownership* (who can update the token's settings, mint new supply, change the description, etc.). You can sell ownership on its own — keeping or distributing the balances any way you like — using a standard order, swap, or dispenser with the "give ownership" flag set. The transfer is atomic with the trade: the seller receives the payment and the buyer receives the issuer role in a single blockchain transaction, with no off-chain trust between them.

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

## Smart Contracts and Staking

### What is a smart contract on XChain?

A smart contract is a small program, written in JavaScript, that lives permanently on the blockchain and can be called by anyone. Like every other XChain action, contracts run on Bitcoin, Litecoin, or Dogecoin — there is no separate "contract chain" to set up. Once deployed, a contract can hold tokens, change its own state, issue and transfer tokens, place orders on the exchange, and respond to calls from users. Contracts run inside a sandbox that limits how much computation they can do per call (so they cannot run forever), and every operation costs a small amount of XCHAIN as gas.

### Can my smart contract call an AI or an external website?

Yes. A contract on XChain can ask the outside world a question — including a question to a large language model — and get a verified answer back on-chain. Inside the contract, the author calls a built-in function with the question they want answered. The network's validators each look up the answer independently, compare their results, and write the agreed-upon answer to the blockchain. The contract then receives the answer through a callback and continues running. Two kinds of questions are supported in the initial release: fetches from any HTTPS web address (validators agree only if the responses match exactly), and prompts to an approved AI model (Claude Sonnet 4.6 or Claude Opus 4.7 at launch, with a separate AI judge deciding whether the validators' answers are equivalent in meaning). This lets contracts run AI-judged contests, react to real-world data, settle prediction markets from official sources, moderate content, and a lot more. See the [AI-Powered Smart Contracts](./Use_Cases.md#ai-powered-smart-contracts) use case for examples.

### What is the difference between contract staking and validator staking?

XChain has two separate staking systems, and they do not share any state. Validator staking is for people who want to help run the network — specifically the XChain Hub, which handles pricing, cross-chain coordination, and outside-world questions like the AI calls described above. Validators stake XCHAIN (the platform's gas token) and earn rewards for participating; the staking rules are set at the protocol level. Contract staking is much more general: any smart contract can declare itself stakeable when it is deployed, and anyone can lock up any token on any chain against that contract. The contract's own code decides what staking unlocks (access, voting weight, a share of rewards, whatever the author built) and when stakes should be slashed for misbehavior. Both systems use the same wire-level actions (STAKE, UNSTAKE, DELEGATE) at different version numbers, but the balances and rules never mix.

### Can my contract take tokens away from a staker?

Only if you (the contract author) wrote code that does so, and only following the rules you declared at deploy time. When you publish a stakeable contract, you set two things permanently: how long a staker must wait after they ask to withdraw, and where slashed tokens are sent (a specific address, or the chain's burn address). After deploy, neither of these can be changed — by you, or by anyone. Stakers can therefore audit the rules before they lock anything up, and they know the destination of any slashed funds in advance.

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

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
