<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

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

3. **Counterparty match**: A user on chain B who wants to accept the offer sends a corresponding `SWAP` ACTION on chain B, referencing the original offer (by its `ACTION_INDEX` on chain A). Their tokens are locked in escrow by the indexer on chain B.

4. **Settlement**: The hub signals both indexers that a match exists. Each indexer releases the escrowed tokens to the counterparty address. The swap completes atomically — both sides settle, or neither does.

5. **Timeout / cancellation**: If no counterparty matches within the offer's validity window, the originating user can cancel and recover their escrowed tokens.

Throughout this process, no tokens leave their native chain. Bitcoin tokens stay on Bitcoin. Litecoin tokens stay on Litecoin. Only ownership changes.

## The Hub's Role

The xchain-hub serves two functions in cross-chain operations:

**Configuration oracle**: The hub distributes fee schedules, special addresses (GAS, BURN, DONATE), and protocol parameters to all services. This is its primary role in day-to-day operation.

**Swap coordinator**: For SWAP actions, the hub maintains the registry of open offers and coordinates the matching and settlement signals between indexers on different chains.

The hub does not have custody of any tokens at any point. If the hub is unavailable, existing settled state is unaffected — it is only new swap coordination that requires hub availability.

For current and planned decentralization of hub functions, see the architecture documents under [`../architecture/`](../architecture/).

## LINK: Cross-Chain Action References

The `LINK` ACTION creates an explicit cross-reference to another ACTION by its `ACTION_INDEX`, optionally on a different chain. This is useful for:

- Linking a token on one chain to its counterpart on another
- Associating a settlement transaction with the offer it fulfills
- Building audit trails that span multiple chains

A LINK is purely a reference record — it does not move tokens or change state. It exists to make relationships between actions queryable through the explorer.

## Future Chain Support

Adding a new Bitcoin-compatible chain to XChain requires only a configuration file — no changes to the core protocol or service code. As more chains are added, the SWAP mechanism extends naturally: any two chains can exchange tokens through the same hub coordination process, without requiring a direct bridge or liquidity pool between them.

---

*See also: [Actions](./ACTIONS.md) | [Security Model](./SECURITY_MODEL.md) | [SWAP spec](../protocol/actions/SWAP.md) | [LINK spec](../protocol/actions/LINK.md)*

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
