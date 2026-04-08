<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - PRICE
This action publishes oracle price data on-chain. Version 0 is used by Tier 3 validators to anchor PBFT-consensus COIN/FIAT price snapshots to the DOGE chain. Version 1 is used by individual addresses to operate user-run TOKEN/FIAT price oracles.

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
| `SIG_COUNT`       | Integer | Number of Tier 1 validator signatures                              |
| `PUBKEY`          | String  | 64-char hex Ed25519 signing pubkey (repeated per signature)        |
| `SIGNATURE`       | String  | 128-char hex Ed25519 signature over round data (repeated per sig)  |

### Version 1 — User Oracle TOKEN/FIAT Price
| Name              | Type    | Description                                                        |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `VERSION`         | String  | Format version (`1`)                                               |
| `COIN`            | String  | Chain identifier for the token (e.g. `BTC`, `LTC`, `DOGE`)        |
| `TICK`            | String  | Token name (e.g. `PEPECASH`)                                      |
| `FIAT`            | String  | Fiat currency code (e.g. `USD`, `JPY`, `EUR`)                     |
| `VALUE`           | String  | Price as decimal string, 8 decimal places                          |
| `FEE`             | String  | Oracle usage fee as decimal (e.g. `0.01` = 1%)                    |
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
Tier 3 validator publishes PBFT-consensus price snapshot for BTC block 850010 with 3 COIN/FIAT pairs and 3 Tier 1 validator signatures
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
- DOGE chain only
- `SOURCE` must have an active Tier 3 stake (`stakes` table, `tier=3`, `status=valid`)

#### Round Identity
- `ROUND` corresponds to the BTC block height that triggered the oracle round
- One round per BTC block
- Each round may only be published once — duplicate `ROUND` values are rejected

#### Leader Rotation & Failover
- Active Tier 3 validators are sorted by `signing_pubkey` (deterministic ordering)
- Leader for round N: `N % active_tier3_count` (index into sorted list)
- If round N is not published by the time BTC block N+1 arrives, the next Tier 3 validator in rotation becomes eligible to publish
- Failover cascades: if that validator also misses, the next one is eligible at BTC block N+2, and so on

#### Batch Publishing
- A single PRICE v0 transaction may contain multiple rounds (for failover catch-up)
- When a failover publisher takes over, they batch all missed rounds into one or more transactions
- No artificial cap on rounds per batch — bounded only by P2SH encoding limits (~65KB max)
- If the batch exceeds a single P2SH transaction, multiple PRICE transactions are sent

#### Signature Validation
- Each `PUBKEY` must correspond to an active Tier 1 stake (`stakes` table, `tier=1`, `status=valid`)
- Each `SIGNATURE` must be a valid Ed25519 signature over the round data (ROUND, TIMESTAMP, all PAIR_ID/PAIR_PRICE data) by the corresponding `PUBKEY`
- `SIG_COUNT` must meet PBFT quorum: `>= 2 * floor((tier1_count - 1) / 3) + 1`
- Rounds that fail signature validation are marked `invalid`

#### Skipped Rounds
- If PBFT fails to reach consensus for a BTC block, no PRICE v0 is published for that round
- The gap in round numbers is a silent skip — no explicit skip marker is published
- Indexers use the most recent valid price when no snapshot exists for a given round

#### Activation Delay
- A validator's STAKE, UNSTAKE, DELEGATE, or REVOKE_DELEGATION action does not take effect until 6 BTC blocks (~1 hour) after confirmation
- This eliminates BTC reorg edge cases for reorgs of ≤5 blocks

#### Supported COIN/FIAT Pairs
- Validators publish all supported COIN × FIAT combinations per round
- Initial COIN set: `BTC`, `LTC`, `DOGE`
- Initial FIAT set: `USD`, `EUR`, `GBP`, `JPY`, `CNY`, `KRW`, `CAD`, `AUD`
- Initial pair count: 3 coins × 8 fiats = 24 pairs per round
- Adding new coins or fiat currencies does not require a protocol change — `PAIR_COUNT` is dynamic

