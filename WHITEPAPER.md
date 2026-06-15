<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform White Paper

### A Chain-Agnostic Token, Exchange, and Smart-Contract Metalayer

**Authors:** Jeremy Johnson & Javier Varona Zavatti, Co-Founders — Dankest, LLC · **Version 1.0**

> Some economic parameters in this paper (the gas schedule and `GAS_PRICE`) are consensus-critical and are finalized at protocol freeze ahead of launch; the values shown convey the model and current defaults. Features noted as *pending mainnet activation* are specified and implemented but not yet enabled on mainnet.

---

## Abstract

XChain is a token-and-settlement **metalayer** for UTXO blockchains. It embeds a complete digital-asset protocol — tokens, a native decentralized exchange, trustless cross-chain swaps, on-chain data and messaging, and a deterministic smart-contract virtual machine — inside ordinary transactions on an unmodified base chain, so that every asset and every state transition is secured directly by the host chain's existing proof-of-work consensus. There are no sidechains, no bridges, and no new consensus layer to trust.

The protocol is chain-agnostic by construction. It runs today, in production, on **Bitcoin, Litecoin, and Dogecoin**; adding any further UTXO chain is a configuration change rather than a protocol change, and the platform is designed to extend toward a broad set of blockchains over time. The same protocol, the same thirty ACTIONs, and the same tooling operate identically across every supported chain.

XChain advances the metalayer approach on three fronts. First, a **smart-contract VM** that runs on Bitcoin-class chains by *orchestrating* the protocol's validated actions rather than mutating ledger state directly — giving general-purpose programmability while keeping a small, fixed, auditable state-transition surface. Second, an **attestation framework** that lets contracts ask the outside world a question — an HTTPS fetch, or a prompt to an approved AI model — and receive a validator-verified answer back on-chain, deterministically. Third, **native multi-chain operation** with trustless cross-chain swaps coordinated by a Byzantine-fault-tolerant validator network that never takes custody.

This paper specifies the protocol in full: the encoding and wire format, the double-entry ledger and state model, the complete ACTION set, the virtual machine and its gas-metering and determinism guarantees, the attestation framework, the cross-chain settlement mechanism, the validator network and its consensus, the staking systems, the security model, and the economics.

---

## 1. Introduction

### 1.1 What XChain is

A blockchain like Bitcoin maintains one thing extremely well: a decentralized, tamper-proof, proof-of-work-secured ledger of transactions. It does not natively provide tokens, an exchange, programmable contracts, or structured data. The dominant industry response has been to move value *off* the most secure chains — onto sidechains, bridges, and separate Layer-1s with their own validator sets and their own trust assumptions. That migration is also where the largest losses occur; cross-chain bridges remain among the most exploited constructs in the entire ecosystem.

XChain takes the opposite path. It is a **metalayer**: a protocol layered *above* an unmodified base blockchain that uses the base chain purely as a data-availability and ordering substrate. Protocol commands are encoded into the data of ordinary transactions. Software running the XChain protocol reads those transactions, applies a fixed set of deterministic rules, and derives its own state — token balances, order books, contract storage. The base chain is never modified, never forked, and never asked to understand the protocol. An XChain token on Bitcoin literally exists inside a Bitcoin transaction and is secured by exactly the consensus that secures every other Bitcoin transaction.

### 1.2 Design principles

Three commitments run through every layer of the system.

**Inherited security.** XChain introduces no new chain, no new consensus for transaction ordering, and no bridge. Finality, ordering, and double-spend resistance come entirely from the host chain. The validator network described in §10 exists only for configuration, price data, cross-chain coordination, and attestation — never for ordering or settling token state.

**Determinism.** Every node that processes the same base-chain data computes byte-identical state. There is no randomness, no wall-clock-dependent branching, and no un-replayable external input anywhere in state processing. This is the property that makes the system independently verifiable: anyone can run the software, replay the chain from genesis, and confirm every balance for themselves.

**Constraint over generality.** Every state change — including every change produced by a smart contract — flows through one fixed, audited set of ACTION handlers. The protocol's state-transition surface is finite and known. This is a deliberate trade: XChain is not a general-purpose world computer, and in exchange it offers a small attack surface and uniform, auditable state.

### 1.3 Scope and non-goals

XChain is a token-and-settlement layer. Its exclusions are deliberate design choices, each preserving a core guarantee:

- **No confidentiality.** All state is public. The obfuscation applied to payloads (§4.2) is not encryption — its key derives from public transaction data. Public, replayable state is what makes independent verification possible.
- **Block-speed, not real-time.** Confirmation, order matching, and cross-chain settlement proceed at the cadence of blocks. There are no payment channels or rollups; the protocol is unsuited to point-of-sale or high-frequency trading.
- **Not an EVM-style world computer.** Contracts orchestrate validated ACTIONs and cannot mutate the ledger directly. A contract *can* invoke another contract — asynchronously, by emitting an `EXECUTE` (including cross-chain via `XCALL`) — but there is no synchronous call-and-return, contracts cannot deploy other contracts, and a contract cannot observe its own emissions mid-execution (§7).
- **UTXO chains.** XChain runs on Bitcoin-compatible (UTXO) chains. Interoperation with account-model ecosystems (Ethereum, Solana) is a longer-term research direction (§16), not a current capability; there are no wrapped external assets.

Honest current boundaries: full trustless verification requires running a node (there is no light-client/SPV protocol yet); a token's security tracks its host chain's security (use higher confirmation thresholds on lower-hashpower chains); the token model is fungible at the primitive level, with NFTs supported as a first-class standard composed from those primitives (1-of-1s, editions, collections, on-chain attachments) rather than a separate token type; and rich token metadata lives off-chain by reference (§5.3).

---

## 2. The Metalayer Model

### 2.1 Embedding a protocol in transactions

Each XChain operation is expressed as a compact, pipe-delimited **ACTION string** (e.g. `ISSUE|0|MYTOKEN|1000000|…`). Before broadcast, the string is lightly obfuscated and embedded in a standard transaction using one of four encoding formats chosen automatically by payload size (§4). To the base chain these are ordinary transactions; to XChain software they are protocol commands.

