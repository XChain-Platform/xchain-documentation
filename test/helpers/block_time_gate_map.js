/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');

const UNARMED = 9999999999;
const MINIMUM_BLOCK_TIME = 1000000000;

function assertMainnetUnarmedTestnetArmable(map) {
    assert.deepStrictEqual(Object.keys(map).sort(), ['mainnet', 'regtest', 'testnet']);
    assert.strictEqual(map.mainnet, UNARMED);
    assert.strictEqual(map.regtest, 0);
    assert.ok(map.testnet === UNARMED || (
        Number.isFinite(map.testnet)
        && Number.isInteger(map.testnet)
        && map.testnet >= MINIMUM_BLOCK_TIME
        && map.testnet < UNARMED
    ));
}

module.exports = { assertMainnetUnarmedTestnetArmable };
