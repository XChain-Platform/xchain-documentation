/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/protocol-activation.md'), 'utf8');
const MARKERS = [
    'LINT_OPTIONAL_CHAIN_ACTIVATION',
    'isLintOptionalChainActive',
    'vm_lint_optional_chain_activation.VM_LINT_OPTIONAL_CHAIN_ACTIVATION',
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
