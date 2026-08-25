<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Cross-Chain Trading on XChain

XChain runs on every supported chain simultaneously, today Bitcoin, Litecoin, and Dogecoin; but these are separate blockchains. A token created on Bitcoin exists on Bitcoin. A token created on Litecoin exists on Litecoin. Normally, trading between them would require a bridge, a centralized exchange, or a complex multi-step process involving trust in a third party.

XChain solves this with **SWAP**; a cross-chain exchange that lets you trade tokens on one blockchain for tokens on another, without any intermediary holding your assets.

---

## The Problem

Imagine you hold a token on Bitcoin and want to trade it for a token on Litecoin. On a centralized exchange, you would deposit your Bitcoin token, trust the exchange to hold it, find a counterparty, execute the trade, and then withdraw your Litecoin token. At every step, you are trusting the exchange not to lose your funds, freeze your account, or disappear.

With cross-chain bridges, you lock your asset on one chain and mint a representative version on another. The security of your asset depends entirely on the bridge's security; a single point of failure that has been exploited for billions of dollars across the industry.

XChain offers a different path.

---

## The Solution: Escrowed Cross-Chain Swaps

A SWAP on XChain never hands your asset to a counterparty on trust. Your tokens sit in protocol-level escrow on your own blockchain, and they are released only against a match that a supermajority of hub validators has signed. If no match is signed before your deadline, the escrow returns to you automatically.

Think of it like a currency exchange booth, but automated and trustless. You put your tokens in your side of a locked box. The other person puts their tokens in their side of a locked box. Neither box opens until the validators agree the trade is real; if they never agree, both boxes open back to their owners.

What XChain does *not* have is a single settlement step spanning two blockchains. Two chains cannot commit together, so each chain's indexer settles its own leg independently once it sees the signed match. In the normal case both legs settle within a few blocks of each other. See [Safety](#safety) below for the residual risk that follows from this and how the protocol bounds it.

---

## How It Works

Cross-chain swaps on XChain follow a straightforward flow:

1. **You create an offer.** You specify what token you are offering (on your chain), what token you want in return (on the other chain), and the quantities. This offer is recorded on your blockchain.

2. **Someone accepts.** A counterparty on the other chain sees your offer and agrees to the terms. They record their acceptance on their blockchain.

3. **The match settles on each chain.** The hub records a match signed by a supermajority of validators, and only after each side's escrow has reached that chain's required confirmation depth. Each chain's indexer then independently checks those signatures before releasing the escrowed tokens to the counterparty, so the two legs settle separately rather than in one step. If no match is signed, both sides get their tokens back automatically at the deadline.

```mermaid
sequenceDiagram
    participant User
    participant YourChain as Your Blockchain
    participant Hub as XChain Hub (validators)
    participant CounterpartyChain as Counterparty Blockchain
    participant Counterparty

    User->>YourChain: Create offer, escrow tokens
    YourChain->>Hub: Offer recorded
    Counterparty->>CounterpartyChain: Accept offer, escrow tokens
    CounterpartyChain->>Hub: Acceptance recorded
    Note over Hub: Supermajority of validators sign the match
    alt Match signed
        Hub->>YourChain: Signed match
        Hub->>CounterpartyChain: Signed match
        YourChain->>Counterparty: Indexer verifies signatures, releases escrow
        CounterpartyChain->>User: Indexer verifies signatures, releases escrow
    else Match not reached
        YourChain->>User: Escrowed tokens returned automatically
        CounterpartyChain->>Counterparty: Escrowed tokens returned automatically
    end
```

At no point does a company, server, or third party hold your tokens. Your assets remain under protocol-level escrow on your own blockchain until the swap finalizes.

---

## The Role of the Hub

The XChain Hub coordinates cross-chain swaps; it acts as the communication layer that lets the Bitcoin and Litecoin sides of a trade find each other and confirm completion. Importantly, the hub never holds your tokens. It is a coordination service, not a custody service.

The hub is a decentralized validator network; coordination is performed by PBFT consensus across multiple validators rather than a central server. There is no single point of control or single point of failure.

---

## Safety

Cross-chain swaps are designed to be safe by construction:

