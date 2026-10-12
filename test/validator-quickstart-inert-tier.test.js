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
 * The full-node tier in the validator quickstart.
 *
 * WHY. The indexer ships the full-node tier inert: FULLNODE.REWARD_SHARE is '0'
 * and GENESIS_VERIFIERS is empty on mainnet and testnet. The validator guides
 * said so, but the quickstart listed full-node proof as a level a 2,000 stake
 * qualifies for, with nothing saying it earns nothing yet.
 *
 * The prose side runs unconditionally; the source side skips by name when the
 * xchain-indexer sibling is absent.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const BTC_REL = 'src/coins/BTC.js';
const indexer = sibling('xchain-indexer', [BTC_REL]);
const quickstart = fs.readFileSync(path.join(DOC_ROOT, 'getting-started', 'quickstart-validator.md'), 'utf8');

test('the quickstart marks the full-node level as not active yet', () => {
    const row = quickstart.split('\n').find((l) => l.startsWith('| Full-node proof'));
    assert.ok(row, 'quickstart-validator.md no longer has a "| Full-node proof" table row');
    assert.match(row, /not active yet/,
        'the quickstart full-node row does not say the tier is inactive, so a reader '
        + 'expects income from a tier that ships with a zero reward share');
    assert.match(quickstart, /running-a-validator\.md#rewards-and-what-is-not-live-yet/,
        'the quickstart no longer links the explanation of what is not live yet');
});

test('the indexer still ships the full-node tier inert', { skip: indexer.skip }, () => {
    const btc = fs.readFileSync(path.join(indexer.root, BTC_REL), 'utf8');
    const at = btc.indexOf('FULLNODE: {');
    assert.ok(at >= 0, 'BTC.js no longer declares a FULLNODE block');
    const block = btc.slice(at);
    assert.match(block, /REWARD_SHARE:\s*'0'/,
        'FULLNODE.REWARD_SHARE is no longer \'0\'. If the tier has been activated, the '
        + 'quickstart "not active yet" wording must change in the same commit');
    assert.match(block, /GENESIS_VERIFIERS:\s*\[\]/,
        'FULLNODE.GENESIS_VERIFIERS is no longer empty, so the tier may have an initial verifier set');
});
