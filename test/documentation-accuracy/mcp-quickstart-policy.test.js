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
 *********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('../helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'ai-agents', 'mcp-quickstart.md');
const sdk = sibling('xchain-sdk', ['mcp/server_dependencies.js']);

function quickstartPolicy() {
    const markdown = fs.readFileSync(PAGE, 'utf8');
    const action = markdown.indexOf('"allowedActions"');
    const start = markdown.lastIndexOf('```json\n', action);
    const end = markdown.indexOf('\n```', action);
    assert.ok(start >= 0 && end > action, 'quickstart policy JSON block is missing');
    return JSON.parse(markdown.slice(start + 8, end));
}

test('the MCP quickstart policy satisfies the server wildcard gate', { skip: sdk.skip }, () => {
    const { uncappedActions } = require(path.join(sdk.root, 'mcp', 'server_dependencies.js'));
    const policy = quickstartPolicy();

    assert.deepStrictEqual(policy.allowedActions, ['SEND']);
    assert.deepStrictEqual(uncappedActions(policy), []);

    const unsafe = { ...policy, allowedActions: ['SEND', 'EXECUTE'] };
    assert.throws(() => uncappedActions(unsafe),
        /mcp wallet policy allows EXECUTE, whose spend no amount cap can bind on this rail/,
        'negative control must fail closed on the unboundable action from the former example');
});

test('the quickstart explains wildcard and value-derivability limits', () => {
    const markdown = fs.readFileSync(PAGE, 'utf8');
    assert.match(markdown, /needs a `'\*'` entry/);
    assert.match(markdown, /table that names only some tokens leaves every other token unbounded/);
    assert.match(markdown, /contract code can decide what they move/);
    assert.match(markdown, /no amount cap can bind an `EXECUTE` spend on this rail and the server refuses it/);
});
