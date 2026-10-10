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

For `attest_relay_response_deadline_activation`, `time` is the landing block's consensus timestamp
that activates enforcement. The response deadline itself remains in the origin chain's block-height
plane.

## A through E

| Module prefix | Principal registry row | Unit |
|---|---|---|
| `amount_representability_activation` | `AMOUNT_REPRESENTABILITY_ACTIVATION` | time |
| `anchor_activation` | `ANCHOR_ACTIVATION` | height |
| `anchor_archive_fold_term_activation` | `ANCHOR_ARCHIVE_FOLD_TERM_ACTIVATION` | height |
| `anchor_bundle_order_activation` | `ANCHOR_BUNDLE_ORDER_ACTIVATION` | height |
| `anchor_empty_fold_reject_activation` | `ANCHOR_EMPTY_FOLD_REJECT_ACTIVATION` | height |
| `anchor_fold_activation` | `ANCHOR_FOLD_ACTIVATION` | height |
| `anchor_preactivation_status_activation` | `ANCHOR_PREACTIVATION_STATUS_ACTIVATION` | height |
| `anchor_reward_activation` | `ANCHOR_REWARD_ACTIVATION` and related anchor/archive reward gates | height |
| `archive_batch_author_activation` | `ARCHIVE_BATCH_AUTHOR_ACTIVATION` | height |
| `archive_head_unverified_gate_activation` | `ARCHIVE_HEAD_UNVERIFIED_GATE_ACTIVATION` | height |
| `archive_match_count_activation` | `ARCHIVE_MATCH_COUNT_ACTIVATION` | height |
| `archive_rollback_author_scope_activation` | `ARCHIVE_ROLLBACK_AUTHOR_SCOPE_ACTIVATION` | height |
| `archive_section_verdict_activation` | `ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION` | height |
| `attest_admission_activation` | `ATTEST_ADMISSION_ACTIVATION` | height |
| `attest_broadcast_fee_activation` | `ATTEST_BROADCAST_FEE_ACTIVATION` | height |
| `attest_relay_activation` | `ATTEST_RELAY_ACTIVATION` | height |
| `attest_relay_fee_activation` | `ATTEST_RELAY_FEE_ACTIVATION` | height |
| `attest_relay_reject_slot_activation` | `ATTEST_RELAY_REJECT_SLOT_ACTIVATION` | time |
| `attest_relay_response_deadline_activation` | `ATTEST_RELAY_RESPONSE_DEADLINE_ACTIVATION` | time |
| `attest_request_cap_activation` | `ATTEST_REQUEST_CAP_ACTIVATION` | height |
| `attest_response_mirror_activation` | `ATTEST_RESPONSE_MIRROR_ACTIVATION` | height |
| `attest_responsible_widening_activation` | `ATTEST_RESPONSIBLE_WIDENING_ACTIVATION` | height |
| `attest_zero_conf_activation` | `ATTEST_ZERO_CONF_ACTIVATION` | height |
| `bet_feed_list_edit_activation` | `BET_FEED_LIST_EDIT_ACTIVATION` | height |
| `bridge_policy_detach_activation` | `BRIDGE_POLICY_DETACH` | height |
| `bridge_policy_refusal_record_activation` | `BRIDGE_POLICY_REFUSAL_RECORD_ACTIVATION` | height |
| `bridge_row_fields_terminal_activation` | `BRIDGE_ROW_FIELDS_TERMINAL_ACTIVATION` | height |
| `callback_compensation_activation` | `CALLBACK_COMPENSATES_EVERY_DEBITED_HOLDER` | height |
| `caret_ref_strict_activation` | `CARET_REF_STRICT_ACTIVATION` | height |
| `checkpoint_commitment_activation` | `CHECKPOINT_COMMITMENT_ACTIVATION` | height |
| `consolidation_leg_amount_activation` | `CONSOLIDATION_LEG_AMOUNT_ACTIVATION` | time |
| `cross_chain_offer_list_export_activation` | `CROSS_CHAIN_OFFER_LIST_EXPORT` | height |
| `cross_chain_remote_token_activation` | `CROSS_CHAIN_REMOTE_TOKEN_ACTIVATION` | height |
| `cross_chain_royalty_activation` | `CROSS_CHAIN_ROYALTY_ACTIVATION` | height |
| `dispense_cancelling_match_activation` | `DISPENSE_CANCELLING_MATCH_ACTIVATION` | time |
| `dispense_payment_tally_scale_activation` | `DISPENSE_PAYMENT_TALLY_SCALE_ACTIVATION` | time |
| `dispenser_amount_positivity_activation` | `DISPENSER_AMOUNT_POSITIVITY_ACTIVATION` | time |
| `dispenser_caps_activation` | `DISPENSER_CAPS_ACTIVATION` | time |
| `dispenser_delay_protocol_time_activation` | `DISPENSER_DELAY_PROTOCOL_TIME_ACTIVATION` | height |
| `dispenser_freshness_activation` | `DISPENSER_FRESHNESS_ACTIVATION` | height |
| `dispenser_freshness_proven_use_activation` | `DISPENSER_FRESHNESS_PROVEN_USE_ACTIVATION` | time |
| `dispenser_freshness_shape_activation` | `DISPENSER_FRESHNESS_SHAPE_ACTIVATION` | height |
| `dispenser_give_amount_activation` | `DISPENSER_GIVE_AMOUNT_ACTIVATION` | time |
| `dispenser_oracle_price_activation` | `DISPENSER_ORACLE_PRICE_ACTIVATION` | time |
| `dispenser_ownership_cancel_activation` | `DISPENSER_OWNERSHIP_CANCEL_ACTIVATION` | time |
| `dispenser_send_amount_compare_activation` | `DISPENSER_SEND_AMOUNT_COMPARE_ACTIVATION` | height |
| `dispenser_settlement_price_activation` | `DISPENSER_SETTLEMENT_PRICE_ACTIVATION` | time |
| `empty_allow_list_denies_activation` | `EMPTY_ALLOW_LIST_DENIES` | height |

