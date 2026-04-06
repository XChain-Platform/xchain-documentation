<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Hub Decentralization

## Current State

xchain-hub is a centralized service. All other services in the platform depend on it for configuration discovery, pricing data, and cross-chain swap coordination. A single hub instance holds the authoritative key-value store for the entire deployment.

This design is operationally convenient — configuration changes propagate to all services without restarts, and cross-chain coordination has a single integration point. However, it introduces a single point of trust and a single point of failure.

## Why Decentralize

### Single point of failure

If the hub process crashes or its database becomes unavailable, the entire platform degrades. Services that cannot reach the hub fall back to stale local config or fail their startup checks. Cross-chain swaps stall until the hub recovers.

### Single point of trust

The hub operator controls configuration for all services. In a self-hosted deployment this is acceptable, but it creates a trust assumption that is difficult to remove as the platform grows. A malicious or misconfigured hub could redirect services to wrong endpoints or manipulate pricing data.

### Scalability ceiling

A single-instance hub has limited horizontal scaling options. Under high coordination load (many concurrent cross-chain swaps), the hub becomes a bottleneck.

## Planned Architecture

The hub will evolve from a single service into a **validator network** with staking-based incentives and Byzantine fault tolerance. Validators stake XCHAIN tokens (on the BTC chain) and participate in consensus to provide decentralized price feeds and cross-chain coordination.

### Two-Tier Validator System

The validator network is organized into two independent tiers, each with its own stake requirement:

**Tier 1 — Price Oracles**

Validators independently fetch cryptocurrency prices from multiple external sources (minimum 3 APIs each), submit them to the network, and reach consensus using a weighted trimmed median algorithm. This replaces the hub's centralized pricing with a manipulation-resistant oracle feed. Stake-weighted consensus ensures that moving the price requires controlling a majority of staked value, not just a single source.

Price rounds are anchored to block heights rather than wall clocks, eliminating clock synchronization issues. The round interval (initially 10 minutes) is governance-adjustable.

**Tier 2 — Cross-Chain Validators**

A higher-stake tier (5x the oracle stake) responsible for attesting to cross-chain swap actions. Rather than running full decoder and indexer stacks for every chain, Tier 2 validators use a new **xchain-indexer-sync** service to replicate indexer databases, keeping them lightweight.

Cross-chain validators declare which chains they support (minimum 2) at registration time. Consensus is calculated per chain-pair — only validators supporting both chains in a swap participate in attestation, using a PBFT-derived consensus requiring 2/3+ agreement.

### Staking and Governance

All staking operations (STAKE, UNSTAKE, DELEGATE, REVOKE_DELEGATION, CLAIM_REWARDS) are standard XChain actions on the BTC chain. Validators can participate in one or both tiers.

Key properties of the staking system:

- **Slashing** — Validators that submit manipulated prices or false cross-chain attestations can have stake slashed via a governance vote among active validators
- **Lock periods** — Unstaking requires a mandatory lock period (14 days for oracle, 30 days for cross-chain) to prevent front-running of slashing proposals
- **Delegation** — Token holders who don't want to run a validator can delegate their stake to an existing validator
- **Rewards** — Validators earn rewards from a protocol fee pool proportional to their stake and participation

### Decentralizing Each Hub Role

| Current Hub Role | Decentralized Replacement |
|---|---|
| **Configuration** | On-chain BROADCAST actions — auditable, tamper-evident, no central authority |
| **Service discovery** | DNS-based resolution in Docker/Kubernetes, or on-chain BROADCAST records |
| **Price data** | Tier 1 validator oracle network with weighted trimmed median consensus |
| **Cross-chain coordination** | Tier 2 validator attestation network with PBFT consensus |

### Implementation Phases

The decentralization is planned across six phases:

| Phase | Name | Status |
|---|---|---|
| 0 | **MariaDB migration** — Replace LevelDB with MariaDB | **Complete** |
| 1 | **Multi-instance hub** — Run multiple hub instances against shared MariaDB for reliability; consumer fallback via `HUB_VALIDATORS` | **Complete** |
| 2 | **Gossip + PBFT consensus for config** — P2P gossip layer, PBFT consensus for config writes | Planned |
| 3 | **Decentralized price oracle** — Tier 1 staking, price round system, slashing | Planned |
| 4 | **Cross-chain coordination** — xchain-indexer-sync, Tier 2 staking, PBFT attestation | Planned |
| 5 | **Open validator set + governance** — Permissionless participation, on-chain governance | Planned |

## Status

**Phase 0 (MariaDB migration) is complete.** The hub now stores all configuration in MariaDB (`XChain_Hub` database, `configs` table) with connection pooling, circuit breaker, and auto-table-creation. The JSON-RPC API is unchanged — consumers see no difference.

Phase 1 (multi-instance) is next. The full strategic architecture plan, including detailed algorithms, economic models, slashing conditions, and implementation specifics, is available in `claude/reports/XCHAIN_HUB_BUILD_PLAN.md`.

## Related

- [Hub](README.md) — current hub architecture and API reference
- [Cross-Chain Concepts](../../concepts/CROSS_CHAIN.md) — how cross-chain swaps work at the protocol level
- [Gas Token](../../concepts/GAS.md) — the XCHAIN token used for staking and fees

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
