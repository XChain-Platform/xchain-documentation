<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Indexer — ACTION Reference

## Protocol Versioning

The `ProtocolChanges` class (`src/protocol_changes.js`) controls when each ACTION becomes active. Every action is registered with:

- **Version**: Semantic version of the indexer that introduced it (e.g., `1.0.0`)
- **Activation timestamps**: Per-network Unix timestamps (mainnet, testnet, regtest)
- **Activation blocks**: Per-network block heights (mainnet, testnet, regtest)

An action is only processed if:
1. The current indexer version is >= the action's registered version
2. The current block time is >= the action's activation timestamp for the active network
3. The current block height is >= the action's activation block for the active network

The original 22 actions are registered at version `1.0.0` with activation at block 0 / time 0 (active from genesis). The 9 new user-broadcast actions (Hub Staking and Virtual Machine) are registered at a later version with non-zero activation blocks and timestamps. Future protocol upgrades can introduce new actions or changes at specific block heights by registering them with non-zero activation values.

## Token Lifecycle Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**ISSUE**](../../protocol/actions/ISSUE.md) | Create a new token or update an existing one | Unique ticker, valid character set, fee payment, ownership check for updates |
| [**MINT**](../../protocol/actions/MINT.md) | Create additional supply of an existing token | Token exists, minting allowed, supply limits, mint address limits |
| [**DESTROY**](../../protocol/actions/DESTROY.md) | Permanently burn token supply | Token exists, sender has sufficient balance |
| [**CALLBACK**](../../protocol/actions/CALLBACK.md) | Force-recall tokens from all holders | Token exists, callback enabled, sender is token owner |
| [**SLEEP**](../../protocol/actions/SLEEP.md) | Pause all actions on a token until a future block | Token exists, sender is token owner, valid resume block |

## Transfer Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**SEND**](../../protocol/actions/SEND.md) | Transfer tokens to one or more addresses | Token exists, sufficient balance, valid destination, memo rules, allow/block lists |
| [**SWEEP**](../../protocol/actions/SWEEP.md) | Transfer all balances and/or ownerships to a destination | Valid destination, not sweeping to self |
| [**AIRDROP**](../../protocol/actions/AIRDROP.md) | Distribute tokens to addresses in one or more LISTs | Token exists, sufficient balance, valid list references |
| [**DIVIDEND**](../../protocol/actions/DIVIDEND.md) | Pay dividends to all holders of a token | Token exists, sufficient balance of dividend token |

## DEX Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**ORDER**](../../protocol/actions/ORDER.md) | Place a buy/sell order on the decentralized exchange | Valid give/get tokens, sufficient balance, valid amounts, fee payment. Supports native coin pairs (empty TICK = native coin) |
| **ORDER_MATCH** | Automatic: matches compatible orders | Price compatibility, available balances, escrow handling. Native coin matches create COINPay obligations |
| **ORDER_EXPIRE** | Automatic: expires orders past their expiration time | Block time check, escrow release. Two-phase if pending COINPay obligations |
| [**COINPAY**](../../protocol/actions/COINPAY.md) | Fulfills a native coin payment obligation from an ORDER_MATCH | Obligation exists, not expired, payment output matches payee address and amount |
| **COINPAY_EXPIRE** | Automatic: expires unfulfilled COINPay obligations | Block time >= obligation expiration, releases escrowed tokens, cancels coin-offering order |
| [**DISPENSER**](../../protocol/actions/DISPENSER.md) | Create a token vending machine triggered by sends | Valid token, sufficient balance, valid give/get amounts |
| **DISPENSE** | Automatic: triggered when a send matches a dispenser | Dispenser active, sufficient remaining supply |
| **DISPENSER_CLOSE** | Automatic: closes a dispenser | Close delay timer, escrow release |
| **DISPENSER_EXPIRE** | Automatic: expires a dispenser | Expiration time check, escrow release |

## Cross-Chain Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**SWAP**](../../protocol/actions/SWAP.md) | Create a cross-chain token swap offer | Valid tokens on both chains, sufficient balance, fee payment |
| **SWAP_MATCH** | Automatic: matches compatible swap offers | Cross-chain verification, escrow handling |
| **SWAP_EXPIRE** | Automatic: expires swaps past their expiration time | Block time check, escrow release |

## Data and Communication Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**BROADCAST**](../../protocol/actions/BROADCAST.md) | Publish a message or create an oracle/betting feed | Valid message length, valid value format |
| [**MESSAGE**](../../protocol/actions/MESSAGE.md) | Send plaintext or encrypted messages between addresses | Valid encryption method, message length limits |
| [**FILE**](../../protocol/actions/FILE.md) | Upload a file with metadata | Valid file name, MIME type, title lengths |

## Utility Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**ADDRESS**](../../protocol/actions/ADDRESS.md) | Set address preferences (require memo, etc.) | Valid address |
| [**BATCH**](../../protocol/actions/BATCH.md) | Execute multiple actions in a single transaction | Each sub-action validated independently |
| [**LINK**](../../protocol/actions/LINK.md) | Link two action_indexes (e.g., FILE to ISSUE) | Both action_indexes exist, valid link type |
| [**LIST**](../../protocol/actions/LIST.md) | Create or update a list of addresses/items | Valid list format |

