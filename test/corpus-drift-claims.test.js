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
 * Drift lint for seven more cross-page claims the corpus contradicted itself
 * about. Each block pins the corrected wording and carries a falsification
 * that feeds the stale wording back in, so a guard that matches nothing
 * fails rather than passing quietly.
 *
 * WHY, per claim:
 *
 *   1. Two-transaction broadcast. The reveal spends the funding output, so
 *      the node needs the funding transaction first, but nothing waits for a
 *      confirmation, and the taproot envelope spec says no implementation may
 *      assume a gap. A page that says "only after the funding transaction
 *      confirms" tells integrators to add a wait the protocol rules out.
 *
 *   2. Whitepaper Store column. The explorer writes its own hub-mirror schema
 *      under self_sync and sync writes replica databases. A "none" Store cell
 *      leads an operator to provision a read-only user.
 *
 *   3. UTXO tracker undo window. Litecoin testnet defaults to 5000 blocks.
 *      Pages saying "120 for every coin" invite an operator to pin 120 and
 *      shrink that window about 40 times.
 *
 *   4. Hub price sources. Coinbase is a third keyless source beside CoinGecko
 *      and Kraken. A lineup without it sends an operator chasing a dead
 *      source to the wrong hosts.
 *
 *   5. Dispenser expiry. Expiry closes an open dispenser in the block whose
 *      block time passes EXPIRATION; only cancellation has a close window.
 *
 *   6. Indexer GAS_SCHEDULE example. The example keys and values must be
 *      real coin-file keys, or a developer prices EXECUTE ten times too high.
 *
 *   7. Mobile store trading disclosure. Both mobile store builds ship their
 *      trading screens. Each runbook needs review text that states the custody,
 *      matching and fiat boundaries, and must not restore the older claim that
 *      the exchange was compiled out.
 *
 * Claims that read a sibling checkout SKIP when it is absent, the same
 * convention corpus-consistency-claims.test.js uses.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT    = path.resolve(__dirname, '..');
const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const offendingLines = (markdown, pattern) =>
    markdown.split('\n').filter((line) => pattern.test(line)).map((line) => line.trim());

/* ---------------------------------------------------------------- claim 1 */

const BROADCAST_PAGES = ['architecture/data-pipeline.md', 'concepts/encoding.md', 'concepts/gas.md'];
const CONFIRM_WAIT = /(reveal|spend)[^.|\n]{0,80}\bonly after\b[^.|\n]{0,60}\bconfirm/i;

test('no page makes the reveal wait for the funding transaction to confirm', () => {
    for (const rel of BROADCAST_PAGES) {
        assert.deepEqual(offendingLines(readDoc(rel), CONFIRM_WAIT), [], rel);
    }
});

test('falsification: the confirmation-wait sentence is caught', () => {
    const stale = 'the reveal transaction is broadcast only after the funding transaction confirms.';
    assert.equal(offendingLines(stale, CONFIRM_WAIT).length, 1);
});

/* ---------------------------------------------------------------- claim 2 */

function storeCell(markdown, service) {
    const row = new RegExp(String.raw`^\|\s*\*\*${service}\*\*\s*\|[^|\n]*\|([^|\n]*)\|`, 'm').exec(markdown);
    assert.ok(row, `whitepaper.md has no ${service} row in the service table`);
    return row[1].trim();
}

function assertStoresNamed(markdown) {
    for (const service of ['explorer', 'sync']) {
        const cell = storeCell(markdown, service);
        assert.notEqual(cell.toLowerCase(), 'none', `${service} writes MariaDB but its Store cell says none`);
        assert.match(cell, /MariaDB/, `${service} Store cell "${cell}" names no MariaDB store`);
    }
}

test('the whitepaper service table names the explorer and sync stores', () => {
    assertStoresNamed(readDoc('whitepaper.md'));
});

test('falsification: a "none" Store cell for sync is caught', () => {
    const page = readDoc('whitepaper.md');
    const stale = page.replace(/^(\|\s*\*\*sync\*\*\s*\|[^|\n]*\|)[^|\n]*\|/m, '$1 none |');
    assert.notEqual(stale, page, 'the sync row moved; re-point this falsification');
    assert.throws(() => assertStoresNamed(stale));
});

