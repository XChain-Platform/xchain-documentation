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
 * Drift lint for cross-page claims this corpus has already contradicted
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
 *   8. Whitepaper mainnet status notes. The ROLLCALL and attest broadcast-fee
 *      notes still said mainnet ships inert after both gates were armed at
 *      genesis, while rollcall.md and the validator guide said armed. A mainnet
 *      validator trusting the whitepaper skips the DOGE read its BTC indexer
 *      needs. The notes are checked against protocol/constants.js.
 *
 *   9. Mobile store trading disclosure. The wallet ships its DEX screens in
 *      store builds, but the Play and App Store runbooks still said an exchange
 *      was compiled out. That makes the listing contradict the submitted binary
 *      and leaves reviewers without the non-custodial architecture they need to
 *      evaluate the screens.
 *
 *  10. Extension trading review notes. The default Chrome build includes the
 *      wallet's DEX and dispenser screens. Review collateral must explain that
 *      those screens prepare user-signed protocol transactions without turning
 *      the extension into a custodian, counterparty or fiat exchange.
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

/* ---------------------------------------------------------------- claim 7 */

const WS_DOC = 'components/explorer/websocket.md';
const WS_CONFIG_DOC = 'components/explorer/configuration.md';

function markdownSection(markdown, heading) {
    const start = markdown.indexOf(heading);
    assert.notEqual(start, -1, `${heading} section moved; re-point markdownSection`);
    const next = markdown.indexOf('\n## ', start + heading.length);
    return markdown.slice(start, next === -1 ? markdown.length : next);
}

function assertRowAtomicBackpressureClaims(websocket, configuration) {
    const reconnect = markdownSection(websocket, '## Reconnection and Catch-Up');
    const wsConfig = markdownSection(websocket, '## Configuration');

    for (const [name, text] of [
        ['websocket reconnect procedure', reconnect],
        ['websocket configuration row', wsConfig],
        ['explorer configuration row', configuration],
    ]) {
        assert.match(text, /decided once per action row/i,
            `${name} no longer states the row-atomic admission boundary`);
        assert.match(text, /at or below[^.]*whole wanted row|at or below[^.]*every wanted frame/i,
            `${name} no longer states that an admitted row is delivered whole`);
        assert.match(text, /above (?:the limit|it)[^.]*no frame from that row/i,
            `${name} no longer states that a rejected row sends no frames`);
        assert.match(text, /4008[^.]*after the row ends/i,
            `${name} no longer defers the backpressure close to the row boundary`);
    }

    assert.doesNotMatch(websocket,
        /A frame the client wanted that finds it above this is dropped/i,
        'websocket.md restored the frame-by-frame backpressure claim');
}

test('explorer backpressure docs describe row-atomic action admission', () => {
    assertRowAtomicBackpressureClaims(readDoc(WS_DOC), readDoc(WS_CONFIG_DOC));
});

test('falsification: frame-by-frame backpressure wording is caught', () => {
    const websocket = readDoc(WS_DOC).replace(
        /Backpressure admission is decided once per action row[^|\n]*/,
        'A frame the client wanted that finds it above this is dropped');
    assert.throws(() => assertRowAtomicBackpressureClaims(websocket, readDoc(WS_CONFIG_DOC)));
});

/* ---------------------------------------------------------------- claim 8 */

const CONSTANTS = require(path.join(ROOT, 'protocol', 'constants.js'));

