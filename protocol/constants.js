/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC – https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md. A commercial
 * license (without AGPL source-disclosure terms) is available -
 * contact legal@dankest.llc.
 *
 **********************************************************************
 *
 * XChain Protocol: Canonical Size Limits
 *
 * Single documented source of truth for the protocol-level size caps
 * that more than one service enforces independently. These values had
 * drifted apart before (services each re-declared their own copy and
 * applied it to subtly different quantities), which produced a class of
 * silent-failure bugs where one service accepted data another rejected.
 *
 * Plain CommonJS, zero dependencies; require()-able from any service,
 * tool, or test. Each service keeps its own local copy of these values
 * so it stays self-contained for deployment (the services ship as
 * independent containers and do not share a node_modules tree); the
 * cross-service regression suite asserts every local copy equals the
 * value declared here, so the limits can never silently diverge again.
 *
 ********************************************************************/

// Maximum *compiled* on-chain ACTION push, in bytes.
//
// This is measured against the reassembled script push as it appears on
// chain (i.e. the OP_PUSHDATA-prefixed buffer, BEFORE bitcoin.script.decompile
// strips the push prefix. The indexing decoder is the protocol arbiter: it
// drops any transaction whose compiled ACTION push exceeds this value, so the
// encoder must enforce the identical compiled-size ceiling. A transaction the
// encoder produces above this size would be silently dropped by every node.
const MAX_ACTION_DATA_LENGTH = 8192;

// Taproot-envelope payload ceiling, PER-ENCODING by design: only the
// TAPROOT envelope lane gets it; every legacy lane keeps MAX_ACTION_DATA_LENGTH
// (a global raise would multiply the chunk-lane abuse ceiling ~50x for no
// benefit). Measures the REASSEMBLED envelope payload byte length after
// concatenation of the payload pushes, before parse; the envelope's own
// 520-byte push framing is not counted. Note the deliberate difference from
// MAX_ACTION_DATA_LENGTH, which is framing-inclusive of the single on-chain
// push: the two constants measure different things. Enforced identically in
// the block and mempool paths.
//
// DERIVED FROM WEIGHT, NOT CHOSEN AS A ROUND BYTE COUNT. The binding
// limit is MAX_STANDARD_TX_WEIGHT: a reveal over it is non-standard and no node
// relays it, so a ceiling that admits one strands the commit that funded it.
// Payload bytes ride the witness at ~1 WU each, plus ~3 bytes of OP_PUSHDATA2
// framing per 520-byte chunk (~0.58%) and ~480 WU of fixed input/output/control
// -block overhead. Measured against the real script builder: 400,000 payload
// bytes compile to a 402,353-byte tapscript and a 402,789 WU reveal, which is
// OVER the limit; the true maxima are 397,228 bytes with a P2WPKH change output
// and 397,009 with P2TR change plus a stripped-floor pad. 390,000 sits 7,050 WU
// under the limit in the worst reveal shape, which absorbs a larger change
// output and the §3.5 extra reveal inputs/outputs without going non-standard.
// The 400,000 shipped before 2026-07-31 admitted an unbroadcastable band of
// roughly 397,010..400,000 that the encoder built and the validator accepted.
// If this ever rises, re-derive it from MAX_STANDARD_TX_WEIGHT rather than
// picking a number, and re-check the ratio-cap note below.
const ENVELOPE_MAX_PAYLOAD = 390000;

// Bitcoin Core's MAX_STANDARD_TX_WEIGHT policy limit, in weight units. Exported
// so ENVELOPE_MAX_PAYLOAD's derivation above is checkable by a test that builds
// a real max-payload envelope rather than trusting the arithmetic in a comment.
const MAX_STANDARD_TX_WEIGHT = 400000;

// Bytes added by the OP_PUSHDATA2 push prefix (1-byte opcode + 2-byte
// little-endian length) when a 256..65535-byte payload is compiled into the
// on-chain script. For a single such push the compiled length is therefore
// (decoded payload bytes + OP_RETURN_PUSH_OVERHEAD); smaller payloads use a
// 1- or 2-byte prefix, and multi-segment encodings add one prefix per segment.
// This is why the authoritative cap is enforced on the *compiled* length, not
// on the decoded character count.
const OP_RETURN_PUSH_OVERHEAD = 3;

// Maximum smart-contract source code size, in bytes (64 KiB). Enforced by the
// SDK (pre-flight validation), the indexer (DEPLOY processing) and the VM
// (isolate limit). These were each declared independently and are kept in
// lockstep by the same regression suite.
const MAX_CODE_SIZE = 65536;

// Cross-contract calls (emit.execute). Maximum call depth: a user-submitted
// EXECUTE runs at depth 0; each emit.execute hop adds 1. Enforced by the VM at
// emit time and re-validated by the indexer when it processes the emission.
const VM_MAX_CALL_DEPTH = 4;

// Minimum caller-funded gas reservation per emit.execute call. Bounds call-tree
// fan-out: every call costs at least (VM_EMISSION + VM_MIN_CALL_GAS) out of the
// caller's own gas budget. Enforced by the VM and the indexer in lockstep.
const VM_MIN_CALL_GAS = 5000;

// ── Cross-CHAIN contract calls (emit.crossExecute / XCALL) ──────────────────
// Enforced by the VM at emit time and re-validated host-side by the indexer
// (processEmission + actions/xcall.js); the target chain re-validates the
// signed dispatch row before injecting. See protocol/cross-chain-calls.md.

// Target-side gas ceiling bounds. The injected execution is fee-less on the
// target chain (the caller pre-paid on the source chain), so the per-call cap
// is much tighter than the same-chain 1M execution ceiling. The minimum equals
// VM_MIN_CALL_GAS.
const XCALL_MIN_GAS = 5000;
const XCALL_MAX_GAS = 200000;

// Cross-chain hop budget: a user-originated call is hop 1; a call emitted from
// a cross-chain-injected execution (or from a result callback) is hop 2; more
// requires a fresh user transaction. Bounds X→Y→X ping-pong, which is
// otherwise free after the first hop (injected executions have no fee payer).
const XCALL_MAX_HOPS = 2;

// Source-chain deadline window (blocks). Must comfortably exceed both chains'
// relay confirmation depths plus federation rounds; expiry past deadline_block
// is synthesized deterministically by every source-chain indexer.
const XCALL_MIN_DEADLINE_BLOCKS = 10;
const XCALL_MAX_DEADLINE_BLOCKS = 4000;

// Return payload cap, bytes (pre-base64). The payload is mirrored to every
// indexer and ANCHOR-archived on DOGE; an oversize return becomes status
// 'payload_too_large' with an EMPTY payload (deterministic. Never truncated).
const XCALL_MAX_RETURN_BYTES = 1024;

// Deterministic per-block injection cap on each target chain. Overflow carries
// forward to the next block in (snapshot_block, call_id) order. Never dropped.
const XCALL_MAX_CALLS_PER_BLOCK = 25;

// Age-out window (seconds of consensus block time, measured from a mirrored
// result row's quorum-signed effective_time) past which the SOURCE chain retires
// a result row it can never deliver.
//
// A result row whose call_id matches no local XCALL v0 request is rejected on
// every block and pruned by nothing (pruning is keyed on a recorded callback),
// so a handful of such rows permanently occupy the head of the
// XCALL_MAX_CALLS_PER_BLOCK delivery slice and starve every real result behind
// them. The mirrored row carries no deadline_block of its own, so the age-out
// clock is effective_time: the federation only signs a result after the request
// is buried at its source chain's relay confirmation depth, and one hour covers
// the deepest of those windows (BTC 6 blocks x 600s, LTC 12 x 150s, DOGE 60 x
// 60s). A request still absent an hour past effectiveness is absent because its
// branch is gone, not because this node is behind, and no honest reorg brings it
// back. Where a local request DOES exist (routing mismatch, or a definitively
// unquorate result), its own deadline_block is the exact age-out clock and this
// window is not used.
//
// Retirement is CONSENSUS-VISIBLE: it mints an action row and frees a slot in a
// capped per-block pass, which decides which block a real callback lands in. It
// is therefore flag-day gated (XCALL_RESULT_ORPHAN_RETIREMENT in the indexer's
// protocol_changes.js) and anchored to a rollback-able action_index, so a
// source-chain reorg that restores the missing request also erases the
// retirement and the result delivers normally.
const XCALL_RESULT_ORPHAN_GRACE_SECONDS = 3600;

