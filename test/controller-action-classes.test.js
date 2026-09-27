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

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    parseControllerActionClasses,
    readControllerActionClasses,
} = require('./helpers/controller_action_classes.js');

test('parses fall-through and single-label controller action classes', () => {
    const source = `
        controllerActionClass(actionType) {
            switch (actionType) {
                case 'SEND':
                // case 'IGNORED': return 'wrong';
                case 'AIRDROP':
                    return 'transfer';
                case 'DESTROY': return 'burn';
                default: return null;
            }
        }
    `;

    assert.deepEqual(parseControllerActionClasses(source), {
        SEND: 'transfer',
        AIRDROP: 'transfer',
        DESTROY: 'burn',
    });
});

test('rejects source without controllerActionClass', () => {
    assert.throws(
        () => parseControllerActionClasses('const unrelated = true;'),
        /controllerActionClass/,
    );
});

const indexer = readControllerActionClasses();

test('reads controller action classes from the sibling indexer',
    { skip: indexer.skip }, () => {
        const { classes } = indexer;
        for (const action of ['SEND', 'AIRDROP', 'DIVIDEND', 'SWEEP']) {
            assert.equal(classes[action], 'transfer');
        }
        assert.equal(classes.SWEEP_OWNERSHIP, 'ownership');
        assert.equal(classes.DESTROY, 'burn');
        assert.equal(classes.MINT, 'mint');
        assert.equal(classes.STAKE, 'stake');
        assert.equal(Object.hasOwn(classes, 'default'), false);
    });
