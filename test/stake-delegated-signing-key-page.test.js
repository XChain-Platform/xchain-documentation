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

function testnetArmsNote(markdown) {
    const match = /(?:One gate is|\d+ gates are) the exception: ([^\n]*)/.exec(markdown);
    assert.ok(match, 'flag-days.md is missing its testnet exceptions note');
    return match[1];
}

// A release cut armed the gate on testnet: it stays in the mainnet unarmed roster, is
// named among the testnet arms, and is gone from the testnet unarmed roster.
function assertGateArmedOnTestnetOnly(markdown) {
    assert.ok(unarmedRoster(markdown, 'mainnet').includes(`\`${GATE}\``),
        `${GATE} is missing from the mainnet unarmed roster`);
    assert.ok(testnetArmsNote(markdown).includes(`\`${GATE}\` arms testnet at`),
        `${GATE} is missing from the testnet arms`);
    assert.ok(!unarmedRoster(markdown, 'testnet').includes(`\`${GATE}\``),
        `${GATE} is still in the testnet unarmed roster`);
}

test('the generated flag-day page lists the stake delegated signing-key gate as unarmed on mainnet and armed on testnet', () => {
    assertGateArmedOnTestnetOnly(PAGE);
});

test('the generated flag-day page is current with the indexer registry', { skip: noIndexer }, () => {
    assert.ok(gen.collectMainnetUnarmed().some(({ gate }) => gate === GATE));
    assert.ok(!gen.collectTestnetUnarmed().some(({ gate }) => gate === GATE));
    assert.ok(gen.collectTestnetArms().some(({ gate, time }) => gate === GATE && time > 1));
    assert.equal(PAGE, gen.generate());
});

test('the page guard fails when the mainnet entry or the testnet arm is removed', () => {
    const roster = unarmedRoster(PAGE, 'mainnet');
    assert.throws(
        () => assertGateArmedOnTestnetOnly(PAGE.replace(roster, roster.replace(`\`${GATE}\``, '`removed`'))),
        new RegExp(`${GATE} is missing from the mainnet`),
    );
    const note = testnetArmsNote(PAGE);
    assert.throws(
        () => assertGateArmedOnTestnetOnly(PAGE.replace(note, note.replace(`\`${GATE}\` arms`, '`removed` arms'))),
        new RegExp(`${GATE} is missing from the testnet arms`),
    );
});
