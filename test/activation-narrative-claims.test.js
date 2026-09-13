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
 * Activation-narrative claims in protocol/protocol-activation.md.
 *
 * WHY. That page is the only hand-written inventory of which consensus gates
 * are live on which network, and it has now drifted from BOTH of its machine
 * sources at once. The 2026-09-09 mainnet genesis arm set six validator-era
 * maps to `mainnet: 0` in protocol/constants.js and the page went on calling
 * them inert, and three further testnet time arms were pinned in the indexer
 * registry while the page went on saying one gate was the only Cohort A rule
 * not genesis-active on testnet. Neither drift touched a test: the only suite
 * that read the page at all checked an unrelated wall-clock bound, so the page
 * contradicted itself, contradicted constants.js, and contradicted the
 * generated protocol/flag-days.md with everything green.
 *
 * WHAT IT CHECKS.
 *
 *   1. Mainnet claims. Every sentence on the page that says a named
 *      `*_ACTIVATION` map is null/inert/unset on mainnet must name a map that
 *      really holds `mainnet: null` in protocol/constants.js, and every
 *      sentence that says one is armed at genesis on mainnet must name a map
 *      that really holds `mainnet: 0`.
 *   2. Testnet arms. Every gate with a nonzero testnet arm in the indexer
 *      registry is named in the page's testnet-exceptions list, and the page
 *      carries no "the only Cohort A rule not genesis-active on testnet"
 *      claim while more than one such arm exists.
 *
 * WHY THE COUNT ASSERTIONS ARE HERE. A prose parse that stops matching returns
 * an empty set, and an empty set satisfies every "each of these must" loop
 * ever written: the guard goes inert and stays green forever. So each half
 * asserts a floor on what it actually matched, and the floor's failure message
 * says the parse broke rather than that the page is wrong.
 *
 * Run: node --test test/activation-narrative-claims.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const gen = require('../bin/generate-flag-days.js');

const DOC_ROOT = path.join(__dirname, '..');
const PAGE_REL = 'protocol/protocol-activation.md';
const PAGE = fs.readFileSync(path.join(DOC_ROOT, PAGE_REL), 'utf8');
const CONSTANTS = require(path.join(DOC_ROOT, 'protocol', 'constants.js'));
const HAS_INDEXER = fs.existsSync(gen.REGISTRY);

/** Every exported map with a `mainnet` slot, by name. */
const MAPS = new Map(
    Object.entries(CONSTANTS).filter(
        ([k, v]) => /_ACTIVATION$/.test(k) && v && typeof v === 'object' && 'mainnet' in v,
    ),
);

/**
 * Prose sentences, with the page's hard wraps flattened away.
 *
 * Table rows are dropped first. A row states its thresholds in a COLUMN, not
 * in a sentence, and rows carry so few full stops that several of them
 * flatten into one pseudo-sentence holding both an inert and an armed claim
 * about different gates. Parsing those is how a prose guard starts inventing
 * failures; the cohort and decoder tables are covered by the columns the
 * generated flag-day page checks.
 */
