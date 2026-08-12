<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2025-2026 Dankest, LLC -->

# Overview

**What XChain is, why it matters, and where it's going**

A short, plain-language introduction to the platform. For the full protocol specification, see the [XChain Platform White Paper](./whitepaper.md).

---

## In one paragraph

XChain is a token platform that turns the world's most secure blockchains into programmable, multi-chain token networks: without bridges, sidechains, or a new chain to trust. It embeds a complete protocol (tokens, a built-in exchange, cross-chain swaps, smart contracts, cross-chain contract calls, and on-chain data) directly inside ordinary blockchain transactions, so every token inherits the host chain's proof-of-work security wholesale. It is chain-agnostic by design, live in production today on Bitcoin, Litecoin, and Dogecoin, and built to extend across many blockchains. The product exists, runs, and has settled cross-chain trades end-to-end.

## The problem

For a decade, the way to do "more than payments" on a blockchain has been to leave the secure chains behind: moving value onto bridges, sidechains, and new Layer-1s with their own validators and their own trust assumptions. That's also where the money gets stolen: cross-chain bridges are among the most exploited constructs in all of crypto, with billions lost.

The largest, most liquid, most secure chains (Bitcoin and its relatives) were never extended to do this safely. The opportunity is to add the capabilities the market wants *on top of* those chains, inheriting their security instead of rebuilding it on something weaker.

## What XChain is

XChain is a **metalayer**: a protocol that runs above an unmodified base blockchain, using ordinary transactions to carry its data. Software running the protocol reads those transactions and derives its own state (balances, order books, contract storage) by a fixed, deterministic set of rules anyone can independently replay and verify.

The result is a full digital-token stack expressed as **36 standard ACTIONs**: issue and manage tokens (including non-fungible and limited-edition tokens), transfer and airdrop, trade on a native on-chain exchange, swap tokens trustlessly across chains, deploy smart contracts and call them across chains, publish encrypted token-gated content, run staking, and store data, all secured by the base chain, with no bridge anywhere in the system.

Critically, **none of this is Bitcoin-specific.** The metalayer technique works on any suitable chain. Bitcoin, Litecoin, and Dogecoin are the first three; adding another UTXO chain is a configuration change, not a rebuild. XChain is designed to grow into a platform spanning a large number of blockchains over time.

## Why us

XChain is built and stewarded by co-founders **Jeremy Johnson** and **Javier Varona Zavatti** of Dankest, LLC, both former maintainers of Counterparty, the canonical production metalayer protocol on Bitcoin. They kept a metalayer correct and live through real forks, real reorgs, and real user funds, and are now applying that experience to a clean, modern, multi-chain implementation.

## What makes it different

Three things are genuinely hard to replicate:

**Smart contracts on Bitcoin that cannot corrupt the ledger.** Most platforms make the contract engine *be* the protocol, so every contract bug can drain funds or mint tokens from nothing. XChain inverts this: contracts are *orchestration logic*; they cannot touch the ledger directly, only emit the same validated operations a user would, which pass through the same audited handlers. That delivers general-purpose programmability with the blast radius of a small, fixed, battle-tested rule set. Execution is fully deterministic and reorg-safe.

**AI- and web-callable contracts.** XChain contracts can ask the outside world a question (an HTTPS fetch, or a prompt to an approved AI model) and get a *verified* answer back on-chain. A validator network fetches the answer independently, agrees on the result, and writes it so the outcome is reproducible by anyone replaying the chain. This makes a long-promised class of applications finally practical: AI-judged contests and moderation, parametric insurance, prediction markets settled from real sources, data-reactive treasuries.

**Bridgeless multi-chain.** Because XChain never wraps or locks tokens, there's no bridge to attack. Cross-chain swaps are coordinated (never custodied) by a stake-weighted Byzantine-fault-tolerant validator network; tokens stay on their home chains and only ownership changes, and the same rail carries cross-chain contract calls. Cross-chain settlement already works in production.

Reinforcing these: token-gated encrypted content that unlocks client-side with no key server, a staking primitive that lets any token back any contract on any chain, a fully transparent ledger anyone can replay from genesis, and a light-client path that lets an app verify a balance against quorum-signed checkpoints without trusting any single server.

## Token and economics

The gas token, **XCHAIN**, is conservative by design:

- **Fixed, hard-capped supply, zero pre-mint**: the cap is set at genesis but supply starts at zero and is created only through public mints during the launch window. Once the window closes, no further XCHAIN can ever be created, by anyone, and supply only *decreases* afterward through a deflationary fee burn.
- **No inflation**: validator rewards are paid from a pre-funded pool, never minted.
- **Demand** comes from fee payment and staking lockup against that fixed cap.

The genesis distribution honors the communities that pioneered Bitcoin-native tokens: a snapshot reserving tick-name ownership for prior holders, plus a pre-funded validator reward pool. A fair launch: no ICO, no pre-mint, no insider faucet; anyone can mint their share once the operator opens the window, first-come up to the cap.

XChain is open source (AGPL-3.0) with a commercial license available for proprietary use.

## Status: built, not promised

- **Live in production** on Bitcoin, Litecoin, and Dogecoin, with public explorer, encoder, and hub services behind TLS.
- **Cross-chain settlement proven end-to-end** between live chains.
- **15 components** spanning the full stack: node manager, encoder, decoder, indexer, explorer, hub, UTXO tracker, VM, replication, SDK, multi-platform wallet, contract template library, regtest tooling, end-to-end tests, and the operator dashboard, plus a complete protocol specification.
- **A full developer SDK** (the full operation set, contract deploy/execute, cross-chain calls, light-client proof verification, live streaming, transaction building) with the wallet as a reference client.
- **AGPL-3.0 licensed**, with a commercial license available for proprietary use; the source repositories flip public at launch.

## Where it's going

Near term: protocol freeze, public site and API documentation, the public release of the source repositories, and the coordinated mainnet activation of the staking and light-client features (the wallet is already wired in as the light client's first consumer on testnet and regtest). Beyond: breadth across the UTXO family (each new chain is additive), deeper economic phases for the attestation framework, and (longer term) research toward account-model chains without reintroducing bridge risk.

---

*For the complete technical specification, read the [XChain Platform White Paper](./whitepaper.md).*

---

**Copyright (c) 2025-2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC, https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) with a commercial license available for proprietary use.
