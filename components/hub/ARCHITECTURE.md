<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Hub — Architecture

## Position in the Data Pipeline

```
Coin Node (bitcoind / litecoind / dogecoind)
    |  JSON-RPC
    v
xchain-decoder  ->  Decoder DB (MariaDB)
    |
    v
xchain-indexer  ->  Indexer DB (MariaDB)
    |                    |
    v                    v
xchain-explorer     xchain-indexer-sync  ->  Validator replicas
                         ^
                         |
                    xchain-hub  <-->  P2P Validator Network
                         |
                    - Config oracle (all services poll)
                    - Price oracle (CoinGecko, CoinMarketCap)
                    - Cross-chain attestation
                    - SWAP lifecycle tracking
                    - Reorg propagation
                    - Governance
```

The hub sits at the center of the platform. All other services depend on it for configuration discovery. In validator mode, it also serves as the decentralized coordination layer for pricing, cross-chain operations, and governance.

## Operating Modes

```
STANDALONE MODE                          VALIDATOR MODE
(P2P_VALIDATOR_ADDR not set)             (P2P_VALIDATOR_ADDR set)

+---------------------------+            +---------------------------+
|        xchain-hub         |            |        xchain-hub         |
|                           |            |                           |
|  +---------------------+ |            |  +---------------------+ |
|  |      api.js          | |            |  |      api.js          | |
|  |  Express + JSON-RPC  | |            |  |  Express + JSON-RPC  | |
|  +----------+-----------+ |            |  +----------+-----------+ |
|             |             |            |             |             |
|  +----------v-----------+ |            |  +----------v-----------+ |
|  |    XChainHub          | |            |  |    XChainHub          | |
|  |  (orchestrator)       | |            |  |  (orchestrator)       | |
|  +----------+-----------+ |            |  +----------+-----------+ |
|             |             |            |             |             |
|  +----------v-----------+ |            |  +----------v-----------+ |
|  |      db.js            | |            |  |  PeerManager          | |
|  |  MariaDB pool +       | |            |  |  P2P gossip layer     | |
|  |  circuit breaker      | |            |  +----------+-----------+ |
|  +----------------------+ |            |             |             |
|                           |            |  +----+-----+-----+----+ |
+---------------------------+            |  |    |     |     |    | |
                                         |  v    v     v     v    v |
  Config writes go directly              | Con- Oracle Cross Reorg  |
  to MariaDB.                            | sen- Round Chain Hand-   |
  No P2P, no consensus.                  | sus       Engine ler     |
                                         |  |    |     |     |    | |
                                         |  v    v     v     v    v |
                                         | Gov-  Reward Slash Swap  |
                                         | ern-  Track- Detec Track |
                                         | ance  er    tor   er    |
                                         |  +----+-----+-----+----+ |
                                         |             |             |
                                         |  +----------v-----------+ |
                                         |  |      db.js            | |
                                         |  |  MariaDB pool +       | |
                                         |  |  circuit breaker      | |
                                         |  +----------------------+ |
                                         +---------------------------+
```

In standalone mode, the hub is a simple config oracle. In validator mode, the `XChainHub` orchestrator wires together all subsystems via event-driven architecture.

## Internal Components

### Event-Driven Wiring

Subsystems communicate via Node.js EventEmitter events rather than direct method calls:

```
OracleConsensus  --round:finalized-->  RewardTracker
                 --round:finalized-->  SlashDetector

CrossChainEngine --attestation:finalized-->  SwapTracker

ReorgHandler     --reorg:confirmed-->  (downstream indexer notification)

Governance       --proposal:passed-->  (parameter application)
```

## Source Files

| File | Class/Module | Role |
|---|---|---|
| `api.js` | — | Entry point: Express app, JSON-RPC routes, env var validation, starts XChainHub |
| `XChainHub.js` | `XChainHub` | Orchestrator: wires all subsystems, exposes JSON-RPC method handlers |
| `db.js` | `Database` | MariaDB connection pool with circuit breaker and exponential backoff |
| `PeerManager.js` | `PeerManager` | WebSocket P2P gossip layer: peer connections, message signing, heartbeats |
| `Consensus.js` | `Consensus` | PBFT consensus for config writes: PRE_PREPARE → PREPARE → COMMIT |
| `ValidatorIdentity.js` | `ValidatorIdentity` | Ed25519 key management: signing, verification, key generation |
| `OracleRound.js` | `OracleRound` | Oracle round lifecycle: timer, price fetching, submission broadcast |
| `OracleConsensus.js` | `OracleConsensus` | PBFT consensus for price finalization: trimmed median, propose/prepare/commit |
| `PriceFetcher.js` | `PriceFetcher` | External price API client: CoinGecko and CoinMarketCap |
| `CrossChainEngine.js` | `CrossChainEngine` | PBFT attestation for cross-chain actions with per-chain-pair validators |
| `SwapTracker.js` | `SwapTracker` | Cross-chain SWAP lifecycle tracking: initiated → attested → executed → settled |
| `ReorgHandler.js` | `ReorgHandler` | Blockchain reorg detection, PBFT consensus, and hub state rollback |
| `Governance.js` | `Governance` | Off-chain PBFT voting for parameter changes |
| `RewardTracker.js` | `RewardTracker` | Per-round XCHAIN reward distribution to oracle participants |
| `SlashDetector.js` | `SlashDetector` | Validator misbehavior detection: price deviation, non-participation |
| `sql/*.sql` | — | 13 MariaDB table schemas |