A node running the protocol observes each new block, extracts and de-obfuscates any embedded ACTION strings, validates them against the protocol rules, and applies their effects to its derived state. Because the inputs (the block data) and the rules (the protocol) are both fixed and public, the derived state is reproducible by anyone.

### 2.2 Chain-agnostic by construction

Nothing in the metalayer technique is specific to Bitcoin. Any chain whose transactions can carry arbitrary data and whose history is ordered and reorg-bounded can host the protocol. XChain is therefore **chain-agnostic**: Bitcoin, Litecoin, and Dogecoin are the first three supported chains, not the definition of the platform.

In the current UTXO-based implementation, **adding a new chain is a configuration operation, not a code change** — a new chain descriptor wires the existing decoder, indexer, encoder, and tracker to a new coin node. The supported set is expected to grow across the UTXO family over time; account-model chains are addressed as a roadmap item in §16. Each chain maintains an entirely independent ledger (§9.1); a ticker on one chain is a distinct asset from the same ticker on another.

---

## 3. System Architecture

### 3.1 Components

XChain is a pipeline of independent services, each runnable separately and most instantiated once per chain/network combination. Relational state uses MariaDB (raw parameterized SQL, no ORM); UTXO indexing uses LevelDB.

| Service | Role | Store |
|---|---|---|
| **utxo-tracker** | Indexes every transaction output from a coin node; serves address balances and spendable UTXOs | LevelDB |
| **encoder** | Stateless; turns an ACTION string + UTXOs + pubkey into an unsigned PSBT | — |
| **decoder** | Polls a coin node, extracts and de-obfuscates XChain transactions from blocks, writes raw decoded data | MariaDB (decoder DB) |
| **indexer** | Reads the decoder DB, validates and applies ACTION logic, runs the VM, maintains the ledger | MariaDB (indexer DB) |
| **explorer** | Stateless REST + JSON-RPC + WebSocket + web UI over the indexer DB | — |
| **hub** | Decentralized config oracle, price oracle, cross-chain coordinator, attestation engine, governance | MariaDB (hub DB) |
| **sync** | Replicates decoder + indexer DBs to validators via REST snapshots + WebSocket streaming | — |
| **node** | Docker-based installer/manager for the whole stack | — |
| **vm** | The contract engine; a library embedded inside the indexer | — |
| **sdk / wallet / regtest-miner / e2e-test** | Developer SDK, reference client, regtest automation, integration tests | — |

The hub runs as a single shared instance across all chains; the core pipeline services run per chain/network.

### 3.2 The data pipeline

```
Coin node ──JSON-RPC──> utxo-tracker (LevelDB: balances/UTXOs)
                              │
   developer ─ SDK ───────────┤
                              ▼
                          encoder ──> unsigned PSBT ── sign ── broadcast ──> Coin node
                                                                                  │
                                                                          (block mined)
                                                                                  ▼
                                                          decoder ──> decoder DB (raw decoded ACTIONs)
                                                                                  ▼
                                                          indexer ──> indexer DB (validated state, ledger, VM)
                                                                                  ▼
                                                          explorer ──> HTML / REST / JSON-RPC / WS
                                                                                  ▲
                                                          hub ── config / prices / cross-chain / attestation
```

The pipeline is strictly unidirectional: raw data enters at the decoder, is promoted to validated state by the indexer, and is served read-only by the explorer.

### 3.3 The decoder/indexer split

The separation of *extraction* (decoder) from *interpretation* (indexer) is deliberate and yields three properties the protocol depends on:

- **Replay.** The indexer DB is a pure function of the decoder DB. Destroy it and re-run the indexer against the same decoder DB and you obtain bit-for-bit identical state.
- **Independent verification.** Multiple indexers reading the same decoder DB converge to identical state, including identical per-block integrity hashes (§5.5).
- **Auditability.** Any balance traces through ledger entries to an exact block and action; the decoder DB itself is reproducible from the raw chain, so the entire indexer state is ultimately derivable from the blockchain alone.

---

## 4. Encoding and the Wire Format

### 4.1 ACTION string format and versioning

Every operation is a pipe-delimited string whose first field is the ACTION name and second field is an integer `VERSION`:

```
ACTION|VERSION|PARAM1|PARAM2|…
```

`VERSION` determines how the remaining fields are parsed, so a single ACTION name can serve multiple shapes over time. New versions add capability without invalidating old encodings. Multiple commands can be combined in one transaction with the `BATCH` action, which separates sub-commands by semicolons.

Tickers (`TICK`) are 1–250 characters and case-sensitive; `BTC`, `LTC`, `DOGE`, and `XCHAIN` are reserved. Memos are limited to 250 characters and may not contain `|` or `;`. After protocol freeze, any change to an ACTION's field layout for a given VERSION requires a new VERSION.

### 4.2 The obfuscation layer

Before embedding, the protocol prepends a 4-byte magic prefix `XCHN` to the ACTION string and applies **AES-128-CTR**, with key material derived from the spending transaction's first input txid (the leading hex of the txid forms the key, the following hex forms the IV). Because that txid is fully public once the transaction is broadcast, this is **obfuscation, not encryption**: anyone who knows the algorithm can reverse it. Its purpose is to prevent naive keyword scanning of the chain and accidental misinterpretation of unrelated data — not to provide confidentiality. A decoder recognizes an XChain transaction by de-obfuscating a candidate payload and checking for the `XCHN` prefix.

### 4.3 Transaction embedding formats

The encoder measures the obfuscated payload and selects the smallest format that fits. The caller may also force a format.

| Format | Max payload | Txs | Mechanism | Notes |
|---|---|---|---|---|
| **OP_RETURN** | 80 bytes total (incl. 4-byte prefix) | 1 | Data in a provably-unspendable output | No UTXO bloat; the common case |
| **Bare multisig** | ~61 bytes/key slot | 1 | Payload packed into fake pubkey slots of an `m-of-n` multisig | Single-tx flow for medium payloads; leaves a spendable (dust) output |
| **P2SH** | 476 bytes | 2 | Fund a script hash, then reveal the redeem script in the spend's scriptSig | Fund must reach mempool before the spend is valid |
| **P2WSH** | 8,192 bytes (decoder-enforced ceiling) | 2 | Fund a witness script hash, then reveal the witness script | SegWit witness discount makes this the most fee-efficient large format |

