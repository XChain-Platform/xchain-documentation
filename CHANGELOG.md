# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- `protocol/actions/DISPENSER.md`: the front-running section wrongly said a first oracle price takes effect immediately; every PRICE v1 publish is delayed 24 hours, first included.
- `protocol/actions/DISPENSER.md`: five v0 examples were one field short and shifted every field after `GIVE_OWNERSHIP`, including both FIAT examples.
- review corpus corrections: zero-premint genesis, GAS supply, SPV wallet status, WS statuses filter, explorer port, open-source claim, ANCHOR v0-v6, VM lint-rule inventories, recursion depth, slashable engines, manifest re-vendor with encoder as sixth copy.

### Added
- `protocol/actions/PRICE.md`, `protocol/actions/DISPENSER.md`: documented the oracle usage fee, paid up front by the dispenser opener as a native-coin output, with the quote endpoint to size it.
- `test/action-example-fields.test.js`: lint pinning the DISPENSER v0 examples to the declared 17-field format.
- `protocol/actions/DISPENSER.md`, `protocol/actions/ADDRESS.md`: documented the origin-standing create rule (`DISPENSER_ORIGIN_STANDING`): the source of a prior valid dispenser create on an address may open additional dispensers on it.
- `developer-guide/AI_Assisted_Authoring.md`: AI-assisted authoring on-ramp (describe a contract in English or paste Solidity, then gate-validate the model's reply with `xchain-foundry`); indexed in the developer-guide README and cross-linked from Solidity to XChain.
- `protocol/Protocol_Activation.md`: new flag-day mechanism reference (the per-network version+time/height gate, the three activation cohorts A/B/C, and forking vs halt-recoverable straggler behavior); indexed in the protocol README and cross-linked from the Upgrade Notice Policy.
- `protocol/constants.js`: armed the four remaining Cohort-B maps at BTC 961000 and `STATE_COMMITMENT_ACTIVATION` per chain (2026-07-07 state-hash heights).
- `protocol/Upgrade_Notice_Policy.md`: adopted the upgrade-notice policy (14 days pre-launch, 60 days once any third-party validator is live).
- `protocol/constants.js`: armed `CROSS_CHAIN_ROYALTY_ACTIVATION` mainnet at BTC anchor 961000 (~2026-08-04).
- `protocol/constants.js`: registered `CROSS_CHAIN_ROYALTY_ACTIVATION` (XMATCH royalty-legs flag-day) as the canonical for the hub/indexer twin modules.
- `protocol/Contract_ABI.md`: optional self-declared contract display metadata (method summaries, typed params, `view` flags), with fail-closed reader rules and a security note; cross-referenced from DEPLOY, Smart Contracts, and the protocol index.
- `protocol/XChain_URI_Scheme.md`: new `execute` action (contract/method/params/gas) for wallet deep links from the explorer's Write Contract card.
- Explorer CONFIGURATION/API pages document the self-synced checkpoint mirror (`self_sync`, `HUB_API_URL`, staleness behavior, `/hub-mirror/status`); hub API page documents `getvotes`, `getvalidatorcapabilities`, and the new `getproposals` filters.
- `developer-guide/Adding_A_Blockchain.md`: step-by-step procedure for adding a chain via the single canonical per-coin config file in `xchain-hub/src/coins/`; linked from `developer-guide/README.md`.
- `components/explorer/API.md`: documented the VOTE governance read surface (`polls`/`poll`/`poll results`/`votes` endpoints, DataTables twins, quick-reference rows) and the hub federation/governance reads (`validator_capabilities`, `governance_proposals`, `governance_votes`, `capability_slash_events`, `oracle_prices`).
- `components/sdk/ACTIONS.md`: added the VOTE action (v0/v1/v3 wire formats, `sdk.voting.*` param builders) and bumped the SDK action count to 30 (also in `README.md`).
- `components/sdk/WORKFLOWS.md`: documented the `createPoll` / `castBallot` / `delegateVote` / `clearVoteDelegation` governance submit recipes.
- `components/sdk/EXPLORER.md`: added a Governance section covering `getPolls`/`getPoll`/`getPollResults`/`getVotes` and the hub-governance readers `getValidatorCapabilities`/`getGovernanceProposals`/`getGovernanceVotes`.
- `components/wallet/FEATURES.md`: added the Governance (VOTE) UI section (`GovernancePolls`, `PollDetail`, `CreatePollForm`, `DelegateVoteForm`) and the UR hardware-signer ingestion bullet.
- `components/wallet/URI_Schemes.md`: documented the `ur:crypto-psbt` (Keystone/Passport) animated-QR decoder (`UrPsbtDecoder`, fountain-code reassembly).
- `components/hub/API.md`: documented `getanchorstatus` (publisher runway monitoring); `components/hub/CONFIGURATION.md`: added `HUB_ALLOW_UNAUTHENTICATED`, `ORACLE_EARLY_MSG_MAX_ROUNDS`, and `CROSS_CHAIN_INDEXER_TIMEOUT`.
- `components/sync/CONFIGURATION.md`: documented `WS_BACKPRESSURE_MAX_BYTES`/`WS_BACKPRESSURE_STALL_MS` (replacing the retired `WS_BACKPRESSURE_LIMIT`), `CLIENT_SOURCE_STALE_MS`, `DISPENSERS_RECONCILE_EVERY`/`DISPENSERS_RECONCILE_MAX_INTERVAL_MS`, `CHECKPOINT_ANCHOR_URL`, and `CHECKPOINT_SEED_<CHAIN>_<NETWORK>`.
- `components/explorer/CONFIGURATION.md`: added `EXPLORER_FORCE_HTTPS`, `EXPLORER_HOLDERS_CACHE_MS`/`EXPLORER_HOLDERS_CACHE_MAX`, and `SPV_CHECKPOINT_MAX_LAG_BLOCKS`.
- `components/regtest-miner/OPERATIONS.md`: documented `invalidate_block`/`reconsider_block` reorg helpers, the opt-in `MINER_API_KEY` auth gate (`ping`/`status` exempt), the `mining_paused` status field, and the pinned `settxfee` wallet fee rate; `CONFIGURATION.md`: mainnet is refused at startup.
- `components/utxo-tracker/OPERATIONS.md`: documented `GET /status`, the `reorg_count`/`last_reorg_depth` sync-status fields, and the fullTxHash re-index error.
- `components/decoder/OPERATIONS.md`: documented `GET /status` and the `node_height_stale` health field; `CONFIGURATION.md`: `DECODER_API_PORT` is now validated at startup.
- `components/node/CONFIGURATION.md`: added `XCHAIN_NODE_HUB_SIGNER_DIR`, the `XCHAIN_NODE_DB_*` MariaDB tuning vars (max-connections defaults to 1000), `ALLOW_NO_COLOCATED_HUB_DB` forwarding, explorer port-override notes, and the regtest `INDEXER_ALLOW_UNAUTHENTICATED` default.

### Changed

- `protocol/providers/llm.md`: default Claude CLI config dir updated to the renamed `~/.claude-xchain` (was `~/.claude-xchain-hub`).
- `BLOCKCHAINS.md`: "Adding New Blockchains" now describes the single canonical coin-file model and links the new developer guide.
- `protocol/Index_Id_References.md`: specify the canonical `^<id>` form (caret plus decimal digits, no leading zero, id >= 1, referencing an existing block-stamped id); all other caret forms are rejected.
- `operations/XCHAIN_GENESIS.md`: rewritten to match the shipped genesis (token injected at the pinned genesis block with zero pre-mint and a `MINT_START_BLOCK` sentinel, public fair mint at launch, per-network genesis pins and hash verification) instead of the old mint-everything-and-lock runbook.
- `protocol/README.md`: index now links the ACTION manifest, Controller-Bound Tokens, Cross-Chain Calls, Cross-Chain DEX, x402 Payments, attestation providers, and Error Codes.
- `components/hub/OPERATIONS.md`: validator-mode hubs without `HUB_API_KEY` now refuse to boot unless `HUB_ALLOW_UNAUTHENTICATED=true`.
- `components/explorer/API.md`: `getAddress` response fields documented, including `tracker_available` and `mempool_ready`.
- `architecture/Component_Map.md`: indexer/explorer key details now mention VOTE poll finalization and the governance read pages.

### Fixed

- `components/decoder/OPERATIONS.md`: `lag_blocks` is `null` when either height is unknown, not `0`.
- Explorer WEBSOCKET.md no longer advertises the `statuses` filter: it is out of WELCOME `features` and both SUBSCRIBED `active_filters` examples, matching what the server actually emits, and the parameter row now records that it is not supported ().

## [0.12.0] - 2026-06-20

### Added

- Three-week documentation drift sweep (2026-06-13): audited all `xchain-*` sub-repos against the docs; entries below are its output.
- `components/sdk/NFT_AND_REGISTRY.md`: new reference for `sdk.nft.*` builders (`unique`, `edition`, `collectionItem`, `attachContentParams`, `tisDocument`, `isNft`, `action:<COIN>:<index>` data-ref) and `sdk.project.*` registry builders; linked from `components/sdk/README.md`.
- `components/sdk/WORKFLOWS.md`: documented `issueNft`, `issueNftEdition`, `issueCollectionItem`, `attachContent`, and `setRoster` workflow helpers.
- `components/sdk/ERRORS.md`: added `SDKPolicyError` (`POLICY_*`) and `SDKX402Error` (`X402_*`) classes with full code registries for AgentSession policy enforcement and the x402 payment flow.
- `components/sdk/README.md`, `SESSIONS.md`, and `ai-agents/Agent_Wallets.md`: surfaced `sdk.agentSession(wif, policy)`, the x402 gateway/client, and the MCP server; documented `stateFile` policy override and `POLICY_STATE_CORRUPT`.
- `components/sdk/EXPLORER.md`: added `getProject`, `fileRawUrl`, `getFeeQuote`, `getFeeSchedule`, `getPriceSnapshots`, and `getMempool`; `components/sdk/ENCODER.md`: added `estimateFees`.
- `components/hub/API.md`: documented `getcapabilitythresholds`, `getstakesourcebypubkey`, `anchorflush`, `pushvalidatorrewards`, four hub-db snapshot REST endpoints, the full six-table WebSocket mirror, and `GET /openrpc.json`.
- `components/hub/ARCHITECTURE.md`: added `StateCheckpointEngine` and `StateAnchorPublisher` to source-file map and event-wiring diagram; `components/hub/CONFIGURATION.md`: corrected table count (13 to 20) and documented seven previously-undocumented tables, `ANCHOR_*` knobs, and `HUB_SIGNER_MODULE`; `components/hub/OPERATIONS.md`: added checkpoint/anchor engines to startup sequence plus `anchorflush` and DOGE-publisher-wallet troubleshooting.
- `components/explorer/API.md`: added checkpoint-verification endpoints, `feequote`/`feeschedule`/`price`/`price_snapshots`/`cross_chain_matches`/`cross_chain_settlements`, and `GET /openapi.json`; expanded `/api/status` and `/api/network` response examples; `components/explorer/CONFIGURATION.md`: added `NO_HUB` and `DECODER_API_URL[_<COIN>_<NETWORK>]`; `components/explorer/WEBSOCKET.md`: documented mempool and attestation events.
- `components/indexer/OPERATIONS.md`: documented `feequote`, `feeschedule`, and `getactionconfirmations`; `components/indexer/DATABASE.md`: added `stake_key_revocations` table (DELEGATE v2); `components/indexer/ACTIONS.md`: added `ANCHOR` action (DOGE-only, no protocol fee, writes `anchor_actions`).
- Attestation paid-request (E1) fields: `protocol/actions/ATTEST.md`, `protocol/providers/llm.md`, `protocol/providers/README.md`, and `concepts/Smart_Contracts.md` now document `feeTick`/`feeAmount` request options and the governance-configurable `min_fee_xchain` floor.
- `protocol/actions/EXECUTE.md`: documented DEPLOY constructor emissions and the 50-emission-per-invocation cap; `concepts/Smart_Contracts.md`: added `xchain.getCallDepth()`/`getCrossHops()`; `components/vm/CONFIGURATION.md`: added `VM_MAX_CALL_DEPTH` and `VM_MIN_CALL_GAS`; `developer-guide/Smart_Contract_Development.md`: added deploy-time validation checks 4 (banned transcendental `Math.*`) and 5 (banned `BigInt`/`RegExp` literals).
- `protocol/actions/README.md`: added `XCALL` and `XEXEC` to the VM-actions table; `concepts/CROSS_CHAIN.md`: added a cross-chain-contract-calls (`emit.crossExecute`) section.
- `concepts/GAS.md`: documented the `FEE_PAYMENT_MODE` per-chain parameter; `components/encoder/README.md`: added the `estimate_fee` method, `GET /openrpc.json`, and the Litecoin 5,460-litoshi dust threshold.

### Changed

- `components/sdk/ACTIONS.md`, `architecture/Component_Map.md`, `architecture/Data_Pipeline.md`: corrected P2WSH capacity figures to the 476-byte per-chunk element bound and 8,192-byte compiled-payload ceiling (`MAX_COMPILED_ACTION_DATA_LENGTH`); fixed wire-format strings for ADDRESS, DISPENSER, MESSAGE, ORDER, SWAP, and SWEEP to match `xchain-sdk/src/formats.js` (adding `DISPENSER_PREFERENCE`, `GIVE_OWNERSHIP`/`GET_OWNERSHIP`, `ORACLE_ADDRESS`, `COIN`, and the three SWEEP escrow flags).
- `protocol/actions/ATTEST.md`, `protocol/actions/XCALL.md`, `WHITEPAPER.md`: corrected `request_id`/`CALL_ID` preimage definitions to match the post-refactor implementation (attestation `request_id` = `sha256(tx_hash:root_action_index:emitter_path:contract_index:emitter_position)`; cross-chain `call_id` = `sha256(network:source_chain:tx_hash:root_action_index:contract_index:emitter_path:emitter_position:target_chain)`).
- `protocol/actions/DEPLOY.md`: documented that inline `CODE_ENCODING` is gated behind the `DEPLOY_BASE64_CODE` activation (hex before, base64 after); added an "Encoding activation" section explaining the gate is keyed on block time so historical `code_hash` values stay stable; chunked slices are base64 from genesis and unaffected.
- `protocol/actions/XCALL.md`: updated `CALL_ID` preimage to drop `emitter_action_index`; it is now `sha256(network:source_chain:tx_hash:contract_index:emitter_position:target_chain)` because `action_index` is indexer-synthetic and non-deterministic across nodes.
- `getting-started/Quickstart_Developer.md`, `getting-started/Quickstart_Node_Operator.md`: corrected the Node.js requirement from "18 or later" to Node 22 (Node 18 fails on the ESM-only `mariadb` package; Node 24 cannot build `isolated-vm`).
- `protocol/Contract_Staking.md`: documented `DELEGATE v2` (capability revoke) and `DELEGATE v3` (contract-targeted revoke); relabelled the rotate example field to `NEW_SIGNING_PUBKEY` to match `DELEGATE.md` and the handler.
- `protocol/NFT_Standard.md`: updated the guided create-NFT flow recommendation to reflect the shipped `sdk.nft.*` builders and `sdk.issueNft*` workflows.
- `protocol/actions/MESSAGE.md`: documented that MESSAGE v2 carries no `ENCRYPTION_METHOD` field on the wire and its absence must be interpreted as `ENCRYPTION_METHOD = 1` (ECIES); encoders must not include the field in a v2 message.

### Fixed

- `components/hub/ARCHITECTURE.md`, `protocol/actions/PRICE.md`, `protocol/actions/ANCHOR.md`: corrected the PBFT quorum formula to include the simple-majority floor: `max(2f+1, ceil((N+1)/2))`; the bare `2f+1` degenerates to quorum=1 at N=3.
- `protocol/actions/README.md`: retitled the staking section header from "Hub Staking (BTC chain only)" to scope the BTC-only restriction to capability staking only (contract-targeted staking runs on every chain).
- `components/vm/ARCHITECTURE.md`: corrected the "Replaced" deterministic `Math` subset by removing the banned transcendentals (`sqrt`/`pow`/`log`/`log2`/`log10`); also fixed stale emit/validator action counts (`gateway-emit.js` 16 to 18, `validator.js` 16 to 20).
- `protocol/actions/XCALL.md`: corrected cross-chain-call injection ordering from "hub-`id` order" to `(snapshot_block, call_id)` in both the dispatch and ANCHOR-archive descriptions.
- `components/explorer/API.md`: corrected the mempool endpoint description from "reserved for future implementation" to live, serving pre-validation rows from the decoder DB with `address`/`token` filters.
- `concepts/CROSS_CHAIN.md`: corrected that SWAP create (format 0) has no counterparty `ACTION_INDEX` field, and that cross-chain DEX settlement is finalized by the hub's `CrossChainDexEngine` via PBFT, not the attestation engine.
- `components/indexer/DATABASE.md`, `ACTIONS.md`, `ARCHITECTURE.md`: corrected stale `reward_type` values (removed non-existent `cross_chain_attestation`; real types are `oracle_round`, `attest_fee`, `anchor_<chain>`, `anchor_archive`).
- `components/hub/DECENTRALIZATION.md`: extended the quorum-floor correction to the `cross_chain` capability section and consensus summary; added a Phase 7 row (federation key rotation, 2026-06, complete).
- `protocol/actions/ATTEST.md`: corrected `RESPONSE_PAYLOAD` from "inline UTF-8" to base64-encoded on the wire; corrected the signing hash from "UTF-8 response bytes" to raw response bytes after base64-decoding.
- `components/sdk/ENCODER.md`: corrected the P2WSH capacity from 9,956 to 8,192 bytes; `protocol/Error_Codes.md`: corrected the encoder and hub OpenRPC URLs from `/{COIN}/openrpc.json` to root `/openrpc.json`.

## [0.11.0] - 2026-06-06

### Added
- `operations/DISK_MANAGEMENT.md`: new operator guide for moving a chain's block data to a larger disk; documents `XCHAIN_NODE_BLOCKS_DIR` and symlinking patterns, and warns that bare `blocks/` bind-mounts miss subdirectory paths on DOGE/LTC testnet/regtest; `components/node/CONFIGURATION.md`: added a matching network-subdirectory warning callout cross-linked to the new guide.
- `protocol/constants.js`: canonical CommonJS module declaring `MAX_ACTION_DATA_LENGTH` (8192), `OP_RETURN_PUSH_OVERHEAD` (3), and `MAX_CODE_SIZE` (65536) as the shared source of truth across services; cross-service regression suite asserts every service's local copy matches it.

### Changed
- `components/e2e-test/CONFIGURATION.md`, `components/node/CONFIGURATION.md`: renamed the documented indexer service-host variable `INDEXER_HOST` to `INDEXER_URL` to match the `<SERVICE>_URL` naming convention.
- `protocol/Contract_Staking.md`, `protocol/actions/STAKE.md`, `protocol/actions/UNSTAKE.md`, `protocol/actions/DELEGATE.md`, `components/hub/DECENTRALIZATION.md`: corrected the staking activation delay to be calibrated per chain (BTC 6 / LTC 24 / DOGE 60 blocks) for equivalent ~60-minute reorg protection, rather than a flat 6-block value.
- `xchain-indexer-sync` repository renamed to `xchain-sync` throughout the documentation; decoder DB replication added; all REST and WebSocket endpoints gained a `/:dbType/` path segment (breaking for external clients).

### Fixed
- `components/sync/OPERATIONS.md` and `components/hub/ARCHITECTURE.md`: documented the client WebSocket `heartbeat` message shape, the `POST /validator-heartbeat/:dbType/:chain/:network` REST fallback, the `GET /validator-status` endpoints, and the full P2P gossip envelope schema with all gossip message types.
- `components/hub/API.md`, `components/indexer/OPERATIONS.md`, and `components/sync/OPERATIONS.md`: documented the full `health` endpoint response shapes for all three services, including per-field types, 503-on-degraded behaviour, and circuit-breaker fields.
- `components/hub/API.md` and `components/sync/CONFIGURATION.md`: corrected the `getallconfigs` response shape from a bare nested object to the real envelope `{ configs, seq, watermark }`, and documented the `since_updated_at` delta-polling parameter.
- `protocol/actions/ATTEST.md` and `developer-guide/Smart_Contract_Development.md`: documented that `callbackParams` elements are string-coerced at injection regardless of original type (e.g. `[42, true]` arrives as `['42', 'true']`).
- `protocol/actions/ATTEST.md`: corrected the response lifecycle to distinguish retryable statuses (`no_quorum`/`timeout`/`provider_error`, leave request `pending`) from terminal statuses (`ok`/`expired`, fire callback and close request).
- VM gas docs: disclosed that indexed `for` loops are charged twice per iteration (body top + update expression); added notes across `concepts/GAS.md`, `developer-guide/Smart_Contract_Development.md`, `components/vm/CONFIGURATION.md`, `components/vm/OPERATIONS.md`, and `components/vm/ARCHITECTURE.md`.
- `developer-guide/` and `getting-started/Quickstart_Developer.md`: corrected all `sdk.explorer.*` snippets from options-object calling style to positional arguments (`getToken(tick)`, `getBalances(address, opts)`, etc.); rewrote calls to the non-existent `getActions(...)` to real methods.
- Removed the obsolete validator/staking `tier` field from `components/hub/API.md`, `components/sdk/EXAMPLES.md`, `components/sdk/WORKFLOWS.md`, `components/hub/CONFIGURATION.md`, and `components/indexer/DATABASE.md`.
- `components/indexer/DATABASE.md`: corrected the `unstakes` cooldown from hardcoded `block_index + 1000` to `STAKING.COOLDOWN_BLOCKS` (governance-configurable); added a Contract-Staking Tables subsection documenting `contract_stakes`, `contract_unstakes`, and `contract_delegations`.
- `components/encoder/Format_Selection.md`: corrected the documented P2WSH payload capacity from ~9,956 bytes to 8,192 bytes in the table, section heading, and decision flowchart.
- `components/encoder/README.md`: documented the `broadcast_tx` and `get_utxos` JSON-RPC methods, which were always exposed but absent from the API reference.
- `components/indexer/CONFIGURATION.md`: corrected the `FEE_PAYMENT_MODE` entry (previously listed non-existent values); clarified the key is informational only and mode is detected implicitly by `detectFeePaymentMode()`.
- `concepts/GAS.md`: corrected the execution time limit from "100ms CPU" to the real two-tier model (gas exhaustion primary; 30-second wall-clock secondary safety net).
- `components/sync/`: updated README, ARCHITECTURE, OPERATIONS, and CONFIGURATION to reflect decoder DB replication and the `/:dbType/` path namespace (breaking; old paths return 404).
- `concepts/GAS.md` and `developer-guide/Smart_Contract_Development.md`: added missing VM gas constants `VM_CROSS_CHAIN_READ` (100 gas) and `VM_ATTEST_REQUEST` (5,000 gas); corrected `xchain.attestation.request` cost from 500 to 5,500 gas total.

### Added: Five platform initiatives

**1. AI-callable smart contracts (Attestation Framework + LLM provider).** Smart contracts can now ask the outside world a question and get a verified answer back on-chain. A contract calls `xchain.attestation.request(...)`, and the validator network independently fetches the answer from a registered provider, compares results across validators, and writes the agreed-upon response back to the chain, which then re-enters the contract through a callback method. Two providers ship in the initial release: `http_get` (any HTTPS endpoint, exact byte-equality consensus) and `llm` (large-language-model prompt, judge-model semantic consensus across Claude Sonnet 4.6 and Claude Opus 4.7). This is the platform's bridge between blockchain logic and the real world, usable for AI-judged contests, sentiment-gated airdrops, content moderation oracles, price feeds, dispute resolution, and any other real-world data trigger a contract needs.

- `protocol/actions/ATTEST.md`: request (v0), response (v1), and system-synthesized expire (v2) phases
- `protocol/providers/llm.md`: full LLM provider spec including approved models, judge-model consensus, transport options, cost
- `user-guide/Use_Cases.md`: new **AI-Powered Smart Contracts** section
- `developer-guide/Smart_Contract_Development.md`: new sections for the `xchain.attestation.*` VM gateway namespace with worked examples

**2. Contract-targeted staking: multi-chain.** Any token on any chain (Bitcoin, Litecoin, Dogecoin) can now be staked against any smart contract. The contract author declares the staking rules at deploy time (how long the cooldown is, and where slashed tokens go) and the contract's own code decides what staking unlocks and when to slash. This is a general-purpose developer primitive: build prediction markets, security bonds, validator-style services, conditional escrow, or any logic where users back a contract with locked tokens. Coexists with the existing capability-based staking (XCHAIN-only, hub-facing); the two systems share no state.

- `protocol/Contract_Staking.md`: full spec (STAKE v3, UNSTAKE v1, DELEGATE v1, DEPLOY v1 metadata, `xchain.contract.*` VM API)
- `user-guide/Use_Cases.md`: new **Native Multi-Chain Staking** section
- `developer-guide/Smart_Contract_Development.md`: new section for the `xchain.contract.*` VM gateway namespace

**3. Capability-based validator staking.** Replaces the previous tier model. Validators stake XCHAIN and automatically qualify for any of four independent capabilities (`price`, `cross_chain`, `oracle_publish`, `attestation`) based on the amount staked against each. Each capability has its own governance-configurable minimum stake. Validators participate in consensus per capability at block-boundary snapshots.

- `protocol/actions/STAKE.md`, `UNSTAKE.md`, `DELEGATE.md`, `COLLECT.md`: rewritten for the capability model
- `getting-started/What_Is_XChain.md`: staking summary updated

**4. Token-gated encrypted publishing.** A token issuer can now publish a file (or a multi-file pack) on the blockchain, encrypted such that only holders of the gating token can decrypt it. The decryption key is automatically re-encrypted to each new holder during every transfer, end-to-end on-chain, with no third-party server or key escrow. Sell the token via dispenser or order, and the buyer receives the decryption key in the same transaction. Useful for sealed album drops, paid downloads, gated research, holder-only resources, and any "first-access" mechanic.

- `protocol/Token_Gated_Content.md`: full spec including the binary key-handoff payload format
- `protocol/actions/FILE.md`: gating fields (`GATE_TICKER`, `ENCRYPTION_METHOD`, `KEY_HASH`)
- `protocol/actions/MESSAGE.md`: v2 ECIES binary mode for key handoff
- `user-guide/Use_Cases.md`: **Token-Gated Encrypted Content and Packs** section expanded
- `developer-guide/Advanced_Token_Features.md`: new walkthrough

**5. Token-ownership trading.** The issuer role of a token can now be bought and sold on the DEX. New `GIVE_OWNERSHIP` and `GET_OWNERSHIP` flags on `ORDER`, `SWAP`, and `DISPENSER` let a seller advertise the ownership of an entire token issuance, and a buyer purchase it atomically. No off-chain trust required. `SWEEP` was restructured into three independent flags (`BALANCES`, `OWNERSHIPS`, `ESCROWS`) so a holder can sweep just one category at a time.

- `protocol/actions/ORDER.md`, `SWAP.md`, `DISPENSER.md`: ownership-trading flags
- `protocol/actions/SWEEP.md`: three-flag restructure
- `user-guide/Use_Cases.md`: new **Token Ownership Trading** section
- `developer-guide/Advanced_Token_Features.md`: new walkthrough

### Added: Documentation surface

- `protocol/actions/COLLECT.md`: renamed from `CLAIM_REWARDS.md`, consolidated with capability-staking rewards
- `protocol/actions/DEPLOY.md`: `COOLDOWN_BLOCKS` and `SLASH_DESTINATION` fields documented for v1
- `user-guide/FAQ.md`: entries on AI-callable contracts, contract staking vs capability staking, selling encrypted content, and selling issuer rights
- `getting-started/What_Is_XChain.md`: top-level pitch now calls out AI-callable contracts as a platform differentiator
- `components/sync/`: directory renamed from `components/indexer-sync/`; documentation updated for decoder DB replication scope expansion

## [0.10.0] - 2026-04-25

### Added

- `components/wallet/`: full component documentation set for `xchain-wallet`:
  - `README.md`: overview, full feature list, doc index, installation, quick start, four usage modes (web / extension / desktop / dApp integration), repository layout, scripts, dependencies
  - `ARCHITECTURE.md`: three-shell-one-core model, package boundaries, vault & state model, schema migrations, signer interface, build pipelines
  - `Keys_Signing.md`: Argon2id KDF parameters, vault encryption, BIP39 + Counterwallet mnemonic handling, BIP32 HD derivation, the five signers (Software / Trezor / Ledger / Remote / Multisig) in detail, backup / recovery / dry-run-restore, label-sync
  - `SECURITY.md`: protected assets, in-scope and out-of-scope threats, sign-screen safety rails, audit posture, disclosure policy
  - `UX.md`: full route map for all 64 shared routes, onboarding, lock/unlock, Home, Send, Receive, History, sign screens, multisig session view, contacts, QR scanner, command palette, settings
  - `FEATURES.md`: capability-by-capability walk: token issuance, distribution surfaces, DEX, encrypted messaging, smart contracts, BTC staking + delegation, multisig, cross-chain flows, dApp bridge, air-gapped PSBT signing, onboarding & recovery, lock / unlock / auto-lock, i18n + a11y, reproducible builds, URI scheme handling, connected sites, notifications, developer mode
  - `BRIDGE.md`: full `window.xchain` API reference (`connect`, `getAccounts`, `getBalances`, `getSupportedChains`, `signMessage`, `signPsbt`, `signAction`, `sendAction`, `signIn`), events, permissions, error model, test dApp, security model
  - `URI_Schemes.md`: BIP21, chunked PSBT-QR transport, multisig PSBT envelope, animated QR cadence, detect-and-route classifier
  - `MULTISIG.md`: schema, create flow, classical n-of-m + MuSig2 state machines, cosigner transport, hardware-signer status, address browsing
  - `Shell_Extension.md`: Chrome MV3 manifest + audit, service worker, content script, injected provider, approval window, storage, privacy policy + CWS submission
  - `Shell_Desktop.md`: Electron main / renderer split, OS keychain, hardware transports, auto-updater, packaging
  - `Shell_Web.md`: Vite SPA, mobile responsiveness, camera + WebHID, extension-detect banner, CSP, session lifetime
  - `Build_Release.md`: synchronized versioning, extension version-derivation rule, per-shell build, signing, distribution channels, CWS submission, release artifacts, pre-launch readiness gates
  - `Reproducible_Builds.md`: Level-2 reproducibility scope, scaffolding audit, run-twice verification protocol, comparison against maintainer release, common drift sources, roadmap
  - `TESTING.md`: 92-smoke breakdown, audit gates, Playwright E2E, bridge E2E, hardware-signer E2E, multisig coverage, repro-build verification, what's not covered
  - `CONFIGURATION.md`: per-chain endpoints, settings store schema, signer registration, connected sites, build-time variables, developer mode, locale, branding, ADS, schema migrations

### Changed

- `README.md`: added `xchain-wallet` row to the platform Components table; updated the Documentation row's component count from 12 to 13.
- `components/README.md`: added wallet entry to the components index; updated the lead sentence's component count from 12 to 13.

## [0.9.9] - 2026-04-24

### Added
- `protocol/actions/ADDRESS.md`: added `DISPENSER_PREFERENCE` field to format `0` (controls who may open a dispenser: `1`=owner only (default), `2`=anyone); updated examples and noted that a blank field in a subsequent `ADDRESS` action preserves the previous non-blank value.
- `protocol/actions/DISPENSER.md`: explicit rules for who may open a dispenser on a non-`SOURCE` address (`DISPENSER_PREFERENCE=2` or fresh address); `GET_ADDRESS == SOURCE` is always allowed.
- `protocol/actions/DISPENSER.md`: escrow-routing rules for `SWEEP`-driven close (escrow to `SWEEP` `DESTINATION`) and `EXPIRATION` close with no canceller (escrow to `SOURCE`).
- `protocol/actions/DISPENSER.md`: fresh-address dispenser example illustrating the `1FreshAddr...` pattern from a main wallet `SOURCE`.

### Changed
- `protocol/actions/DISPENSER.md`: removed the standalone "no new/empty address limitation" note, superseded by the explicit rules above.

## [0.9.8] - 2026-04-08

### Added
- `protocol/actions/PRICE.md`: full rewrite to match implementation: 12 fiat currencies (36 pairs per round), DOGE_ADDRESS in Tier 3 STAKE format, 24-hour user oracle lock window, publishable on any chain, hub-aggregated `price_snapshots` with `source_chain` column, three-database model architecture, signature aggregation flow
- `protocol/actions/STAKE.md`: Tier 3 (oracle publisher, 500 XCHAIN), DOGE_ADDRESS field with format validation, 6-block activation delay
- `protocol/actions/UNSTAKE.md`: Tier 3 support, two distinct delays (6-block validator removal vs 1000-block token return)
- `protocol/actions/DELEGATE.md`: 6-block activation delay for key rotation
- `protocol/actions/REVOKE_DELEGATION.md`: 6-block deactivation delay with key overlap window
- `protocol/actions/DISPENSER.md`: ORACLE_ADDRESS field for user TOKEN/FIAT oracle pricing, EUR/KRW added to FIAT_CODE list (12 currencies total), dual reverse-matching algorithms (validator and user oracle paths), front-running protection notes
- `protocol/actions/CLAIM_REWARDS.md`: reward sources table, hub-to-indexer reward push path via `pushvalidatorrewards`
- `protocol/actions/README.md`: new "Oracles" section listing PRICE
- `architecture/Database_Design.md`: three-database model (Decoder DB, Indexer DB, local Hub DB) with separation principle and cross-node determinism guarantee
- `components/hub/ARCHITECTURE.md`: PriceAggregator, OraclePublisher, EncoderClient, HubDbBroadcaster source files; Tier 3 publishing pipeline diagram; multi-validator signature aggregation in PBFT prepare/commit; hub DB sync channel REST + WebSocket flow
- `components/hub/DATABASE.md`: `oracle_prices` table schema; `price_snapshots` updated with `source_chain` and `source_action_index` columns
- `components/hub/API.md`: new write methods (`pushchaintip`, `pushpriceround`, `pushoracleprice`); new REST endpoints (`/hub-db/snapshot/price_snapshots`, `/hub-db/snapshot/oracle_prices`); WebSocket channel `/hub-db/subscribe`
- `components/hub/OPERATIONS.md`: startup sequence updated with PriceAggregator, HubDbBroadcaster, OraclePublisher
- `components/indexer/ARCHITECTURE.md`: three DB connections, HubClient, HubDbSync, Ed25519 verification module; indexer-to-hub push endpoint reference
- `components/indexer/ACTIONS.md`: new "Oracles" section for PRICE v0/v1; Tier 3 staking notes; activation delay reference
- `components/indexer/DATABASE.md`: `prices` action table schema; `stakes` updated with `doge_address`, `activation_block`, `deactivation_block`; `delegations` updated with activation/deactivation columns; `validator_rewards` populated via hub push
- `architecture/Component_Map.md`: indexer entry updated for three-database model and hub push endpoints; hub entry updated for hub DB sync channel
- `operations/CONFIGURATION.md`: hub component descriptions updated for PriceAggregator, HubDbBroadcaster, OraclePublisher

## [0.9.7] - 2026-04-07

### Added
- `protocol/actions/DISPENSER.md`: FIAT Dispensers section: reverse price matching algorithm, overpayment/tips handling, dispenser close window behavior, and FIAT dispenser example
- `protocol/actions/PRICE.md`: expanded FIAT Dispenser Grace Period with floor-based matching algorithm details

## [0.9.6] - 2026-04-07

### Changed
- `protocol/actions/MESSAGE.md`: added `COIN` field (BTC, LTC, DOGE) to all MESSAGE formats for cross-chain messaging support
- All SDK messaging documentation and examples updated with required `coin` parameter
- `components/sdk/MESSAGING.md`: added `INVALID_COIN` error code

## [0.9.5] - 2026-04-07

### Added
- `protocol/actions/MESSAGE.md`: new Encryption Methods section with descriptions for ECIES, ECDH, and AES
- `components/sdk/MESSAGING.md`: new reference doc for messaging module: ECIES/ECDH/AES encryption, public key lookup, high-level send/receive, error codes
- `developer-guide/MESSAGING.md`: new developer guide for encrypted messaging with end-to-end examples

### Changed
- `protocol/actions/MESSAGE.md`: reordered encryption methods to 1=ECIES (default), 2=ECDH, 3=AES; updated examples and notes
- `components/sdk/EXAMPLES.md`: added 7 messaging examples: ECIES send, read/decrypt, low-level encrypt/decrypt, ECDH session, AES pre-shared key, public key lookup
- `components/sdk/README.md`: added 3 messaging features to Features list, added MESSAGING.md to Documentation table

## [0.9.4] - 2026-04-07

### Added
- `components/sdk/WALLET.md`: new reference doc for wallet and auth modules: key management, address derivation and validation, challenge-response wallet verification, custom message signing, PSBT signing, transaction broadcasting, UTXO queries, supported networks matrix, full workflow examples

### Changed
- `components/sdk/EXAMPLES.md`: added 10 new wallet/auth examples: Generate a Key Pair, Import a WIF Key, Derive Addresses, Validate an Address, Challenge-Response Wallet Verification, Custom Message Signing, Sign and Broadcast a Transaction, Token-Gated Content Access, Fetch UTXOs
- `components/sdk/README.md`: added 7 wallet/auth features to Features list, added WALLET.md to Documentation table, added 4 new crypto dependencies to Runtime dependencies table
- `components/sdk/ERRORS.md`: added SDKWalletError (14 error codes) and SDKAuthError (5 error codes) to hierarchy, class table, error codes reference, and catching errors example

## [0.9.3] - 2026-04-07

### Changed
- `developer-guide/Integration_Patterns.md`: expanded Pattern 3 (Token-Gated Access) from a basic balance check into a comprehensive guide covering wallet ownership proof, session management, real-time balance invalidation via WebSocket, on-chain gating with example contract, and security considerations.
- `user-guide/Use_Cases.md`: expanded "Access Control and Token-Gated Systems" with concrete content-gating examples, wallet ownership proof, TRANSFER_LOCK guidance, and cross-reference to Integration Patterns.
- `developer-guide/Query_The_Explorer.md`: added cross-reference from token-gated check snippet to the full Integration Patterns guide, fixed typo in comment

## [0.9.2] - 2026-04-06

### Added
- `components/hub/DATABASE.md`: full schema reference for all 13 MariaDB tables organized by category (config, validator, oracle, cross-chain, governance, incentive) with column definitions, types, and keys
- `components/hub/OPERATIONS.md`: prerequisites, startup sequence, operating modes, Docker, multi-instance deployment, API overview, resilience/recovery patterns, troubleshooting guide

### Changed
- `components/hub/README.md`: added test count to features, expanded scripts table with all test commands, added development dependencies section, added links to new DATABASE.md and OPERATIONS.md

## [0.9.1] - 2026-04-06

### Added
- `components/e2e-test/ARCHITECTURE.md`: connector classes, bootstrap sequence, transaction flow, UTXO cache, polling architecture, wallet management, file organization
- `components/e2e-test/CONFIGURATION.md`: all environment variables, hub discovery fallback, internal constants, Docker setup, coin/network combinations
- `components/e2e-test/OPERATIONS.md`: running tests, CI pipeline, regression tiers, Docker execution, troubleshooting tables

### Changed
- `components/e2e-test/README.md`: expanded from minimal stub to full component documentation: features, architecture diagram, test structure tables, configuration overview, test counts
- `developer-guide/TESTING.md`: added E2E Suite column to test type matrix, updated total test count to 5,600+, added e2e-test to component scripts list

## [0.9.0] - 2026-04-06

### Added
- `components/hub/ARCHITECTURE.md`: new file: subsystem design, source files, P2P gossip, PBFT consensus, oracle pipeline, cross-chain engine, governance, rewards/slashing
- `components/hub/CONFIGURATION.md`: new file: all 30+ environment variables, 13 database tables with schemas, connection pool, circuit breaker, validator identity
- `components/hub/API.md`: new file: full JSON-RPC method reference for all 23 methods with request/response examples

### Changed
- `components/hub/README.md`: rewritten for hub v2.0.0: dual operating modes (standalone/validator), full feature list, documentation table, quick start for both modes, service discovery, multi-instance deployment, dependencies
- `components/hub/DECENTRALIZATION.md`: updated: all six phases marked complete with version numbers, removed "planned" language, added architecture summary
- `README.md`: updated hub description to reflect decentralized validator network
- `components/README.md`: hub: "backed by LevelDB" changed to MariaDB with full feature description
- `architecture/Component_Map.md`: hub: LevelDB changed to MariaDB, added full v2.0.0 capabilities, updated connection diagram, multi-instance in deployment table
- `architecture/Database_Design.md`: hub: replaced LevelDB key schema with MariaDB 13-table description
- `concepts/Security_Model.md`: hub: "currently centralized" changed to "hub validator network (PBFT consensus)" in prose and trust model table
- `concepts/CROSS_CHAIN.md`: hub: expanded from two roles to five (config, price oracle, attestation, swap coordinator, governance), removed "planned decentralization" language
- `concepts/README.md`: smart contracts: "Planned" changed to "Programmable contract layer"
- `concepts/Smart_Contracts.md`: VM oracle/cross-chain stubs: "stub until Track B/Phase 4" changed to "pending VM integration"
- `getting-started/Key_Terms.md`: hub: "stores in LevelDB" changed to "backed by MariaDB, PBFT consensus"; LevelDB entry: removed hub reference
- `operations/CONFIGURATION.md`: hub: replaced LevelDB key format with MariaDB config, added 11 key env vars, linked to full hub configuration reference
- `operations/DOCKER.md`: hub: removed from LevelDB volumes section, replaced LevelDB backup with mysqldump
- `operations/UPGRADING.md`: hub: replaced LevelDB backup with mysqldump, fixed startup order (database then hub)
- `user-guide/CROSS_CHAIN.md`: hub: "on a path toward decentralization" changed to "is a decentralized validator network"
- `user-guide/FAQ.md`: hub: "on a path toward decentralization" changed to "decentralized validator network operating via PBFT consensus"

## [0.8.0] - 2026-04-06

### Added
- `components/node/ARCHITECTURE.md`: new file: data pipeline position, internal component diagram, source files table (21 files), precheck workflow, LevelDB key schema, runtime directory structure, Docker network topology
- `components/node/CONFIGURATION.md`: new file: two-layer config file system, generated environment variables (coin-specific and shared service tables), naming conventions, internal constants, validation rules (NODE_PREFIX, port, branch name, container ID)
- `components/node/OPERATIONS.md`: new file: full CLI commands reference (17 commands in 4 categories), global options, parameter values, installation workflow, Docker usage, multi-pane monitoring, bootstrap operations, troubleshooting (8 scenarios)
- `components/regtest-miner/ARCHITECTURE.md`: new file: data pipeline position, internal component diagram, source files table (3 files), mining loop flowchart, wallet lifecycle decision tree, fillMempool process
- `components/regtest-miner/CONFIGURATION.md`: new file: required environment variables (6 vars with validation rules), internal constants (9 constants), timer behavior, exponential backoff formula
- `components/regtest-miner/OPERATIONS.md`: new file: prerequisites, startup sequence, Docker, graceful shutdown, JSON-RPC API (6 endpoints with request/response examples), resilience features, troubleshooting (5 scenarios)

### Changed
- `components/node/README.md`: refactored into multi-file format: moved architecture, configuration, and operations content to dedicated files; added Documentation table linking to ARCHITECTURE.md, CONFIGURATION.md, OPERATIONS.md
- `components/regtest-miner/README.md`: refactored into multi-file format: moved architecture, configuration, and operations content to dedicated files; added Documentation table linking to ARCHITECTURE.md, CONFIGURATION.md, OPERATIONS.md

## [0.7.0] - 2026-04-06

### Changed
- `components/node/README.md`: rewrote from high-level overview to full component documentation: added accurate CLI commands (17 commands), configuration system (two-layer config, 40+ env vars), architecture diagram with source file table (21 files), runtime directory structure, Features (17 items), Scripts (14 npm commands), Dependencies, Quick Start, and Related links; corrected container naming, removed non-existent commands and inaccurate TUI resource monitoring claims.

## [0.6.0] - 2026-04-05

### Changed
- `components/utxo-tracker/README.md`: rewrote from minimal overview to full component documentation: added Features (16 items), Documentation table, Installation, Quick Start, Scripts (20 commands), Dependencies, Related links
- `components/utxo-tracker/ARCHITECTURE.md`: new file: data pipeline position, internal component diagram, source file table, full LevelDB key schema (11 prefix types with byte layouts), key design principles, block processing loop, two-pass transaction processing, concurrent prefetch, batch writes, reorg handling, mempool tracking, balance calculation, bootstrap
- `components/utxo-tracker/CONFIGURATION.md`: new file: environment variables (6 required + 1 optional), supported network values (9 variants), internal constants (polling, block processing, storage, RPC), database paths
- `components/utxo-tracker/OPERATIONS.md`: new file: prerequisites, running, Docker, graceful shutdown, REST API (4 endpoints with response examples), JSON-RPC API (10 methods), resilience (node connection, sync waiting, RPC retries, atomic batches, reorg recovery, mempool errors), troubleshooting (8 scenarios)

## [0.5.0] - 2026-04-05

### Changed
- `components/sync/README.md`: added Input validation and 725 tests to Features, expanded Scripts from 3 to 18 entries, updated Development dependencies with all current packages, added Related Documentation section
- `components/sync/CONFIGURATION.md`: added missing security environment variables: SYNC_API_KEY, HUB_PROTOCOL, TRUST_PROXY (Common), MAX_ROLLBACK_DEPTH, HASH_CONFIRM_STRICT, WS_MAX_PAYLOAD, SNAPSHOT_MAX_CONTENT (Client)
- `components/sync/ARCHITECTURE.md`: added middleware.js and validation.js to Source Files table
- `components/sync/OPERATIONS.md`: added Authentication section documenting Bearer token auth, added GET /schema/:chain/:network endpoint documentation

## [0.4.0] - 2026-04-03

### Changed
- `components/vm/README.md`: updated scripts table with 14 commands covering unit/E2E/fuzz/chaos/regression/mutation/bench, added dev dependencies (fast-check, Stryker), total test count: 974
- `components/vm/OPERATIONS.md`: expanded running tests section with all test commands and 974 total count, added fail-loud regression note
- `developer-guide/TESTING.md`: added xchain-vm as 5th component (974 tests), updated platform total from 3,750+ to 4,700+, added VM column to test type breakdown table, updated fast-check and StrykerJS tool entries to include VM, added VM test scripts link

## [0.3.0] - 2026-04-03

### Changed
- `README.md`: added xchain-vm to components table, updated intro to mention smart contracts/VM/staking, updated ACTION count from 19 to 28, updated component count to 12, updated indexer description to include smart contract execution, updated SDK description with current method/query counts

## [0.2.0] - 2026-04-03

### Changed
- `getting-started/What_Is_XChain.md`: updated for VM and staking: added "Run Smart Contracts" section (DEPLOY, EXECUTE, DEPOSIT, WITHDRAW), "Stake and Validate" section (STAKE, UNSTAKE, DELEGATE, REVOKE_DELEGATION, CLAIM_REWARDS), updated ACTION count from 19 to 28, updated ACTION table, updated developer/researcher descriptions

## [0.1.0] - 2026-04-03

### Added
- Explorer WebSocket API reference (`components/explorer/WEBSOCKET.md`): connection, channels, subscriptions, filters, all event types, error codes, catch-up guide, configuration
- SDK WebSocket client reference (`components/sdk/WEBSOCKET.md`): convenience methods, low-level API, reconnection, hooks, code examples
- Pattern 7: Real-Time State Tracking with WebSocket in `developer-guide/Integration_Patterns.md`
- Step 7b: WebSocket push layer in `architecture/Data_Pipeline.md`
- 4 real-time WebSocket examples in `components/sdk/EXAMPLES.md`

### Changed
- Explorer README, ARCHITECTURE, CONFIGURATION updated with WebSocket sections and env var table
- SDK README, CONFIGURATION updated with WebSocket features, constructor options, and hooks
- Root README updated with WebSocket in explorer and SDK component descriptions

### Added (pre-release)

- `components/sync/README.md`: overview, features, installation, quick start, scripts, dependencies for the new xchain-sync service
- `components/sync/ARCHITECTURE.md`: data pipeline position, dual-mode design, internal components, hub discovery flow, server poll loop, client sync algorithm, hash chain integrity, reorg handling
- `components/sync/CONFIGURATION.md`: environment variables (common, server, client), hub discovery, database naming, connection pool config, circuit breaker
- `components/sync/OPERATIONS.md`: running, Docker, REST API reference (5 endpoints), WebSocket API reference, resilience, troubleshooting (7 scenarios)

### Changed

- `components/vm/CONFIGURATION.md`: added `maxStateKeySize` (1,024 bytes) and `maxBlockCacheSize` (1,000 entries) to constructor example, resource limits table, and bounded execution summary; updated code size enforcement note; updated log entry size to note UTF-8 byte-awareness
- `components/vm/ARCHITECTURE.md`: updated bridge protocol to reflect universal `\x01`+JSON encoding for all returns; added error classification hardening paragraph; updated gas.js, state.js, collector.js component descriptions; added cache bound note
- `components/vm/README.md`: added `maxStateKeySize` and `maxBlockCacheSize` to constructor example; updated state management feature description
- `concepts/Smart_Contracts.md`: added state key size (1 KB per key) to bounded execution table
- `components/README.md`: added sync to component table, updated count to 12
- `README.md`: added xchain-sync to Components table, updated microservice count to 11
- `architecture/Component_Map.md`: added Data Replication service group with xchain-sync section, updated count to 11
- `architecture/Data_Pipeline.md`: updated ASCII pipeline diagram to show sync as a branch off the Indexer DB feeding validator replicas

### Added

- `components/vm/ARCHITECTURE.md`: execution pipeline, internal components table, JSON bridge protocol (prefix encoding, argument serialization, typed error encoding, ExternalCopy limitations), AST-based gas metering (3 phases), sandbox security (stripped/preserved/replaced globals, Function preservation), compilation cache, contract wrapper
- `components/vm/CONFIGURATION.md`: constructor parameters, gas schedule (7 operations), resource limits (7 configurable + 5 hardcoded), bounded execution summary table
- `components/vm/OPERATIONS.md`: prerequisites, installation, indexer integration lifecycle and data flow, error classification (5 types), atomicity guarantees, syntax validation, troubleshooting (7 scenarios)

### Changed

- `components/vm/README.md`: refactored from monolithic doc to lean overview matching indexer/decoder pattern; moved architecture, sandbox, gas metering, compilation cache, and integration details to dedicated ARCHITECTURE/CONFIGURATION/OPERATIONS files; added Documentation table, Features list, Scripts table, Dependencies tables, expanded Related links
- `concepts/Smart_Contracts.md`: fixed Math subset in Deterministic Execution section to match actual sandbox (11 functions + 2 constants); added SharedArrayBuffer, Atomics, queueMicrotask to stripped APIs list; noted Math object is frozen
- `components/indexer/ARCHITECTURE.md`: updated VM ASCII diagram to show "JSON bridge protocol" instead of "ivm.Reference sync callbacks"

### Added

- SDK smart contract documentation: `components/sdk/CONTRACTS.md`: deploy, execute, deposit, withdraw, ContractClient, authoring utilities, explorer methods, transaction vs execution distinction
- VM action entries in `components/sdk/ACTIONS.md`: DEPLOY, EXECUTE, DEPOSIT, WITHDRAW with full parameter tables, notes, code examples, and validation rules
- VM contract examples in `components/sdk/EXAMPLES.md`: deploy, execute, deposit, withdraw, ContractClient usage, authoring utilities
- `SDKContractError` class in `components/sdk/ERRORS.md` with 8 error codes
- 8 contract explorer methods in `components/sdk/EXPLORER.md`: getContract, getContracts, getContractState, getContractBalance, getExecution, getExecutions, getDeposits, getWithdrawals
- EXECUTE, DEPOSIT, WITHDRAW convenience methods in `components/sdk/BATCH.md`

### Changed

- `components/sdk/README.md`: updated from 19 to 23 actions, added contract features to feature list, added CONTRACTS.md to docs table
- `components/sdk/ACTIONS.md`: updated from 19 to 23 actions, added VM field validation rules, added DEPLOY to BATCH constraints
- `components/sdk/BATCH.md`: updated from 17 to 20 convenience methods, added DEPLOY exclusion constraint
- `components/sdk/ERRORS.md`: added SDKContractError to hierarchy, error class table, and catch example

### Added (previous)

- "What Makes This Different" section in `concepts/Smart_Contracts.md`: explains the architectural separation of smart contract logic from protocol logic, comparison with Ethereum's monolithic model, and six concrete benefits (security, audit surface, protocol evolution, simpler development, composability, atomic rollback)
- Smart contract development guide: `developer-guide/Smart_Contract_Development.md`: writing contracts, ES2020 syntax, state patterns (manual index, reverse lookup, JSON), emitting actions, deployment, gas costs, debugging, limitations, vesting example
- VM component documentation: `components/vm/README.md`: architecture, module interface, internal components, AST gas metering, sandbox security, compilation cache, indexer integration
- VM listed in `components/README.md` (10 to 11 components)
- VM Gas section in `concepts/GAS.md`: per-operation gas costs (computation, state read/write, emission), deployment gas, execution gas
- Contract derived addresses section in `concepts/LEDGER.md`: how `C:<CHAIN>:<action_index>` addresses participate in the double-entry ledger
- Hub Staking and Virtual Machine action categories in `concepts/ACTIONS.md` (19 to 28 actions)
- Smart Contract Development link in `developer-guide/README.md`

### Changed

- `concepts/Smart_Contracts.md`: rewrote from "planned" to full implementation reference: gateway API (context, state, emit, math, oracle, cross-chain), deterministic execution, bounded execution, error handling, API versioning, contract format, derived addresses
- `concepts/ACTIONS.md`: updated from 19 to 28 ACTIONs, added Hub Staking and Virtual Machine sections
- `protocol/README.md`: updated action count from 19 to 28
- `protocol/actions/DEPLOY.md`: added syntax validation (V8 + acorn + `__gas` check), derived address creation, constructor execution, `api_version`, float warnings
- `protocol/actions/EXECUTE.md`: added VM execution details, savepoint atomicity, emission routing, 50-action cap, derived address as source
- `protocol/actions/DEPOSIT.md`: updated to derived address model (credits contract's derived address in standard ledger)
- `protocol/actions/WITHDRAW.md`: updated to derived address model (debits derived address, solvency via standard balances)
- `components/indexer/README.md`: updated test count from 958 to 978
- `components/indexer/ACTIONS.md`: updated VM action descriptions with actual implementation details (syntax validation, derived addresses, savepoints, metered gas)
- `components/indexer/ARCHITECTURE.md`: rewrote VM Runtime Module section for actual xchain-vm architecture (AST metering, gateway via ivm.Reference, compilation cache), updated source file table, removed DEPLOY-to-ISSUE alias, removed `contract_balances` from rollback
- `components/indexer/LEDGER.md`: replaced `contract_balances` materialized view section with derived address model
- `components/indexer/DATABASE.md`: updated VM tables with actual schema (contracts with `api_version`, contract_state append-only, contract_emissions execution-to-action links, removed `contract_balances`)

### Removed

- `contract_balances` references from indexer DATABASE.md, LEDGER.md, and ARCHITECTURE.md (contracts use standard `balances` table via derived addresses)
- `DEPLOY-to-ISSUE` alias from ARCHITECTURE.md (DEPLOY is now its own action, not an alias)

### Previously Added

- Comprehensive encoder documentation rewrite: expanded features (13 items), full `create_tx` API reference with parameters/response/error codes, complete configuration table (13 env vars), browser bundle build instructions
- Encoder testing documentation: test scripts, regression suite breakdown, and test helper reference in components/encoder/README.md
- Encoder added to platform test coverage tables in developer-guide/TESTING.md (~769 tests across 10 disciplines)
- Updated platform total from ~2,790 to ~3,750 tests
- StrykerJS noted as used by encoder in testing infrastructure table
- Block hashes concept document: ledger, actions, and contract hash types with source tables, calculation process, chaining, and verification use cases
- Block hashes entry in concepts README index
- Hub staking action specs: STAKE, UNSTAKE, DELEGATE, REVOKE_DELEGATION, CLAIM_REWARDS
- VM action specs: DEPLOY, EXECUTE, DEPOSIT, WITHDRAW
- Hub Staking and Virtual Machine categories in action index README
- Staking and VM actions in indexer ACTIONS reference
- All new table schemas in indexer DATABASE reference (index_pubkeys, staking tables, VM tables, updated fees)
- Unified gas fee schedule documentation in indexer CONFIGURATION
- Contract balances materialized view pattern in indexer LEDGER
- VM runtime module and append-only contract_state in indexer ARCHITECTURE
- Updated protocol quick-reference (claude/PROTOCOL.md) with new actions and staking/VM/fee sections

- COINPAY action specification: protocol/actions/COINPAY.md
- Native coin pair documentation in ORDER action spec (examples, rules)
- COINPAY and COINPAY_EXPIRE in indexer ACTIONS reference
- COIN_DECIMALS and COINPAY_EXPIRATION in indexer CONFIGURATION
- COINPAY action with customOutputs in SDK ACTIONS
- COINPay API endpoints in explorer API reference (coinpays, coinpay_expires, coinpay_obligations)
- COINPay tables in DATABASE_DESIGN architecture doc
- Two-phase settlement model in LEDGER concepts
- COINPay security model in SECURITY_MODEL (late payment, spoofing, reorg)
- Native Coin Pairs section in user-guide TRADING
- COINPAY in DEX action listings (concepts/ACTIONS, protocol/actions/README)
- COINPay obligations in DATA_PIPELINE expiration processing

### Changed

- Move "Documentation Index" section to immediately after "Features" and rename to "Documentation" in explorer, indexer, and SDK component READMEs

## 2026-04-01 (v2.0.0)

### Changed

- **Documentation Restructuring**: Complete reorganization of documentation into a unified, audience-aware structure:
  - Moved `actions/` to `protocol/actions/`
  - Moved `indexer/` to `components/indexer/`
  - Moved `sdk/` to `components/sdk/`
  - Moved `Token_Information_Standard.md` and `Database_Naming_Structure.md` to `protocol/`
  - Moved `json/` to `protocol/json/`
  - Updated all internal cross-references to reflect new paths

### Added

- **Getting Started**: 4 documents: platform introduction (`What_Is_XChain.md`), developer quickstart, node operator quickstart, glossary of 49 terms
- **Core Concepts**: 8 documents: metalayer, ACTIONs, tokens, ledger, encoding, cross-chain, gas, security model
- **Architecture**: 3 documents: end-to-end data pipeline, component map with ASCII diagrams, database design
- **Developer Guide**: 8 tutorials: build your first token, dispensers, explorer queries, cross-chain swaps, advanced token features, batch operations, regtest development, integration patterns
- **User Guide**: 5 documents: token creation, trading, cross-chain, use cases, FAQ (all non-technical)
- **Operations**: 7 documents: deployment, Docker, configuration, monitoring, reorg handling, upgrading, troubleshooting
- **Component Documentation**: Detailed docs for decoder, encoder (+ format selection guide), explorer, hub (+ decentralization roadmap), UTXO tracker, node, e2e-test, regtest-miner
- **Index READMEs**: Navigation pages for all 8 new documentation sections

## 2026-04-01

### Added

- **Indexer Documentation**: 7 documentation files under `indexer/`:
  - `README.md`: Overview, features, installation, quick start, documentation index, scripts, dependencies
  - `ARCHITECTURE.md`: Data pipeline, internal components, action handlers, block processing pipeline
  - `CONFIGURATION.md`: Environment variables, coin-specific config, indexer constants
  - `ACTIONS.md`: All 20 ACTION types with categories, format versions, protocol versioning, linked to action specs
  - `DATABASE.md`: Full schema reference with 60+ tables across core, ledger, action, state, index, and mapping categories
  - `LEDGER.md`: Double-entry ledger system, balance calculation, sanity checks, gas token fees
  - `OPERATIONS.md`: Running, Docker, API endpoints, resilience, troubleshooting

## 2026-03-31

### Added

- **SDK Developer Guide**: 9 documentation files under `sdk/`:
  - `README.md`: Overview, installation, quick-start, usage modes
  - `CONFIGURATION.md`: Constructor options, env vars, hub discovery, retry, pooling, hooks
  - `ACTIONS.md`: All 19 ACTION types with params, validation rules, format versions, examples
  - `EXPLORER.md`: All 40 explorer query methods with pagination and error handling
  - `ENCODER.md`: PSBT generation, encoding types, pre-flight validation, P2SH two-phase
  - `ERRORS.md`: All 7 error classes, 26 error codes, troubleshooting
  - `EXAMPLES.md`: 29 end-to-end code examples
  - `BATCH.md`: BatchBuilder fluent API, constraints, examples
  - `Format_Selection.md`: Format version selection algorithm, version quick-reference
