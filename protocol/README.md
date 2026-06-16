<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Protocol Specification

This section is the canonical reference for the XChain Protocol — ACTION command formats, token metadata standards, database naming conventions, and machine-readable JSON schemas. Intended for protocol developers, indexer implementors, and anyone building tools that must interoperate with the platform at the data level.

| Resource | Description |
|---|---|
| [ACTION Specifications](./actions/) | Authoritative format specs for all 34 ACTION commands |
| [Token Information Standard](./Token_Information_Standard.md) | Standard for token metadata fields and discovery |
| [Token-Gated Content](./Token_Gated_Content.md) | End-to-end design for cryptographically secure token-gated file publishing (single files and packs) |
| [NFT Standard](./NFT_Standard.md) | Non-fungible tokens as a composition of existing primitives — uniques, editions, collections, content attachment, display |
| [Project Registry Standard](./Project_Registry.md) | Chain-native curated directories — a project tick attests its official tokens via an owner-validated LIST + LINK roster |
| [Contract-Targeted Staking](./Contract_Staking.md) | Design and VM API for staking any token against a smart contract with contract-decided slashing |
| [XChain URI Scheme](./XChain_URI_Scheme.md) | Cross-chain payment and action URI format for QR codes, deep links, and clipboard payloads |
| [Database Naming Structure](./Database_Naming_Structure.md) | Naming conventions for all platform databases |
| [JSON Schemas](./json/) | Machine-readable schemas for ACTION payloads and API responses |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
