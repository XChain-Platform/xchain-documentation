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
 * Settlement- and delivery-timing claims in the user guide.
 *
 * WHY. Five guide sentences promised a settlement the handlers do not make.
 * Each one is a promise a reader acts on with their own money:
 *
 *   1. The Mint Supply bullet said "editing the token issues that much again".
 *      Only the v2 mint-params edit carries MINT_SUPPLY; the v1 description
 *      edit has no such field, and issue.js credits supply only when the field
 *      is present in the action.
 *   2. Cancelling an order was described as returning escrow "immediately".
 *      order.js writes status 'cancelling' when the order carries pending
 *      COINPay obligations and releases the escrow only when they resolve;
 *      order_expire.js does the same as 'expiring'. Cancelling a DISPENSER
 *      enters a DISPENSER_CLOSE_DELAY window before the leftover tokens come
 *      back. Dispenser EXPIRY does not, which is why the guide must not carry
 *      a blanket caveat either.
 *   3. Issuer-rights sales were called atomic without qualification. That holds
 *      on one chain; a cross-chain swap settles each leg on its own chain.
 *   4. The gated-archive and DEX-sale bullets said a buyer receives the
 *      decryption key with the token. send.js is the ONLY action that requires
 *      the key-handoff MESSAGE, and transferTokenOwnership emits none.
 *   5. Betting said any LTC/DOGE market create or bet place without a
 *      native-coin fee output is rejected. bet.js resolves the payment mode
 *      only when the computed fee is above zero, and a market inside the
 *      duration-fee free window computes to zero.
 *
 * WHAT IT CHECKS. Both halves of every claim: the SOURCE fact the corrected
 * wording rests on, read out of the sibling indexer, and the PROSE, which must
 * no longer carry the old absolute and must state the condition that makes it
 * conditional. The prose half runs unconditionally, so the guard can never come
 * back all-skip; only the source half skips when the sibling checkout is absent.
 *
 * XCHAIN_DOCS_ROOT overrides the docs root. It exists so the negative control is
 * runnable: point it at a checkout of an older commit and every prose assertion
 * below goes red, which is how these were verified to be capable of failing.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const INDEXER  = path.resolve(path.join(__dirname, '..'), '../xchain-indexer/src');

const haveIndexer = fs.existsSync(path.join(INDEXER, 'actions', 'order.js'));
const skipNoIndexer = !haveIndexer && 'sibling xchain-indexer not present in this checkout';

const readSrc = (rel) => fs.readFileSync(path.join(INDEXER, rel), 'utf8');
const readDoc = (rel) => fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8');

const creating  = readDoc('user-guide/creating-tokens.md');
const trading   = readDoc('user-guide/trading.md');
const faq       = readDoc('user-guide/faq.md');
const useCases  = readDoc('user-guide/use-cases.md');
const crossChain= readDoc('user-guide/cross-chain.md');
const betting   = readDoc('user-guide/betting.md');
const gated     = readDoc('protocol/token-gated-content.md');
const nft       = readDoc('protocol/nft-standard.md');

// Slice a markdown section by its heading, up to the next heading of any depth.
function section(md, heading, label){
    const lines = md.split('\n');
    const start = lines.findIndex((l) => l.trim() === heading);
    assert.notStrictEqual(start, -1, `${label} no longer has the "${heading}" heading`);
    let end = lines.length;
    for(let i = start + 1; i < lines.length; i++){
        if(/^#{1,6}\s/.test(lines[i])){ end = i; break; }
    }
    return lines.slice(start, end).join('\n');
}

/* 1. MINT_SUPPLY is issued at create, and again only when an edit resupplies it. */

test('the mint-supply source facts still hold', { skip: skipNoIndexer }, () => {
    const issue = readSrc('actions/issue.js');
    const v1 = issue.match(/this\.formats\[1\]\s*=\s*'([^']*)'/);
    const v2 = issue.match(/this\.formats\[2\]\s*=\s*'([^']*)'/);
    assert.ok(v1 && v2, 'issue.js no longer declares formats[1] and formats[2] as string literals');
    assert.ok(!v1[1].includes('MINT_SUPPLY'),
        'issue.js format 1 (description edit) now carries a MINT_SUPPLY field, so the guide\'s '
        + '"a description edit mints nothing" wording is no longer accurate');
    assert.ok(v2[1].includes('MINT_SUPPLY'),
        'issue.js format 2 (mint-params edit) no longer carries MINT_SUPPLY, so the guide\'s '
        + '"resupplying Mint Supply issues more" wording is no longer accurate');
    assert.match(issue, /if\(data\['MINT_SUPPLY'\]\)\s*\n\s*credits\.push/,
        'issue.js no longer credits MINT_SUPPLY only when the field is present in the action');
});

