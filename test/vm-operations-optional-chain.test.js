/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('./helpers/sibling_checkout.js');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../components/vm/operations.md'), 'utf8');
const VM = sibling('xchain-vm', ['package.json', 'test/preflight.test.js']);

function globalObjectSpellings(markdown) {
    const match = markdown.match(/### Global-object spellings\n([\s\S]*?)(?=\n## )/);
    assert.ok(match, 'operations.md is missing its Global-object spellings section');
    return match[1];
}

function assertOptionalChainRule(markdown) {
    const section = globalObjectSpellings(markdown);
    for (const marker of [
        'LINT_OPTIONAL_CHAIN_ACTIVATION',
        'enforceLintOptionalChain',
        '(globalThis?.globalThis).Promise',
        '(this?.globalThis)?.WebAssembly',
        '(globalThis?.Math).pow(2, 3)',
        '../../protocol/protocol-activation.md#vm-gates-service-carried',
    ]) {
        assert.match(section, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
}

function assertPreflightGuidance(markdown, pkg) {
    for (const name of ['test', 'ci', 'test:all'])
        assert.match(pkg.scripts[name], /test\/preflight\.test\.js/,
            `${name} no longer runs the fail-loud preflight`);
    assert.match(markdown, /missing native binding makes the standard VM test gates fail/);
    assert.match(markdown, /focused test file or a script that omits preflight/);
    assert.match(markdown, /test:performance/);
    assert.ok(!markdown.includes('automatically skipped in the standard suite'));
    assert.ok(!markdown.includes('below Node 22 tests silently skip rather than fail'));
}

test('Global-object spellings documents the gated optional-chain rule', () => {
    assertOptionalChainRule(PAGE);
});

test('the page guard fails when any required marker is removed', () => {
    for (const marker of [
        'LINT_OPTIONAL_CHAIN_ACTIVATION',
        'enforceLintOptionalChain',
        '(globalThis?.globalThis).Promise',
        '(this?.globalThis)?.WebAssembly',
        '(globalThis?.Math).pow(2, 3)',
        '../../protocol/protocol-activation.md#vm-gates-service-carried',
    ]) {
        assert.throws(() => assertOptionalChainRule(PAGE.replaceAll(marker, 'removed')));
    }
});

test('standard VM test gates fail loudly while focused selections retain a warning', {
    skip: VM.skip,
}, () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(VM.root, 'package.json'), 'utf8'));
    assertPreflightGuidance(PAGE, pkg);
    const drifted = structuredClone(pkg);
    drifted.scripts.test = drifted.scripts.test.replace('test/preflight.test.js', 'test/unit/a.test.js');
    assert.throws(() => assertPreflightGuidance(PAGE, drifted));
});
