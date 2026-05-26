<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - PRICE
This action publishes oracle price data on-chain. Version 0 anchors PBFT-consensus COIN/FIAT price snapshots produced by validators qualifying for the `price` capability, broadcast on-chain by a validator qualifying for the `oracle_publish` capability. Version 1 lets any address with the `oracle_publish` capability operate a user-run TOKEN/FIAT price oracle. (Both capabilities are auto-qualified by aggregate stake amount per the new capability staking model — see [STAKE](STAKE.md).)

> **Doc-drift note (2026-05):** Several sections below — particularly *Leader Rotation & Failover*, *Tier 3 Staking*, and the legacy `STAKE|0|3|...` format example — still reference the legacy Tier 1/Tier 2/Tier 3 model that the capability rewrite supersedes. The behaviors they describe (round leader rotation among publishers, publisher persistent queue, DOGE balance monitoring) are still correct; only the staking gate has changed. Replace "Tier 1 validator" with "validator qualifying for `price`" and "Tier 3 publisher" with "validator qualifying for `oracle_publish`" mentally until those sections are rewritten. The current STAKE format is documented in [STAKE.md](STAKE.md).

## PARAMS

### Version 0 — Validator COIN/FIAT Price Snapshot
| Name              | Type    | Description                                                        |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `VERSION`         | String  | Format version (`0`)                                               |
| `ROUND`           | Integer | Oracle round number (= BTC block height that triggered the round)  |
| `TIMESTAMP`       | Integer | `block_time` of the BTC block that triggered the round (seconds)   |
| `PAIR_COUNT`      | Integer | Number of COIN/FIAT price pairs in this payload                    |
| `PAIR_ID`         | String  | COIN/FIAT pair identifier, e.g. `BTC/USD` (repeated per pair)      |
| `PAIR_PRICE`      | String  | Price as decimal string, 8 decimal places (repeated per pair)      |
| `SIG_COUNT`       | Integer | Number of `price`-capable validator signatures                              |
| `PUBKEY`          | String  | 64-char hex Ed25519 signing pubkey (repeated per signature)        |
| `SIGNATURE`       | String  | 128-char hex Ed25519 signature over round data (repeated per sig)  |

### Version 1 — User Oracle TOKEN/FIAT Price
| Name              | Type    | Description                                                        |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `VERSION`         | String  | Format version (`1`)                                               |
| `COIN`            | String  | Chain identifier for the token (e.g. `BTC`, `LTC`, `DOGE`)         |
| `TICK`            | String  | Token name (e.g. `PEPECASH`)                                       |
| `FIAT`            | String  | Fiat currency code (e.g. `USD`, `JPY`, `EUR`)                      |
| `VALUE`           | String  | Price as decimal string, 8 decimal places                          |
| `FEE`             | String  | Oracle usage fee as decimal (e.g. `0.01` = 1%)                     |
| `MEMO`            | String  | Optional description or timestamp                                  |

## Formats

### Version `0` — Validator COIN/FIAT Price Snapshot
```
VERSION|ROUND|TIMESTAMP|PAIR_COUNT|PAIR_ID|PAIR_PRICE|...|SIG_COUNT|PUBKEY|SIGNATURE|...
```
Pair data (`PAIR_ID|PAIR_PRICE`) repeats `PAIR_COUNT` times.
Signature data (`PUBKEY|SIGNATURE`) repeats `SIG_COUNT` times.

### Version `1` — User Oracle TOKEN/FIAT Price
```
VERSION|COIN|TICK|FIAT|VALUE|FEE|MEMO
```

## Examples
```
PRICE|0|850010|1712500000|3|BTC/USD|100000.12345678|LTC/USD|85.50000000|DOGE/USD|0.15000000|3|aabb...01|ccdd...sig1|aabb...02|ccdd...sig2|aabb...03|ccdd...sig3
An `oracle_publish`-capable validator anchors PBFT-consensus price snapshot for BTC block 850010 with 3 COIN/FIAT pairs and 3 `price`-capable validator signatures
```

