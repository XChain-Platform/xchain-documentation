# XChain Platform

A blockchain-agnostic token protocol currently running on Bitcoin, Dogecoin, and Litecoin. Create, transfer, trade, and manage tokens using 19 ACTION commands embedded directly in standard blockchain transactions — no sidechains, no bridges, no separate consensus mechanism.

## What You Can Do

- **Create tokens** — Issue tokens with configurable supply, decimals, minting rules, allow/block lists, lockable parameters, and transfer restrictions
- **Transfer tokens** — Single sends, multi-sends to many addresses, airdrops to lists, dividends to all holders, and full-balance sweeps
- **Trade on a DEX** — On-chain order books with automatic matching, and token vending machines (dispensers) that sell tokens on demand
- **Swap across chains** — Atomic token swaps between Bitcoin, Litecoin, Dogecoin, and any future supported chains
- **Store data on-chain** — Upload files, send encrypted messages (ECDH or AES), and publish broadcast oracles
- **Control token behavior** — Pause trading with SLEEP, recall tokens with CALLBACK, restrict access with allow/block lists, and set minting windows

See the [Platform Overview](./PLATFORM.md) for the full architecture, protocol details, component deep-dives, and more on what you can build.

## Components

| Component | Role |
|---|---|
| [**xchain-node**](https://github.com/XChain-platform/xchain-node/) | CLI tool that installs, configures, and manages all services as Docker containers |
| [**xchain-encoder**](https://github.com/XChain-platform/xchain-encoder/) | Embeds ACTION data into unsigned PSBTs, auto-selects encoding format |
| [**xchain-decoder**](https://github.com/XChain-platform/xchain-decoder/) | Polls coin nodes for blocks, extracts and decodes XChain transactions into MariaDB |
| [**xchain-indexer**](https://github.com/XChain-platform/xchain-indexer/) | Validates ACTIONs, maintains token state with a double-entry ledger, runs a DEX matching engine |
| [**xchain-explorer**](https://github.com/XChain-platform/xchain-explorer/) | 50+ REST/JSON-RPC endpoints and a web-based block explorer |
| [**xchain-hub**](https://github.com/XChain-platform/xchain-hub/) | Configuration oracle, pricing data, and cross-chain swap coordination |
| [**xchain-utxo-tracker**](https://github.com/XChain-platform/xchain-utxo-tracker/) | Real-time UTXO indexer powering balance queries and transaction construction |
| [**xchain-sdk**](https://github.com/XChain-platform/xchain-sdk/) | Developer SDK — 19 action methods, 40 explorer queries, batch builder, PSBT generation |
| [**xchain-regtest-miner**](https://github.com/XChain-platform/xchain-regtest-miner/) | Auto-mines blocks for regtest development environments |
| [**xchain-e2e-test**](https://github.com/XChain-platform/xchain-e2e-test/) | Full-stack Mocha test suite running against a live regtest deployment |

## Documentation

| Section | Description | Audience |
|---|---|---|
| [**Getting Started**](./getting-started/) | Platform intro, quickstarts, glossary | Everyone |
| [**Core Concepts**](./concepts/) | Metalayer, tokens, ACTIONs, encoding, cross-chain, gas, security | Everyone |
| [**Architecture**](./architecture/) | Data pipeline, component map, database design | Developers |
| [**Components**](./components/) | Detailed docs for each of the 10 microservices | Developers |
| [**Developer Guide**](./developer-guide/) | Tutorials: build tokens, dispensers, query data, integrate | Developers |
| [**User Guide**](./user-guide/) | Capabilities, use cases, FAQ — no code required | Non-technical |
| [**Protocol Spec**](./protocol/) | 19 ACTION definitions, Token Information Standard, schemas | Protocol devs |
| [**Operations**](./operations/) | Deployment, Docker, monitoring, upgrades, troubleshooting | Operators |

### Reference

| Document | Description |
|---|---|
| [**Platform Overview**](./PLATFORM.md) | Comprehensive architecture, protocol details, component deep-dives, and what you can build |
| [**Supported Blockchains**](./BLOCKCHAINS.md) | Currently supported chains, adding new blockchains, regtest and private deployments |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
