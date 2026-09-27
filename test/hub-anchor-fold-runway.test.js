/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../components/hub/operations.md'), 'utf8');

function troubleshootingSection(markdown) {
    const match = markdown.match(/### ANCHOR publisher not publishing \/ DOGE wallet low\n([\s\S]*?)(?=\n### )/);
    assert.ok(match, 'operations.md is missing its ANCHOR publisher troubleshooting subsection');
    return match[1];
}

function assertFoldedPublishingRunway(markdown) {
    const section = troubleshootingSection(markdown);
    assert.match(section, /- \*\*Folded publishing \(`ANCHOR_FOLD_ACTIVATION`\)\.\*\*/);
    assert.match(section, /`ANCHOR_BUNDLE_MAX_BYTES`/);
    assert.match(section, /`ARCHIVE_COUNT`/);
    assert.match(section, /`anchor_archive`/);
    assert.match(section, /same cycle/);
    assert.match(section, /\[ANCHOR\]\(\.\.\/\.\.\/protocol\/actions\/anchor\.md#version-3-only\)/);
}

test('hub troubleshooting documents folded publishing runway', () => {
    assertFoldedPublishingRunway(PAGE);
});

test('the page guard fails when any required marker is removed', () => {
    for (const marker of [
        'Folded publishing',
        'ANCHOR_FOLD_ACTIVATION',
        'ANCHOR_BUNDLE_MAX_BYTES',
        'ARCHIVE_COUNT',
        'anchor_archive',
        'same cycle',
        '[ANCHOR](../../protocol/actions/anchor.md#version-3-only)',
    ]) {
        assert.throws(() => assertFoldedPublishingRunway(PAGE.replace(marker, 'removed')));
    }
});