```
PRICE|0|850010|1712500000|6|BTC/USD|100000.12345678|BTC/EUR|92000.00000000|LTC/USD|85.50000000|LTC/EUR|78.50000000|DOGE/USD|0.15000000|DOGE/EUR|0.14000000|5|aa...01|cc...s1|aa...02|cc...s2|aa...03|cc...s3|aa...04|cc...s4|aa...05|cc...s5
Multi-FIAT snapshot: 3 coins × 2 fiat currencies = 6 pairs, signed by 5 validators
```

```
PRICE|1|BTC|PEPECASH|USD|0.05000000|0.01|hourly update
User oracle publishes PEPECASH price on BTC chain at $0.05 USD with 1% usage fee
```

```
PRICE|1|BTC|PEPECASH|JPY|7.50000000|0.02|
User oracle publishes PEPECASH price in JPY with 2% usage fee
```

## Rules

### Version 0 — Validator COIN/FIAT Price Snapshot

#### Chain & Publisher
- Publishable on **any chain** (BTC, LTC, DOGE) — DOGE is recommended for lowest tx fees but the protocol does not require it
- `SOURCE` must have an active Tier 3 stake (`stakes` table, `tier=3`, `status=valid`)

#### Round Identity
- `ROUND` corresponds to the BTC block height that triggered the oracle round
- One round per BTC block (BTC blocks average ~10 minutes but can vary from 1 to 60+ minutes)
- Each round may only be published once — duplicate `ROUND` values are deduplicated by the hub (first valid submission wins)

#### Leader Rotation & Failover
- Active Tier 3 validators are sorted by `signing_pubkey` (deterministic ordering — every node agrees)
- Leader for round N: `N % active_tier3_count` (index into sorted list)
- If round N is not published by the time BTC block N+1 arrives, the next Tier 3 validator in rotation becomes eligible to publish
- Failover cascades: if that validator also misses, the next one is eligible at BTC block N+2, and so on
- The first valid PRICE tx on-chain for a given round wins (and earns the reward)

#### Batch Publishing
- A single PRICE v0 transaction may contain multiple rounds (for failover catch-up)
- When a failover publisher takes over, they batch all missed rounds into one or more transactions
- No artificial cap on rounds per batch — bounded only by P2SH encoding limits (~65KB max)
- If the batch exceeds a single P2SH transaction, multiple PRICE transactions are sent
- The failover publisher earns rewards for ALL rounds in the batch

#### Signature Validation
- Each `PUBKEY` must correspond to a pubkey qualifying for `price` at the BLOCK_INDEX of the PRICE tx (`SUM(amount)` across active stake rows ≥ `min_stake[price]`, governance-configurable; rows are active where `activation_block ≤ block_index < COALESCE(deactivation_block, +∞)`)
- Each `SIGNATURE` must be a valid Ed25519 signature over the canonical PRICE v0 payload by the corresponding `PUBKEY`
- Canonical payload format: `JSON.stringify({round, timestamp, pairs})` where `pairs` is sorted ascending by `pair` field
- `SIG_COUNT` must meet PBFT quorum: `>= 2 * floor((tier1_count - 1) / 3) + 1`
- Duplicate pubkeys in the signature list count only once
- Rounds that fail signature validation are marked `invalid` and not pushed to the hub

#### Skipped Rounds
- If PBFT fails to reach consensus for a BTC block, no PRICE v0 is published for that round
- The gap in round numbers is a silent skip — no explicit skip marker is published
- Indexers use the most recent valid price when no snapshot exists for a given round

#### Activation Delay
- A validator's STAKE, UNSTAKE, DELEGATE, or REVOKE_DELEGATION action does not take effect until **6 BTC blocks (~1 hour)** after confirmation
- Eliminates BTC reorg edge cases for reorgs of ≤5 blocks
- Applies to all tiers (1, 2, 3) and all validator state changes