// ── ATTEST expiry sweep ─────────────────────────────────────────────────────
// Deterministic per-block cap on the ATTEST v0 deadline-expiry sweep.
// Each expired request synthesizes an ATTEST v2 action that flips the request to
// 'expired' and fires its callback, so an unbounded sweep lets a single block
// inherit an arbitrary backlog: one block's processing time (and its actions
// rows) becomes a function of how many requests happened to expire at once,
// which an attacker controls by batching requests with a common deadline.
//
// Overflow carries forward to the next block rather than being dropped: the
// selection is ordered (deadline_block ASC, action_index ASC), a TOTAL order
// because action_index is unique, so the same requests expire in the same order
// on every node, just spread across more blocks. Mirrors the XCALL sibling cap
// above in both value and carry-forward semantics.
//
// CONSENSUS-VISIBLE: the cap decides which block an expiry lands in, which moves
// actions rows, the contract hash and the checkpoint preimage. It ships ungated
// because the fleet-wide replay recomputes all of it.
const ATTEST_MAX_EXPIRIES_PER_BLOCK = 25;

// ── Cross-chain settlement pass ─────────────────────────────────────────────
// Deterministic per-block cap on the CROSS_SETTLE pass, the one
// cross-chain pass that had none: the indexer looped every finalized, effective,
// unsettled match its hub mirror carried, so a mirror backlog injected an unbounded
// number of escrow-releasing actions into a single block transaction, the same
// block-processing-timeout shape the two caps above exist to prevent.
//
// Overflow carries forward rather than being dropped: the selection is ordered
// (snapshot_block ASC, match_id ASC) over quorum-agreed row content, a total order,
// so every operator takes the identical capped prefix and the remainder settles in
// the next block. Mirrors both sibling caps in value and carry-forward semantics.
//
// CONSENSUS-VISIBLE, like both siblings: the cap decides which block a settlement
// lands in. Unlike ATTEST_MAX_EXPIRIES_PER_BLOCK it has no fleet-wide replay behind
// it, and the fresh-genesis testnet restart does not cover mainnet, so enforcing it
// on an already-live chain would reinterpret settled history. The operator ruled on
// 2026-08-11 that it lands behind a flag day rather than ungated: the gate is
// CROSS_SETTLE_PER_BLOCK_CAP in the indexer's protocol_changes.js, genesis-active on
// testnet and regtest and unarmed on mainnet until the operator ratifies the anchor.
// The value below is the cap; the gate decides when it applies. Before the flag day a
// mainnet block settles the full effective backlog, exactly as it always has.
const CROSS_SETTLE_MAX_PER_BLOCK = 25;

// ── Token-gated content (PC-29) ─────────────────────────────────────────────
// Fixed fractional scale for comparing FILE.GATE_MIN_AMOUNT thresholds against a
// holder's balance. The wallet scales both sides to this many fractional digits
// as BigInt (packages/core THRESHOLD_SCALE); the indexer compares with mathjs
// bignumber. A threshold carrying MORE decimal places than this is
// unrepresentable on the wallet side, so the two implementations would disagree
// on the last digit for values neither considers malformed. The indexer therefore
// bounds a threshold's decimal places at min(gate tick divisibility,
// THRESHOLD_SCALE) rather than at divisibility alone.
//
// Cross-repo twin: xchain-wallet packages/core THRESHOLD_SCALE. These two must
// move together or the disagreement returns.
const THRESHOLD_SCALE = 18;

// ── Chunked DEPLOY (DEPLOY v4 carriers + DEPLOY v2/v3 assemble) ─────────────
// A contract whose base64(code) exceeds the single-tx budget is split across
// ordered DEPLOY v4 carrier actions and reassembled by a DEPLOY v2/v3 keyed on
// the CODE_HASH. Enforced by the indexer (deploy_chunk + deploy assembly) and
// the SDK (chunkHelper splitter) in lockstep.

// Maximum number of chunks one DEPLOY may assemble. base64(MAX_CODE_SIZE) is
// ~87.4 KB; at the conservative per-chunk part budget below that is ~12 chunks,
// so 16 leaves headroom while bounding assembler work + chunk-table DoS.
const MAX_DEPLOY_CHUNKS = 16;

// Maximum bytes of base64 code carried by a single DEPLOY v4 carrier's CODE_PART.
// Sized so the compiled v4 carrier action (action prefix + 64-char CODE_HASH +
// indices + the part) stays comfortably under MAX_ACTION_DATA_LENGTH including
// the OP_PUSHDATA2 prefix. The SDK splits at this size; the indexer rejects a
// larger part (belt-and-suspenders; the decoder already drops oversize pushes).
const MAX_DEPLOYCHUNK_PART_BYTES = 7800;

// ── BATCH command cap (BATCH_ISSUANCE_LIMITS) ───────────────────────────────
// Maximum number of ;-separated sub-commands one BATCH action may carry. The
// count is the raw semicolon-separated list after the `BATCH|<VERSION>|`
// prefix, including empty elements, so 250 commands plus a trailing `;`
// counts as 251 and is over the cap. Checked FIRST, before every other
// batch-level rule. A denial-of-service bound on indexer processing cost
// (every parse-valid sub-command costs an ACTION_INDEX, mappings and,
// on failure, an invalid row), not a product quota: an issuer with 500
// children uses two transactions.
//
// Enforced by the indexer (actions/batch.js `this.commandLimit`) and the SDK
// (batchLimits.js `BATCH_COMMAND_LIMIT`), each its own local copy; this
// cross-service regression suite (protocol-constant-claims.test.js) asserts
// both copies and every prose claim equal this value.
//
// Gated by BATCH_ISSUANCE_LIMITS in the indexer's protocol_changes.js:
// active from genesis on testnet/regtest, not yet armed on mainnet (see
// protocol/actions/batch.md). Before that instant mainnet enforces no
// command cap at all; this constant is the value the gate gives it.
const BATCH_COMMAND_LIMIT = 250;

// ── Stake-weighted quorum (STAKE_WEIGHTED_QUORUM / WI-1) ────────────────────
// Consensus-critical activation: at/above this BTC-anchored snapshot_block the
// federation quorum becomes stake-WEIGHTED (signers' summed source stake must
// exceed 2/3 of total active snapshot stake) instead of count-based (2f+1 of the
// pubkey COUNT).
//
// Keyed on the BTC `snapshot_block` carried by every settlement/checkpoint
// canonical (NOT each chain's local processing height) so the hub and the BTC,
// LTC and DOGE indexers all flip on the SAME anchor. A per-chain local-height
// gate would fork: one snapshot_block lands at different local heights per chain.
// The `network` is also taken from the row, so the gate is env-independent.
//
// Enforced IDENTICALLY by the hub (every PBFT tally engine), the indexer
// (every settlement-signature gate + recovery), and the sdk/explorer/sync
// verifiers. All five keep a local copy of this map; the cross-service
// regression suite asserts they equal these values, so the activation height
// can never silently diverge (a divergence forks the chain).
//
// mainnet is ARMED (2026-07-07) to a concrete near-term height: 961000, the
// BTC-anchored flag-day at which mainnet flips from the count-based quorum
// rule to stake-weighted. BTC anchor ~2026-08-04; hub + ALL indexers (+
// sdk/explorer/sync copies) MUST deploy before this height. testnet/regtest
// activate at genesis so the e2e / regtest stack exercises stake-weighting
// from block 0.
const STAKE_WEIGHTED_QUORUM_ACTIVATION = {
    mainnet: 961000,      // ARMED 2026-07-07: BTC anchor ~2026-08-04; deploy hub + ALL indexers (+ sdk/explorer/sync copies) before this height
    testnet: 0,
    regtest: 0,
};

// EQUIV_HEADER_ACTIVATION (WI-2 bump 2): the BTC-anchored flag-day at/above which every
// consensus canonical is prefixed with a uniform signed header
// `EQUIV|<ENGINE_TAG>|<ROUND_ID>|<VIEW>||<CONTENT>`. This is consensus-breaking (it changes the
// signed preimage of every settlement/checkpoint/price/attestation signature + the config-change
// PBFT canonical), so it is gated, kept byte-identical to the local copies in
// xchain-{hub,indexer,sdk,explorer,sync}/src/equivocation_header.js by the
// cross-service regression suite, and must deploy hub + ALL indexers atomically. Its sole
// consumer is the SLASH v0 equivocation-slashing action, which is only constructible from
// post-flag-day (header-carrying) messages. Same ARMED height and deploy-by convention as
// STAKE_WEIGHTED_QUORUM_ACTIVATION: mainnet is armed to 961000 (2026-07-07; BTC anchor
// ~2026-08-04), not a disabled placeholder.
const EQUIV_HEADER_ACTIVATION = {
    mainnet: 961000,      // ARMED 2026-07-07: BTC anchor ~2026-08-04; deploy hub + ALL indexers (+ sdk/explorer/sync copies) before this height
    testnet: 0,
    regtest: 0,
};