Approximate auto-selection thresholds: ≤76 bytes of user data → OP_RETURN; 77–476 → P2SH; 477–8,192 → P2WSH; larger payloads are rejected at encode time and dropped by the decoder. The decoder identifies the two-transaction formats by internal markers (`XCHNp2sh`, `XCHNp2wsh`) and reassembles the payload from the redeem/witness script.

The encoder is fully stateless and returns BIP-174 PSBTs (two PSBTs for the fund+reveal formats); it never handles private keys. Signing and broadcasting are the caller's responsibility.

### 4.4 ACTION_INDEX and replay protection

Every successfully processed action is assigned a sequential integer `ACTION_INDEX`. This is the protocol's universal cross-reference: `LINK`, `DISPENSER`, `LIST`, `ORDER` cancellation, attestation callbacks, and more all reference prior actions by index. References may only point to *lower* indices — forward references are invalid — which provides replay protection intrinsically: an ACTION exists at exactly one position in the chain and is processed exactly once. Rebroadcast is further prevented by the base chain's own double-spend rules, since each ACTION is anchored to a specific transaction.

### 4.5 The XChain URI scheme

A BIP21-style opaque URI scheme lets applications hand off pre-filled operations:

```
xchain:<COINCODE>/<action>[?param=value&…]
```

Coin codes use the canonical ticker for mainnet, a `T` prefix for testnet, and an `R` prefix for regtest (`BTC`/`TBTC`/`RBTC`, etc.). Registered actions are `send` (pre-fills a send screen with `to`, `amount`, `tick`, `memo`) and `receive`. The scheme borrows BIP21's `req-` convention: a consumer must honor any `req-`-prefixed parameter or reject the URI. Plain BIP21 URIs (`bitcoin:`, `litecoin:`, `dogecoin:`) remain supported in parallel, with `tick`/`chain` recognized as XChain extensions.

---

## 5. The Ledger and State Model

### 5.1 Double-entry ledger

XChain state is a strict double-entry ledger. No balance field is ever mutated in place; every movement is recorded as an immutable entry. There are three entry kinds — **credits** (tokens in), **debits** (tokens out), and **escrows** (tokens locked pending a non-final outcome). A balance is always *derived*, never stored authoritatively:

```
total_balance     = SUM(credits) − SUM(debits)
available_balance = total_balance − SUM(active_escrows)
```

`available_balance` is what the validation layer checks before permitting any transfer or trade. Validation and execution are atomic; there is no optimistic execution.

### 5.2 Escrow accounting

Tokens committed to an open order, a funded dispenser, or a pending swap are recorded as escrow entries, not removed from the ledger and not counted as available. This makes double-spending an escrowed balance structurally impossible. Escrow is released — as a credit to the counterparty on settlement, or back to the owner on cancellation/expiry — by ordinary ledger entries.

Native-coin trades cannot be escrowed by the indexer (the coin lives on the base chain, outside protocol custody). For these, matching creates a `coinpay_obligation`; the token side stays escrowed until a `COINPAY` transaction fulfills the obligation (releasing escrow to the buyer) or the obligation expires (releasing escrow back to the seller). See §9.3.

### 5.3 The token model

Tokens are created and updated by `ISSUE`. The principal fields:

| Field | Meaning |
|---|---|
| `TICK` | Ticker, 1–250 chars, one per chain; first valid ISSUE establishes ownership |
| `MAX_SUPPLY` | Hard cap on circulating supply (up to 10²¹ base units) |
| `DECIMALS` | Precision 0–18; immutable once any supply exists |
| `MINT_SUPPLY` / `MAX_MINT` | Units minted per `MINT`; cap on the number of mints |
| `MINT_START_BLOCK` / `MINT_STOP_BLOCK` / `MINT_ADDRESS_MAX` | Mint window and per-address mint cap (enables permissionless public mints) |
| `ALLOW_LIST` / `BLOCK_LIST` | References to `LIST` actions gating who may receive |
| `CALLBACK_BLOCK` / `CALLBACK_TICK` / `CALLBACK_AMOUNT` | Force-recall terms (see below) |
| Lock flags | One-way, irreversible locks on supply, mint, description, lists, callback, and owner-transfer |

