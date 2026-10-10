/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const gen = require('../bin/generate-flag-days.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'protocol', 'flag-days.md'), 'utf8');
const GATE = 'STAKE_DELEGATED_SIGNING_KEY';
const noIndexer = sibling('xchain-indexer', [gen.REGISTRY]).skip;

function unarmedRoster(markdown, network) {
    const match = new RegExp(
        `\\*\\*(?:One gate is|\\d+ gates are) UNARMED on ${network}\\*\\* \\(([^)]*)\\):`,
    ).exec(markdown);
    assert.ok(match, `flag-days.md is missing its ${network} unarmed roster`);
    return match[1];
}

function assertGateIsUnarmed(markdown) {
    for (const network of ['mainnet', 'testnet']) {
        assert.ok(
            unarmedRoster(markdown, network).includes(`\`${GATE}\``),
            `${GATE} is missing from the ${network} unarmed roster`,
        );
    }
}

test('the generated flag-day page lists the stake delegated signing-key gate as unarmed', () => {
    assertGateIsUnarmed(PAGE);
});

test('the generated flag-day page is current with the indexer registry', { skip: noIndexer }, () => {
    assert.ok(gen.collectMainnetUnarmed().some(({ gate }) => gate === GATE));
    assert.ok(gen.collectTestnetUnarmed().some(({ gate }) => gate === GATE));
    assert.equal(PAGE, gen.generate());
});

test('the page guard fails when either unarmed entry is removed', () => {
    for (const network of ['mainnet', 'testnet']) {
        const roster = unarmedRoster(PAGE, network);
        const withoutGate = PAGE.replace(roster, roster.replace(`\`${GATE}\``, '`removed`'));
        assert.throws(
            () => assertGateIsUnarmed(withoutGate),
            new RegExp(`${GATE} is missing from the ${network}`),
        );
    }
});