function sentences(markdown) {
    return markdown
        .split('\n')
        .filter((line) => !/^\s*[|#]/.test(line))
        .join(' ')
        .split(/(?<=\.)\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/** Backticked map names in one sentence that constants.js actually declares. */
function namedMaps(sentence) {
    const out = [];
    for (const m of sentence.matchAll(/`([A-Z][A-Z0-9_]*_ACTIVATION)`/g)) {
        if (MAPS.has(m[1])) out.push(m[1]);
    }
    return out;
}

// A claim is about mainnet only when the sentence says so. "unarmed on
// **testnet**" sits two sentences from the mainnet roster and is not this
// guard's business.
const MAINNET = /mainnet/i;
const INERT = /\bnull\b|inert|unset|unarmed|disarmed|not armed/i;
const ARMED = /armed at genesis|genesis-active|genesis arm|arms at|reads `0`/i;

test('mainnet inert/armed claims on the activation page match constants.js', () => {
    let checked = 0;
    for (const sentence of sentences(PAGE)) {
        if (!MAINNET.test(sentence)) continue;
        const inert = INERT.test(sentence);
        const armed = ARMED.test(sentence);
        // A sentence carrying both cues is describing the SPLIT, naming armed
        // and unarmed maps side by side; the genesis-arm section's exception
        // roster is one long sentence of exactly that shape. Guessing which
        // name goes with which cue is how a prose parse starts inventing
        // failures, so those are left to the per-claim sentences around them.
        if (inert === armed) continue;
        for (const name of namedMaps(sentence)) {
            checked += 1;
            if (inert) {
                assert.strictEqual(
                    MAPS.get(name).mainnet, null,
                    `${PAGE_REL} calls ${name} inert/unset on mainnet, but protocol/constants.js `
                    + `ships mainnet: ${JSON.stringify(MAPS.get(name).mainnet)}. The page is stale `
                    + 'against the constant; correct the prose, never the constant.',
                );
            } else {
                assert.strictEqual(
                    MAPS.get(name).mainnet, 0,
                    `${PAGE_REL} calls ${name} armed at genesis on mainnet, but `
                    + `protocol/constants.js ships mainnet: ${JSON.stringify(MAPS.get(name).mainnet)}.`,
                );
            }
        }
    }
    assert.ok(
        checked >= 7,
        `only ${checked} mainnet activation claims matched on ${PAGE_REL}, which is fewer than the `
        + 'seven this page has carried since the 2026-09-09 genesis arm. Either the roster was '
        + 'deleted or the sentence parse in this guard stopped matching it; an unmatched roster '
        + 'passes every assertion above, so this floor is the only thing that reports it.',
    );
});

const LEADIN = 'genesis-active as well, with';

/** The testnet-exceptions bullet list, from its lead-in to the blank line that ends it. */
function exceptionsSection() {
    const start = PAGE.indexOf(LEADIN);
    assert.notStrictEqual(
        start, -1,
        `the testnet-exceptions lead-in ("${LEADIN}") is gone from ${PAGE_REL}. If the section was `
        + 'renamed, retarget this guard; it cannot check a list it cannot find.',
    );
    const rest = PAGE.slice(start);
    // The bullets and their continuation lines start with "-" or with spaces,
    // so the first blank line followed by anything else ends the list.
    const end = rest.match(/\n\n(?![-\s])/);
    return end ? rest.slice(0, end.index) : rest;
}

test('every nonzero testnet arm is named in the page\'s exception list', {
    skip: HAS_INDEXER ? false : 'no sibling xchain-indexer checkout',
}, () => {
    const arms = gen.collectTestnetArms();
    assert.ok(
        arms.length >= 1,
        'collectTestnetArms() returned nothing. Either every testnet arm was un-pinned, or the '
        + 'registry parse in bin/generate-flag-days.js stopped matching; an empty set would '
        + 'satisfy the loop below without reading the page at all.',
    );
    const section = exceptionsSection();
    for (const { gate } of arms) {
        assert.ok(
            section.includes(`\`${gate}\``),
            `${gate} arms testnet at an instant of its own in xchain-indexer/src/protocol_changes.js, `
            + `but ${PAGE_REL} does not name it in the testnet-exceptions list. A new testnet arm `
            + 'was pinned and the activation narrative needs rewording: name the gate and link to '
            + 'Flag-Day Values, and do not write the instant into the prose '
            + '(test/flag-day-literals.test.js enforces that).',
        );
    }
    if (arms.length > 1) {
        assert.doesNotMatch(
            PAGE,
            /only Cohort A rule not genesis-active on testnet/,
            `${PAGE_REL} still claims one gate is the only Cohort A rule not genesis-active on `
            + `testnet, but the registry declares ${arms.length} nonzero testnet arms.`,
        );
    }
});
