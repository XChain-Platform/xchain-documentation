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
 ********************************************************************/

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\s+/g, ' ');
}

// Pages that restate the ISSUE ticker rules for a reader creating a token. Each one
// must carry the gated creation floor and the reserved future chain roots, or a reader
// following it hits an unexplained `invalid: TICK (length|reserved)`.
const RESTATING_PAGES = [
    'user-guide/creating-tokens.md',
    'concepts/tokens.md',
    'getting-started/key-terms.md',
    'whitepaper.md',
    'components/sdk/actions.md',
];

test('every page restating the ticker rules names the tick-namespace gate, floor and reserved roots', () => {
    const bad = [];
    for (const rel of RESTATING_PAGES) {
        const md = read(rel);
        if (!md.includes('`TICK_NAMESPACE_ACTIVATION`')) bad.push(`${rel} does not name TICK_NAMESPACE_ACTIVATION`);
        if (!/\bfour characters\b/i.test(md)) bad.push(`${rel} does not state the four-character creation floor`);
        if (!md.includes('`ETH`')) bad.push(`${rel} gives no example of a reserved future chain root`);
    }
    assert.deepStrictEqual(bad, [], bad.join('\n'));
});

test('the ISSUE spec points at constants.js, not flag-days.md, for the reserved-root list', () => {
    const issue = read('protocol/actions/issue.md');
    assert.ok(!issue.includes('[Flag-Day Values](../flag-days.md) for the exact list'),
        'protocol/actions/issue.md sends readers to flag-days.md for a list that page does not hold');
    assert.ok(issue.includes('`RESERVED_FUTURE_ROOTS` in [`protocol/constants.js`](../constants.js)'),
        'protocol/actions/issue.md must point the exact reserved-root list at constants.js');
});

// flag-days.md is generated and lists a gate with no mainnet date only as a bare name in
// its index, so a link there cannot tell a reader where this gate is active. Pages state
// the status themselves, and the status words are tied to protocol/constants.js below.
const SENTINEL = 9999999999;
const STATUS_PAGES = ['user-guide/creating-tokens.md', 'protocol/actions/issue.md'];
const GATE_LINK_PAGES = [...RESTATING_PAGES, 'protocol/actions/issue.md'];

/** Paragraphs and bullets with hard wraps flattened; tables and headings are dropped. */
function paragraphs(markdown) {
    return markdown
        .split(/\n\s*\n|\n(?=\s*- )/)
        .map((block) => block.split('\n').filter((l) => !/^\s*[|#]/.test(l)).join(' ').trim())
        .filter(Boolean);
}

test('no page sends a reader to flag-days.md for a gate that page holds no status for', () => {
    const flagDays = fs.readFileSync(path.join(ROOT, 'protocol/flag-days.md'), 'utf8');
    const mentions = flagDays.split('\n').filter((l) => l.includes('TICK_NAMESPACE_ACTIVATION'));
    assert.ok(mentions.length >= 1, 'protocol/flag-days.md no longer names TICK_NAMESPACE_ACTIVATION at all');
    const indexOnly = mentions.every((l) => l.trim() === '- `TICK_NAMESPACE_ACTIVATION`');
    if (!indexOnly) return;
    const bad = [];
    for (const rel of GATE_LINK_PAGES) {
        const md = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        for (const para of paragraphs(md)) {
            if (para.includes('TICK_NAMESPACE_ACTIVATION') && /flag-days\.md\)/.test(para)) bad.push(`${rel}: ${para.slice(0, 160)}`);
        }
    }
    assert.deepStrictEqual(bad, [], bad.join('\n'));
});

test('the per-network status the pages state matches TICK_NAMESPACE_ACTIVATION in constants.js', () => {
    const { TICK_NAMESPACE_ACTIVATION: gate } = require(path.join(ROOT, 'protocol', 'constants.js'));
    assert.ok(gate && typeof gate === 'object', 'protocol/constants.js no longer exports TICK_NAMESPACE_ACTIVATION');
    const perCoinTestnet = Object.keys(gate).some((k) => /^[A-Z]+:testnet$/.test(k) && gate[k] < SENTINEL);
    const expected = [];
    if (gate.regtest === 0) expected.push('active on regtest');
    if (perCoinTestnet) expected.push('armed on testnet');
    if (gate.mainnet === SENTINEL) expected.push('not active on mainnet');
    assert.equal(expected.length, 3,
        'TICK_NAMESPACE_ACTIVATION moved: update the status sentence on ' + STATUS_PAGES.join(' and ') + ', then this test');
    // Scoped to the paragraphs naming the gate: other gates on the same page use the same words.
    const bad = [];
    for (const rel of STATUS_PAGES) {
        const md = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const gateText = paragraphs(md).filter((p) => p.includes('`TICK_NAMESPACE_ACTIVATION`')).join(' ');
        for (const phrase of expected) if (!gateText.includes(phrase)) bad.push(`${rel} does not say "${phrase}" beside the gate`);
        if (!gateText.includes('`TICK_NAMESPACE_ACTIVATION` in [')) bad.push(`${rel} does not point the heights at constants.js`);
    }
    assert.deepStrictEqual(bad, [], bad.join('\n'));
});

test('the user guide says a ticker cannot start with a caret', () => {
    const guide = read('user-guide/creating-tokens.md');
    assert.match(guide, /caret \(`\^`\)[^.]*first character/,
        'user-guide/creating-tokens.md lists `^` as allowed without saying it cannot start a name');
});