/* ---------------------------------------------------------------- claim 3 */

const WINDOW_PAGES = [
    'architecture/component-map.md', 'architecture/database-design.md', 'concepts/security-model.md',
    'components/utxo-tracker/README.md', 'components/utxo-tracker/architecture.md',
    'components/utxo-tracker/configuration.md', 'components/utxo-tracker/operations.md',
    'operations/reorg-handling.md', 'whitepaper.md',
];
const FLAT_TESTNET = /testnet:?\s*`?120`?\s*(blocks\s*)?for every coin|^\|\s*testnet\s*\|\s*120\s*\|\s*120\s*\|/i;
const noTracker = sibling('xchain-utxo-tracker', ['src/chain/undo_blocks.js']).skip;

test('no page gives every testnet the same 120-block undo window', () => {
    for (const rel of WINDOW_PAGES) {
        assert.deepEqual(offendingLines(readDoc(rel), FLAT_TESTNET), [], rel);
    }
});

test('falsification: the flat testnet window wording is caught', () => {
    assert.equal(offendingLines('BTC 12 / LTC 120; testnet: 120 blocks for every coin; overridable', FLAT_TESTNET).length, 1);
    assert.equal(offendingLines('| testnet | 120 | 120 | 120 |', FLAT_TESTNET).length, 1);
});

test('the litecoin testnet window the whitepaper publishes equals the tracker default',
    { skip: noTracker }, () => {
        const src = fs.readFileSync(
            path.join(sibling('xchain-utxo-tracker').root, 'src/chain/undo_blocks.js'), 'utf8');
        const m = /\bLTC_TESTNET:\s*(\d+)/.exec(src);
        assert.ok(m, 'undo_blocks.js declares no LTC_TESTNET window; re-point this regex');
        const row = /^\|\s*utxo-tracker reorg undo window\s*\|([^|\n]*)\|/m.exec(readDoc('whitepaper.md'));
        assert.ok(row, 'whitepaper.md has no utxo-tracker undo window row');
        assert.match(row[1], new RegExp(String.raw`testnet[^;|]*\bLTC ${m[1]}\b`),
            `the tracker's LTC testnet default is ${m[1]}, but the whitepaper reads "${row[1].trim()}"`);
    });

/* ---------------------------------------------------------------- claim 4 */

const PRICE_PAGES = [
    'architecture/component-map.md', 'architecture/data-pipeline.md', 'components/hub/README.md',
    'components/hub/architecture.md', 'components/hub/configuration.md',
    'components/hub/decentralization.md', 'components/hub/operations.md', 'protocol/actions/price.md',
];
const noHubFetcher = sibling('xchain-hub', ['src/oracle/price_fetcher.js']).skip;

const lineupWithoutCoinbase = (markdown) => offendingLines(markdown, /CoinGecko/)
    .filter((line) => /Kraken/.test(line) && !/Coinbase/i.test(line));

test('every hub price-source lineup names Coinbase', () => {
    for (const rel of PRICE_PAGES) {
        assert.deepEqual(lineupWithoutCoinbase(readDoc(rel)), [], rel);
    }
});

test('falsification: a two-source keyless lineup is caught', () => {
    assert.equal(lineupWithoutCoinbase('fetch from CoinGecko and Kraken (CoinMarketCap optional)').length, 1);
});

test('the hub fetcher still runs Coinbase as a keyless source', { skip: noHubFetcher }, () => {
    const src = fs.readFileSync(path.join(sibling('xchain-hub').root, 'src/oracle/price_fetcher.js'), 'utf8');
    assert.match(src, /key:\s*'coinbase',[^}]*requiresKey:\s*null/,
        'Coinbase is no longer a keyless PRICE_SOURCES entry; update the hub price-source pages');
});

/* ---------------------------------------------------------------- claim 5 */

const EXPIRY_DELAY = /`EXPIRATION`[^.\n]{0,60}\b(block delay|close delay|after a set)/i;

test('the dispenser page gives expiry no close delay', () => {
    const page = readDoc('protocol/actions/dispenser.md');
    assert.deepEqual(offendingLines(page, EXPIRY_DELAY), []);
    assert.match(page, /`EXPIRATION` is a Unix timestamp compared against block time/);
});

