<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform: ACTION Command Specifications

This directory contains the official protocol specifications for all ACTION commands supported by the XChain Platform. These specifications are the authoritative reference for how each action is structured, what parameters it accepts, and what format versions are available.

## What are ACTIONs?

ACTIONs are the fundamental operations of the XChain Protocol. Every state change on the platform: creating a token, transferring balances, placing a DEX order, uploading a file, is expressed as an ACTION embedded in a blockchain transaction.

ACTION data is encoded as a pipe-delimited string:

```
ACTION|VERSION|PARAM1|PARAM2|...
```

Multiple actions can be combined in a single transaction using the `BATCH` action, with individual commands separated by semicolons (`;`).

## Supported Blockchains

XChain ACTIONs are supported on:

- **Bitcoin** (BTC): mainnet, testnet, regtest
- **Litecoin** (LTC): mainnet, testnet, regtest
- **Dogecoin** (DOGE): mainnet, testnet, regtest

The same ACTION specifications apply across all chains. Chain-specific behavior (fee amounts, special addresses) is handled by the indexer's per-chain configuration.

## ACTION Command Reference

### Token Lifecycle

| ACTION | Description |
|---|---|
| [`ISSUE`](./issue.md) | Creates or updates a token (`TICK`) with supply, decimals, locks, and minting rules |
| [`MINT`](./mint.md) | Mints additional supply of an existing token |
| [`DESTROY`](./destroy.md) | Permanently burns token supply |
| [`CALLBACK`](./callback.md) | Force-recalls tokens from all holders back to the token owner |
| [`SLEEP`](./sleep.md) | Pauses all actions on a token until a specified `RESUME_BLOCK` |

### Transfers

| ACTION | Description |
|---|---|
| [`SEND`](./send.md) | Sends one or more tokens to one or more addresses (4 format versions) |
| [`SWEEP`](./sweep.md) | Transfers all token balances and/or ownerships to a destination address |
| [`AIRDROP`](./airdrop.md) | Distributes token supply to addresses in one or more lists |
| [`DIVIDEND`](./dividend.md) | Pays a dividend to all holders of a token |

### Decentralized Exchange (DEX)

| ACTION | Description |
|---|---|
| [`ORDER`](./order.md) | Places a buy/sell order on the decentralized exchange |
| [`COINPAY`](./coinpay.md) | Fulfills a native coin payment obligation from an ORDER_MATCH |
| [`DISPENSER`](./dispenser.md) | Creates a vending machine that dispenses tokens when triggered by a send |
| [`SWAP`](./swap.md) | Creates a cross-chain token swap offer between supported blockchains |

### Data and Communication

| ACTION | Description |
|---|---|
| [`BROADCAST`](./broadcast.md) | Broadcasts a message; can also create oracles and data feeds |
| [`MESSAGE`](./message.md) | Sends plaintext or encrypted messages between addresses |
| [`FILE`](./file.md) | Uploads a file with metadata (name, MIME type, title) |

### Oracles

| ACTION | Description |
|---|---|
| [`PRICE`](./price.md) | Publishes oracle price data on-chain (v0: validator COIN/FIAT snapshots, v1: user TOKEN/FIAT oracles) |
| [`ATTEST`](./attest.md) | External-data attestation lifecycle: v0=request (VM-emitted), v1=response (validator-broadcast), v2=expire (system-synthesized) |
| [`ANCHOR`](./anchor.md) | Validator-broadcast, DOGE-only: quorum-signed state checkpoints (v0/v3, v3 adding SPV light-client roots), the cross-chain match archive (v1/v2), publisher-attested anchors (v4/v5), and v6 (the archive-leg counterpart to v1, with publisher attestation appended) for full-parse recoverability |

### Betting

| ACTION | Description |
|---|---|
| [`BET`](./bet.md) | Parimutuel betting markets end to end: v0=create market, v1=cancel, v2=place bet, v3=resolve |

### Governance

| ACTION | Description |
|---|---|
| [`VOTE`](./vote.md) | Token-weighted governance polls: v0=create poll, v1=cast ballot, v2=finalize (system-injected), v3=set/clear delegation |

### Staking (capability staking BTC-only; contract-targeted staking any chain)

| ACTION | Description |
|---|---|
| [`STAKE`](./stake.md) | Stakes tokens for validator participation (v1=new capability stake, v2=top-up, v3=contract-targeted) |
| [`UNSTAKE`](./unstake.md) | Begins the unstaking cooldown period (v0=capability, v1=contract-targeted) |
| [`DELEGATE`](./delegate.md) | Manages the signing key for a stake (v0/v1 rotate, v2/v3 revoke; capability or contract-targeted) |
| [`COLLECT`](./collect.md) | Collects accrued validator rewards |

### Validator / Consensus

