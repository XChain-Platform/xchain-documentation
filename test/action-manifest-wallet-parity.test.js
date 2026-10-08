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

test('wallet vendored action manifest is byte-identical to canonical', (t) => {
    const wallet = sibling('xchain-wallet', [WALLET_VENDOR], { platformRoot: PLATFORM });
    if (!wallet.have) return t.skip(wallet.skip);

    const vendor = path.join(wallet.root, WALLET_VENDOR);
    const vendorText = fs.readFileSync(vendor, 'utf8');
    const canonicalText = fs.readFileSync(CANONICAL, 'utf8');
    assert.deepEqual(
        JSON.parse(vendorText).actions.BET.userEncodableVersions,
        JSON.parse(canonicalText).actions.BET.userEncodableVersions,
        'xchain-wallet BET versions must match the canonical manifest',
    );
    assert.equal(
        vendorText,
        canonicalText,
        'xchain-wallet/test/fixtures/action-manifest.json must be re-vendored from canonical',
    );
});