// CANONICAL_REORG_BUFFER / SNAPSHOT_BURIAL_ACTIVATION: a hub never resolves a
// capability snapshot at the height it was handed. CapabilitySnapshot subtracts
// CANONICAL_REORG_BUFFER first, because stake state at the tip is not reorg-safe, while the
// wire keeps the RAW height (the signed checkpoint's snapshot_block, the mirrored
// capability_snapshots rows, an ATTEST request's block_index). The convention is that every
// consumer buries exactly once, locally; the defect was that only the hub did, so the three
// verifier families that re-derive the set from on-chain state (indexer attest.js, indexer
// recovery.js, sdk light.js) resolved a different set than the signer whenever a validator's
// stake activated or deactivated inside (H - 6, H]. Burying changes ACCEPTANCE, so it is
// flag-day gated: INERT on mainnet/testnet (null = never active) until the operator ratifies a
// coordinated BTC snapshot_block AND rules on artifacts already signed under the current
// reading; regtest active from genesis. Kept byte-identical to the local copies in
// xchain-{hub,indexer,sdk}/src/snapshot_reorg_buffer.js by the cross-service regression suite.
const CANONICAL_REORG_BUFFER = 6;
const SNAPSHOT_BURIAL_ACTIVATION = {
    mainnet: null,        // INERT placeholder: operator-ratify a BTC snapshot_block before arming
    // ARMED AT GENESIS, operator-ratified 2026-08-18 (pre-launch: every feature active on
    // testnet). Safe because testnet indexer state is REBUILT from the chain before launch and
    // testnet carries no quorum-signed artifacts to reinterpret (0 validators, 0 stakes, 0
    // checkpoints measured live). Mainnet keeps its own ratification.
    testnet: 0,
    regtest: 0,
};

// STATE_COMMITMENT_ACTIVATION (light-client SPV, spec §6.4): the flag-day at/above which
// each indexer computes + commits the additive per-block `state_root` (balances+stakes SMT)
// and `block_merkle_root`. ADDITIVE (the three consensus block hashes + BLOCK_HASH_VERSION are
// untouched), so it is not consensus-breaking by itself; it only adds new committed roots that
// the xchain-sync follower recomputes and HALTS on if they diverge. UNLIKE the two maps above,
// this gates on the chain's OWN local block_index (each chain starts committing its own per-block
// root at its own height); the Phase 2 checkpoint/ANCHOR extension that SIGNS these roots gates on
// snapshot_block. Kept byte-identical to the local copies in xchain-indexer/src/
// state_commitment_activation.js + xchain-sync/src/state_commitment_activation.js (and xchain-hub
// at Phase 2) by the cross-service regression suite. ARMED MID-CHAIN 2026-07-07 with per-chain
// '<COIN>:<network>' keys (one shared height cannot fit BTC ~957k and DOGE ~6.28M at once; bare
// network key remains for regtest; coin-less mainnet/testnet lookups stay inert). Same heights
// as the two state-hash gate maps, so ONE deploy-by date governs all Cohort-C flips; each height
// precedes the Cohort-B BTC anchor (961000) as the checkpoint-commitment ordering requires.
const STATE_COMMITMENT_ACTIVATION = {
    'BTC:mainnet':  958500,     // ARMED 2026-07-07 at tip 957062; ~10 days of margin
    'LTC:mainnet':  3143000,    // ARMED 2026-07-07 at tip 3138154; ~8 days
    'DOGE:mainnet': 6291000,    // ARMED 2026-07-07 at tip 6280094; ~7.5 days
    'BTC:testnet':  145000,     // ARMED 2026-07-07 at tip 143299
    'LTC:testnet':  4805000,    // ARMED 2026-07-07 at tip 4797675
    'DOGE:testnet': 67000000,   // ARMED 2026-07-07 at tip 66498605 (fast chain, wide margin)
    regtest: 0,                 // armed from genesis: fresh regtest stacks exercise the roots end to end
};

// CHECKPOINT_COMMITMENT_ACTIVATION (light-client SPV, spec §6.1/§6.3, Phase 2): the flag-day at/above
// which the quorum-signed checkpoint canonical (and the on-chain ANCHOR) COMMIT the additive
// `state_root` + `block_merkle_root` (with their version bytes) that STATE_COMMITMENT_ACTIVATION made
// the indexer compute in Phase 1. Post-flag-day the checkpoint canonical string gains
// `|STATE_ROOT|STATE_ROOT_VERSION|BLOCK_MERKLE_ROOT|BLOCK_MERKLE_VERSION` and a new ANCHOR v3 carries
// the roots on DOGE; pre-flag-day both keep their old shape and the roots are absent. Consensus-relevant
// for signature verification (the signed preimage changes), so it must deploy hub + ALL indexers + the
// SDK/explorer verifiers atomically.
//
// UNLIKE STATE_COMMITMENT_ACTIVATION (which gates on each chain's OWN local block_index, since each chain
// computes its own per-block root), this gates on the BTC-anchored `snapshot_block` carried by every
// checkpoint canonical, exactly like STAKE_WEIGHTED_QUORUM_ACTIVATION / EQUIV_HEADER_ACTIVATION, so the
// hub and the BTC/LTC/DOGE indexers all flip the SIGNED shape on the same anchor. The operator MUST pick
// a snapshot_block at/after which every checkpointed chain is already past its own STATE_COMMITMENT
// flag-day (else the engine would have no roots to sign). Kept byte-identical to the local copies in
// xchain-{hub,indexer,sdk,explorer,sync}/src/checkpoint_commitment_activation.js (sync consumes it at
// checkpoint.js to decide whether to expect the roots) by the cross-service regression suite. Same
// ARMED height and deploy-by convention as the maps above: mainnet is armed to 961000
// (2026-07-07; BTC anchor ~2026-08-04), not a disabled placeholder.
const CHECKPOINT_COMMITMENT_ACTIVATION = {
    mainnet: 961000,      // ARMED 2026-07-07: BTC anchor ~2026-08-04; deploy hub + ALL indexers (+ sdk/explorer/sync copies) before this height
    testnet: 146000,      // ARMED 2026-07-22 (commit 0e418c8c): first BTC-testnet anchor past all three STATE_COMMITMENT testnet thresholds; was 0, which forced the SPV root suffix from testnet genesis before the indexer computes roots, so the hub refused to sign every testnet checkpoint
    regtest: 0,
};

// ANCHOR_REWARD_ACTIVATION (anchor-reward re-derivation): the flag-day at/above which the validator
// anchor reward stops being TRUSTED from the hub's `pushvalidatorrewards` JSON-RPC and is instead
// DERIVED by every indexer from the on-chain ANCHOR bytes. Post-flag-day the hub emits a publisher-
// bearing ANCHOR (v4 rootless / v5 root-bearing) carrying the elected publisher pubkey plus a 2f+1
// `oracle_publish` attestation (XANCPUB) over the reward tuple; the indexer verifies that quorum and
// credits the publisher with ANCHOR_REWARD_AMOUNT (a frozen consensus constant, NEVER from the wire).
// Below the flag-day the old push path stands and v4/v5 anchors are rejected. Consensus-relevant (the
// credited reward becomes a COLLECT-spendable per-block ledger row), so it must deploy hub + ALL
// indexers atomically. Like CHECKPOINT_COMMITMENT_ACTIVATION / STAKE_WEIGHTED_QUORUM_ACTIVATION it gates
// on the BTC-anchored `snapshot_block` carried by every ANCHOR canonical. Kept byte-identical to the
// local copies in xchain-{hub,indexer}/src/anchor_reward_activation.js by the cross-service regression
// suite. Same ARMED height and deploy-by convention as the maps above: mainnet is armed to 961000
// (2026-07-07; BTC anchor ~2026-08-04), not a disabled placeholder.
const ANCHOR_REWARD_ACTIVATION = {
    mainnet: 961000,      // ARMED 2026-07-07: BTC anchor ~2026-08-04; deploy hub + ALL indexers (+ sdk/explorer/sync copies) before this height
    testnet: 0,
    regtest: 0,
};

// ANCHOR_REWARD_AMOUNT: the frozen validator anchor-publish reward, signed into the XANCPUB attestation
// by the hub and re-derived by the indexer (never from the wire). Changing it is itself a flag-day.
const ANCHOR_REWARD_AMOUNT = '10.00000000';

// ARCHIVE_REWARD_ACTIVATION (archive-reward re-derivation): the flag-day at/above which the
// anchor_archive reward stops riding the key-authenticated `pushvalidatorrewards` rail and is instead
// DERIVED by every indexer from the on-chain ANCHOR v6 bytes (the v1 archive anchor plus the same
// PUBLISHER + 2f+1 XANCPUB attestation tail as v4/v5, attested over an 'anchor_archive' canonical
// keyed on MATCH_BATCH_SEQ). This retires the last insider-with-key reward-forge surface the
// per-chain ANCHOR_REWARD flag-day left open. Below the flag-day the legacy v1 + push path stands
// and v6 anchors are rejected. Consensus-relevant, same deploy rules and snapshot_block gating as
// ANCHOR_REWARD_ACTIVATION; kept byte-identical to the local copies in
// xchain-{hub,indexer}/src/anchor_reward_activation.js by the cross-service regression suite.
const ARCHIVE_REWARD_ACTIVATION = {
    mainnet: 963000,      // ARMED 2026-07-16, RE-PINNED 2026-08-12 off 969500 onto the shared pre-freeze train boundary (tip 959,853 on 07-27 at ~144 blocks/day + 21d); deploy every consumer before this era
    testnet: 0,
    regtest: 0,
};