test('the Mint Supply bullet does not say that editing a token re-mints', () => {
    const bullet = creating.split('\n').find((l) => l.startsWith('- **Mint Supply**:'));
    assert.ok(bullet, 'creating-tokens.md no longer carries a "- **Mint Supply**:" bullet');
    assert.ok(!/issues that much again/.test(bullet),
        'the Mint Supply bullet still says an edit "issues that much again". A description edit '
        + 'has no MINT_SUPPLY field (issue.js formats[1]) and mints nothing.');
    assert.match(bullet, /mint-settings edit/,
        'the Mint Supply bullet no longer names the mint-settings edit as the thing that issues '
        + 'more supply, which is the condition that makes the claim true');
    assert.match(bullet, /Lock Mint Supply/,
        'the Mint Supply bullet no longer names Lock Mint Supply as the way to close that path');
});

/* 2. Escrow release is deferred by a pending coin payment, and by a dispenser close window. */

test('the deferred-escrow source facts still hold', { skip: skipNoIndexer }, () => {
    const order = readSrc('actions/order.js');
    const orderExpire = readSrc('actions/order_expire.js');
    const dispenser = readSrc('actions/dispenser.js');
    const dispenserExpire = readSrc('actions/dispenser_expire.js');
    const config = readSrc('config.js');

    assert.match(order, /getPendingCoinpayObligationsByOrder/,
        'order.js no longer checks for pending COINPay obligations before cancelling');
    assert.match(order, /createOrderStatus\([^)]*'cancelling'\)/,
        'order.js no longer defers a cancel to the two-phase \'cancelling\' status');
    assert.match(orderExpire, /createOrderStatus\([^)]*'expiring'\)/,
        'order_expire.js no longer defers an expiry to the two-phase \'expiring\' status');
    assert.match(dispenser, /createDispenserStatus\([^)]*'cancelling'/,
        'dispenser.js no longer routes a cancel through the \'cancelling\' close window');
    assert.match(config, /DISPENSER_CLOSE_DELAY'\]\s*=\s*3600/,
        'DISPENSER_CLOSE_DELAY is no longer 3600 seconds, so the guide\'s "one-hour" wording '
        + 'needs to change with it');
    assert.match(dispenserExpire, /createDispenserStatus\([^)]*'expired'\)/,
        'dispenser_expire.js no longer closes an expired dispenser directly. The guide says '
        + 'expiry returns tokens immediately BECAUSE it does not take the close window.');
    assert.doesNotMatch(dispenserExpire, /'cancelling'/,
        'dispenser_expire.js now routes expiry through \'cancelling\'; the guide\'s '
        + '"expiry needs no closing window" sentence would then be wrong');
});

test('the guide does not promise an immediate escrow return on cancellation', () => {
    for(const [label, md] of [['trading.md', trading], ['faq.md', faq]]){
        assert.ok(!/escrowed tokens are immediately returned/.test(md),
            `${label} still promises escrow is "immediately returned" on cancel. order.js defers `
            + 'the release to \'cancelling\' while a COINPay obligation is outstanding.');
    }
});

test('the cancellation sections state the condition that defers the release', () => {
    const cancelling = section(trading, '### Cancelling an Order', 'trading.md');
    assert.match(cancelling, /settles or lapses|settle or lapse/,
        'trading.md "Cancelling an Order" no longer says the escrow is released when an '
        + 'outstanding coin payment settles or lapses');
    assert.match(cancelling, /expiration/,
        'trading.md "Cancelling an Order" no longer says the same timing applies at expiration');
    assert.match(faq, /settles or its deadline passes/,
        'faq.md\'s cancel answer no longer carries the outstanding-coin-payment condition');
});

