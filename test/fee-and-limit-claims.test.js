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
 * Cross-repo drift lint for three consensus numbers the guides restate in prose.
 *
 * Each of these was found stated wrongly or not at all, and each is a number a
 * user pays or hits:
 *
 *   - OWNERSHIP_ESCROW, the flat premium an ORDER/SWAP/DISPENSER create pays
 *     when it escrows a tick's ownership. The fee pages priced listings as
 *     duration-only, so an ownership listing inside the 90-day free window read
 *     as free when it costs 0.5 XCHAIN.
 *   - TICK_CHARACTERS, which the indexer enforces as an ALLOWLIST. Three pages
 *     restated it as a short denylist, and the SDK page listed a backslash as
 *     legal when neither the indexer nor the SDK regex accepts one.
 *   - MIN/MAX_BET_REFUND_WINDOW and MAX_BETS_PER_FEED, both enforced and both
 *     absent from the betting guide.
 *
 * The values live in sibling repos, not in this one, so they are read as source
 * and parsed with a regex, the same convention protocol-constant-claims.test.js
 * and action-activation-model.test.js already use: the assertion SKIPS when the
 * sibling checkout is absent rather than failing.
 *
 * Prose is compared with whitespace and backticks stripped, because the same set
 * is rendered spaced on one page and unspaced on another. Stripping whitespace
 * does NOT hide a stray character: a backslash inside the allowed set survives
 * normalization and fails the containment check, which is precisely the defect
 * this file was written after.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');

const ROOT    = path.resolve(__dirname, '..');
const INDEXER = path.resolve(ROOT, '../xchain-indexer/src');

const CONFIG_JS = path.join(INDEXER, 'config.js');
const COIN_JS   = ['BTC', 'LTC', 'DOGE'].map((c) => [c, path.join(INDEXER, 'coins', `${c}.js`)]);

const haveConfig = fs.existsSync(CONFIG_JS);
const haveCoins  = COIN_JS.every(([, p]) => fs.existsSync(p));

