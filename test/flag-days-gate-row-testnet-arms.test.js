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
        "addGate('y_activation.Y_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': 1791804379, "
        + "testnet: 1791804379, 'DOGE:testnet': 1791804379, regtest: 0 });\n",
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

test('per-coin testnet instants beside a bare UNARMED slot are a testnet arm, not an unarmed gate', () => {
    const dir = fixtureRegistry(
        "addGate('z_activation.Z_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': 1791061097, "
        + "'LTC:testnet': 1791061097, 'DOGE:testnet': 1791061097, testnet: UNARMED, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectTestnetArms(dir).map((g) => [g.gate, g.time]), [['Z_ACTIVATION', 1791061097]]);
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir), []);
});

test('a bare UNARMED slot still reads as unarmed when no coin keys testnet', () => {
    const dir = fixtureRegistry(
        "addGate('u_activation.U_ACTIVATION', 'time', { mainnet: UNARMED, testnet: UNARMED, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir).map((g) => g.gate), ['U_ACTIVATION']);
    assert.deepStrictEqual(gen.collectTestnetArms(dir), []);
});

test('coins that resolve testnet to different instants are refused, naming the gate', () => {
    const dir = fixtureRegistry(
        "addGate('s_activation.S_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': 1790000000, "
        + "'LTC:testnet': 1791061097, 'DOGE:testnet': 1791061097, testnet: UNARMED, regtest: 0 });\n",
    );
    assert.throws(() => gen.collectTestnetArms(dir), /S_ACTIVATION resolves testnet to different values per coin/);
    assert.throws(() => gen.collectTestnetUnarmed(dir), /S_ACTIVATION/);
});

test('a partial per-coin override that falls through to a different bare value is refused', () => {
    const dir = fixtureRegistry(
        "addGate('p_activation.P_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': 1791061097, "
        + 'testnet: UNARMED, regtest: 0 });\n',
    );
    assert.throws(() => gen.collectTestnetArms(dir), /P_ACTIVATION resolves testnet to different values per coin/);
});

test('a coin slot this scan cannot read is refused instead of passing quietly', () => {
    const dir = fixtureRegistry(
        "addGate('q_activation.Q_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': SOME_NAME, "
        + "'LTC:testnet': 1791061097, 'DOGE:testnet': 1791061097, testnet: 1791061097, regtest: 0 });\n",
    );
    assert.throws(() => gen.collectTestnetArms(dir), /Q_ACTIVATION keys BTC:testnet with `SOME_NAME`/);
});

test('three unreadable coin slots beside a bare UNARMED do not drop the gate from both lists', () => {
    const dir = fixtureRegistry(
        "addGate('w_activation.W_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': SOME_NAME, "
        + "'LTC:testnet': SOME_NAME, 'DOGE:testnet': SOME_NAME, testnet: UNARMED, regtest: 0 });\n",
    );
    assert.throws(() => gen.collectTestnetArms(dir), /W_ACTIVATION keys BTC:testnet/);
    assert.throws(() => gen.collectTestnetUnarmed(dir), /W_ACTIVATION keys BTC:testnet/);
});

test('coin slots that are explicitly null leave the gate on neither list', () => {
    const dir = fixtureRegistry(
        "addGate('n_activation.N_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': null, "
        + "'LTC:testnet': null, 'DOGE:testnet': null, testnet: UNARMED, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectTestnetArms(dir), []);
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir), []);
});

test('a coin-qualified testnet key for a coin the indexer does not run is refused', () => {
    const dir = fixtureRegistry(
        "addGate('k_activation.K_ACTIVATION', 'time', { mainnet: UNARMED, 'XYZ:testnet': 1791061097, "
        + 'testnet: 1791061097, regtest: 0 });\n',
    );
    assert.throws(() => gen.collectTestnetArms(dir), /K_ACTIVATION keys testnet for the coin XYZ/);
});

