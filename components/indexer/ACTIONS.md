<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Indexer: ACTION Reference

## Protocol Versioning

The `ProtocolChanges` class (`src/protocol_changes.js`) controls when each ACTION becomes active. Every action is registered with:

- **Version**: Semantic version of the indexer that introduced it (e.g., `1.0.0`)
- **Activation timestamps**: Per-network Unix timestamps (mainnet, testnet, regtest)
- **Activation blocks**: Per-network block heights (mainnet, testnet, regtest)

An action is only processed if:
1. The current indexer version is >= the action's registered version
2. The current block time is >= the action's activation timestamp for the active network
3. The current block height is >= the action's activation block for the active network

The original 22 actions are registered at version `1.0.0` with activation at block 0 / time 0 (active from genesis). The later actions (Hub Staking, Virtual Machine, Oracles, Attestation, and Validator categories) are registered at higher versions with non-zero activation blocks and timestamps. Future protocol upgrades can introduce new actions or changes at specific block heights by registering them with non-zero activation values.

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
| **CROSS_SETTLE** | System-injected: settles this chain's leg of a hub-matched cross-chain trade (covers both SWAP and ORDER legs). There is no on-chain transaction; the indexer injects one per unsettled match from the hub-mirrored `cross_chain_matches` table, verifies 2f+1 `cross_chain` validator signatures, and releases the local escrow to the counterparty's payout address. Recorded in `cross_chain_settlements` for idempotency and rollback. Not registered in `protocol_changes.js` (never decoded from a transaction); dispatched from `utility.js processCrossChainSettlements` at each block. | Network scope matches this indexer's network; quorum signatures verify against the locked capability snapshot at `snapshot_block`; local offer must still be open |

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

## Staking Actions

Two staking systems share the same four action names. **Capability staking** (STAKE v1/v2, UNSTAKE v0, DELEGATE v0/v2, COLLECT) is **BTC-only**; it secures the platform validator set. **Contract-targeted staking** (STAKE v3, UNSTAKE v1, DELEGATE v1/v3) **works on any chain** (BTC, LTC, DOGE), it's a developer primitive used by stakeable smart contracts. Capability-staking actions are BTC-only and use a **6-block activation/deactivation delay**; contract-targeted staking actions use a **per-chain delay** calibrated for ~60 minutes of reorg protection (6 blocks on BTC, 24 on LTC, 60 on DOGE), measured in blocks of the broadcasting chain. See the action specifications for details.

| Action | Purpose | Key Validations |
|---|---|---|
| **STAKE** | Lock tokens against a signing pubkey. v1 = new capability stake (XCHAIN), v2 = top-up of existing capability stake (XCHAIN), v3 = contract-targeted stake (any token, targets a stakeable contract: see DEPLOY v1) | VERSION valid (1/2/3), AMOUNT positive, SIGNING_PUBKEY is 64-char hex Ed25519. v1/v2: aggregate per-pubkey active stake auto-qualifies the pubkey for each of four capabilities (`price`, `cross_chain`, `oracle_publish`, `attestation`) based on governance `min_stake[capability]`. v3: target contract must be stakeable; row keyed by `(target, pubkey, tick, source)`. |
| **UNSTAKE** | Release staked tokens. v0 = full-pubkey capability unstake. v1 = release a single contract-targeted row keyed by `(target, pubkey, tick)`. | Pubkey has active stake of matching type; sets `deactivation_block`. v1 cooldown is per-contract (set at DEPLOY v1 time); v0 uses the global `STAKING.COOLDOWN_BLOCKS`. |
| **DELEGATE** | Manage the signing key for a stake. v0 = capability rotate, v1 = contract rotate, v2 = capability revoke, v3 = contract revoke. | Active stake/delegation of matching type exists. For rotates, new pubkey valid and unused. Takes effect after the activation delay: 6 blocks for capability rotate/revoke (v0/v2); the per-chain delay (6 blocks on BTC, 24 on LTC, 60 on DOGE) for contract rotate/revoke (v1/v3). |
| **COLLECT** | Collect accumulated rewards | Address has unclaimed rewards > 0. `oracle_round` / `oracle_base` / `oracle_full_node` and `attest_fee` rewards are derived by the indexer during block processing; `anchor_<chain>` and `anchor_archive` rewards are pushed from `xchain-hub` via `pushvalidatorrewards`. |

### `oracle_publish` capability (formerly "Tier 3")

