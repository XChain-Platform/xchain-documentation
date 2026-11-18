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
 * A registry time row whose mainnet slot is `null` is not UNARMED and carries no
 * instant, so neither the table nor the UNARMED list names it. The generated
 * Flag-Day Values page lists such gates in their own sentence, because other pages
 * send readers there for "where the gate stands on mainnet".
 *
 * Run: node --test test/documentation-accuracy/flag-days-mainnet-unpinned-time-gates.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gen = require('../../bin/generate-flag-days.js');

function fixtureRegistry(body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagday-unpinned-'));
    fs.writeFileSync(path.join(dir, 'protocol_changes.js'), body);
    fs.mkdirSync(path.join(dir, 'protocol_changes'));
    fs.writeFileSync(path.join(dir, 'protocol_changes', 'core.js'), 'const UNARMED = 9999999999;\n');
    return dir;
}

const FIXTURE = [
    "addGate('a_activation.NULL_ACTIVATION', 'time', { mainnet: null, testnet: 0, regtest: 0 });",
    "addGate('b_activation.LIVE_ACTIVATION', 'time', { mainnet: 1786060800, testnet: 0, regtest: 0 });",
    "addGate('c_activation.SENTINEL_ACTIVATION', 'time', { mainnet: UNARMED, testnet: 0, regtest: 0 });",
    "addGate('d_height.NULL_HEIGHT', 'height', { mainnet: null, testnet: 0, regtest: 0 });",
    '',
].join('\n');

const PER_COIN = "addGate('e_activation.PER_COIN_ACTIVATION', 'time', { mainnet: null, 'BTC:mainnet': 1786060800 });\n";

test('only a time row with a bare null mainnet slot is collected as unpinned', () => {
    const found = gen.collectMainnetUnpinned(fixtureRegistry(FIXTURE + PER_COIN)).map((g) => g.gate);
    assert.deepStrictEqual(found, ['NULL_ACTIVATION']);
});

test('the unpinned gate stays out of the UNARMED list and the mainnet table', () => {
    const dir = fixtureRegistry(FIXTURE);
    assert.deepStrictEqual(gen.collectMainnetUnarmed(dir).map((g) => g.gate), ['SENTINEL_ACTIVATION']);
    assert.ok(!gen.collectGates(dir).some((g) => g.gate === 'NULL_ACTIVATION'));
});

test('render names the unpinned gates in their own sentence', () => {
    const gates = [{ gate: 'LIVE_ACTIVATION', time: 1786060800, source: 'protocol_changes/x.js' }];
    const page = gen.render(gates, [], [], [], [], [{ gate: 'NULL_ACTIVATION' }]);
    assert.match(page, /\*\*One gate has no mainnet instant\*\* \(`NULL_ACTIVATION`\)/);
    assert.ok(!/UNARMED on mainnet/.test(page), 'the unpinned gate must not read as UNARMED');
    assert.ok(!/no mainnet instant/.test(gen.render(gates)), 'no sentence when nothing is unpinned');
});

test('the generated page names every live registry time gate that parks mainnet on null', (t) => {
    if (!fs.existsSync(gen.REGISTRY)) return t.skip('sibling indexer checkout not present');
    const unpinned = gen.collectMainnetUnpinned();
    assert.ok(unpinned.length > 0, 'the registry has null-mainnet time rows today; an empty set proves nothing');
    const page = fs.readFileSync(gen.OUTPUT, 'utf8');
    for (const { gate } of unpinned) {
        assert.ok(page.includes(`\`${gate}\``), `${gate} is missing from protocol/flag-days.md`);
    }
    assert.strictEqual(page, gen.generate(), 'protocol/flag-days.md is stale: run node bin/generate-flag-days.js');
});