// ARCHIVE_REWARD_AMOUNT: the frozen archive-publish reward, signed into the archive XANCPUB
// attestation by the hub and re-derived by the indexer (never from the wire). Kept equal to the
// hub's historical default (ANCHOR_REWARD_PER_PUBLISH). Changing it is itself a flag-day.
const ARCHIVE_REWARD_AMOUNT = '10.00000000';

// ANCHOR_REWARD_DERIVE_ACTIVATION (Option C, derive-on-BTC-side): the flag-day at/above
// which anchor + archive reward derivation RELOCATES from the DOGE indexer to the BTC indexer.
// ANCHOR is DOGE-only, but capability staking (hence the resolvable stake source the reward write
// needs) is BTC-only, so the DOGE-side derivation gated by ANCHOR_REWARD_ACTIVATION /
// ARCHIVE_REWARD_ACTIVATION silently DROPS every publisher reward. At/above this gate the DOGE
// indexer skips the reward write, the hub INSERTs one append-only `anchor_reward_attestations`
// row per attested reward tuple after the XANCPUB quorum resolves (mirrored via hub_db_sync), and
// the BTC indexer derives the reward from the mirrored row (re-verifying the XANCPUB sigs against
// its own local oracle_publish/stake set at snapshot_block) into validator_rewards at
// block_index = snapshot_block. Consensus-relevant (COLLECT-spendable), same snapshot_block gating
// and atomic-deploy rules as ANCHOR_REWARD_ACTIVATION. It CANNOT ride the 961000/963000 boundaries
// (already live on testnet/regtest, so no coordinated flip window; and one gate must cover both
// the v4/v5 and v6 families). Kept byte-identical to the local copies in
// xchain-{hub,indexer}/src/anchor_reward_activation.js by the cross-service regression suite.
// INERT on mainnet (null = never active) until the operator ratifies a coordinated BTC
// snapshot_block; testnet and regtest are active from genesis. Testnet was armed at 0 by the
// 2026-08-11 operator ruling: it was re-genesised with no pre-flag history, so there is no
// legacy set to diverge from and no mid-upgrade window to protect, and it is where the
// relocated derive path gets exercised before mainnet ratifies a height.
const ANCHOR_REWARD_DERIVE_ACTIVATION = {
    mainnet: null,        // INERT placeholder: operator-ratify a BTC snapshot_block before arming
    testnet: 0,           // ARMED at genesis 2026-08-14 per the 2026-08-11 operator ruling
    regtest: 0,
};

// ANCHOR_REWARD_MIRROR_MATURITY (the fleet-agreed mirror-completeness watermark, in BTC
// blocks). Derivation under the gate above does NOT mature a mirrored attestation at
// snapshot_block: that height is the one the XANCPUB signing set was resolved at and is
// already in the past when the row is written (the hub writes only after the DOGE anchor is
// buried, after the publisher failover ladder, and after the hub-to-hub federation hop), so
// keying maturity on it let two nodes with different mirror contents derive the same reward
// at different BTC heights. A row instead matures at snapshot_block + this constant, and a
// node whose attestation mirror is not provably caught up defers the block rather than
// deriving a partial set. It moves the block a COLLECT-spendable reward materializes at, so
// it is a hashed value frozen with the map above; changing it needs its own flag-day. Kept
// byte-identical to xchain-{hub,indexer}/src/anchor_reward_activation.js.
const ANCHOR_REWARD_MIRROR_MATURITY = 144;   // ~24h of BTC blocks

// RETRACTION_SIGNING_ACTIVATION (quorum-class retraction co-signing): the BTC-anchored
// snapshot_block era at/above which a mirror REFUSES an unsigned quorum-class retraction
// broadcast. Vendored byte-equal into xchain-{indexer,hub,explorer}/src/
// retraction_signing_activation.js; a one-sided edit lets the hub sign under one era rule
// while a mirror enforces another, forking the fleet at the boundary. Canonical map of
// record for those copies (armed 2026-07-16).
const RETRACTION_SIGNING_ACTIVATION = {
    mainnet: 963000,      // ARMED 2026-07-16, RE-PINNED 2026-08-12 off 969500 onto the shared pre-freeze train boundary (tip 959,853 on 07-27 at ~144 blocks/day + 21d); deploy every consumer before this era
    testnet: 0,
    regtest: 0,
};

// CROSS_CHAIN_ROYALTY_ACTIVATION (cross-chain royalty match-canonical): the flag-day at/above which
// the validator-signed XMATCH canonical carries the matched orders' royalty payout legs
// (a_payout_legs / b_payout_legs), so a colluding hub cannot strip a royalty from a cross-chain
// match; below it the canonical stays byte-identical to the legacy format, so pre-existing
// signatures keep verifying. Consensus-relevant (the signed preimage changes), so it must deploy
// hub + ALL indexers atomically. Like CHECKPOINT_COMMITMENT_ACTIVATION / ANCHOR_REWARD_ACTIVATION
// it gates on the BTC-anchored `snapshot_block` carried by every XMATCH canonical. The CREATE-side
// acceptance rule (deny a royalty-bearing cross-chain listing while enforcement is impossible) is
// gated separately by the CROSS_CHAIN_ROYALTY entry in the indexer's protocol_changes.js; the
// operator MUST flip this canonical gate first or together with it, NEVER create-side first
// (create-side ON with canonical OFF would put the legs in unsigned mirror fields, the exact
// tamper hole the legs-in-canonical design closes). Kept byte-identical to the local copies in
// xchain-{hub,indexer}/src/cross_chain_royalty_activation.js by the cross-service regression
// suite. Same ARMED height and deploy-by convention as the maps above: mainnet is armed to
// 961000 (2026-07-07; BTC anchor ~2026-08-04), not a disabled placeholder.
const CROSS_CHAIN_ROYALTY_ACTIVATION = {
    mainnet: 961000,      // ARMED 2026-07-07: BTC anchor ~2026-08-04; deploy hub + ALL indexers before this height
    testnet: 0,
    regtest: 0,
};

// ATTEST_ADMISSION_ACTIVATION (Pkg 7 / 87441a53 admission rejection): the flag-day at/above
// which the indexer REJECTS an ATTEST v0 request whose responsible set at the request's own
// block is smaller than its REDUNDANCY. Such a request is unservable by construction: the hub
// refuses to start an unfinalizable round (AttestationConsensus.propose skips when
// responsible.length < redundancy, since the indexer requires >= redundancy valid signatures),
// so pre-gate the request would sit pending until deadline expiry. At/above the gate it is
// rejected at admission instead (immediate fee refund path: 'rejected' never escrows). This
// changes on-chain acceptance, so replay below the height must stay bit-identical: below it
// the legacy accept-then-expire behavior is preserved verbatim. Keyed on the request's own
// block_index + network like STAKE_WEIGHTED_QUORUM_ACTIVATION (the shrink this closes comes
// from that gate's source-dedupe), and armed to the SAME anchor so both rules flip together.
// Kept value-identical to the local copy in xchain-indexer/src/attest_admission_activation.js
// by the activation-constants parity suite.
const ATTEST_ADMISSION_ACTIVATION = {
    mainnet: 961000,      // ARMED: BTC anchor ~2026-08-04 (same anchor as STAKE_WEIGHTED_QUORUM); deploy ALL indexers before this height
    testnet: 0,
    regtest: 0,
};

