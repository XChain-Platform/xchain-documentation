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
 * A time constant initialised with the house UNARMED sentinel.
 *
 * The registry parks a gate with `const NAME_MAINNET_TIME = UNARMED;`. The
 * generator resolves that one identifier to the value core.js declares and
 * still refuses every other identifier. The synthetic cases run in a
 * standalone clone; the last case reads the real sibling indexer and fails
 * rather than skips under XCHAIN_REQUIRE_SIBLINGS=1.
 *
 * Run: node --test test/flag-days-unarmed-initializer.test.js   (Node 22)
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

function fixtureRegistry(body, core = 'const UNARMED = 9999999999;\n') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagday-unarmed-'));
    fs.writeFileSync(path.join(dir, 'protocol_changes.js'), body);
    if (core !== null) {
        fs.mkdirSync(path.join(dir, 'protocol_changes'));
        fs.writeFileSync(path.join(dir, 'protocol_changes', 'core.js'), core);
    }
    return dir;
}

test('a _MAINNET_TIME = UNARMED declaration reads as the sentinel and is listed unarmed', () => {
    const dir = fixtureRegistry('const FOO_MAINNET_TIME = UNARMED;\n');
    assert.deepStrictEqual(gen.collectGates(dir), []);
    assert.deepStrictEqual(gen.collectMainnetUnarmed(dir).map((g) => [g.gate, g.time]), [['FOO', 9999999999]]);
});

test('a _TESTNET_TIME = UNARMED declaration reads as the sentinel on every arm', () => {
    const dir = fixtureRegistry('const FOO_TESTNET_TIME = UNARMED;\n');
    assert.deepStrictEqual(gen.collectTestnetArms(dir), []);
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir).map((g) => [g.gate, g.time]), [['FOO', 9999999999]]);
});

test('any other identifier initializer is still refused', () => {
    const dir = fixtureRegistry('const FOO_MAINNET_TIME = SOME_OTHER_NAME;\n');
    assert.throws(() => gen.collectGates(dir), /FOO_MAINNET_TIME/);
});

test('UNARMED with no declaration in core.js is refused', () => {
    const dir = fixtureRegistry('const FOO_MAINNET_TIME = UNARMED;\n', null);
    assert.throws(() => gen.collectGates(dir), /FOO_MAINNET_TIME.*UNARMED/s);
});

test('UNARMED declared as a non-literal in core.js is refused', () => {
    const dir = fixtureRegistry('const FOO_MAINNET_TIME = UNARMED;\n', 'const UNARMED = 10 ** 10 - 1;\n');
    assert.throws(() => gen.collectGates(dir), /FOO_MAINNET_TIME.*UNARMED/s);
});

test('against the real indexer BROADCAST_FEE_LENGTH is unarmed on mainnet', { skip: noIndexer }, () => {
    assert.ok(gen.collectMainnetUnarmed().some((g) => g.gate === 'BROADCAST_FEE_LENGTH'));
});

test('against the real indexer ITER_SET_METER is unarmed on production networks', { skip: noIndexer }, () => {
    assert.ok(gen.collectMainnetUnarmed().some((g) => g.gate === 'ITER_SET_METER'));
    assert.ok(gen.collectTestnetUnarmed().some((g) => g.gate === 'ITER_SET_METER'));
});

test('a part-file row with bare UNARMED slots is listed unarmed on both networks', () => {
    const dir = fixtureRegistry("const ROWS = [['FOO', '1.0.0', UNARMED, UNARMED, 0, 0, 0, 0]];\n");
    assert.deepStrictEqual(gen.collectGates(dir), []);
    assert.deepStrictEqual(gen.collectMainnetUnarmed(dir).map((g) => [g.gate, g.time]), [['FOO', 9999999999]]);
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir).map((g) => [g.gate, g.time]), [['FOO', 9999999999]]);
    assert.deepStrictEqual(gen.collectTestnetArms(dir), []);
});

test('an addChange call with a bare UNARMED mainnet slot is listed unarmed on mainnet only', () => {
    const dir = fixtureRegistry("this.addChange('FOO', '1.0.0', UNARMED, 0, 0, 0, 0, 0);\n");
    assert.deepStrictEqual(gen.collectMainnetUnarmed(dir).map((g) => g.gate), ['FOO']);
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir), []);
    assert.deepStrictEqual(gen.collectTestnetArms(dir), []);
});

test('an addGate time row parked on UNARMED is listed unarmed on both networks', () => {
    const dir = fixtureRegistry(
        "addGate('foo_activation.FOO_ACTIVATION', 'time', { mainnet: UNARMED, testnet: UNARMED, "
        + "'BTC:testnet': UNARMED, 'LTC:testnet': UNARMED, 'DOGE:testnet': UNARMED, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir), []);
    assert.deepStrictEqual(gen.collectMainnetUnarmed(dir).map((g) => g.gate), ['FOO_ACTIVATION']);
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir).map((g) => g.gate), ['FOO_ACTIVATION']);
});

test('an addGate time row with a genesis testnet slot or a height unit is listed unarmed on mainnet only', () => {
    const dir = fixtureRegistry(
        "addGate('foo_activation.FOO_ACTIVATION', 'time', { mainnet: UNARMED, testnet: 0, regtest: 0 });\n"
        + "addGate('bar_activation.BAR_ACTIVATION', 'height', { mainnet: UNARMED, testnet: UNARMED, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir), []);
    assert.deepStrictEqual(gen.collectMainnetUnarmed(dir).map((g) => g.gate), ['FOO_ACTIVATION']);
    assert.deepStrictEqual(gen.collectTestnetUnarmed(dir), []);
});

test('a bare UNARMED slot with no declaration in core.js is refused', () => {
    const dir = fixtureRegistry("this.addChange('FOO', '1.0.0', UNARMED, 0, 0, 0, 0, 0);\n", null);
    assert.throws(() => gen.collectMainnetUnarmed(dir), /FOO.*UNARMED/s);
});

test('against the real indexer every bare-UNARMED registry row is unarmed on both networks', { skip: noIndexer }, () => {
    const gates = ['SLASH_XANCPUB_PUBLISHER_PAIR', 'STAKE_SNAPSHOT_SLASH_WINDOW', 'SLASH_ATTEST_MULTIROUND_EXEMPT'];
    const mainnet = gen.collectMainnetUnarmed().map((g) => g.gate);
    const testnet = gen.collectTestnetUnarmed().map((g) => g.gate);
    for (const gate of gates) {
        assert.ok(mainnet.includes(gate), `${gate} missing from the mainnet unarmed list`);
        assert.ok(testnet.includes(gate), `${gate} missing from the testnet unarmed list`);
    }
});
