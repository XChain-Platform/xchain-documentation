<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - STAKE
This action stakes XCHAIN tokens for hub validation.

## PARAMS
| Name              | Type    | Description                                                       |
| ----------------- | ------- | ----------------------------------------------------------------- |
| `VERSION`         | String  | Format Version                                                    |
| `TIER`            | Integer | Validation tier: 1=oracle, 2=cross-chain, 3=oracle publisher      |
| `CHAINS`          | String  | Comma-separated chains e.g. 'BTC,DOGE' (Tier 2 only — empty for Tier 1/3) |
| `SIGNING_PUBKEY`  | String  | Ed25519 public key, 64 hex chars                                  |
| `DOGE_ADDRESS`    | String  | DOGE broadcast address (Tier 3 only — empty for Tier 1/2)         |

## Formats

### Version `0`
- `VERSION|TIER|CHAINS|SIGNING_PUBKEY|DOGE_ADDRESS`

## Examples
```
STAKE|0|1||abc123...def|
Tier 1 (oracle validator) — CHAINS and DOGE_ADDRESS are empty
```

```
STAKE|0|2|BTC,DOGE|abc123...def|
Tier 2 (cross-chain validator) covering BTC and DOGE — DOGE_ADDRESS empty
```

```
STAKE|0|3||abc123...def|DJTBSwHi5LqgrXChDkBnDQ4QPSBXTbqXBu
Tier 3 (oracle publisher) — CHAINS empty, DOGE_ADDRESS required
```

## Rules
- BTC chain only
- `TIER` must be `1` (oracle), `2` (cross-chain), or `3` (oracle publisher)
- `CHAINS` rules:
  - Required for Tier 2; must list valid chain identifiers (BTC, LTC, DOGE)
  - Must be empty for Tier 1 and Tier 3
- `DOGE_ADDRESS` rules:
  - Required for Tier 3; must be a valid DOGE address (D-prefix, 34 chars base58)
  - Must be empty for Tier 1 and Tier 2
- `SIGNING_PUBKEY` must be a valid 64-character hex-encoded Ed25519 public key
- `SIGNING_PUBKEY` must be unique across all active stakes
- Broadcasting address must hold sufficient XCHAIN tokens for the selected tier
- Source address may not already have an active stake at this tier

## Tier Stake Amounts
| Tier | Role                       | Stake Amount  |
| ---- | -------------------------- | ------------- |
| 1    | Oracle validator (PBFT)    | 1,000 XCHAIN  |
| 2    | Cross-chain validator      | 5,000 XCHAIN  |
| 3    | Oracle publisher (DOGE broadcast) | 500 XCHAIN |

## Activation Delay
- Stakes do not become active until **6 BTC blocks** after confirmation
- This prevents short-range BTC reorgs (≤5 blocks) from affecting the active validator set
- Applies to all tiers and all validator state changes (STAKE, UNSTAKE, DELEGATE, REVOKE_DELEGATION)
- Tracked via the `activation_block` column on the `stakes` table (set to `block_index + 6`)
- Active-stake queries filter by `activation_block <= current_block`

## Notes
- Staking locks XCHAIN tokens in exchange for validator eligibility and rewards
- Tier 1 (oracle) validators participate in PBFT consensus on COIN/FIAT prices and sign the canonical PRICE v0 payload
- Tier 2 (cross-chain) validators coordinate cross-chain actions across the listed chains
- Tier 3 (oracle publisher) validators broadcast finalized PRICE v0 transactions to a chain (DOGE recommended), serving as the immutable on-chain anchor for validator price data
- Tier 1 and Tier 3 may overlap — the same address can hold both, since PBFT signatures are the cryptographic lock and publishing is just a courier role
- Use `UNSTAKE` to begin the cooldown period and recover staked tokens
- Use `DELEGATE` to rotate the signing key without unstaking
- See the `PRICE` action documentation for details on how Tier 1 and Tier 3 validators interact

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