// ATTEST_REQUEST_CAP_ACTIVATION (framework spec §11.1 per-block admission caps): the flag-day
// at/above which the indexer REJECTS an ATTEST v0 request that would exceed either the
// per-contract or the network-wide per-block admission ceiling (ATTEST_REQUEST_CAPS below).
//
// Why a protocol rule rather than a price: an admitted request obliges REDUNDANCY validators to
// make a provider call, and for the `llm` provider that call is a real invoice on each operator's
// own vendor account, while the requester pays a flat VM_ATTEST_REQUEST gas charge that is the
// same for a free HTTP GET as for a paid model. On a fee-bearing network economics bound the
// shape; on testnet neither the coin nor XCHAIN is scarce, so the bound must be consensus.
//
// REJECTION, not deferral: unlike the three sibling per-block caps (XCALL_MAX_CALLS_PER_BLOCK,
// ATTEST_MAX_EXPIRIES_PER_BLOCK, CROSS_SETTLE_MAX_PER_BLOCK) this caps admission of an action
// already in the block rather than a pass the indexer schedules, so there is no next block to
// carry overflow into. Over-cap requests go 'rejected' (terminal at creation, fee never escrowed).
//
// Counted deterministically from the attests table at (block_index = this block, action_index <
// this action, request_status <> 'rejected'): a total order every node replays identically.
//
// CONSENSUS-VISIBLE, so arming at 0 on a chain that already has history is replay-safe only if no
// past block ever admitted more than the cap - a chain-state question the CROSS_SETTLE_MAX_PER_BLOCK
// ruling refused to assume. For testnet it was MEASURED instead of assumed, across all three chains
// the `testnet` key covers: the live explorer reports `total: 0` attestation rows ever recorded on
// BTC, LTC and DOGE testnet alike (/{TBTC,TLTC,TDOGE}/api/attestations, checked 2026-08-18), so no
// block of any of them can have exceeded a cap of 10 and arming from genesis reinterprets nothing.
// testnet 0 is operator-ratified (2026-08-18) so the public testnet launches with the cap in force.
// regtest is armed at genesis (rebuilt from scratch). mainnet stays operator-owned and UNRATIFIED,
// and a null height reads as INERT, so mainnet runs the legacy uncapped path byte for byte until a
// height is pinned; mainnet HAS real attestation history, so pinning one there needs its own
// measurement rather than this result.
// Kept value-identical to the local copy in xchain-indexer/src/attest_request_cap_activation.js
// by the activation-constants parity suite.
const ATTEST_REQUEST_CAP_ACTIVATION = {
    mainnet: null,        // INERT: operator-owned height, unratified
    testnet: 0,           // ARMED at genesis (operator-ratified 2026-08-18; zero historical attestations, so nothing is reinterpreted)
    regtest: 0,           // ARMED at genesis so the e2e venue exercises the cap
};

// The cap VALUES the gate above applies. perContract keeps one busy or hostile contract from
// taking the whole ceiling and starving every other contract; perBlock is the number that bounds
// validator spend (at REDUNDANCY 3 and BTC's ~144 blocks/day a full 10/block admits ~1440
// requests/day, i.e. ~4320 provider calls/day across the responsible sets). Sized above any rate
// observed on any network today, so legitimate use never meets them.
const ATTEST_REQUEST_CAPS = {
    perContract: 2,
    perBlock:    10,
};

// ATTEST_RELAY_ACTIVATION (attestation Phase 5 cross-chain delivery): the flag-day
// at/above which the two relay legs of the §12 CrossChainEngine model are accepted on chain:
// ATTEST v3 (an LTC/DOGE-origin request materialized onto BTC, carrying 2f+1 cross_chain
// signatures) and ATTEST v4 (the BTC response relayed back to the origin chain, same signature
// rail). Both are new VERSION values on an existing action, so an indexer that has NOT been
// upgraded rejects them as an unknown VERSION while an upgraded one accepts: every indexer and
// hub MUST be deployed before this height, exactly like the sibling maps.
//
// Both legs carry an explicit BTC-anchored SNAPSHOT_BLOCK in their signed canonical, and THAT is
// what this gate is evaluated against, never a local height. Preserving the BTC plane is the whole
// point of the ratified model: CapabilitySnapshot keys the responsible set on a BTC block, and a
// foreign-origin block_index (DOGE ~6.3M / LTC ~3.16M vs BTC ~962K) would break the block-echo
// determinism check with no deterministic anchor. On BTC the v3's own block_index IS the anchor,
// so the responsible set for a relayed request resolves identically to a native one.
//
// The origin-side half of Phase 5 (admitting an LTC/DOGE v0 whose responsible set is empty, so it
// survives long enough to be relayed) is deliberately NOT gated here: it has no BTC anchor to key
// on, and a BTC-derived value compared against an LTC/DOGE local height is already satisfied there
// (the ATTEST_ADMISSION_ACTIVATION plane trap). That half rides the ATTEST_RELAY_ORIGIN block-time
// gate in xchain-indexer/src/protocol_changes.js, which flips every chain at one wall clock.
// Either order of the two gates is safe: origin-first admits requests nothing can service yet and
// they expire on their own deadline (the pre-Phase-5 outcome); BTC-first leaves no origin request
// to relay.
//
// Armed on the shared mainnet cohort anchor. Kept value-identical to the local copies in
// xchain-{hub,indexer}/src/attest_relay_activation.js by the activation-constants parity suite.
const ATTEST_RELAY_ACTIVATION = {
    mainnet: 963000,      // ARMED 2026-07-30 on the shared BTC anchor, RE-PINNED 2026-08-12 off 969500 with the rest of that cohort; deploy every indexer + hub before this height
    testnet: 0,
    regtest: 0,
};

// ATTEST_BROADCAST_FEE_ACTIVATION (attestation Phase 3 economics, spec §11 leader broadcast-fee
// reimbursement): the flag-day at/above which a FULFILLED ATTEST settle carves a broadcast-fee
// reimbursement out of the v0 fee escrow and pays it to the lowest-hash member of the request's
// responsible set, before splitting what is left equally across that set. Below the height the
// whole escrow goes to the split, so a from-genesis replay of historical blocks is bit-identical.
//
// This changes v0 ESCROW COMPUTATION, which is why it needs a height of its own rather than
// riding an existing anchor: two nodes on opposite sides of it settle the same request into
// different reward rows, and validator_rewards is COLLECT-spendable.
//
// Evaluated against the LOCAL block_index of the SETTLING action. That is safe without the
// plane caveat ATTEST_ADMISSION_ACTIVATION carries: the carve-out can only fire where the
// responsible set is non-empty, and attestation capability stake is BTC-only, so the only chain
// that reaches the predicate is the one whose local height IS a BTC height.
//
// UNALLOCATED. The four sub-decisions (denomination, broadcaster identity, height, amount bound)
// were pinned by the operator on 2026-08-11 with the HEIGHT explicitly reserved to the operator,
// so the implementation ships inert. Nearby cohort anchors in use are 961000, 962500 and 969500.
// Kept value-identical to xchain-indexer/src/attest_broadcast_fee_activation.js by the
// activation-constants parity suite.
// TESTNET ARMED AT 0, operator-ratified 2026-08-18 under the standing ruling that every platform
// feature must be ACTIVE on testnet. Safe by MEASUREMENT, not assumption: this gate only changes how
// a fulfilled ATTEST settle splits its escrow, and the live explorer reports `total: 0` attestation
// rows EVER recorded on BTC, LTC and DOGE testnet alike (/{TBTC,TLTC,TDOGE}/api/attestations, checked
// 2026-08-18), so no settle exists to reinterpret. Mainnet HAS attestation history and stays
// operator-owned; pinning a height there needs its own measurement rather than this result.
const ATTEST_BROADCAST_FEE_ACTIVATION = {
    mainnet: null,        // INERT placeholder: the operator owns this height (pinned 2026-08-11, unratified)
    testnet: 0,           // ARMED at genesis (operator-ratified 2026-08-18; zero historical attestation settles, so nothing is reinterpreted)
    regtest: 0,           // ARMED at genesis on regtest so the e2e venue exercises the carve-out
};

// ATTEST_BROADCAST_FEE_CAP: the per-provider broadcast-fee allowance the gate above pays out,
// denominated in NATIVE coin (whole coins, not satoshis) and converted to XCHAIN at the oracle
// price read at the SETTLE block. The allowance is paid FLAT rather than metered against the
// settling transaction's actual miner fee: that number comes from each node's own decoder and is
// not consensus-hashed, so keying a spendable reward on it would put per-node decoder output into
// the ledger.
//
// PROVIDERS holds the shipped per-provider figure; DEFAULT covers a provider registered through an
// operator ATTESTATION.PROVIDERS overlay that this map does not name; HARD_MAX clamps every
// resolved value including an overlay's, which is what keeps the bound consensus-visible instead
// of operator-controlled (without it a hostile overlay drains a request author's whole escrow into
// the leader's pocket). Consensus-visible the moment the gate arms, so a change needs its own
// flag-day exactly as the height does.
const ATTEST_BROADCAST_FEE_CAP = {
    DEFAULT:  '0.00010000',
    HARD_MAX: '0.00100000',
    PROVIDERS: {
        http_get: '0.00010000',
        llm:      '0.00010000',
    },
};

