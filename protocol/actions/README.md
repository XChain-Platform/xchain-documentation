<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform — ACTION Command Specifications

This directory contains the official protocol specifications for all ACTION commands supported by the XChain Platform. These specifications are the authoritative reference for how each action is structured, what parameters it accepts, and what format versions are available.

## What are ACTIONs?

ACTIONs are the fundamental operations of the XChain Protocol. Every state change on the platform — creating a token, transferring balances, placing a DEX order, uploading a file — is expressed as an ACTION embedded in a blockchain transaction.

ACTION data is encoded as a pipe-delimited string:

```
ACTION|VERSION|PARAM1|PARAM2|...
```

Multiple actions can be combined in a single transaction using the `BATCH` action, with individual commands separated by semicolons (`;`).

## Supported Blockchains

XChain ACTIONs are supported on:

- **Bitcoin** (BTC) — mainnet, testnet, regtest
- **Litecoin** (LTC) — mainnet, testnet, regtest
- **Dogecoin** (DOGE) — mainnet, testnet, regtest

The same ACTION specifications apply across all chains. Chain-specific behavior (fee amounts, special addresses) is handled by the indexer's per-chain configuration.

## ACTION Command Reference

### Token Lifecycle

| ACTION | Description |
|---|---|
| [`ISSUE`](./ISSUE.md) | Creates or updates a token (`TICK`) with supply, decimals, locks, and minting rules |
| [`MINT`](./MINT.md) | Mints additional supply of an existing token |
| [`DESTROY`](./DESTROY.md) | Permanently burns token supply |
| [`CALLBACK`](./CALLBACK.md) | Force-recalls tokens from all holders back to the token owner |
| [`SLEEP`](./SLEEP.md) | Pauses all actions on a token until a specified `RESUME_BLOCK` |

### Transfers

| ACTION | Description |
|---|---|
| [`SEND`](./SEND.md) | Sends one or more tokens to one or more addresses (4 format versions) |
| [`SWEEP`](./SWEEP.md) | Transfers all token balances and/or ownerships to a destination address |
| [`AIRDROP`](./AIRDROP.md) | Distributes token supply to addresses in one or more lists |
| [`DIVIDEND`](./DIVIDEND.md) | Pays a dividend to all holders of a token |

### Decentralized Exchange (DEX)

| ACTION | Description |
|---|---|
| [`ORDER`](./ORDER.md) | Places a buy/sell order on the decentralized exchange |
| [`DISPENSER`](./DISPENSER.md) | Creates a vending machine that dispenses tokens when triggered by a send |
| [`SWAP`](./SWAP.md) | Creates a cross-chain token swap offer between supported blockchains |

### Data and Communication

| ACTION | Description |
|---|---|
| [`BROADCAST`](./BROADCAST.md) | Broadcasts a message; can also create oracles and betting feeds |
| [`MESSAGE`](./MESSAGE.md) | Sends plaintext or encrypted messages between addresses |
| [`FILE`](./FILE.md) | Uploads a file with metadata (name, MIME type, title) |

### Utility

| ACTION | Description |
|---|---|
| [`ADDRESS`](./ADDRESS.md) | Configures address-specific preferences (e.g., require memo) |
| [`BATCH`](./BATCH.md) | Executes multiple ACTION commands in a single transaction |
| [`LINK`](./LINK.md) | Links two actions by `ACTION_INDEX`, including cross-chain links |
| [`LIST`](./LIST.md) | Creates a list of items (addresses, tickers) for use in other actions |

## Specification Format

Each ACTION specification follows a consistent structure:

- **PARAMS** — Table of all parameters with name, type, and description
- **Formats** — Versioned pipe-delimited patterns showing parameter order for each format version
- **Examples** — Concrete examples with explanations

## Key Concepts

### VERSION (Format Version)

Every ACTION includes a `VERSION` parameter as its first field. This determines how the remaining parameters are interpreted. Different versions allow the same action to support different use cases (e.g., SEND version `0` is a single send, version `1` is a multi-send).

### TICK

A `TICK` is a token ticker name (1-250 characters). Tickers are case-sensitive and can contain letters, numbers, and symbols. The names `BTC`, `LTC`, `DOGE`, and `XCHAIN` are reserved by the protocol.

### ACTION_INDEX

The `ACTION_INDEX` is a sequential integer assigned to every processed action. It serves as the primary cross-reference mechanism — actions like `LINK`, `DISPENSER`, and `LIST` reference other actions by their `ACTION_INDEX`.

### MEMO

An optional text field (250 characters max) that can be attached to transfer actions. Destination addresses can require a memo via the `ADDRESS` action.

## Encoding

ACTION data is embedded in blockchain transactions as AES-128-CTR obfuscated payloads:

- **Key**: First 16 hex characters of the first input's txid
- **IV**: Next 16 hex characters of the first input's txid
- **Magic prefix**: `XCHN` (4 bytes) after deobfuscation

Supported encoding types: `OP_RETURN` (up to 76 bytes), `P2SH`, `P2WSH`, `multisign`. Larger payloads use P2SH or P2WSH with a two-transaction pattern (fund then spend to reveal data).

## Related Documentation

| Resource | Description |
|---|---|
| [Indexer Actions Reference](../../components/indexer/ACTIONS.md) | How each ACTION is validated and processed by the indexer |
| [SDK Actions Reference](../../components/sdk/ACTIONS.md) | How to generate ACTION strings using the SDK |
| [Database Naming Structure](../Database_Naming_Structure.md) | Database naming conventions for the platform |
| [Token Information Standard](../Token_Information_Standard.md) | Standard for token metadata |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
