<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Cross-Chain Functionality

XChain runs independently on each supported blockchain. Bitcoin, Litecoin, and Dogecoin each have their own full pipeline — their own decoder, indexer, and state database. Tokens on Bitcoin are not the same assets as tokens on Litecoin, even if they share a ticker. The chains are parallel, independent ledgers.

## Independent Per-Chain State

Each chain maintains:

- Its own token registry (ISSUE actions on BTC create BTC tokens, not LTC tokens)
- Its own balance ledger and order books
- Its own XCHAIN fee token (BTC XCHAIN ≠ LTC XCHAIN)
- Its own block height and reorg history

There is no shared state between chains at the protocol level. An address that holds 1000 MYTOKEN on Bitcoin has no claim on MYTOKEN on Litecoin — those are two separate tokens that happen to share a name, owned by whoever issued them on each chain.

## SWAP: Cross-Chain Atomic Trades

The `SWAP` ACTION enables trustless exchange of tokens across chains. The mechanism is coordinated by the xchain-hub but does not require trusting the hub with custody of funds — tokens are held in escrow on each chain by the protocol, not by the hub.

### How a Swap Works

1. **Offer creation**: A user sends a `SWAP` ACTION on chain A, specifying the token they are offering, the amount, and what they want in return (a token on chain B). The offered tokens are locked in escrow by the indexer on chain A.

2. **Hub coordination**: The hub records the open offer and makes it discoverable to potential counterparties. It does not hold any tokens — it only holds metadata about the pending swap.

3. **Counterparty match**: A user on chain B who wants to accept the offer sends a corresponding `SWAP` ACTION on chain B with the mirrored token pair and amounts. The hub federation matches the two offers automatically. Their tokens are locked in escrow by the indexer on chain B.

4. **Settlement**: The hub signals both indexers that a match exists. Each indexer releases the escrowed tokens to the counterparty address. The swap completes atomically — both sides settle, or neither does.

5. **Timeout / cancellation**: If no counterparty matches within the offer's validity window, the originating user can cancel and recover their escrowed tokens.

Throughout this process, no tokens leave their native chain. Bitcoin tokens stay on Bitcoin. Litecoin tokens stay on Litecoin. Only ownership changes.

## The Hub's Role

The xchain-hub serves several functions in cross-chain operations:

**Configuration oracle**: The hub distributes fee schedules, special addresses (GAS, BURN, DONATE), and protocol parameters to all services via PBFT consensus.

**Price oracle**: Validators fetch cryptocurrency prices from external APIs, aggregate via trimmed median, and finalize via PBFT consensus. Fee quotes convert gas costs to native coin amounts using these prices.

**Cross-chain attestation**: For cross-chain actions, validators reach PBFT consensus to attest that a source-chain action exists and has sufficient confirmations (BTC: 6, LTC: 12, DOGE: 60 — higher on the lower-hashpower chains to approach BTC-comparable settlement assurance; per-chain, configurable via `XCHAIN_CONFIRMATIONS_<COIN>`). Only validators supporting both chains in a pair participate in attestation quorum.

**Cross-chain DEX coordinator**: For SWAP and ORDER actions, the hub's `CrossChainDexEngine` discovers open cross-chain offers, reaches PBFT consensus among `cross_chain`-capable validators, and writes a quorum-signed match record to `cross_chain_matches`. This record is streamed to every indexer via the hub-DB mirror (the same channel as price snapshots). Each indexer independently verifies the validator signatures and then releases its leg's escrowed tokens via an internal `CROSS_SETTLE` action. No per-trade on-chain transaction is written; the attestation engine handles oracle and external-data requests, not DEX settlement.

**Governance**: Validators can propose and vote on parameter changes through off-chain PBFT voting (7-day period, 2/3+ approval).

The hub does not have custody of any tokens at any point. If the hub is unavailable, existing settled state is unaffected — it is only new swap coordination that requires hub availability.

For details on the hub's decentralized validator architecture, see the [`../components/hub/`](../components/hub/) documentation.

## Cross-Chain Contract Calls

Smart contracts can call methods on contracts deployed on a different chain using `xchain.emit.crossExecute`. The calling contract specifies the target chain, the target contract, a method name, parameters, and a mandatory callback method. The validator federation relays the call — after confirming the source-chain request — to the target chain, where it is injected as an execution. The outcome (success, revert, expiry, or error) is relayed back and delivered to the callback method on the source chain.

No per-call on-chain transaction is required, and no value is transferred between chains. Every call is bounded by a deadline: if no result arrives before the deadline block, the callback fires with status `expired`. Contracts that need to respond must implement the `crossCallable` export.

For the full trust model, relay architecture, and lifecycle details, see [`../protocol/Cross_Chain_Calls.md`](../protocol/Cross_Chain_Calls.md).

## LINK: Cross-Chain Action References

The `LINK` ACTION creates an explicit cross-reference to another ACTION by its `ACTION_INDEX`, optionally on a different chain. This is useful for:

- Linking a token on one chain to its counterpart on another
- Associating a settlement transaction with the offer it fulfills
- Building audit trails that span multiple chains

A LINK is purely a reference record — it does not move tokens or change state. It exists to make relationships between actions queryable through the explorer.

## Future Chain Support

Adding a new Bitcoin-compatible chain to XChain requires only a configuration file — no changes to the core protocol or service code. As more chains are added, the SWAP mechanism extends naturally: any two chains can exchange tokens through the same hub coordination process, without requiring a direct bridge or liquidity pool between them.

---

*See also: [Actions](./ACTIONS.md) | [Security Model](./Security_Model.md) | [SWAP spec](../protocol/actions/SWAP.md) | [LINK spec](../protocol/actions/LINK.md) | [Cross-Chain Contract Calls](../protocol/Cross_Chain_Calls.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
