<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - UNSTAKE
This action begins the unstaking cooldown for an active stake identified by its signing pubkey. Two flavors:

- **v0 — capability unstake.** Full-pubkey: returns *all* capability stake rows for that pubkey (original plus any v2 top-ups).
- **v1 — contract-targeted unstake.** Returns the single `(TARGET_CONTRACT_INDEX, SIGNING_PUBKEY, TICK)` stake row owned by the broadcaster. Use this for stakes created via [STAKE](STAKE.md) v3.

For the full design see `claude/reports/specs/2026-05-24_capability-staking-model.md`.

## PARAMS
| Name                     | Type    | Description                                |
| ------------------------ | ------- | ------------------------------------------ |
| `VERSION`                | String  | Format Version (0 = capability, 1 = contract-targeted) |
| `SIGNING_PUBKEY`         | String  | Ed25519 public key of the stake to unstake |
| `TARGET_CONTRACT_INDEX`  | Integer | v1 only — `action_index` of the stakeable contract |
| `TICK`                   | String  | v1 only — token ticker of the stake row to release |

## Formats

### Version `0` — Capability unstake
- `VERSION|SIGNING_PUBKEY`

### Version `1` — Contract-targeted unstake
- `VERSION|SIGNING_PUBKEY|TARGET_CONTRACT_INDEX|TICK`

## Examples
```
UNSTAKE|0|abc123...def
Begin unstaking the capability stake bound to pubkey abc123...def
(returns all rows for that pubkey, v1 + any v2 top-ups)
```

```
UNSTAKE|1|abc123...def|500|MYTOKEN
Begin unstaking the (contract=500, tick=MYTOKEN) stake row for pubkey abc123...def
```

## Rules
- `SIGNING_PUBKEY` must be a valid 64-character hex-encoded Ed25519 public key.
- The active stake lookup is gated by the activation delay — only fully-active stakes can be unstaked.
- Begins the cooldown period; staked tokens are not immediately returned.

### v0 (capability)
- **BTC chain only.**
- A capability stake must exist for `SIGNING_PUBKEY`, and the broadcasting address must be that stake's original source.

### v1 (contract-targeted)
- **Works on any chain** (BTC, LTC, DOGE).
- A contract-targeted stake row must exist for `(TARGET_CONTRACT_INDEX, SIGNING_PUBKEY, TICK)`, owned by the broadcasting address.
- Cooldown for v1 is determined by the target contract's `COOLDOWN_BLOCKS` setting (set at DEPLOY time), not the global `STAKING.COOLDOWN_BLOCKS`.

## Deactivation Delay (Removal from Validator Set)
- Validator removal does **not** take effect immediately — the validator continues to participate for **6 BTC blocks** after the UNSTAKE confirms.
- Tracked via the `deactivation_block` column on all active stake rows for the pubkey (set to `block_index + 6`).
- Active-stake queries filter by `(deactivation_block IS NULL OR deactivation_block > current_block)`.
- Prevents short-range BTC reorgs from affecting the active validator set.

## Cooldown Period (Token Return)
- Separate from the deactivation delay — tracked via the `cooldown_end_block` column on the `unstakes` table.
- Default cooldown: **1000 blocks** (configurable via `STAKING.COOLDOWN_BLOCKS`).
- After cooldown elapses, the staked XCHAIN tokens are returned to the broadcasting address.

## Notes
- Two distinct delays apply on UNSTAKE:
  1. **6 blocks** — validator removal from the active set (BTC reorg safety).
  2. **1000 blocks** — XCHAIN token return (security cooldown).
- The unstake amount is the SUM of all active stake rows for the pubkey (original stake + any top-ups via STAKE v2).
- Use `STAKE` (v1) to re-stake after the cooldown period completes.
- Use `COLLECT` to gather any accrued rewards before or after unstaking.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
