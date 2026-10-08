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

// Name the gates the service row must list: every activation map and every off-cohort time gate.
// A network-keyed map whose mainnet slot is a named _GATE_BLOCK_TIME constant is covered by it.
function vmGateNames(sources) {
    const text = sources.map((s) => s.text).join('\n');
    const core = sources.filter((s) => s.core).map((s) => s.text).join('\n');
    const decls = /^const ([A-Z0-9_]+_ACTIVATION) = Object\.(?:freeze|seal)\(\{([\s\S]*?)\}\);/gm;
    const perCoin = [];
    const network = [];
    for (const [, name, body] of text.matchAll(decls)) {
        if (/'[A-Z]+:(?:mainnet|testnet|regtest)'/.test(body)) perCoin.push(name);
        else if (!/^\s*mainnet:\s*[A-Z0-9_]+_GATE_BLOCK_TIME\s*,/m.test(body)) network.push(name);
    }
    const times = [...core.matchAll(/^const ([A-Z0-9_]+_GATE_BLOCK_TIME) = (\d+);/gm)];
    const cohort = times.find((m) => m[1] === 'BINARY_ALLOC_GATE_BLOCK_TIME');
    assert.ok(cohort, 'VM source no longer defines BINARY_ALLOC_GATE_BLOCK_TIME');
    return { perCoin, network, own: times.filter((m) => m[2] !== cohort[2]).map((m) => m[1]) };
}

function assertVmServiceRow(markdown, sources) {
    const row = markdown.split('\n').find((line) => line.startsWith('| `xchain-vm` |'));
    assert.ok(row, 'protocol activation page is missing the xchain-vm service row');
    const { perCoin, network, own } = vmGateNames(sources);
    assert.ok(perCoin.length > 0 && network.length > 0 && own.length > 0, 'VM gate scan found nothing to check');
    for (const name of [...perCoin, ...network, ...own]) {
        assert.ok(row.includes(`\`${name}\``), `xchain-vm row omits ${name}`);
    }
    assert.match(row, new RegExp(`\\b${NUMBER_WORDS[perCoin.length]} per-coin height-keyed maps`));
    assert.match(row, new RegExp(`\\b${NUMBER_WORDS[network.length]} network-keyed block-time maps`));
}

// Read every VM source except the vendored protocol constants and the simulator toolkit.
// The gate-constant scan stays on src/index.js and src/index/ (the `core` files).
function readVmSources(root) {
    const src = path.join(root, 'src');
    const skip = new Set([path.join(src, 'protocol'), path.join(src, 'toolkit')]);
    const index = path.join(src, 'index');
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { if (!skip.has(full)) walk(full); }
            else if (entry.name.endsWith('.js')) files.push(full);
        }
    };
    walk(src);
    return files.sort().map((f) => ({
        text: fs.readFileSync(f, 'utf8'),
        core: f === path.join(src, 'index.js') || path.dirname(f) === index,
    }));
}

test('the xchain-vm service row names every VM-carried gate', { skip: vm.skip }, () => {
    assertVmServiceRow(PAGE, readVmSources(vm.root));
});

// Read every armed `'COIN:testnet': height` slot of the VM's optional-chain map.
function optionalChainTestnetHeights(root) {
    const source = fs.readFileSync(path.join(root, 'src/index/lint_optional_chain_heights.js'), 'utf8');
    const map = source.match(/const LINT_OPTIONAL_CHAIN_ACTIVATION = Object\.freeze\(\{([\s\S]*?)\}\);/);
    assert.ok(map, 'xchain-vm no longer declares LINT_OPTIONAL_CHAIN_ACTIVATION as a frozen map');
    return [...map[1].matchAll(/'([A-Z]+):testnet':\s*(\d+)/g)].map((m) => ({ coin: m[1], height: m[2] }));
}

// Verify both pages quote each armed testnet height and never call testnet unarmed.
function assertTestnetHeights(activationPage, operationsPage, heights) {
    assert.ok(heights.length >= 3, `parsed ${heights.length} testnet heights; the VM map parse broke`);
    const row = optionalChainRow(vmGatesSection(activationPage));
    const spellings = operationsPage.match(/### Global-object spellings\n([\s\S]*?)(?=\n## )/)[1];
    for (const { coin, height } of heights) {
        const quoted = `\`${coin}:testnet\` ${height}`;
        assert.ok(row.includes(quoted), `optional-chain row omits ${quoted}`);
        assert.ok(spellings.includes(quoted), `operations.md Global-object spellings omits ${quoted}`);
    }
    for (const text of [row, vmGatesSection(activationPage), spellings]) {
        assert.doesNotMatch(text, /unarmed on (?:mainnet and )?testnet|not yet armed on mainnet or\s+testnet/);
    }
}

const OPERATIONS = fs.readFileSync(path.resolve(__dirname, '../components/vm/operations.md'), 'utf8');

test('the optional-chain docs quote the VM map\'s armed testnet heights', { skip: vm.skip }, () => {
    assertTestnetHeights(PAGE, OPERATIONS, optionalChainTestnetHeights(vm.root));
});

test('the testnet-height guard fails on a dropped height or an unarmed claim', { skip: vm.skip }, () => {
    const heights = optionalChainTestnetHeights(vm.root);
    const row = optionalChainRow(vmGatesSection(PAGE));
    const dropped = PAGE.replace(row, row.replace(`\`${heights[0].coin}:testnet\` ${heights[0].height}`, 'removed'));
    assert.throws(() => assertTestnetHeights(dropped, OPERATIONS, heights), /optional-chain row omits/);
    const moved = heights.map((h, i) => (i === 1 ? { ...h, height: `${h.height}1` } : h));
    assert.throws(() => assertTestnetHeights(PAGE, OPERATIONS, moved), /omits/);
    const stale = OPERATIONS.replace('armed on testnet at each chain', 'unarmed on mainnet and testnet, at each chain');
    assert.throws(() => assertTestnetHeights(PAGE, stale, heights), /doesNotMatch|match/i);
});

test('the service-row guard fails when a gate name or the map count drifts', { skip: vm.skip }, () => {
    const sources = readVmSources(vm.root);
    const dropped = PAGE.replaceAll('`JSON_STRINGIFY_HOOK_GATE_BLOCK_TIME`', 'removed');
    assert.throws(() => assertVmServiceRow(dropped, sources), /omits JSON_STRINGIFY_HOOK_GATE_BLOCK_TIME/);
    const miscounted = PAGE.replace('four per-coin height-keyed maps', 'three per-coin height-keyed maps');
    assert.throws(() => assertVmServiceRow(miscounted, sources), /per-coin height-keyed maps/);
    const netNames = ['ACCESSOR_OWN_KEY_ACTIVATION', 'GAS_CEILING_SUCCESS_ACTIVATION', 'ITER_SET_METER_ACTIVATION', 'APPLY_LENGTH_METER_ACTIVATION'];
    for (const name of netNames) {
        const omitted = PAGE.replaceAll(`\`${name}\``, 'removed');
        assert.throws(() => assertVmServiceRow(omitted, sources), new RegExp(`omits ${name}`));
    }
    const netMiscounted = PAGE.replace('four network-keyed block-time maps', 'three network-keyed block-time maps');
    assert.throws(() => assertVmServiceRow(netMiscounted, sources), /network-keyed block-time maps/);
});
