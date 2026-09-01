<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->

# XChain Platform

A blockchain-agnostic token protocol currently running on Bitcoin, Litecoin, and Dogecoin. Create, transfer, trade, and manage tokens, run smart contracts that can call out to AI models and the web, and stake for validation using 37 ACTION commands, 36 of them embedded directly in standard blockchain transactions. No sidechains, no bridges, no separate consensus mechanism. The platform includes a built-in DEX, a sandboxed JavaScript virtual machine for on-chain smart contracts, cross-chain swap support, and **cryptographically secure token-gated file publishing**: encrypt single files or multi-file packs on-chain so only holders of a specific token can decrypt them (see [Token-Gated Content](./protocol/token-gated-content.md)). The platform can be extended to run on any Bitcoin-compatible blockchain, including private blockchains for enterprise deployments.

**New here?** Start with [What is XChain?](./getting-started/what-is-xchain.md) or jump straight to the [Developer Quickstart](./getting-started/quickstart-developer.md).

## Documentation

| Section | Description | Audience |
|---|---|---|
| [**Getting Started**](./getting-started/) | Platform intro, quickstarts, glossary | Everyone |
| [**Core Concepts**](./concepts/) | Metalayer, tokens, ACTIONs, encoding, cross-chain, gas, security | Everyone |
| [**Architecture**](./architecture/) | Data pipeline, component map, database design | Developers |
| [**Supported Blockchains**](./blockchains.md) | Supported chains, adding new blockchains, private deployments | Developers / Operators |
| [**Components**](./components/) | Detailed docs for each of the 15 components | Developers |
| [**Developer Guide**](./developer-guide/) | Tutorials: build tokens, dispensers, query data, integrate, testing | Developers |
| [**AI & Agents**](./ai-agents/) | Building AI agents: reading, transacting via MCP, bounded agent wallets, charging agents for data | Developers |
| [**User Guide**](./user-guide/) | Capabilities, use cases, FAQ. No code required | Non-technical |
| [**Protocol Spec**](./protocol/) | ACTION format specifications, Token Information Standard, schemas | Protocol devs |
| [**Operations**](./operations/) | Deployment, Docker, monitoring, upgrades, troubleshooting | Operators |
| [**Legal**](./legal/) | Licensing, commercial license, trademark, contributor agreement | Everyone |

## Components

| Component | Role |
|---|---|
| [**xchain-node**](https://github.com/XChain-Platform/xchain-node/) | CLI tool that installs, configures, and manages all services as Docker containers |
| [**xchain-encoder**](https://github.com/XChain-Platform/xchain-encoder/) | Embeds ACTION data into unsigned PSBTs, auto-selects encoding format |
| [**xchain-decoder**](https://github.com/XChain-Platform/xchain-decoder/) | Polls coin nodes for blocks, extracts and decodes XChain transactions into MariaDB |
| [**xchain-indexer**](https://github.com/XChain-Platform/xchain-indexer/) | Validates ACTIONs, maintains token state with a double-entry ledger, runs a DEX matching engine, executes smart contracts |
| [**xchain-sync**](https://github.com/XChain-Platform/xchain-sync/) | Replicates indexer databases to validators and consumers via REST snapshots and WebSocket streaming |
| [**xchain-explorer**](https://github.com/XChain-Platform/xchain-explorer/) | 200+ REST/JSON-RPC endpoints, WebSocket live event streaming, and a web-based block explorer |
| [**xchain-hub**](https://github.com/XChain-Platform/xchain-hub/) | Decentralized config oracle, price oracle, cross-chain attestation, SWAP coordinator, PBFT consensus, P2P gossip, governance |
| [**xchain-utxo-tracker**](https://github.com/XChain-Platform/xchain-utxo-tracker/) | Real-time UTXO indexer powering balance queries and transaction construction |
| [**xchain-vm**](https://github.com/XChain-Platform/xchain-vm/) | Sandboxed JavaScript virtual machine for on-chain smart contracts with gas metering, deterministic execution, and reorg-safe state |
| [**xchain-contracts**](https://github.com/XChain-Platform/xchain-contracts/) | MIT-licensed template library: audited example smart contracts, reusable patterns, a no-code policy generator, and a CLI, deployed via the ordinary `DEPLOY` action |
| [**xchain-sdk**](https://github.com/XChain-Platform/xchain-sdk/) | Developer SDK: builders for all 31 developer-invocable actions, 100+ explorer query methods, smart contract support, live WebSocket events, batch builder, PSBT generation |
| [**xchain-wallet**](https://github.com/XChain-Platform/xchain-wallet/) | Reference self-custodial multi-chain wallet: browser, Chrome extension, and Electron desktop from a single codebase; software + Trezor + Ledger + remote + multisig signers; full DEX, messaging, contracts, staking, and `window.xchain` dApp bridge |
| [**xchain-regtest-miner**](https://github.com/XChain-Platform/xchain-regtest-miner/) | Auto-mines blocks for regtest development environments |
| [**xchain-e2e-test**](https://github.com/XChain-Platform/xchain-e2e-test/) | Full-stack Mocha test suite running against a live regtest deployment |
| **xchain-dashboard** (internal) | Operator console: service monitoring, CI status, host metrics; source is not publicly distributed |
## Legal

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** with a commercial license available for proprietary use.

| Document | Description |
|---|---|
| [**LICENSE**](./LICENSE.md) | Full license text |
| [**NOTICE**](./NOTICE.md) | Required attribution, license summary, and third-party notices |

Any redistribution or modification must include the attribution notice specified in [NOTICE.md](./NOTICE.md). You may run and modify XChain for free under the AGPL-3.0, including inside a for-profit company, provided you share any modifications under the AGPL; a commercial license from Dankest, LLC is required only to keep modifications private or to embed XChain in a closed-source product (see [legal/licensing.md](./legal/licensing.md) for details).

---

**Copyright &copy; 2025-2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](./LICENSE.md) and [NOTICE](./NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
