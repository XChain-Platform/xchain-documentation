<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Core Concepts

This section explains the fundamental ideas behind the XChain Protocol. Each document is self-contained and scales from high-level overviews to technical depth — start with what you need and follow the cross-references.

| Document | Description |
|---|---|
| [Metalayer](./METALAYER.md) | How XChain runs above existing blockchains without sidechains or bridges |
| [Actions](./ACTIONS.md) | What ACTIONs are and how they drive every state change on the platform |
| [Tokens](./TOKENS.md) | The XChain token model — supply, decimals, ownership, and locking rules |
| [Ledger](./LEDGER.md) | Double-entry accounting model underlying all balance and ownership tracking |
| [Encoding](./ENCODING.md) | How ACTION data is embedded in blockchain transactions via AES-128-CTR obfuscation |
| [Cross-Chain](./CROSS_CHAIN.md) | How XChain coordinates token swaps across Bitcoin, Litecoin, and Dogecoin |
| [Gas](./GAS.md) | The XCHAIN fee token — what it is, how it works, and why it exists |
| [Security Model](./Security_Model.md) | Threat model, trust assumptions, and protocol-level security guarantees |
| [Smart Contracts](./Smart_Contracts.md) | Programmable contract layer — sandboxed JavaScript VM with gas metering that orchestrates existing ACTIONs |
| [Block Hashes](./Block_Hashes.md) | Per-block cryptographic hashes (ledger, actions, contracts) for state verification and integrity checking |
| [Scope and Non-Goals](./Scope_And_Non_Goals.md) | What XChain deliberately is and is not — design boundaries, current limitations, and when to choose it |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
