/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC – https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, '..');
const DATABASE_MD = path.join(DOC_ROOT, 'components', 'hub', 'database.md');
const CONFIGURATION_MD = path.join(DOC_ROOT, 'components', 'hub', 'configuration.md');

function typeCell(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return null;
    const cells = trimmed.split('|').map((c) => c.trim());
    if (cells.length < 4) return null;
    return cells[2].replace(/^`|`$/g, '');
}

function typeCellsStartingWith(content, prefix) {
    return content.split('\n').map(typeCell).filter((c) => c && c.startsWith(prefix));
}

function tableCells(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return [];
    return trimmed.split('|').slice(1, -1).map((cell) => cell.trim());
}

function timestampCellViolations(content, label) {
    const bad = [];
    content.split('\n').forEach((line, i) => {
        const hasTimestamp = tableCells(line).some((cell) => /^`?TIMESTAMP\b/.test(cell));
        if (hasTimestamp) bad.push(`${label}:${i + 1} has a cell starting with TIMESTAMP`);
    });
    return bad;
}

test('no table cell in database.md or configuration.md still types a column TIMESTAMP', () => {
    const bad = [DATABASE_MD, CONFIGURATION_MD].flatMap(
        (f) => timestampCellViolations(fs.readFileSync(f, 'utf8'), path.relative(DOC_ROOT, f)),
    );
    assert.deepStrictEqual(bad, [], `hub schema pages still type a column TIMESTAMP:\n${bad.join('\n')}`);
});

test('database.md retypes at least 30 columns to DATETIME', () => {
    const count = typeCellsStartingWith(fs.readFileSync(DATABASE_MD, 'utf8'), 'DATETIME').length;
    assert.ok(count >= 30, `only ${count} DATETIME type cells found in database.md; the retype may not have run`);
});

test('the Time columns section names UTC and the 2038 TIMESTAMP ceiling', () => {
    const body = fs.readFileSync(DATABASE_MD, 'utf8');
    const section = body.split(/^## /m).find((s) => s.startsWith('Time columns'));
    assert.ok(section, 'database.md has no ## Time columns section');
    assert.ok(section.includes('UTC'), 'the Time columns section does not name UTC');
    assert.ok(section.includes('2038'), 'the Time columns section does not name 2038');
});

test('the cell checker catches a TIMESTAMP type cell, backtick or not, and ignores CURRENT_TIMESTAMP', () => {
    const sample = '| `updated_at` | `TIMESTAMP NULL` | Last modification time |\n'
        + '| `updated_at` | TIMESTAMP | Last update timestamp |\n'
        + '| `intent_at` | `DATETIME DEFAULT CURRENT_TIMESTAMP` | before the send |\n';
    assert.deepStrictEqual(
        timestampCellViolations(sample, 'sample'),
        ['sample:1 has a cell starting with TIMESTAMP', 'sample:2 has a cell starting with TIMESTAMP'],
    );
});