// ORACLE_FEE_OUTPUT_ACTIVATION (PRICE v1 oracle usage fee): the flag-day
// at/above which the DECODER persists a native-coin output paying a DISPENSER's
// ORACLE_ADDRESS into transaction_outputs, so the indexer's validateOracleFee can see the
// fee that was actually paid. Keyed on BLOCK TIME (not height) because dispensers settle on
// BTC, LTC and DOGE, whose heights diverge; compared with the same >= semantics the indexer's
// protocol_changes gates use.
//
// The mainnet value is NOT free to choose: capturing a second output on a data-bearing
// transaction makes it fan out to two rows in getDecoderBlockData, and BELOW the indexer's
// FIX_OUTPUT_FANOUT flag-day (protocol_changes.js, mainnet block_time 1786060800) such a
// transaction is a consensus-critical fault that HALTS the block. This gate must therefore
// never precede FIX_OUTPUT_FANOUT; it is armed to exactly the same instant so capture begins
// in the same block the collapse does. Below it a Mode B create against a fee-bearing oracle
// is rejected with 'missing oracle fee output' whether or not the payer paid, which is the
// fail-closed direction and costs nothing while no mainnet chain holds a dispenser.
// testnet/regtest are genesis-on, matching FIX_OUTPUT_FANOUT there.
//
// Vendored byte-equal into xchain-decoder/src/protocol/constants.js; the parity suites keep
// the two copies and the indexer's FIX_OUTPUT_FANOUT timestamp in lockstep.
const ORACLE_FEE_OUTPUT_ACTIVATION = {
    mainnet: 1786060800,  // 2026-08-07 00:00:00 UTC, the contract-era flag-day FIX_OUTPUT_FANOUT rides
    testnet: 0,
    regtest: 0,
};

// ORACLE_FEE_SET_CAPTURE_ACTIVATION (PRICE v1 oracle usage fee, set-membership capture): the
// flag-day at/above which the DECODER captures a DISPENSER v2 (edit/refill) oracle-fee output
// by SET MEMBERSHIP over EVERY open Mode B dispenser of the paying SOURCE, instead of the one
// top-ranked row the legacy lookup picks. Keyed on BLOCK TIME with the same >= semantics as
// ORACLE_FEE_OUTPUT_ACTIVATION, which it never precedes: set capture only widens a capture
// that gate has already switched on.
//
// WHY IT EXISTS: a v2 payload names its target by DISPENSER_ACTION_INDEX, an id in the
// INDEXER's action space the decoder does not maintain, so the decoder resolves the oracle by
// SOURCE address. Capture is an address EQUALITY test, so when one source holds several open
// Mode B dispensers with DIFFERENT oracle addresses, a refill of any row but the top-ranked
// one resolves the wrong oracle, NOTHING is captured, and the indexer (which resolves the
// exact DISPENSER_ACTION_INDEX target) rejects a valid refill after the payer's native payment
// is already spent. Testing membership over the whole set captures the right output for every
// row; the extra outputs a multi-oracle source's refill may also capture are ones the indexer
// ignores, which is the over-capture direction the decoder's advisory open-view calls safe.
//
// CONSENSUS-AFFECTING: it changes the set of outputs persisted to transaction_outputs, so an
// ungated widening breaks from-genesis byte-identity and forks validators. The legacy
// single-pick therefore stays live BELOW the gate, and a re-decode of pre-flag-day history
// reproduces exactly what the fleet wrote live.
//
// null means DISARMED (never active), the fail-closed default: mainnet and testnet keep the
// legacy single-pick until that network's maintainers ratify an instant, chosen with the
// fleet's upgrade state in hand, because arming it too early forks the chain and arming it in
// the past rewrites agreed history. regtest holds no agreed history (its chains are recreated
// per run), so it is genesis-on and exercises the set path in the regtest venues.
//
// DEPLOY DEADLINE, once an instant is armed: EVERY decoder on that network MUST be running the
// armed value before the instant, or the fleet splits on the first refill of a source holding
// more than one open Mode B dispenser.
//
// Vendored byte-equal into xchain-decoder/src/protocol/constants.js; the conformance suite
// keeps the two copies in lockstep and refuses a value that precedes
// ORACLE_FEE_OUTPUT_ACTIVATION.
const ORACLE_FEE_SET_CAPTURE_ACTIVATION = {
    mainnet: null,        // DISARMED: awaiting the operator's ratified per-network instant
    // ARMED AT GENESIS (instant 0 = always in force), operator-ratified 2026-08-18 under the
    // pre-launch ruling that every feature must be ACTIVE on testnet. This gate fixes a defect
    // that spends a payer native coin and gives nothing back, so a public testnet WILL hit it.
    // Safe at 0 because testnet decoder/indexer state is REBUILT from the chain before launch.
    testnet: 0,
    regtest: 0,
};

// DISPENSER_EXPIRY_REALIGN_ACTIVATION (dispenser soft-expire measurement point): the flag-day
// at/above which the DECODER soft-expires open dispensers AFTER the block's transaction loop
// instead of before it, putting its measurement point where the INDEXER's already is. Keyed on
// BLOCK TIME with the same >= semantics as ORACLE_FEE_OUTPUT_ACTIVATION, because dispensers
// settle on BTC, LTC and DOGE, whose heights diverge.
//
// WHY IT EXISTS: the two services expire the same dispenser at opposite ends of the same block.
// The decoder runs db.deleteOpenDispensers BEFORE its transaction loop and then loads the
// open-dispenser address set the loop tests every output against, so on the FIRST block whose
// header time passes an expiration the dispenser is already out of that set. The indexer runs
// utility.processExpirations AFTER its transaction loop (XChainIndexer.js, next to
// processBetPasses), so for every transaction in that same block it still treats the dispenser
// as open. The indexer only ever sees outputs the decoder persisted, so a native payment to
// that dispenser on the boundary block is dropped by the decoder and no DISPENSE ever reaches
// the indexer: the payer's coin is spent and nothing is dispensed for it. That is money-bearing
// and unreachable by any in-memory re-seed, because transactions preceding an edit in the block
// are already past.
//
// At/above the gate the soft-expire moves to the end of the block loop, inside the same block
// transaction, so both services measure expiry at the identical point and a boundary block
// yields the same DISPENSE set on both sides.
//
// CONSENSUS-AFFECTING: it changes the set of outputs persisted to transaction_outputs on
// boundary blocks, so an ungated move breaks from-genesis byte-identity and forks validators.
// The legacy block-start soft-expire therefore stays live BELOW the gate, and a re-decode of
// pre-flag-day history reproduces exactly what the fleet wrote live.
//
// null means DISARMED (never active), the fail-closed default: mainnet and testnet keep the
// legacy block-start expiry until that network's maintainers ratify an instant, chosen with the
// fleet's upgrade state in hand, because arming it too early forks the chain and arming it in
// the past rewrites agreed history. regtest holds no agreed history (its chains are recreated
// per run), so it is genesis-on and exercises the realigned path in the regtest venues.
//
// DEPLOY DEADLINE, once an instant is armed: EVERY decoder on that network MUST be running the
// armed value before the instant, or the fleet splits on the first block whose header time
// passes an open dispenser's expiration.
//
// Vendored byte-equal into xchain-decoder/src/protocol/constants.js; the conformance suite
// keeps the two copies in lockstep.
const DISPENSER_EXPIRY_REALIGN_ACTIVATION = {
    mainnet: null,        // DISARMED: awaiting the operator's ratified per-network instant
    // ARMED AT GENESIS (instant 0 = always in force), operator-ratified 2026-08-18 under the
    // pre-launch ruling that every feature must be ACTIVE on testnet. This gate fixes a defect
    // that spends a payer native coin and gives nothing back, so a public testnet WILL hit it.
    // Safe at 0 because testnet decoder/indexer state is REBUILT from the chain before launch.
    testnet: 0,
    regtest: 0,
};

