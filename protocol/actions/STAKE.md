<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - STAKE
This action stakes tokens for validator participation, supporting both protocol capability staking (XCHAIN-only, v1/v2) and contract-targeted staking against any stakeable smart contract (v3, any token).

## PARAMS
| Name                    | Type    | Description                                                                           |
| ----------------------- | ------- | ------------------------------------------------------------------------------------- |
| `VERSION`               | String  | Format Version (1 = new capability stake, 2 = top-up, 3 = contract-targeted)         |
| `AMOUNT`                | String  | Amount of token to stake (decimal string, 8 decimal places)                           |
| `SIGNING_PUBKEY`        | String  | Ed25519 public key, 64 hex chars                                                      |
| `TARGET_CONTRACT_INDEX` | Integer | v3 only: `action_index` of the stakeable contract                                    |
| `TICK`                  | String  | v3 only: token ticker being staked (any token, not just XCHAIN)                      |

## Formats

### Version `1` - New Capability Stake
- `VERSION|AMOUNT|SIGNING_PUBKEY`

### Version `2` - Top-Up Capability Stake
- `VERSION|AMOUNT|SIGNING_PUBKEY`

### Version `3` - Contract-Targeted Stake
- `VERSION|AMOUNT|SIGNING_PUBKEY|TARGET_CONTRACT_INDEX|TICK`

## Examples
```
STAKE|1|1000.00000000|abc123...def
New capability stake of 1000 XCHAIN bound to pubkey abc123...def
```

```
STAKE|2|500.00000000|abc123...def
Top up the existing capability stake on pubkey abc123...def by 500 XCHAIN (new total = previous amount + 500)
```

```
STAKE|3|250.00000000|abc123...def|500|MYTOKEN
Stake 250 MYTOKEN against contract at action_index 500, signing as abc123...def (adds to existing row if one is already active, else creates a new row)
```

## Rules
- `AMOUNT` must be a positive decimal string with up to 8 decimal places.
- `SIGNING_PUBKEY` must be a valid 64-character hex-encoded Ed25519 public key.

### v1 / v2 (capability staking)
- BTC chain only. Capability staking secures the platform validator set.
- `AMOUNT` is implicitly XCHAIN; the broadcasting address must hold at least `AMOUNT` XCHAIN.
- For `VERSION=1` (new stake): `SIGNING_PUBKEY` must not already have an active capability stake, and must not be held by an active (or pending-activation) [DELEGATE](DELEGATE.md) delegation. A key can never be both a stake key and a delegated key.
- For `VERSION=2` (top-up): `SIGNING_PUBKEY` must have an active capability stake and that stake's original source must match the broadcasting address. The new amount is added to the existing stake total.
- A `VERSION=2` re-stake of a key previously revoked via DELEGATE v2 makes the key a valid signer again, backed by the stake rows from the re-stake onward (rows that predate the revocation stay suppressed).

### v3 (contract-targeted staking)
- Works on any chain (BTC, LTC, DOGE). Contract staking is a developer primitive; each contract defines its own staking semantics.
- `TARGET_CONTRACT_INDEX` must be a positive integer pointing at a stakeable contract (deployed with `COOLDOWN_BLOCKS` + `SLASH_DESTINATION`). Contracts that lack those fields reject with `invalid: TARGET_CONTRACT_INDEX (contract is not stakeable)`.
- `TICK` must be a known token; broadcasting address must hold at least `AMOUNT` of `TICK`.
- New-vs-topup is auto-detected by `(TARGET_CONTRACT_INDEX, SIGNING_PUBKEY, TICK, SOURCE)`. If an active row exists owned by `SOURCE`, this STAKE adds to it; otherwise it creates a new row. There is no separate VERSION for top-up.
- A pubkey can have separate v3 stakes per `(contract, tick)` pair; they do not collide with v1/v2 capability stakes or with each other.
- If the staked `TICK` binds a `stake`-class controller (or the catch-all `all`), the contract's `guard` runs before a v3 stake settles and may `revert` it; `SOURCE` pays the bounded guard gas. v1/v2 (XCHAIN-only capability) stakes are never controller-gated. See [Controller-Bound Tokens](../Controller_Bound_Tokens.md).

## Capabilities and Minimum Stakes
The protocol uses a capability model: a v1/v2 stake auto-qualifies for every capability whose `min_stake` the total stake amount meets. There are no tiers. Default thresholds:

| Capability       | Role                                | Default Min Stake |
| ---------------- | ----------------------------------- | ----------------- |
| `price`          | PBFT signer on PRICE v0 snapshots   | 1,000 XCHAIN      |
| `cross_chain`    | Cross-chain attestation             | 5,000 XCHAIN      |
| `oracle_publish` | Publish price rounds to DOGE chain  | 500 XCHAIN        |
| `attestation`    | Off-chain data fetch and attest     | 1,000 XCHAIN      |

A 5,000 XCHAIN stake qualifies for all four capabilities. A 500 XCHAIN stake qualifies only for `oracle_publish`. Minimums are governance-tunable.

A capability becomes active on a hub when all three conditions hold: (a) stake qualifies, (b) per-capability `selfTest()` passes, (c) operator has not added it to `disabled_capabilities`. Sub-features (chains for `cross_chain`, fiats for `price`, providers for `attestation`) live in operator hub config and are not on-chain.

## Activation Delay
- Stakes do not become active until **6 BTC blocks** after confirmation.
- This prevents short-range BTC reorgs (5 blocks or fewer) from affecting the active validator set.
- Applies to STAKE v1, STAKE v2 (top-up), UNSTAKE, and DELEGATE (all versions).
- Tracked via the `activation_block` column on the `stakes` table (set to `block_index + 6`).
- Active-stake queries filter by `activation_block <= current_block`.
- The 6-block figure is the BTC value (capability staking is BTC-only). Contract-targeted STAKE v3 runs on every chain and uses a per-chain calibrated delay for equivalent ~60-min reorg protection: **6 blocks on BTC, 24 on LTC, 60 on DOGE**, set via each chain's `STAKING.ACTIVATION_DELAY_BLOCKS` default.

## Storage Model
Each STAKE action (v1 or v2) inserts a new row into the `stakes` table. The active stake amount for a pubkey is `SUM(amount)` across all valid rows for that pubkey within the activation window. This append-only ledger preserves rollback correctness: block-level rewinds simply delete rows past the rewind point.

## Notes
- Use `UNSTAKE` to begin the cooldown period and recover staked tokens for a pubkey.
- Use `DELEGATE` to rotate the signing key without un-staking.
- Slashing burns from the unified stake pool. If a slash drops total stake below another capability's `min_stake`, that capability is collaterally lost at the next snapshot.
- See `PRICE` action documentation for the `price` capability's role in PBFT consensus.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
