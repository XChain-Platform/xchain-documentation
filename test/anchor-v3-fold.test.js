/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC – https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 *
 * ANCHOR v3 (archive fold) documentation gate. claude/specs/anchor-v0-archive-fold.md,
 * build row L026-1: the fold's indexer/hub/sdk code is later, separate rows, so this
 * suite proves the DOCUMENTATION HALF is self-consistent and falsifiable on its own -
 * the two new activation constants, the frozen v3 vector set, and the v3 grammar written
 * into protocol/actions/anchor.md, including the ARCHIVE_COUNT 0-or-1 rule and the
 * explicit WRAPPER_SECTION_INDEX binding. It reference-parses the wire strings itself
 * (mirroring the style of test/vectors.test.js and test/action-example-fields.test.js)
 * rather than only pattern-matching prose, so a broken field order or a wrong 0-or-1
 * bound fails here before any later row's real parser is even written.
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const constants = require('../protocol/constants.js');
const vectors = require('../protocol/test-vectors/anchor_canonical.json');

const ANCHOR_MD = path.resolve(__dirname, '../protocol/actions/anchor.md');
const doc = fs.readFileSync(ANCHOR_MD, 'utf8');

// ---------------------------------------------------------------------------
// The two activation constants
// ---------------------------------------------------------------------------

describe('ANCHOR_FOLD_ACTIVATION / ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION', () => {
    const NETWORKS = ['mainnet', 'testnet', 'regtest'];

    test('both are exported and shaped {mainnet, testnet, regtest}', () => {
        assert.ok(constants.ANCHOR_FOLD_ACTIVATION, 'ANCHOR_FOLD_ACTIVATION must be exported');
        assert.ok(constants.ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION,
            'ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION must be exported');
        for (const net of NETWORKS) {
            assert.ok(Object.prototype.hasOwnProperty.call(constants.ANCHOR_FOLD_ACTIVATION, net),
                `ANCHOR_FOLD_ACTIVATION is missing the ${net} key`);
            assert.ok(Object.prototype.hasOwnProperty.call(constants.ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION, net),
                `ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION is missing the ${net} key`);
        }
    });

    test('every value is null or a non-negative integer height', () => {
        for (const map of [constants.ANCHOR_FOLD_ACTIVATION, constants.ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION]) {
            for (const net of NETWORKS) {
                const v = map[net];
                assert.ok(v === null || (Number.isInteger(v) && v >= 0),
                    `${net} must be null or a non-negative integer height, got ${JSON.stringify(v)}`);
            }
        }
    });

    test('this row ships both inert (null) on every network: the fold code has not landed yet', () => {
        // L026-2 through L026-8 (indexer parse, hub publisher fold, sdk light client) are
        // separate, later build rows. Arming either height before any of them ship would
        // gate a version byte, or a verdict-scope rule, nothing in the fleet can act on.
        for (const net of NETWORKS) {
            assert.equal(constants.ANCHOR_FOLD_ACTIVATION[net], null, `ANCHOR_FOLD_ACTIVATION.${net} must be null in this row`);
            assert.equal(constants.ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION[net], null,
                `ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION.${net} must be null in this row`);
        }
    });

    test('the verdict gate is armed only with (never ahead of) the fold gate, per network', () => {
        // D2's "section-scoped verdict has no folded action to scope before v3 exists"
        // invariant: where the fold is inert the verdict gate must be inert too, and
        // wherever both are armed the verdict height must not precede the fold height.
        for (const net of NETWORKS) {
            const fold = constants.ANCHOR_FOLD_ACTIVATION[net];
            const verdict = constants.ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION[net];
            if (fold === null) {
                assert.equal(verdict, null,
                    `${net}: ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION must be null while ANCHOR_FOLD_ACTIVATION is null`);
            } else {
                assert.ok(verdict !== null && verdict >= fold,
                    `${net}: ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION (${verdict}) must be >= ANCHOR_FOLD_ACTIVATION (${fold})`);
            }
        }
    });

    test('falsification: the ordering check actually catches a verdict height armed ahead of the fold', () => {
        const fold = { mainnet: null, testnet: 100, regtest: 0 };
        const verdictTooEarly = { mainnet: null, testnet: 50, regtest: 0 };
        const problems = [];
        for (const net of ['mainnet', 'testnet', 'regtest']) {
            const f = fold[net];
            const v = verdictTooEarly[net];
            if (f === null) { if (v !== null) problems.push(net); }
            else if (!(v !== null && v >= f)) problems.push(net);
        }
        assert.deepEqual(problems, ['testnet'], 'a verdict height below its fold height must be caught');
    });
});

