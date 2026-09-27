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
