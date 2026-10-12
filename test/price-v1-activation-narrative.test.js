/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/protocol-activation.md'), 'utf8');

function assertPriceV1ActivationNarrative(markdown) {
    const match = markdown.match(/^`PRICE_V1_CANONICAL_ACTIVATION`[^\n]*(?:\n(?!\n)[^\n]*)*/m);
    assert.ok(match, 'protocol-activation.md is missing the PRICE v1 activation paragraph');

    const paragraph = match[0];
    const prose = paragraph.replace(/\s+/g, ' ');
    assert.match(paragraph, /\[PRICE\]\(\.\/actions\/price\.md\)/);
    assert.match(prose, /a `VALUE` and `FEE` with no leading zero/);
    assert.match(prose, /`PRICE_V1_VALUE_MAX_LENGTH` and `PRICE_V1_FEE_MAX_LENGTH`/);
    assert.match(prose, /keyed on the action's own block time/);
    assert.match(prose, /inert on mainnet until the operator arms it/);
    assert.match(prose, /armed on BTC, LTC and DOGE testnet/);
    assert.doesNotMatch(prose, /inert on mainnet and testnet/);
    assert.match(prose, /`price_scale_activation\.PRICE_V1_CANONICAL_ACTIVATION`/);
    assert.match(prose, /regtest is genesis-active/);
    assert.match(paragraph, /\[Flag-Day Values\]\(\.\/flag-days\.md\)/);
    assert.doesNotMatch(paragraph, /\b\d{10}\b/);
}

test('the activation page documents the PRICE v1 canonical gate', () => {
    assertPriceV1ActivationNarrative(PAGE);
});

test('the activation guard fails when the PRICE v1 paragraph is removed', () => {
    const paragraph = PAGE.match(/^`PRICE_V1_CANONICAL_ACTIVATION`[^\n]*(?:\n(?!\n)[^\n]*)*\n*/m);
    assert.ok(paragraph, 'test fixture is missing the PRICE v1 activation paragraph');
    assert.throws(() => assertPriceV1ActivationNarrative(PAGE.replace(paragraph[0], '')));
});

test('the activation guard fails on the old inert-on-testnet wording', () => {
    const stale = PAGE.replace('is armed on BTC, LTC and DOGE testnet', 'is inert on mainnet and testnet, armed on BTC, LTC and DOGE testnet');
    assert.notStrictEqual(stale, PAGE, 'test fixture no longer carries the testnet arming clause');
    assert.throws(() => assertPriceV1ActivationNarrative(stale), /match/i);
});
