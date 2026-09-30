/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/actions/anchor.md'), 'utf8');

function versionOne(markdown) {
    const match = markdown.match(/### Version 1 only\n([\s\S]*?)(?=\n### Version 2 only)/);
    assert.ok(match, 'anchor.md is missing its Version 1 rules');
    return match[1];
}

function assertArchiveMatchCountRule(markdown) {
    const rules = versionOne(markdown);
    assert.match(rules, /`ARCHIVE_MATCH_COUNT_ACTIVATION`/);
    assert.match(rules, /\[Flag-Day Values\]\(\.\.\/flag-days\.md\)/);
    assert.match(rules, /v1 head's DOGE block height/);
    assert.match(rules, /`MATCH_COUNT` must equal the decompressed archive's `matches\.length`/);
    assert.match(rules, /`invalid: MATCH_COUNT \(archive mismatch\)`/);
    assert.match(rules, /reassembled batch `invalid_archive`/);
}

test('Version 1 documents the gated archive MATCH_COUNT rule', () => {
    assertArchiveMatchCountRule(PAGE);
});

test('the page guard fails when any required rule marker is removed', () => {
    for (const marker of [
        'ARCHIVE_MATCH_COUNT_ACTIVATION',
        '[Flag-Day Values](../flag-days.md)',
        "v1 head's DOGE block height",
        "`MATCH_COUNT` must equal the decompressed archive's `matches.length`",
        'invalid: MATCH_COUNT (archive mismatch)',
        'reassembled batch `invalid_archive`',
    ]) {
        assert.throws(() => assertArchiveMatchCountRule(PAGE.replace(marker, 'removed')));
    }
});
