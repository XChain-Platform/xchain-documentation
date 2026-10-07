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
    assert.equal(Object.keys(invocations).length, 14);
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
        DISPENSER_REFILL: 'trade',
        DESTROY: 'burn',
        MINT: 'mint',
        STAKE: 'stake',
    });

    const classes = parseActionClassesTable(page);
    assert.deepEqual(classes.transfer, ['SEND', 'DEPOSIT', 'WITHDRAW']);
});

/* Bind/unbind verdicts and the guard savepoint name. Clients match the
 * STATUS string byte for byte, so every refusal the binding handlers emit
 * must appear in the page's rejection table, and the savepoint name the page
 * gives must carry the ordinal that keeps two guards' rollback targets apart.
 * The prose half always runs; the source half skips by name on a bare clone. */
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const BINDING_SRC = 'src/actions/issue/controller_binding.js';
const ADDRESS_SRC = 'src/actions/address.js';
const COOLDOWN_SRC = 'src/db/database/controllers_vm.js';
const GUARD_EFFECTS_SRC = 'src/actions/execute/guard_effects.js';
const indexerSrc = sibling('xchain-indexer',
    [BINDING_SRC, ADDRESS_SRC, COOLDOWN_SRC, GUARD_EFFECTS_SRC]);
const readIndexer = (rel) => fs.readFileSync(path.join(indexerSrc.root, rel), 'utf8');

// Slice a `###` section up to the next heading of depth three or less.
function headedSection(page, heading) {
    const lines = page.split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim() === heading);
    assert.notEqual(start, -1, `controller-bound-tokens.md lost the "${heading}" heading`);
    const rest = lines.slice(start + 1).findIndex((line) => /^#{1,3}\s/.test(line));
    return lines.slice(start, rest === -1 ? lines.length : start + 1 + rest).join('\n');
}

const verdictsIn = (text) => new Set([...text.matchAll(/error = '(invalid: [^']+)'/g)]
    .map((match) => match[1]));

test('the rejection table names every bind/unbind verdict and the cooldown lockout', () => {
    const rejections = headedSection(readControllerBoundTokensPage(), '### Bind and unbind rejections');
    for (const verdict of ['CONTROLLER (null)', 'ACTION_CLASS (already bound)',
        'ACTION_CLASS (not bound)', 'ACTION_CLASS (already unbinding)',
        'COOLDOWN_BLOCKS (format)']) {
        assert.ok(rejections.includes(`\`invalid: ${verdict}\``),
            `the rejection table no longer names invalid: ${verdict}`);
    }
    assert.match(rejections, /A pending unbind cannot be cancelled or replaced/,
        'the rejection section no longer states the rebind-during-cooldown lockout');
    assert.match(rejections, /`U \+ C`/,
        'the lockout rule no longer states when a replacement bind is accepted');
});

test('the binding handlers emit exactly the verdicts the table lists',
    { skip: indexerSrc.skip }, () => {
        const rejections = headedSection(readControllerBoundTokensPage(),
            '### Bind and unbind rejections');
        const documented = new Set([...rejections.matchAll(/^\|\s*`(invalid: [^`]+)`/gm)]
            .map((match) => match[1]));
        const address = readIndexer(ADDRESS_SRC);
        const start = address.indexOf('async validateControllerBinding(');
        const end = address.indexOf('async recordControllerEvent(', start);
        assert.ok(start !== -1 && end > start, 'address.js validateControllerBinding not found');
        const tokenVerdicts = verdictsIn(readIndexer(BINDING_SRC));
        const addressVerdicts = verdictsIn(address.slice(start, end));
        assert.ok(tokenVerdicts.size >= 9 && addressVerdicts.size >= 8,
            'the verdict scan matched too few strings to be a real comparison');
        for (const verdict of [...tokenVerdicts, ...addressVerdicts]) {
            assert.ok(documented.has(verdict),
                `${verdict} is emitted by a binding handler but missing from the rejection table`);
        }
        for (const verdict of addressVerdicts) {
            assert.ok(!verdict.startsWith('invalid: TICK'),
                'ADDRESS v1 now emits a TICK verdict, so "less the TICK ones" is wrong');
        }
        const bridged = 'invalid: TICK (bridged tokens cannot be policy-bound yet)';
        for (const verdict of documented) {
            assert.ok(tokenVerdicts.has(verdict) || verdict === bridged,
                `the rejection table lists ${verdict}, which no binding handler emits`);
        }
    });

test('the cooldown lockout source facts still hold', { skip: indexerSrc.skip }, () => {
    assert.match(readIndexer(COOLDOWN_SRC), /Number\(atBlock\) < Number\(row\.cooldown_end_block\)/,
        'an unbind row no longer gates until cooldown_end_block, so the lockout rule is stale');
    const binding = readIndexer(BINDING_SRC);
    assert.match(binding, /else if\(effective\)\s*\n\s*error = 'invalid: ACTION_CLASS \(already bound\)'/,
        'a bind is no longer refused while an unbind still gates, so the lockout rule is stale');
    assert.match(binding, /let cooldown\s*= Number\(effective\.cooldown_blocks\)/,
        'the unbind no longer takes the live bind\'s cooldown, so "C is the bind\'s value" is stale');
});

test('the guard savepoint name carries the per-invocation ordinal', () => {
    const page = readControllerBoundTokensPage();
    assert.ok(page.includes('`controller_guard_<actionIndex>_<controller>_<seq>_<ordinal>`'),
        'controller-bound-tokens.md no longer gives the four-part guard savepoint name');
    assert.ok(!page.includes('`controller_guard_<actionIndex>_<controller>_<seq>`'),
        'controller-bound-tokens.md again gives the three-part name two guards can collide on');
});

test('the guard savepoint source still appends the ordinal', { skip: indexerSrc.skip }, () => {
    assert.match(readIndexer(GUARD_EFFECTS_SRC),
        /createSavepoint\('controller_guard_'[^\n]*\(this\.guardSavepointCounter\+\+\)\)/,
        'guard_effects.js no longer appends guardSavepointCounter to the savepoint name');
});
