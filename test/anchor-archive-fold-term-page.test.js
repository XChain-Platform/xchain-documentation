/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'protocol', 'actions', 'anchor.md'), 'utf8');

function termSection(markdown) {
    const match = markdown.match(
        /### Archive reward termination \(`ANCHOR_ARCHIVE_FOLD_TERM_ACTIVATION`\)\n([\s\S]*?)(?=\n### |\n## )/,
    );
    assert.ok(match, 'anchor.md is missing the archive reward termination section');
    return match[1];
}

test('the ANCHOR page defines the archive fold term as a conjunctive gate', () => {
    const section = termSection(PAGE);

    assert.match(section, /only when it \*\*and\*\* `ANCHOR_FOLD_ACTIVATION` are active/);
    assert.match(section, /If either gate is\s+inactive, v1 archive rewards retain their pre-fold behavior/);
    assert.match(section, /never affects\s+`anchor_bundle` rewards/);
});

test('the ANCHOR page names both consensus planes used by the term', () => {
    const section = termSection(PAGE);

    assert.match(section, /BTC derive pass[\s\S]*reward's `SNAPSHOT_BLOCK`/);
    assert.match(section, /DOGE proof binding[\s\S]*DOGE\s+`BLOCK_INDEX`/);
});

test('the ANCHOR page states the term gate defaults for every network class', () => {
    const section = termSection(PAGE);

    assert.match(section, /Mainnet and every testnet chain slot use the house UNARMED sentinel/);
    assert.match(section, /Regtest\s+is genesis-active at height 0/);
    assert.match(section, /still requires the regtest fold gate to\s+be armed/);
});

test('the page guard fails when the term section is removed', () => {
    assert.throws(() => termSection(PAGE.replace('### Archive reward termination', '### Removed')));
});
