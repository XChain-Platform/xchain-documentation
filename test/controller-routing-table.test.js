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
    readControllerActionClasses,
} = require('./helpers/controller_action_classes.js');
const {
    parseActionClassesTable,
    parseInvocationTable,
    readControllerBoundTokensPage,
} = require('./helpers/controller_invocation_table.js');

const page = readControllerBoundTokensPage();
const indexer = readControllerActionClasses();

function assertCustodyActionClasses(markdown) {
    const classes = parseActionClassesTable(markdown);
    for (const action of ['DEPOSIT', 'WITHDRAW']) {
        const routedClasses = Object.entries(classes)
            .filter(([, actions]) => actions.includes(action))
            .map(([actionClass]) => actionClass);
        assert.deepEqual(routedClasses, ['transfer'],
            `${action} must appear only in the transfer class`);
    }
}

test('documents the controller custody guard flag day', () => {
    assert.match(page, /\bCONTROLLER_CUSTODY_GUARD\b/);
});

test('matches every indexer controller route to the invocation table', () => {
    assert.equal(indexer.skip, false, indexer.skip);
    const invocations = parseInvocationTable(page);
    for (const [action, actionClass] of Object.entries(indexer.classes)) {
        assert.equal(invocations[action], actionClass,
            `${action} must be documented as ${actionClass}`);
    }
});

test('documents custody actions in the transfer action class', () => {
    assertCustodyActionClasses(page);
});

test('rejects an action classes table missing DEPOSIT', () => {
    const missingDeposit = `### Action classes

| Class | Gates | Guard \`action_type\` |
|---|---|---|
| \`transfer\` | \`SEND\`, \`WITHDRAW\` | \`SEND\` / \`WITHDRAW\` |
`;
    assert.throws(() => assertCustodyActionClasses(missingDeposit),
        /DEPOSIT must appear only in the transfer class/);
});