test('the mainnet reader ignores a coin key on another network', () => {
    const dir = fixtureRegistry(
        "addGate('m_activation.M_ACTIVATION', 'time', { mainnet: UNARMED, 'BTC:testnet': 1791061097, "
        + "'LTC:testnet': 1791061097, 'DOGE:testnet': 1791061097, testnet: UNARMED, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectMainnetUnarmed(dir).map((g) => g.gate), ['M_ACTIVATION']);
});

test('the coin list matches the indexer config', { skip: noIndexer }, () => {
    const text = fs.readFileSync(path.join(gen.INDEXER_SRC, 'config', 'currencies.js'), 'utf8');
    const match = /config\['COINS'\]\s*=\s*\[([^\]]*)\]/.exec(text);
    assert.ok(match, 'config[\'COINS\'] is no longer a literal list in xchain-indexer/src/config/currencies.js');
    assert.deepStrictEqual(match[1].split(',').map((c) => c.trim().replace(/['"]/g, '')), gen.COINS);
});

test('every real time row resolves per coin the way the indexer does, and the page lists it accordingly', { skip: noIndexer }, () => {
    const registry = require(gen.REGISTRY);
    const dir = path.join(gen.INDEXER_SRC, 'protocol_changes');
    const keys = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
        const text = fs.readFileSync(path.join(dir, file), 'utf8');
        for (const m of text.matchAll(/addGate\(\s*'([A-Za-z0-9_/]+\.[A-Z][A-Z0-9_]*)'\s*,\s*'time'/g)) keys.push(m[1]);
    }
    assert.ok(keys.length >= 10, 'the registry scan found almost no time rows, so the oracle below would compare nothing');
    const arms = new Map(gen.collectTestnetArms().map((g) => [g.gate, g.time]));
    const unarmed = new Set(gen.collectTestnetUnarmed().map((g) => g.gate));
    let armed = 0;
    for (const key of keys) {
        const table = registry.get(key);
        const gate = key.split('.')[1];
        for (const coin of gen.COINS) {
            const own = Object.hasOwn(table, coin + ':testnet') ? table[coin + ':testnet'] : table.testnet;
            if (typeof own !== 'number') continue;
            if (own >= gen.TIMESTAMP_FLOOR && own < gen.SENTINEL_FLOOR) {
                armed += 1;
                assert.strictEqual(arms.get(gate), own, `${gate} resolves ${coin} testnet to ${own} but the page parse says ${arms.get(gate)}`);
            } else if (own >= gen.SENTINEL_FLOOR) {
                assert.ok(unarmed.has(gate), `${gate} resolves ${coin} testnet to the sentinel but is not listed unarmed`);
            }
        }
    }
    assert.ok(armed > 0, 'no real time row armed testnet, so the oracle compared nothing');
});

test('the gates armed per coin beside a bare UNARMED slot are listed as arms, never as unarmed', { skip: noIndexer }, () => {
    const arms = new Set(gen.collectTestnetArms().map((g) => g.gate));
    const unarmed = gen.collectTestnetUnarmed().map((g) => g.gate);
    for (const gate of [
        'AMOUNT_REPRESENTABILITY_ACTIVATION',
        'DISPENSER_FRESHNESS_PROVEN_USE_ACTIVATION',
        'DISPENSER_SETTLEMENT_PRICE_ACTIVATION',
        'LIST_EDIT_REMOVE_ACTIVATION',
        'PRICE_V1_CANONICAL_ACTIVATION',
    ]) {
        assert.ok(arms.has(gate), `${gate} arms testnet per coin but is missing from collectTestnetArms()`);
        assert.ok(!unarmed.includes(gate), `${gate} is listed unarmed on testnet though every coin resolves it to an instant`);
    }
    assert.ok(unarmed.includes('MAINNET_LAUNCH_ACTIVATION'), 'MAINNET_LAUNCH_ACTIVATION is no longer the testnet-unarmed gate');
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
