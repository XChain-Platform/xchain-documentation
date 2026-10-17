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
 **********************************************************************
 *
 * Testnet arms declared on an addGate time row.
 *
 * collectTestnetArms once read only the addChange/array-row slot and the
 * `_TESTNET_TIME` constants, so a gate whose addGate 'time' row armed testnet at
 * a real instant was published as genesis-active there. These fixtures pin the
 * gate-row pass: a real instant is listed, genesis, the sentinel and null are
 * not, and a height row is never this page's subject.
 *
 * Run: node --test test/flag-days-gate-row-testnet-arms.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gen = require('../bin/generate-flag-days.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const noIndexer = sibling('xchain-indexer', [gen.REGISTRY]).skip;

// Writes a one-file registry plus the core.js that declares UNARMED.
function fixtureRegistry(body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagday-gate-row-arms-'));
    fs.writeFileSync(path.join(dir, 'protocol_changes.js'), body);
    fs.mkdirSync(path.join(dir, 'protocol_changes'));
    fs.writeFileSync(path.join(dir, 'protocol_changes', 'core.js'), 'const UNARMED = 9999999999;\n');
    return dir;
}

test('a multi-line addGate time row with a real testnet instant is a testnet arm', () => {
    const dir = fixtureRegistry(
        "addGate('x_activation.X_ACTIVATION', 'time', {\n"
        + '    mainnet: UNARMED,\n'
        + '    testnet: 1791804379,\n'
        + '    regtest: 0,\n'
        + '});\n',
    );
    assert.deepStrictEqual(gen.collectTestnetArms(dir).map((g) => [g.gate, g.time]), [['X_ACTIVATION', 1791804379]]);
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir), []);
});

test('the bare testnet slot is read on a single-line row that also keys testnet per coin', () => {
    const dir = fixtureRegistry(
        "addGate('y_activation.Y_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': 1790000000, "
        + "testnet: 1791804379, 'DOGE:testnet': 1790000000, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectTestnetArms(dir).map((g) => [g.gate, g.time]), [['Y_ACTIVATION', 1791804379]]);
});

test('a time row whose testnet slot is genesis, the sentinel or null is not a testnet arm', () => {
    const dir = fixtureRegistry(
        "addGate('a_activation.A_ACTIVATION', 'time', { mainnet: 1786060800, testnet: 0, regtest: 0 });\n"
        + "addGate('b_activation.B_ACTIVATION', 'time', { mainnet: UNARMED, testnet: UNARMED, regtest: 0 });\n"
        + "addGate('c_activation.C_ACTIVATION', 'time', { mainnet: null, testnet: null, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectTestnetArms(dir), []);
});

test('a height row is never a testnet arm, whatever its testnet slot holds', () => {
    const dir = fixtureRegistry(
        "addGate('h_activation.H_ACTIVATION', 'height', { mainnet: UNARMED, testnet: 1791804379, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectTestnetArms(dir), []);
});

test('against the real indexer the three addGate testnet arms are listed', { skip: noIndexer }, () => {
    const arms = new Set(gen.collectTestnetArms().map((g) => g.gate));
    for (const gate of [
        'PRICE_ZERO_VALIDITY_ACTIVATION',
        'SEND_GATED_TOTAL_TICK_ID_ACTIVATION',
        'ATTEST_RELAY_RESPONSE_DEADLINE_ACTIVATION',
    ]) {
        assert.ok(arms.has(gate), `${gate} arms testnet on its addGate row but is missing from collectTestnetArms()`);
    }
});
