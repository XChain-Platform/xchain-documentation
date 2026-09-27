/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/protocol-activation.md'), 'utf8');
const START = '`PRICE_V1_CANONICAL_ACTIVATION` gates';
const END = 'Regtest runs every cohort';

function releaseHeightGates(markdown) {
    const start = markdown.indexOf(START);
    const end = markdown.indexOf(END, start);
    assert.notStrictEqual(start, -1, 'the PRICE_V1_CANONICAL_ACTIVATION paragraph is missing');
    assert.notStrictEqual(end, -1, 'the Regtest cohort paragraph is missing');
    return markdown.slice(start, end);
}

function assertReleaseHeightGates(markdown) {
    const inventory = releaseHeightGates(markdown);
    for (const marker of [
        'ANCHOR_FOLD_ACTIVATION',
        'ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION',
        'BRIDGE_POLICY_DETACH',
        'XC_ANCHOR_FOLD_REGTEST_ACTIVATION',
        './actions/anchor.md',
        './token-bridge.md',
        'own block height',
    ]) {
        assert.ok(inventory.includes(marker), `release height-gate inventory is missing ${marker}`);
    }
    assert.doesNotMatch(inventory, /\b(?:20\d{2}-\d{2}-\d{2}|\d{10})\b/);
}

test('the release height-gate inventory names every gate and supporting page', () => {
    assertReleaseHeightGates(PAGE);
});

test('the inventory guard fails when any required marker is removed', () => {
    for (const marker of [
        'ANCHOR_FOLD_ACTIVATION',
        'ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION',
        'BRIDGE_POLICY_DETACH',
        'XC_ANCHOR_FOLD_REGTEST_ACTIVATION',
        './actions/anchor.md',
        './token-bridge.md',
        'own block height',
    ]) {
        assert.throws(() => assertReleaseHeightGates(PAGE.replace(marker, 'removed')));
    }
});
