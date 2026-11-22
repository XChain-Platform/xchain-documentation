/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../protocol/actions/dispenser.md'), 'utf8');
const GUIDE = fs.readFileSync(path.resolve(__dirname, '../user-guide/trading.md'), 'utf8');
const FAQ = fs.readFileSync(path.resolve(__dirname, '../user-guide/faq.md'), 'utf8');
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

function section(markdown, heading) {
    const lines = markdown.split('\n');
    const start = lines.findIndex((line) => line.trim() === heading);
    assert.notStrictEqual(start, -1, `missing heading: ${heading}`);
    let end = lines.length;
    for(let i = start + 1; i < lines.length; i++){
        if(/^#{1,6}\s/.test(lines[i])){ end = i; break; }
    }
    return lines.slice(start, end).join('\n');
}

function assertUserGuidePricing(guide, faq) {
    const pricing = section(guide, '### How Dispensers Are Priced');
    const editing = section(guide, '### Editing or Cancelling a Dispenser');
    const faqAnswer = section(faq, '### What is a dispenser?');
    for(const marker of ['FIAT_AMOUNT', 'ORACLE_ADDRESS', '24 hours', 'most recent']){
        assert.ok(pricing.includes(marker), `pricing section is missing ${marker}`);
    }
    assert.match(pricing, /older than the latest/i);
    assert.match(pricing, /mode-2-user-oracle-oracle_address-set/);
    assert.match(editing, /oracle-priced[\s\S]*effective price/i);
    assert.match(faqAnswer, /previous 24 hours/i);
    assert.match(faqAnswer, /most recent/i);
    assert.doesNotMatch(guide,
        /current exchange rate when the payment arrives|exchange rate at the time of purchase|a live fiat|at dispense time|cannot be changed afterwards/);
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

test('the user guide distinguishes oracle pricing and historical price matching', () => {
    assertUserGuidePricing(GUIDE, FAQ);
});

// The oracle walk stops at the newest quote covering one token; a sub-fill result is then
// rejected without trying an older quote, so the guide must not promise a retry.
function assertOracleWholeFillEdge(guide, faq) {
    const pricing = section(guide, '### How Dispensers Are Priced');
    const oracleParagraph = pricing.split('\n\n').find((p) => p.startsWith('For an oracle price'));
    assert.ok(oracleParagraph, 'pricing section is missing its oracle settlement paragraph');
    assert.match(oracleParagraph, /at least one token/);
    assert.match(oracleParagraph, /less than one whole dispense[\s\S]*the coin is kept/);
    assert.match(oracleParagraph, /even if an older quote would have covered/);
    assert.doesNotMatch(pricing, /For both traditional-currency modes/);
    assert.match(section(faq, '### What is a dispenser?'), /oracle-priced payment worth less than one whole dispense[\s\S]*buys nothing/);
}

test('the user guide states the oracle whole-fill edge without promising an older-quote retry', () => {
    assertOracleWholeFillEdge(GUIDE, FAQ);
    assert.match(PAGE, /covers at least one token but not one whole fill is invalid, and the coin is kept/);
});

test('the reverse-price chart stops the oracle walk at a whole-token match', () => {
    const reversePricing = section(PAGE, '### Reverse Price Matching');
    assert.match(reversePricing, /whole_tokens = floor\(tokens\)/);
    assert.match(reversePricing, /whole_tokens at least 1\?/);
    assert.match(reversePricing, /fills = floor\(tokens \/ GIVE_AMOUNT\)/);
    assert.match(reversePricing, /fills at least 1\?/);
    assert.match(reversePricing, /Matched price buys no whole fill:<br>dispense invalid, coin kept/);
    assert.doesNotMatch(reversePricing,
        /tokens = \(COIN_AMOUNT x coin_price\) \/ oracle_price<br>units = floor\(tokens \/ GIVE_AMOUNT\)/);
});

test('the oracle edge guard fails when the generalized failure rule returns', () => {
    const general = GUIDE.replace(/\n\nFor an oracle price[^\n]*/, '\n\nFor both traditional-currency modes, a payment settles at the most recent rate it covers.');
    assert.notStrictEqual(general, GUIDE, 'test fixture no longer carries the oracle paragraph');
    assert.throws(() => assertOracleWholeFillEdge(general, FAQ), /oracle settlement paragraph/);
    const noEdge = GUIDE.replace('the coin is kept', 'the payment is retried');
    assert.notStrictEqual(noEdge, GUIDE);
    assert.throws(() => assertOracleWholeFillEdge(noEdge, FAQ));
    const noFaq = FAQ.replace(', and an oracle-priced payment worth less than one whole dispense at the matched quote buys nothing', '');
    assert.notStrictEqual(noFaq, FAQ);
    assert.throws(() => assertOracleWholeFillEdge(GUIDE, noFaq));
});

// The oracle walk reads only quotes whose effective time falls inside the 24 hours before the
// payment's block, and pairs each with a validator rate from the 24 hours before that quote
// took effect, so an in-effect quote older than the window settles nothing.
function assertOracleQuoteWindow(guide, faq) {
    const pricing = section(guide, '### How Dispensers Are Priced');
    const oracleParagraph = pricing.split('\n\n').find((p) => p.startsWith('For an oracle price'));
    assert.ok(oracleParagraph, 'pricing section is missing its oracle settlement paragraph');
    assert.match(oracleParagraph, /only quotes that took effect within the previous 24 hours count/);
    assert.match(oracleParagraph, /publish at least once a day/);
    assert.match(oracleParagraph, /more than 24 hours before the payment's block[\s\S]*purchase fails/);
    assert.match(oracleParagraph, /24 hours before that quote took effect/);
    assert.doesNotMatch(oracleParagraph, /already in effect|paired with exchange rates from the previous 24 hours/);
    const faqAnswer = section(faq, '### What is a dispenser?');
    assert.match(faqAnswer, /only quotes that took effect within the previous 24 hours/);
    assert.doesNotMatch(faqAnswer, /For either traditional-currency mode/);
}

test('the user guide limits oracle settlement to quotes effective in the last 24 hours', () => {
    assertOracleQuoteWindow(GUIDE, FAQ);
    assert.match(PAGE, /oracle price that became effective within the last 24 hours/);
});

test('the oracle quote-window guard fails on the in-effect wording', () => {
    const inEffect = GUIDE.replace(/For an oracle price, [^\n]*?The walk stops/,
        'For an oracle price, the same newest-first walk runs over the oracle\'s quotes that are already in effect, paired with exchange rates from the previous 24 hours. It stops');
    assert.notStrictEqual(inEffect, GUIDE, 'test fixture no longer carries the quote-window clause');
    assert.throws(() => assertOracleQuoteWindow(inEffect, FAQ));
    const noDaily = GUIDE.replace('publish at least once a day', 'publish whenever it likes');
    assert.notStrictEqual(noDaily, GUIDE);
    assert.throws(() => assertOracleQuoteWindow(noDaily, FAQ), /once a day/);
    const paymentPairing = GUIDE.replace('24 hours before that quote took effect', '24 hours before the payment');
    assert.notStrictEqual(paymentPairing, GUIDE);
    assert.throws(() => assertOracleQuoteWindow(paymentPairing, FAQ), /that quote took effect/);
    const noStaleFailure = GUIDE.replace(/if its newest quote took effect more than 24 hours[^:]*?latest one\. /, '');
    assert.notStrictEqual(noStaleFailure, GUIDE);
    assert.throws(() => assertOracleQuoteWindow(noStaleFailure, FAQ), /payment's block/);
    const oldFaq = FAQ.replace(/For a fixed traditional-currency price[^\n]*?buys nothing\./,
        'For either traditional-currency mode, a coin payment is checked against finalized rates from the previous 24 hours.');
    assert.notStrictEqual(oldFaq, FAQ);
    assert.throws(() => assertOracleQuoteWindow(GUIDE, oldFaq));
});

test('the user-guide pricing guard rejects stale pricing claims', () => {
    const staleGuide = GUIDE.replaceAll('24 hours', 'the current rate');
    const staleFaq = FAQ.replaceAll('previous 24 hours', 'time of purchase');
    assert.throws(() => assertUserGuidePricing(staleGuide, FAQ), /24 hours/);
    assert.throws(() => assertUserGuidePricing(GUIDE, staleFaq), /previous 24 hours/);
});
