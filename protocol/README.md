<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Protocol Specification

This section is the canonical reference for the XChain Protocol; ACTION command formats, token metadata standards, database naming conventions, and machine-readable JSON schemas. Intended for protocol developers, indexer implementors, and anyone building tools that must interoperate with the platform at the data level.

| Resource | Description |
|---|---|
| [ACTION Specifications](./actions/) | Authoritative format specs for every named ACTION command |
| [ACTION Manifest](./action-manifest.md) | The authoritative cross-repo ACTION registry (`action-manifest.json`) and the conformance tests that enforce it |
| [Token Information Standard](./token-information-standard.md) | Standard for token metadata fields and discovery |
| [Token-Gated Content](./token-gated-content.md) | End-to-end design for cryptographically secure token-gated file publishing (single files and packs) |
| [Taproot Envelope](./taproot-envelope.md) | Large-payload carrier for Bitcoin and Litecoin: one commit/reveal pair writes a whole file into a single tapscript witness |
| [NFT Standard](./nft-standard.md) | Non-fungible tokens as a composition of existing primitives: uniques, editions, collections, content attachment, display |
| [Project Registry Standard](./project-registry.md) | Chain-native curated directories; a project tick attests its official tokens via an owner-validated LIST + LINK roster |
| [Controller-Bound Tokens](./controller-bound-tokens.md) | Programmable policy layer: a contract gates native actions on a bound token or address, with royalty enforcement |
| [Contract ABI](./contract-abi.md) | Optional self-declared display metadata (method summaries, typed params, read-only flags) contracts export for wallets and explorers |
| [Contract-Targeted Staking](./contract-staking.md) | Design and VM API for staking any token against a smart contract with contract-decided slashing |
| [Cross-Chain Contract Calls](./cross-chain-calls.md) | XCALL: a contract on one chain calls a contract on another, verified by federation capability signatures |
| [Cross-Chain DEX](./cross-chain-dex.md) | Network-scoped mirror settlement: trading a token on one chain against a token on another |
| [x402 Payments](./x402-payments.md) | HTTP 402 payment interop: machine-payable web resources settled with XChain actions |
| [Attestation Providers](./providers/) | Provider specs for the attestation framework (`http_get`, `llm`) |
| [Error Codes](./error-codes.md) | Stable machine-readable error-code registry |
| [XChain URI Scheme](./xchain-uri-scheme.md) | Cross-chain payment and action URI format for QR codes, deep links, and clipboard payloads |
| [Index ID References](./index-id-references.md) | The `^<id>` compact wire form for tickers and addresses, and the deterministic reorg-safe id assignment rule |
| [Database Naming Structure](./database-naming-structure.md) | Naming conventions for all platform databases |
| [Protocol Activation (Flag Days)](./protocol-activation.md) | How consensus changes activate: the per-network time/height gate, the three activation cohorts, and forking vs halt-recoverable straggler behavior |
| [Upgrade Notice Policy](./upgrade-notice-policy.md) | Minimum lead time between a release carrying consensus activation values and the moment they fire |
| [JSON Schemas](./json/) | Machine-readable schemas for ACTION payloads and API responses |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
