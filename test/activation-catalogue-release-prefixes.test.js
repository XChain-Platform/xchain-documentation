// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2025–2026 Dankest, LLC

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const DOC_PATH = path.resolve(__dirname, '../protocol/activation-catalogue.md');
const doc = fs.readFileSync(DOC_PATH, 'utf8');
const TABLE_HEADINGS = ['A through D', 'G through P', 'R through X'];
const EXPECTED = [
    ['anchor_bundle_order_activation', 'ANCHOR_BUNDLE_ORDER_ACTIVATION', 'A through D'],
    ['anchor_fold_activation', 'ANCHOR_FOLD_ACTIVATION', 'A through D'],
    ['archive_match_count_activation', 'ARCHIVE_MATCH_COUNT_ACTIVATION', 'A through D'],
    [
        'archive_section_verdict_activation',
        'ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION',
        'A through D',
    ],
    ['bridge_policy_detach_activation', 'BRIDGE_POLICY_DETACH', 'A through D'],
    ['vm_lint_optional_chain_activation', 'VM_LINT_OPTIONAL_CHAIN_ACTIVATION', 'R through X'],
];

function parseRow(line) {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    assert.equal(cells.length, 3, `invalid catalogue row: ${line}`);
    const prefix = cells[0].match(/^`([^`]+)`$/);
    assert.ok(prefix, `invalid module prefix cell: ${cells[0]}`);
    return { prefix: prefix[1], principal: cells[1], unit: cells[2] };
}

function parseTables(markdown) {
    const tables = new Map();
    for (const section of markdown.split(/^## /m).slice(1)) {
        const [heading, ...lines] = section.split('\n');
        if (TABLE_HEADINGS.includes(heading.trim())) {
            tables.set(heading.trim(), lines.filter((line) => /^\| `/.test(line)).map(parseRow));
        }
    }
    assert.deepEqual([...tables.keys()], TABLE_HEADINGS, 'catalogue tables changed');
    return tables;
}

function parseReleasePrefixes(markdown) {
    const tables = parseTables(markdown);
    for (const [prefix, principal, expectedTable] of EXPECTED) {
        const matches = [...tables].flatMap(([table, rows]) => (
            rows.filter((row) => row.prefix === prefix).map((row) => ({ table, ...row }))
        ));
        assert.equal(matches.length, 1, `${prefix} must appear exactly once`);
        assert.equal(matches[0].table, expectedTable, `${prefix} is in the wrong table`);
        assert.equal(matches[0].principal, `\`${principal}\``, `${prefix} has the wrong principal row`);
        assert.equal(matches[0].unit, 'height', `${prefix} has the wrong unit`);
    }
    return tables;
}

test('release activation prefixes have exact catalogue rows', () => {
    assert.equal(parseReleasePrefixes(doc).size, 3);
});

test('a dropped release activation row fails catalogue parsing', () => {
    const dropped = doc.replace(/^\| `anchor_fold_activation` .*\n/m, '');
    assert.notEqual(dropped, doc, 'falsification fixture did not remove its row');
    assert.throws(() => parseReleasePrefixes(dropped), /anchor_fold_activation must appear exactly once/);
});
