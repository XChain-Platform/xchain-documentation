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
    parseInvocationTable,
    readControllerBoundTokensPage,
} = require('./helpers/controller_invocation_table.js');

const page = readControllerBoundTokensPage();
const indexer = readControllerActionClasses();

test('documents the controller custody guard flag day', () => {
    assert.match(page, /\bCONTROLLER_CUSTODY_GUARD\b/);
});

test('matches every indexer controller route to the invocation table',
    { skip: indexer.skip }, () => {
        const invocations = parseInvocationTable(page);
        for (const [action, actionClass] of Object.entries(indexer.classes)) {
            assert.equal(invocations[action], actionClass,
                `${action} must be documented as ${actionClass}`);
        }
    });