## G through P

| Module prefix | Principal registry row | Unit |
|---|---|---|
| `gated_handoff_ref_activation` | `GATED_HANDOFF_REF_ACTIVATION` | time |
| `ledger_amount_precision_activation` | `LEDGER_AMOUNT_PRECISION_ACTIVATION` | height |
| `list_address_ref_activation` | `LIST_ADDRESS_REF_ACTIVATION` | height |
| `list_change_rematch_activation` | `LIST_CHANGE_REMATCH_ACTIVATION` | height |
| `list_edit_remove_activation` | `LIST_EDIT_REMOVE_ACTIVATION` | time |
| `list_edit_resolution_activation` | `LIST_EDIT_RESOLUTION_ACTIVATION` | height |
| `list_meta_activation` | `LIST_META_ACTIVATION` | height |
| `list_owner_activation` | `LIST_OWNER_ACTIVATION` | height |
| `list_reference_validity_activation` | `LIST_REFERENCE_REQUIRES_VALID_LIST` | height |
| `list_share_activation` | `LIST_SHARE_ACTIVATION` | height |
| `list_share_consumer_activation` | `LIST_SHARE_CONSUMER_ACTIVATION` | height |
| `list_share_producer_activation` | `LIST_SHARE_PRODUCER_ACTIVATION` | height |
| `list_tick_coin_activation` | `LIST_TICK_COIN_ACTIVATION` for coin-qualified ticker LIST items and the ISSUE colon-root refusal | height |
| `list_transfer_activation` | `LIST_TRANSFER_ACTIVATION` | height |
| `list_union_activation` | `LIST_UNION_ACTIVATION` | height |
| `market_list_source_activation` | `MARKET_LIST_SOURCE_ACTIVATION` | height |
| `mirror_admission_activation` | `MIRROR_ADMISSION_ACTIVATION` and `MIRROR_ADMISSION_CONSUMER_ACTIVATION` | height |
| `mirror_admission_margin_activation` | `ADMIT_CHAIN_MARGIN_ACTIVATION` | height |
| `oracle_hourly_window_activation` | `ORACLE_HOURLY_WINDOW_FIRST_ROUND` | constant |
| `oracle_preload_causality_activation` | `ORACLE_PRELOAD_CAUSALITY_ACTIVATION` | height |
| `oracle_price_age_hourly_activation` | `ORACLE_PRICE_AGE_HOURLY_ACTIVATION` | height |
| `oracle_round_time_activation` | `ORACLE_ROUND_TIME_ACTIVATION` | height |
| `oracle_snapshot_age_causality_activation` | `ORACLE_SNAPSHOT_AGE_CAUSALITY_ACTIVATION` | height |
| `oracle_snapshot_age_seconds_activation` | `ORACLE_SNAPSHOT_AGE_SECONDS_ACTIVATION` | height |
| `oracle_stale_round_visibility_activation` | `ORACLE_STALE_ROUND_VISIBILITY_ACTIVATION` | height |
| `order_swap_payout_policy_activation` | `ORDER_SWAP_PAYOUT_POLICY_PER_TOKEN` | height |
| `price_batching_floor_activation` | `PRICE_BATCHING_FLOOR_ACTIVATION` | time |
| `price_fee_batch_landed_activation` | `PRICE_FEE_BATCH_LANDED_ACTIVATION` | height |
| `price_landed_strict_activation` | `PRICE_LANDED_STRICT_ACTIVATION` | height |
| `price_pair_activation` | `PRICE_PAIR_WIDEN_ACTIVATION` | time |
| `price_scale_activation` | `PRICE_SCALE_ACTIVATION` | time |
| `price_sig_tally_activation` | `PRICE_SIG_TALLY_ACTIVATION` | height |
| `price_wire_trailing_activation` | `PRICE_WIRE_TRAILING_ACTIVATION` | height |
| `price_zero_validity_activation` | `PRICE_ZERO_VALIDITY_ACTIVATION` | time |