#### Publisher Persistent Queue
- Tier 3 publishers must durably store finalized rounds to a local persistent queue (LevelDB or flat file) before acknowledging receipt to the hub
- On restart, the publisher replays any unconfirmed rounds from the queue
- Rounds are removed from the queue only after DOGE chain confirmation

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
- A new PRICE v1 does not take effect until 3600 seconds (1 hour) after its `block_time`
- Prevents oracle front-running attacks on dispensers
- Pending prices are visible but not used for dispenser/betting calculations until the lock expires

#### FIAT Dispenser Grace Period
- When a FIAT-denominated dispenser receives a payment, the system reverse-matches the payment amount against historical oracle prices within a **24-hour window** (86400 seconds) before the payment's `block_time`
- This accommodates blockchain congestion delays and infrequent oracle updates
- Matching iterates through snapshots **newest-to-oldest** and returns the first snapshot where `floor(COIN_AMOUNT / (FIAT_AMOUNT / snapshot.price)) >= 1`
- The buyer most likely used the latest available price, so the newest matching snapshot is preferred
- Overpayment (tips) are handled naturally by the floor operation — excess coin above a whole unit count does not trigger additional dispenses
- If no snapshot in the window produces at least 1 unit, the dispense is marked invalid
- See DISPENSER documentation for full reverse price matching details and examples

#### FEE Field
- Decimal value representing the oracle usage fee percentage
- `0.01` = 1%, `0.05` = 5%, etc.
- Dispensers/betting systems that reference this oracle pay the fee to the oracle `SOURCE` address

#### Data Storage
- User oracle prices are stored in the hub's `oracle_prices` table (centralized cross-chain store)
- All indexers query the hub for user oracle data
- Indexers push PRICE v1 actions from their chain to the hub after processing

### Tier 3 Staking

| Property         | Value                    |
| ---------------- | ------------------------ |
| Tier             | 3                        |
| Role             | Oracle publisher         |
| Stake amount     | 500 XCHAIN               |
| Chain            | BTC only (same as Tier 1/2) |
| Overlap          | Allowed — same address may hold Tier 1 + Tier 3 |
| Cooldown         | Same as other tiers (configurable, default 1000 blocks) |
| Activation delay | 6 BTC blocks (~1 hour)   |

STAKE format for Tier 3:
```
STAKE|0|3||<SIGNING_PUBKEY>
```
`CHAINS` field is empty for Tier 3 (same as Tier 1) — publishers always publish to DOGE.

## Architecture

### Data Flow — Validator Prices (v0)
```
Tier 1 validators fetch prices from CoinGecko/CMC
  → PBFT consensus (2/3+ agree on price per BTC block)
    → Finalized round served to indexers via hub (primary read path)
    → Tier 3 publisher writes PRICE v0 to DOGE (backup/archive/proof)
```

### Data Flow — User Oracle Prices (v1)
```
User broadcasts PRICE v1 on any chain (primarily DOGE)
  → Chain's decoder extracts PRICE action
    → Chain's indexer processes and pushes to hub oracle_prices table
      → All indexers query hub for cross-chain oracle data
```

### DOGE Chain Role
- DOGE is the **ledger of record** for validator price data, not the primary read path
- Indexers read prices from validators via hub — they do not need to run a DOGE node
- DOGE PRICE data is used for: audit, recovery, dispute resolution, new node bootstrap
- `xchain-indexer-sync` can replicate DOGE PRICE data to validators not running a full DOGE node

### Determinism Guarantee
- Two independent nodes reading the same blockchains and running the same validator set will arrive at identical price state
- Validator prices are anchored on DOGE with full PBFT cryptographic proof
- User oracle prices are on-chain on their publishing chain
- No off-chain data is required to reconstruct the complete oracle history

## Notes
- This action replaces the oracle functionality previously available via `BROADCAST` version 1
- Validator price snapshots include all supported FIAT currencies per coin, enabling cross-currency dispenser pricing without double-conversion
- The reverse price matching mechanism for FIAT dispensers is documented in the DISPENSER action specification
- `PRICE` can coexist with `BROADCAST` — existing BROADCAST oracles continue to function

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
