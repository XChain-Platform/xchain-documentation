// SPDX-License-Identifier: AGPL-3.0-or-later

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gen = require('../bin/generate-flag-days.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const noIndexer = sibling('xchain-indexer', [gen.REGISTRY]).skip;

function fixtureRegistry(body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagday-mainnet-coins-'));
    fs.writeFileSync(path.join(dir, 'protocol_changes.js'), body);
    fs.mkdirSync(path.join(dir, 'protocol_changes'));
    fs.writeFileSync(path.join(dir, 'protocol_changes', 'core.js'), 'const UNARMED = 9999999999;\n');
    return dir;
}

test('mainnet coin overrides to genesis suppress a scheduled bare slot', () => {
    const dir = fixtureRegistry(
        "addGate('o_activation.OVERRIDDEN_ACTIVATION', 'time', { mainnet: 1786060800, "
        + "'BTC:mainnet': 0, 'LTC:mainnet': 0, 'DOGE:mainnet': 0, testnet: 0, regtest: 0 });\n"
        + "addGate('l_activation.LIVE_ACTIVATION', 'time', { mainnet: 1786060800, testnet: 0, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => [g.gate, g.time]), [
        ['LIVE_ACTIVATION', 1786060800],
    ]);
});

test('uniform mainnet coin overrides publish their resolved instant and source', () => {
    const dir = fixtureRegistry(
        "addGate('u_activation.UNIFORM_ACTIVATION', 'time', { mainnet: UNARMED, "
        + "'BTC:mainnet': 1786060800, 'LTC:mainnet': 1786060800, "
        + "'DOGE:mainnet': 1786060800, testnet: 0, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir), [{
        gate: 'UNIFORM_ACTIVATION',
        time: 1786060800,
        source: 'protocol_changes.js',
    }]);
});

test('split mainnet resolution is refused instead of publishing one coin value', () => {
    const dir = fixtureRegistry(
        "addGate('s_activation.SPLIT_ACTIVATION', 'time', { mainnet: 1786060800, "
        + "'BTC:mainnet': 0, testnet: 0, regtest: 0 });\n",
    );
    assert.throws(() => gen.collectGates(dir), /SPLIT_ACTIVATION resolves mainnet to different values per coin/);
});

test('real mainnet time rows match the indexer per-coin resolution', { skip: noIndexer }, () => {
    const registry = require(gen.REGISTRY);
    const dir = path.join(gen.INDEXER_SRC, 'protocol_changes');
    const keys = [];
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.js'))) {
        const text = fs.readFileSync(path.join(dir, file), 'utf8');
        for (const match of text.matchAll(/addGate\(\s*'([A-Za-z0-9_/]+\.[A-Z][A-Z0-9_]*)'\s*,\s*'time'/g)) {
            keys.push(match[1]);
        }
    }
    assert.ok(keys.length >= 10, 'the registry scan found too few time rows to exercise the oracle');
    const gates = new Map(gen.collectGates().map((gate) => [gate.gate, gate]));
    let compared = 0;
    for (const key of keys) {
        const table = registry.get(key);
        const gate = key.split('.')[1];
        const values = gen.COINS.map((coin) => Object.hasOwn(table, coin + ':mainnet')
            ? table[coin + ':mainnet'] : table.mainnet);
        assert.strictEqual(new Set(values).size, 1, `${gate} resolves mainnet differently per coin`);
        const value = values[0];
        if (typeof value === 'number' && value >= gen.TIMESTAMP_FLOOR && value < gen.SENTINEL_FLOOR) {
            compared += 1;
            assert.strictEqual(gates.get(gate)?.time, value, `${gate} should publish mainnet time ${value}`);
        }
    }
    assert.ok(compared > 0, 'no real mainnet time row exercised the oracle');
});
