# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-04-06

### Changed
- `components/node/README.md` — rewrote from high-level overview to full component documentation matching regtest-miner/decoder pattern: added accurate CLI commands (17 commands with syntax), configuration system (two-layer config, 40+ env vars, naming conventions, internal constants), architecture diagram with source file table (21 files), runtime directory structure, Features (17 items), Scripts (14 npm commands), Dependencies (Runtime + Development), Quick Start, Related links; corrected container naming pattern, removed non-existent commands, removed inaccurate TUI resource monitoring claims

## [0.6.0] - 2026-04-05

### Changed
- `components/utxo-tracker/README.md` — rewrote from minimal overview to full component documentation matching indexer/decoder pattern: added Features (16 items), Documentation table, Installation, Quick Start with startup sequence, Scripts (20 commands), Dependencies (Runtime + Development), Related links
- `components/utxo-tracker/ARCHITECTURE.md` — new file: data pipeline position, internal component diagram, source file table, full LevelDB key schema (11 prefix types with byte layouts), key design principles, block processing loop, two-pass transaction processing, concurrent prefetch, batch writes, reorg handling, mempool tracking, balance calculation, bootstrap
- `components/utxo-tracker/CONFIGURATION.md` — new file: environment variables (6 required + 1 optional), supported network values (9 variants), internal constants (polling, block processing, storage, RPC), database paths
- `components/utxo-tracker/OPERATIONS.md` — new file: prerequisites, running, Docker, graceful shutdown, REST API (4 endpoints with response examples), JSON-RPC API (10 methods), resilience (node connection, sync waiting, RPC retries, atomic batches, reorg recovery, mempool errors), troubleshooting (8 scenarios)

## [0.5.0] - 2026-04-05

### Changed
- `components/indexer-sync/README.md` — added Input validation and 725 tests to Features, expanded Scripts from 3 to 18 entries, updated Development dependencies with all current packages, added Related Documentation section
- `components/indexer-sync/CONFIGURATION.md` — added missing security environment variables: SYNC_API_KEY, HUB_PROTOCOL, TRUST_PROXY (Common), MAX_ROLLBACK_DEPTH, HASH_CONFIRM_STRICT, WS_MAX_PAYLOAD, SNAPSHOT_MAX_CONTENT (Client)
- `components/indexer-sync/ARCHITECTURE.md` — added middleware.js and validation.js to Source Files table
- `components/indexer-sync/OPERATIONS.md` — added Authentication section documenting Bearer token auth, added GET /schema/:chain/:network endpoint documentation

## [0.4.0] - 2026-04-03

### Changed
- `components/vm/README.md` — updated scripts table with 14 commands covering unit/E2E/fuzz/chaos/regression/mutation/bench, added dev dependencies (fast-check, Stryker), total test count: 974
- `components/vm/OPERATIONS.md` — expanded running tests section with all test commands and 974 total count, added fail-loud regression note
- `developer-guide/TESTING.md` — added xchain-vm as 5th component (974 tests), updated platform total from 3,750+ to 4,700+, added VM column to test type breakdown table, updated fast-check and StrykerJS tool entries to include VM, added VM test scripts link

## [0.3.0] - 2026-04-03

### Changed
- `README.md` — added xchain-vm to components table, updated intro to mention smart contracts/VM/staking, updated ACTION count from 19 to 28, updated component count to 12, updated indexer description to include smart contract execution, updated SDK description with current method/query counts

## [0.2.0] - 2026-04-03

### Changed
- `getting-started/WHAT_IS_XCHAIN.md` — updated for VM and staking: added "Run Smart Contracts" section (DEPLOY, EXECUTE, DEPOSIT, WITHDRAW), "Stake and Validate" section (STAKE, UNSTAKE, DELEGATE, REVOKE_DELEGATION, CLAIM_REWARDS), updated ACTION count from 19 to 28, updated ACTION table, updated developer/researcher descriptions

## [0.1.0] - 2026-04-03