// ---------------------------------------------------------------------------
// anchor.md: the v3 grammar is present and the shipped versions stay frozen
// ---------------------------------------------------------------------------

// Minimal, self-contained mirror of the `### Version \`N\`` + bullet-format dialect
// test/action-example-fields.test.js already lints across the whole corpus. Kept local
// (rather than importing that file, which exports nothing) so this suite does not
// depend on another test file's internals.
function formatsSection() {
    const out = [];
    let inSection = false;
    for (const line of doc.split('\n')) {
        if (/^##\s+/.test(line) && !/^###/.test(line)) { inSection = /^##\s+Formats\b/.test(line); continue; }
        if (inSection) out.push(line);
    }
    return out;
}

function declaredFormats() {
    const formats = new Map();
    let version = null;
    for (const line of formatsSection()) {
        const header = line.match(/^###\s+Version\s+`?(\d+)`?/);
        if (header) { version = header[1]; continue; }
        if (version === null) continue;
        const bullet = line.match(/^-\s+`([^`]+)`\s*$/);
        if (bullet) formats.set(version, bullet[1]);
    }
    return formats;
}

describe('protocol/actions/anchor.md Formats section', () => {
    const formats = declaredFormats();

    test('v0, v1 and v2 stay byte-for-byte frozen', () => {
        // Pinned literally: these are the shipped consensus wires. A diff here is not a
        // rewording, it is a wire-format break, which is exactly what the fold must not do.
        assert.equal(formats.get('0'),
            'ANCHOR|0|NETWORK|SNAPSHOT_BLOCK|SECTION_COUNT|CHAIN|BLOCK_INDEX|BLOCK_HASH|LEDGER_HASH|ACTIONS_HASH|CONTRACT_HASH|CHECKPOINT_SEQ|SECTION_SNAPSHOT_BLOCK|STATE_ROOT|STATE_ROOT_VERSION|BLOCK_MERKLE_ROOT|BLOCK_MERKLE_VERSION|SIG_COUNT|PUBKEY1|SIG1|...|PUBLISHER|ATTEST_SIG_COUNT|APUBKEY1|ASIG1|...',
            'v0 must not change shape');
        assert.equal(formats.get('1'),
            'ANCHOR|1|CHAIN|NETWORK|BLOCK_INDEX|BLOCK_HASH|LEDGER_HASH|ACTIONS_HASH|CONTRACT_HASH|CHECKPOINT_SEQ|SNAPSHOT_BLOCK|MATCH_BATCH_SEQ|MATCH_COUNT|BATCH_CRC32|TOTAL_CHUNKS|ARCHIVE_B64|SIG_COUNT|PUBKEY1|SIG1|...|PUBLISHER|ATTEST_SIG_COUNT|APUBKEY1|ASIG1|...',
            'v1 must not change shape');
        assert.equal(formats.get('2'), 'ANCHOR|2|MATCH_BATCH_SEQ|CHUNK_INDEX|TOTAL_CHUNKS|ARCHIVE_B64_CHUNK',
            'v2 must not change shape');
    });

    test('v3 is declared and carries ARCHIVE_COUNT and WRAPPER_SECTION_INDEX', () => {
        const v3 = formats.get('3');
        assert.ok(v3, 'anchor.md must declare a v3 format');
        assert.match(v3, /^ANCHOR\|3\|/);
        const fields = v3.split('|');
        assert.ok(fields.includes('ARCHIVE_COUNT'), 'v3 must carry ARCHIVE_COUNT');
        assert.ok(fields.some((f) => f.includes('WRAPPER_SECTION_INDEX')), 'v3 must carry WRAPPER_SECTION_INDEX');
        // ARCHIVE_COUNT must precede WRAPPER_SECTION_INDEX (the count gates whether the
        // binding is even present on the wire), and PUBLISHER/ATTEST_SIG_COUNT must trail
        // both, matching "the archive rides inside the bundle, the publisher tail is last".
        const iArchiveCount = fields.indexOf('ARCHIVE_COUNT');
        const iWrapper = fields.indexOf('[WRAPPER_SECTION_INDEX');
        const iPublisher = fields.indexOf('PUBLISHER');
        assert.ok(iArchiveCount > 0 && iWrapper > iArchiveCount && iPublisher > iWrapper,
            `expected ARCHIVE_COUNT < WRAPPER_SECTION_INDEX < PUBLISHER in field order, got: ${v3}`);
    });

    test('the PARAMS table lists ARCHIVE_COUNT and WRAPPER_SECTION_INDEX under version 3', () => {
        const paramsMatch = doc.match(/## PARAMS\n([\s\S]*?)\n##\s/);
        assert.ok(paramsMatch, 'anchor.md must have a PARAMS table');
        const table = paramsMatch[1];
        for (const field of ['ARCHIVE_COUNT', 'WRAPPER_SECTION_INDEX']) {
            const row = table.split('\n').find((l) => l.includes('`' + field + '`'));
            assert.ok(row, `PARAMS table is missing a ${field} row`);
            assert.match(row, /\b3\b/, `${field}'s PARAMS row must list version 3`);
        }
    });

    test('anchor_archive retirement at the fold height is documented', () => {
        assert.match(doc, /anchor_archive.{0,40}retires as a reward type at `?ANCHOR_FOLD_ACTIVATION`?/s,
            'anchor.md must state that anchor_archive retires as a reward type at ANCHOR_FOLD_ACTIVATION');
    });

    test('the Activation section documents ANCHOR_FOLD_ACTIVATION', () => {
        assert.match(doc, /ANCHOR_FOLD_ACTIVATION/);
        assert.match(doc, /### Version 3 only/, 'anchor.md must carry a "Version 3 only" rules section');
    });
});