test('falsification: the block-delay expiry note is caught', () => {
    const stale = '- `EXPIRATION` begins the process of closing a dispenser after a set block delay';
    assert.equal(offendingLines(stale, EXPIRY_DELAY).length, 1);
});

/* ---------------------------------------------------------------- claim 6 */

const noIndexerBtc = sibling('xchain-indexer', ['src/coins/BTC.js']).skip;

function gasExampleCell(markdown) {
    const row = /^\|\s*`GAS_SCHEDULE`\s*\|[^|\n]*\|\s*`\{([^}`]*)\}`\s*\|/m.exec(markdown);
    assert.ok(row, 'indexer configuration.md has no GAS_SCHEDULE example cell');
    return [...row[1].matchAll(/([A-Z_]+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]);
}

function assertGasExample(markdown, coinFile) {
    const pairs = gasExampleCell(markdown);
    assert.ok(pairs.length > 0, 'the GAS_SCHEDULE example names no keys');
    const block = /GAS_SCHEDULE:\s*\{([\s\S]*?)\n\s*\},/.exec(coinFile);
    assert.ok(block, 'BTC.js declares no GAS_SCHEDULE block; re-point this regex');
    for (const [key, value] of pairs) {
        const m = new RegExp(String.raw`^\s*${key}:\s*(\d+)`, 'm').exec(block[1]);
        assert.ok(m, `the GAS_SCHEDULE example names ${key}, which BTC.js does not declare`);
        assert.equal(Number(m[1]), value, `the example gives ${key} ${value}; BTC.js says ${m[1]}`);
    }
}

const btcCoinFile = () => fs.readFileSync(path.join(sibling('xchain-indexer').root, 'src/coins/BTC.js'), 'utf8');

test('the GAS_SCHEDULE example matches the BTC coin file', { skip: noIndexerBtc }, () => {
    assertGasExample(readDoc('components/indexer/configuration.md'), btcCoinFile());
});

test('falsification: the stale EXECUTE example is caught', { skip: noIndexerBtc }, () => {
    const stale = '| `GAS_SCHEDULE` | x | `{ DEPLOY: 100000, EXECUTE: 10000, STAKE: 5000, ... }` |';
    assert.throws(() => assertGasExample(stale, btcCoinFile()));
});

/* ---------------------------------------- mobile store trading disclosure */

const TRADING_NOTES_HEADING = '### Review notes: trading screens';
const COMPILED_OUT_EXCHANGE = /exchange[^.\n]{0,100}compil(?:e|es|ed)[^.\n]{0,60}out|compil(?:e|es|ed)[^.\n]{0,100}exchange[^.\n]{0,60}out|compil(?:e|es|ed)[^.\n]{0,60}out[^.\n]{0,100}exchange/i;

function assertTradingDisclosure(markdown) {
    assert.match(markdown, /^### Review notes: trading screens$/m);
    assert.doesNotMatch(markdown, COMPILED_OUT_EXCHANGE);
    const start = markdown.indexOf(TRADING_NOTES_HEADING);
    const end = markdown.indexOf('\n### ', start + TRADING_NOTES_HEADING.length);
    const notes = markdown.slice(start, end === -1 ? markdown.length : end);
    assert.match(notes, /non-custodial decentralized exchange/i);
    assert.match(notes, /Order matching happens in `xchain-indexer`, not in the app/i);
    assert.match(notes, /no fiat purchase, sale, deposit, or withdrawal path/i);
}

test('falsification: missing notes and compiled-out mobile trading claims are caught', () => {
    const page = readDoc('components/wallet/release/mobile/android-play.md');
    const withoutNotes = page.replace(/^### Review notes: trading screens\n[\s\S]*?(?=^### Graphics$)/m, '');
    assert.notEqual(withoutNotes, page, 'Android trading notes moved; re-point this falsification');
    assert.throws(() => assertTradingDisclosure(withoutNotes));

    const compiledOut = page.replace(
        'The Cryptocurrency exchange answer describes the uploaded artifact rather than\n' +
            'a review-only profile.',
        'The store build compiles the exchange and trading surfaces out entirely.');
    assert.notEqual(compiledOut, page, 'Play declaration text moved; re-point this falsification');
    assert.throws(() => assertTradingDisclosure(compiledOut));
});
