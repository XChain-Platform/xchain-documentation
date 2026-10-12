/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/token-bridge.md'), 'utf8');

function policyInheritance(markdown) {
    const match = markdown.match(/## Policy inheritance\n([\s\S]*?)(?=\n## )/);
    assert.ok(match, 'token-bridge.md is missing its Policy inheritance section');
    return match[1];
}

function detachBullet(markdown) {
    const section = policyInheritance(markdown);
    const match = section.match(/- \*\*Detaching a list\.\*\*([\s\S]*?)(?=\n- \*\*)/);
    assert.ok(match, 'Policy inheritance is missing its Detaching a list bullet');
    return match[0];
}

function assertDetachRule(markdown) {
    const bullet = detachBullet(markdown);
    for (const marker of [
        '**Detaching a list.**',
        'BRIDGE_POLICY_DETACH',
        '[Protocol Activation](./protocol-activation.md#cohort-a-riders-that-mint-no-constant)',
        'own block height',
        '[`ISSUE`](./actions/issue.md)',
        'never materialized',
    ]) assert.ok(bullet.includes(marker), `detach bullet is missing ${marker}`);
    assert.doesNotMatch(bullet, /\b(?:20\d{2}-\d{2}-\d{2}|\d{10})\b/);
}

test('Policy inheritance documents bridged list detachment', () => {
    assertDetachRule(PAGE);
});

test('the page guard fails when any required marker is removed', () => {
    for (const marker of [
        '**Detaching a list.**',
        'BRIDGE_POLICY_DETACH',
        '[Protocol Activation](./protocol-activation.md#cohort-a-riders-that-mint-no-constant)',
        'own block height',
        '[`ISSUE`](./actions/issue.md)',
        'never materialized',
    ]) assert.throws(() => assertDetachRule(PAGE.replace(marker, 'removed')));
});
