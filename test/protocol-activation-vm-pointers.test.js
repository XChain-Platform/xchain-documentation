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
 **********************************************************************
 *
 * Drift lint for the file pointers protocol-activation.md gives for VM gates.
 *
 * The page tells an auditor which xchain-vm file defines each gate constant
 * and each constant-less rider predicate. A path-existence check cannot catch
 * a pointer that names a file which still exists but no longer defines the
 * symbol, so this test reads every symbol-to-file pointer the page makes and
 * asserts the named file declares that symbol. Skips when the xchain-vm
 * sibling is absent, like the other sibling-reading doc tests.
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/protocol-activation.md'), 'utf8');
const vm = sibling('xchain-vm', ['src/index.js', 'src/index/runtime']);
const VM_SRC = path.join(vm.root, 'src');

// Pointers the page must keep making, so an extractor that stops reading the page
// fails here rather than grading an empty set.
const REQUIRED_SYMBOLS = [
    'BINARY_ALLOC_GATE_BLOCK_TIME', 'ITER_SET_METER_ACTIVATION', 'isConsensusWallClockActive',
    'isSlashTokenDelimGuardActive', 'isSlashAmountPrecisionActive', 'mathOutputMeterOn',
    'emissionDeepStrip', 'nonFiniteFailClosed', 'PKG3_SANDBOX_ACTIVATION',
    'EXEC_LINT_ACTIVATION', 'LINT_GLOBAL_ALIAS_ACTIVATION',
];

function addPair(pairs, symbol, file){
    pairs.push({ symbol, file: file.replace(/^xchain-vm\/src\//, '') });
}

// Every "symbol lives in file" claim the page makes about xchain-vm.
function vmPointers(page){
    const pairs = [];
    const SYM = '([A-Za-z_][A-Za-z0-9_]*)';
    const VMFILE = '(xchain-vm/src/[^`]+\\.js)';
    for (const m of page.matchAll(new RegExp('`' + VMFILE + '` \\(`' + SYM + '`', 'g'))) addPair(pairs, m[2], m[1]);
    for (const m of page.matchAll(new RegExp('`' + SYM + '` in `' + VMFILE + '`', 'g'))) addPair(pairs, m[1], m[2]);
    for (const m of page.matchAll(new RegExp('`' + SYM + '` \\(`' + VMFILE + '`', 'g'))) addPair(pairs, m[1], m[2]);
    for (const m of page.matchAll(new RegExp('`' + SYM + '` is\\s+defined in `' + VMFILE + '`', 'g'))) addPair(pairs, m[1], m[2]);

    // The xchain-vm row of the service table names files relative to xchain-vm/src.
    const vmRow = page.split('\n').find((line) => line.startsWith('| `xchain-vm` |'));
    assert.ok(vmRow, 'service table is missing its xchain-vm row');
    for (const m of vmRow.matchAll(new RegExp('`' + SYM + '` in `([A-Za-z0-9_/.-]+\\.js)`', 'g'))) addPair(pairs, m[1], m[2]);

    // The constant-less rider table: the symbol is in column one, the file in column two.
    const riders = page.match(/^\| Rider \| Resolved in \|[^\n]*\n\|[-|]+\|\n((?:\|[^\n]*\n)+)/m);
    assert.ok(riders, 'page is missing the constant-less rider table');
    for (const row of riders[1].trim().split('\n')){
        const cells = row.split(' | ');
        const sym = cells[0].match(/\(`([A-Za-z_]\w*)`\)|the `([A-Za-z_]\w*)` predicate/);
        const file = cells[1].match(new RegExp('^`' + VMFILE + '`$'));
        assert.ok(sym && file, 'rider row does not name a symbol and an xchain-vm file: ' + row.slice(0, 80));
        addPair(pairs, sym[1] || sym[2], file[1]);
    }
    return pairs;
}

function declares(source, symbol){
    return new RegExp('\\b(?:const|let|var|function\\*?|class|static)\\s+' + symbol + '\\b').test(source);
}

test('every xchain-vm file the activation page names declares the symbol it is named for', { skip: vm.skip }, () => {
    const pairs = vmPointers(PAGE);
    const named = new Set(pairs.map((p) => p.symbol));
    for (const symbol of REQUIRED_SYMBOLS) assert.ok(named.has(symbol), 'page no longer points ' + symbol + ' at a file');
    const wrong = [];
    for (const { symbol, file } of pairs){
        const abs = path.join(VM_SRC, file);
        if (!fs.existsSync(abs)) { wrong.push(symbol + ' -> ' + file + ' (no such file)'); continue; }
        if (!declares(fs.readFileSync(abs, 'utf8'), symbol)) wrong.push(symbol + ' -> ' + file + ' (not declared there)');
    }
    assert.deepEqual(wrong, []);
});