test('the dispenser section separates a cancel close window from an immediate expiry', () => {
    const dispensers = section(trading, '### Editing or Cancelling a Dispenser', 'trading.md');
    assert.match(dispensers, /one-hour closing window/,
        'trading.md no longer says a dispenser cancel enters a one-hour closing window '
        + '(DISPENSER_CLOSE_DELAY) before the leftover tokens come back');
    assert.match(dispensers, /Expiry needs no closing window/,
        'trading.md no longer distinguishes expiry, which closes the dispenser directly '
        + '(dispenser_expire.js), from a cancel, which does not');
    assert.ok(!/exactly as if you had cancelled it/.test(dispensers),
        'trading.md again equates dispenser expiry with a cancellation. They differ exactly in '
        + 'the close window, which is the point of the correction.');
});

/* 3. and 4. What an ownership sale delivers, and what it does not. */

test('the ownership-sale and key-handoff source facts still hold', { skip: skipNoIndexer }, () => {
    const send = readSrc('actions/send.js');
    const utility = readSrc('utility.js');

    assert.match(send, /gated token transfer requires key handoff message/,
        'send.js no longer enforces the key-handoff MESSAGE, so the guide\'s '
        + '"only a direct send carries the key" wording is no longer accurate');

    const others = ['actions/order_match.js', 'actions/dispense.js', 'actions/cross_settle.js']
        .filter((rel) => fs.existsSync(path.join(INDEXER, rel)));
    assert.ok(others.length > 0, 'none of the DEX settlement handlers were found to check');
    for(const rel of others){
        assert.ok(!/requires key handoff message/.test(readSrc(rel)),
            `${rel} now enforces a key handoff. If a settlement path delivers the key, the `
            + 'guide\'s "a buyer on the DEX gets no key" wording must change.');
    }

    const fn = utility.match(/async transferTokenOwnership\([\s\S]*?\n    \}/);
    assert.ok(fn, 'utility.js no longer defines transferTokenOwnership as expected');
    assert.ok(!/MESSAGE/.test(fn[0]),
        'transferTokenOwnership now emits a MESSAGE. If an ownership sale delivers key '
        + 'material, use-cases.md\'s archive bullet must change back.');

    const crossSettle = readSrc('actions/cross_settle.js');
    assert.match(crossSettle, /transferTokenOwnership\(/,
        'cross_settle.js no longer settles an ownership leg locally, which is the fact behind '
        + 'the "each chain hands over its own side" wording');
});

test('the guide scopes ownership-sale atomicity to a single chain', () => {
    const answer = faq.split('\n').find((l) => l.includes('receives the issuer role'));
    assert.ok(answer, 'faq.md no longer carries the issuer-rights sale answer');
    assert.match(answer, /settles on one chain|single-chain/,
        'faq.md again claims an issuer-rights sale settles in a single blockchain transaction '
        + 'without scoping it to one chain. A cross-chain swap settles each leg separately '
        + '(cross_settle.js).');
    assert.match(answer, /cross-chain\.md#residual-risk/,
        'faq.md no longer points at the cross-chain residual-risk section');

    const ownership = section(useCases, '### Token Ownership Trading', 'use-cases.md');
    assert.match(ownership, /single-chain sale/,
        'use-cases.md again calls ownership transfer atomic without scoping it to one chain');
    assert.match(ownership, /cross-chain\.md#residual-risk/,
        'use-cases.md no longer points at the cross-chain residual-risk section');
});

test('the guide does not claim a sale delivers the decryption keys', () => {
    const ownership = section(useCases, '### Token Ownership Trading', 'use-cases.md');
    assert.ok(!/keys, future republish rights, and everything/.test(ownership),
        'use-cases.md again says an ownership sale hands over the archive keys. '
        + 'transferTokenOwnership writes a synthetic ISSUE and no MESSAGE.');
    assert.match(ownership, /direct send/,
        'use-cases.md no longer names the direct send as the separate key-delivery step');

    assert.ok(!/Whoever buys the token automatically receives the decryption key/.test(gated),
        'token-gated-content.md again says any DEX buyer automatically receives the key. '
        + 'send.js is the only handler that requires the handoff MESSAGE.');
    assert.ok(!/Anyone who buys gets the decryption key in the same transaction/.test(gated),
        'token-gated-content.md\'s paid-downloads bullet again says a DISPENSER or ORDER buyer '
        + 'gets the key in the same transaction');
});

/* 5. Cross-chain royalty listings are denied below the flag day. */

test('the cross-chain royalty source facts still hold', { skip: skipNoIndexer }, () => {
    const swap = readSrc('actions/swap.js');
    const order = readSrc('actions/order.js');
    const changes = readSrc('protocol_changes.js');

    for(const [label, src] of [['swap.js', swap], ['order.js', order]]){
        assert.match(src, /royalty not enforceable cross-chain/,
            `${label} no longer denies a royalty-bearing cross-chain listing, so the guide's `
            + 'availability caveat is no longer accurate');
        assert.match(src, /isEnabled\('CROSS_CHAIN_ROYALTY'/,
            `${label} no longer gates that denial on CROSS_CHAIN_ROYALTY`);
    }
    assert.match(changes, /'CROSS_CHAIN_ROYALTY'[^\n]*1798761600/,
        'CROSS_CHAIN_ROYALTY no longer activates on mainnet at 1798761600 (2027-01-01); the '
        + 'date the guide prints must move with it');
});

test('the cross-chain guide carries the royalty availability caveat', () => {
    const pairs = section(crossChain, '## Available Pairs', 'cross-chain.md');
    assert.match(pairs, /royalty not enforceable cross-chain/,
        'cross-chain.md "Available Pairs" no longer names the rejection a royalty-bearing '
        + 'cross-chain listing gets at create');
    assert.match(pairs, /CROSS_CHAIN_ROYALTY/,
        'cross-chain.md "Available Pairs" no longer names the flag day that lifts the restriction');
    // Deliberately NOT the date itself: flag-day-literals.test.js forbids quoting a
    // flag-day value in prose, because a repin would rot it. Assert the link instead.
    assert.match(pairs, /protocol\/flag-days\.md/,
        'cross-chain.md "Available Pairs" no longer links to the flag-day table, which is where '
        + 'the activation date is allowed to live');
});

test('the NFT standard does not claim the rails have no special cases', () => {
    assert.ok(!/All existing rails apply to NFT-pattern tokens with no special cases/.test(nft),
        'nft-standard.md again claims the rails apply with no special cases, while a '
        + 'royalty-bearing cross-chain listing is denied at create');
    assert.match(nft, /CROSS_CHAIN_ROYALTY/,
        'nft-standard.md no longer names the cross-chain royalty exception anywhere');
});

/* 6. A fee output is required only when a fee is actually owed. */

test('the zero-fee source facts still hold', { skip: skipNoIndexer }, () => {
    const bet = readSrc('actions/bet.js');
    const utility = readSrc('utility.js');

    assert.match(bet, /if\(!error && this\.util\.bcgt\(fees\['AMOUNT'\], 0\)\)\{\s*\n\s*let paymentMode/,
        'bet.js no longer resolves the fee payment mode only when the computed fee is above '
        + 'zero, so a free-window market may now need a fee output after all');
    assert.match(bet, /getUnifiedDurationFee\(data\['EXPIRE_AT'\]/,
        'bet.js no longer prices market creation on the duration schedule');
    assert.match(utility, /chargeableDays[\s\S]{0,200}if\(this\.bcgt\(chargeableDays, 0\)\)/,
        'getUnifiedDurationFee no longer charges nothing inside the free-day window');
});

test('the betting guide ties the fee-output requirement to a fee being owed', () => {
    assert.ok(!/a market created, or a bet placed, without a native-coin fee output is rejected/.test(betting),
        'betting.md again says any market create or bet place without a native-coin fee output '
        + 'is rejected. bet.js validates payment only when the fee is above zero, and a market '
        + 'inside the free window owes nothing.');
    assert.match(betting, /an action that owes a fee/,
        'betting.md no longer conditions the native-coin fee-output requirement on a fee '
        + 'actually being owed');
    assert.match(betting, /free window owes nothing/,
        'betting.md no longer says a market inside the free window needs no fee output');
});