// BATCH_SUBCOMMAND_OUTPUT_CAPTURE_ACTIVATION (payment-output capture through a BATCH): the
// flag-day at/above which the DECODER decides which native-coin outputs to persist by looking
// at a BATCH's SUB-COMMANDS instead of only at the top-level ACTION name. Keyed on BLOCK TIME
// with the same >= semantics as ORACLE_FEE_OUTPUT_ACTIVATION, because the affected settlement
// flows run on BTC, LTC and DOGE, whose heights diverge by millions of blocks.
//
// WHY IT EXISTS: capture reads the top-level action string. `decodedData.startsWith("COINPAY|")`
// is FALSE for `BATCH|0|COINPAY|0|x;COINPAY|0|y`, and the matching `startsWith("DISPENSER|")`
// used to resolve oracle-fee addresses is false for a batched DISPENSER, so a BATCH carrying
// either action persists NO settlement output and NO oracle-fee output. The indexer only ever
// sees outputs the decoder persisted, so a batched COINPAY reaches it with an empty
// COIN_DESTINATION and settles nothing, and a batched Mode B DISPENSER is rejected for a missing
// oracle fee whether or not the payer paid. Both are money-bearing: the payer's coin is spent and
// nothing settles. At/above the gate the capture decision runs over the batch's sub-command list,
// split exactly as the indexer's BATCH handler splits it, so a batched COINPAY captures the same
// outputs a top-level COINPAY does.
//
// CONSENSUS-AFFECTING: it changes the set of rows written to transaction_outputs, which changes
// indexer verdicts, which changes the ledger. An ungated flip makes a from-genesis re-decode
// capture outputs the live fleet never captured, so the legacy top-level-only view stays live
// BELOW the gate and pre-flag-day history re-decodes byte-identically.
//
// NEVER ARM IT BELOW two sibling instants, both asserted in the decoder's conformance suite:
//   * the indexer's FIX_OUTPUT_FANOUT. A BATCH is a data-bearing, non-COINPAY row, so the extra
//     captured outputs fan it out to several rows, and BELOW that flag-day the indexer treats
//     that as a consensus-critical fault and HALTS the block. Arming this gate earlier does not
//     merely change a verdict, it stops the chain.
//   * the indexer's BATCH_ISSUANCE_LIMITS, which carries the batch-cumulative settlement ledger.
//     Capture without that ledger lets N COINPAY sub-commands settle N obligations from ONE
//     payment, which is the defect that ledger closes; arming capture first would open it.
//
// null means DISARMED (never active), the fail-closed default: mainnet keeps the legacy
// top-level-only view until the operator ratifies an instant, chosen with the fleet's upgrade
// state in hand, because arming it too early forks the chain and arming it in the past rewrites
// agreed history. testnet and regtest are genesis-on, matching BOTH sibling gates there
// (FIX_OUTPUT_FANOUT and BATCH_ISSUANCE_LIMITS are all-zeros off mainnet), so the venues exercise
// the sub-command path from block 0.
//
// DEPLOY DEADLINE, once an instant is armed: EVERY decoder on that network MUST be running the
// armed value before the instant, or the fleet splits on the first BATCH carrying a COINPAY or a
// Mode B DISPENSER.
//
// Vendored byte-equal into xchain-decoder/src/protocol/constants.js; the conformance suite keeps
// the two copies in lockstep and refuses a mainnet arm that this canonical copy does not record.
const BATCH_SUBCOMMAND_OUTPUT_CAPTURE_ACTIVATION = {
    mainnet: 1786838400,  // ARMED 2026-08-14 (operator, pre-launch): 2026-08-16T00:00:00Z, the
                          // SAME instant as BATCH_ISSUANCE_LIMITS carries in the indexer. One
                          // decision, one boundary: arming the issuance rework WITHOUT this one
                          // ships a mainnet where a batched COINPAY spends the coin and settles
                          // nothing, and a batched DISPENSER create never dispenses, because
                          // capture would still read only the top-level ACTION name. DEPLOY
                          // DEADLINE: every decoder on mainnet must run this value BEFORE the
                          // instant, or the fleet splits on the first BATCH carrying a COINPAY
                          // or a Mode B DISPENSER.
    testnet: 0,
    regtest: 0,
};

// ENVELOPE_RECOGNITION_ACTIVATION (spec §7): the LOCAL block height
// at/above which the decoder recognizes Taproot-envelope reveals as
// action-bearing transactions, per host chain and network. Recognition (and
// the §3.8 mixed-carrier/multi-envelope rejections, which activate at the same
// height) is fleet-deterministic: every decoder for a chain+network MUST flip
// at the same height or the fleet forks on the first envelope. Keyed on each
// chain's OWN local block height (like STATE_COMMITMENT_ACTIVATION) because
// recognition happens while parsing that chain's blocks. DOGE has no segwit,
// hence no envelope: its entry is null (never active) and must stay null.
// MAINNET HEIGHTS PULLED IN 2026-08-02 by operator decision: BTC 961000 ->
// 960850, LTC 3160000 -> 3153500, both ~6 hours out from a measured tip (BTC
// 960812, LTC 3153356) rather than 2 and 12 days. The envelope is a pre-launch
// feature, and standing policy is that only post-launch features carry
// activation dates; the counter-case names the cheap remedy for a cohort
// already deployed and armed, which is to move the constant rather than rebase.
// The fleet has carried the envelope code since the 08-01 train, so nothing is
// wiped, replayed or rescanned. testnet/regtest stay genesis-active, as they
// always were: this gate only ever applied to mainnet. Every decoder on a chain
// MUST carry these values before its height or the fleet forks on the first
// envelope. Vendored byte-equal into xchain-decoder/src/protocol/constants.js;
// the cross-service regression suite keeps the copies in lockstep. Rollout
// order: decoder before encoder.
const ENVELOPE_RECOGNITION_ACTIVATION = {
    BTC:  { mainnet: 960850, testnet: 0, regtest: 0 },
    LTC:  { mainnet: 3153500, testnet: 0, regtest: 0 },
    DOGE: { mainnet: null, testnet: null, regtest: null },
};

// ── FILE payload compression (spec Part B) ───────────────────────────────────
//
// COMPRESSION is a trailing optional field on FILE v0:
//   FILE|0|NAME|TYPE|TITLE|MEMO|GATE_TICKER|ENCRYPTION_METHOD|KEY_HASH|GATE_MIN_AMOUNT|COMPRESSION
// Empty/absent = raw (every historical FILE); '1' = deflate-raw. The compressed
// bytes are what live on chain and in every database; the field tells a reader
// how to reconstruct the original byte-exactly.
//
// PRESENTATIONAL, NOT CONSENSUS (spec §5.5). FILE validity rules never inspect
// rawData content, so an indexer that has never heard of this field produces
// identical validity verdicts and identical state. That is why it ships as a
// trailing-field extension rather than a version bump, and it is also why the
// field must NEVER be validated: shipped indexers silently ignore unknown
// trailing fields, so a reader that rejected a malformed COMPRESSION value
// would fork validity across the fleet. Unknown or invalid codes degrade to
// serve-raw, everywhere, always.
const COMPRESSION_CODE_DEFLATE_RAW = '1';

// Serve-side decompression ratio cap, enforced as a STREAMED abort (spec §5.5):
// a crafted payload must not be able to bomb an explorer or wallet. 150:1 is
// chosen against deflate-raw's ~1032:1 theoretical maximum (a 1000:1 cap would
// guard nothing) while clearing real-world text ratios by a wide margin.
//
// There is deliberately no separate absolute output cap: ENVELOPE_MAX_PAYLOAD
// (390,000) makes ~58.5 MB the worst reachable inflation, so an absolute bound
// would be dead configuration. That implied bound is COUPLED to the envelope
// ceiling: if ENVELOPE_MAX_PAYLOAD ever rises, revisit this ratio.
const COMPRESSION_MAX_RATIO = 150;

// Pre-compression input cap on rawData at the encoder (spec §5.2). The encoder
// is a hard single-instance service (lockfile guard), so compression
// must be async/streamed and bounded; this is the bound. It applies to the
// bytes handed IN, before any compression attempt. The encoder never
// decompresses anything.
const COMPRESSION_MAX_INPUT_BYTES = 16 * 1024 * 1024;

// ── PRICE v0 pair-name format ─────────────────────────────────────────────────
//
// A PRICE v0 round names each pair as TICKER/FIAT. The ticker side has always been
// bounded to 5 characters, which cannot express the 6-character gas ticker XCHAIN,
// so the XCHAIN/USD pair the native-coin fee path requires is unrepresentable on
// the wire. Widening the bound to 6 is a CONSENSUS WIRE-FORMAT CHANGE: below the
// activation a round carrying XCHAIN/USD is rejected by every node, at/above it
// every node accepts it, and a one-sided deploy forks.
//
// Only the TICKER side widens. The fiat side stays at 5 because no FIAT_CODE
// exceeds 3 characters (VALID_FIAT_CODES below) and a wider bound there would only
// admit garbage this site does not otherwise validate.
//
// There is deliberately no per-entry-drop behaviour to gate. The pair set is inside
// the signed payload (buildPriceV0Payload reconstructs the signable bytes FROM the
// parsed pairs), so dropping one entry changes the payload and fails every
// signature: a signed round is atomic and MUST be accepted or rejected whole. The
// gate therefore changes exactly one thing, which pairs are well-formed.
//
// TIME-keyed, not height-keyed. A PRICE v0 action is parsed by the indexer of
// whichever chain carried it, and BTC/LTC/DOGE heights diverge, so no single height
// names one cutover. Same rationale as FIX_OUTPUT_FANOUT in
// xchain-indexer/src/protocol_changes.js.
//
// DEPLOY ORDER IS PART OF THIS GATE. Widen every hub and every indexer FIRST, while
// nothing proposes the pair; only then may a leader include XCHAIN/USD in a round.
// Reversed, the hub co-sign gate and ingest reject the whole round, stalling ALL 36
// pairs federation-wide and failing fee validation on every chain 1800s later.
const PRICE_PAIR_TICKER_MAX_LEGACY = 5;
const PRICE_PAIR_TICKER_MAX_WIDE   = 6;

