// Copyright © 2025–2026 Dankest, LLC
// Based on XChain Platform by Dankest, LLC – https://dankest.llc
//
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// This file is part of XChain Platform. Licensed under the GNU Affero
// General Public License v3.0 or later; see LICENSE.md. A commercial
// license (without AGPL source-disclosure terms) is available -
// contact legal@dankest.llc.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { create, all } = require('mathjs');

const DOC_ROOT = path.resolve(__dirname, '../..');
const math = create(all, { number: 'BigNumber', precision: 64 });
const subtract = (a, b) => math.format(math.subtract(math.bignumber(a), math.bignumber(b)), { notation: 'fixed' });

function tokenGateSection() {
    const guide = fs.readFileSync(path.join(DOC_ROOT, 'developer-guide/integration-patterns.md'), 'utf8');
    const start = guide.indexOf('### Step 5: Smart Contract-Based Gating');
    const end = guide.indexOf('### End-to-End Example: Token-Gated Music Platform', start);
    assert.ok(start >= 0 && end > start, 'token-gate section is missing');
    return guide.slice(start, end);
}

function tokenGateContract() {
    const section = tokenGateSection();
    const start = section.indexOf('```js') + 5;
    const end = section.indexOf('```', start);
    const loaded = { exports: {} };
    Function('module', section.slice(start, end))(loaded);
    return loaded.exports;
}

test('capability slash table documents the stored membership label', () => {
    const database = fs.readFileSync(path.join(DOC_ROOT, 'components/indexer/database.md'), 'utf8');
    const row = database.split('\n').find(line => line.startsWith('| `capability_slash_events` |'));

    assert.ok(row, 'capability_slash_events row is missing');
    assert.match(row, /`capability` membership label/);
    assert.match(row, /`cross_chain`/);
    assert.match(row, /first segment is the engine tag/);
    assert.doesNotMatch(row, /`capability` engine tag/);
});

test('contract-targeted slash table names the VM contract API', () => {
    const database = fs.readFileSync(path.join(DOC_ROOT, 'components/indexer/database.md'), 'utf8');
    const heading = database.split('\n').find(line => line.startsWith('**Contract-targeted slashing**'));

    assert.ok(heading, 'contract-targeted slashing heading is missing');
    assert.match(heading, /`xchain\.contract\.slash`/);
    assert.doesNotMatch(heading, /`xchain\.stake\.slash`/);
});

test('token gate uses a real math predicate and persistent state delivery', () => {
    const section = tokenGateSection();

    assert.match(section, /function isAtLeastExact\(/);
    assert.match(section, /isAtLeastExact\(xchain, balance, minimumAmount\)/);
    assert.doesNotMatch(section, /xchain\.math\.lt\(balance, minimumAmount\)/);
    assert.doesNotMatch(section, /xchain\.math\.smaller/);
    assert.match(section, /xchain\.state\.set\('lastAccess', accessRecord\)/);
    assert.doesNotMatch(section, /xchain\.state\.set\('access:' \+ caller/);
    assert.doesNotMatch(section, /xchain\.emit\.message/);
    assert.match(section, /Contract state is public/);
});

test('token gate keeps state growth bounded across distinct callers', () => {
    const contract = tokenGateContract();
    const state = new Map();
    let caller = 'owner';
    let inputs = [];
    const xchain = {
        getSourceAddress: () => caller,
        getInputParam: (index) => inputs[index],
        getBalance: () => '10',
        math: { subtract },
        state: {
            get: (key) => state.get(key) || null,
            set: (key, value) => {
                if (!state.has(key) && state.size >= 6) throw new Error('state key limit');
                state.set(key, value);
            },
        },
    };
    contract.initialize(xchain);
    inputs = ['TOKEN', '1'];
    contract.configure(xchain);
    inputs = ['song', 'hash'];
    contract.registerContent(xchain);
    for (caller of ['caller-1', 'caller-2', 'caller-3']) contract.accessContent(xchain);

    assert.strictEqual(state.size, 5, 'distinct callers reuse one access-result key');
    assert.deepStrictEqual(JSON.parse(state.get('lastAccess')), {
        caller: 'caller-3', contentId: 'song', contentHash: 'hash',
    });
});

test('token gate rejects a balance one base unit below a large threshold', () => {
    const contract = tokenGateContract();
    const state = new Map();
    let caller = 'owner';
    let inputs = [];
    let balance = '999999.99999999';
    const xchain = {
        getSourceAddress: () => caller,
        getInputParam: (index) => inputs[index],
        getBalance: () => balance,
        math: { subtract },
        state: { get: (key) => state.get(key) || null, set: (key, value) => state.set(key, value) },
    };
    contract.initialize(xchain);
    inputs = ['TOKEN', '1000000'];
    contract.configure(xchain);
    inputs = ['song', 'hash'];
    contract.registerContent(xchain);
    caller = 'listener';
    inputs = ['song'];
    assert.throws(() => contract.accessContent(xchain), /Insufficient token balance/);
    balance = '1000000';
    assert.doesNotThrow(() => contract.accessContent(xchain));
});

test('copy-paste amount gates use the exact threshold helper', () => {
    const targets = [
        'developer-guide/build-a-stakeable-contract.md',
        'developer-guide/smart-contract-development.md',
        'developer-guide/integration-patterns.md',
        'protocol/contract-staking.md',
    ];
    for (const target of targets) {
        const doc = fs.readFileSync(path.join(DOC_ROOT, target), 'utf8');
        assert.match(doc, /function isAtLeastExact\(/, target + ' omits the exact helper');
        assert.doesNotMatch(doc, /xchain\.math\.gte\((?:xchain\.contract\.getStake\([^\n]+\)|staked),\s*'100'\)/,
            target + ' still uses tolerant gte for a stake threshold');
        assert.doesNotMatch(doc, /xchain\.math\.lt\(balance,\s*minimumAmount\)/,
            target + ' still uses tolerant lt for a balance threshold');
    }
});
