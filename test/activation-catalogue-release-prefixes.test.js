// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2025–2026 Dankest, LLC

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_PATH = path.resolve(__dirname, '../protocol/activation-catalogue.md');
const doc = fs.readFileSync(DOC_PATH, 'utf8');
const REGISTRY_FILE = 'src/protocol_changes.js';
const REGISTRY_DIR = 'src/protocol_changes';
const indexer = sibling('xchain-indexer', [REGISTRY_FILE, REGISTRY_DIR]);
const TABLE_HEADINGS = ['A through E', 'G through P', 'R through X'];
const EXPECTED = [
    [
        'anchor_archive_fold_term_activation',
        'ANCHOR_ARCHIVE_FOLD_TERM_ACTIVATION',
        'A through E',
        'height',
    ],
    ['anchor_bundle_order_activation', 'ANCHOR_BUNDLE_ORDER_ACTIVATION', 'A through E', 'height'],
    ['anchor_fold_activation', 'ANCHOR_FOLD_ACTIVATION', 'A through E', 'height'],
    ['archive_match_count_activation', 'ARCHIVE_MATCH_COUNT_ACTIVATION', 'A through E', 'height'],
    ['attest_relay_fee_activation', 'ATTEST_RELAY_FEE_ACTIVATION', 'A through E', 'height'],
    [
        'archive_section_verdict_activation',
        'ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION',
        'A through E',
        'height',
    ],
    ['bridge_policy_detach_activation', 'BRIDGE_POLICY_DETACH', 'A through E', 'height'],
    [
        'bridge_row_fields_terminal_activation',
        'BRIDGE_ROW_FIELDS_TERMINAL_ACTIVATION',
        'A through E',
        'height',
    ],
    [
        'callback_compensation_activation',
        'CALLBACK_COMPENSATES_EVERY_DEBITED_HOLDER',
        'A through E',
        'height',
    ],
    [
        'dispenser_freshness_proven_use_activation',
        'DISPENSER_FRESHNESS_PROVEN_USE_ACTIVATION',
        'A through E',
        'time',
    ],
    [
        'dispenser_settlement_price_activation',
        'DISPENSER_SETTLEMENT_PRICE_ACTIVATION',
        'A through E',
        'time',
    ],
    ['empty_allow_list_denies_activation', 'EMPTY_ALLOW_LIST_DENIES', 'A through E', 'height'],
    ['list_change_rematch_activation', 'LIST_CHANGE_REMATCH_ACTIVATION', 'G through P', 'height'],
    ['list_edit_remove_activation', 'LIST_EDIT_REMOVE_ACTIVATION', 'G through P', 'time'],
    [
        'list_reference_validity_activation',
        'LIST_REFERENCE_REQUIRES_VALID_LIST',
        'G through P',
        'height',
    ],
    ['market_list_source_activation', 'MARKET_LIST_SOURCE_ACTIVATION', 'G through P', 'height'],
    ['mirror_admission_margin_activation', 'ADMIT_CHAIN_MARGIN_ACTIVATION', 'G through P', 'height'],
    [
        'order_swap_payout_policy_activation',
        'ORDER_SWAP_PAYOUT_POLICY_PER_TOKEN',
        'G through P',
        'height',
    ],
    ['swap_edit_rematch_activation', 'SWAP_EDIT_REMATCH_ACTIVATION', 'R through X', 'height'],
    ['vm_lint_optional_chain_heights', 'VM_LINT_OPTIONAL_CHAIN_ACTIVATION', 'R through X', 'height'],
    [
        'vote_callback_binding_activation',
        'VOTE_CALLBACK_BINDING_REQUIRES_USABLE_METHOD',
        'R through X',
        'height',
    ],
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
    for (const [prefix, principal, expectedTable, unit] of EXPECTED) {
        const matches = [...tables].flatMap(([table, rows]) => (
            rows.filter((row) => row.prefix === prefix).map((row) => ({ table, ...row }))
        ));
        assert.equal(matches.length, 1, `${prefix} must appear exactly once`);
        assert.equal(matches[0].table, expectedTable, `${prefix} is in the wrong table`);
        assert.equal(matches[0].principal, `\`${principal}\``, `${prefix} has the wrong principal row`);
        assert.equal(matches[0].unit, unit, `${prefix} has the wrong unit`);
    }
    return tables;
}

// Collect every *_activation stem an uncommented registry addGate row names.
function registryActivationStems(sources) {
    const stems = new Set();
    for (const line of sources.join('\n').split('\n')) {
        if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
        for (const m of line.matchAll(/addGate\(\s*'([^'.]+)\./g)) {
            if (m[1].endsWith('_activation')) stems.add(m[1]);
        }
    }
    return stems;
}

// List registry stems with no catalogue row; one direction only (registry within catalogue).
function missingFromCatalogue(markdown, sources) {
    const rows = [...parseTables(markdown).values()].flat();
    const catalogued = new Set(rows.map((row) => row.prefix));
    return [...registryActivationStems(sources)].filter((stem) => !catalogued.has(stem)).sort();
}

function readRegistrySources(root) {
    const dir = path.join(root, REGISTRY_DIR);
    const parts = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
    return [path.join(root, REGISTRY_FILE), ...parts].map((f) => fs.readFileSync(f, 'utf8'));
}

test('release activation prefixes have exact catalogue rows', () => {
    assert.equal(parseReleasePrefixes(doc).size, 3);
});

test('a dropped release activation row fails catalogue parsing', () => {
    const dropped = doc.replace(/^\| `bridge_row_fields_terminal_activation` .*\n/m, '');
    assert.notEqual(dropped, doc, 'falsification fixture did not remove its row');
    assert.throws(
        () => parseReleasePrefixes(dropped),
        /bridge_row_fields_terminal_activation must appear exactly once/,
    );
});

test('every registry *_activation stem has a catalogue row', { skip: indexer.skip }, () => {
    const sources = readRegistrySources(indexer.root);
    assert.ok(registryActivationStems(sources).size > 0, 'registry scan found no *_activation stems');
    assert.deepEqual(missingFromCatalogue(doc, sources), [], 'catalogue is missing registry prefixes');
});

test('an uncatalogued registry stem is reported by name and a commented one is not', () => {
    const fixture = [
        "addGate('zzz_fixture_activation.ZZZ_FIXTURE', 'height', {});",
        "// addGate('yyy_commented_activation.YYY', 'height', {});",
        " * addGate('xxx_block_comment_activation.XXX', 'height', {});",
        "addGate('market_list_source_activation.MARKET_LIST_SOURCE_ACTIVATION', 'height', {});",
    ];
    assert.deepEqual(missingFromCatalogue(doc, fixture), ['zzz_fixture_activation']);
});
