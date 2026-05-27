<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - STAKE
This action stakes tokens for validator participation. Two flavors:

- **v1 / v2 — capability staking.** XCHAIN-only. The protocol uses a capability model — validators get *every* capability whose `min_stake` their stake amount meets. No tiers.
- **v3 — contract-targeted staking.** Any token, targets a specific smart contract that was deployed with `COOLDOWN_BLOCKS` + `SLASH_DESTINATION` metadata (see [DEPLOY](DEPLOY.md) v1+). Multi-token. Auto-detects new vs. top-up based on whether `(TARGET_CONTRACT_INDEX, SIGNING_PUBKEY, TICK)` already has an active row owned by `SOURCE`.

For the full design see `claude/reports/specs/2026-05-24_capability-staking-model.md`.

## PARAMS
| Name                     | Type    | Description                                                       |
| ------------------------ | ------- | ----------------------------------------------------------------- |
| `VERSION`                | String  | Format Version (1 = new capability stake, 2 = top-up, 3 = contract-targeted) |
| `AMOUNT`                 | String  | Token to stake (decimal string, 8 decimals)                       |
| `SIGNING_PUBKEY`         | String  | Ed25519 public key, 64 hex chars                                  |
| `TARGET_CONTRACT_INDEX`  | Integer | v3 only — `action_index` of the stakeable contract                |
| `TICK`                   | String  | v3 only — token ticker being staked (any token, not just XCHAIN)  |

## Formats

### Version `1` — Create a new capability stake
- `VERSION|AMOUNT|SIGNING_PUBKEY`

### Version `2` — Top up an existing capability stake
- `VERSION|AMOUNT|SIGNING_PUBKEY`
- The `SIGNING_PUBKEY` must reference an existing active stake owned by `SOURCE`.
- The new amount is *added* to the existing stake total.

### Version `3` — Contract-targeted stake
- `VERSION|AMOUNT|SIGNING_PUBKEY|TARGET_CONTRACT_INDEX|TICK`
- The target contract must have been deployed with `COOLDOWN_BLOCKS` + `SLASH_DESTINATION` (see [DEPLOY](DEPLOY.md) v1+); non-stakeable contracts reject as `invalid: TARGET_CONTRACT_INDEX (contract is not stakeable)`.
- New-vs-topup is auto-detected by `(TARGET_CONTRACT_INDEX, SIGNING_PUBKEY, TICK, SOURCE)` — no separate `VERSION` for top-up. If an active row exists owned by `SOURCE`, this STAKE adds to it; otherwise it creates a new row.
- Any token (`TICK`) is acceptable — XCHAIN is not required.

## Examples
```
STAKE|1|1000.00000000|abc123...def
New capability stake of 1000 XCHAIN bound to pubkey abc123...def
```

```
STAKE|2|500.00000000|abc123...def
Top up the existing capability stake on pubkey abc123...def by 500 XCHAIN
(new total = previous amount + 500)
```

```
STAKE|3|250.00000000|abc123...def|500|MYTOKEN
Stake 250 MYTOKEN against contract at action_index 500, signing as abc123...def
(adds to existing row if one is already active, else creates a new row)
```

## Rules
- BTC chain only (all versions).
- `AMOUNT` must be a positive decimal string with up to 8 decimal places.
- `SIGNING_PUBKEY` must be a valid 64-character hex-encoded Ed25519 public key.

### v1 / v2 (capability)
- For `VERSION=1` (new): `SIGNING_PUBKEY` must NOT already have an active capability stake.
- For `VERSION=2` (top-up): `SIGNING_PUBKEY` MUST have an active capability stake AND that stake's original source must match the broadcasting address.
- `AMOUNT` is implicitly XCHAIN.
- Broadcasting address must hold at least `AMOUNT` XCHAIN.

### v3 (contract-targeted)
- `TARGET_CONTRACT_INDEX` must be a positive integer pointing at a stakeable contract (deployed with `COOLDOWN_BLOCKS` + `SLASH_DESTINATION`).
- `TICK` must be a known token; broadcasting address must hold at least `AMOUNT` of `TICK`.
- A pubkey can have separate v3 stakes per `(contract, tick)` pair — they do not collide with v1/v2 capability stakes or with each other.

## Capabilities and Minimum Stakes
A stake auto-qualifies for any capability whose `min_stake` the total stake meets. Defaults:

| Capability        | Role                                | Default Min Stake |
| ----------------- | ----------------------------------- | ----------------- |
| `price`           | PBFT signer on PRICE v0 snapshots   | 1,000 XCHAIN      |
| `cross_chain`     | Cross-chain attestation             | 5,000 XCHAIN      |
| `oracle_publish`  | Publish price rounds to DOGE chain  | 500 XCHAIN        |
| `attestation`     | Off-chain data fetch + attest       | 1,000 XCHAIN      |

A 5,000 XCHAIN stake therefore qualifies for all four capabilities. A 500 XCHAIN stake qualifies only for `oracle_publish`. Minimums are governance-tunable.

A capability becomes *active* on a hub when ALL of: (a) stake qualifies, (b) per-capability `selfTest()` passes, (c) operator has not added it to `disabled_capabilities`. Sub-features (chains for `cross_chain`, fiats for `price`, providers for `attestation`) live in operator hub config — not on-chain.

## Activation Delay
- Stakes do not become active until **6 BTC blocks** after confirmation.
- Prevents short-range BTC reorgs (≤5 blocks) from affecting the active validator set.
- Applies to STAKE v1, STAKE v2 (top-up), UNSTAKE, DELEGATE (all versions).
- Tracked via the `activation_block` column on the `stakes` table (set to `block_index + 6`).
- Active-stake queries filter by `activation_block <= current_block`.

## Storage Model
Each STAKE action (v1 *or* v2) inserts a new row into the `stakes` table. The active stake amount for a pubkey is `SUM(amount)` across all valid rows for that pubkey within the activation window. This append-only ledger preserves rollback correctness — block-level rewinds simply delete rows past the rewind point.

## Notes
- Use `UNSTAKE` to begin the cooldown period and recover staked tokens for a pubkey.
- Use `DELEGATE` to rotate the signing key without un-staking.
- Slashing burns from the unified stake pool. If a slash drops total stake below another capability's `min_stake`, that capability is collaterally lost at the next snapshot.
- See `PRICE` action documentation for the `price` capability's role in PBFT consensus.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
