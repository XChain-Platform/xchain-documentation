/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright 2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('EXECUTE documents the native paid-output gas budget boundary', () => {
    const execute = read('protocol/actions/execute.md');
    for (const marker of [
        'EXECUTE_NATIVE_METERED_GAS_ACTIVATION',
        'no gas-budget or gas-limit field',
        'VM_EXECUTE_BASE',
        '1,000,000',
        'out of gas',
        'fee output is kept',
        'XCHAIN-balance',
    ]) {
        assert.ok(execute.includes(marker), `EXECUTE page is missing ${marker}`);
    }
    assert.ok(execute.indexOf('Before `EXECUTE_NATIVE_METERED_GAS_ACTIVATION`')
        < execute.indexOf('From `EXECUTE_NATIVE_METERED_GAS_ACTIVATION`'));
    assert.doesNotMatch(execute,
        /Gas fee is calculated as the actual gas consumed during VM execution, multiplied by the gas price/);
});

test('activation pages publish the new gate without inventing public-chain heights', () => {
    const flagDays = read('protocol/flag-days.md');
    const activation = read('protocol/protocol-activation.md');
    for (const page of [flagDays, activation]) {
        for (const marker of [
            'EXECUTE_NATIVE_METERED_GAS_ACTIVATION',
            'UNARMED',
            'XC_EXECUTE_NATIVE_METERED_GAS_REGTEST_ACTIVATION',
        ]) assert.ok(page.includes(marker), `activation page is missing ${marker}`);
    }
    assert.match(flagDays, /every testnet chain[^.]*UNARMED|UNARMED[^.]*every testnet chain/);
    assert.match(activation, /Below (?:the gate|it)[^.]*VM_EXECUTE_BASE/i);
    assert.match(activation, /At or above (?:the gate|it)[^.]*paid[^.]*output/i);
});

test('native EXECUTE quote guidance uses a dry-run estimate plus safety margin', () => {
    for (const rel of ['concepts/gas.md', 'components/sdk/explorer.md', 'components/explorer/api.md']) {
        const page = read(rel);
        assert.ok(page.includes('requiredFeeSats'), `${rel} omits requiredFeeSats`);
        assert.match(page, /EXECUTE[\s\S]*dry-run gas estimate/,
            `${rel} omits the EXECUTE dry-run estimate rule`);
        assert.match(page, /dry-run gas estimate[\s\S]*fixed safety\s+margin/,
            `${rel} omits the EXECUTE safety margin rule`);
    }
    const gas = read('concepts/gas.md');
    assert.doesNotMatch(gas, /`valid: null`[^.]*returned for `DEPLOY` and `EXECUTE`/s);
});

test('top-level EXECUTE guides do not claim a wire gas limit or unconditional full ceiling', () => {
    assert.doesNotMatch(read('protocol/xchain-uri-scheme.md'),
        /top-level `EXECUTE`[^.]*always runs under the protocol's gas ceiling/);
    assert.doesNotMatch(read('developer-guide/solidity-to-xchain.md'), /`GAS_LIMIT` on deploy\/execute/);
    assert.doesNotMatch(read('components/indexer/actions.md'), /Yes: actual metered gas consumed/);
    assert.doesNotMatch(read('concepts/smart-contracts.md'), /calling EXECUTE's `GAS_LIMIT`/);
});
