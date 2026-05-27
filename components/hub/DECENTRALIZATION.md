<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Hub Decentralization

## Overview

xchain-hub has evolved from a centralized config oracle into a fully decentralized validator network across seven implementation phases. Phases 0–5 shipped v1.0.0 → v2.0.0; Phase 6 (capability model + external attestation framework, 2026-05) is the current state.

## Motivation

### Single point of failure

A centralized hub means the entire platform degrades when the hub process crashes or its database becomes unavailable. Services that cannot reach the hub fall back to stale local config or fail their startup checks. Cross-chain swaps stall until the hub recovers.

### Single point of trust

A centralized hub operator controls configuration for all services. In a self-hosted deployment this is acceptable, but it creates a trust assumption that is difficult to remove as the platform grows. A malicious or misconfigured hub could redirect services to wrong endpoints or manipulate pricing data.

### Scalability ceiling

A single-instance hub has limited horizontal scaling options. Under high coordination load (many concurrent cross-chain swaps), the hub becomes a bottleneck.

## Capability Model

The validator network uses a **capability model** rather than fixed tiers. A validator stakes XCHAIN against an Ed25519 signing pubkey; that pubkey's aggregate active stake auto-qualifies it for each of four independent capabilities whose `min_stake` it meets:

| Capability | Role | Default consumers |
|---|---|---|
| `price` | Fetch external prices and sign PBFT-finalized PRICE v0 rounds | PRICE v0 producers — OracleRound, OracleConsensus |
| `cross_chain` | Attest to cross-chain swap actions per chain-pair | CrossChainEngine |
| `oracle_publish` | Broadcast finalized PRICE v0 rounds on-chain (typically DOGE for low fees) | PRICE v0 publisher, formerly "Tier 3" |
| `attestation` | Fetch external attestation requests via registered providers (`http_get`, `llm`) and PBFT-finalize the response | AttestationRound, AttestationConsensus |

A single pubkey can hold any combination of capabilities — there is no overlap restriction. `min_stake[capability]` is governance-configurable; defaults are set by hub config. The historical model where the cross-chain tier required 5× the oracle stake is preserved by appropriate `min_stake` defaults but the protocol does not enforce a hierarchy.

### `price` — Price Oracles

Validators with the `price` capability independently fetch cryptocurrency prices from multiple external sources (CoinGecko, CoinMarketCap), submit them to the network, and reach consensus using a trimmed median algorithm (discard top/bottom 15%). This replaces centralized pricing with a manipulation-resistant oracle feed. Price rounds run on a configurable interval (default 10 minutes). Each round goes through: fetch → submit → collect → aggregate → PBFT finalize.

### `cross_chain` — Cross-Chain Validators

Validators with the `cross_chain` capability attest to cross-chain swap actions. Rather than running full decoder and indexer stacks for every chain, they use **xchain-sync** to replicate indexer + decoder databases, keeping them lightweight. Consensus is calculated per chain-pair — only validators supporting both chains in a swap participate in attestation, using a PBFT-derived consensus requiring 2f+1 agreement.

### `oracle_publish` — PRICE v0 Broadcasters

After a `price` round PBFT-finalizes, a validator with `oracle_publish` broadcasts the signed round on-chain (typically to DOGE for low tx fees). Leader rotation among `oracle_publish`-capable validators is deterministic via `SHA256(round_number || pubkey)` ordering with cascading failover at each subsequent block.

### `attestation` — External Attestation Framework

Validators with `attestation` serve `ATTEST` v0 (request) actions emitted by VM contracts via `xchain.attestation.request(...)`. Responsible-set selection is deterministic via `SHA256(request_id || pubkey)` ordering; the top `redundancy` validators fetch from the named provider (`http_get` or `llm`) and reach PBFT consensus on the response. Two consensus strategies are supported: `byte_equality` (all responses must be identical, used by `http_get`) and `judge_model` (an LLM judges semantic equivalence, used by `llm`). The signed bundle is submitted on-chain as `ATTEST` v1 (response), which fires the requesting contract's callback EXECUTE.

### Block-boundary snapshots

Every PBFT engine (config, oracle, attestation, cross-chain) locks its quorum at a specific `block_index` via `CapabilitySnapshot.getSnapshot(capability, block_index)`. This queries the indexer's `getcapabilityvalidators` RPC (60s cache) so every hub in the federation sees the same qualified set even as stake drifts mid-round. Self-tests are local to each hub — a failed self-test means the validator skips the round but is still counted in N (laggards get slashed for non-participation).

## Staking and Governance

All staking operations (STAKE, UNSTAKE, DELEGATE, COLLECT) are standard XChain actions on the BTC chain, processed by the indexer. STAKE comes in two semantic versions (`VERSION=1` new stake, `VERSION=2` top-up of an existing pubkey); both wire to `VERSION|AMOUNT|SIGNING_PUBKEY`. Active stake for a pubkey is `SUM(amount)` across rows where `activation_block ≤ now < COALESCE(deactivation_block, +∞)`.

| Property | Value |
|---|---|
| Slashing | Stake can be slashed for: price deviation >5%, repeated deviations (3+ in 24h), non-participation (30+ missed rounds), attestation divergence on `byte_equality` providers. Adjudicated via governance vote. |
| Activation delay | 6 BTC blocks (~1 hour) — protects against ≤5-block reorgs |
| Deactivation delay | 6 BTC blocks on UNSTAKE (same reorg safety) |
| Cooldown | 1000 BTC blocks before staked XCHAIN returns to source (configurable via `STAKING.COOLDOWN_BLOCKS`) |
| Delegation | Token holders can delegate stake to existing validators |
| Rewards | Proportional to stake and participation per capability. A pubkey holding both `price` and `oracle_publish` earns both per-round (consensus + broadcast). |

## Decentralized Roles

| Hub Role | Decentralized Mechanism |
|---|---|
| **Configuration** | PBFT consensus for config writes across validator set; quorum locked at block boundary via CapabilitySnapshot |
| **Service discovery** | Hub config store, polled by all platform services |
| **Price data** | `price`-capable validators with trimmed median consensus; published on-chain by `oracle_publish`-capable validators |
| **Cross-chain coordination** | `cross_chain`-capable validator attestation with per-chain-pair PBFT |
| **External attestation** | `attestation`-capable validators fetch from registered providers (`http_get`, `llm`) and PBFT-finalize; result submitted on-chain as `ATTEST` v1 (response) |
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
| 6 | **Capability model + external attestation framework** — Replace Tier 1/2 with four independent capabilities (`price`, `cross_chain`, `oracle_publish`, `attestation`) auto-qualified by stake amount; block-boundary federation snapshots; external attestation framework (`http_get` byte_equality + `llm` judge_model providers); STAKE rewritten as `VERSION|AMOUNT|SIGNING_PUBKEY` with v1=new / v2=top-up; UNSTAKE rewritten as pubkey-based | 2026-05 | Complete |

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