## P2P Gossip Layer

The `PeerManager` provides the transport layer for all consensus protocols.

```
Validator A                         Validator B
+-----------+                       +-----------+
|PeerManager|---WebSocket outbound->|PeerManager|
|           |<--WebSocket inbound---|           |
+-----------+                       +-----------+
     |  ^                                |  ^
     |  |  message events                |  |
     v  |                                v  |
+----------+                        +----------+
|Consensus |                        |Consensus |
|Oracle    |                        |Oracle    |
|CrossChain|                        |CrossChain|
|Governance|                        |Governance|
+----------+                        +----------+
```

### Message Flow

1. Subsystem calls `peerManager.broadcast(envelope)`.
2. PeerManager assigns a unique ID, signs with Ed25519 (if identity configured), and adds to `seenIds` dedup cache.
3. Message sent to all connected peers.
4. Receiving PeerManager checks `seenIds` — drops duplicates.
5. Verifies Ed25519 signature against registered validator pubkeys (if `REQUIRE_SIGNATURES=true`).
6. Emits `message` event; relays to other peers (flood-fill gossip).

### Connection Management

- Outbound connections to `SEED_NODES` with exponential backoff (2s base, 60s max).
- Inbound connections on `P2P_PORT` (default 10001).
- Deduplicates bidirectional connections (if both A→B and B→A connect, one is dropped).
- Heartbeat broadcasts every 15 seconds (includes hub software version for upgrade coordination).
- WS ping/pong every 30 seconds to detect dead connections.
- Peer records persisted to `p2p_peers` table.

## PBFT Consensus

The consensus engine implements simplified PBFT for config writes:

```
Leader                  Validators (2f+1 required)
  |                          |
  |--PRE_PREPARE----------->|  Leader proposes config write
  |                          |
  |<---------PREPARE---------|  Validators acknowledge
  |  (collect 2f+1)          |
  |                          |
  |--COMMIT---------------->|  Leader broadcasts commit
  |                          |
  |<---------COMMIT----------|  Validators confirm
  |  (collect 2f+1)          |
  |                          |
  [Apply config to MariaDB]    [Apply config to MariaDB]
```

### Leader Selection

Leader for sequence `N` = `validatorSet[(N + view) % validatorCount]`, where validators are sorted by pubkey.

### View Change

If the leader fails to drive consensus within `PBFT_TIMEOUT` (default 30s):

1. Validators broadcast `PBFT_VIEW_CHANGE` for `view + 1`.
2. Once 2f+1 view-change votes are collected, the new view is adopted.
3. The next leader (per the new view number) takes over.

### Quorum

`2f+1` where `f = floor((N-1)/3)` — tolerates `f` Byzantine validators out of `N` total.

## Oracle Pipeline

```
Every ORACLE_ROUND_INTERVAL (default 10 min):

1. FETCH        PriceFetcher queries CoinGecko + CoinMarketCap
                  -> BTC/USD, LTC/USD, DOGE/USD
                  -> compute local median across sources

2. SUBMIT       Broadcast ORACLE_PRICE_SUBMIT via gossip
                  -> stored in oracle_submissions table

3. COLLECT      Wait ORACLE_SUBMISSION_WINDOW (default 3 min)
                  -> accumulate other validators' submissions

4. AGGREGATE    Round leader computes trimmed median:
                  -> sort submissions, discard top/bottom 15%
                  -> median of remaining values

5. PROPOSE      Leader broadcasts ORACLE_PROPOSE

6. PREPARE      Validators verify and send ORACLE_PREPARE
                  -> collect 2f+1 prepares

7. COMMIT       Leader broadcasts ORACLE_COMMIT
                  -> collect 2f+1 commits

8. FINALIZE     Store in price_snapshots (status='finalized')
                  -> emit round:finalized event
                  -> RewardTracker distributes XCHAIN
                  -> SlashDetector checks for misbehavior
```