The publisher role for broadcasting finalized PRICE v0 transactions to a chain (DOGE recommended for low fees). Auto-qualifies when a pubkey's aggregate active stake ≥ `min_stake[oracle_publish]`. A pubkey may hold the `oracle_publish` and `price` capabilities simultaneously (and earn both rewards in the same round).

## Oracle Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**PRICE**](../../protocol/actions/PRICE.md) v0 | Validator COIN/FIAT price snapshot (PBFT-signed) | All pubkeys qualify for the `price` capability at the PRICE tx's `block_index`; Ed25519 signatures verify against canonical payload; `SIG_COUNT >= 2*floor((price_capable_count-1)/3)+1` |
| [**PRICE**](../../protocol/actions/PRICE.md) v1 | User TOKEN/FIAT oracle price | Valid COIN/TICK/FIAT/VALUE format. **Permissionless**; any address may publish, no staking requirement. 24-hour lock window for subsequent updates per `(SOURCE, COIN, TICK, FIAT)` combination. |

After validation, the indexer writes to its local `prices` table and pushes to `xchain-hub` for cross-chain aggregation into `price_snapshots` (v0) or `oracle_prices` (v1).

## Virtual Machine Actions

Virtual Machine actions are available on **all chains** (BTC, LTC, DOGE). DEPLOY and EXECUTE charge gas via the unified gas schedule. DEPOSIT and WITHDRAW move tokens into and out of contracts and have **no gas fee**.

| Action | Purpose | Key Validations | Gas Fee |
|---|---|---|---|
| [**DEPLOY**](../../protocol/actions/DEPLOY.md) | Deploy a JavaScript smart contract to the VM. v0 = standard. v1 = stakeable (adds `COOLDOWN_BLOCKS` + `SLASH_DESTINATION` so the contract can accept STAKE v3 actions). | Syntax validation (V8 + acorn ES2020 + `__gas` check), code size ≤ 64KB, sufficient XCHAIN for gas. Creates derived address `C:<CHAIN>:<action_index>`. Optionally runs constructor. v1 staking fields immutable after deploy; `SLASH_DESTINATION` without `COOLDOWN_BLOCKS` is rejected; `BURN` sentinel resolves to chain burn address. | Yes: `VM_DEPLOY_BASE + (bytes * VM_DEPLOY_PER_BYTE)` + constructor gas |
| [**EXECUTE**](../../protocol/actions/EXECUTE.md) | Call a method on a deployed contract in a sandboxed V8 isolate | Contract exists and is active, method exists, sufficient XCHAIN for gas. VM runs contract code, processes state changes and up to 50 emitted actions atomically via savepoint. | Yes: actual metered gas consumed |
| [**DEPOSIT**](../../protocol/actions/DEPOSIT.md) | Transfer tokens to a contract's derived address | Contract exists and is active, sender has sufficient balance. Credits `C:<CHAIN>:<action_index>` in standard ledger. | No |
| [**WITHDRAW**](../../protocol/actions/WITHDRAW.md) | Withdraw tokens from a contract's derived address to owner | Contract exists, sender is contract owner, derived address has sufficient balance | No |

## State & Recovery Actions

| Action | Purpose | Key Validations |
|---|---|---|
| [**ANCHOR**](../../protocol/actions/ANCHOR.md) | Commit quorum-signed state checkpoints and a compressed archive of cross-chain match rows on-chain. DOGE-only, validator-broadcast action. | Valid only on the DOGE chain (all networks). No protocol fee. On parse, the indexer writes to `anchor_actions` and records checkpoint hashes. The archived data makes all platform state recoverable from a full chain re-parse. See `src/actions/anchor.js` and `protocol/actions/ANCHOR.md`. |

---

## SEND Format Versions

The SEND action supports multiple format versions for different use cases:

| Format | Name | Pattern | Use Case |
|---|---|---|---|
| `0` | Single Send | `VERSION\|TICK\|AMOUNT\|DESTINATION\|MEMO` | Send one token to one address |
| `1` | Multi-Send (Brief) | `VERSION\|TICK\|AMOUNT\|DEST\|AMOUNT\|DEST\|MEMO` | Send same token to multiple addresses |
| `2` | Multi-Send (Full) | `VERSION\|TICK\|AMOUNT\|DEST\|TICK\|AMOUNT\|DEST\|MEMO` | Send different tokens to multiple addresses |
| `3` | Multi-Send + Memos | `VERSION\|TICK\|AMOUNT\|DEST\|MEMO\|TICK\|AMOUNT\|DEST\|MEMO` | Different tokens, different memos per send |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
