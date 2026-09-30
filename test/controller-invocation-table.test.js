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
    parseInvocationTable,
    parseActionClassesTable,
    readControllerBoundTokensPage,
} = require('./helpers/controller_invocation_table.js');

const SYNTHETIC_PAGE = `
### Invocation points

| \`action_type\` | Class |
|---|---|
| \`SEND\` | \`transfer\` |
| \`MINT\` | \`mint\` |

### Action classes

| Class | Gates | Guard \`action_type\` |
|---|---|---|
| \`transfer\` | sends | \`SEND\` / \`DEPOSIT\` |
| \`mint\` | supply | \`MINT\` |
`;

test('parses invocation points and action classes', () => {
    assert.deepEqual(parseInvocationTable(SYNTHETIC_PAGE), {
        SEND: 'transfer',
        MINT: 'mint',
    });
    assert.deepEqual(parseActionClassesTable(SYNTHETIC_PAGE), {
        transfer: ['SEND', 'DEPOSIT'],
        mint: ['MINT'],
    });
});

test('rejects a page without the invocation points heading', () => {
    assert.throws(
        () => parseInvocationTable('### Action classes\n\n| Class | Names |\n|---|---|'),
        /Invocation points/,
    );
});

test('pins the live controller invocation table', () => {
    const page = readControllerBoundTokensPage();
    const invocations = parseInvocationTable(page);
    assert.equal(Object.keys(invocations).length, 13);
    assert.deepEqual(invocations, {
        SEND: 'transfer',
        AIRDROP: 'transfer',
        DIVIDEND: 'transfer',
        SWEEP: 'transfer',
        DEPOSIT: 'transfer',
        WITHDRAW: 'transfer',
        SWEEP_OWNERSHIP: 'ownership',
        ORDER_CREATE: 'trade',
        SWAP_CREATE: 'trade',
        DISPENSER_CREATE: 'trade',
        DESTROY: 'burn',
        MINT: 'mint',
        STAKE: 'stake',
    });

    const classes = parseActionClassesTable(page);
    assert.deepEqual(classes.transfer, ['SEND', 'DEPOSIT', 'WITHDRAW']);
});
