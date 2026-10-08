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
 * Encoder operational-reason registry coverage gate.
 *
 * protocol/error-codes.md promises every `-32010` `error.data.reason` is a
 * stable, append-only string with a registry row, and wallets branch on it.
 * This test re-reads every reason the encoder source raises and fails naming
 * any reason with no row, so a new reason cannot ship unregistered.
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT          = path.resolve(__dirname, '..');
const ENCODER_SRC   = path.resolve(ROOT, '../xchain-encoder/src');
const REGISTRY_PAGE = path.join(ROOT, 'protocol/error-codes.md');

// Emit shapes: an OperationalError constructor, an xchainCode or verdict code
// assignment, and a `reason:` line in a hand-built JSON-RPC error.
const CODE = "'([A-Z][A-Z0-9_]{2,})'";
const EMIT_SHAPES = [
    new RegExp('OperationalError\\(\\s*' + CODE, 'g'),
    new RegExp('xchainCode\\s*=\\s*' + CODE, 'g'),
    new RegExp('\\.code\\s*=\\s*' + CODE, 'g'),
    new RegExp('reason:[^\\n]*?' + CODE + '(?:[^\\n]*?' + CODE + ')?', 'g'),
];

// Reasons that never reach a JSON-RPC caller, each with why it needs no row.
const NO_ROW_NEEDED = {
    // The encoder constructor raises it at startup, before the API listens.
    UTXO_TRACKER_NOT_CONFIGURED: 'startup configuration check',
};

const noEncoder = sibling('xchain-encoder').skip;

// Every .js file under a directory, sorted for a stable report.
function jsFilesUnder(dir) {
    const out = [];
    for (const name of fs.readdirSync(dir).sort()) {
        const abs = path.join(dir, name);
        if (fs.statSync(abs).isDirectory()) out.push(...jsFilesUnder(abs));
        else if (name.endsWith('.js')) out.push(abs);
    }
    return out;
}

// Map each raised reason to the first file that raises it.
function raisedReasons() {
    assert.ok(fs.existsSync(ENCODER_SRC), 'xchain-encoder has no src/ directory; repoint ENCODER_SRC');
    const found = new Map();
    for (const file of jsFilesUnder(ENCODER_SRC)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const shape of EMIT_SHAPES) {
            for (const m of text.matchAll(shape)) {
                for (const reason of m.slice(1).filter(Boolean)) {
                    if (!found.has(reason)) found.set(reason, path.relative(ENCODER_SRC, file));
                }
            }
        }
    }
    return found;
}

test('every encoder operational reason has a registry row', { skip: noEncoder }, () => {
    const registry = fs.readFileSync(REGISTRY_PAGE, 'utf8');
    const raised   = raisedReasons();
    assert.ok(raised.size >= 15,
        `collected only ${raised.size} reasons from the encoder source; the emit shape changed`);
    const missing = [...raised]
        .filter(([reason]) => !(reason in NO_ROW_NEEDED) && !registry.includes('| `' + reason + '` |'))
        .map(([reason, where]) => `${reason} (raised in ${where})`);
    assert.deepEqual(missing, [],
        'protocol/error-codes.md is the append-only reason registry, so every reason '
        + 'the encoder raises needs a row there. Missing:\n  ' + missing.join('\n  '));
});
