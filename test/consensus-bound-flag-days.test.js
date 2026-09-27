/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/actions/price.md'), 'utf8');
const MARKERS = [
    'PRICE_V1_CANONICAL_ACTIVATION',
    '[Flag-Day Values](../flag-days.md)',
    'invalid: VALUE (format)',
    'invalid: FEE (format)',
    'PRICE_V1_VALUE_MAX_LENGTH',
    'PRICE_V1_FEE_MAX_LENGTH',
    '19-character',
    '20-character',
];

function versionOneRules(markdown) {
    const match = markdown.match(/## Rules\n\n### Version 1: User Oracle TOKEN\/FIAT Price\n([\s\S]*?)(?=\n### Version 0:)/);
    assert.ok(match, 'price.md is missing its Version 1 rules');
    return match[1];
}

function assertCanonicalFormRule(markdown) {
    const rules = versionOneRules(markdown);
    for (const marker of MARKERS) assert.ok(rules.includes(marker), `${marker} is missing from the Version 1 rules`);
}

test('Version 1 documents the gated VALUE and FEE canonical form', () => {
    assertCanonicalFormRule(PAGE);
});

test('the page guard fails when any required rule marker is removed', () => {
    for (const marker of MARKERS) {
        assert.throws(() => assertCanonicalFormRule(PAGE.replace(marker, 'removed')));
    }
});
