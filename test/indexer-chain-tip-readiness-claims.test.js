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
 **********************************************************************/

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = fs.readFileSync(path.join(ROOT, 'components/indexer/configuration.md'), 'utf8');
const INDEXER = sibling('xchain-indexer', [
    'src/XChainIndexer/readiness/chain_tip.js',
    'src/XChainIndexer/readiness/verdict.js',
]);

function assertTimingClaims(source) {
    assert.doesNotMatch(source, /A known tip older than this makes readiness fail/);
    assert.match(source, /max\(60 s, 4 x this value\)/);
    assert.match(source, /further `INDEXER_READY_NO_COMMIT_MS`/);
    assert.match(source, /about 11 minutes after its last good read/);
}

test('the configuration reference states both chain-tip readiness windows', () => {
    assertTimingClaims(CONFIG);
});

test('the chain-tip timing claims remain tied to indexer source', {
    skip: INDEXER.skip,
}, () => {
    const tip = fs.readFileSync(path.join(INDEXER.root,
        'src/XChainIndexer/readiness/chain_tip.js'), 'utf8');
    const verdict = fs.readFileSync(path.join(INDEXER.root,
        'src/XChainIndexer/readiness/verdict.js'), 'utf8');
    assert.match(tip, /CHAIN_TIP_STALE_TTLS\s*=\s*4/);
    assert.match(tip, /CHAIN_TIP_MIN_MAX_AGE_MS\s*=\s*60000/);
    assert.match(tip, /Math\.max\(CHAIN_TIP_MIN_MAX_AGE_MS, CHAIN_TIP_STALE_TTLS \* ttlMs\)/);
    assert.match(verdict, /chainTipStaleForMs > noCommitMs/);
});

test('the prose guard rejects the former one-window claim', () => {
    const drifted = CONFIG.replace(/Refresh cadence[^|]+Health reporting only\./,
        'A known tip older than this makes readiness fail with `chain_tip_stale`.');
    assert.throws(() => assertTimingClaims(drifted));
});
