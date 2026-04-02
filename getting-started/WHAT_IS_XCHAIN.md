<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# What is XChain?

## The Short Version

XChain is a token protocol that runs on top of existing blockchains — specifically Bitcoin, Litecoin, and Dogecoin. It lets you create and manage digital assets (tokens), trade them on a built-in exchange, swap them across chains, store files, send messages, and much more — all without leaving the security of the underlying blockchain.

If you've heard of other token protocols like Counterparty, Ordinals, or Colored Coins, XChain is in that tradition: it uses the existing Bitcoin (or Litecoin, or Dogecoin) network as its foundation, and adds a richer layer of functionality on top of it.

---

## The Metalayer Concept

To understand XChain, it helps to think in layers.

The base layer is a blockchain — Bitcoin, for instance. Bitcoin's job is to record transactions in a decentralized, tamper-proof ledger. It does that job extremely well. What it doesn't do natively is support tokens, decentralized exchanges, data storage, or most of the other things people want to build on a blockchain.

XChain is what's called a **metalayer** — a protocol that runs *above* the base blockchain, using it as its foundation without modifying it in any way.

Think of it like a building's electrical wiring. The building's concrete and steel structure (the blockchain) provides the foundation. The wiring (XChain) runs through that structure to provide new capabilities — but the structure itself doesn't change. Anyone can use those new capabilities without altering the building's foundation.

In practice, XChain works by embedding small pieces of data inside ordinary blockchain transactions. Those data packets are invisible to Bitcoin itself — they're just part of a normal transaction. But XChain's software layer reads those packets, interprets them as commands, and maintains its own database of token balances, orders, and state.

**Nothing about Bitcoin, Litecoin, or Dogecoin is changed.** XChain tokens exist on the actual blockchain, secured by the same proof-of-work consensus that secures every other Bitcoin transaction. There are no sidechains, no bridges, no separate validators, no new consensus mechanism to trust.

---

## What Can You Do with XChain?

XChain is built around 19 commands — called **ACTIONs** — that cover the full lifecycle of a digital asset ecosystem.

### Create and Manage Tokens

The most fundamental thing you can do is issue a token. Give it a name (called a **TICK**, like `GOLD` or `MYTOKEN`), set a maximum supply, define how many decimal places it has, and optionally allow or restrict who can mint it. You can even make tokens divisible or indivisible, lock them against further changes, or set them up to be mintable by the public.

Once a token exists, you can mint new supply up to the maximum, destroy tokens permanently (reducing supply), and update various token parameters over time.

### Transfer Value

Send tokens to one or more addresses in a single transaction. You can include optional memos, transfer the entire balance of an address in one sweep, or airdrop tokens to a list of recipients all at once. Dividends let you distribute one token proportionally to all holders of another.

### Trade on the Built-in DEX

XChain has a native decentralized exchange built directly into the protocol. You can place sell orders specifying what you're offering and what you want in return, and buyers can fill those orders. You can cancel or modify outstanding orders. No central exchange, no custodian — trades settle directly on the blockchain.

**Dispensers** are a simpler vending-machine model: set a price in one token, and anyone who sends that amount automatically receives the dispensed token in return. Dispensers are useful for simple token sales, faucets, or automated distribution.

### Swap Across Chains

The SWAP action enables atomic cross-chain exchanges — trading a token on Bitcoin for a token on Litecoin, for example. This happens without a bridge or a trusted intermediary.

### Store Data and Messages

XChain can embed arbitrary data on the blockchain. The MESSAGE action stores a short message permanently on-chain. The BROADCAST action supports richer use cases: oracle data feeds, prediction market outcomes, price broadcasts. The FILE action stores larger data payloads. The LINK action creates associations between addresses and external resources.

### Advanced Control

- **SLEEP** temporarily suspends an action (like a dispenser or order) from a certain block height until another.
- **CALLBACK** lets a token issuer reclaim tokens from holders at a defined price after a certain block — useful for structured financial instruments.
- **ADDRESS** lets users configure per-address preferences, like requiring memos on incoming transfers.
- **LIST** creates named lists of addresses or ticks that can be referenced as allow lists or block lists in other actions.
- **BATCH** bundles multiple actions into a single blockchain transaction, saving fees.

---

## How Is XChain Different?

There are a lot of blockchain protocols out there. Here's what sets XChain apart.

### No Sidechains, No Bridges

Many blockchain token systems work by "locking" assets on one chain and "mirroring" them on another — a process that requires bridges. Bridges are one of the most attacked surfaces in all of crypto; billions of dollars have been lost to bridge exploits.

