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
 * Explorer route codes in the regtest guide's debugging section.
 *
 * WHY. The regtest guide's "Check the Explorer API" commands queried /BTC/,
 * the Bitcoin mainnet route code, on a bitcoin regtest stack. The same page
 * and the explorer API reference both give RBTC as the regtest code, so the
 * commands meant to diagnose a local chain read a different coin.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const GUIDE = path.join(DOC_ROOT, 'developer-guide', 'regtest-development.md');

// Return the body of the guide's "Check the Explorer API" subsection.
function explorerApiSection(markdown){
    const match = markdown.match(/### Check the Explorer API\n([\s\S]*?)(?=\n### |\n## )/);
    assert.ok(match, 'regtest-development.md lost its Check the Explorer API section');
    return match[1];
}

test('the regtest debugging curls use a regtest route code', () => {
    const section = explorerApiSection(fs.readFileSync(GUIDE, 'utf8'));
    const codes = [...section.matchAll(/localhost:18080\/([A-Za-z]+)\/api\//g)].map((m) => m[1]);
    assert.ok(codes.length >= 3, `found only ${codes.length} explorer calls; the parse broke`);
    const wrong = codes.filter((c) => !c.toUpperCase().startsWith('R'));
    assert.deepStrictEqual(wrong, [],
        'the regtest debugging section queries a mainnet or testnet route code; '
        + 'regtest coins route as RBTC, RLTC and RDOGE');
});
