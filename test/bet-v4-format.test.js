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

const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const indexer = sibling('xchain-indexer', ['src/protocol_changes/gates_4.js']);

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

// The guide's status sentence must follow the indexer's gate row: a section that
// reads as live while the row is unarmed costs a user the fee of a rejected edit.
test('the user guide states where BET list editing is active, matching the indexer gate row', { skip: indexer.skip }, () => {
    const gates = fs.readFileSync(path.join(indexer.root, 'src/protocol_changes/gates_4.js'), 'utf8');
    const row = gates.match(/addGate\('bet_feed_list_edit_activation\.BET_FEED_LIST_EDIT_ACTIVATION', 'height', \{([^}]*)\}\)/);
    assert.ok(row, 'indexer gates_4.js no longer registers the BET list-edit gate');
    const value = (key) => (row[1].match(new RegExp("(?:^|\\s)'?" + key.replace(':', '\\:') + "'?:\\s*([^,\\s]+)")) || [])[1];
    const production = ['mainnet', 'BTC:testnet', 'LTC:testnet', 'DOGE:testnet', 'testnet'];
    assert.deepEqual(production.map(value), production.map(() => 'UNARMED'),
        'BET_FEED_LIST_EDIT_ACTIVATION was armed somewhere: update the status note in user-guide/betting.md, then this test');
    assert.equal(value('regtest'), '0');
    const guide = read('user-guide/betting.md');
    const section = guide.split('### Editing membership lists')[1].split('\n### ')[0];
    assert.match(section, /List editing is active on regtest only/);
    assert.match(section, /`BET_FEED_LIST_EDIT_ACTIVATION`/);
    assert.match(section, /not active on mainnet or on any testnet/);
    assert.match(section, /\(\.\.\/protocol\/protocol-activation\.md\)/);
});