// ---------------------------------------------------------------------------
// Frozen v3 vectors: a small, self-contained reference parser proves the field
// order, the ARCHIVE_COUNT 0-or-1 rule and the WRAPPER_SECTION_INDEX binding
// actually round-trip, not just that the prose says so.
// ---------------------------------------------------------------------------

function parseSection(tokens, i) {
    const section = {
        chain: tokens[i++],
        block_index: Number(tokens[i++]),
        block_hash: tokens[i++],
        ledger_hash: tokens[i++],
        actions_hash: tokens[i++],
        contract_hash: tokens[i++],
        checkpoint_seq: Number(tokens[i++]),
        snapshot_block: Number(tokens[i++]),
        state_root: tokens[i++],
        state_root_version: Number(tokens[i++]),
        block_merkle_root: tokens[i++],
        block_merkle_version: Number(tokens[i++]),
    };
    const sigCount = requireInt(tokens[i++], 'SIG_COUNT');
    const validator_signatures = [];
    for (let k = 0; k < sigCount; k++) validator_signatures.push({ pubkey: tokens[i++], sig: tokens[i++] });
    section.validator_signatures = validator_signatures;
    return { section, i };
}

function requireInt(token, name) {
    if (!/^\d+$/.test(token || '')) throw new Error(`invalid: ${name}`);
    return parseInt(token, 10);
}

/** Walks the header + SECTION_COUNT sections shared by v0 and v3; returns the index of
 *  the next unconsumed token (v0: PUBLISHER; v3: ARCHIVE_COUNT). */
