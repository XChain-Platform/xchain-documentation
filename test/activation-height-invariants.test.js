/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC – https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 ********************************************************************/

/**
 * Hold the shipped activation heights to the invariants protocol/constants.js
 * states for them in prose.
 *
 * The heights are hand-edited at each train cut and re-cut when a chain
 * overruns them, and the cut-time tool checks its rules only on the values it
 * writes. These assertions read the COMMITTED values, so a hand edit that
 * breaks ordering, shape, the train floor or registry-twin parity fails here.
 * The cross-chain same-instant rule needs live chain cadences and stays with
 * the cut-time height tool, which refuses a divergent instant when it writes.
 */
'use strict';

const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const constants = require('../protocol/constants.js');
const gateRegistry = require('../protocol/reference-impl/consensus/gate_registry.js');

// Name the train that arms the mirror-admission family (constants.js TRAIN_ACTIVATION '0.20.0' comment).
const MIRROR_ADMISSION_TRAIN = '0.20.0';
// Name the train that arms the XCHAIN bridge family (constants.js TRAIN_ACTIVATION '0.19.0' comment).
const XCHAIN_BRIDGE_TRAIN = '0.19.0';

const COINS = ['BTC', 'LTC', 'DOGE'];
const NETWORKS = ['mainnet', 'testnet', 'regtest'];
const EXPECTED_KEYS = COINS.flatMap((coin) => NETWORKS.map((net) => coin + ':' + net)).sort();

const MIRROR_MAPS = {
    MIRROR_ADMISSION_ACTIVATION: 'mirror_admission_activation.MIRROR_ADMISSION_ACTIVATION',
    MIRROR_ADMISSION_CONSUMER_ACTIVATION: 'mirror_admission_activation.MIRROR_ADMISSION_CONSUMER_ACTIVATION',
};

function semverCompare(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}

describe('mirror-admission activation heights', () => {
    for (const name of Object.keys(MIRROR_MAPS)) {
        test(name + ' carries exactly the coin x network key set, null on mainnet and a height on testnet', () => {
            const map = constants[name];
            assert.deepEqual(Object.keys(map).sort(), EXPECTED_KEYS, name + ' key set drifted');
            for (const coin of COINS) {
                const mainKey = coin + ':mainnet';
                const testKey = coin + ':testnet';
                assert.equal(map[mainKey], null,
                    name + "['" + mainKey + "'] is " + map[mainKey] + ', expected null under the mainnet write hold');
                assert.ok(Number.isSafeInteger(map[testKey]) && map[testKey] > 0,
                    name + "['" + testKey + "'] is " + map[testKey] + ', expected a positive safe integer height');
            }
        });
    }

    test('every testnet producer height sits strictly below its consumer height on the same chain', () => {
        const producer = constants.MIRROR_ADMISSION_ACTIVATION;
        const consumer = constants.MIRROR_ADMISSION_CONSUMER_ACTIVATION;
        for (const coin of COINS) {
            const key = coin + ':testnet';
            assert.ok(consumer[key] > producer[key],
                key + ': consumer ' + consumer[key] + ' is not above producer ' + producer[key]);
        }
    });

    test('the BTC testnet producer and consumer sit above the carrying train floor', () => {
        const floor = constants.TRAIN_ACTIVATION[MIRROR_ADMISSION_TRAIN].testnet;
        for (const name of Object.keys(MIRROR_MAPS)) {
            const height = constants[name]['BTC:testnet'];
            assert.ok(height > floor,
                name + "['BTC:testnet'] " + height + ' is not above TRAIN_ACTIVATION[' +
                MIRROR_ADMISSION_TRAIN + '].testnet ' + floor);
        }
    });

    for (const [name, key] of Object.entries(MIRROR_MAPS)) {
        test(name + ' is value-identical to its registry twin on mainnet and testnet', () => {
            const canon = constants[name];
            const twin = gateRegistry.get(key);
            assert.deepEqual(Object.keys(twin).sort(), Object.keys(canon).sort(),
                key + ' key set differs from constants.js ' + name);
            for (const coin of COINS) {
                for (const net of ['mainnet', 'testnet']) {
                    const k = coin + ':' + net;
                    assert.equal(twin[k], canon[k],
                        k + ': registry ' + key + ' holds ' + twin[k] + ', constants.js ' + name + ' holds ' + canon[k]);
                }
            }
        });
    }
});

describe('train and bridge activation heights', () => {
    test('TRAIN_ACTIVATION testnet boundaries never decrease in train order', () => {
        const trains = Object.keys(constants.TRAIN_ACTIVATION)
            .filter((t) => constants.TRAIN_ACTIVATION[t].testnet > 0)
            .sort(semverCompare);
        for (let i = 1; i < trains.length; i++) {
            const prev = constants.TRAIN_ACTIVATION[trains[i - 1]].testnet;
            const next = constants.TRAIN_ACTIVATION[trains[i]].testnet;
            assert.ok(next >= prev,
                'TRAIN_ACTIVATION[' + trains[i] + '].testnet ' + next + ' is below [' + trains[i - 1] + '].testnet ' + prev);
        }
    });

    test('the BTC testnet XCHAIN bridge height sits above its carrying train floor', () => {
        const floor = constants.TRAIN_ACTIVATION[XCHAIN_BRIDGE_TRAIN].testnet;
        const height = constants.XCHAIN_BRIDGE_ACTIVATION['BTC:testnet'];
        assert.ok(height > floor,
            "XCHAIN_BRIDGE_ACTIVATION['BTC:testnet'] " + height + ' is not above TRAIN_ACTIVATION[' +
            XCHAIN_BRIDGE_TRAIN + '].testnet ' + floor);
    });
});
