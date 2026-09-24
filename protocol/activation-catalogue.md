<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Activation Module Catalogue

This page is the discovery index for activation modules referenced by the indexer's
`src/protocol_changes` registry. The module prefixes below are stable lookup identifiers, not ACTION
names. A module can export companion constants in addition to its activation map.

For current thresholds, use [Flag-Day Values](./flag-days.md). For gate evaluation, network key
selection, activation cohorts, and straggler behavior, use
[Protocol Activation](./protocol-activation.md). This catalogue deliberately does not copy threshold
values because those values can be repinned.

The **Unit** column is the registry unit of the principal activation row. `time` compares block time,
`height` compares a block or anchor height, `epoch` compares the ROLLCALL epoch height, `ruleset`
selects a named train ruleset, and `constant` means the principal row is a fixed value rather than a
per-network threshold. `mixed` means the module contains more than one kind of registry payload.
Follow the linked protocol activation guide before assuming that two height-keyed modules read the
same chain or field.

## A through D

| Module prefix | Principal registry row | Unit |
|---|---|---|
| `amount_representability_activation` | `AMOUNT_REPRESENTABILITY_ACTIVATION` | time |
| `anchor_activation` | `ANCHOR_ACTIVATION` | height |
| `anchor_reward_activation` | `ANCHOR_REWARD_ACTIVATION` and related anchor/archive reward gates | height |
| `archive_batch_author_activation` | `ARCHIVE_BATCH_AUTHOR_ACTIVATION` | height |
| `archive_head_unverified_gate_activation` | `ARCHIVE_HEAD_UNVERIFIED_GATE_ACTIVATION` | height |
| `archive_rollback_author_scope_activation` | `ARCHIVE_ROLLBACK_AUTHOR_SCOPE_ACTIVATION` | height |
| `attest_admission_activation` | `ATTEST_ADMISSION_ACTIVATION` | height |
| `attest_broadcast_fee_activation` | `ATTEST_BROADCAST_FEE_ACTIVATION` | height |
| `attest_relay_activation` | `ATTEST_RELAY_ACTIVATION` | height |
| `attest_relay_reject_slot_activation` | `ATTEST_RELAY_REJECT_SLOT_ACTIVATION` | time |
| `attest_request_cap_activation` | `ATTEST_REQUEST_CAP_ACTIVATION` | height |
| `attest_response_mirror_activation` | `ATTEST_RESPONSE_MIRROR_ACTIVATION` | height |
| `attest_responsible_widening_activation` | `ATTEST_RESPONSIBLE_WIDENING_ACTIVATION` | height |
| `attest_zero_conf_activation` | `ATTEST_ZERO_CONF_ACTIVATION` | height |
| `caret_ref_strict_activation` | `CARET_REF_STRICT_ACTIVATION` | height |
| `checkpoint_commitment_activation` | `CHECKPOINT_COMMITMENT_ACTIVATION` | height |
| `consolidation_leg_amount_activation` | `CONSOLIDATION_LEG_AMOUNT_ACTIVATION` | time |
| `cross_chain_royalty_activation` | `CROSS_CHAIN_ROYALTY_ACTIVATION` | height |
| `dispense_cancelling_match_activation` | `DISPENSE_CANCELLING_MATCH_ACTIVATION` | time |
| `dispense_payment_tally_scale_activation` | `DISPENSE_PAYMENT_TALLY_SCALE_ACTIVATION` | time |
| `dispenser_amount_positivity_activation` | `DISPENSER_AMOUNT_POSITIVITY_ACTIVATION` | time |
| `dispenser_caps_activation` | `DISPENSER_CAPS_ACTIVATION` | time |
| `dispenser_freshness_activation` | `DISPENSER_FRESHNESS_ACTIVATION` | height |
| `dispenser_freshness_shape_activation` | `DISPENSER_FRESHNESS_SHAPE_ACTIVATION` | height |
| `dispenser_give_amount_activation` | `DISPENSER_GIVE_AMOUNT_ACTIVATION` | time |
| `dispenser_oracle_price_activation` | `DISPENSER_ORACLE_PRICE_ACTIVATION` | time |
| `dispenser_ownership_cancel_activation` | `DISPENSER_OWNERSHIP_CANCEL_ACTIVATION` | time |
| `dispenser_send_amount_compare_activation` | `DISPENSER_SEND_AMOUNT_COMPARE_ACTIVATION` | height |

