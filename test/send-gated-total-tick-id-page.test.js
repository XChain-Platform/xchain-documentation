/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025-2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const gen = require('../bin/generate-flag-days.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..');
const FLAG_DAYS = fs.readFileSync(path.join(ROOT, 'protocol', 'flag-days.md'), 'utf8');
const CONTENT = fs.readFileSync(path.join(ROOT, 'protocol', 'token-gated-content.md'), 'utf8');
const GATE = 'SEND_GATED_TOTAL_TICK_ID_ACTIVATION';
const noIndexer = sibling('xchain-indexer', [gen.REGISTRY]).skip;

function unarmedRoster(markdown, network) {
    const match = new RegExp(
        `\\*\\*(?:One gate is|\\d+ gates are) UNARMED on ${network}\\*\\* \\(([^)]*)\\):`,
    ).exec(markdown);
    assert.ok(match, `flag-days.md is missing its ${network} unarmed roster`);
    return match[1];
}

function thresholdSection(markdown) {
    const match = /### Unlock thresholds \(`GATE_MIN_AMOUNT`\)\n([\s\S]*?)(?=\n### )/.exec(markdown);
    assert.ok(match, 'token-gated-content.md is missing its unlock-threshold section');
    return match[1];
}

function assertTickIdTotalClaims(markdown) {
    const section = thresholdSection(markdown);
    assert.match(section, /\[`SEND_GATED_TOTAL_TICK_ID_ACTIVATION`\]\(\.\/flag-days\.md\)/);
    assert.match(section, /Before[\s\S]*summed per `DESTINATION` and literal `TICK` as written/);
    assert.match(section, /Once the gate is active[\s\S]*summed per `DESTINATION` and resolved `TICK_ID`/);
    assert.match(section, /different letter case or the `\^<tickid>` form[\s\S]*count together toward the threshold/);
    assert.match(section, /changes only whether the handoff is owed; it never changes which legs settle/);
}

test('the generated flag-day page lists the gated total gate as unarmed', () => {
    for (const network of ['mainnet', 'testnet']) {
        assert.ok(
            unarmedRoster(FLAG_DAYS, network).includes(`\`${GATE}\``),
            `${GATE} is missing from the ${network} unarmed roster`,
        );
    }
});

test('the generated flag-day page is current with the indexer registry', { skip: noIndexer }, () => {
    assert.ok(gen.collectMainnetUnarmed().some(({ gate }) => gate === GATE));
    assert.ok(gen.collectTestnetUnarmed().some(({ gate }) => gate === GATE));
    assert.equal(FLAG_DAYS, gen.generate());
});

test('the token-gated content page defines the pre-gate and per-TICK_ID totals', () => {
    assertTickIdTotalClaims(CONTENT);
});

test('the page guard fails when a required total claim is removed', () => {
    for (const marker of [
        'SEND_GATED_TOTAL_TICK_ID_ACTIVATION',
        'literal `TICK` as written',
        'resolved `TICK_ID`',
        'different letter case or the `^<tickid>` form',
        'it never changes which legs settle',
    ]) {
        assert.throws(() => assertTickIdTotalClaims(CONTENT.replace(marker, 'removed')));
    }
});
