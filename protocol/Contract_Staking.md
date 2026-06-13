# Contract-Targeted Staking

Smart contracts on XChain can declare themselves as staking targets at deploy time. Stakers can lock any token against a specific contract, and the contract's own logic (running in the VM) decides what staking unlocks and when to slash. This is layered on top of the existing capability-based staking (`price`, `cross_chain`, `oracle_publish`, `attestation`) — the two systems coexist, share no state, and use the same wire-level actions (`STAKE`, `UNSTAKE`, `DELEGATE`) at different version numbers.

## Wire formats

Contract-targeted staking uses new versions of three existing actions; capability versions are unchanged.

| Action | Capability version | Contract version |
|---|---|---|
| STAKE | v1 (new) / v2 (top-up) | **v3** |
| UNSTAKE | v0 | **v1** |
| DELEGATE (rotate) | v0 | **v1** |
| DELEGATE (revoke) | v2 | **v3** |
| DEPLOY | v0 | **v1** (adds optional staking metadata) |

```
STAKE|3|AMOUNT|SIGNING_PUBKEY|TARGET_CONTRACT_INDEX|TICK
UNSTAKE|1|SIGNING_PUBKEY|TARGET_CONTRACT_INDEX|TICK
DELEGATE|1|NEW_SIGNING_PUBKEY|TARGET_CONTRACT_INDEX|TICK
DEPLOY|1|CODE_ENCODING|GAS_LIMIT|CONSTRUCTOR_PARAMS|COOLDOWN_BLOCKS|SLASH_DESTINATION
```

### STAKE v3

| Field | Type | Description |
|---|---|---|
| AMOUNT | decimal string | Positive. Decimal places must not exceed the token's `decimals` value. |
| SIGNING_PUBKEY | 64-hex | Ed25519 pubkey. A given pubkey may be used independently for capability staking AND contract staking, but cannot collide across multiple contracts. |
| TARGET_CONTRACT_INDEX | unsigned int | The `action_index` of a contract deployed via `DEPLOY v1` with `COOLDOWN_BLOCKS` set. Must be in `valid` status. |
| TICK | string | Any registered token. Must exist in `tokens` at the action's block. |

Top-up vs. new is auto-detected: if `(target_contract_index, signing_pubkey, tick)` already has an active row, the action is treated as a top-up (must be owned by the same `SOURCE`). Otherwise it creates a new row.

Activation delay is calibrated per chain for roughly **60 minutes of reorg protection** — **6 blocks on BTC** (~10 min/block), **24 blocks on LTC** (~2.5 min/block), and **60 blocks on DOGE** (~1 min/block). Because contract staking runs on every chain, a single block count would give materially different wall-clock protection (6 blocks ≈ 6 minutes on DOGE), so each chain sets its own `STAKING.ACTIVATION_DELAY_BLOCKS` default; operators may override it per deployment. (Capability staking is BTC-only and uses the same 6-block BTC value.)

### UNSTAKE v1

Initiates the cooldown for a specific `(target_contract_index, signing_pubkey, tick)` triple. The cooldown duration is the contract's own `cooldown_blocks` value (NOT the global 1000-block cooldown used by capability staking).

Cooldown-locked balances **remain slashable** until they're released by the block-end sweep — withdrawing your stake is not a way to escape an imminent slash. Even in the final block of the cooldown (`cooldown_end_block = N`), a slash executing in block `N` reaches the locked balance before the sweep releases it — see [Cooldown release → Intra-block ordering](#intra-block-ordering-consensus-critical).

### DELEGATE v1

Rotates the signing pubkey on a contract-targeted stake. Pubkey-collision check is scoped to `contract_stakes` + `contract_delegations` only — a pubkey can simultaneously be a capability validator and a contract-stake signer.

### DEPLOY v1

Two new trailing fields beyond `DEPLOY v0`:

| Field | Type | Description |
|---|---|---|
| COOLDOWN_BLOCKS | unsigned int | Bounded [1, 100000]. If omitted, the contract is **not stakeable** (`STAKE v3` targeting it is rejected). Locked at deploy time — immutable. |
| SLASH_DESTINATION | address or `BURN` | Where slashed tokens are routed. `BURN` resolves to the chain's burn address. If `COOLDOWN_BLOCKS` is present but `SLASH_DESTINATION` is omitted, defaults to `BURN`. Locked at deploy time — immutable. |

`SLASH_DESTINATION` without `COOLDOWN_BLOCKS` is invalid.

## VM API: `xchain.contract.*`

A contract executing in the VM can read its own stake state and slash stakers via four methods. All four are gas-metered.

### `xchain.contract.getStake(pubkey, token) → string`

Returns the sum of active stake amounts for `(pubkey, token)` targeting **this** contract. Returns `'0'` if not found. Pre-activation stakes (within the 6-block activation window) are not yet visible. Gas: `VM_STATE_READ` (100).

### `xchain.contract.getTotalStaked(token) → string`

Total amount staked across all stakers of `(token)` on **this** contract. Gas: `VM_STATE_READ` (100).

