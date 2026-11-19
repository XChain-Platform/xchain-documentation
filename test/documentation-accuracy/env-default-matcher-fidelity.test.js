/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 *
 * Environment default matcher fidelity.
 *
 * Run: node --test test/documentation-accuracy/env-default-matcher-fidelity.test.js
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const cov = require('../../lib/env-var-doc-coverage.js');

const entryOf = (value, line) => ({
    vars: new Map([['SYNC_MODE', [{
        file: 'src/config.js',
        line: 1,
        default: { value, numeric: false },
    }]]]),
    docLines: [line],
    docProse: [line],
});

test('default values are case-sensitive while default keywords are not', () => {
    assert.equal(cov.defaultDocumented(['| `SYNC_MODE` | mode | `SERVER` |'], 'server'), false);
    assert.equal(cov.defaultDocumented(['`SYNC_MODE` defaults to `SERVER`.'], 'server'), false);
    assert.equal(cov.defaultDocumented(['`SYNC_MODE` Defaults to `server`.'], 'server'), true);
    assert.equal(cov.defaultDocumented(['`SYNC_MODE` DEFAULT: `server`'], 'server'), true);
});

test('a longer punctuated value does not document its prefix', () => {
    for (const [value, line] of [
        ['server', '`SYNC_MODE` defaults to server-proxy.'],
        ['http://localhost:8332', '`SYNC_MODE` defaults to http://localhost:8332/rpc.'],
        ['http://localhost', '`SYNC_MODE` defaults to http://localhost:8332.'],
        ['example', '`SYNC_MODE` defaults to example.com.'],
        ['30', '`SYNC_MODE` defaults to 30-60 seconds.'],
    ]) assert.equal(cov.defaultDocumented([line], value), false, line);
});

test('closing punctuation still terminates a complete default value', () => {
    for (const line of [
        '`SYNC_MODE` defaults to server.',
        '`SYNC_MODE` defaults to server, and the hub uses it.',
        '`SYNC_MODE` defaults to server; set it to client to opt out.',
        '`SYNC_MODE` (defaults to server).',
        '| `SYNC_MODE` | defaults to server |',
    ]) assert.equal(cov.defaultDocumented([line], 'server'), true, line);
    assert.equal(cov.defaultDocumented(
        ['`SYNC_MODE` defaults to http://localhost:8332/rpc.'],
        'http://localhost:8332/rpc',
    ), true);
    assert.equal(cov.defaultDocumented(['`SYNC_MODE` defaults to 30: the hub clamps it.'], '30'), true);
});

test('default drift reports case-only and punctuated-prefix mismatches', () => {
    const expected = ['SYNC_MODE: code default server (src/config.js:1) appears on no doc line for it'];
    assert.deepEqual(cov.checkDefaultDrift(
        'sync', entryOf('server', '| `SYNC_MODE` | No | `SERVER` | which half to run |'),
    ), expected);
    assert.deepEqual(cov.checkDefaultDrift(
        'sync', entryOf('server', '`SYNC_MODE` defaults to server-proxy.'),
    ), expected);
});
