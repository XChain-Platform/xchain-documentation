/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC – https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md. A commercial
 * license (without AGPL source-disclosure terms) is available —
 * contact legal@dankest.llc.
 *
 **********************************************************************
 *
 * XChain Protocol — Canonical Size Limits
 *
 * Single documented source of truth for the protocol-level size caps
 * that more than one service enforces independently. These values had
 * drifted apart before (services each re-declared their own copy and
 * applied it to subtly different quantities), which produced a class of
 * silent-failure bugs where one service accepted data another rejected.
 *
 * Plain CommonJS, zero dependencies — require()-able from any service,
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
// chain — i.e. the OP_PUSHDATA-prefixed buffer, BEFORE bitcoin.script.decompile
// strips the push prefix. The indexing decoder is the protocol arbiter: it
// drops any transaction whose compiled ACTION push exceeds this value, so the
// encoder must enforce the identical compiled-size ceiling. A transaction the
// encoder produces above this size would be silently dropped by every node.
const MAX_ACTION_DATA_LENGTH = 8192;

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
// signed dispatch row before injecting. See protocol/Cross_Chain_Calls.md.

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
// forward to the next block in hub-id order. Never dropped.
const XCALL_MAX_CALLS_PER_BLOCK = 25;

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

// ── Stake-weighted quorum (STAKE_WEIGHTED_QUORUM / WI-1) ────────────────────
// Consensus-critical activation: at/above this BTC-anchored snapshot_block the
// federation quorum becomes stake-WEIGHTED (signers' summed source stake must
// exceed 2/3 of total active snapshot stake) instead of count-based (2f+1 of the
// pubkey COUNT). Spec: claude/reports/2026-06-14_cross-chain-quorum-security-spec.md.
//
// Keyed on the BTC `snapshot_block` carried by every settlement/checkpoint
// canonical (NOT each chain's local processing height) so the hub and the BTC,
// LTC and DOGE indexers all flip on the SAME anchor. A per-chain local-height
// gate would fork: one snapshot_block lands at different local heights per chain.
// The `network` is also taken from the row, so the gate is env-independent.
//
// Enforced IDENTICALLY by the hub (every PBFT tally engine) and the indexer
// (every settlement-signature gate + recovery). Both keep a local copy of this
// map; the cross-service regression suite asserts they equal these values, so
// the activation height can never silently diverge (a divergence forks the chain).
//
// mainnet is a PLACEHOLDER far-future height = DISABLED on mainnet until a
// coordinated flag-day height is chosen (mainnet keeps the current count rule
// until then — safe, no fork). testnet/regtest activate at genesis so the e2e /
// regtest stack exercises stake-weighting from block 0.
const STAKE_WEIGHTED_QUORUM_ACTIVATION = {
    mainnet: 999999999,   // PLACEHOLDER — set the real BTC flag-day height before mainnet enable
    testnet: 0,
    regtest: 0,
};

// EQUIV_HEADER_ACTIVATION (WI-2 bump 2) — the BTC-anchored flag-day at/above which every
// consensus canonical is prefixed with a uniform signed header
// `EQUIV|<ENGINE_TAG>|<ROUND_ID>|<VIEW>||<CONTENT>`. This is consensus-breaking (it changes the
// signed preimage of every settlement/checkpoint/price/attestation signature + the config-change
// PBFT canonical), so it is gated, kept byte-identical to the local copies in
// xchain-hub/src/equivocation_header.js + xchain-indexer/src/equivocation_header.js by the
// cross-service regression suite, and must deploy hub + ALL indexers atomically. Its sole
// consumer is the SLASH v0 equivocation-slashing action, which is only constructible from
// post-flag-day (header-carrying) messages. Same placeholder/genesis convention as
// STAKE_WEIGHTED_QUORUM_ACTIVATION (disabled on mainnet until a flag-day is chosen).
const EQUIV_HEADER_ACTIVATION = {
    mainnet: 999999999,   // PLACEHOLDER — set the real BTC flag-day height before mainnet enable
    testnet: 0,
    regtest: 0,
};

module.exports = {
    MAX_ACTION_DATA_LENGTH,
    OP_RETURN_PUSH_OVERHEAD,
    MAX_CODE_SIZE,
    MAX_DEPLOY_CHUNKS,
    MAX_DEPLOYCHUNK_PART_BYTES,
    VM_MAX_CALL_DEPTH,
    VM_MIN_CALL_GAS,
    XCALL_MIN_GAS,
    XCALL_MAX_GAS,
    XCALL_MAX_HOPS,
    XCALL_MIN_DEADLINE_BLOCKS,
    XCALL_MAX_DEADLINE_BLOCKS,
    XCALL_MAX_RETURN_BYTES,
    XCALL_MAX_CALLS_PER_BLOCK,
    STAKE_WEIGHTED_QUORUM_ACTIVATION,
    EQUIV_HEADER_ACTIVATION,
};