const readDoc  = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const normalize = (s) => s.replace(/[\s`]/g, '');

// Pull `config['NAME'] = <value>` out of the indexer config source.
function configValue(src, name) {
    const m = new RegExp(`config\\[["']${name}["']\\]\\s*=\\s*'?([^;']+)'?\\s*;`).exec(src);
    assert.ok(m, `${name} assignment not found in xchain-indexer/src/config.js; `
        + 'the declaration shape changed, re-point this regex');
    return m[1].trim();
}

// Pull `NAME: <number>,` out of a per-chain gas schedule.
function scheduleValue(src, name, where) {
    const m = new RegExp(`${name}\\s*:\\s*'?([0-9.]+)'?\\s*,`).exec(src);
    assert.ok(m, `${name} not found in ${where}; the schedule shape changed, re-point this regex`);
    return m[1];
}

test('the ownership-escrow premium the fee docs quote matches the gas schedule',
    { skip: !haveCoins && 'sibling xchain-indexer not present in this checkout' }, () => {
        const escrow = new Map();
        const price  = new Map();
        for (const [coin, file] of COIN_JS) {
            const src = fs.readFileSync(file, 'utf8');
            escrow.set(coin, scheduleValue(src, 'OWNERSHIP_ESCROW', `xchain-indexer/src/coins/${coin}.js`));
            price.set(coin, scheduleValue(src, 'GAS_PRICE', `xchain-indexer/src/coins/${coin}.js`));
        }

        // The docs claim one figure for all three chains; that only holds while
        // the three schedules agree, so assert the premise before the number.
        assert.deepStrictEqual([...new Set(escrow.values())], [escrow.get('BTC')],
            `OWNERSHIP_ESCROW differs per chain (${JSON.stringify([...escrow])}), but concepts/gas.md and `
            + 'user-guide/trading.md both state a single figure for every chain. Split the prose per chain.');
        assert.deepStrictEqual([...new Set(price.values())], [price.get('BTC')],
            `GAS_PRICE differs per chain (${JSON.stringify([...price])}), so a single XCHAIN figure cannot be quoted`);

        const gas   = Number(escrow.get('BTC'));
        const xchain = gas * Number(price.get('BTC'));
        const gasStr = gas.toLocaleString('en-US');            // 50000 -> "50,000"
        const xchStr = String(Number(xchain.toFixed(8)));      // 0.5

        for (const rel of ['concepts/gas.md', 'user-guide/trading.md']) {
            const doc = readDoc(rel);
            assert.ok(/[Oo]wnership-escrow premium/.test(doc),
                `${rel} never names the ownership-escrow premium, but an ownership create pays `
                + `${gasStr} gas on top of the duration fee`);
            assert.ok(doc.includes(gasStr),
                `${rel} states the ownership-escrow premium but not ${gasStr} gas (indexer OWNERSHIP_ESCROW)`);
            assert.ok(doc.includes(xchStr),
                `${rel} does not carry the ${xchStr} XCHAIN figure ${gasStr} gas works out to at `
                + `GAS_PRICE ${price.get('BTC')}`);
        }
    });

// Every page that restates the ticker character set, and must therefore restate
// it exactly. protocol/actions/issue.md and components/indexer/configuration.md
// were already correct and are pinned here so they stay that way.
const TICK_SET_PAGES = [
    'user-guide/creating-tokens.md',
    'getting-started/key-terms.md',
    'components/sdk/actions.md',
    'components/indexer/configuration.md',
    'protocol/actions/issue.md',
];

test('every page restating the ticker character set matches TICK_CHARACTERS',
    { skip: !haveConfig && 'sibling xchain-indexer not present in this checkout' }, () => {
        const chars = configValue(fs.readFileSync(CONFIG_JS, 'utf8'), 'TICK_CHARACTERS');
        const tail  = chars.slice(chars.indexOf('0123456789') + '0123456789'.length);
        assert.ok(tail.length > 4,
            `could not split the punctuation tail off TICK_CHARACTERS (${chars}); the constant's shape changed`);

        const bad = [];
        for (const rel of TICK_SET_PAGES) {
            if (!normalize(readDoc(rel)).includes(tail)) bad.push(`${rel} does not state the set "${tail}"`);
        }
        assert.deepStrictEqual(bad, [],
            'these pages state a ticker character set that disagrees with the indexer\'s TICK_CHARACTERS '
            + 'allowlist (a stray or missing character, e.g. a backslash, fails here):\n' + bad.join('\n'));
    });

test('the betting guide states the enforced refund-window bounds and per-market bet cap',
    { skip: !haveConfig && 'sibling xchain-indexer not present in this checkout' }, () => {
        const src = fs.readFileSync(CONFIG_JS, 'utf8');
        const min = Number(configValue(src, 'MIN_BET_REFUND_WINDOW'));
        const max = Number(configValue(src, 'MAX_BET_REFUND_WINDOW'));
        const cap = Number(configValue(src, 'MAX_BETS_PER_FEED'));

        // The guide is written for non-technical readers, so it spells the two
        // bounds in words. Derive the words from the seconds rather than pinning
        // the prose, so a config change to e.g. 7200 fails here instead of
        // leaving "1 hour" silently wrong.
        assert.strictEqual(min, 3600,
            `MIN_BET_REFUND_WINDOW is now ${min}s; user-guide/betting.md says "1 hour". Update the prose.`);
        assert.strictEqual(max, 31536000,
            `MAX_BET_REFUND_WINDOW is now ${max}s; user-guide/betting.md says "1 year". Update the prose.`);

        const guide = readDoc('user-guide/betting.md');
        assert.ok(/from 1 hour to 1 year/.test(guide),
            'user-guide/betting.md does not give the resolve-window bounds, but a market outside '
            + `${min}..${max} seconds is rejected with "invalid: REFUND_WINDOW (range)"`);
        assert.ok(guide.includes(cap.toLocaleString('en-US')),
            `user-guide/betting.md does not state the ${cap.toLocaleString('en-US')} open-bet cap, but a bet on a `
            + 'full market is rejected with "invalid: FEED_ACTION_INDEX (feed full)"');
        assert.ok(readDoc('protocol/actions/bet.md').includes(String(cap)),
            `protocol/actions/bet.md no longer states the ${cap} bet cap it is the reference for`);
    });
