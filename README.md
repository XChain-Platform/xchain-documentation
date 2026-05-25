<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform

A blockchain-agnostic token protocol currently running on Bitcoin, Dogecoin, and Litecoin. Create, transfer, trade, and manage tokens, run smart contracts, and stake for validation using 28 ACTION commands embedded directly in standard blockchain transactions — no sidechains, no bridges, no separate consensus mechanism. The platform includes a built-in DEX, a sandboxed JavaScript virtual machine for on-chain smart contracts, cross-chain swap support, and **cryptographically secure token-gated file publishing** — encrypt single files or multi-file packs on-chain so only holders of a specific token can decrypt them (see [Token-Gated Content](./protocol/Token_Gated_Content.md)). The platform can be extended to run on any Bitcoin-compatible blockchain, including private blockchains for enterprise deployments.

**New here?** Start with [What is XChain?](./getting-started/What_Is_XChain.md) or jump straight to the [Developer Quickstart](./getting-started/Quickstart_Developer.md).

## Documentation

| Section | Description | Audience |
|---|---|---|
| [**Getting Started**](./getting-started/) | Platform intro, quickstarts, glossary | Everyone |
| [**Core Concepts**](./concepts/) | Metalayer, tokens, ACTIONs, encoding, cross-chain, gas, security | Everyone |
| [**Architecture**](./architecture/) | Data pipeline, component map, database design | Developers |
| [**Supported Blockchains**](./BLOCKCHAINS.md) | Supported chains, adding new blockchains, private deployments | Developers / Operators |
| [**Components**](./components/) | Detailed docs for each of the 13 components | Developers |
| [**Developer Guide**](./developer-guide/) | Tutorials: build tokens, dispensers, query data, integrate, testing | Developers |
| [**User Guide**](./user-guide/) | Capabilities, use cases, FAQ — no code required | Non-technical |
| [**Protocol Spec**](./protocol/) | 28 ACTION definitions, Token Information Standard, schemas | Protocol devs |
| [**Operations**](./operations/) | Deployment, Docker, monitoring, upgrades, troubleshooting | Operators |

## Components

| Component | Role |
|---|---|
| [**xchain-node**](https://github.com/XChain-Platform/xchain-node/) | CLI tool that installs, configures, and manages all services as Docker containers |
| [**xchain-encoder**](https://github.com/XChain-Platform/xchain-encoder/) | Embeds ACTION data into unsigned PSBTs, auto-selects encoding format |
| [**xchain-decoder**](https://github.com/XChain-Platform/xchain-decoder/) | Polls coin nodes for blocks, extracts and decodes XChain transactions into MariaDB |
| [**xchain-indexer**](https://github.com/XChain-Platform/xchain-indexer/) | Validates ACTIONs, maintains token state with a double-entry ledger, runs a DEX matching engine, executes smart contracts |
| [**xchain-sync**](https://github.com/XChain-Platform/xchain-sync/) | Replicates indexer databases to validators and consumers via REST snapshots and WebSocket streaming |
| [**xchain-explorer**](https://github.com/XChain-Platform/xchain-explorer/) | 60+ REST/JSON-RPC endpoints, WebSocket real-time event streaming, and a web-based block explorer |
| [**xchain-hub**](https://github.com/XChain-Platform/xchain-hub/) | Decentralized config oracle, price oracle, cross-chain attestation, SWAP coordinator, PBFT consensus, P2P gossip, governance |
| [**xchain-utxo-tracker**](https://github.com/XChain-Platform/xchain-utxo-tracker/) | Real-time UTXO indexer powering balance queries and transaction construction |
| [**xchain-vm**](https://github.com/XChain-Platform/xchain-vm/) | Sandboxed JavaScript virtual machine for on-chain smart contracts with gas metering, deterministic execution, and reorg-safe state |
| [**xchain-sdk**](https://github.com/XChain-Platform/xchain-sdk/) | Developer SDK — 28 action methods, 48 explorer queries, smart contract support, real-time WebSocket events, batch builder, PSBT generation |
| [**xchain-wallet**](https://github.com/XChain-Platform/xchain-wallet/) | Reference self-custodial multi-chain wallet — browser, Chrome extension, and Electron desktop from a single codebase; software + Trezor + Ledger + remote + multisig signers; full DEX, messaging, contracts, staking, and `window.xchain` dApp bridge |
| [**xchain-regtest-miner**](https://github.com/XChain-Platform/xchain-regtest-miner/) | Auto-mines blocks for regtest development environments |
| [**xchain-e2e-test**](https://github.com/XChain-Platform/xchain-e2e-test/) | Full-stack Mocha test suite running against a live regtest deployment |

## Legal

This project is licensed under the **Dankest Community License** (based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

| Document | Description |
|---|---|
| [**LICENSE**](./LICENSE.md) | Full license text |
| [**NOTICE**](./NOTICE.md) | Required attribution, license summary, and third-party notices |

Any redistribution or modification must include the attribution notice specified in [NOTICE.md](./NOTICE.md). Commercial use requires prior written consent from Dankest, LLC — see [LICENSE.md](./LICENSE.md) for details.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](./LICENSE.md) and [NOTICE](./NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
