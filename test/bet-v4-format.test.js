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

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

require('./action-manifest-wallet-parity.test');

test('the canonical manifest exposes BET format 4', () => {
    const manifest = JSON.parse(read('protocol/action-manifest.json'));
    assert.deepEqual(manifest.actions.BET.userEncodableVersions, [0, 1, 2, 3, 4]);
});

test('the BET protocol specifies format 4 list-edit semantics', () => {
    const bet = read('protocol/actions/bet.md');
    assert.match(bet, /Version `4` - Edit Feed Lists/);
    assert.match(bet, /`VERSION\|FEED_ACTION_INDEX\|ALLOW_LIST\|BLOCK_LIST\|MEMO`/);
    assert.match(bet, /Only the market's creator can edit its list references/);
    assert.match(bet, /market must still be `open`/);
    assert.match(bet, /empty field retains the current list, `0` detaches it, and a positive `ACTION_INDEX` replaces it/);
    assert.match(bet, /affects only bets placed after the edit/);
});

test('the BET list-edit activation is discoverable and described', () => {
    const catalogue = read('protocol/activation-catalogue.md');
    assert.match(
        catalogue,
        /\| `bet_feed_list_edit_activation` \| `BET_FEED_LIST_EDIT_ACTIVATION` \| height \|/,
    );
    const activation = read('protocol/protocol-activation.md');
    assert.match(activation, /bet_feed_list_edit_activation\.BET_FEED_LIST_EDIT_ACTIVATION/);
    assert.match(activation, /introduced unarmed on every network/);
});

test('the SDK and user guide describe the feed-list edit surface', () => {
    const sdk = read('components/sdk/actions.md');
    assert.match(sdk, /\*\*Format v4:\*\* `BET\|4\|FEED_ACTION_INDEX\|ALLOW_LIST\|BLOCK_LIST\|MEMO`/);
    assert.match(sdk, /`editMarketListsParams\(\{\.\.\.\}\)` \| v4/);
    const guide = read('user-guide/betting.md');
    assert.match(guide, /### Editing membership lists/);
    assert.match(guide, /edit applies only to bets placed after it/);
});
