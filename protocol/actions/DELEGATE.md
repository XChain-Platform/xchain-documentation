<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - DELEGATE
Manages the signing key bound to a staked validator. Four flavors:

- **v0 — Capability delegation.** Rotates the signing key for the broadcaster's active capability stake.
- **v1 — Contract-targeted delegation.** Rotates the signing key for a single `(TARGET_CONTRACT_INDEX, TICK)` stake row owned by the broadcaster. Use this for stakes created via [STAKE](STAKE.md) v3.
- **v2 — Capability revoke.** Removes a previously delegated capability signing key without replacing it.
- **v3 — Contract-targeted revoke.** Removes a previously delegated contract-targeted signing key without replacing it.

## PARAMS
| Name                     | Type    | Versions | Description                                          |
| ------------------------ | ------- | -------- | ---------------------------------------------------- |
| `VERSION`                | String  | all      | Format Version (0=capability rotate, 1=contract rotate, 2=capability revoke, 3=contract revoke) |
| `NEW_SIGNING_PUBKEY`     | String  | 0, 1     | New Ed25519 public key, 64 hex chars                 |
| `SIGNING_PUBKEY`         | String  | 2, 3     | Existing Ed25519 public key to revoke, 64 hex chars  |
| `TARGET_CONTRACT_INDEX`  | Integer | 1, 3     | `action_index` of the stakeable contract             |
| `TICK`                   | String  | 1, 3     | Token ticker of the stake row to rotate or revoke    |

## Formats

### Version `0` — Capability delegation
- `VERSION|NEW_SIGNING_PUBKEY`

### Version `1` — Contract-targeted delegation
- `VERSION|NEW_SIGNING_PUBKEY|TARGET_CONTRACT_INDEX|TICK`

### Version `2` — Capability revoke
- `VERSION|SIGNING_PUBKEY`

### Version `3` — Contract-targeted revoke
- `VERSION|SIGNING_PUBKEY|TARGET_CONTRACT_INDEX|TICK`

## Examples
```
DELEGATE|0|abc123...def
Rotate the signing key for the broadcaster's capability stake
```

```
DELEGATE|1|abc123...def|500|MYTOKEN
Rotate the signing key for the broadcaster's (contract=500, tick=MYTOKEN) stake row
```

```
DELEGATE|2|abc123...def
Revoke the specified signing key from the broadcaster's capability stake
```

```
DELEGATE|3|abc123...def|500|MYTOKEN
Revoke the specified signing key from the broadcaster's (contract=500, tick=MYTOKEN) stake row
```

## Rules
- `NEW_SIGNING_PUBKEY` / `SIGNING_PUBKEY` must be a valid 64-character hex-encoded Ed25519 public key.

### v0 (capability rotate)
- **BTC chain only.**
- Broadcasting address must have an active capability stake (gated by the 6-block activation delay).
- `NEW_SIGNING_PUBKEY` must not already be in use by any active stake or delegation.

### v1 (contract rotate)
- **Works on any chain** (BTC, LTC, DOGE).
- Broadcasting address must own an active `(TARGET_CONTRACT_INDEX, SIGNING_PUBKEY, TICK)` stake row created via STAKE v3.
- `TARGET_CONTRACT_INDEX` must be a positive integer pointing at a stakeable contract.
- `TICK` must match the existing stake row's token.
- `NEW_SIGNING_PUBKEY` must not already be in use by any active stake or delegation scoped to the same contract.

### v2 (capability revoke)
- **BTC chain only.**
- Broadcasting address must have an active delegation for the specified `SIGNING_PUBKEY` (gated by the 6-block activation delay).

### v3 (contract revoke)
- **Works on any chain** (BTC, LTC, DOGE).
- Broadcasting address must own an active contract-targeted delegation matching `(TARGET_CONTRACT_INDEX, SIGNING_PUBKEY, TICK)`.
- `TARGET_CONTRACT_INDEX` must be a positive integer pointing at a stakeable contract.
- `TICK` must match the existing delegation's token.

## Activation / Deactivation Delay
All four versions are gated by an activation delay (measured in blocks of the chain on which the action was broadcast) before taking effect, tracked via the `activation_block` / `deactivation_block` columns on the `delegations` (v0/v2) or `contract_delegations` (v1/v3) tables. The delay is calibrated per chain for ~60 minutes of reorg protection — **6 blocks on BTC** (~10 min/block), **24 on LTC** (~2.5 min/block), **60 on DOGE** (~1 min/block); a flat block count would otherwise give DOGE only ~6 minutes. Capability-staking delegations (v0/v2) are BTC-only and use the 6-block BTC value; contract delegations (v1/v3) apply the per-chain value. The worked examples below use BTC's 6 blocks.

- **v0 / v1 (rotate)**: the new delegated key does **not** take effect immediately — it becomes active after 6 blocks. During the delay, signatures from the new key are rejected and the old key remains in effect.
- **v2 / v3 (revoke)**: revocation does **not** take effect immediately — the key remains active for 6 blocks after the action confirms.

This prevents short-range chain reorgs from leaving a stake without a valid signer.

## Notes
- Use v0/v1 to rotate signing keys for security hygiene without disrupting validator status.
- Use v2/v3 to remove a delegated key without replacing it. A stake with no valid signing key will not participate in validator duties until a new key is delegated via v0/v1.
- The 6-block delay means that for emergency key compromise scenarios, operators must:
  1. Broadcast a rotate (v0/v1) with a new key (takes 6 blocks to activate)
  2. Broadcast a revoke (v2/v3) for the old key (takes 6 blocks to deactivate)
  3. During the overlap window, both keys are valid — the new key takes effect ~6 blocks before the old key is fully revoked.
- Does not affect staked token amounts or capability qualifications.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