## Hub Staking Actions

Hub Staking actions are **BTC-only**. They allow addresses to stake XCHAIN tokens with the hub, delegate stake to validators, and claim accumulated rewards. All staking actions are subject to a **6-block activation/deactivation delay** for BTC reorg safety — see the action specifications for details.

| Action | Purpose | Key Validations |
|---|---|---|
| **STAKE** | Lock XCHAIN tokens as stake with the hub at tier 1, 2, or 3 | Tier valid (1/2/3), CHAINS rules per tier, DOGE_ADDRESS required for Tier 3, signing pubkey unique, sufficient balance |
| **UNSTAKE** | Release staked XCHAIN tokens back to sender | Active stake exists at the specified tier (gated by activation delay) |
| **DELEGATE** | Rotate the signing key for a staked validator | Active stake exists, new pubkey valid and unused. Takes effect after 6 blocks. |
| **REVOKE_DELEGATION** | Remove a delegated signing key | Active delegation exists. Takes effect after 6 blocks. |
| **CLAIM_REWARDS** | Collect accumulated staking rewards | Active stake exists, unclaimed rewards > 0. Rewards are pushed from `xchain-hub` via `pushvalidatorrewards`. |

### Tier 3 (Oracle Publisher)

Tier 3 is a publisher role for broadcasting finalized PRICE v0 transactions to the DOGE chain (or another supported chain). Validators stake 500 XCHAIN and provide a `DOGE_ADDRESS` for transaction broadcasting. Tier 3 can overlap with Tier 1 — the same address can hold both.

## Oracle Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**PRICE**](../../protocol/actions/PRICE.md) v0 | Validator COIN/FIAT price snapshot (PBFT-signed) | All pubkeys are active Tier 1 validators, Ed25519 signatures verify against canonical payload, `SIG_COUNT >= 2*floor((tier1_count-1)/3)+1` |
| [**PRICE**](../../protocol/actions/PRICE.md) v1 | User TOKEN/FIAT oracle price | Valid COIN/TICK/FIAT/VALUE format. No staking requirement — any address may publish. 24-hour lock window for subsequent updates per `(SOURCE, COIN, TICK, FIAT)` combination. |

After validation, the indexer writes to its local `prices` table and pushes to `xchain-hub` for cross-chain aggregation into `price_snapshots` (v0) or `oracle_prices` (v1).

## Virtual Machine Actions

Virtual Machine actions are available on **all chains** (BTC, LTC, DOGE). DEPLOY and EXECUTE charge gas via the unified gas schedule. DEPOSIT and WITHDRAW move tokens into and out of contracts and have **no gas fee**.

| Action | Purpose | Key Validations | Gas Fee |
|---|---|---|---|
| [**DEPLOY**](../../protocol/actions/DEPLOY.md) | Deploy a JavaScript smart contract to the VM | Syntax validation (V8 + acorn ES2020 + `__gas` check), code size ≤ 64KB, sufficient XCHAIN for gas. Creates derived address `C:<CHAIN>:<action_index>`. Optionally runs constructor. | Yes — `VM_DEPLOY_BASE + (bytes * VM_DEPLOY_PER_BYTE)` + constructor gas |
| [**EXECUTE**](../../protocol/actions/EXECUTE.md) | Call a method on a deployed contract in a sandboxed V8 isolate | Contract exists and is active, method exists, sufficient XCHAIN for gas. VM runs contract code, processes state changes and up to 50 emitted actions atomically via savepoint. | Yes — actual metered gas consumed |
| [**DEPOSIT**](../../protocol/actions/DEPOSIT.md) | Transfer tokens to a contract's derived address | Contract exists and is active, sender has sufficient balance. Credits `C:<CHAIN>:<action_index>` in standard ledger. | No |
| [**WITHDRAW**](../../protocol/actions/WITHDRAW.md) | Withdraw tokens from a contract's derived address to owner | Contract exists, sender is contract owner, derived address has sufficient balance | No |

## SEND Format Versions

The SEND action supports multiple format versions for different use cases:

| Format | Name | Pattern | Use Case |
|---|---|---|---|
| `0` | Single Send | `VERSION\|TICK\|AMOUNT\|DESTINATION\|MEMO` | Send one token to one address |
| `1` | Multi-Send (Brief) | `VERSION\|TICK\|AMOUNT\|DEST\|AMOUNT\|DEST\|MEMO` | Send same token to multiple addresses |
| `2` | Multi-Send (Full) | `VERSION\|TICK\|AMOUNT\|DEST\|TICK\|AMOUNT\|DEST\|MEMO` | Send different tokens to multiple addresses |
| `3` | Multi-Send + Memos | `VERSION\|TICK\|AMOUNT\|DEST\|MEMO\|TICK\|AMOUNT\|DEST\|MEMO` | Different tokens, different memos per send |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