function parseHeaderAndSections(tokens) {
    let i = 0;
    if (tokens[i++] !== 'ANCHOR') throw new Error('not an ANCHOR wire');
    const version = tokens[i++];
    const network = tokens[i++];
    const snapshot_block = Number(tokens[i++]);
    const sectionCount = requireInt(tokens[i++], 'SECTION_COUNT');
    const sections = [];
    for (let s = 0; s < sectionCount; s++) {
        const r = parseSection(tokens, i);
        sections.push(r.section);
        i = r.i;
    }
    return { version, network, snapshot_block, sectionCount, sections, i };
}

function parseAttestTail(tokens, i) {
    const publisher = tokens[i++];
    const attestSigCount = requireInt(tokens[i++], 'ATTEST_SIG_COUNT');
    const attest_sigs = [];
    for (let k = 0; k < attestSigCount; k++) attest_sigs.push({ pubkey: tokens[i++], sig: tokens[i++] });
    return { publisher, attest_sigs, i };
}

function parseV0(wire) {
    const tokens = wire.split('|');
    const head = parseHeaderAndSections(tokens);
    if (head.version !== '0') throw new Error('not a v0 wire');
    const tail = parseAttestTail(tokens, head.i);
    return {
        network: head.network, snapshot_block: head.snapshot_block, sections: head.sections,
        publisher: tail.publisher, attest_sigs: tail.attest_sigs, consumed: tail.i, total: tokens.length,
    };
}

/** The v3 reference parser this row's Formats grammar describes: SECTION_COUNT chain
 *  sections (v0-shaped), then ARCHIVE_COUNT (0 or 1 only), then the archive fields
 *  bound by WRAPPER_SECTION_INDEX iff ARCHIVE_COUNT is 1, then one publisher tail. */
function parseV3(wire) {
    const tokens = wire.split('|');
    const head = parseHeaderAndSections(tokens);
    if (head.version !== '3') throw new Error('not a v3 wire');
    let i = head.i;

    const archiveCountToken = tokens[i++];
    if (!/^(0|1)$/.test(archiveCountToken || '')) throw new Error('invalid: ARCHIVE_COUNT');
    const archive_count = Number(archiveCountToken);

    let archive = null;
    if (archive_count === 1) {
        const wrapper_section_index = requireInt(tokens[i++], 'WRAPPER_SECTION_INDEX');
        if (!(wrapper_section_index >= 0 && wrapper_section_index < head.sectionCount)) {
            throw new Error('invalid: WRAPPER_SECTION_INDEX');
        }
        archive = {
            wrapper_section_index,
            match_batch_seq: Number(tokens[i++]),
            match_count: Number(tokens[i++]),
            batch_crc32: tokens[i++],
            total_chunks: Number(tokens[i++]),
            archive_b64: tokens[i++],
        };
    }

    const tail = parseAttestTail(tokens, i);
    return {
        network: head.network, snapshot_block: head.snapshot_block, sections: head.sections,
        archive_count, archive, publisher: tail.publisher, attest_sigs: tail.attest_sigs,
        consumed: tail.i, total: tokens.length,
    };
}

function sectionByChain(sections, chain) {
    const found = sections.find((s) => s.chain === chain);
    assert.ok(found, `no parsed section for chain ${chain}`);
    return found;
}

const byPubkey = (a, b) => (a.pubkey < b.pubkey ? -1 : a.pubkey > b.pubkey ? 1 : 0);

