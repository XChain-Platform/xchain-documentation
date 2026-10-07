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

const { sibling } = require('./helpers/sibling_checkout.js');

const GATES_4 = 'src/protocol_changes/gates_4.js';
const indexer = sibling('xchain-indexer', [GATES_4]);

// Read the per-coin testnet heights of the BRIDGE_POLICY_DETACH registry row.
function bridgeDetachTestnetHeights(root) {
    const source = fs.readFileSync(path.join(root, GATES_4), 'utf8');
    const row = source.match(/addGate\('bridge_policy_detach_activation\.BRIDGE_POLICY_DETACH', 'height', \{([\s\S]*?)\}\);/);
    assert.ok(row, 'xchain-indexer no longer registers the BRIDGE_POLICY_DETACH height row');
    return [...row[1].matchAll(/'([A-Z]+):testnet':\s*(\d+)/g)].map((m) => ({ coin: m[1], height: m[2] }));
}

// Verify the BRIDGE_POLICY_DETACH paragraph quotes each armed testnet height and no unarmed-testnet claim.
function assertBridgeDetachArming(markdown, heights) {
    const paragraph = markdown.match(/^`BRIDGE_POLICY_DETACH` gates[\s\S]*?(?=\n\n)/m);
    assert.ok(paragraph, 'the BRIDGE_POLICY_DETACH paragraph is missing');
    const prose = paragraph[0].replace(/\s+/g, ' ');
    for (const { coin, height } of heights) {
        assert.ok(prose.includes(`\`${coin}:testnet\` ${height}`), `BRIDGE_POLICY_DETACH omits ${coin}:testnet ${height}`);
    }
    assert.doesNotMatch(prose, /unarmed on mainnet and testnet/);
}

test('the BRIDGE_POLICY_DETACH paragraph matches the registry\'s testnet arming', { skip: indexer.skip }, () => {
    const heights = bridgeDetachTestnetHeights(indexer.root);
    assert.ok(heights.length >= 3, `parsed ${heights.length} testnet heights; the registry parse broke`);
    assertBridgeDetachArming(PAGE, heights);
});

test('the arming guard fails on a dropped height or the old unarmed wording', { skip: indexer.skip }, () => {
    const heights = bridgeDetachTestnetHeights(indexer.root);
    const paragraph = PAGE.match(/^`BRIDGE_POLICY_DETACH` gates[\s\S]*?(?=\n\n)/m)[0];
    const dropped = PAGE.replace(paragraph, paragraph.replace(`\`${heights[0].coin}:testnet\` ${heights[0].height}`, 'removed'));
    assert.throws(() => assertBridgeDetachArming(dropped, heights), /omits/);
    const stale = PAGE.replace('It is armed on testnet', 'It stays unarmed on mainnet and testnet, armed on testnet');
    assert.throws(() => assertBridgeDetachArming(stale, heights), /match/i);
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
