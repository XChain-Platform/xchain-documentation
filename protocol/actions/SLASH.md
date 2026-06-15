<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - SLASH
A **permissionless** proof that a capability validator *equivocated* — signed two conflicting values for the same protocol slot (same consensus engine, same round, **and** same view). Anyone may submit the proof; the offender's entire capability bond is burned deterministically on every BTC indexer. There is no privileged accuser and no off-chain data: the proof is self-contained and self-verifying.

This is the economic consumer of the **EQUIV signed header** (WI-2 bump 2). Every federated-consensus signature is prefixed with `EQUIV|<ENGINE_TAG>|<ROUND_ID>|<VIEW>||<CONTENT>`; equivocation is then precisely *the same `(engine, round, view)` signed over different `<CONTENT>`*. Including `<VIEW>` is what keeps an honest **view change** (which re-signs different content for the same round under a *different* view) from ever looking like equivocation.

For the full design see `claude/reports/2026-06-14_cross-chain-quorum-security-spec.md` §4.1, §5, §9.1.

## PARAMS
| Name              | Type   | Description                                                                                  |
| ----------------- | ------ | -------------------------------------------------------------------------------------------- |
| `VERSION`         | Integer| Format version (`0`).                                                                         |
| `CAPABILITY`      | String | The staking capability the equivocation was in: `cross_chain`, `oracle_publish`, `price`, or `attestation`. Must match the engine the `EQUIV_KEY` names. |
| `OFFENDER_PUBKEY` | String | The equivocating validator's Ed25519 capability signing key, 64 hex chars.                    |
| `EQUIV_KEY`       | String | `ENGINE_TAG\|ROUND_ID\|VIEW` — the header prefix both signed messages share through `<VIEW>`. `ROUND_ID` may itself contain `\|` and is never field-split. |
| `MSG_A`           | String | base64url of the first signed canonical (an `EQUIV`-headered string).                         |
| `SIG_A`           | String | Ed25519 signature over `MSG_A` by `OFFENDER_PUBKEY`, 128 hex chars.                           |
| `MSG_B`           | String | base64url of the second signed canonical. Equal to `MSG_A` through the header, **different** in `<CONTENT>`. |
| `SIG_B`           | String | Ed25519 signature over `MSG_B` by `OFFENDER_PUBKEY`, 128 hex chars.                           |

## Formats

### Version `0` — Equivocation slash
- `VERSION|CAPABILITY|OFFENDER_PUBKEY|EQUIV_KEY|MSG_A|SIG_A|MSG_B|SIG_B`
- **BTC chain only** — capability stake is BTC-only.

## Examples
```
SLASH|0|cross_chain|abc1...ef|XDEX|m_42|3|<b64 msgA>|<sigA>|<b64 msgB>|<sigB>
Proof that the validator abc1...ef signed two different XMATCH settlements for cross-chain
match m_42 at view 3. Burns its entire cross_chain bond.
```

## Rules
The slash is applied **only** when every check passes; otherwise the action is recorded `invalid` and nothing is burned.

1. **EQUIV header + key.** `MSG_A` and `MSG_B` must both literally begin with `EQUIV|<EQUIV_KEY>||` (same engine, round, **and** view). Because the view is in the key, an honest view change cannot be paired; because the v0 per-block checkpoint and the v1 archive use distinct round ids, they cannot be falsely paired either.
2. **Conflicting content.** The bytes after the header must differ. Identical messages (e.g. a PREPARE and a COMMIT over the same value) are **not** equivocation and are rejected.
3. **Signatures.** Both `SIG_A` and `SIG_B` must verify against `OFFENDER_PUBKEY` over the full signed bytes.
4. **Membership.** `OFFENDER_PUBKEY` must have been in `CAPABILITY`'s locked validator snapshot at the slot's `snapshot_block`. The `snapshot_block` is recovered deterministically from the proof itself — from the signed content for `XDEX` / `XCALL` / `XCHECKPOINT`, from the round id for `XORACLE` (the round *is* a BTC block), and from the referenced request for `XATTEST`. `CAPABILITY` must be the one the engine maps to (it is derived, not trusted).
5. **Idempotency.** A first valid proof burns the **whole** bond — active stake and cooldown-locked unstakes alike. Later proofs for the same `(OFFENDER_PUBKEY, CAPABILITY)` are no-ops.

### Effect
- The offender's entire capability bond (active `stakes` + cooldown-locked `unstakes`) is burned in place; each reduction is logged so a chain reorg restores the pre-slash amounts exactly.
- The submitter receives a capped **bounty** and the remainder is routed to a governance **treasury** (both governance-configured; until set, the burn pays no bounty and routes nothing — a pure burn).
- A `capability_slash_events` audit row records the burn, the proven `EQUIV_KEY`, and the bounty/treasury split.

### Activation
SLASH only ever *accepts* proofs whose messages carry the EQUIV header, so equivocation slashing is naturally inert until the EQUIV header's BTC-anchored flag-day — it cannot act on any pre-flag-day (headerless) signature.

> **Not yet slashable:** the config-change engine (`XCONFIG`) is out of scope for this version — its signed canonical carries no recoverable `snapshot_block`. See the WI-2 bump 2 handover for the open follow-up.