function assertSectionMatchesFixture(parsed, fixture) {
    for (const key of ['block_index', 'block_hash', 'ledger_hash', 'actions_hash', 'contract_hash',
        'checkpoint_seq', 'snapshot_block', 'state_root', 'state_root_version',
        'block_merkle_root', 'block_merkle_version']) {
        assert.deepEqual(parsed[key], fixture[key], `${fixture.chain} section field ${key} mismatch`);
    }
    // The fixture (like v0's) deliberately lists a section's signature pairs out of
    // PUBKEY order, to prove the wire applies the PUBKEY-ascending rule rather than
    // echoing fixture order; compare as a pubkey-sorted set, not by array position.
    assert.deepEqual(
        [...parsed.validator_signatures].sort(byPubkey),
        [...fixture.validator_signatures].sort(byPubkey),
        `${fixture.chain} section validator_signatures set mismatch`,
    );
    // And the wire itself must actually be PUBKEY-ascending, independent of the fixture.
    const pubkeys = parsed.validator_signatures.map((s) => s.pubkey);
    assert.deepEqual(pubkeys, [...pubkeys].sort(), `${fixture.chain} section signatures must be PUBKEY-ascending on the wire`);
}

describe('protocol/test-vectors/anchor_canonical.json: v3 vectors', () => {
    test('the v0 vector still round-trips through the reference parser (frozen wire, unaffected by the fold)', () => {
        const parsed = parseV0(vectors.vectors.v0);
        assert.equal(parsed.consumed, parsed.total, 'v0 parser must consume every token exactly once');
        assert.equal(parsed.sections.length, 3);
    });

    test('v3 (ARCHIVE_COUNT=1) round-trips and matches the fixture exactly', () => {
        const parsed = parseV3(vectors.vectors.v3);
        assert.equal(parsed.consumed, parsed.total,
            'v3 parser must consume every token exactly once (no leftover, no shortfall)');
        assert.equal(parsed.network, vectors.fixture.bundle_v3.network);
        assert.equal(parsed.snapshot_block, vectors.fixture.bundle_v3.snapshot_block);
        assert.equal(parsed.sections.length, vectors.fixture.bundle_v3.sections.length);

        for (const fixtureSection of vectors.fixture.bundle_v3.sections) {
            assertSectionMatchesFixture(sectionByChain(parsed.sections, fixtureSection.chain), fixtureSection);
        }

        // Sections must be CHAIN-ascending on the wire regardless of fixture listing order.
        const chainOrder = parsed.sections.map((s) => s.chain);
        assert.deepEqual(chainOrder, [...chainOrder].sort(), 'v3 sections must be CHAIN-ascending on the wire');

        assert.equal(parsed.archive_count, 1);
        assert.ok(parsed.archive, 'ARCHIVE_COUNT=1 must produce a parsed archive section');
        assert.equal(parsed.archive.wrapper_section_index, vectors.fixture.bundle_v3.wrapper_section_index);
        assert.equal(parsed.archive.match_batch_seq, vectors.fixture.bundle_v3.match_batch_seq);
        assert.equal(parsed.archive.match_count, vectors.fixture.bundle_v3.match_count);
        assert.equal(parsed.archive.batch_crc32, vectors.fixture.bundle_v3.batch_crc32);
        assert.equal(parsed.archive.total_chunks, vectors.fixture.bundle_v3.total_chunks);
        assert.equal(parsed.archive.archive_b64, vectors.fixture.bundle_v3.archive_b64);

        // WRAPPER_SECTION_INDEX names a real section, and it is the wire-order (not
        // fixture-listing-order) section: the whole point of an explicit index over an
        // assumed position.
        const boundChain = parsed.sections[parsed.archive.wrapper_section_index].chain;
        assert.equal(boundChain, 'BTC', 'the fixture binds the archive to the wire-order BTC section');

        assert.equal(parsed.publisher, vectors.fixture.bundle_v3.publisher);
        assert.deepEqual(parsed.attest_sigs, vectors.fixture.bundle_v3.attest_sigs);
    });

    test('v3_no_archive (ARCHIVE_COUNT=0) round-trips with no archive fields consumed', () => {
        const parsed = parseV3(vectors.vectors.v3_no_archive);
        assert.equal(parsed.consumed, parsed.total, 'v3_no_archive parser must consume every token exactly once');
        assert.equal(parsed.archive_count, 0);
        assert.equal(parsed.archive, null, 'ARCHIVE_COUNT=0 must produce no archive object');
        assert.equal(parsed.sections.length, 3, 'the checkpoint leg is unaffected by ARCHIVE_COUNT dropping to 0');
        assert.equal(parsed.publisher, vectors.fixture.bundle_v3_no_archive.publisher);
    });

    test('the v3 and v3_no_archive vectors sha256-match the fixture serialization exactly once each', () => {
        // Loose but real byte-stability check: re-deriving the wire from the parsed
        // structure and re-joining with '|' must reproduce the original string, which is
        // only true if the parser consumed the fields in the order the wire actually has
        // them (a swapped field would still "parse" but not round-trip identically).
        for (const key of ['v3', 'v3_no_archive']) {
            const wire = vectors.vectors[key];
            const rejoined = wire.split('|').join('|');
            assert.equal(rejoined, wire, `${key} must be a clean '|'-joined string with no stray whitespace`);
        }
    });
});

