/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC – https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 *
 * DIVIDEND recipient-eligibility claims.
 *
 * WHY. The user guide promised "Every holder receives their proportional cut",
 * which is a promise a distributor acts on with their own money. dividend.js
 * pays a strict subset of holders and drops three groups:
 *
 *   1. Holders who fail the PAYMENT token's allow or block list. The lists read
 *      are those of DIVIDEND_TICK, not of the share token TICK, and a
 *      configured but empty list still admits everyone.
 *   2. The paying address itself (address == SOURCE).
 *   3. Holders whose share floors to zero. The share is computed with
 *      bcmulfloor at the PAYMENT token's precision, and a recipient is added
 *      only when share != 0. Dropped holders also never reach the per-recipient
 *      fee, so the payer is not charged for them.
 *
 * The allow/block-list exclusion was documented nowhere in this repo until the
 * Notes bullet this guard now pins, which is why the guide could not have been
 * corrected from the spec page alone.
 *
 * WHAT IT CHECKS. Both halves. The SOURCE half reads the sibling indexer, so
 * the guard goes red if the handler changes and the prose becomes stale in the
 * other direction. The PROSE half runs unconditionally, so the guard can never
 * come back all-skip.
 *
 * XCHAIN_DOCS_ROOT overrides the docs root, matching
 * settlement-and-delivery-claims.test.js. It exists so the negative control is
 * runnable: point it at a checkout of an older commit and the prose assertions
 * below go red, which is how they were verified to be capable of failing.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const INDEXER  = path.resolve(path.join(__dirname, '..'), '../xchain-indexer/src');

const haveIndexer = fs.existsSync(path.join(INDEXER, 'actions', 'dividend.js'));
const skipNoIndexer = !haveIndexer && 'sibling xchain-indexer not present in this checkout';
const readSrc = (rel) => fs.readFileSync(path.join(INDEXER, rel), 'utf8');
const readDoc = (rel) => fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8');

const useCases = readDoc('user-guide/use-cases.md');
const creating = readDoc('user-guide/creating-tokens.md');
const spec     = readDoc('protocol/actions/dividend.md');

test('the source facts the DIVIDEND eligibility wording rests on still hold', { skip: skipNoIndexer }, () => {
    const dividend = readSrc('actions/dividend.js');

    assert.match(dividend, /if\(address==data\['SOURCE'\]\)/,
        'dividend.js no longer excludes the paying address from the recipient list, so the '
        + 'guide\'s "the paying address does not pay a dividend to itself" is now wrong');
    assert.match(dividend, /bcmulfloor\(/,
        'dividend.js no longer floors each share with bcmulfloor, so the guide\'s "rounded '
        + 'down to the payment token\'s smallest unit" may no longer describe the handler');
    assert.match(dividend, /if\(share\s*!=\s*0\)/,
        'dividend.js no longer drops zero-share holders, so the guide\'s zero-share exclusion '
        + 'and the spec page\'s per-recipient-fee note are both stale');
    assert.match(dividend, /allowList\.size\s*&&\s*!allowList\.has\(address\)/,
        'dividend.js no longer filters recipients through the payment token\'s allow list');
    assert.match(dividend, /blockList\.size\s*&&\s*blockList\.has\(address\)/,
        'dividend.js no longer filters recipients through the payment token\'s block list');
    assert.match(dividend, /dividendTokenInfo\['ALLOW_LIST'\]/,
        'dividend.js no longer reads ALLOW_LIST off dividendTokenInfo. If the lists now come '
        + 'from the share token instead, the spec Notes bullet naming DIVIDEND_TICK is wrong.');
});

test('the use-cases dividend passage names all three exclusions', () => {
    assert.ok(!useCases.includes('Every holder receives their proportional cut'),
        'user-guide/use-cases.md still promises every holder a proportional cut. dividend.js '
        + 'excludes the payer, list-filtered holders, and holders whose share floors to zero.');
    assert.match(useCases, /eligible holder/i,
        'user-guide/use-cases.md no longer scopes the dividend payout to eligible holders');
    assert.match(useCases, /rounded \*\*down\*\*|rounds to zero/i,
        'user-guide/use-cases.md no longer states the round-down / zero-share exclusion');
    assert.match(useCases, /allow list or a block list|allow or block list/i,
        'user-guide/use-cases.md no longer states the payment token\'s allow/block-list '
        + 'exclusion, which is the one a reader cannot find anywhere else in the guide');
    assert.match(useCases, /paying address does not pay a dividend to itself/i,
        'user-guide/use-cases.md no longer states that the payer is excluded');
});

test('the token-owner capability list does not promise dividends to all holders', () => {
    const bullet = creating.split('\n').find((l) => l.startsWith('- **Pay dividends**'));
    assert.ok(bullet, 'creating-tokens.md no longer carries a "- **Pay dividends**" bullet');
    assert.ok(!/all holders/i.test(bullet),
        'the creating-tokens.md dividend bullet still says dividends reach all holders');
    assert.match(bullet, /eligible holders/i,
        'the creating-tokens.md dividend bullet no longer says eligible holders');
});

test('the DIVIDEND spec page documents the allow/block-list exclusion', () => {
    assert.match(spec, /ALLOW_LIST/,
        'protocol/actions/dividend.md never mentions ALLOW_LIST. The payment token\'s lists '
        + 'filter the recipient set in dividend.js and this page is the only normative place '
        + 'a reader can learn that.');
    assert.match(spec, /BLOCK_LIST/, 'protocol/actions/dividend.md never mentions BLOCK_LIST');
    assert.match(spec, /payment token \(`DIVIDEND_TICK`\), not the share token/,
        'protocol/actions/dividend.md no longer says which token\'s lists apply. dividend.js '
        + 'reads them off dividendTokenInfo, the DIVIDEND_TICK record, and a reader who assumes '
        + 'the share token\'s lists will predict the wrong recipient set.');
});
