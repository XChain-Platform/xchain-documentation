/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const CONSTANTS = require('../protocol/constants.js');
const FLAG_DAYS = fs.readFileSync(path.resolve(__dirname, '../protocol/flag-days.md'), 'utf8');
const UNARMED = 9999999999;

function assertCanonicalMap(map) {
    assert.deepStrictEqual(map, {
        mainnet: UNARMED,
        testnet: UNARMED,
        regtest: 0,
    });
}

test('the cancellation parent-floor gate is the canonical unarmed block-time map', () => {
    assertCanonicalMap(CONSTANTS.DISPENSER_CANCEL_GRACE_PARENT_FLOOR_ACTIVATION);
});

test('the map guard rejects an armed production or test network', () => {
    for (const network of ['mainnet', 'testnet']) {
        assert.throws(() => assertCanonicalMap({
            ...CONSTANTS.DISPENSER_CANCEL_GRACE_PARENT_FLOOR_ACTIVATION,
            [network]: 0,
        }));
    }
});

test('the canonical activation-map index publishes the cancellation parent-floor gate', () => {
    assert.match(FLAG_DAYS, /^- `DISPENSER_CANCEL_GRACE_PARENT_FLOOR_ACTIVATION`$/m);
});