| ACTION | Description |
|---|---|
| [`NODEPROOF`](./nodeproof.md) | Quorum-signed verdict recording which validators passed a periodic coin full-node possession challenge, proving they run real nodes rather than mirroring replicas |
| [`SLASH`](./slash.md) | Permissionless equivocation proof: burns a capability validator's entire bond when they signed two conflicting values for the same consensus slot |

### Virtual Machine (VM)

| ACTION | Description |
|---|---|
| [`DEPLOY`](./deploy.md) | Deploys a smart contract to the XChain VM (v0/v1 inline; v2/v3 assemble from v4 carriers; v4 carries one base64 code slice for a large-contract deploy) |
| [`EXECUTE`](./execute.md) | Executes a method on a deployed smart contract |
| [`DEPOSIT`](./deposit.md) | Transfers tokens from a user to a contract's custody |
| [`WITHDRAW`](./withdraw.md) | Withdraws tokens from a contract's custody back to the owner |
| [`XCALL`](./xcall.md) | Cross-chain contract call request: v0 = VM-emitted request (`xchain.emit.crossExecute`), v2 = system-synthesized deadline expiry |
| `XEXEC` | System-injected target-side execution of an XCALL dispatch row; internal only, no user-broadcast form: see [XCALL.md](./xcall.md) |

### Utility

| ACTION | Description |
|---|---|
| [`ADDRESS`](./address.md) | Configures address-specific preferences (e.g., require memo) |
| [`BATCH`](./batch.md) | Executes multiple ACTION commands in a single transaction |
| [`LINK`](./link.md) | Links two actions by `ACTION_INDEX`, including cross-chain links |
| [`LIST`](./list.md) | Creates a list of items (addresses, tickers) for use in other actions |

## Specification Format

Each ACTION specification follows a consistent structure:

- **PARAMS**: Table of all parameters with name, type, and description
- **Formats**: Versioned pipe-delimited patterns showing parameter order for each format version
- **Examples**: Concrete examples with explanations

### Format notation

A format line lists the fields of one version in wire order, separated by `|`. Three markers appear in those lines and nothing else does:

| Marker | Meaning | Example |
|---|---|---|
| `...FIELD` | Rest field: `FIELD` is the last field and absorbs every remaining segment, so the action carries any number of them | `VERSION\|TYPE\|...ITEM` (LIST) |
| `...` on its own | The preceding group repeats, as many times as a count field earlier in the format says | `SIG_COUNT\|PUBKEY1\|SIG1\|...` (ATTEST v1) |
| `[\|FIELD]` | The bracketed tail is optional and may be omitted entirely | `VERSION[\|AMOUNT]` (COLLECT) |

The rest-field marker is written as a **prefix** (`...ITEM`), never a suffix, matching the SDK's format table in `formats.js`, where a leading `...` is what marks a field as variadic. Trailing fields that are not bracketed are still omittable when the action's rules say so, so a shorter example is not necessarily a defect; a longer one always is. The conformance suite enforces this: an example may never carry more fields than its version's format declares unless that format ends in a rest field or repeat marker.

## Key Concepts

### VERSION (Format Version)

Every ACTION includes a `VERSION` parameter as its first field. This determines how the remaining parameters are interpreted. Different versions allow the same action to support different use cases (e.g., SEND version `0` is a single send, version `1` is a multi-send).

### TICK

A `TICK` is a token ticker name (1-250 characters). Tickers are case-sensitive and can contain letters, numbers, and symbols. The names `BTC`, `LTC`, `DOGE`, and `XCHAIN` are reserved by the protocol.

### ACTION_INDEX

The `ACTION_INDEX` is a sequential integer assigned to every processed action. It serves as the primary cross-reference mechanism, actions like `LINK`, `DISPENSER`, and `LIST` reference other actions by their `ACTION_INDEX`.

### MEMO

An optional text field (250 characters max) that can be attached to transfer actions. Destination addresses can require a memo via the `ADDRESS` action.

## Encoding

ACTION data is embedded in blockchain transactions as AES-128-CTR obfuscated payloads:

- **Key**: First 16 hex characters of the first input's txid
- **IV**: Next 16 hex characters of the first input's txid
- **Magic prefix**: `XCHN` (4 bytes) after deobfuscation

Supported encoding types: `OP_RETURN` (up to 80 bytes total per output, 76 bytes user data + 4-byte XCHN prefix), `P2SH`, `P2WSH`, `multisign`. Larger payloads use P2SH or P2WSH with a two-transaction pattern (fund then spend to reveal data).

## Related Documentation

| Resource | Description |
|---|---|
| [Indexer Actions Reference](../../components/indexer/actions.md) | How each ACTION is validated and processed by the indexer |
| [SDK Actions Reference](../../components/sdk/actions.md) | How to generate ACTION strings using the SDK |
| [Database Naming Structure](../database-naming-structure.md) | Database naming conventions for the platform |
| [Token Information Standard](../token-information-standard.md) | Standard for token metadata |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
