/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../components/vm/operations.md'), 'utf8');

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
