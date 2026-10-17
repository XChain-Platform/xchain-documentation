/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const CONSTANTS = require('../protocol/constants.js');
const { assertMainnetUnarmedTestnetArmable } = require('./helpers/block_time_gate_map.js');
const FLAG_DAYS = fs.readFileSync(path.resolve(__dirname, '../protocol/flag-days.md'), 'utf8');

function assertCanonicalMap(map) {
    assertMainnetUnarmedTestnetArmable(map);
}

test('the purge grace gate is the canonical testnet-armable block-time map', () => {
    assertCanonicalMap(CONSTANTS.DISPENSER_PURGE_GRACE_ACTIVATION);
});

test('the map guard permits only a testnet block-time activation', () => {
    const map = CONSTANTS.DISPENSER_PURGE_GRACE_ACTIVATION;
    assert.throws(() => assertCanonicalMap({ ...map, mainnet: 1700000000 }));
    assert.throws(() => assertCanonicalMap({ ...map, regtest: 1 }));
    assert.throws(() => assertCanonicalMap({ ...map, testnet: 800000 }));
    assert.doesNotThrow(() => assertCanonicalMap({ ...map, testnet: 1700000000 }));
});

test('the canonical activation-map index publishes the purge grace gate', () => {
    assert.match(FLAG_DAYS, /^- `DISPENSER_PURGE_GRACE_ACTIVATION`$/m);
});
