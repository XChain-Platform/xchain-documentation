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
 * Pin the anchor fold's two registry rows as one SHARED-block unit. The
 * pair check rejects a partial copy immediately, while the guarded cases
 * become strict value, arming and activity pins once both rows arrive.
 *
 * Run: node --test test/reference-impl-anchor-fold-rows.test.js   (Node 22)
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const registry = require('../protocol/reference-impl/consensus/gate_registry.js');

const ENV = 'XC_ANCHOR_FOLD_REGTEST_ACTIVATION';
const KEYS = [
    'anchor_fold_activation.ANCHOR_FOLD_ACTIVATION',
    'archive_section_verdict_activation.ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION',
];
const present = KEYS.filter((key) => registry.has(key));

function withEnv(value, fn) {
    const had = Object.prototype.hasOwnProperty.call(process.env, ENV);
    const saved = process.env[ENV];
    try {
        if (value === undefined) delete process.env[ENV];
        else process.env[ENV] = value;
        return fn();
    } finally {
        if (had) process.env[ENV] = saved;
        else delete process.env[ENV];
    }
}

describe('reference registry anchor fold rows', () => {
    test('carries both anchor fold rows or neither row', () => {
        assert.ok(
            present.length === 0 || present.length === 2,
            `expected zero or two anchor fold rows, found ${present.length}: ${present.join(', ')}`,
        );
    });

    test('keeps both activation maps inert by default', (t) => {
        // Wait for this repo's SHARED-block twin to carry the pair.
        if (present.length !== 2) {
            t.skip('the anchor fold registry rows are not present yet');
            return;
        }
        withEnv(undefined, () => {
            for (const key of KEYS) {
                assert.deepEqual(registry.get(key), {
                    mainnet: 9999999999,
                    testnet: 9999999999,
                    regtest: null,
                });
            }
        });
    });

    test('arms both regtest entries from the shared venue variable', (t) => {
        // Wait for this repo's SHARED-block twin to carry the pair.
        if (present.length !== 2) {
            t.skip('the anchor fold registry rows are not present yet');
            return;
        }
        withEnv('armed', () => {
            for (const key of KEYS) assert.equal(registry.get(key).regtest, 0);
        });
    });

    test('stays inactive below the sentinel on public networks', (t) => {
        // Wait for this repo's SHARED-block twin to carry the pair.
        if (present.length !== 2) {
            t.skip('the anchor fold registry rows are not present yet');
            return;
        }
        withEnv(undefined, () => {
            for (const key of KEYS) {
                assert.equal(registry.activeAt(key, 'mainnet', null, 99999999, null), false);
                assert.equal(registry.activeAt(key, 'testnet', null, 99999999, null), false);
            }
        });
    });
});