### Added
- Explorer WebSocket API reference (`components/explorer/WEBSOCKET.md`): connection, channels, subscriptions, filters, all event types, error codes, catch-up guide, configuration
- SDK WebSocket client reference (`components/sdk/WEBSOCKET.md`): convenience methods, low-level API, reconnection, hooks, code examples
- Pattern 7: Real-Time State Tracking with WebSocket in `developer-guide/INTEGRATION_PATTERNS.md`
- Step 7b: WebSocket push layer in `architecture/DATA_PIPELINE.md`
- 4 real-time WebSocket examples in `components/sdk/EXAMPLES.md`

### Changed
- Explorer README, ARCHITECTURE, CONFIGURATION updated with WebSocket sections and env var table
- SDK README, CONFIGURATION updated with WebSocket features, constructor options, and hooks
- Root README updated with WebSocket in explorer and SDK component descriptions

### Added (pre-release)

- `components/indexer-sync/README.md` — overview, features, installation, quick start, scripts, dependencies for the new xchain-indexer-sync service
- `components/indexer-sync/ARCHITECTURE.md` — data pipeline position, dual-mode design, internal components, hub discovery flow, server poll loop, client sync algorithm, hash chain integrity, reorg handling
- `components/indexer-sync/CONFIGURATION.md` — environment variables (common, server, client), hub discovery, database naming, connection pool config, circuit breaker
- `components/indexer-sync/OPERATIONS.md` — running, Docker, REST API reference (5 endpoints), WebSocket API reference, resilience, troubleshooting (7 scenarios)

### Changed

- `components/vm/CONFIGURATION.md` — added `maxStateKeySize` (1,024 bytes) and `maxBlockCacheSize` (1,000 entries) to constructor example, resource limits table, and bounded execution summary; updated code size enforcement note; updated log entry size to note UTF-8 byte-awareness
- `components/vm/ARCHITECTURE.md` — updated bridge protocol to reflect universal `\x01`+JSON encoding for all returns; added error classification hardening paragraph; updated gas.js, state.js, collector.js component descriptions; added cache bound note
- `components/vm/README.md` — added `maxStateKeySize` and `maxBlockCacheSize` to constructor example; updated state management feature description
- `concepts/SMART_CONTRACTS.md` — added state key size (1 KB per key) to bounded execution table
- `components/README.md` — added indexer-sync to component table, updated count to 12
- `README.md` — added xchain-indexer-sync to Components table, updated microservice count to 11
- `architecture/COMPONENT_MAP.md` — added Data Replication service group with xchain-indexer-sync section, updated count to 11
- `architecture/DATA_PIPELINE.md` — updated ASCII pipeline diagram to show indexer-sync as a branch off the Indexer DB feeding validator replicas

### Added

- `components/vm/ARCHITECTURE.md` — execution pipeline, internal components table, JSON bridge protocol (prefix encoding, argument serialization, typed error encoding, ExternalCopy limitations), AST-based gas metering (3 phases), sandbox security (stripped/preserved/replaced globals, Function preservation), compilation cache, contract wrapper
- `components/vm/CONFIGURATION.md` — constructor parameters, gas schedule (7 operations), resource limits (7 configurable + 5 hardcoded), bounded execution summary table
- `components/vm/OPERATIONS.md` — prerequisites, installation, indexer integration lifecycle and data flow, error classification (5 types), atomicity guarantees, syntax validation, troubleshooting (7 scenarios)

### Changed

- `components/vm/README.md` — refactored from monolithic doc to lean overview matching indexer/decoder pattern; moved architecture, sandbox, gas metering, compilation cache, and integration details to dedicated ARCHITECTURE/CONFIGURATION/OPERATIONS files; added Documentation table, Features list, Scripts table, Dependencies tables, expanded Related links
- `concepts/SMART_CONTRACTS.md` — fixed Math subset in Deterministic Execution section to match actual sandbox (11 functions + 2 constants); added SharedArrayBuffer, Atomics, queueMicrotask to stripped APIs list; noted Math object is frozen
- `components/indexer/ARCHITECTURE.md` — updated VM ASCII diagram to show "JSON bridge protocol" instead of "ivm.Reference sync callbacks"

