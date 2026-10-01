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

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\s+/g, ' ');
}

const docs = {
    list: read('protocol/actions/list.md'),
    references: read('protocol/index-id-references.md'),
    issue: read('protocol/actions/issue.md'),
    registry: read('protocol/project-registry.md'),
};

test('coin-qualified ticker documentation names the activation gate on every page', () => {
    for (const [page, markdown] of Object.entries(docs)) {
        assert.ok(
            markdown.includes('`LIST_TICK_COIN_ACTIVATION`'),
            `${page} must name LIST_TICK_COIN_ACTIVATION`,
        );
    }
});

test('LIST documents coin-qualified names, ids, storage, and consumers', () => {
    const required = [
        '`COIN:TICK`',
        '`COIN:^<tickid>`',
        '`RESERVED_FUTURE_ROOTS`',
        '`invalid: TICK (format)`',
        'stored bare',
        'stored as written with its root upper-cased',
        'including `:PEPE`, is a bare ticker',
        'including AIRDROP and the project roster, reads only its own coin\'s items',
        '`DOGE:PEPE`',
        '`DOGE:^<id>`',
    ];
    for (const text of required) {
        assert.ok(docs.list.includes(text), `protocol/actions/list.md must include ${text}`);
    }
});

test('index references document coin-scoped resolution and SDK output', () => {
    const required = [
        '`COIN:TICK`',
        '`COIN:^<tickid>`',
        "resolved only by that coin's own chain",
        "looking the id up on that coin's own explorer",
        'every bare ticker item stay in full',
    ];
    for (const text of required) {
        assert.ok(
            docs.references.includes(text),
            `protocol/index-id-references.md must include ${text}`,
        );
    }
});

test('ISSUE reserves coin-qualified roots without changing existing tickers or ids', () => {
    const required = [
        '`RESERVED_FUTURE_ROOTS`',
        '`invalid: TICK (reserved)`',
        'Existing tickers and the `^id` form are unaffected',
    ];
    for (const text of required) {
        assert.ok(docs.issue.includes(text), `protocol/actions/issue.md must include ${text}`);
    }
});

test('project rosters document both qualified item forms and chain-local display', () => {
    for (const text of ['`COIN:TICK`', '`COIN:^<tickid>`', 'only the tokens of the chain it reads']) {
        assert.ok(
            docs.registry.includes(text),
            `protocol/project-registry.md must include ${text}`,
        );
    }
});

test('coin-qualified LIST example satisfies the declared format arity', () => {
    const list = fs.readFileSync(path.join(ROOT, 'protocol', 'actions', 'list.md'), 'utf8');
    const format = list.match(/^- `VERSION\|TYPE\|MEMO\|\.\.\.ITEM`$/m);
    const example = list.match(/^LIST\|0\|1\|\|PEPE\|BTC:\^5\|DOGE:WOW$/m);

    assert.ok(format, 'LIST version 0 must declare ITEM as a rest field');
    assert.ok(example, 'LIST must include the coin-qualified ticker example');

    const declaredFields = format[0].slice(3, -1).split('|');
    const exampleFields = example[0].split('|').slice(1);
    assert.ok(exampleFields.length >= declaredFields.length);
    assert.deepEqual(exampleFields.slice(0, 3), ['0', '1', '']);
    assert.deepEqual(exampleFields.slice(3), ['PEPE', 'BTC:^5', 'DOGE:WOW']);
});