- **Escrowed on your chain.** Your tokens are locked on your blockchain; they never move to another chain or to a third party.
- **Time-bounded.** Every swap has a deadline. If the counterparty does not complete their side in time, the swap fails and your tokens are returned to you automatically.
- **No release without a signed match.** Your escrow is released only against a match that a supermajority of hub validators has independently verified and signed. A single validator, or the hub operator, cannot move it.
- **Confirmation floors before matching.** Validators will not sign a match until both escrows are buried under that chain's required number of confirmations (deeper on faster chains: currently 6 on Bitcoin, 12 on Litecoin, 60 on Dogecoin).

### Residual risk

Because the two chains settle their legs independently, there is one edge case the protocol bounds rather than eliminates. If one chain undergoes a reorganization deeper than its confirmation floor *after* the other chain has already settled its leg, that leg can be undone while the counter-leg stands, leaving one party paid and the other not. The confirmation floors above exist to make a reorg that deep implausible, and a swap that never gets matched always refunds. This is not the same guarantee as a single-chain atomic trade, where both sides of the exchange commit in one transaction and no such window exists.

---

## Available Pairs

Any token that exists on one supported chain can potentially be swapped for any token on another supported chain, as long as there is a willing counterparty. Today that means trades between Bitcoin, Litecoin, and Dogecoin tokens.

As XChain adds support for more Bitcoin-compatible blockchains, the number of available cross-chain trading pairs grows automatically. Every new chain that joins the platform opens up swap routes with every existing chain.

---

## Cross-Chain Orders

SWAP is not the only way to trade across chains. XChain also supports cross-chain **limit orders**; an order book where your offer can be matched and filled partially over time, rather than all at once.

- **SWAP**: an exact, one-shot trade: you offer a fixed quantity and it either fills completely or not at all.
- **ORDER**: a price book entry: you set a rate, and the protocol fills it against counterparties in pieces as they appear, until your full amount is traded.

Use SWAP when you want a precise exchange with a single counterparty. Use a cross-chain ORDER when you want your offer to fill gradually at your target price.

## When to Use a Swap vs. the Order Book

The DEX order book is best when you are trading two tokens that both exist on the same blockchain. Swaps are for when the tokens you want to exchange live on different blockchains.

You can combine both: use the order book to trade on a single chain, and use SWAP or cross-chain ORDER when you need to move value across chains.

---

## Contract-to-Contract Cross-Chain Calls (XCALL)

SWAP and ORDER are about trading tokens across chains. XCALL is a different mechanism for a different purpose: it lets a smart contract on one chain call a method on a contract deployed on another chain, then receive the result back through a callback.

Where SWAP moves value between users, XCALL moves logic between contracts. A contract on Bitcoin can trigger an action on a Litecoin contract and act on the outcome, all within the same application flow.

**How it works:**

1. A contract on the source chain calls `xchain.emit.crossExecute(...)` from inside its code. This is not a transaction a user submits directly; it is emitted by the VM during an EXECUTE.
2. The validator federation relays the call to the target chain, where the specified method runs on the target contract.
3. The result is relayed back and delivered to the callback method on the source contract.
4. If the call does not complete before the deadline, the source contract receives an `expired` callback automatically.

```mermaid
sequenceDiagram
    participant SourceContract as Source Contract
    participant Federation as Validator Federation
    participant TargetContract as Target Contract

    Note over SourceContract: Emits crossExecute during an EXECUTE, not a direct user transaction
    SourceContract->>Federation: Relay the call
    Federation->>TargetContract: Call the target method
    TargetContract-->>Federation: Result
    Federation-->>SourceContract: Deliver result to the callback method
    alt Deadline passes before completion
        Federation-->>SourceContract: Deliver expired callback automatically
    end
```

**When to use XCALL instead of SWAP:**

- Your contracts need to share state or coordinate logic across chains (not just exchange tokens between users).
- You want one chain's contract to trigger another chain's contract as part of a multi-chain application.
- You are building cross-chain automation, oracles, or governance where the outcome of a call on one chain drives behavior on another.

XCALL is a system-level mechanism used by contract authors, not an action end users submit directly. The DEX (SWAP and ORDER) remains the right tool for cross-chain token trading between addresses.

---

*See also: [Trading](./trading.md) | [Betting](./betting.md) | [Use Cases](./use-cases.md) | [FAQ](./faq.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