### Added

- SDK smart contract documentation: `components/sdk/CONTRACTS.md` — deploy, execute, deposit, withdraw, ContractClient, authoring utilities, explorer methods, transaction vs execution distinction
- VM action entries in `components/sdk/ACTIONS.md`: DEPLOY, EXECUTE, DEPOSIT, WITHDRAW with full parameter tables, notes, code examples, and validation rules
- VM contract examples in `components/sdk/EXAMPLES.md`: deploy, execute, deposit, withdraw, ContractClient usage, authoring utilities
- `SDKContractError` class in `components/sdk/ERRORS.md` with 8 error codes
- 8 contract explorer methods in `components/sdk/EXPLORER.md`: getContract, getContracts, getContractState, getContractBalance, getExecution, getExecutions, getDeposits, getWithdrawals
- EXECUTE, DEPOSIT, WITHDRAW convenience methods in `components/sdk/BATCH.md`

### Changed

- `components/sdk/README.md` — updated from 19 to 23 actions, added contract features to feature list, added CONTRACTS.md to docs table
- `components/sdk/ACTIONS.md` — updated from 19 to 23 actions, added VM field validation rules, added DEPLOY to BATCH constraints
- `components/sdk/BATCH.md` — updated from 17 to 20 convenience methods, added DEPLOY exclusion constraint
- `components/sdk/ERRORS.md` — added SDKContractError to hierarchy, error class table, and catch example

### Added (previous)

- "What Makes This Different" section in `concepts/SMART_CONTRACTS.md` — explains the architectural separation of smart contract logic from protocol logic, comparison with Ethereum's monolithic model, and six concrete benefits (security, audit surface, protocol evolution, simpler development, composability, atomic rollback)
- Smart contract development guide: `developer-guide/SMART_CONTRACT_DEVELOPMENT.md` — writing contracts, ES2020 syntax, state patterns (manual index, reverse lookup, JSON), emitting actions, deployment, gas costs, debugging, limitations, vesting example
- VM component documentation: `components/vm/README.md` — architecture, module interface, internal components, AST gas metering, sandbox security, compilation cache, indexer integration
- VM listed in `components/README.md` (10 → 11 components)
- VM Gas section in `concepts/GAS.md` — per-operation gas costs (computation, state read/write, emission), deployment gas, execution gas
- Contract derived addresses section in `concepts/LEDGER.md` — how `C:<CHAIN>:<action_index>` addresses participate in the double-entry ledger
- Hub Staking and Virtual Machine action categories in `concepts/ACTIONS.md` (19 → 28 actions)
- Smart Contract Development link in `developer-guide/README.md`

### Changed