### `xchain.contract.getStakers(token) → [{pubkey, amount}, ...]`

Array of stakers on `(token)` for **this** contract, sorted by `amount` descending, **capped at 1000 entries**. Contracts with more stakers see only the top 1000 — design contract logic accordingly. Gas: `VM_STATE_READ` (100).

### `xchain.contract.slash(pubkey, token, amount) → void`

Slashes `amount` of `token` from the staker identified by `pubkey` on **this** contract. Slashed tokens are routed to the contract's `SLASH_DESTINATION` (locked at deploy time).

- **Authorization is implicit.** The VM accessor only sees this contract's stakes — the slash can only target stakers of this contract.
- **Slash reaches active stakes first** (LIFO by activation block), then cooldown-locked balances if there's a remainder.
- **Over-slash is silently capped** at the staker's available balance. No error is thrown for "tried to slash 500 but only 200 was available" — only 200 is taken.
- **Atomic with the EXECUTE.** If the executing method reverts, the slash also rolls back.

Gas: `VM_EMISSION` (500).

A `slash_events` row is written for every successful slash: `{execution_index, target_contract_index, signing_pubkey_id, tick_id, amount, destination_id, block_index}`.

## Cooldown release

When a `contract_unstakes` row's `cooldown_end_block` ≤ current block:

1. The remaining `amount` (after any slashing) is credited back to the staker's source address.
2. The row is marked `completed` so it won't be swept again.

Tokens are debited from the staker at STAKE time and only credited back at the block-end sweep that catches the cooldown completion. There is no intermediate "release" action — it happens automatically.

The same sweep also finalizes capability `unstakes` (previously unaddressed) — contract staking and capability staking share the same cooldown finalization pass.

### Intra-block ordering (consensus-critical)

Within a single block `N`, **all transaction processing — including every EXECUTE and therefore every `xchain.contract.slash(...)` emission — runs BEFORE the cooldown release sweep.** The sweep is a block-END pass, never a block-start pass.

The boundary case this ordering decides: a `contract_unstakes` row with `cooldown_end_block = N` that is also slashed by an EXECUTE in block `N`. Canonical order:

1. The slash EXECUTE runs first and still reaches the cooldown-locked balance — the row has not been released yet and is not yet `completed`, so it remains inside the slash's reach (active stakes first, then cooldown-locked remainders).
2. The block-end sweep then releases only the **post-slash remainder** and marks the row `completed`.

An implementation that ran the release sweep at block START would credit the staker back before the slash EXECUTE, the same slash would find nothing slashable, and its ledger would diverge from the canonical one — a chain fork. **Slash-before-release within the same block is normative**, not an implementation detail.

## Isolation between capability and contract staking

| Property | Capability staking | Contract staking |
|---|---|---|
| Table | `stakes` / `unstakes` / `delegations` | `contract_stakes` / `contract_unstakes` / `contract_delegations` |
| Token | XCHAIN only | Any registered token |
| Qualification | Amount thresholds per built-in capability | Contract code decides what stake unlocks |
| Cooldown | Global 1000 blocks | Per-contract (declared at deploy, [1, 100000]) |
| Slash destination | Governance-level | Locked at contract deploy time |
| Wire version | STAKE v1/v2, UNSTAKE v0, DELEGATE v0/v2, COLLECT | STAKE v3, UNSTAKE v1, DELEGATE v1/v3 |

A pubkey staked in one system does NOT count toward the other. They are tracked entirely separately.

## What's intentionally not in v1

- **Per-contract slash rate limits.** Contracts self-regulate via their own reward/bond logic.
- **Partial-slash schedules.** `slash` is atomic; contracts implement graduated penalties by calling `slash` multiple times.
- **Pagination for `getStakers`.** Capped at 1000 entries; expand to offset/limit in a future version if needed.

## Worked example

```javascript
// Deploy a stakeable contract with 50-block cooldown, slashing to BURN
DEPLOY|1|<hex>|500000||50|BURN

// Stake 200 XCHAIN against contract #42 with a specific signing pubkey
STAKE|3|200.00000000|abc...64hex...|42|XCHAIN

// Contract method (in JS source):
//   - any caller can check whether `pubkey` has at least 100 XCHAIN staked
//   - only the contract itself can slash via xchain.contract.slash
module.exports = {
    isStaked: function() {
        let pubkey = xchain.getInputParam(0)
        return xchain.math.gte(xchain.contract.getStake(pubkey, 'XCHAIN'), '100') ? 'yes' : 'no'
    },
    punishMisbehavior: function() {
        let pubkey = xchain.getInputParam(0)
        // Slash 50 XCHAIN — funds go to BURN address per the deploy-time config.
        xchain.contract.slash(pubkey, 'XCHAIN', '50')
    }
}

// Begin unstaking (cooldown_end_block = current + 50)
UNSTAKE|1|abc...64hex...|42|XCHAIN

// Funds remain slashable during cooldown. 50 blocks later, the block-end sweep
// credits the remaining (post-slash) amount back to the staker's source address.
```