// Pair each whitepaper status note, found by its line's anchor, with the gate it describes.
const WHITEPAPER_GATE_NOTES = [
    { anchor: /^- \*\*ROLLCALL\*\* is a validator-broadcast/, gate: 'ROLLCALL_ACTIVATION' },
    { anchor: /broadcast fee be reimbursed from the request's escrow/, gate: 'ATTEST_BROADCAST_FEE_ACTIVATION' },
];
const INERT_NOTE = /ships inert|operator-owned|\binert\b/i;
const GENESIS_NOTE = /armed at genesis on (?:mainnet|every network)/i;

// Return the line holding the anchor, failing loudly when the anchor moved.
function gateNoteLine(markdown, anchor) {
    const line = markdown.split('\n').find((l) => anchor.test(l));
    assert.ok(line, `whitepaper.md no longer has a line matching ${anchor}; re-point WHITEPAPER_GATE_NOTES`);
    return line;
}

function assertWhitepaperGateNotes(markdown) {
    for (const { anchor, gate } of WHITEPAPER_GATE_NOTES) {
        const line = gateNoteLine(markdown, anchor);
        const mainnet = CONSTANTS[gate].mainnet;
        if (mainnet === 0) {
            assert.doesNotMatch(line, INERT_NOTE,
                `whitepaper.md calls ${gate} inert or operator-owned on mainnet, but protocol/constants.js `
                + 'arms it at genesis there; fix the prose, not the constant');
            assert.match(line, GENESIS_NOTE,
                `whitepaper.md no longer says ${gate} is armed at genesis on mainnet`);
        } else {
            assert.doesNotMatch(line, GENESIS_NOTE,
                `whitepaper.md says ${gate} is armed at genesis on mainnet, but protocol/constants.js `
                + `ships mainnet: ${JSON.stringify(mainnet)}`);
        }
    }
}

test('the whitepaper mainnet status notes match the activation constants', () => {
    assertWhitepaperGateNotes(readDoc('whitepaper.md'));
});

test('falsification: the pre-ruling inert ROLLCALL note is caught', () => {
    const stale = readDoc('whitepaper.md').replace(/\*\(armed at genesis on mainnet since[^\n]*?\)\*/,
        '*(pre-launch: armed on testnet; mainnet ships inert, its activation height operator-owned.)*');
    assert.notEqual(stale, readDoc('whitepaper.md'), 'the ROLLCALL note moved; re-point this falsification');
    assert.throws(() => assertWhitepaperGateNotes(stale));
});

/* ------------------------------------------------- hub DB sync direction */

// The hub SERVES `GET /hub-db/subscribe`; each indexer's HubDbSync dials in to it.
// A page saying the hub dials out to indexers misleads firewall and key setup.
const HUB_DIALS_OUT = /outbound\s+WebSocket[^|;]*hub-db\/subscribe|hub-db\/subscribe`?\s+to\s+indexers/i;

function hubDialsOutLines(markdown) {
    return markdown.split('\n').filter((line) => HUB_DIALS_OUT.test(line)).map((line) => line.trim());
}

test('the component map has indexers subscribing to the hub, not the hub dialing out', () => {
    const page = readDoc('architecture/component-map.md');
    assert.deepEqual(hubDialsOutLines(page), [],
        'indexers connect in to the hub\'s GET /hub-db/subscribe (components/hub/api.md)');
    assert.match(page, /inbound\s+WebSocket\s+`\/hub-db\/subscribe`\s+from\s+indexers/i,
        'component-map.md no longer states the /hub-db/subscribe direction');
});

test('falsification: the reversed /hub-db/subscribe direction is caught', () => {
    const page = readDoc('architecture/component-map.md');
    const stale = page.replace(/inbound WebSocket `\/hub-db\/subscribe` from indexers \(HubDbSync clients\)/,
        'outbound WebSocket `/hub-db/subscribe` to indexers');
    assert.notEqual(stale, page, 'the hub Communication row moved; re-point this falsification');
    assert.equal(hubDialsOutLines(stale).length, 1);
});

/* ------------------------------- node networks and hub mirror provenance */

// Sync is never attached to the per-chain networks (only database, hub and explorer are),
// and capability snapshots are unsigned set membership derived from BTC stake state.
const NETWORK_AND_PROVENANCE_OVERCLAIMS = [
    ['architecture/component-map.md', /shared services are connected to every coin\/network network/i],
    ['architecture/data-pipeline.md', /capability[^.]*\bare validator-signed records/i]
];

function overclaimsIn(pages) {
    return NETWORK_AND_PROVENANCE_OVERCLAIMS
        .filter(([rel, pattern]) => pattern.test(pages[rel]))
        .map(([rel]) => rel);
}

function readOverclaimPages() {
    return Object.fromEntries(NETWORK_AND_PROVENANCE_OVERCLAIMS.map(([rel]) => [rel, readDoc(rel)]));
}

test('the component map keeps sync off the per-chain networks and capability snapshots unsigned', () => {
    const pages = readOverclaimPages();
    assert.deepEqual(overclaimsIn(pages), []);
    assert.match(pages['architecture/component-map.md'], /sync stays on the base `xchain-node` network/);
    assert.match(pages['architecture/data-pipeline.md'], /capability snapshots are unsigned/);
});

test('falsification: the shared-network and signed-capability overclaims are caught', () => {
    const pages = readOverclaimPages();
    const stale = {
        'architecture/component-map.md': pages['architecture/component-map.md'].replace(
            /The database, hub and explorer are also connected to every coin\/network network; sync stays on the base `xchain-node` network only\./,
            'Shared services are connected to every coin/network network.'),
        'architecture/data-pipeline.md': pages['architecture/data-pipeline.md'].replace(
            /are records the hub finalizes\. Most of them carry validator quorum signatures, while capability snapshots are unsigned validator-set membership derived from on-chain BTC stake state\./,
            'are validator-signed records the hub finalizes.')
    };
    for (const rel of Object.keys(stale)) assert.notEqual(stale[rel], pages[rel], `${rel} moved; re-point this falsification`);
    assert.deepEqual(overclaimsIn(stale), ['architecture/component-map.md', 'architecture/data-pipeline.md']);
});

const DESKTOP_TRADING_REVIEW_PAGES = {
    'components/wallet/release/desktop/mac-app-store.md': 'Mac App Store',
    'components/wallet/release/desktop/microsoft-store.md': 'Microsoft Store',
    'components/wallet/release/desktop/snap-store.md': 'Snap Store',
};

function desktopTradingReviewNotes(markdown) {
    const section = /^### Review notes: trading screens\n\n([\s\S]*?)(?=\n### |\n## |$)/m.exec(markdown);
    assert.ok(section, 'the Review notes: trading screens section is missing');
    return section[1];
}

function assertTradingReviewDefense(notes) {
    assert.match(notes, /on-chain decentralized exchange/i);
    assert.match(notes, /does not operate a custodial exchange or broker trades/i);
    assert.match(notes, /wallet composes and signs the user's place-order and cancel-order protocol actions/i);
    assert.match(notes, /matching happens in the XChain indexer/i);
    assert.match(notes, /settlement happens on public blockchains/i);
    assert.match(notes, /no publisher account, hosted balance, fiat on-ramp or card purchase/i);
}

test('desktop store review notes defend the trading screens that ship', () => {
    for (const [rel, channel] of Object.entries(DESKTOP_TRADING_REVIEW_PAGES)) {
        const notes = desktopTradingReviewNotes(readDoc(rel));
        assertTradingReviewDefense(notes);
        assert.match(notes, new RegExp(`complete trading surface ships in the ${channel} build`, 'i'));
        assert.doesNotMatch(notes, /trading screens? (?:are|is) (?:hidden|compiled out)/i);
    }
});

/* ---------------------------------------- mobile store trading disclosure */

const MOBILE_STORE_RUNBOOKS = [
    'components/wallet/release/mobile/android-play.md',
    'components/wallet/release/mobile/ios-app-store.md',
];
const TRADING_NOTES_HEADING = '### Review notes: trading screens';
const COMPILED_OUT_EXCHANGE = /exchange[^.\n]{0,100}compil(?:e|es|ed)[^.\n]{0,60}out|compil(?:e|es|ed)[^.\n]{0,100}exchange[^.\n]{0,60}out|compil(?:e|es|ed)[^.\n]{0,60}out[^.\n]{0,100}exchange/i;

function tradingReviewNotes(markdown, rel) {
    const start = markdown.indexOf(TRADING_NOTES_HEADING);
    assert.notEqual(start, -1, `${rel} has no ${TRADING_NOTES_HEADING} section`);
    const end = markdown.indexOf('\n### ', start + TRADING_NOTES_HEADING.length);
    return markdown.slice(start, end === -1 ? markdown.length : end);
}

function assertTradingReviewNotes(markdown, rel) {
    assert.doesNotMatch(markdown, COMPILED_OUT_EXCHANGE,
        `${rel} still says the submitted build compiles out trading`);
    assert.doesNotMatch(markdown, /No\. No order book, no matching, no fiat on-ramp|It is not an exchange/i,
        `${rel} still denies the trading screens that ship in the submitted build`);
    assert.match(markdown, /Trade tokens through the XChain protocol's non-custodial decentralized exchange/i,
        `${rel} listing collateral does not disclose trading`);

    const notes = tradingReviewNotes(markdown, rel);
    assert.match(notes, /submitted build includes a Markets list and Market view/i,
        `${rel} does not say the trading screens ship in the submitted build`);
    assert.match(notes, /non-custodial decentralized exchange/i,
        `${rel} does not identify the trading screens as a non-custodial DEX interface`);
    assert.match(notes, /private keys remain on the(?:\s*>\s*)?device/i,
        `${rel} does not tell the reviewer where trading keys remain`);
    assert.match(notes, /Order matching happens in `xchain-indexer`, not in the app/i,
        `${rel} does not identify the order-matching boundary`);
    assert.match(notes, /no fiat purchase, sale, deposit, or withdrawal path/i,
        `${rel} does not state the fiat boundary`);
}

test('mobile store runbooks disclose and explain the shipped trading screens', () => {
    for (const rel of MOBILE_STORE_RUNBOOKS) assertTradingReviewNotes(readDoc(rel), rel);
    assert.match(readDoc(MOBILE_STORE_RUNBOOKS[0]),
        /\| Trading and funds \| Cryptocurrency exchange \| Yes\./,
        'the Play financial-features declaration does not disclose the exchange interface');
});

/* ---------------------------------------------- wallet wipe security state */

function assertWalletWipeClaims(glossary, checklist) {
    assert.match(glossary,
        /A wallet wipe erases the panic freeze record and the duress passphrase/,
        'wallet glossary no longer states that a wipe erases the panic freeze record and duress passphrase');
    assert.match(checklist,
        /wipe erases the panic freeze and the duress passphrase/,
        'wallet release QA no longer verifies that a wipe erases the panic freeze and duress passphrase');
}

test('wallet docs state that a wipe erases panic and duress state', () => {
    assertWalletWipeClaims(
        readDoc('components/wallet/glossary.md'),
        readDoc('components/wallet/release/qa-checklist.md'));
});

/* ------------------------------------------- extension trading review notes */

function extensionTradingReviewNotes(markdown) {
    const heading = '### Review notes: trading screens';
    const start = markdown.indexOf(heading);
    assert.notEqual(start, -1, 'Chrome Web Store runbook has no trading-screen review notes');
    const rest = markdown.slice(start);
    const next = rest.slice(heading.length).search(/\n#{1,3} /);
    return next === -1 ? rest : rest.slice(0, heading.length + next);
}

function assertExtensionTradingReviewNotes(markdown) {
    const notes = extensionTradingReviewNotes(markdown);
    assert.match(notes, /non-custodial software wallet/i);
    assert.match(notes, /not a cryptocurrency exchange, broker, dealer, or custodian/i);
    assert.match(notes, /never holds user funds/i);
    assert.match(notes, /never acts as the counterparty/i);
    assert.match(notes, /`ORDER`, `SWAP`, `DISPENSER`, or `COINPAY`/);
    assert.match(notes, /before signing with a key that remains on the device/i);
    assert.match(notes, /no fiat on-ramp/i);
    assert.match(notes, /no off-chain customer balance/i);
}

test('the Chrome submission collateral explains its trading screens without claiming custody', () => {
    assertExtensionTradingReviewNotes(readDoc('components/wallet/release/extension/chrome-web-store.md'));
});