- `concepts/SMART_CONTRACTS.md` — rewrote from "planned" to full implementation reference: gateway API (context, state, emit, math, oracle, cross-chain), deterministic execution, bounded execution, error handling, API versioning, contract format, derived addresses
- `concepts/ACTIONS.md` — updated from 19 to 28 ACTIONs, added Hub Staking and Virtual Machine sections
- `protocol/README.md` — updated action count from 19 to 28
- `protocol/actions/DEPLOY.md` — added syntax validation (V8 + acorn + `__gas` check), derived address creation, constructor execution, `api_version`, float warnings
- `protocol/actions/EXECUTE.md` — added VM execution details, savepoint atomicity, emission routing, 50-action cap, derived address as source
- `protocol/actions/DEPOSIT.md` — updated to derived address model (credits contract's derived address in standard ledger)
- `protocol/actions/WITHDRAW.md` — updated to derived address model (debits derived address, solvency via standard balances)
- `components/indexer/README.md` — updated test count from 958 to 978
- `components/indexer/ACTIONS.md` — updated VM action descriptions with actual implementation details (syntax validation, derived addresses, savepoints, metered gas)
- `components/indexer/ARCHITECTURE.md` — rewrote VM Runtime Module section for actual xchain-vm architecture (AST metering, gateway via ivm.Reference, compilation cache), updated source file table, removed DEPLOY→ISSUE alias, removed `contract_balances` from rollback
- `components/indexer/LEDGER.md` — replaced `contract_balances` materialized view section with derived address model
- `components/indexer/DATABASE.md` — updated VM tables with actual schema (contracts with `api_version`, contract_state append-only, contract_emissions execution→action links, removed `contract_balances`)

### Removed

- `contract_balances` references from indexer DATABASE.md, LEDGER.md, and ARCHITECTURE.md (contracts use standard `balances` table via derived addresses)
- `DEPLOY→ISSUE` alias from ARCHITECTURE.md (DEPLOY is now its own action, not an alias)

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

- **Documentation Restructuring** — Complete reorganization of documentation into a unified, audience-aware structure:
  - Moved `actions/` → `protocol/actions/`
  - Moved `indexer/` → `components/indexer/`
  - Moved `sdk/` → `components/sdk/`
  - Moved `Token_Information_Standard.md` and `Database_Naming_Structure.md` → `protocol/`
  - Moved `json/` → `protocol/json/`
  - Updated all internal cross-references to reflect new paths

### Added

- **Getting Started** — 4 documents: platform introduction (`WHAT_IS_XCHAIN.md`), developer quickstart, node operator quickstart, glossary of 49 terms
- **Core Concepts** — 8 documents: metalayer, ACTIONs, tokens, ledger, encoding, cross-chain, gas, security model
- **Architecture** — 3 documents: end-to-end data pipeline, component map with ASCII diagrams, database design
- **Developer Guide** — 8 tutorials: build your first token, dispensers, explorer queries, cross-chain swaps, advanced token features, batch operations, regtest development, integration patterns
- **User Guide** — 5 documents: token creation, trading, cross-chain, use cases, FAQ — all non-technical
- **Operations** — 7 documents: deployment, Docker, configuration, monitoring, reorg handling, upgrading, troubleshooting
- **Component Documentation** — Detailed docs for decoder, encoder (+ format selection guide), explorer, hub (+ decentralization roadmap), UTXO tracker, node, e2e-test, regtest-miner
- **Index READMEs** — Navigation pages for all 8 new documentation sections

## 2026-04-01

### Added

- **Indexer Documentation** — 7 documentation files under `indexer/`:
  - `README.md` — Overview, features, installation, quick start, documentation index, scripts, dependencies
  - `ARCHITECTURE.md` — Data pipeline, internal components, action handlers, block processing pipeline
  - `CONFIGURATION.md` — Environment variables, coin-specific config, indexer constants
  - `ACTIONS.md` — All 20 ACTION types with categories, format versions, protocol versioning, linked to action specs
  - `DATABASE.md` — Full schema reference with 60+ tables across core, ledger, action, state, index, and mapping categories
  - `LEDGER.md` — Double-entry ledger system, balance calculation, sanity checks, gas token fees
  - `OPERATIONS.md` — Running, Docker, API endpoints, resilience, troubleshooting

## 2026-03-31

### Added

- **SDK Developer Guide** — 9 documentation files under `sdk/`:
  - `README.md` — Overview, installation, quick-start, usage modes
  - `CONFIGURATION.md` — Constructor options, env vars, hub discovery, retry, pooling, hooks
  - `ACTIONS.md` — All 19 ACTION types with params, validation rules, format versions, examples
  - `EXPLORER.md` — All 40 explorer query methods with pagination and error handling
  - `ENCODER.md` — PSBT generation, encoding types, pre-flight validation, P2SH two-phase
  - `ERRORS.md` — All 7 error classes, 26 error codes, troubleshooting
  - `EXAMPLES.md` — 29 end-to-end code examples
  - `BATCH.md` — BatchBuilder fluent API, constraints, examples
  - `FORMAT_SELECTION.md` — Format version selection algorithm, version quick-reference