#### Supported COIN/FIAT Pairs
- Validators publish all supported COIN × FIAT combinations per round
- Initial COIN set: `BTC`, `LTC`, `DOGE` (3 coins)
- Initial FIAT set: `USD`, `CAD`, `AUD`, `MXN`, `GBP`, `JPY`, `CNY`, `CHF`, `BRL`, `INR`, `EUR`, `KRW` (12 currencies)
- Initial pair count: **3 coins × 12 fiats = 36 pairs per round**
- Adding new coins or fiat currencies does not require a protocol change — `PAIR_COUNT` is dynamic
- Validators fetch all 12 fiat prices per coin in a single API call (CoinGecko `vs_currencies` parameter, CMC `convert` parameter)

#### Publisher Persistent Queue
- Tier 3 publishers must durably store finalized rounds to a local persistent queue (JSONL with fsync) before acknowledging receipt to the hub
- On restart, the publisher replays any unconfirmed rounds from the queue
- Rounds are removed from the queue only after DOGE chain confirmation
- If the queue is unwritable, the publisher refuses new rounds (fail loud, not silent)

#### DOGE Balance Monitoring
- Publishers check their own DOGE wallet balance before each publish attempt
- **WARN** logged when balance falls below configurable threshold (default: 10 DOGE) with estimated rounds remaining at current fee rate
- **ERROR** logged when a publish tx fails due to insufficient DOGE balance
- No protocol-level enforcement — if a publisher runs out of DOGE, failover kicks in naturally and the next Tier 3 in rotation takes over

#### Rewards
- Tier 3 publisher earns 1 XCHAIN per successful PRICE v0 publish
- When batch-publishing missed rounds on failover, the publisher earns rewards for all rounds in the batch
- Rewards are claimed via the `CLAIM_REWARDS` action on BTC

### Version 1 — User Oracle TOKEN/FIAT Price

#### Chain
- Publishable on any supported chain (BTC, LTC, DOGE)
- DOGE recommended for low-cost frequent updates

#### Publisher
- Any address may publish PRICE v1 — no staking requirement
- The `SOURCE` address becomes the oracle identity
- Dispensers and betting systems reference the oracle by `SOURCE` address

#### COIN Field
- Identifies which chain's token the price is for
- A DOGE transaction can publish a price for a BTC token (cross-chain oracle)
- Dispensers/betting on any chain may reference any oracle regardless of publishing chain

#### Price Lock Window
- A user oracle's **first** PRICE v1 broadcast for a given `(SOURCE, COIN, TICK, FIAT)` combination takes effect immediately (no existing dispensers to front-run)
- All **subsequent** PRICE v1 updates for the same combination do not take effect until **86400 seconds (24 hours)** after `block_time`
- Prevents oracle front-running attacks on dispensers: without the delay, an oracle operator could see an incoming dispenser payment and rush a price update to manipulate the exchange rate
- 24-hour delay matches the `FIAT_DISPENSER_PRICE_WINDOW` — any payment that enters the mempool before the price update will settle at the old price before the new one activates
- User TOKEN/FIAT oracles target illiquid markets where prices change infrequently, so the 24-hour delay is not a practical limitation
- Enforced by the `effective_at` column on the hub's `oracle_prices` table

#### FIAT Dispenser Reverse Price Matching
- When a FIAT dispenser referencing a user oracle receives a payment, the system **reverse-matches** the payment amount against historical oracle prices within a **24-hour window** (86400 seconds) before the payment's `block_time`
- Cross-conversion combines the user oracle (TOKEN/FIAT) with the validator oracle (COIN/FIAT) for the same currency:
  - User oracle: 1 PEPECASH = ¥7.50 JPY
  - Validator oracle: 1 BTC = ¥15,000,000 JPY
  - Buyer pays 0.001 BTC → receives `floor((0.001 × 15000000) / 7.50)` = 2000 PEPECASH
- See `DISPENSER` documentation for full reverse price matching details and examples

#### FEE Field
- Decimal value representing the oracle usage fee percentage
- `0.01` = 1%, `0.05` = 5%, etc.
- Dispensers/betting systems that reference this oracle pay the fee to the oracle `SOURCE` address

## Tier 3 Staking

