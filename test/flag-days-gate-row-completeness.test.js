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
 * The addGate completeness guard.
 *
 * GATE_ROW is the only way the generator finds an addGate row, so a time row in
 * a shape it does not read must be refused rather than dropped from the table,
 * the UNARMED lists, the testnet arms and the anchor count. These fixtures pin
 * the canonical shape as collected, each unread time shape as refused on every
 * collector, and the registry's plumbing and non-time rows as quiet.
 *
 * Run: node --test test/flag-days-gate-row-completeness.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gen = require('../bin/generate-flag-days.js');

// Writes a one-file registry plus the core.js that declares UNARMED.
function fixtureRegistry(body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagday-gate-row-complete-'));
    fs.writeFileSync(path.join(dir, 'protocol_changes.js'), body);
    fs.mkdirSync(path.join(dir, 'protocol_changes'));
    fs.writeFileSync(path.join(dir, 'protocol_changes', 'core.js'), 'const UNARMED = 9999999999;\n');
    return dir;
}

const COLLECTORS = ['collectGates', 'collectTestnetArms', 'collectTestnetUnarmed', 'collectMainnetUnarmed'];

// Asserts every collector refuses the fixture and names the offending gate.
function assertRefusedEverywhere(body, name) {
    const dir = fixtureRegistry(body);
    for (const fn of COLLECTORS) {
        assert.throws(() => gen[fn](dir), new RegExp(`cannot read[\\s\\S]*${name}`), `${fn} did not refuse ${name}`);
    }
}

test('a canonical addGate time row is collected', () => {
    const dir = fixtureRegistry(
        "addGate('foo_activation.FOO_ACTIVATION', 'time', { mainnet: 1786060800, testnet: 0, regtest: 0 });\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => [g.gate, g.time]), [['FOO_ACTIVATION', 1786060800]]);
});

test('an addGate mainnet slot reads separators the way an addChange time slot does', () => {
    // The map-slot reader once stripped `_` before testing for digits, so a
    // leading-underscore NAME read as a number and a malformed literal read fine.
    const ok = fixtureRegistry(
        "addGate('foo_activation.SEP_ACTIVATION', 'time', { mainnet: 1_786_060_800, testnet: 0 });\n"
        + "addGate('foo_activation.NAMED_ACTIVATION', 'time', { mainnet: _1786060800, testnet: 0 });\n"
        + "this.addChange('CALL_NAMED', '1.0.0', _1786060800, 0, 0, 0, 0, 0);\n",
    );
    assert.deepStrictEqual(gen.collectGates(ok).map((g) => [g.gate, g.time]), [['SEP_ACTIVATION', 1786060800]]);
    for (const bad of ['1786060800_', '1__786060800']) {
        const dir = fixtureRegistry(`addGate('foo_activation.BAD_ACTIVATION', 'time', { mainnet: ${bad} });\n`);
        assert.throws(() => gen.collectGates(dir), /BAD_ACTIVATION/, `${bad} was read as a number`);
    }
});

test('a double-quoted key on a time row is refused, not skipped', () => {
    assertRefusedEverywhere("addGate(\"foo_activation.FOO_ACTIVATION\", 'time', { mainnet: 1786060800 });\n", 'FOO_ACTIVATION');
});

test('a double-quoted time unit is refused, not skipped', () => {
    assertRefusedEverywhere("addGate('foo_activation.QUX_ACTIVATION', \"time\", { mainnet: UNARMED });\n", 'QUX_ACTIVATION');
});

test('a time row whose table is bound to a const first is refused', () => {
    assertRefusedEverywhere(
        "const T = { mainnet: 1786060800 };\naddGate('foo_activation.BAR_ACTIVATION', 'time', T);\n",
        'BAR_ACTIVATION',
    );
});

test('a const unit with an inline time or UNARMED table is refused', () => {
    assertRefusedEverywhere(
        "const U = 'time';\naddGate('foo_activation.BAZ_ACTIVATION', U, { mainnet: 1786060800 });\n",
        'BAZ_ACTIVATION',
    );
    assertRefusedEverywhere(
        "const U = 'time';\naddGate('foo_activation.ZAP_ACTIVATION', U, { mainnet: UNARMED });\n",
        'ZAP_ACTIVATION',
    );
});

test('non-time rows in any shape and the registry plumbing stay quiet', () => {
    const dir = fixtureRegistry(
        "addGate(\"x.H\", 'height', { mainnet: 840000 });\n"
        + "addGate('protocol/constants.MAX_CODE_SIZE', 'constant', 65536);\n"
        + "addGate('mirror_admission_activation.CHAIN_CODE_RE', 'constant', /^[A-Z0-9]{1,10}$/);\n"
        + "addGate('stateHash.SLASH_SPECS', 'constant', [{ table: 'stakes', debits: 'a,b' }]);\n"
        + 'function addGate(key, unit, table) { q.push([key, unit, table]); }\n'
        + 'registry.addGate(key, unit, table);\n'
        + "const U = 'height';\naddGate('foo_activation.LOW_ACTIVATION', U, { mainnet: 840000 });\n",
    );
    for (const fn of COLLECTORS) assert.doesNotThrow(() => gen[fn](dir), `${fn} refused a quiet shape`);
});