## R through X

| Module prefix | Principal registry row | Unit |
|---|---|---|
| `retraction_signing_activation` | `RETRACTION_SIGNING_ACTIVATION` | height |
| `rollcall_activation` | `ROLLCALL_ACTIVATION` | epoch |
| `rollcall_gates_activation` | `ROLLCALL_GATES_ACTIVATION` | epoch |
| `send_caret_pack_key_activation` | `SEND_CARET_PACK_KEY_ACTIVATION` | time |
| `send_gated_total_tick_id_activation` | `SEND_GATED_TOTAL_TICK_ID_ACTIVATION` | time |
| `slash_grid_activation` | `SLASH_GRID_ACTIVATION` | height |
| `slash_ledger_consolidation_activation` | `SLASH_LEDGER_CONSOLIDATION_ACTIVATION` | height |
| `stake_key_reuse_activation` | `STAKE_KEY_REUSE_ACTIVATION` | height |
| `stake_weight_collation_activation` | `STAKE_WEIGHT_COLLATION_ACTIVATION` | height |
| `state_commitment_activation` | `STATE_COMMITMENT_ACTIVATION` | height |
| `state_key_collation_activation` | `STATE_KEY_COLLATION_ACTIVATION` | height |
| `state_subtree_activation` | `STATE_SUBTREE_ACTIVATION` and `ESCROW_LOCKED_LEAF_ACTIVATION` | mixed |
| `swap_edit_rematch_activation` | `SWAP_EDIT_REMATCH_ACTIVATION` | height |
| `sweep_zero_leg_activation` | `SWEEP_ZERO_LEG_ACTIVATION` | height |
| `swq_source_cap_activation` | `SWQ_SOURCE_CAP_ACTIVATION` | height |
| `tick_namespace_activation` | `TICK_NAMESPACE_ACTIVATION` | height |
| `token_bridge_activation` | `TOKEN_BRIDGE_ACTIVATION` | height |
| `token_policy_activation` | `TOKEN_POLICY_INHERITANCE_ACTIVATION` | height |
| `train_activation` | `TRAIN_ACTIVATION` | ruleset |
| `vm_deploy_lint_pkg3_activation` | `VM_DEPLOY_LINT_PKG3_ACTIVATION` | height |
| `vm_exec_lint_activation` | `VM_EXEC_LINT_ACTIVATION` | height |
| `vm_lint_global_alias_activation` | `VM_LINT_GLOBAL_ALIAS_ACTIVATION` | height |
| `vm_lint_nesting_depth_activation` | `VM_LINT_NESTING_DEPTH_ACTIVATION` | height |
| `vm_lint_optional_chain_heights` | `VM_LINT_OPTIONAL_CHAIN_ACTIVATION` | height |
| `vote_callback_binding_activation` | `VOTE_CALLBACK_BINDING_REQUIRES_USABLE_METHOD` | height |
| `xchain_bridge_activation` | `XCHAIN_BRIDGE_ACTIVATION` | height |

## Maintenance rule

When an indexer change introduces a new `*_activation` module prefix under
`src/protocol_changes`, add it here in the same change train. Keep the exact lowercase prefix so
repository-wide documentation coverage checks can match the registry reference. Document mutable
thresholds on the generated flag-day page instead of copying them into this catalogue.
