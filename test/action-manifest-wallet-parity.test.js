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

function registryContract(manifest) {
    return {
        aliases: manifest.aliases,
        actions: manifest.actions,
        flags: Object.keys(manifest.flags).sort(),
        categories: Object.keys(manifest.categories).sort(),
    };
}

function assertRegistryParity(vendorText, canonicalText) {
    const vendor = JSON.parse(vendorText);
    const canonical = JSON.parse(canonicalText);
    assert.deepEqual(
        vendor.actions.BET.userEncodableVersions,
        canonical.actions.BET.userEncodableVersions,
        'xchain-wallet BET versions must match the canonical manifest',
    );
    assert.deepEqual(
        registryContract(vendor),
        registryContract(canonical),
        'xchain-wallet action registry must match the canonical manifest',
    );
}

test('wallet vendored action registry matches canonical', (t) => {
    const wallet = sibling('xchain-wallet', [WALLET_VENDOR], { platformRoot: PLATFORM });
    if (!wallet.have) return t.skip(wallet.skip);

    const vendor = path.join(wallet.root, WALLET_VENDOR);
    const vendorText = fs.readFileSync(vendor, 'utf8');
    const canonicalText = fs.readFileSync(CANONICAL, 'utf8');
    assertRegistryParity(vendorText, canonicalText);
});

test('wallet parity comparison rejects action drift', () => {
    const canonicalText = fs.readFileSync(CANONICAL, 'utf8');
    const drifted = JSON.parse(canonicalText);
    drifted.actions.SEND.walletForm = !drifted.actions.SEND.walletForm;
    assert.throws(
        () => assertRegistryParity(JSON.stringify(drifted), canonicalText),
        /action registry must match/,
    );
});

test('wallet parity comparison ignores descriptive metadata drift', () => {
    const canonicalText = fs.readFileSync(CANONICAL, 'utf8');
    const proseOnly = JSON.parse(canonicalText);
    proseOnly.categories['explorer-legacy-render'] = 'stale description';
    assert.doesNotThrow(() => assertRegistryParity(JSON.stringify(proseOnly), canonicalText));
});
