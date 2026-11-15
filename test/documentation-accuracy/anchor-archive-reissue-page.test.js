// Copyright © 2025–2026 Dankest, LLC
// Based on XChain Platform by Dankest, LLC – https://dankest.llc
//
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// This file is part of XChain Platform. Licensed under the GNU Affero
// General Public License v3.0 or later; see LICENSE.md. A commercial
// license (without AGPL source-disclosure terms) is available -
// contact legal@dankest.llc.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(
    path.resolve(__dirname, '../../protocol/actions/anchor.md'), 'utf8');

function archiveIdentity(markdown) {
    const match = markdown.match(/#### Archive batch identity\n([\s\S]*?)(?=\n### Version 3 only)/);
    assert.ok(match, 'anchor.md is missing its Archive batch identity section');
    return match[1];
}

function assertArchiveReissueRule(markdown) {
    const section = archiveIdentity(markdown);
    assert.match(section, /`ARCHIVE_V1_REISSUE_REFUSAL_ACTIVATION`/);
    assert.match(section, /`ANCHOR_FOLD_ACTIVATION`/);
    assert.match(section, /`ANCHOR_FOLD_REISSUE_SOURCE_AUTHOR_ACTIVATION`/);
    assert.match(section, /`BATCH_CRC32` matches case-insensitively and its `MATCH_COUNT` matches numerically/);
    assert.match(section, /invalid: MATCH_BATCH_SEQ \(retry; this publisher already holds an archive under this seq\)/);
    assert.match(section, /`valid` or `unverified`/);
    assert.doesNotMatch(section, /an equal seq is accepted \(re-broadcast, failover/);
    assert.doesNotMatch(section, /\b(?:20\d{2}-\d{2}-\d{2}|1\d{9})\b/);
}

test('archive identity documents gated same-author re-issue refusal', () => {
    assertArchiveReissueRule(PAGE);
});

test('archive re-issue page guard fails when a required marker is removed', () => {
    for (const marker of [
        /ARCHIVE_V1_REISSUE_REFUSAL_ACTIVATION/,
        /ANCHOR_FOLD_ACTIVATION/,
        /ANCHOR_FOLD_REISSUE_SOURCE_AUTHOR_ACTIVATION/,
        /`BATCH_CRC32` matches case-insensitively and its `MATCH_COUNT` matches numerically/,
        /invalid: MATCH_BATCH_SEQ \(retry; this publisher already holds an archive under this seq\)/,
        /`valid` or `unverified`/,
    ]) {
        const section = archiveIdentity(PAGE);
        const changed = PAGE.replace(section, section.replace(marker, 'removed'));
        assert.throws(() => assertArchiveReissueRule(changed));
    }
});

test('archive re-issue page guard rejects an activation instant', () => {
    for (const instant of ['2099-01-01', '1999999999']) {
        const section = archiveIdentity(PAGE);
        const changed = PAGE.replace(section, instant + ' ' + section);
        assert.throws(() => assertArchiveReissueRule(changed));
    }
});
