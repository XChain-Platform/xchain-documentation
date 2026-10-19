/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/actions/anchor.md'), 'utf8');

function versionZeroOne(markdown) {
    const match = markdown.match(/### Version 0 \/ 1\n([\s\S]*?)(?=\n### Version 0 only)/);
    assert.ok(match, 'anchor.md is missing its Version 0 / 1 rules');
    return match[1];
}

function assertCheckpointSeqBindRule(markdown) {
    const rules = versionZeroOne(markdown);
    assert.match(rules, /`ANCHOR_CHECKPOINT_SEQ_BIND_ACTIVATION`/);
    assert.match(rules, /\[Flag-Day Values\]\(\.\.\/flag-days\.md\)/);
    assert.doesNotMatch(rules, /\b(?:20\d{2}-\d{2}-\d{2}|1\d{9})\b/);
    assert.match(rules, /ANCHOR's own DOGE block\s+height/);
    assert.match(rules, /`CHECKPOINT_SEQ \(not a canonical safe integer\)`/);
    assert.match(rules, /`SNAPSHOT_BLOCK \(not a canonical safe integer\)`/);
    assert.match(rules, /`CHECKPOINT_SEQ \(does not match SNAPSHOT_BLOCK\)`/);
    assert.match(rules, /only records stored valid/);
}

test('Version 0 / 1 documents the gated checkpoint sequence binding rule', () => {
    assertCheckpointSeqBindRule(PAGE);
});

test('the page guard fails when any required rule marker is removed', () => {
    for (const marker of [
        /ANCHOR_CHECKPOINT_SEQ_BIND_ACTIVATION/,
        /\[Flag-Day Values\]\(\.\.\/flag-days\.md\)/,
        /ANCHOR's own DOGE block\s+height/,
        /CHECKPOINT_SEQ \(not a canonical safe integer\)/,
        /SNAPSHOT_BLOCK \(not a canonical safe integer\)/,
        /CHECKPOINT_SEQ \(does not match SNAPSHOT_BLOCK\)/,
        /only records stored valid/,
    ]) {
        const rules = versionZeroOne(PAGE);
        const page = PAGE.replace(rules, rules.replace(marker, 'removed'));
        assert.throws(() => assertCheckpointSeqBindRule(page));
    }
});

test('the page guard fails when the rule quotes a flag-day instant', () => {
    for (const instant of ['2099-01-01', '1999999999']) {
        const page = PAGE.replace('From `ANCHOR_CHECKPOINT_SEQ_BIND_ACTIVATION`',
            `${instant} From \`ANCHOR_CHECKPOINT_SEQ_BIND_ACTIVATION\``);
        assert.throws(() => assertCheckpointSeqBindRule(page));
    }
});
