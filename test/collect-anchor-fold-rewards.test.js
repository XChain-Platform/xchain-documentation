/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/actions/collect.md'), 'utf8');

function rewardRow(markdown, rewardType) {
    const row = markdown.split('\n').find((line) => {
        const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
        return cells[0] === `\`${rewardType}\``;
    });
    assert.ok(row, `collect.md is missing the ${rewardType} reward row`);
    return row;
}

function assertAnchorFoldRewards(markdown) {
    const bundle = rewardRow(markdown, 'anchor_bundle');
    const archive = rewardRow(markdown, 'anchor_archive');
    assert.match(bundle, /\bv3\b/);
    assert.match(bundle, /`ANCHOR_FOLD_ACTIVATION`/);
    assert.match(archive, /`ANCHOR_FOLD_ACTIVATION`/);
    assert.match(archive, /\bretired\b/);
    assert.match(archive, /\(\.\/anchor\.md#version-3-only\)/);
    for (const row of [bundle, archive]) {
        assert.doesNotMatch(row, /\b(?:20\d{2}-\d{2}-\d{2}|\d{10})\b/);
    }
}

test('anchor reward rows document the fold boundary', () => {
    assertAnchorFoldRewards(PAGE);
});

test('the reward row guard fails when any required marker is removed', () => {
    for (const [rewardType, marker] of [
        ['anchor_bundle', 'v3'],
        ['anchor_bundle', 'ANCHOR_FOLD_ACTIVATION'],
        ['anchor_archive', 'ANCHOR_FOLD_ACTIVATION'],
        ['anchor_archive', 'retired'],
        ['anchor_archive', './anchor.md#version-3-only'],
    ]) {
        const row = rewardRow(PAGE, rewardType);
        const changed = PAGE.replace(row, row.replace(marker, 'removed'));
        assert.throws(() => assertAnchorFoldRewards(changed));
    }
});

test('the reward row guard rejects dates and ten-digit numbers', () => {
    const row = rewardRow(PAGE, 'anchor_bundle');
    for (const instant of ['2099-01-01', '1999999999']) {
        assert.throws(() => assertAnchorFoldRewards(PAGE.replace(row, `${row} ${instant}`)));
    }
});