### Price Sources

| Source | Coins | Requires API Key |
|---|---|---|
| CoinGecko | BTC/USD, LTC/USD, DOGE/USD | Optional (rate limits apply) |
| CoinMarketCap | BTC/USD, LTC/USD, DOGE/USD | Yes (`COINMARKETCAP_API_KEY`) |

The local price is the median across available sources. If only one source is available, its price is used directly.

### Trimmed Median

Given N validator submissions for a coin pair:
1. Sort all submissions by price.
2. Discard the top 15% and bottom 15%.
3. Compute the median of the remaining values.

This resists manipulation: an attacker would need to control >30% of validators to significantly shift the price.

## Cross-Chain Attestation

```
1. REQUEST      requestattestation(source_chain, source_action_index, dest_chain)

2. PROPOSE      Leader broadcasts XCHAIN_ATTEST_PROPOSE
                  -> includes attestation_id: "{source_chain}:{action_index}:{dest_chain}"

3. PREPARE      Validators send XCHAIN_ATTEST_PREPARE
                  -> only validators supporting BOTH chains participate
                  -> collect 2f+1 from eligible validator subset

4. COMMIT       Leader broadcasts XCHAIN_ATTEST_COMMIT
                  -> collect 2f+1 commits

5. FINALIZE     Store in attestations table (status='attested')
                  -> emit attestation:finalized event
                  -> SwapTracker auto-progresses matching swaps
```

### Confirmation Thresholds

| Chain | Required Confirmations |
|---|---|
| Bitcoin | 3 |
| Litecoin | 3 |
| Dogecoin | 6 |

### Supported Chain Pairs

BTC-LTC, BTC-DOGE, LTC-DOGE.

### Per-Chain-Pair Validators

Validators declare which chains they support via the `chains` column. Only validators supporting both chains in a pair participate in attestation consensus. Validators with NULL chains support all chain-pairs (backward compatible).

## Reorg Handling

```
1. REPORT       reportreorg(chain, reorg_height, timestamp)

2. ALERT        Broadcast REORG_ALERT via gossip

3. CONSENSUS    PBFT round: XCHAIN_REORG_PREPARE / XCHAIN_REORG_COMMIT
                  -> 2f+1 agreement

4. ROLLBACK     Hub state cleanup:
                  -> DELETE attestations after reorg timestamp for affected chain
                  -> Mark price_snapshots as 'disputed'

5. NOTIFY       Store in reorg_attestations table
                  -> emit reorg:confirmed event
```

## Governance

```
1. PROPOSE      propose(parameter, current_value, proposed_value, rationale)
                  -> only active validators can propose
                  -> stored in governance_proposals (status='voting')

2. GOSSIP       Broadcast GOV_PROPOSE via P2P

3. VOTE         vote(proposal_id, vote)  [approve/reject]
                  -> stored in governance_votes
                  -> broadcast GOV_VOTE via P2P

4. TALLY        Automatic tally every 60 seconds:
                  -> check if voting period (7 days) has ended
                  -> quorum: 50% minimum participation
                  -> approval: 2/3+ of validator set
                  -> broadcast GOV_RESULT via P2P

5. APPLY        If passed: emit proposal:passed event
                  -> downstream parameter application
```

### Constraints

| Rule | Value |
|---|---|
| Voting period | 7 days (`GOV_VOTING_PERIOD`) |
| Quorum | 50% of active validators |
| Approval threshold | 2/3+ of validator set |
| General param change bounds | Max +50% / −33% |
| Slashing param change bounds | Max +25% / −20% |
| Cooldown after rejection | 14 days before re-proposing same parameter |

## Reward and Slash System

### Rewards

On each finalized oracle round, `ORACLE_REWARD_PER_ROUND` (default "10.00000000") XCHAIN is distributed equally among validators who submitted a price in that round. Rewards are recorded in the `validator_rewards` table with `claimed=0` and are claimable via a `CLAIM_REWARDS` action on the BTC chain (handled by the indexer, not the hub).

### Slash Detection

Three offense types are monitored:

| Offense | Trigger | Description |
|---|---|---|
| `price_deviation` | >5% from consensus | Submission deviates more than `SLASH_DEVIATION_THRESHOLD` from the finalized price |
| `repeated_deviation` | 3+ in 24 hours | Three or more deviations within a rolling 24-hour window |
| `non_participation` | 30+ missed rounds | `SLASH_MISSED_ROUNDS_THRESHOLD` consecutive rounds without a submission |

Detection is recorded in the `slash_proposals` table. Actual stake slashing is executed by the indexer, not the hub.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
