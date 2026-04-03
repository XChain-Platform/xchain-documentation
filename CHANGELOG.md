# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Smart contract development guide: `developer-guide/SMART_CONTRACT_DEVELOPMENT.md` — writing contracts, ES2020 syntax, state patterns (manual index, reverse lookup, JSON), emitting actions, deployment, gas costs, debugging, limitations, vesting example
- VM component documentation: `components/vm/README.md` — architecture, module interface, internal components, AST gas metering, sandbox security, compilation cache, indexer integration
- VM listed in `components/README.md` (10 → 11 components)
- VM Gas section in `concepts/GAS.md` — per-operation gas costs (computation, state read/write, emission), deployment gas, execution gas
- Contract derived addresses section in `concepts/LEDGER.md` — how `C:<CHAIN>:<action_index>` addresses participate in the double-entry ledger

### Changed

- `concepts/SMART_CONTRACTS.md` — rewrote from "planned" to full implementation reference: gateway API (context, state, emit, math, oracle, cross-chain), deterministic execution, bounded execution, error handling, API versioning, contract format, derived addresses
- `protocol/actions/DEPLOY.md` — added syntax validation (V8 + acorn + `__gas` check), derived address creation, constructor execution, `api_version`, float warnings
- `protocol/actions/EXECUTE.md` — added VM execution details, savepoint atomicity, emission routing, 50-action cap, derived address as source
- `protocol/actions/DEPOSIT.md` — updated to derived address model (credits contract's derived address in standard ledger)
- `protocol/actions/WITHDRAW.md` — updated to derived address model (debits derived address, solvency via standard balances)
- `components/indexer/DATABASE.md` — updated VM tables with actual schema (contracts with `api_version`, contract_state append-only, contract_emissions execution→action links, removed `contract_balances`)

### Removed

- `contract_balances` table reference from indexer DATABASE.md (contracts use standard `balances` table via derived addresses)

### Previously Added

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
