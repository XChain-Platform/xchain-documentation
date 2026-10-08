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
 * The NFT supply guarantee and the cumulative MINT_SUPPLY cap.
 *
 * WHY. LOCK_MAX_SUPPLY freezes the cap, not minting. The ISSUE handler refuses
 * an owner re-ISSUE whose MINT_SUPPLY would take supply past MAX_SUPPLY only
 * at and above the ISSUE_MINT_SUPPLY_CUMULATIVE_CAP gate; below it a locked
 * 1-of-1 could be re-issued to a second unit unless LOCK_MINT_SUPPLY was set.
 * The NFT standard promised the supply could never inflate, unconditionally.
 *
 * The prose side runs unconditionally; the source side skips by name when the
 * xchain-indexer sibling is absent.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { readModuleSource } = require('../lib/indexer-source.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const INDEXER = path.resolve(path.join(__dirname, '..'), '../xchain-indexer/src');
const GATE = 'ISSUE_MINT_SUPPLY_CUMULATIVE_CAP';
const skipNoIndexer = sibling('xchain-indexer',
    [[path.join(INDEXER, 'actions', 'issue.js'), path.join(INDEXER, 'actions', 'issue', 'index.js')]]).skip;
const readDoc = (rel) => fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8');
const nft = readDoc('protocol/nft-standard.md');

test('the cumulative MINT_SUPPLY cap is still gated in the ISSUE handler', { skip: skipNoIndexer }, () => {
    const issue = readModuleSource(path.join(INDEXER, 'actions/issue.js'));
    assert.match(issue, new RegExp(`isEnabled\\('${GATE}'`),
        `the ISSUE handler no longer gates the cumulative cap on ${GATE}; if it is now `
        + 'unconditional, the gate-conditional NFT wording is no longer the accurate one');
    for(const verdict of ['invalid: MINT_SUPPLY exceeds MAX_SUPPLY', 'invalid: MINT_SUPPLY (locked)'])
        assert.ok(issue.includes(`'${verdict}'`), `the ISSUE handler no longer emits ${verdict}`);
});

test('the NFT standard conditions its no-inflation guarantee on the gate', () => {
    assert.ok(!nft.includes('consensus-guaranteed never to inflate'),
        'nft-standard.md again promises supply can never inflate with no activation condition');
    assert.ok(nft.includes(GATE), `nft-standard.md does not name ${GATE}`);
    assert.match(nft, /LOCK_MINT_SUPPLY/,
        'nft-standard.md never names LOCK_MINT_SUPPLY, the lock that holds regardless of the gate');
    assert.match(nft, /\]\(\.\/flag-days\.md\)/, 'nft-standard.md does not link the flag-day page');
});

test('the collector checklist covers tokens older than the gate', () => {
    const at = nft.indexOf('## What a collector should verify');
    assert.ok(at >= 0, 'nft-standard.md no longer has the collector checklist');
    const checklist = nft.slice(at, nft.indexOf('\n## ', at + 1));
    assert.match(checklist, /LOCK_MINT_SUPPLY/,
        'the collector checklist does not tell a buyer how to check a token issued before the gate');
});

test('the ISSUE rules and the creation guide state the cumulative cap', () => {
    const rules = readDoc('protocol/actions/issue.md');
    assert.ok(rules.includes('invalid: MINT_SUPPLY exceeds MAX_SUPPLY'),
        'issue.md does not document the cumulative cap verdict');
    const guide = readDoc('user-guide/creating-tokens.md');
    const bullet = guide.split('\n').find((l) => l.startsWith('- **LOCK_MAX_SUPPLY**:'));
    assert.ok(bullet, 'creating-tokens.md no longer carries a "- **LOCK_MAX_SUPPLY**:" bullet');
    assert.ok(bullet.includes(GATE), `the LOCK_MAX_SUPPLY bullet does not name ${GATE}`);
});
