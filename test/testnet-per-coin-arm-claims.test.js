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
 * Testnet claims for maps that arm testnet per chain.
 *
 * WHY. A map can keep `testnet: 9999999999` as its bare fallback key while
 * its `BTC:testnet`, `LTC:testnet` and `DOGE:testnet` keys hold real heights,
 * and the resolver reads the per-chain key first. Prose and tests that read
 * only the bare key called such gates inert on testnet after they were armed,
 * with every suite green.
 *
 * WHAT IT CHECKS. For every map in protocol/constants.js with a per-chain
 * testnet key below the sentinel, no paragraph on the pages below that names
 * the map may carry a sentence that mentions testnet and calls it inert.
 *
 * Run: node --test test/testnet-per-coin-arm-claims.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, '..');
const CONSTANTS = require(path.join(DOC_ROOT, 'protocol', 'constants.js'));

const SENTINEL = 9999999999;
const PAGES = [
    'protocol/protocol-activation.md',
    'protocol/actions/anchor.md',
    'components/hub/operations.md',
];
const TESTNET = /\btestnet\b/i;
const INERT = /\bnull\b|inert|unset|unarmed|disarmed|not armed|\b2286\b/i;

/** Exported maps whose testnet is armed through at least one per-chain key. */
function perChainTestnetArmedMaps(constants) {
    const out = [];
    for (const [name, map] of Object.entries(constants)) {
        if (!/_ACTIVATION$/.test(name) || !map || typeof map !== 'object') continue;
        const armed = Object.keys(map).some((k) =>
            /^[A-Z]+:testnet$/.test(k) && Number.isInteger(map[k]) && map[k] >= 0 && map[k] < SENTINEL);
        if (armed) out.push(name);
    }
    return out;
}

/** Paragraphs and bullets with hard wraps flattened; tables and headings are dropped. */
function paragraphs(markdown) {
    return markdown
        .split(/\n\s*\n|\n(?=\s*- )/)
        .map((block) => block.split('\n').filter((l) => !/^\s*[|#]/.test(l)).join(' ').trim())
        .filter(Boolean);
}

/** Every sentence in a paragraph naming one of `maps` that calls testnet inert. */
function staleTestnetClaims(markdown, maps) {
    const hits = [];
    for (const para of paragraphs(markdown)) {
        const named = maps.filter((m) => para.includes(`\`${m}\``));
        if (named.length === 0) continue;
        for (const sentence of para.split(/(?<=\.)\s+/)) {
            if (TESTNET.test(sentence) && INERT.test(sentence)) hits.push(`${named.join(', ')}: ${sentence}`);
        }
    }
    return hits;
}

const MAPS = perChainTestnetArmedMaps(CONSTANTS);

test('the per-chain testnet arm set is not empty', () => {
    // Fail an empty set, which would pass the page check below without reading a line.
    assert.ok(MAPS.length >= 4,
        `only ${MAPS.length} maps in protocol/constants.js arm testnet per chain; the four ANCHOR `
        + 'gates armed in 0.21.3 should match. If an arm was withdrawn, re-check the testnet prose '
        + 'on the pages this file reads; otherwise the map parse here stopped matching.');
});

for (const rel of PAGES) {
    test(`${rel} never calls a per-chain testnet-armed gate inert on testnet`, () => {
        const markdown = fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8');
        assert.deepEqual(staleTestnetClaims(markdown, MAPS), [],
            `${rel} calls a gate inert on testnet, but protocol/constants.js arms it per chain `
            + 'there. Say mainnet is unarmed and testnet is armed per chain, in separate sentences.');
    });
}

test('falsification: the old fold and bundle-order sentences are caught', () => {
    const fold = '`ANCHOR_FOLD_ACTIVATION` gates v3. The fold gate uses the house UNARMED sentinel on mainnet and testnet.';
    const order = '`ANCHOR_BUNDLE_ORDER_ACTIVATION` gates order. It remains inert on mainnet and testnet until the operator arms it.';
    const bullet = '- **Folded publishing (`ANCHOR_FOLD_ACTIVATION`).** One reward. The gate is unarmed on mainnet and testnet.';
    for (const text of [fold, order, bullet]) {
        assert.equal(staleTestnetClaims(text, MAPS).length, 1, `not caught: ${text}`);
    }
    assert.deepEqual(staleTestnetClaims('`ANCHOR_FOLD_ACTIVATION` gates v3. Testnet is armed per chain.', MAPS), []);
});
