/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC - https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 *********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const gen = require('../../bin/generate-flag-days.js');
const { sibling } = require('../helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..', '..');
const indexer = sibling('xchain-indexer', ['src/protocol_changes/changes_5.js']);
const BLANKET_CLAIM = /(?:Testnet and regtest are genesis-active|Regtest runs every cohort \*\*genesis-active)/;

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('generated flag-day guidance treats regtest activation as gate-specific', { skip: indexer.skip }, () => {
    const generated = gen.generate();
    assert.doesNotMatch(generated, BLANKET_CLAIM);
    assert.match(generated, /\*\*Regtest activation is defined per gate\.\*\*/);
    assert.match(generated, /A regtest slot can be genesis-active,\nUNARMED, or armed by an environment override/);
});

test('protocol activation guidance does not make a blanket regtest claim', () => {
    const page = read('protocol/protocol-activation.md');
    assert.doesNotMatch(page, BLANKET_CLAIM);
    assert.match(page, /Regtest runs every cohort according to its per-gate activation threshold/);
    assert.match(page, /some time-keyed rows are UNARMED or require a regtest environment override/);
});

test('negative control catches the former regtest claims', () => {
    assert.match('Testnet and regtest are genesis-active', BLANKET_CLAIM);
    assert.match('Regtest runs every cohort **genesis-active**', BLANKET_CLAIM);
});

test('the current registry contains the regtest exceptions behind the guidance', { skip: indexer.skip }, () => {
    const source = fs.readFileSync(path.join(indexer.root, 'src/protocol_changes/changes_5.js'), 'utf8');
    for (const gate of [
        'EMISSION_DEPTH_EXECUTE_ONLY',
        'ARCHIVE_REPLAY_WRAPPER_WATERMARK',
        'LEGACY_ANCHOR_REWARD_PIN',
        'STAKE_SNAPSHOT_SLASH_WINDOW',
        'DELEGATION_ROTATE_IN_WINDOW',
        'GUARD_STAKE_SNAPSHOT_DECIMAL_STRINGS',
    ]) {
        const start = source.indexOf(`'${gate}'`);
        assert.ok(start >= 0, `${gate} registry row is missing`);
        const row = source.slice(start, source.indexOf('],', start) + 2);
        assert.match(row, /UNARMED/, `${gate} no longer demonstrates a non-genesis regtest default`);
    }
});