// UNARMED on mainnet. 9999999999 is a far-future sentinel (year 2286), NOT a
// scheduled flag-day: the pre-launch instant this gate arms at is an
// open operator decision. The usual contract-era stamp 1786060800 (2026-08-07) is
// NOT usable here because it falls AFTER the early-September launch target, which
// would leave LTC/DOGE native-coin fees unpayable straight through launch. Arming
// is a one-line edit here plus the byte-equal edit in the vendored copies.
// testnet/regtest are genesis-on so the widened format is in force in the suites
// and on every test venue today.
const PRICE_PAIR_WIDEN_ACTIVATION = {
    mainnet: 9999999999,  // UNARMED sentinel, pending an open operator decision
    testnet: 0,
    regtest: 0,
};

// ── PRICE v0 signature-tally ordering ─────────────────────────────────────────
//
// The PRICE v0 tally keeps at most one signature per pubkey. Below this gate the
// pubkey enters the dedupe set on FIRST ENCOUNTER, ahead of the capability check
// and the ed25519 verify; at/above it, only AFTER the signature verifies. The
// one-per-pubkey cap is unchanged in both eras.
//
// Mark-then-verify is order-dependent: a garbage signature carrying a qualified
// oracle's pubkey, placed ahead of that oracle's real one, consumes the dedupe
// slot, so the real signature is skipped as a duplicate and a legitimately
// quorate round is rejected on chain. Every other tally site in the platform is
// verify-then-mark already; PRICE was the last pair.
//
// GATED, unlike the Pkg 13 sites, because PRICE is genesis-active on mainnet
// with a NON-EMPTY price-capability validator set and live history, so the
// emptiness argument that made those ungated-safe does not hold here. The change
// is monotone (the qualified-signer set only grows), which moves not just the
// count and stake-weighted quorum verdicts but the oracle_round REWARD SPLIT
// over that signer set, so an ungated change would make a from-genesis reindex
// diverge from the chain the fleet already agreed on. Below the gate the legacy
// ordering is preserved verbatim and replay stays bit-identical.
//
// Keyed on the round's BTC-anchored BTC_BLOCK_HEIGHT (carried inside the signed
// payload), exactly like STAKE_WEIGHTED_QUORUM_ACTIVATION: PRICE v0 is
// publishable on any chain and BTC/LTC/DOGE heights diverge by millions, so a
// local-height gate would flip LTC/DOGE months early. The hub push carries and
// validates the same field, so hub and indexers key on the identical number.
//
// mainnet is ARMED to 963000, the single BTC-height boundary the whole shared
// mainnet cohort shares after the re-pin of 2026-08-12 (off 969500, onto the
// shared pre-freeze train boundary), rather than a newly minted anchor, and
// deliberately not the nearer 961000 whose deploy train shipped on 2026-07-23 and
// whose height has already passed. Deploy every indexer AND every hub before
// this height; they are peers here, not producer and consumer, so a split fleet
// has the hub finalizing rounds the chain rejects. Kept value-identical to the
// local copies in xchain-{indexer,hub}/src/price_sig_tally_activation.js by the
// activation-constants parity suite.
const PRICE_SIG_TALLY_ACTIVATION = {
    mainnet: 963000,      // ARMED, RE-PINNED 2026-08-12 off 969500 onto the train boundary shared with RETRACTION_SIGNING; deploy ALL indexers + hubs before this height
    testnet: 0,
    regtest: 0,
};

// VALID_FIAT_CODES: the accepted FIAT_CODE allow-list for PRICE actions. The indexer's
// config['FIATS'] keys (xchain-indexer/src/config.js) are the on-chain arbiter; this list
// mirrors them in the indexer's insertion order. The SDK validator (VALID_FIAT_CODES) must
// be a byte-equal allow-list so it never refuses a FIAT the protocol accepts (it previously
// drifted, missing EUR and KRW). The cross-service parity test asserts SDK === this list.
const VALID_FIAT_CODES = ['USD', 'CAD', 'AUD', 'MXN', 'GBP', 'JPY', 'CNY', 'CHF', 'BRL', 'INR', 'EUR', 'KRW'];

// GAS_TICK: the protocol gas token's TICK. The indexer's config['GAS']
// (xchain-indexer/src/config.js) is the on-chain arbiter: it names the token
// debited for capability STAKE, VOTE deposits/escrows, contract gas billing,
// and every other gas-denominated flow. The SDK co-signer policy engine keys
// capability-STAKE spending caps to this tick (STAKE v1/v2 carry no TICK
// field). The cross-service parity test asserts indexer === SDK === this value.
const GAS_TICK = 'XCHAIN';

// ── Oracle federation (xchain-hub) ───────────────────────────────────────────
// Canonical source: xchain-hub/src/constants.js. UNLIKE XCALL_MAX_HOPS above, these
// two are NOT in the GOLDEN set of xcall-constants-cross-repo.test.js; the guard that
// diffs this published copy against the canonical lives in xchain-hub/test/unit
// (#3886), so a drift here reddens hub CI. No runtime code reads either one.

// Coarse global sanity ceiling on an ingested price_snapshots value (pre-scale,
// covers pairs like BTC/KRW up to ~$7M BTC with headroom); rejects
// parse-overflow / misplaced-decimal garbage. Per-pair outliers are caught by
// the co-sign deviation gate and multi-submitter aggregation, not here.
const PRICE_MAX = 10_000_000_000;

// Co-sign deviation band for the oracle PREPARE content-validation gate: a
// follower refuses to co-sign a proposed price that deviates more than this
// fraction from its own local aggregate for the pair. MUST be
// federation-uniform: if hubs used different bands, identical aggregates
// could yield different accept/withhold decisions (a liveness divergence on
// the ±band boundary). 0.05 = 5%.
const ORACLE_DEVIATION_THRESHOLD = 0.05;

module.exports = {
    MAX_ACTION_DATA_LENGTH,
    ENVELOPE_MAX_PAYLOAD,
    MAX_STANDARD_TX_WEIGHT,
    OP_RETURN_PUSH_OVERHEAD,
    MAX_CODE_SIZE,
    MAX_DEPLOY_CHUNKS,
    MAX_DEPLOYCHUNK_PART_BYTES,
    BATCH_COMMAND_LIMIT,
    VM_MAX_CALL_DEPTH,
    VM_MIN_CALL_GAS,
    XCALL_MIN_GAS,
    XCALL_MAX_GAS,
    XCALL_MAX_HOPS,
    XCALL_MIN_DEADLINE_BLOCKS,
    XCALL_MAX_DEADLINE_BLOCKS,
    XCALL_MAX_RETURN_BYTES,
    XCALL_MAX_CALLS_PER_BLOCK,
    XCALL_RESULT_ORPHAN_GRACE_SECONDS,
    ATTEST_MAX_EXPIRIES_PER_BLOCK,
    CROSS_SETTLE_MAX_PER_BLOCK,
    THRESHOLD_SCALE,
    STAKE_WEIGHTED_QUORUM_ACTIVATION,
    EQUIV_HEADER_ACTIVATION,
    CANONICAL_REORG_BUFFER,
    SNAPSHOT_BURIAL_ACTIVATION,
    STATE_COMMITMENT_ACTIVATION,
    CHECKPOINT_COMMITMENT_ACTIVATION,
    ANCHOR_REWARD_ACTIVATION,
    ANCHOR_REWARD_AMOUNT,
    ARCHIVE_REWARD_ACTIVATION,
    ARCHIVE_REWARD_AMOUNT,
    ANCHOR_REWARD_DERIVE_ACTIVATION,
    ANCHOR_REWARD_MIRROR_MATURITY,
    RETRACTION_SIGNING_ACTIVATION,
    CROSS_CHAIN_ROYALTY_ACTIVATION,
    ATTEST_ADMISSION_ACTIVATION,
    ATTEST_REQUEST_CAP_ACTIVATION,
    ATTEST_REQUEST_CAPS,
    ATTEST_RELAY_ACTIVATION,
    ATTEST_BROADCAST_FEE_ACTIVATION,
    ATTEST_BROADCAST_FEE_CAP,
    ORACLE_FEE_OUTPUT_ACTIVATION,
    ORACLE_FEE_SET_CAPTURE_ACTIVATION,
    DISPENSER_EXPIRY_REALIGN_ACTIVATION,
    BATCH_SUBCOMMAND_OUTPUT_CAPTURE_ACTIVATION,
    ENVELOPE_RECOGNITION_ACTIVATION,
    COMPRESSION_CODE_DEFLATE_RAW,
    COMPRESSION_MAX_RATIO,
    COMPRESSION_MAX_INPUT_BYTES,
    PRICE_PAIR_TICKER_MAX_LEGACY,
    PRICE_PAIR_TICKER_MAX_WIDE,
    PRICE_PAIR_WIDEN_ACTIVATION,
    PRICE_SIG_TALLY_ACTIVATION,
    VALID_FIAT_CODES,
    GAS_TICK,
    PRICE_MAX,
    ORACLE_DEVIATION_THRESHOLD,
};