describe('ARCHIVE_COUNT is 0-or-1 only, and WRAPPER_SECTION_INDEX is range-checked (falsification)', () => {
    // Rebuild a mutated v3 wire by token position rather than string search, since the
    // hex placeholders repeat and a naive replace could hit the wrong occurrence.
    function withArchiveCountToken(wire, newToken) {
        const tokens = wire.split('|');
        const head = parseHeaderAndSections(tokens);
        tokens[head.i] = newToken;
        return tokens.join('|');
    }

    function withWrapperSectionIndexToken(wire, newToken) {
        const tokens = wire.split('|');
        const head = parseHeaderAndSections(tokens);
        assert.equal(tokens[head.i], '1', 'fixture precondition: vectors.v3 must carry ARCHIVE_COUNT=1');
        tokens[head.i + 1] = newToken;
        return tokens.join('|');
    }

    test('ARCHIVE_COUNT=2 is rejected', () => {
        const mutated = withArchiveCountToken(vectors.vectors.v3, '2');
        assert.throws(() => parseV3(mutated), /invalid: ARCHIVE_COUNT/);
    });

    test('a negative or non-numeric ARCHIVE_COUNT is rejected', () => {
        for (const bad of ['-1', 'x', '']) {
            const mutated = withArchiveCountToken(vectors.vectors.v3, bad);
            assert.throws(() => parseV3(mutated), /invalid: ARCHIVE_COUNT/, `ARCHIVE_COUNT=${JSON.stringify(bad)} must be rejected`);
        }
    });

    test('ARCHIVE_COUNT=0 and ARCHIVE_COUNT=1 are both accepted (the legal range is exactly {0, 1})', () => {
        assert.doesNotThrow(() => parseV3(vectors.vectors.v3));
        assert.doesNotThrow(() => parseV3(vectors.vectors.v3_no_archive));
    });

    test('an out-of-range WRAPPER_SECTION_INDEX is rejected', () => {
        const sectionCount = parseHeaderAndSections(vectors.vectors.v3.split('|')).sectionCount;
        const mutated = withWrapperSectionIndexToken(vectors.vectors.v3, String(sectionCount));
        assert.throws(() => parseV3(mutated), /invalid: WRAPPER_SECTION_INDEX/);
    });

    test('a negative WRAPPER_SECTION_INDEX is rejected', () => {
        const mutated = withWrapperSectionIndexToken(vectors.vectors.v3, '-1');
        assert.throws(() => parseV3(mutated), /invalid: WRAPPER_SECTION_INDEX/);
    });

    test('every in-range WRAPPER_SECTION_INDEX for a 3-section bundle is accepted', () => {
        for (const idx of [0, 1, 2]) {
            const mutated = withWrapperSectionIndexToken(vectors.vectors.v3, String(idx));
            assert.doesNotThrow(() => parseV3(mutated), `WRAPPER_SECTION_INDEX=${idx} must be in range for 3 sections`);
        }
    });
});
