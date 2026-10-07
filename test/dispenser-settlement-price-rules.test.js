/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/actions/dispenser.md'), 'utf8');
const MARKERS = [
    'DISPENSER_SETTLEMENT_PRICE_ACTIVATION',
    'GIVE_ESCROW',
    'invalid: no matching oracle price',
    'invalid: FIAT_CODE (no price snapshot in the settlement window)',
    'invalid: ORACLE_ADDRESS (stale oracle price)',
    'invalid: ORACLE_ADDRESS (no validator price pairs with the oracle price)',
    'xchain-indexer/src/actions/dispense/pricing_paths.js',
    'xchain-indexer/src/actions/dispenser/validate_format.js',
    'armed on BTC, LTC and DOGE testnet',
    'not yet armed on mainnet',
];

function rulesSection(markdown) {
    const match = markdown.match(/\n## Rules\n([\s\S]*?)(?=\n```)/);
    assert.ok(match, 'dispenser.md is missing its Rules list');
    return match[1];
}

// Verify the Rules list keeps the ungated sale window apart from the create/refill gate.
function assertSettlementPriceRules(markdown) {
    const rules = rulesSection(markdown);
    for (const marker of MARKERS) assert.ok(rules.includes(marker), `Rules list is missing ${marker}`);
    assert.doesNotMatch(rules, /not yet armed on mainnet or any testnet/);
    assert.doesNotMatch(rules, /Behind `DISPENSER_SETTLEMENT_PRICE_ACTIVATION`, a dispenser priced by a user oracle/);
}

test('dispenser rules place the settlement-price gate on create and refill', () => {
    assertSettlementPriceRules(PAGE);
});

test('the rules guard fails when a marker is removed or the old bullet returns', () => {
    const rules = rulesSection(PAGE);
    for (const marker of MARKERS) {
        assert.throws(() => assertSettlementPriceRules(PAGE.replace(rules, rules.replaceAll(marker, 'removed'))));
    }
    const stale = PAGE.replace('A FIAT dispenser sells only', 'Behind `DISPENSER_SETTLEMENT_PRICE_ACTIVATION`, a dispenser priced by a user oracle sells only');
    assert.notStrictEqual(stale, PAGE, 'test fixture no longer carries the sale-window bullet');
    assert.throws(() => assertSettlementPriceRules(stale), /match/i);
});
