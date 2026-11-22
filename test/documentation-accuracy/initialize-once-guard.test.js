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

const ROOT = path.resolve(__dirname, '..', '..');
const EXAMPLE_PAGES = [
    'developer-guide/build-a-stakeable-contract.md',
    'developer-guide/smart-contract-development.md',
    'developer-guide/integration-patterns.md',
    'developer-guide/solidity-to-xchain.md',
    'concepts/smart-contracts.md',
    'components/sdk/workflows.md',
];

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadContract(relativePath, marker) {
    for (const match of read(relativePath).matchAll(/```(?:js|javascript)\n([\s\S]*?)```/g)) {
        if (!match[1].includes(marker)) continue;
        const loaded = { exports: {} };
        Function('module', match[1])(loaded);
        return loaded.exports;
    }
    throw new Error(`${relativePath} has no fenced contract containing ${marker}`);
}

function gateway(state, controls) {
    return {
        state: {
            get: (key) => state.has(key) ? state.get(key) : null,
            set: (key, value) => state.set(key, value),
        },
        require: (condition, message) => {
            if (!condition) throw new Error(message);
        },
        getInputParam: (index) => controls.inputs[index],
        getSourceAddress: () => controls.caller,
        contract: { slash: (...args) => controls.slashes.push(args) },
        emit: { send: (value) => controls.sends.push(value) },
    };
}

function unguardedInitializers(markdown) {
    const misses = [];
    for (const match of markdown.matchAll(/initialize\s*:\s*function\s*\([^)]*\)\s*\{/g)) {
        const opening = match.index + match[0].length;
        const prefix = markdown.slice(opening, opening + 240);
        if (!prefix.includes('already initialized')) misses.push(match.index);
    }
    return misses;
}

test('Staked Secret refuses admin takeover through a second initialize', () => {
    const contract = loadContract('developer-guide/build-a-stakeable-contract.md', "name:        'Staked Secret'");
    const state = new Map();
    const controls = { caller: 'deployer', inputs: ['admin-address'], slashes: [], sends: [] };
    const xchain = gateway(state, controls);

    contract.initialize(xchain);
    controls.caller = 'attacker';
    controls.inputs = ['attacker'];
    assert.throws(() => contract.initialize(xchain), /already initialized/);
    assert.equal(state.get('admin'), 'admin-address');

    controls.inputs = ['staker-pubkey', '50'];
    assert.equal(contract.slashStaker(xchain), 'unauthorized');
    assert.deepStrictEqual(controls.slashes, []);
});

test('Owner Vault refuses owner takeover through a second initialize', () => {
    const contract = loadContract('developer-guide/smart-contract-development.md', "name:        'Owner Vault'");
    const state = new Map();
    const controls = { caller: 'owner', inputs: [], slashes: [], sends: [] };
    const xchain = gateway(state, controls);

    contract.initialize(xchain);
    controls.caller = 'attacker';
    assert.throws(() => contract.initialize(xchain), /already initialized/);
    assert.equal(state.get('owner'), 'owner');

    controls.inputs = ['10', 'MYTOKEN'];
    assert.throws(() => contract.withdraw(xchain), /only owner can withdraw/);
    assert.deepStrictEqual(controls.sends, []);
});

test('every concrete documentation initializer carries a once-only guard', () => {
    let count = 0;
    for (const relativePath of EXAMPLE_PAGES) {
        const markdown = read(relativePath);
        const found = [...markdown.matchAll(/initialize\s*:\s*function\s*\([^)]*\)\s*\{/g)];
        count += found.length;
        assert.deepStrictEqual(unguardedInitializers(markdown), [],
            `${relativePath} contains an initialize without an early once-only guard`);
    }
    assert.equal(count, 10, 'the concrete initializer inventory changed; review every new example');
});

test('falsification: an unguarded initializer fails the static check', () => {
    const unsafe = "module.exports = { initialize: function(xchain) { xchain.state.set('owner', 'attacker'); } };";
    assert.equal(unguardedInitializers(unsafe).length, 1);
});
