<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Hub Decentralization

## Overview

xchain-hub has evolved from a centralized config oracle into a fully decentralized validator network across six implementation phases. All phases are complete as of v2.0.0.

## Motivation

### Single point of failure

A centralized hub means the entire platform degrades when the hub process crashes or its database becomes unavailable. Services that cannot reach the hub fall back to stale local config or fail their startup checks. Cross-chain swaps stall until the hub recovers.

### Single point of trust

A centralized hub operator controls configuration for all services. In a self-hosted deployment this is acceptable, but it creates a trust assumption that is difficult to remove as the platform grows. A malicious or misconfigured hub could redirect services to wrong endpoints or manipulate pricing data.

### Scalability ceiling

A single-instance hub has limited horizontal scaling options. Under high coordination load (many concurrent cross-chain swaps), the hub becomes a bottleneck.

## Two-Tier Validator System

The validator network is organized into two independent tiers, each with its own stake requirement:

### Tier 1 — Price Oracles

Validators independently fetch cryptocurrency prices from multiple external sources (CoinGecko, CoinMarketCap), submit them to the network, and reach consensus using a trimmed median algorithm (discard top/bottom 15%). This replaces centralized pricing with a manipulation-resistant oracle feed.

Price rounds run on a configurable interval (default 10 minutes). Each round goes through: fetch → submit → collect → aggregate → PBFT finalize.

### Tier 2 — Cross-Chain Validators

A higher-stake tier (5x the oracle stake) responsible for attesting to cross-chain swap actions. Rather than running full decoder and indexer stacks for every chain, Tier 2 validators use **xchain-indexer-sync** to replicate indexer databases, keeping them lightweight.

Cross-chain validators declare which chains they support at registration time. Consensus is calculated per chain-pair — only validators supporting both chains in a swap participate in attestation, using a PBFT-derived consensus requiring 2/3+ agreement.

## Staking and Governance

All staking operations (STAKE, UNSTAKE, DELEGATE, REVOKE_DELEGATION, CLAIM_REWARDS) are standard XChain actions on the BTC chain, processed by the indexer.

| Property | Value |
|---|---|
| Slashing | Validators submitting manipulated prices or false attestations can have stake slashed via governance vote |
| Lock periods | 14 days for oracle tier, 30 days for cross-chain tier |
| Delegation | Token holders can delegate stake to existing validators |
| Rewards | Proportional to stake and participation, from protocol fee pool |

## Decentralized Roles

| Hub Role | Decentralized Mechanism |
|---|---|
| **Configuration** | PBFT consensus for config writes across validator set |
| **Service discovery** | Hub config store, polled by all platform services |
| **Price data** | Tier 1 validator oracle with trimmed median consensus |
| **Cross-chain coordination** | Tier 2 validator attestation with per-chain-pair PBFT |
| **Governance** | Off-chain PBFT voting with 7-day period, 2/3+ approval |

## Implementation Phases

| Phase | Name | Version | Status |
|---|---|---|---|
| 0 | **MariaDB migration** — Replace LevelDB with MariaDB | v1.0.0 | Complete |
| 1 | **Multi-instance hub** — Run multiple instances against shared MariaDB; consumer fallback via `HUB_VALIDATORS` | v1.0.0 | Complete |
| 2 | **Gossip + PBFT consensus** — P2P gossip layer (WebSocket), PBFT consensus for config writes, Ed25519 validator identity, leader rotation, view change | v1.1.0–v1.3.0 | Complete |
| 3 | **Decentralized price oracle** — External price fetching, trimmed median aggregation, oracle PBFT consensus, price snapshots, reward tracking, slash detection, fee quotes | v1.4.0–v1.6.0 | Complete |
| 4 | **Cross-chain coordination** — Attestation engine, reorg propagation, SWAP lifecycle tracking, per-chain-pair validator filtering | v1.7.0–v1.9.0 | Complete |
| 5 | **Open validator set + governance** — Off-chain PBFT voting for parameter changes, version signaling in heartbeats | v2.0.0 | Complete |

## Architecture Summary

```
                    +-------------------+
                    |   External APIs   |
                    | (CoinGecko, CMC)  |
                    +--------+----------+
                             |
              +--------------v--------------+
              |        Validator A           |
              |  PriceFetcher -> OracleRound |
              |  PeerManager <-> Consensus   |
              |  CrossChainEngine            |
              |  ReorgHandler                |
              |  Governance                  |
              |  RewardTracker               |
              |  SlashDetector               |
              +----+----+----+--------------+
                   |    |    |
          gossip   |    |    |   gossip
                   |    |    |
              +----v----v----v--------------+
              |        Validator B           |
              |        (same stack)          |
              +----+----+----+--------------+
                   |    |    |
                   |    |    |
              +----v----v----v--------------+
              |        Validator C           |
              |        (same stack)          |
              +-----------------------------+
```

Each validator runs the full hub stack. Communication happens via WebSocket-based P2P gossip with Ed25519-signed messages. All consensus decisions require 2f+1 agreement.

## Related

- [Hub](README.md) — hub architecture and API reference
- [Architecture](ARCHITECTURE.md) — internal subsystem design
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
