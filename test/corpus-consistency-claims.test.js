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
 * Drift lint for six cross-page claims this corpus has already contradicted
 * itself about. Each block below guards one of them.
 *
 * WHY, per claim:
 *
 *   1. Multisig payload capacity. The encoder's MULTISIGN_SIZE is 69: a chunk
 *      is 4 magic bytes plus 60 data bytes, and one chunk fills BOTH 32-byte
 *      fake-pubkey halves of a SINGLE output. So capacity is 60 bytes per
 *      output. Four pages said "~61 bytes per key", a figure traceable to a
 *      superseded MULTISIGN_SIZE = 71, and the whitepaper table said "60 data
 *      bytes per key slot", right number and wrong unit, contradicting its own
 *      "Per-output data capacity" column header. Someone sizing a transaction
 *      off the per-key reading budgets twice the real capacity.
 *
 *   2. Indexer inputs and replay. The indexer reads a local Hub DB mirror
 *      during block processing (architecture/database-design.md documents it,
 *      and data-pipeline.md's own PRICE oracle flow draws it), yet the
 *      Determinism sections promised bit-for-bit replay against the Decoder DB
 *      ALONE. A third-party implementer reproducing state from one chain's
 *      Decoder DB would diverge on every fee validation and oracle read.
 *
 *   3. Explorer database writes. The explorer owns and writes a hub-mirror
 *      schema under `"self_sync": true`, the RECOMMENDED provisioning mode, and
 *      optionally writes the indexer-owned `icons` table. Two pages still said
 *      it "never writes to any database", so an operator provisioning grants
 *      from them hands the explorer a read-only user and the recommended mode
 *      fails at startup.
 *
 *   4. The three penalty lanes. Stake is burned only on a permissionless SLASH
 *      proof of equivocation. Price deviation, repeated deviation and missed
 *      rounds are hub-local offenses whose strongest outcome is
 *      `validators.status='suspended'`, with on-chain stake untouched, and
 *      ROLLCALL eviction burns nothing. Calling the missed-rounds knob a
 *      "non-participation slash" tells a validator operator their stake is at
 *      risk when it is not. This claim has drifted back once already after a
 *      partial correction, which is why it is pinned here.
 *
 *   5. Cross-chain DEX confirmation depth. A validator co-signs a DEX match
 *      only once the give-side escrow is buried to that chain's depth, which
 *      defaults per coin to BTC 6 / LTC 12 / DOGE 60 (the hub's coin files)
 *      and may only be raised on mainnet and testnet. The whitepaper said the
 *      default was a single confirmation, read off a fallback constant no
 *      shipped coin reaches, and stated its reorg-risk argument against it.
 *
 *   6. The cross-chain match archive. ANCHOR archives the signed match records
 *      on DOGE so a full parse can rebuild them. The whitepaper's §9 still
 *      described the retired Merkle-root-only audit anchor, which could verify
 *      a surviving copy but never rebuild one, while its own action list sent
 *      readers to §9 for the archive.
 *
 * The capacity figure is read out of the sibling xchain-encoder checkout
 * rather than typed here, and SKIPS when that sibling is absent: the
 * convention fee-and-limit-claims.test.js and consensus-wall-clock-claims.js
 * both use. The prose assertions are doc-internal and always run.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT              = path.resolve(__dirname, '..');
const ENCODER_SRC       = path.resolve(ROOT, '../xchain-encoder/src/XChainEncoder.js');
const ENCODER_CONSTANTS = path.resolve(ROOT, '../xchain-encoder/src/XChainEncoder/constants.js');

// Skips by name on a bare clone; throws under XCHAIN_REQUIRE_SIBLINGS=1 when the
// sibling checkout itself is absent or hollow. Which file inside it declares
// MULTISIGN_SIZE is not a skip condition (see multisignDataBytes): a repo that
// is checked out but declares the constant nowhere is a hard failure, not a skip.
const noEncoder   = sibling('xchain-encoder', []).skip;

const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// MULTISIGN_SIZE minus the magic word and the five single-byte script fields
// the encoder subtracts at prepareData time. Kept as arithmetic over the
// declared constant so a change to the constant moves this guard by itself.
//
// Reads src/XChainEncoder/constants.js first (the per-feature split) and
// falls back to the monolithic src/XChainEncoder.js (the pre-split layout),
// so this guard survives either shape of the encoder checkout. Fails loudly
// naming both paths when neither declares the constant, rather than skipping:
// an unreadable sibling is a skip, but a readable one with the declaration
// gone from both known homes is a corpus-guard defect that must not go quiet.
function multisignDataBytes() {
    for (const src of [ENCODER_CONSTANTS, ENCODER_SRC]) {
        if (!fs.existsSync(src)) continue;
        const m = /^const MULTISIGN_SIZE\s*=\s*(\d+)/m.exec(fs.readFileSync(src, 'utf8'));
        if (m) {
            const MAGIC_LEN = 4;
            return Number(m[1]) - MAGIC_LEN - 5;
        }
    }
    assert.fail('MULTISIGN_SIZE declaration not found in xchain-encoder/src/XChainEncoder/'
        + 'constants.js or xchain-encoder/src/XChainEncoder.js; the declaration shape '
        + 'changed, re-point this regex');
}

/* ---------------------------------------------------------------- claim 1 */

const CAPACITY_PAGES = [
    'components/encoder/README.md',
    'architecture/data-pipeline.md',
    'architecture/component-map.md',
    'whitepaper.md',
];

// Multisig capacity stated on a PER-KEY basis, in any of the spellings the
// corpus used. Deliberately anchored on the word "key", so it cannot match
// protocol/token-gated-content.md's unrelated "+~61 bytes envelope" ECIES
// overhead, which is a correct sentence about a different subject.
const PER_KEY_CAPACITY = /\d{2}\s*(?:data\s+)?bytes\s*(?:per|\/)\s*key/i;

test('no page states multisig payload capacity on a per-key basis', () => {
    const offenders = [];
    for (const rel of CAPACITY_PAGES) {
        readDoc(rel).split('\n').forEach((line, i) => {
            if (PER_KEY_CAPACITY.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, [],
        'multisig capacity is 60 bytes per OUTPUT, spread over two 32-byte fake '
        + 'pubkey halves of one output, not a per-key quantity. Offending lines:\n'
        + offenders.join('\n'));
});

test('the capacity the pages publish equals what xchain-encoder computes',
    { skip: noEncoder }, () => {
        const bytes = multisignDataBytes();
        assert.equal(bytes, 60,
            'the encoder no longer yields 60 data bytes per MULTISIGN chunk; '
            + 'sweep the capacity figure through ' + CAPACITY_PAGES.join(', '));
        const perOutput = new RegExp(`${bytes}\\s*(?:data\\s+)?bytes\\s*(?:per|\\/)\\s*(?:multisig\\s+)?output`, 'i');
        for (const rel of CAPACITY_PAGES) {
            assert.ok(perOutput.test(readDoc(rel)),
                `${rel} no longer states the multisig capacity as ${bytes} bytes per output`);
        }
    });

/* ---------------------------------------------------------------- claim 2 */

const REPLAY_PAGES = ['architecture/data-pipeline.md', 'whitepaper.md'];

// Any sentence promising replay or convergence against the decoder DB must
// name the hub mirror in the same sentence. Matching per sentence rather than
// per file is the point: a qualifier three paragraphs away does not reach the
// reader of the bullet.
const REPLAY_CLAIM = /(bit-for-bit|converge to|pure function of the decoder db|only reads from the decoder db)/i;
const MIRROR_MENTION = /hub[\s-]?(db|mirror|mirrored)/i;

test('every replay or convergence claim names the hub mirror in the same sentence', () => {
    const offenders = [];
    for (const rel of REPLAY_PAGES) {
        for (const sentence of readDoc(rel).split(/(?<=[.!?])\s+|\n/)) {
            if (REPLAY_CLAIM.test(sentence) && !MIRROR_MENTION.test(sentence)) {
                offenders.push(`${rel}  ${sentence.trim()}`);
            }
        }
    }
    assert.deepEqual(offenders, [],
        'the indexer reads the local Hub DB mirror during block processing '
        + '(architecture/database-design.md), so replay holds given the Decoder DB '
        + 'AND an equivalent mirror. Unqualified claims:\n' + offenders.join('\n'));
});

/* ---------------------------------------------------------------- claim 3 */

const EXPLORER_PAGES = [
    'components/explorer/README.md',
    'components/explorer/architecture.md',
    'architecture/component-map.md',
];

test('no page claims the explorer never writes to any database', () => {
    const offenders = [];
    for (const rel of EXPLORER_PAGES) {
        readDoc(rel).split('\n').forEach((line, i) => {
            if (/never writes to (any|the Indexer) database/i.test(line)) {
                offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
            }
        });
    }
    assert.deepEqual(offenders, [],
        'the explorer creates and writes its own hub-mirror schema under '
        + '"self_sync": true, and optionally writes the indexer-owned icons table. '
        + 'Offending lines:\n' + offenders.join('\n'));
});

test('the explorer pages an operator reads name the hub-mirror writes', () => {
    for (const rel of EXPLORER_PAGES) {
        assert.match(readDoc(rel), /self_sync|hub[\s-]?mirror/i,
            `${rel} does not mention the hub mirror, so an operator reading it alone `
            + 'provisions the wrong database grants');
    }
});

/* ---------------------------------------------------------------- claim 4 */

const PENALTY_PAGES = [
    'components/hub/configuration.md',
    'components/hub/architecture.md',
    'components/hub/database.md',
    'components/hub/README.md',
];

// A non-equivocation offense tied to a burn. The identifiers SLASH_*,
// SlashDetector and slash_proposals are legitimate names and must survive, so
// the penalty alternation ends at a word boundary that a following `_` or
// letter defeats: SLASH_MISSED_ROUNDS_THRESHOLD, SlashDetector and
// slash_proposals cannot match it, while the bare noun in "non-participation
// slash" can. That bare form is the one the corpus actually shipped, so
// leaving it out made this guard green against the very drift it names.
// Neither pattern crosses a sentence end or a table-cell boundary, which is
// what keeps the corrected rows (offense recorded in one sentence, equivocation
// SLASH named in the next) from tripping it.
const PENALTY = String.raw`(?:\bslash(?:es|ed|ing)?\b|\bburn(?:s|ed|ing)?\b)`;
const OFFENSE = String.raw`(?:missed[\s-]?round|non[\s-]?participation|price deviation)`;
const FALSE_BURN = new RegExp(`${OFFENSE}[^.\\n|]{0,90}${PENALTY}`, 'i');
const FALSE_BURN_REVERSED = new RegExp(`${PENALTY}[^.\\n|]{0,90}${OFFENSE}`, 'i');

test('no hub page ties a non-equivocation offense to a stake burn', () => {
    const offenders = [];
    for (const rel of PENALTY_PAGES) {
        readDoc(rel).split('\n').forEach((line, i) => {
            if (FALSE_BURN.test(line) || FALSE_BURN_REVERSED.test(line)) {
                offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
            }
        });
    }
    assert.deepEqual(offenders, [],
        'stake burns only on a permissionless SLASH proof of equivocation; deviation '
        + 'and missed rounds are hub-local offenses that leave on-chain stake untouched '
        + '(components/hub/decentralization.md). Offending lines:\n' + offenders.join('\n'));
});

test('decentralization.md still carries all three penalty lanes', () => {
    const page = readDoc('components/hub/decentralization.md');
    assert.match(page, /burned only on a permissionless SLASH proof of \*\*equivocation\*\*/,
        'the equivocation-only burning lane is no longer stated');
    assert.match(page, /\*\*On-chain stake is untouched\*\*/,
        'the hub-local suspension lane no longer states that stake is untouched');
    assert.match(page, /nothing is burned/,
        'the ROLLCALL eviction lane no longer states that nothing is burned');
});

/* ---------------------------------------------------------------- claim 5 */

const DEX_COINS = ['BTC', 'LTC', 'DOGE'];
const DEX_DOC_DEPTHS = { BTC: 6, LTC: 12, DOGE: 60 };
const DEX_ROW = /^\|\s*Cross-chain DEX matching source-confirmation depth \(default\)\s*\|([^|\n]*)\|/m;
const noHubCoins = sibling('xchain-hub', DEX_COINS.map((c) => `src/coins/${c}.js`)).skip;

// Return the Appendix B value cell, failing loudly when the row is gone.
function dexDepthCell() {
    const m = DEX_ROW.exec(readDoc('whitepaper.md'));
    assert.ok(m, 'whitepaper.md Appendix B no longer carries the cross-chain DEX '
        + 'source-confirmation depth row; re-point DEX_ROW');
    return m[1].trim();
}

test('the whitepaper states the per-coin DEX confirmation default, not one confirmation', () => {
    assert.doesNotMatch(readDoc('whitepaper.md'), /single source confirmation/i,
        'whitepaper.md says DEX matching defaults to a single source confirmation');
    const cell = dexDepthCell();
    assert.doesNotMatch(cell, /^1\b/, `Appendix B DEX depth still reads "${cell}"`);
    for (const coin of DEX_COINS) {
        assert.match(cell, new RegExp(`\\b${coin} ${DEX_DOC_DEPTHS[coin]}\\b`),
            `Appendix B DEX depth "${cell}" does not name ${coin} ${DEX_DOC_DEPTHS[coin]}`);
    }
});

test('the DEX depths the whitepaper publishes equal the hub coin files',
    { skip: noHubCoins }, () => {
        const cell = dexDepthCell();
        for (const coin of DEX_COINS) {
            const src = fs.readFileSync(path.join(sibling('xchain-hub').root, 'src/coins', `${coin}.js`), 'utf8');
            const m = /^\s*confirmations:\s*(\d+)/m.exec(src);
            assert.ok(m, `xchain-hub src/coins/${coin}.js declares no confirmations; re-point this regex`);
            assert.match(cell, new RegExp(`\\b${coin} ${m[1]}\\b`),
                `the hub's ${coin} default depth is ${m[1]}, but Appendix B reads "${cell}"`);
        }
    });

/* ---------------------------------------------------------------- claim 6 */

// Return whitepaper §9, failing loudly when either heading moves.
function whitepaperSection9(markdown) {
    const start = markdown.search(/^## 9\. /m);
    const end = markdown.search(/^## 10\. /m);
    assert.ok(start !== -1 && end > start, 'whitepaper.md §9 or §10 heading moved; re-point whitepaperSection9');
    return markdown.slice(start, end);
}

function assertMatchArchiveClaim(markdown) {
    const s9 = whitepaperSection9(markdown);
    assert.doesNotMatch(s9, /Merkle-rooted audit anchor|XDEXANCHOR/i,
        'whitepaper.md §9 describes the retired Merkle-root-only audit anchor');
    assert.match(s9, /ANCHOR action/, 'whitepaper.md §9 no longer names the ANCHOR action');
    assert.match(s9, /match archive/i, 'whitepaper.md §9 no longer describes the match archive');
}

test('whitepaper §9 describes the ANCHOR match archive, not the retired audit anchor', () => {
    assertMatchArchiveClaim(readDoc('whitepaper.md'));
});

test('falsification: the retired audit-anchor sentence is caught in §9', () => {
    const page = readDoc('whitepaper.md');
    const stale = page.replace(/^## 10\. /m,
        'An optional Merkle-rooted audit anchor may be published to a chain for transparency.\n\n## 10. ');
    assert.throws(() => assertMatchArchiveClaim(stale));
});