Beyond issuance, `MINT` adds supply within the rules, `DESTROY` permanently burns the holder's balance (reducing circulating supply), `SLEEP` pauses a token's (or an address's) activity until a resume block, and `CALLBACK` lets an issuer force-recall outstanding supply after a set block, paying holders a defined compensation token — the basis for bonds, redemptions, and other time-bounded instruments. Locks let an issuer make any of these guarantees permanent and publicly verifiable.

Every transfer runs the full check set atomically before any state change: token exists, sufficient available balance, not sleeping, allow-list membership, block-list exclusion, and recipient memo requirements.

Rich metadata (media, descriptions, links) lives off-chain under the **Token Information Standard** (TIS): the on-chain `DESCRIPTION` field carries a URI to a JSON document, optionally with a `;<sha256>` integrity suffix, or to IPFS/Arweave/Ordinals references. TIS also describes display metadata for token-gated content packs (§15).

### 5.4 Database design and per-chain isolation

State is partitioned by chain and network. Databases follow the convention `XChain_{CHAIN}_{NETWORK}_{COMPONENT}` — e.g. `XChain_BTC_Mainnet_Indexer`, `XChain_DOGE_Testnet_Decoder`. Each indexer holds three connections: a read-only decoder DB (its input), its own indexer DB (its output), and a read-only local mirror of hub state. This isolation means re-indexing one chain never touches another, and re-syncing hub data never touches chain state. The indexer DB comprises 60+ normalized tables — ledger tables (`credits`, `debits`, `escrows`, `fees`), one or more tables per ACTION, normalization/index tables, the COINPAY subsystem, VM tables, and the staking tables.

### 5.5 Block-hash integrity chaining

After each block the indexer computes three independent SHA-256 hashes, each chained to the previous block's hash of the same kind:

```
hash = SHA256( JSON.stringify({ <ordered table rows>, block_index, previous_hash }) )
```

- **Ledger hash** — covers `credits`, `debits`, `escrows`.
- **Actions hash** — covers the `actions` table.
- **Contract hash** — covers contract code, state, executions, emissions, deposits, withdrawals.

Rows are ordered deterministically by `action_index`; bignumbers are stringified for cross-platform stability. Because each hash incorporates the prior block's hash, altering any historical row changes that block's hash and cascades forward — a single comparison at the tip verifies the entire history. Empty blocks still produce non-null, chained hashes. Validators use these hashes to cross-check indexer state (§14); a node whose hashes diverge from the network abstains rather than propagate bad data.

### 5.6 Atomicity, sanity checks, and reorgs

All database writes for a block commit inside one MariaDB transaction — the whole block applies or none of it does, so a mid-block crash leaves a clean pre-block state. After each block, for **every active token**, the indexer asserts the invariant:

```
token_supply == SUM(credits) − SUM(debits)
```

A mismatch is a fatal violation: the transaction rolls back and the indexer halts rather than persist inconsistent state. On a host-chain reorganization, the decoder detects the divergent block hash, records the fork point, and the indexer rolls back all affected tables atomically (deleting rows at or above the fork's first action index), recomputes balances from the remaining ledger, and re-indexes the canonical fork. The utxo-tracker keeps a 10-block undo window for the same purpose.

---

## 6. The ACTION Set

The protocol defines **30 ACTIONs** across eight categories. All are available on every supported chain unless noted. A `^`-prefixed ticker field passes a numeric token id instead of a name.

### 6.1 Token lifecycle

- **ISSUE** — Create a token or update one you own. v0 is full creation (supply, decimals, mint window, lists, callback terms, locks); v1–v5 are targeted edits (description; mint params; lock flags; callback params; access lists). `DECIMALS` is immutable once supply exists.
- **MINT** — Mint supply within the token's rules. Permissionless within an open mint window; the owner may mint beyond `MAX_MINT`; nothing may exceed `MAX_SUPPLY`.
- **DESTROY** — Permanently burn the holder's balance. v0 single; v1/v2 multi-token batches.
- **CALLBACK** — Owner force-recalls all outstanding supply after `CALLBACK_BLOCK`, paying holders the defined compensation token. Fee scales with holder count.
- **SLEEP** — Pause an address (v0) or a token (v1) until a resume block. Dispenser dispenses, order matches, and swap matches are exempt; a token-level SLEEP can itself be batched (pause → operate → unpause).

### 6.2 Transfers

- **SEND** — Transfer balances. v0 single; v1 multi (same tick); v2 multi (mixed ticks); v3 per-transfer memos. For a token with active gated content, a SEND must be batched with a `MESSAGE v2` carrying the re-encrypted content key to the recipient (§15).
- **SWEEP** — Move all balances and/or ownerships from an address, optionally closing market positions. Five flags: `BALANCES`, `OWNERSHIPS` (default on), `ORDERS`, `SWAPS`, `DISPENSERS` (default off). Escrowed value is only reachable via the corresponding position flag.
- **AIRDROP** — Distribute a token to every member of a `LIST` (of addresses, or of holders of listed tokens). v0–v3 scale from single to multi-token, multi-list, with memos. Fee scales with recipient count.
- **DIVIDEND** — Pay a dividend token pro-rata to all holders of a token. The source is excluded; sub-unit rounding excludes zero-share holders. Fee scales with recipients.

### 6.3 Trading (DEX)

- **ORDER** — Place (v0), cancel (v1), or edit (v2) a limit order. The give side is escrowed at creation. An empty give/get tick denotes native coin on that side; native-coin gets settle via COINPAY. Cross-chain orders are matched and settled by the validator federation (§9). `GIVE_OWNERSHIP`/`GET_OWNERSHIP` flags trade token *ownership* (single-fill); while ownership is escrowed, issuance/callback/sleep/link/file on that token are blocked.
- **COINPAY** — Fulfill a native-coin obligation from an order match by paying the seller's address. Anyone may pay on the buyer's behalf; tokens always route to the buyer. Default obligation window 2 hours; a late payment forfeits the coin (the inherent risk of native-UTXO settlement, surfaced prominently by clients).
- **DISPENSER** — A vending machine: send `GET_AMOUNT` of a coin/token to the address and automatically receive the dispensed token. Create (v0), cancel (v1), edit (v2). Supports fiat-denominated pricing via the oracle (12 currencies). Third-party dispensers require the target address to opt in. Up to 1,000 dispenses; 1-hour close window.
- **SWAP** — Same-chain or cross-chain token-for-token exchange. Create/cancel/edit; same ownership flags as ORDER; no native-coin side (use a dispenser for coin-for-token). Cross-chain settlement is handled by the validator federation.

### 6.4 Smart contracts

- **DEPLOY** — Deploy a JavaScript contract (base64-encoded, ≤64 KB). v0 standard; v1 adds `COOLDOWN_BLOCKS` + `SLASH_DESTINATION` to make the contract stakeable. Three-phase syntax validation before any gas is charged; the constructor runs immediately if constructor params are present; code and staking metadata are immutable after deploy. The contract receives a derived address `C:<CHAIN>:<action_index>`.
- **EXECUTE** — Call a method on a deployed contract. Gas is actual consumption × gas price. All state changes and emitted actions are atomic via a database savepoint. Attestation callbacks (§8) are synthesized as system EXECUTEs.
- **DEPOSIT / WITHDRAW** — Move tokens into a contract's derived address / back out to the contract owner. No gas fee; only the owner may withdraw (even from a disabled contract).

### 6.5 Outside-world data

- **PRICE** — On-chain oracle prices. v0 is the validator COIN/FIAT snapshot (one round per BTC block, PBFT-signed, 3 coins × 12 fiats); v1 is a permissionless user TOKEN/FIAT oracle with a 24-hour anti-front-running delay on updates.
- **ATTEST** — The attestation lifecycle (§8): v0 request (VM-emitted only), v1 validator response (multi-signed), v2 system-synthesized expiry.

### 6.6 Staking

- **STAKE** — v1 new capability stake / v2 top-up (validator staking, BTC + XCHAIN only); v3 contract-targeted stake (any chain, any token).
- **UNSTAKE** — Begin cooldown: v0 capability, v1 contract-targeted.
- **DELEGATE** — Rotate (v0/v1) or revoke (v2/v3) a stake's signing key without touching the staked amount.
- **COLLECT** — Claim accrued validator rewards (BTC only); paid from the reward pool, never minted.

### 6.7 Data and communication

- **BROADCAST** — General on-chain text and legacy oracle/betting feeds (v0–v3).
- **MESSAGE** — Encrypted or plaintext messaging. v0/v1 ECDH handshake; v2 encrypted payload; v3 plaintext. Three methods: ECIES (ephemeral key per message, no handshake — used for token-gated key delivery), ECDH (session), and pre-shared AES. The destination coin is independent of the broadcast chain (a message to a BTC address can be sent cheaply on DOGE).
- **FILE** — Store file metadata and optionally an encrypted payload on-chain. Supports AES-256-GCM token-gating; files sharing a gate ticker and key hash form an implicit pack (§15).

### 6.8 Configuration and utility

- **ADDRESS** — Per-address preferences: fee bucket preference, require-memo, dispenser permission.
- **BATCH** — Execute multiple actions atomically in one transaction (≤1 ISSUE, ≤1 MINT, ≤1 FILE, no nesting). The structural basis for token-gated transfers and atomic pause/operate/unpause.
- **LINK** — A persistent cross-reference between two actions by index, optionally across chains (e.g. attach a logo FILE to a token).
- **LIST** — Create (v0) or derive (v1) an immutable list of tickers or addresses, referenced by index as allow/block lists and airdrop targets.

---

## 7. The Virtual Machine

### 7.1 Orchestration, not mutation

XChain's contract layer is separated from the protocol layer. The protocol — the full set of ACTION handlers — is a fixed, validated rule engine inside the indexer. Contracts sit *above* it and cannot touch the ledger directly. A contract cannot credit a balance, move a token, or edit the order book; it can only **emit the same validated ACTIONs a user would**, which then pass through the identical handlers and the identical validation. XChain contracts are orchestration logic, not state-mutation logic.

The consequences are structural, not aspirational:

- A contract bug cannot bypass protocol rules — an over-spend emitted by a contract simply fails the same balance check a user's would.
- The audit surface is the fixed handler set; contracts introduce no new state-mutation paths.
- The protocol can be optimized or extended without breaking deployed contracts, because contracts speak high-level ACTIONs, not low-level storage operations.
- Contract-originated and user-originated state changes are indistinguishable to every downstream tool.

### 7.2 Execution architecture

The VM is a pure-function library instantiated once inside the indexer at startup. Each `EXECUTE` runs the target contract in a fresh **V8 isolate** (via `isolated-vm`) with a separate heap and no access to the host process, filesystem, or network. Isolates are created and destroyed per call. Contracts are JavaScript (ES2020), invoked by method name with string parameters, and interact with the platform exclusively through an injected `xchain` gateway object (context accessors, ledger reads, contract state, action emission, deterministic math, oracle/cross-chain reads, attestation, and — for stakeable contracts — staker reads and slashing).

A per-block compilation cache (keyed by contract index + code hash, bounded to 1,000 entries) skips recompilation for contracts called many times in a block.

### 7.3 Determinism enforcement

Identical results on every node are guaranteed structurally:

- **Non-deterministic globals are stripped** before any contract code runs: `Date`, `Math.random` (and all timers), `process`, `require`, `eval`, `Function`, `fetch`/network, `Proxy`, `WeakRef`/`FinalizationRegistry`, `SharedArrayBuffer`/`Atomics`, `console`, and more.
- **`Math` is replaced** by a frozen deterministic subset. IEEE-754 transcendentals (`sin`, `cos`, `exp`, …) are removed entirely, since they can differ by up to 1 ULP across CPU architectures; deterministic bignumber equivalents are provided via `xchain.math.*`.
- **All token math is string-in/string-out**, wrapping `mathjs` bignumber arithmetic so no floating-point value ever crosses the gateway boundary.
- **Execution is synchronous** — there is no event-loop interleaving.

The boundary between isolate and host uses a JSON bridge with typed, anti-spoof-hardened error encoding (a contract cannot forge an "out of gas" or "revert" signal).

### 7.4 Gas metering

Gas is metered by **AST instrumentation**, not wall-clock timing, so cost is a deterministic function of code structure. Before execution the source is parsed (acorn), `__gas()` charges are injected at every control-flow point — function entry, loop bodies, branches, switch cases, ternaries, try/catch/finally, deep binary-expression chains, and every call expression — and the source is regenerated (astring). A notable consequence: an indexed `for` loop is charged **twice per iteration** (body + update expression), whereas `while`/`for-of`/`for-in` cost once per iteration.

Representative gas costs (current defaults; see Appendix A): computation 1/point; state read 100 / write 200 / delete 100; oracle read 100; cross-chain read 100; action emission 500; attestation request 5,000 (on top of the emission charge). Context accessors, `revert`/`require`, and logging are free.

### 7.5 Bounded execution

Every execution is hard-bounded: gas ceiling **1,000,000**; isolate heap **8 MB**; **50** emitted actions; **10,000** state keys; **1 KB** per key and **64 KB** per value; **64 KB** code; **100** log entries (1 KB each); and a **30-second** wall-clock timeout that exists solely as a safety net. Gas is the binding constraint and halts a normal contract in well under a second; the wall-clock limit is deliberately generous so legitimate contracts are never killed prematurely.

### 7.6 Contract state and derived addresses

A contract's derived address `C:<CHAIN>:<action_index>` participates in the normal balance system — there is no separate custody table — and cannot collide with a real base58 address. `DEPOSIT`/`WITHDRAW` credit/debit it; emitted actions use it as source. Contract key-value state is stored append-only (current value = latest row per key; deletes are null rows), so reorg rollback is a simple delete-by-block with no undo log.

### 7.7 Snapshot semantics and atomic rollback

Emitted actions are queued during execution and applied **only after the VM returns** (snapshot semantics): a contract cannot observe the effects of its own emissions, and `getBalance`/`getTokenInfo` reflect the state at the start of execution. If any emitted action fails validation, the entire execution rolls back — all state changes and all emissions — via a database savepoint. On failure the caller is still charged gas up to the failure point, and debug logs are preserved. Contracts are immutable in API version 1; upgradeability is an explicit proxy-pattern choice for the author.

---

## 8. The Attestation Framework

### 8.1 Request → callback

Most contract platforms can only reason about on-chain data. XChain contracts can ask the outside world a question and receive a verified answer. Because the VM is synchronous and gas-bounded, this uses an asynchronous request-and-callback pattern. A contract calls `xchain.attestation.request(providerId, payload, callback, params, opts)`, which emits an **ATTEST v0** and returns a deterministic 64-hex request id immediately. Validators holding the `attestation` capability later fetch the answer independently, agree on a canonical result, and one of them broadcasts an **ATTEST v1** carrying everyone's signatures. The indexer accepts it and synthesizes a fresh EXECUTE invoking the contract's callback. If no response arrives by the deadline, the indexer synthesizes **ATTEST v2** and the callback fires anyway with status `expired`. The callback fires **exactly once** per request — success, error, or expiry — so a contract never polls and never cleans up.

### 8.2 Wire lifecycle

- **v0 (request, VM-emitted only):** `request_id` is the SHA-256 of `tx_hash ‖ action_index ‖ contract_index ‖ emitter_position` (the indexer re-derives it to defend against a compromised VM). Carries provider id, payload, callback method/params, redundancy, and deadline. A user-broadcast v0 is rejected.
- **v1 (response, validator-broadcast):** carries the response payload, a status (`ok`/`timeout`/`no_quorum`/`provider_error`/`expired`), provider metadata, and `(pubkey, signature)` pairs. The canonical signing message is `request_id ‖ provider_id ‖ sha256(response_payload) ‖ status ‖ meta`. Signers are checked against the `attestation` capability snapshot **at the request's block**, so every node computes the same eligible set. The valid signature count must meet the requested redundancy. Terminal statuses fire the callback; retryable statuses leave the request pending.
- **v2 (expiry, system-synthesized):** the per-block expiry pipeline flips any past-deadline pending request to expired and fires the callback with an expired status.

### 8.3 Providers

The provider set is governance-controlled. Two ship initially:

| Provider | Action | Consensus |
|---|---|---|
| `http_get` | Fetch an HTTPS URL | Exact byte-equality across validators |
| `llm` | Prompt an approved language model | A judge model decides semantic equivalence |

The `llm` provider takes a JSON prompt envelope (`prompt`, optional `system`/`max_tokens`/`temperature`/`format`), bounded to 8,192 bytes. Approved models are governance-set; a separate judge model (run at temperature 0) evaluates whether independent validators' answers mean the same thing, since LLM outputs are not byte-identical even at temperature 0. Validators may use either a subscription-based or API-based transport; a mixed-transport quorum still converges because the judge evaluates meaning, not bytes.

### 8.4 Redundancy

The `redundancy` option (1, 3, or 5) sets how many validators must agree. `1` is the cheap path — one validator's answer is final. `3`/`5` add independent verification (byte-equality for `http_get`; judge consensus for `llm`); if quorum cannot be reached the request expires. Redundancy changes the trust model and the escrowed fee, never the contract-visible callback signature. *(The attestation fee economics — paying responders, expiry refunds — are a later economic phase; pending mainnet activation.)*

---

## 9. Cross-Chain

### 9.1 Independent per-chain ledgers

Each chain is a fully independent ledger — its own token registry, balances, order books, fee token, block height, and reorg history. There is no shared state at the protocol level. A ticker on Bitcoin and the same ticker on Litecoin are distinct assets owned by whoever issued each.

### 9.2 SWAP and mirror settlement

When a user posts an `ORDER` or `SWAP` whose get-side coin differs from the posting chain, the give side is escrowed locally exactly as in a same-chain trade, and settlement is driven by the validator federation:

1. **Discover** open cross-chain offers on each chain.
2. **Match** compatible offers.
3. **Finalize and sign** a single match record with `2f+1` signatures from `cross_chain`-capable validators, selected from a block-boundary snapshot.
4. **Deliver** the signed match to every indexer over the same hub-DB mirror that carries price data — no per-trade on-chain transaction.
5. **Settle**: each indexer independently verifies the `2f+1` signatures against the snapshot validator set and releases its leg's escrow to the counterparty, recording an internal settlement for idempotency and reorg-safety. Indexers apply a match at the first block whose timestamp passes the match's effective time, so all operators of a chain settle identically.
6. **Retract** on a source-order reorg; any indexer that settled rolls its leg back.

The mirror is a transport, not an authority: a corrupted mirror can delay but **cannot forge**, because the signed canonical match string includes the network identifier (preventing cross-network replay) and every signature must verify against the on-snapshot `cross_chain` set. Throughout, **no tokens leave their home chain** — only ownership changes — and **the hub never takes custody**. An optional Merkle-rooted audit anchor may be published to a chain for transparency without gating settlement.

### 9.3 Native-coin settlement (COINPAY)

Where a trade involves native coin, matching creates a COINPAY obligation rather than escrowing the coin (which the protocol cannot custody). The payer broadcasts a COINPAY paying the payee within the obligation window; on success the token escrow releases to the buyer, on expiry it returns to the seller. This is the one settlement path with an inherent timing risk — a payment confirming after expiry forfeits the coin — which clients surface prominently and pre-validate against.

### 9.4 Ownership trading

The `GIVE_OWNERSHIP`/`GET_OWNERSHIP` flags on ORDER, SWAP, and DISPENSER trade a token's *ownership record* (its issuer rights) rather than a balance. These are single-fill; while ownership is escrowed, owner-only operations on that token are blocked; and ownership co-settles atomically with any token amounts in the same settlement.

---

## 10. The Validator Network (Hub)

### 10.1 Topology and identity

The hub is a decentralized validator network: a WebSocket P2P flood-fill gossip mesh with Ed25519 identities. Validators maintain persistent connections to seed nodes with backoff, exchange signed, deduplicated, rate-limited messages, and relay them across the mesh. Every message is signed over a fixed-key-order canonical form; when signature enforcement is on, messages from unregistered senders are rejected. A validator's public key is registered on-chain via staking (§11).

### 10.2 PBFT consensus

All consensus domains use a simplified three-phase PBFT (pre-prepare → prepare → commit) with quorum `2f+1` where `f = floor((N−1)/3)` — tolerating up to `f` Byzantine validators out of `N`. Leaders are chosen by deterministic round-robin over the pubkey-sorted set; a leader that stalls past the timeout triggers a view change to the next leader once `2f+1` view-change votes accumulate. Consensus sequence/view state is persisted so validators resume correctly after restart. With no peers connected, a single instance executes operations directly (degenerate single-node mode).

### 10.3 Price oracle

Each round (anchored to the BTC chain tip), price-capable validators fetch prices from multiple external sources for 3 coins × 12 fiats, broadcast their submissions, and the network aggregates by **trimmed median** — discarding the top and bottom 15% of submissions before taking the median, so meaningfully shifting the price requires controlling more than ~30% of validators. The aggregated set is finalized through PBFT and stored with the set of signatures as a consensus proof. The `oracle_publish` capability then deterministically elects a publisher to post the finalized round on-chain (as `PRICE v0`), with block-by-block failover that batches any missed rounds.

### 10.4 Cross-chain attestation

For a cross-chain action, only validators supporting *both* chains in the pair participate in a `2f+1` PBFT attestation that the source action has reached its required confirmation depth — **BTC 6 / LTC 12 / DOGE 60** confirmations by default (higher on lower-hashpower chains to approach Bitcoin-comparable settlement assurance; per-chain, tunable via `XCHAIN_CONFIRMATIONS_<COIN>`).

### 10.5 Governance

Parameters are changed by off-chain PBFT-style governance voting over the gossip layer. Proposals run for a **7-day** voting period, require a minimum 50% participation quorum and **two-thirds** approval, are bounded in how far they may move a parameter per change, and observe a cooldown before a rejected parameter may be re-proposed. Votes are signed and uniquely constrained to one per validator per proposal. Fee parameters, oracle cadence, capability minimums, the provider set, and slashing thresholds are all governance-controlled.

### 10.6 Trust model

The hub holds no user funds at any point. All asset operations are ordinary on-chain ACTIONs processed by the indexer; the hub cannot unilaterally move anything. If the hub is unreachable, settled state is unaffected — services fall back to a recently-cached config, and only *new* cross-chain coordination pauses. In validator mode the network stays live as long as `2f+1` validators are reachable. Operators who run their own full stack — including their own hub validator — depend on no single instance.

---

## 11. Staking

XChain has two independent staking systems that share no state.

### 11.1 Capability staking (validator network)

Validators stake **XCHAIN on the BTC chain** against an Ed25519 signing pubkey. A pubkey's aggregate active stake auto-qualifies it for each of four independent, governance-configurable capabilities whose minimum it meets:

| Capability | Role |
|---|---|
| `price` | Fetch and submit oracle prices |
| `oracle_publish` | Broadcast finalized rounds on-chain |
| `cross_chain` | Attest cross-chain actions for a chain pair |
| `attestation` | Serve external attestation requests |

There is no tier hierarchy; any combination qualifies. Stakes activate after a short reorg-protection delay (≈6 BTC blocks) and, on unstaking, pass through a deactivation delay and then a cooldown (default 1,000 blocks) before the XCHAIN returns. Each consensus engine locks its eligible set at a block-boundary snapshot so the whole federation agrees on the quorum even as stake drifts. Misbehavior — price deviation beyond a threshold, repeated deviation, prolonged non-participation, or attestation divergence on a byte-equality provider — is detected and adjudicated through governance, with slashing executed by the indexer.

### 11.2 Contract-targeted staking

A general-purpose primitive available on **every chain, for any token**. A contract that declares itself stakeable at deploy time (immutable `COOLDOWN_BLOCKS` and `SLASH_DESTINATION`) can be staked against by anyone, and its own code decides what staking unlocks and when to slash. From inside the contract, `xchain.contract.getStake/getTotalStaked/getStakers` read the staker set (top 1,000) and `xchain.contract.slash` slashes a staker — hitting active stake first, then cooldown-queued balance (so a staker cannot escape an imminent slash by unstaking), capped silently at available balance, and atomic with the calling EXECUTE. Slashed tokens route to the deploy-time destination (an address or `BURN`); each slash is recorded on-chain. This enables prediction markets, security bonds, validator-style services, reputation systems, and bonded escrow — backed by value on any chain. *(Pending mainnet activation.)*

---

## 12. Security Model

**Where each guarantee comes from:**

| Property | Provided by |
|---|---|
| Transaction ordering & finality | The host blockchain's proof-of-work |
| Token-state correctness | Deterministic protocol rules + per-block sanity checks |
| Balance integrity | Double-entry ledger + block-level supply invariant |
| Independent verification | Anyone can run a full node and replay from genesis |
| Configuration / prices / cross-chain coordination | Hub validator network (PBFT, `2f+1`) |
| Transport security | TLS, Helmet headers, CORS, circuit breakers, rate limits |
| SQL safety | Parameterized queries; rollback uses a hardcoded table whitelist |

**Determinism as a security property.** Because processing is fully deterministic, correctness is not a matter of trusting the operator — it is independently checkable. The block-hash chain (§5.5) lets any two nodes detect divergence with a single comparison.

**Obfuscation is not encryption.** All on-chain ACTION data is public; the payload obfuscation only deters naive scanning. Confidential communication is available at the application layer via `MESSAGE` (ECDH/ECIES + AES), but even that protects content, not metadata. Sensitive values must never be placed on-chain in cleartext.

**Replay and escrow.** The monotonic `ACTION_INDEX` with no forward references makes replay structurally impossible (§4.4); escrow accounting makes double-spending locked value impossible (§5.2).

**VM containment.** Contracts run in sandboxed isolates with no host/network/filesystem access, cannot mutate the ledger directly, cannot exceed hard resource bounds, and roll back atomically on any failure (§7).

---

## 13. Economics

### 13.1 Gas and fees

All protocol fees are expressed in **gas**, converted to XCHAIN by a single `GAS_PRICE` lever, and paid either in native coin (all chains, via oracle conversion) or by XCHAIN-balance deduction (BTC only). On BTC, a fee output to the destination address signals native-coin payment (validated against the oracle within a 95–110% tolerance band); its absence triggers an XCHAIN-balance debit. Native-coin fees are real on-chain outputs and are non-refundable if the action later fails, so clients pre-flight a fee quote and refuse to broadcast an action they cannot price. XCHAIN-balance fees route to one of three buckets by the payer's preference: **burn** (deflationary), **protocol development**, or **community development**.

The full schedule is in Appendix A. The gas costs and `GAS_PRICE` are consensus-critical and are finalized at protocol freeze ahead of launch.

### 13.2 The XCHAIN monetary model

XCHAIN is the gas token, issued once on the BTC chain at genesis and then **permanently locked** (`LOCK_MINT` + `LOCK_MAX_SUPPLY`). No further XCHAIN can ever be created — by anyone, including the issuer. Supply only ever *decreases*, through the burn bucket. Validator rewards are **paid from a pre-funded reward pool, never minted**; if the pool is exhausted, reward claims are rejected and stay claimable until it is topped up. XCHAIN's demand drivers are therefore fee payment and staking lockup against a fixed, deflationary cap.

### 13.3 Genesis and fair launch

XChain launches without an inflationary mint or an insider faucet: the gas token's supply is fixed at genesis and can only shrink. The genesis distribution is planned to honor the communities that pioneered Bitcoin-native tokens, via a snapshot that reserves asset-*name* ownership for prior holders together with a community airdrop — a fair-launch posture with no ICO. Final supply and allocation figures are published ahead of launch.

---

## 14. Replication and Verifiability

The sync service replicates both the decoder and indexer databases to validators and consumers. A server-mode instance polls source databases, records per-block hashes to a transparency log, and streams blocks over WebSocket alongside full and incremental REST snapshots. A client-mode instance bootstraps from a snapshot, then verifies: it cross-checks the three chained block hashes against a *second*, independent source, and a mismatch raises a discrepancy alert and halts that block rather than apply unverified data. Because the indexer's three hashes are chained and cover every state-mutating table, cross-source hash equality is a complete integrity check — independent indexers on the same chain data produce bit-identical hashes, so no separate Merkle proof system is needed. This is the mechanism by which a validator can run XChain without trusting any single data provider.

---

## 15. Token-Gated Content

XChain can publish files on-chain that only holders of a given token can decrypt, with no key server and no on-chain unlock action. A creator encrypts content with **AES-256-GCM** under a random key `K` and publishes it via `FILE` with the gate ticker, encryption method, and `KEY_HASH = sha256(K)`; files sharing a gate ticker and key hash form an implicit pack that unlocks together. The key itself is handed to holders inside an **ECIES** envelope carried by `MESSAGE v2`, using a compact binary payload — a single-key handoff is just **33 bytes** (a version byte plus the 32-byte key), versus ~154 bytes for a JSON encoding. Crucially, the protocol enforces that any `SEND` of a gated token must be batched with a `MESSAGE v2` re-encrypting `K` to the recipient's public key — so the key follows the token automatically on every transfer and sale. Unlocking is entirely client-side: fetch the ciphertext, ECIES-decrypt the messages addressed to you, match each candidate key against the file's `KEY_HASH`, and decrypt.

---

## 16. Roadmap and Future Chains

The near-term path to launch is the protocol freeze (locking the wire format and gas schedule), public-facing site and API documentation, and the public release of the source repositories.

Beyond launch, the platform's chain-agnostic design makes **breadth across the UTXO family** the natural growth vector — each new chain is additive and config-driven, sharing the same protocol and tooling. A first-class non-fungible primitive and the later economic phases of the attestation framework are planned protocol extensions. Support for **account-model chains** (Ethereum and similar) is a longer-term research direction: the pure data-layer of the protocol is bounded and additive, while reaching account-model ecosystems without reintroducing bridge risk is the harder, open part of the problem. The platform is designed so that supporting a large number of blockchains over time is an extension of its core technique, not a departure from it.

---

## 17. Conclusion

XChain demonstrates that a complete digital-asset platform — tokens, an exchange, cross-chain settlement, structured data, and a programmable, AI-reachable smart-contract engine — can be built *on top of* unmodified UTXO blockchains, inheriting their security wholesale rather than rebuilding it on a weaker foundation. By embedding a deterministic protocol in ordinary transactions, constraining contracts to orchestrate a fixed and audited action set, coordinating cross-chain settlement through a custody-free Byzantine-fault-tolerant validator network, and grounding its economics in a fixed, deflationary gas token, XChain offers the capabilities the market wants without the trust assumptions it has learned to fear. It is live today on three chains and designed to extend across many.

---

## Appendix A — Fee Schedule

> Current default values, shown to convey the model. The gas costs and `GAS_PRICE` are consensus-critical and are finalized at protocol freeze.

| Parameter | Current value |
|---|---|
| `GAS_PRICE` | 0.00001 XCHAIN/gas (governance-adjustable) |
| ISSUE | 100,000 gas (anchor = 1.0 XCHAIN) |
| Sub-token ISSUE | 50,000 gas |
| EXECUTE base | 1,000 gas |
| DEPLOY base | 100,000 gas + 10 gas/byte |
| State read / write / delete | 100 / 200 / 100 gas |
| Oracle read / cross-chain read | 100 / 100 gas |
| Action emission | 500 gas |
| Attestation request | 5,000 gas (plus the 500 emission) |
| AIRDROP / DIVIDEND | 100 gas/recipient |
| Order/dispenser/swap expiration | first 90 days free, then ~550 gas/day |
| VM gas ceiling / memory | 1,000,000 gas / 8 MB per execution |
| Emitted actions / state keys | 50 / 10,000 per execution / contract |

## Appendix B — Key Parameters Reference

| Parameter | Value |
|---|---|
| Supported chains (today) | BTC, LTC, DOGE (UTXO; more by configuration) |
| Embedding ceiling (P2WSH, decoder-enforced) | 8,192 bytes |
| Magic prefix | `XCHN` |
| Cross-chain confirmations (default) | BTC 6 / LTC 12 / DOGE 60 |
| PBFT quorum | `2f+1`, `f = floor((N−1)/3)` |
| Trimmed-median trim | top/bottom 15% |
| Governance | 7-day vote, 50% quorum, ⅔ approval |
| utxo-tracker reorg undo window | 10 blocks |
| Capability stake activation / cooldown | ≈6 BTC blocks / 1,000 blocks (governance-set) |
| XCHAIN supply | fixed at genesis, locked, BTC-chain only |

---

**Copyright © 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) with a commercial license available for proprietary use.
