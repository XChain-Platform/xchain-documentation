<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Overview

### What XChain is, why it matters, and where it's going

A short, plain-language introduction to the platform. For the full protocol specification, see the [XChain Platform White Paper](./WHITEPAPER.html).

---

## In one paragraph

XChain is a token platform that turns the world's most secure blockchains into programmable, multi-chain asset networks — without bridges, sidechains, or a new chain to trust. It embeds a complete protocol (tokens, a built-in exchange, cross-chain swaps, smart contracts, and on-chain data) directly inside ordinary blockchain transactions, so every asset inherits the host chain's proof-of-work security wholesale. It is chain-agnostic by design, live in production today on Bitcoin, Litecoin, and Dogecoin, and built to extend across many blockchains. The product exists, runs, and has settled cross-chain trades end-to-end.

## The problem

For a decade, the way to do "more than payments" on a blockchain has been to leave the secure chains behind — moving value onto bridges, sidechains, and new Layer-1s with their own validators and their own trust assumptions. That's also where the money gets stolen: cross-chain bridges are among the most exploited constructs in all of crypto, with billions lost.

The largest, most liquid, most secure chains — Bitcoin and its relatives — were never extended to do this safely. The opportunity is to add the capabilities the market wants *on top of* those chains, inheriting their security instead of rebuilding it on something weaker.

## What XChain is

XChain is a **metalayer**: a protocol that runs above an unmodified base blockchain, using ordinary transactions to carry its data. Software running the protocol reads those transactions and derives its own state — balances, order books, contract storage — by a fixed, deterministic set of rules anyone can independently replay and verify.

The result is a full digital-asset stack expressed as **30 standard operations**: issue and manage tokens, transfer and airdrop, trade on a native on-chain exchange, swap tokens trustlessly across chains, deploy smart contracts, publish encrypted token-gated content, run staking, and store data — all secured by the base chain, with no bridge anywhere in the system.

Critically, **none of this is Bitcoin-specific.** The metalayer technique works on any suitable chain. Bitcoin, Litecoin, and Dogecoin are the first three; adding another UTXO chain is a configuration change, not a rebuild. XChain is designed to grow into a platform spanning a large number of blockchains over time.

## Why us

XChain is built and stewarded by co-founders **Jeremy Johnson** and **Javier Varona Zavatti** of Dankest, LLC — both former maintainers of Counterparty, the canonical production metalayer protocol on Bitcoin. They kept a metalayer correct and live through real forks, real reorgs, and real user funds, and are now applying that experience to a clean, modern, multi-chain implementation.

## What makes it different

Three things are genuinely hard to replicate:

**Smart contracts on Bitcoin that cannot corrupt the ledger.** Most platforms make the contract engine *be* the protocol, so every contract bug can drain funds or mint tokens from nothing. XChain inverts this: contracts are *orchestration logic* — they cannot touch the ledger directly, only emit the same validated operations a user would, which pass through the same audited handlers. That delivers general-purpose programmability with the blast radius of a small, fixed, battle-tested rule set. Execution is fully deterministic and reorg-safe.

**AI- and web-callable contracts.** XChain contracts can ask the outside world a question — an HTTPS fetch, or a prompt to an approved AI model — and get a *verified* answer back on-chain. A validator network fetches the answer independently, agrees on the result, and writes it so the outcome is reproducible by anyone replaying the chain. This makes a long-promised class of applications finally practical and trustless: AI-judged contests and moderation, parametric insurance, prediction markets settled from real sources, data-reactive treasuries.

**Bridgeless multi-chain.** Because XChain never wraps or locks assets, there's no bridge to attack. Cross-chain swaps are coordinated — never custodied — by a Byzantine-fault-tolerant validator network; tokens stay on their home chains and only ownership changes. This already works in production.

Reinforcing these: token-gated encrypted content that unlocks client-side with no key server, a staking primitive that lets any token back any contract on any chain, and a fully transparent ledger anyone can replay from genesis.

## Token and economics

The gas token, **XCHAIN**, is conservative by design:

- **Fixed, hard-capped supply** — minted once at genesis, then permanently locked. No further XCHAIN can ever be created, by anyone. Supply only *decreases*, through a deflationary fee burn.
- **No inflation** — validator rewards are paid from a pre-funded pool, never minted.
- **Demand** comes from fee payment and staking lockup against that fixed cap.

The genesis distribution is planned to honor the communities that pioneered Bitcoin-native tokens — a snapshot reserving asset-name ownership for prior holders, plus a community airdrop. A fair launch: no ICO, no inflationary mint, no insider faucet.

XChain is open source (AGPL-3.0) with a commercial license available for proprietary use.

## Status — built, not promised

- **Live in production** on Bitcoin, Litecoin, and Dogecoin, with public explorer, encoder, and hub services behind TLS.
- **Cross-chain settlement proven end-to-end** between live chains.
- **13 components** spanning the full stack — node manager, encoder, decoder, indexer, explorer, hub, UTXO tracker, VM, replication, SDK, multi-platform wallet, regtest tooling, end-to-end tests, and a complete protocol specification.
- **A full developer SDK** (all 30 operations, contract deploy/execute, real-time streaming, transaction building) with the wallet as a reference client.
- **Open-sourced** across all public repositories.

## Where it's going

Near term: protocol freeze, public site and API documentation, and the public release of the source repositories. Beyond: breadth across the UTXO family (each new chain is additive), a first-class non-fungible primitive, deeper economic phases for the attestation framework, and — longer term — research toward account-model chains without reintroducing bridge risk.

---

*For the complete technical specification, read the [XChain Platform White Paper](./WHITEPAPER.html).*

---

**Copyright © 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) with a commercial license available for proprietary use.
