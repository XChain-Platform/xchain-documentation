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
 ********************************************************************/

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const registry = require('../protocol/reference-impl/consensus/gate_registry.js');

const ENV_NAME = 'XC_ANCHOR_FOLD_REGTEST_ACTIVATION';
const KEYS = [
    'anchor_fold_activation.ANCHOR_FOLD_ACTIVATION',
    'archive_section_verdict_activation.ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION',
];

test('anchor fold rows use public sentinels and follow regtest arming', () => {
    const had = Object.prototype.hasOwnProperty.call(process.env, ENV_NAME);
    const saved = process.env[ENV_NAME];
    try {
        delete process.env[ENV_NAME];
        for (const key of KEYS) {
            assert.deepEqual(registry.get(key), { mainnet: 9999999999, testnet: 9999999999, regtest: null });
        }
        process.env[ENV_NAME] = 'armed';
        for (const key of KEYS) {
            assert.deepEqual(registry.get(key), { mainnet: 9999999999, testnet: 9999999999, regtest: 0 });
        }
    } finally {
        if (had) process.env[ENV_NAME] = saved;
        else delete process.env[ENV_NAME];
    }
});
