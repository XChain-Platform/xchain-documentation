/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 *********************************************************************/
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PLATFORM_ROOT, sibling } = require('./helpers/sibling_checkout');

const CANONICAL = path.join(__dirname, '..', 'protocol', 'action-manifest.json');
const WALLET_VENDOR = path.join('test', 'fixtures', 'action-manifest.json');
const PLATFORM = process.env.XCHAIN_PLATFORM_ROOT || PLATFORM_ROOT;

test('wallet vendored action manifest matches canonical apart from settlement anchors', (t) => {
    const wallet = sibling('xchain-wallet', [WALLET_VENDOR], { platformRoot: PLATFORM });
    if (!wallet.have) return t.skip(wallet.skip);

    const vendor = path.join(wallet.root, WALLET_VENDOR);
    const canonicalText = fs.readFileSync(CANONICAL, 'utf8');
    const walletRelevant = canonicalText
        .replace(/,\n    "settlement-anchor": "[^"\n]+"\n/, '\n')
        .replace(/    "LIST_SHARE": \{\n      "category": "settlement-anchor",\n      "explorerRender": true\n    \},\n/, '')
        .replace(/,\n    "XPOLICY": \{\n      "category": "settlement-anchor",\n      "explorerRender": true\n    \}\n/, '\n');
    assert.notEqual(walletRelevant, canonicalText, 'canonical manifest must contain settlement anchors');
    assert.equal(
        fs.readFileSync(vendor, 'utf8'),
        walletRelevant,
        'xchain-wallet/test/fixtures/action-manifest.json must match the wallet-relevant canonical entries',
    );
});
