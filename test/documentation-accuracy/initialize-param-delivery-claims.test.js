/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 * Constructor delivery claims must match the VM's single-argument call.
 *********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { sibling } = require('../helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..', '..');
const WRONG_DELIVERY = /(?:constructor params|`CONSTRUCTOR_PARAMS`)[^.\n]{0,100}as its arguments|passing `CONSTRUCTOR_PARAMS` as its arguments|runs with zero arguments/i;
const PAGES = [
    'whitepaper.md',
    'protocol/actions/deploy.md',
    'developer-guide/smart-contract-development.md',
];

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function constructorPassage(relativePath, markdown) {
    if (relativePath === 'whitepaper.md') {
        return markdown.split('\n').find((line) => line.startsWith('- **DEPLOY**')) || '';
    }
    if (relativePath === 'protocol/actions/deploy.md') {
        const lines = markdown.split('\n');
        const start = lines.findIndex((line) => line.startsWith('- If the contract exports an `initialize`'));
        return start < 0 ? '' : lines.slice(start, start + 2).join('\n');
    }
    const section = /### Constructor\n\n([\s\S]*?)(?=\n\n## )/.exec(markdown);
    return section ? section[1] : '';
}

function assertDeliveryClaim(relativePath, passage) {
    assert.notEqual(passage, '', `${relativePath} has no constructor passage`);
    assert.match(passage, /initialize\(xchain\)/, `${relativePath} must name the VM call shape`);
    assert.match(passage, /xchain\.getInputParam\([in]\)/, `${relativePath} must name input-param access`);
    assert.match(passage, /DEPLOY_INIT_STRICT/, `${relativePath} must retain the activation rule`);
    assert.doesNotMatch(passage, WRONG_DELIVERY, `${relativePath} describes extra function arguments`);
}

test('constructor pages describe initialize(xchain) and gateway input params', () => {
    for (const relativePath of PAGES) {
        assertDeliveryClaim(relativePath, constructorPassage(relativePath, read(relativePath)));
    }
});

const vm = sibling('xchain-vm', ['src/index/contract_wrapper.js']);

test('the VM wrapper still invokes every exported method with only xchain', { skip: vm.skip }, () => {
    const wrapper = fs.readFileSync(path.join(vm.root, 'src/index/contract_wrapper.js'), 'utf8');
    assert.match(wrapper, /__result = method\(xchain\);/);
    assert.doesNotMatch(wrapper, /__result = method\(xchain\s*,/);
});

test('falsification: extra constructor function arguments are rejected', () => {
    const staleClaims = [
        'the constructor runs with any constructor params as its arguments',
        'passing `CONSTRUCTOR_PARAMS` as its arguments when present',
        '`initialize` runs with zero arguments',
    ];
    for (const stale of staleClaims) {
        assert.match(stale, WRONG_DELIVERY, `stale wording was not caught: ${stale}`);
    }
});
