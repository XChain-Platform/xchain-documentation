/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('./helpers/sibling_checkout.js');

const vm = sibling('xchain-vm', ['src/index.js', 'src/index']);
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const PAGE =fs.readFileSync(path.resolve(__dirname, '../protocol/protocol-activation.md'), 'utf8');
const MARKERS = [
    'xchain-vm/src/index/lint_optional_chain_heights.js',
    'LINT_OPTIONAL_CHAIN_ACTIVATION',
    'isLintOptionalChainActive',
    'vm_lint_optional_chain_heights.VM_LINT_OPTIONAL_CHAIN_ACTIVATION',
];

function vmGatesSection(markdown) {
    const match = markdown.match(/^## VM gates \(service-carried\)\n([\s\S]*?)(?=^## )/m);
    assert.ok(match, 'protocol activation page is missing its VM gates section');
    return match[1];
}

function optionalChainRow(section) {
    const row = section.split('\n').find((line) => line.includes('Deploy-lint optional-chain look-through'));
    assert.ok(row, 'VM gates table is missing the optional-chain row');
    return row;
}

function assertOptionalChainGate(markdown) {
    const section = vmGatesSection(markdown);
    for (const marker of MARKERS) assert.match(section, new RegExp(marker.replaceAll('.', '\\.')));
    const tableRows = section.split('\n').filter((line) => /^\| \*\*/.test(line));
    assert.equal(tableRows.length, 3);
    assert.doesNotMatch(section, /Two further/);
    assert.doesNotMatch(optionalChainRow(section), /20\d{2}-\d{2}-\d{2}/);
}

test('VM gates document the optional-chain lint gate', () => {
    assertOptionalChainGate(PAGE);
});

test('the VM gate guard fails when any required marker is removed', () => {
    for (const marker of MARKERS) {
        assert.throws(() => assertOptionalChainGate(PAGE.replaceAll(marker, 'removed')));
    }
});

// Name the gates the service row must list: every height map and every off-cohort time gate.
function vmGateNames(sources) {
    const text = sources.join('\n');
    const maps = [...text.matchAll(/^const ([A-Z0-9_]+_ACTIVATION) = Object\.freeze\(/gm)].map((m) => m[1]);
    const times = [...text.matchAll(/^const ([A-Z0-9_]+_GATE_BLOCK_TIME) = (\d+);/gm)];
    const cohort = times.find((m) => m[1] === 'BINARY_ALLOC_GATE_BLOCK_TIME');
    assert.ok(cohort, 'VM source no longer defines BINARY_ALLOC_GATE_BLOCK_TIME');
    return { maps, own: times.filter((m) => m[2] !== cohort[2]).map((m) => m[1]) };
}

function assertVmServiceRow(markdown, sources) {
    const row = markdown.split('\n').find((line) => line.startsWith('| `xchain-vm` |'));
    assert.ok(row, 'protocol activation page is missing the xchain-vm service row');
    const { maps, own } = vmGateNames(sources);
    assert.ok(maps.length > 0 && own.length > 0, 'VM gate scan found nothing to check');
    for (const name of [...maps, ...own]) assert.ok(row.includes(`\`${name}\``), `xchain-vm row omits ${name}`);
    assert.match(row, new RegExp(`\\b${NUMBER_WORDS[maps.length]} per-coin height-keyed maps`));
}

function readVmSources(root) {
    const dir = path.join(root, 'src/index');
    const parts = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
    return [path.join(root, 'src/index.js'), ...parts].map((f) => fs.readFileSync(f, 'utf8'));
}

test('the xchain-vm service row names every VM-carried gate', { skip: vm.skip }, () => {
    assertVmServiceRow(PAGE, readVmSources(vm.root));
});

test('the service-row guard fails when a gate name or the map count drifts', { skip: vm.skip }, () => {
    const sources = readVmSources(vm.root);
    const dropped = PAGE.replaceAll('`JSON_STRINGIFY_HOOK_GATE_BLOCK_TIME`', 'removed');
    assert.throws(() => assertVmServiceRow(dropped, sources), /omits JSON_STRINGIFY_HOOK_GATE_BLOCK_TIME/);
    const miscounted = PAGE.replace('four per-coin height-keyed maps', 'three per-coin height-keyed maps');
    assert.throws(() => assertVmServiceRow(miscounted, sources), /per-coin height-keyed maps/);
});
