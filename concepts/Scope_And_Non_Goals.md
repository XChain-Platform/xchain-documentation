<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Scope and Non-Goals

XChain is deliberately a **token-and-settlement metalayer**, not a general-purpose world
computer. Knowing what the platform is *not* trying to be is as important as knowing what it
does — it sets correct expectations, avoids comparing XChain against systems built for entirely
different goals, and helps you choose the right tool for a given problem.

This page draws a clear boundary. The [non-goals](#deliberate-non-goals) are design choices,
not missing features — each one is a trade made on purpose in exchange for the platform's core
properties (inherited blockchain security, full determinism, no new consensus to trust). The
[current boundaries](#current-boundaries) are honest limitations of the present design that a
builder should plan around.

---

## In Scope

XChain aims to be the most complete **digital-asset layer** that can run on unmodified
Bitcoin-family blockchains:

- **Tokens** with rich issuance rules — supply caps, decimals, mint windows, allow/block
  lists, permanent locks, force-recall, and pause (see [Tokens](./TOKENS.md)).
- **A native DEX** — on-chain order book with native-coin settlement, fixed-price dispensers,
  and trustless cross-chain swaps (see [Cross-Chain](./CROSS_CHAIN.md)).
- **A smart-contract VM** that orchestrates the protocol's validated ACTIONs, can reach the
  outside world through validator-attested HTTPS/AI calls, and can be staked against (see
  [Smart Contracts](./Smart_Contracts.md)).
- **Data and messaging** — on-chain files, messages, oracle/price feeds, and token-gated
  encrypted content.
- **Permissionless, independent verification** — anyone can run a full node and recompute the
  entire state from the blockchain (see [Security Model](./Security_Model.md)).

Everything in scope shares one property: it can be expressed as deterministic rules applied to
data embedded in standard coin transactions, secured by the host chain's existing consensus.

---

## Deliberate Non-Goals

These are things XChain does **not** try to do, on purpose. In each case the alternative would
require giving up one of the platform's foundational guarantees.

### Confidentiality and privacy

All XChain state — balances, transfers, holders, orders, contract state — is **fully public**.
The obfuscation applied to ACTION payloads is not encryption: its key is derived from public
transaction data, so anyone running a node can read everything (see
[Security Model → Obfuscation Is Not Encryption](./Security_Model.md)). XChain is not a privacy
coin and provides no confidential transactions, shielded balances, or transaction mixing. The
`MESSAGE` action can encrypt message *contents* between two parties, but never hides metadata.

*Why:* public, replayable state is what makes independent verification possible. Confidential
balances would require a fundamentally different cryptographic model. **If you need
confidentiality, do not put the sensitive value on-chain in cleartext.**

### A new blockchain, new consensus, or real-time finality

XChain has no miners, validators, or consensus of its own for transaction ordering — it
inherits all of that from Bitcoin, Litecoin, or Dogecoin (see [Metalayer](./METALAYER.md)). A
direct consequence: **XChain operates at block speed.** Confirmation, order matching, and
cross-chain settlement all wait for blocks to be mined. XChain is not a low-latency or
real-time system, has no payment channels or off-chain rollup, and is not suitable for
point-of-sale, gaming, or high-frequency trading. The hub validator network exists only for
configuration, price oracles, cross-chain coordination, and attestation — never for ordering or
settlement of token state.

*Why:* inheriting the host chain's proof-of-work is exactly what lets XChain avoid bridges and
a new trust layer. Speed is the price of that security.

### A general-purpose "world computer"

XChain contracts are **orchestration logic, not arbitrary state machines**. A contract cannot
mutate the ledger directly — it emits the same validated ACTIONs a user would (see
[Smart Contracts](./Smart_Contracts.md)). By design, contracts also cannot call or deploy other
contracts, and cannot observe the effects of their own emissions within a single execution
(snapshot semantics). This makes the audit surface small and every state change uniform, but it
means XChain is **not** a platform for synchronous, deeply-composed contract-to-contract DeFi in
the EVM sense.

*Why:* constraining contracts to a fixed, audited action set means a contract bug can never
bypass protocol rules or corrupt the ledger.

### Bridging to non-UTXO ecosystems

XChain runs on Bitcoin-compatible (UTXO) chains. Adding another such chain is a configuration
change. It does **not** bridge to or interoperate with account-model ecosystems (Ethereum/EVM,
Solana, etc.), and there are no wrapped external assets or cross-ecosystem liquidity. Cross-chain
functionality is limited to swaps and references **among the supported UTXO chains**, and is
coordinated (not custodied) by the hub.

*Why:* the metalayer technique — embedding and replaying data on an unmodified base chain —
only applies to chains that work like Bitcoin. Reaching other ecosystems would reintroduce the
bridge risk XChain was designed to avoid.

---

## Current Boundaries

These are honest limitations of the present design rather than permanent philosophical
positions. Build with them in mind.

### Full trust requires running a node

Trustless verification of XChain state means running the full stack (decoder + indexer) and
replaying from genesis. Per-block hashes exist for integrity checking (see
[Block Hashes](./Block_Hashes.md)), but there is **no light-client / SPV protocol** today: a
lightweight wallet that does not run a node necessarily trusts the explorer it queries. Treat
data from a third-party API as trusted-source data unless you verify it against your own node.

### Minority-chain security tracks the host chain

XChain's finality on each chain is exactly the finality of that chain. Bitcoin-secured tokens
inherit Bitcoin's settlement assurances; tokens on a smaller chain inherit that chain's smaller
security budget, including its greater exposure to deep reorganizations. Choose confirmation
thresholds appropriate to the chain — higher on lower-hashpower chains — for high-value
settlement. The platform's default guidance reflects this: roughly **BTC 6 / LTC 12 / DOGE 60**
confirmations (the cross-chain settlement gate is per-chain and tunable via
`XCHAIN_CONFIRMATIONS_<COIN>`; the utxo-tracker's reorg recovery window scales with it).

### Fungible-first token model

The token model is fungible (ticker + supply + decimals). A one-of-a-kind asset can be
approximated with a supply of 1 and zero decimals, but there is no first-class non-fungible
(collection / per-item metadata / royalty) primitive today.

### Rich metadata lives off-chain

To keep on-chain data minimal, token media and extended metadata are referenced by URI under
the [Token Information Standard](../protocol/Token_Information_Standard.md). That content's
availability depends on where it is hosted; it is not part of the verifiable on-chain state.

---

## Choosing XChain

| XChain is a strong fit for… | Look elsewhere if you need… |
|---|---|
| Tokens secured directly by Bitcoin-family proof-of-work, no bridge | Confidential balances or private transfers |
| A transparent, auditable, fully-replayable asset ledger | Sub-second / real-time settlement |
| A native DEX and trustless cross-chain swaps among BTC/LTC/DOGE | Deep synchronous DeFi composability (EVM-style) |
| Contracts that react to real-world data or AI judgments | Interop with Ethereum/Solana assets and liquidity |
| Self-hostable, permissionless, independently verifiable infrastructure | A first-class NFT/collection standard (today) |

The shortest summary: **XChain is a transparent, multi-chain token layer secured by the base
blockchain — not a privacy system, not a real-time layer-2, and not an EVM-style world
computer.** Those exclusions are what make its core guarantees hold.

---

*See also: [Metalayer](./METALAYER.md) | [Security Model](./Security_Model.md) | [Smart Contracts](./Smart_Contracts.md) | [Cross-Chain](./CROSS_CHAIN.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
