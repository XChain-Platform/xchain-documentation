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
const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const issue = readDoc('protocol/actions/issue.md');
const nft = readDoc('protocol/nft-standard.md');
const sdkDocs = readDoc('components/sdk/nft-and-registry.md');
const indexer = sibling('xchain-indexer', ['src/actions/mint/validate.js']);
const sdk = sibling('xchain-sdk', ['src/actions/nft.js']);

function premintedExamples() {
    return nft.split('\n').filter((line) => /^ISSUE\|0\|PEPE(?:CREATURE|PRINT)\|/.test(line));
}

test('MAX_MINT is documented as a cap rather than a public-mint switch', () => {
    assert.doesNotMatch(issue, /MAX_SUPPLY` and `MAX_MINT`[^\n]+to enable user minting/);
    assert.match(issue, /empty or `0` means no per-transaction cap/);
    assert.match(issue, /public `MINT` is open to any address/i);
});

test('pre-minted NFT examples close both mint paths', () => {
    const examples = premintedExamples();
    assert.equal(examples.length, 2);
    for (const action of examples) {
        const fields = action.split('|');
        assert.equal(fields.length, 25, action);
        assert.equal(fields[23], '1', action + ' does not set LOCK_MINT');
        assert.equal(fields[24], '1', action + ' does not set LOCK_MINT_SUPPLY');
    }
    assert.match(nft, /any address[^\n]+headroom[^\n]+DESTROY/i);
    const checklist = nft.slice(nft.indexOf('## What a collector should verify'));
    assert.match(checklist, /LOCK_MINT[^\n]+any address/i);
});

test('SDK documentation states that current pre-minted builders leave public mint open', () => {
    assert.match(sdkDocs, /pre-minted builders[^\n]+leave `LOCK_MINT` unset/i);
    assert.match(nft, /SDK[^\n]+leave `LOCK_MINT` unset/i);
});

test('the indexer source still implements the documented public-mint rule', {
    skip: indexer.skip,
}, () => {
    const source = fs.readFileSync(path.join(indexer.root, 'src/actions/mint/validate.js'), 'utf8');
    assert.match(source, /tokenInfo\['LOCK_MINT'\]\s*==\s*1/);
    assert.match(source, /bcgt\(data\['MAX_MINT'\],\s*0\)/);
});

test('the SDK source still leaves the pre-minted lock decision to callers', {
    skip: sdk.skip,
}, () => {
    const source = fs.readFileSync(path.join(sdk.root, 'src/actions/nft.js'), 'utf8');
    assert.doesNotMatch(source, /lockMint\s*:/);
    assert.doesNotMatch(source, /lockMintSupply\s*:/);
});
