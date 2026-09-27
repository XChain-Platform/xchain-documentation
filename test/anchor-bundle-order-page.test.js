/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/actions/anchor.md'), 'utf8');

function versionZero(markdown) {
    const match = markdown.match(/### Version 0 only\n([\s\S]*?)(?=\n### Version 1 only)/);
    assert.ok(match, 'anchor.md is missing its Version 0 rules');
    return match[1];
}

function assertAnchorBundleOrderRule(markdown) {
    const rules = versionZero(markdown);
    assert.match(rules, /`ANCHOR_BUNDLE_ORDER_ACTIVATION`/);
    assert.match(rules, /\[Flag-Day Values\]\(\.\.\/flag-days\.md\)/);
    assert.match(rules, /ANCHOR's own DOGE block height/);
    assert.match(rules, /sections MUST be `CHAIN`-ascending/);
    assert.match(rules, /pairs MUST be\s+`PUBKEY`-ascending/);
    assert.match(rules, /ties are allowed/);
    assert.match(rules, /`SECTION i CHAIN \(not ascending\)`/);
    assert.match(rules, /`SECTION i PUBKEY \(not ascending\) at index k`/);
}

test('Version 0 documents the gated bundle order rule', () => {
    assertAnchorBundleOrderRule(PAGE);
});

test('the page guard fails when any required rule marker is removed', () => {
    for (const marker of [
        'ANCHOR_BUNDLE_ORDER_ACTIVATION',
        '[Flag-Day Values](../flag-days.md)',
        "ANCHOR's own DOGE block height",
        'sections MUST be `CHAIN`-ascending',
        'pairs MUST be',
        'ties are allowed',
        'SECTION i CHAIN (not ascending)',
        'SECTION i PUBKEY (not ascending) at index k',
    ]) {
        assert.throws(() => assertAnchorBundleOrderRule(PAGE.replace(marker, 'removed')));
    }
});