XChain doesn't use bridges. When you hold an XChain token on Bitcoin, that token record literally exists inside a Bitcoin transaction. There's nothing to bridge, nothing to lock and unlock, no separate chain to trust.

### No New Consensus

A lot of layer-2 and sidechain systems require you to trust a separate set of validators. XChain has no separate validators. The security of your XChain tokens comes directly from Bitcoin's (or Litecoin's or Dogecoin's) proof-of-work consensus — the same mechanism that has secured those chains for over a decade.

### Multi-Chain by Design

XChain runs natively on Bitcoin, Litecoin, and Dogecoin simultaneously. A token on one chain is distinct from a token on another chain — they have separate ledgers. But the XChain software supports all three chains with the same protocol, the same 19 actions, and the same tooling. A single deployment of the platform can index and serve data for all three chains at once.

### Open, Permissionless, Deployable

The XChain platform is open source software. Anyone can run their own XChain node, index their own copy of the blockchain, and operate their own API. There's no central company or server that must be online for XChain to function. Institutions and developers can run private deployments with their own configuration — including custom gas parameters, testnet environments, and isolated regtest networks for development.

---

## The 19 ACTIONs: The Building Blocks

Every operation on XChain is expressed as one of 19 ACTION commands. Think of them as the vocabulary of the protocol — a complete set of verbs for working with digital assets.

| Category | ACTIONs |
|---|---|
| Token lifecycle | ISSUE, MINT, DESTROY, CALLBACK, SLEEP |
| Transfers | SEND, SWEEP, AIRDROP, DIVIDEND |
| Trading | ORDER, DISPENSER, SWAP |
| Data and communication | BROADCAST, MESSAGE, FILE |
| Configuration | ADDRESS, BATCH, LINK, LIST |

Each ACTION has a versioned format — as the protocol evolves and adds new fields, old versions remain valid so that existing software doesn't break.

ACTIONs are encoded as compact pipe-delimited strings embedded inside standard blockchain transactions. The encoding is obfuscated (not encrypted — the data is fully readable by anyone running an XChain node) to avoid being accidentally filtered by blockchain infrastructure. A magic prefix (`XCHN`) identifies XChain transactions.

---

## The Gas Token: XCHAIN

Every economy needs a way to pay for operations. XChain uses a token called **XCHAIN** as its gas token — the fee currency for actions that write to the database. Creating tokens, minting supply, placing orders: these actions cost XCHAIN.

XCHAIN is itself just a token on XChain, issued by a designated address (called the GAS address) for each chain. The GAS address is a configuration parameter — operators of private deployments can define their own GAS address and bootstrap XCHAIN supply however they choose.

---

## Who Is XChain For?

### Developers Building Token Platforms

XChain provides a complete SDK (`xchain-sdk`) with methods for all 19 actions, 40+ explorer queries, a batch builder, and PSBT generation. If you want to build a token platform, a DEX, an NFT marketplace, or any application involving digital assets on Bitcoin-family chains, XChain gives you the full stack.

### Organizations Wanting Private Deployments

Because the entire platform is open source and self-hostable, organizations can run their own XChain deployment on testnet or regtest — completely isolated from mainnet. This is useful for enterprise tokenization pilots, private exchanges, and internal settlement networks.

### Researchers and Protocol Enthusiasts

XChain is a serious protocol with a detailed specification. If you're interested in how layer-2 protocols work, how data gets embedded in Bitcoin transactions, how a DEX can be built without a smart contract platform, or how cross-chain swaps can happen without bridges — XChain is a working, documented implementation of all of these.

### Anyone Who Wants to Create Digital Assets

If you want to create a token and have it live on Bitcoin — permanently, secured by proof-of-work, without asking permission from anyone — XChain is how you do it. Issue a token, set your parameters, pay the gas fee, broadcast the transaction. Your token exists on Bitcoin from that point on.

---

## Where to Go Next

If you want to understand the protocol more deeply, start with the [Core Concepts](../concepts/) section, which covers the ACTION format, encoding types, the indexer's validation rules, and the platform data pipeline.

If you want to start building, go to the [Developer Quickstart](./QUICKSTART_DEVELOPER.md) — you can create your first token in about 5 minutes.

If you want to run the full platform yourself, see the [Node Operator Quickstart](./QUICKSTART_NODE_OPERATOR.md).

If you need to look up specific terms, the [Key Terms](./KEY_TERMS.md) glossary covers the full XChain vocabulary.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