| Property         | Value                    |
| ---------------- | ------------------------ |
| Tier             | 3                        |
| Role             | Oracle publisher         |
| Stake amount     | 500 XCHAIN               |
| Chain            | BTC only (same as `price`) |
| Overlap          | Allowed — same address may hold `price` + `oracle_publish` |
| Cooldown         | Same as other tiers (configurable, default 1000 blocks) |
| Activation delay | 6 BTC blocks (~1 hour)   |

STAKE format for Tier 3:
```
STAKE|0|3||<SIGNING_PUBKEY>|<DOGE_ADDRESS>
```
- `CHAINS` field is empty for `oracle_publish` (same as `price`) — publishers always publish to DOGE (or another supported chain)
- `DOGE_ADDRESS` is the address the publisher will use to broadcast PRICE v0 transactions
- `DOGE_ADDRESS` is recorded on-chain so every node knows each publisher's sending address
- Balance is **not** validated at stake time (cross-chain dependency); balance is checked at publish time by the publisher service itself

## Architecture

### Data Flow — Validator Prices (v0)
```
`price`-capable validators fetch prices from CoinGecko/CMC
  → PBFT consensus (2/3+ agree on prices per BTC block)
    → Each validator signs the canonical PRICE v0 payload during prepare/commit
      → Tier 3 publisher writes PRICE v0 (with collected sigs) to a chain (DOGE recommended)
        → That chain's decoder picks up the action
          → That chain's indexer validates PBFT signatures and writes to local prices table
            → Indexer pushes validated round to hub
              → Hub deduplicates by round_number, writes to unified price_snapshots table
                → Hub broadcasts new row to all connected indexers' local hub DB copies
```

### Data Flow — User Oracle Prices (v1)
```
User broadcasts PRICE v1 on any chain
  → Chain's decoder extracts PRICE action
    → Chain's indexer validates fields and writes to local prices table
      → Indexer pushes to hub oracle_prices table
        → Hub applies 24-hour lock window logic (first broadcast immediate, subsequent delayed)
          → Hub broadcasts new row to all connected indexers' local hub DB copies
            → All indexers query their local hub DB for oracle data — no hub round-trip during block processing
```

### Three-Database Model
Each indexer maintains three database connections:

| Database | Connection | Owner | Contains |
|----------|-----------|-------|----------|
| Decoder DB | Read | Decoder | Raw blockchain data, decoded txs |
| Indexer DB | Read/Write | Indexer | Chain-specific indexed state — actions, balances, tokens, plus the local `prices` action log |
| Hub DB (local) | Read | Hub (synced via WebSocket) | Cross-chain infrastructure — `price_snapshots`, `oracle_prices`, `validator_rewards`, etc. |

The indexer's `prices` table is the raw on-chain action log (one row per PRICE tx). The hub's `price_snapshots` and `oracle_prices` tables are the deduplicated, cross-chain aggregated views that indexers actually query for price lookups.

### DOGE Chain Role
- DOGE is the recommended publishing chain for PRICE v0 due to lowest tx fees
- However the protocol allows publishing on any supported chain — `source_chain` is recorded in the hub's `price_snapshots` for audit
- Indexers do not need to run a DOGE node — they get prices from their local hub DB copy
- A new node syncing from genesis can reconstruct full oracle history from any chain that carried PRICE v0 transactions

### Determinism Guarantee
- Two independent nodes reading the same blockchains and running the same validator set arrive at identical price state
- Validator prices are anchored on-chain with full PBFT cryptographic proof (publishable on any chain)
- User oracle prices are on-chain on their publishing chain
- Hub aggregates `price_snapshots` and `oracle_prices` from all chains — single source of truth
- Indexers query their local hub DB copy — no hub round-trip during block processing
- No off-chain data is required to reconstruct the complete oracle history

## Notes
- This action replaces the oracle functionality previously available via `BROADCAST` version 1
- Validator price snapshots include all 12 supported FIAT currencies per coin, enabling cross-currency dispenser pricing without double-conversion
- The reverse price matching mechanism for FIAT dispensers is documented in the `DISPENSER` action specification
- `PRICE` can coexist with `BROADCAST` — existing BROADCAST oracles continue to function

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
