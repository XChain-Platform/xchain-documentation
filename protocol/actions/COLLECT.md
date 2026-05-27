<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - COLLECT
This action collects all accrued validator rewards to the broadcasting address.

## PARAMS
| Name      | Type   | Description    |
| --------- | ------ | -------------- |
| `VERSION` | String | Format Version |

## Formats

### Version `0`
- `VERSION`

## Examples
```
COLLECT|0
Collect all accrued validator rewards for the broadcasting address
```

## Rules
- BTC chain only
- Broadcasting address must have an active stake (gated by the 6-block activation delay)
- Broadcasting address must have unclaimed rewards greater than 0
- Rewards are credited to the broadcasting address upon indexing

## Reward Sources

Rewards accumulate from multiple validator activities, all stored in the indexer's `validator_rewards` table:

| Reward Type | Earned By | Trigger |
|---|---|---|
| `oracle_round` | Validator with `price` capability | Participation in PBFT consensus on a finalized price round |
| `oracle_round` | Validator with `oracle_publish` capability | Successful PRICE v0 broadcast to chain (1 XCHAIN per published round) |
| `cross_chain_attestation` | Validator with `cross_chain` capability | Successful cross-chain action attestation |
| `attestation_response` | Validator with `attestation` capability | PBFT-finalized ATTEST v1 response for an external attestation request |

## Reward Population Path

The hub's `RewardTracker` distributes rewards after each finalized oracle round (or successful cross-chain attestation), then pushes the reward records to the BTC indexer via the `pushvalidatorrewards` JSON-RPC endpoint. The indexer's `createValidatorReward` resolves the validator's signing pubkey to the staking source address and writes to the local `validator_rewards` table.

`COLLECT` queries the indexer's `validator_rewards` table directly — no hub round-trip during transaction processing.

## Notes
- Rewards accrue continuously while the address holds an active stake
- All pending rewards are collected in a single action; partial collection is not supported
- Rewards may be collected at any time while a stake is active
- Rewards can also be collected after initiating `UNSTAKE` during the cooldown period
- A single pubkey can earn from multiple capabilities in the same round — e.g. a validator with both `price` and `oracle_publish` capabilities can earn the per-round consensus reward AND the per-publish broadcast reward in the same round

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