## G through P

| Module prefix | Principal registry row | Unit |
|---|---|---|
| `gated_handoff_ref_activation` | `GATED_HANDOFF_REF_ACTIVATION` | time |
| `ledger_amount_precision_activation` | `LEDGER_AMOUNT_PRECISION_ACTIVATION` | height |
| `list_edit_resolution_activation` | `LIST_EDIT_RESOLUTION_ACTIVATION` | height |
| `list_owner_activation` | `LIST_OWNER_ACTIVATION` | height |
| `mirror_admission_activation` | `MIRROR_ADMISSION_ACTIVATION` and `MIRROR_ADMISSION_CONSUMER_ACTIVATION` | height |
| `oracle_preload_causality_activation` | `ORACLE_PRELOAD_CAUSALITY_ACTIVATION` | height |
| `oracle_snapshot_age_causality_activation` | `ORACLE_SNAPSHOT_AGE_CAUSALITY_ACTIVATION` | height |
| `oracle_stale_round_visibility_activation` | `ORACLE_STALE_ROUND_VISIBILITY_ACTIVATION` | height |
| `price_batching_floor_activation` | `PRICE_BATCHING_FLOOR_ACTIVATION` | time |
| `price_fee_batch_landed_activation` | `PRICE_FEE_BATCH_LANDED_ACTIVATION` | height |
| `price_pair_activation` | `PRICE_PAIR_WIDEN_ACTIVATION` | time |
| `price_scale_activation` | `PRICE_SCALE_ACTIVATION` | time |
| `price_sig_tally_activation` | `PRICE_SIG_TALLY_ACTIVATION` | height |
| `price_zero_validity_activation` | `PRICE_ZERO_VALIDITY_ACTIVATION` | time |

## R through X

| Module prefix | Principal registry row | Unit |
|---|---|---|
| `retraction_signing_activation` | `RETRACTION_SIGNING_ACTIVATION` | height |
| `rollcall_activation` | `ROLLCALL_ACTIVATION` | epoch |
| `rollcall_gates_activation` | `ROLLCALL_GATES_ACTIVATION` | epoch |
| `slash_grid_activation` | `SLASH_GRID_ACTIVATION` | height |
| `slash_ledger_consolidation_activation` | `SLASH_LEDGER_CONSOLIDATION_ACTIVATION` | height |
| `stake_key_reuse_activation` | `STAKE_KEY_REUSE_ACTIVATION` | height |
| `stake_weight_collation_activation` | `STAKE_WEIGHT_COLLATION_ACTIVATION` | height |
| `state_commitment_activation` | `STATE_COMMITMENT_ACTIVATION` | height |
| `state_key_collation_activation` | `STATE_KEY_COLLATION_ACTIVATION` | height |
| `state_subtree_activation` | `STATE_SUBTREE_ACTIVATION` and `ESCROW_LOCKED_LEAF_ACTIVATION` | mixed |
| `sweep_zero_leg_activation` | `SWEEP_ZERO_LEG_ACTIVATION` | height |
| `swq_source_cap_activation` | `SWQ_SOURCE_CAP_ACTIVATION` | height |
| `tick_namespace_activation` | `TICK_NAMESPACE_ACTIVATION` | height |
| `token_bridge_activation` | `TOKEN_BRIDGE_ACTIVATION` | height |
| `token_policy_activation` | `TOKEN_POLICY_INHERITANCE_ACTIVATION` | height |
| `train_activation` | `TRAIN_ACTIVATION` | ruleset |
| `vm_deploy_lint_pkg3_activation` | `VM_DEPLOY_LINT_PKG3_ACTIVATION` | height |
| `vm_exec_lint_activation` | `VM_EXEC_LINT_ACTIVATION` | height |
| `vm_lint_global_alias_activation` | `VM_LINT_GLOBAL_ALIAS_ACTIVATION` | height |
| `xchain_bridge_activation` | `XCHAIN_BRIDGE_ACTIVATION` | height |

## Maintenance rule

When an indexer change introduces a new `*_activation` module prefix under
`src/protocol_changes`, add it here in the same change train. Keep the exact lowercase prefix so
repository-wide documentation coverage checks can match the registry reference. Document mutable
thresholds on the generated flag-day page instead of copying them into this catalogue.
