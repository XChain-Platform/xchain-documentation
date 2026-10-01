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
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..');
const TOKEN_BRIDGE = fs.readFileSync(path.join(ROOT, 'protocol', 'token-bridge.md'), 'utf8');
const HUB_API = fs.readFileSync(path.join(ROOT, 'components', 'hub', 'api.md'), 'utf8');

function section(markdown, heading, nextHeading) {
    const start = markdown.indexOf(heading);
    assert.notEqual(start, -1, `missing section ${heading}`);
    const end = markdown.indexOf(nextHeading, start + heading.length);
    assert.notEqual(end, -1, `missing section boundary ${nextHeading}`);
    return markdown.slice(start, end);
}

function assertNames(markdown, page, names) {
    const flattened = markdown.replace(/\s+/g, ' ');
    for (const name of names) {
        assert.ok(flattened.includes(name), `${page} must name ${name}`);
    }
}

test('token bridge documents shared policy references and cross-chain list versions', () => {
    const policy = section(TOKEN_BRIDGE, '## Policy inheritance', '## Cross-chain list versions');
    const versions = section(TOKEN_BRIDGE, '## Cross-chain list versions', '## Reads and surfaces');

    assertNames(policy, 'protocol/token-bridge.md policy inheritance', [
        'LIST_SHARE_PRODUCER_ACTIVATION',
        'LIST_SHARE_CONSUMER_ACTIVATION',
        'XPOLICY_MAX_MEMBERS',
        'gettokenpolicy',
        '<HOME>:<root>',
        'allow_list_ref',
        'block_list_ref',
        '`allow_list`',
        '`block_list`',
        'no new policy snapshot',
        'each chain binds its own mirror',
        'home list itself on the home chain',
        'local or union list keeps the full copy',
    ]);
    assertNames(versions, 'protocol/token-bridge.md cross-chain list versions', [
        'list_snapshots',
        'Version `1`',
        '`members_hash`',
        '`seq` order',
        'signed admission height for every consuming chain',
        'halts the consuming indexer',
        '`ANCHOR` archive carries every version',
        'LIST_SHARE_PRODUCER_ACTIVATION',
        'LIST_SHARE_CONSUMER_ACTIVATION',
    ]);
});

test('hub API documents list snapshots, shared-list reads, and list fees', () => {
    const sync = section(HUB_API, '## Hub DB Sync (REST + WebSocket)', '### `getcapabilitythresholds`');
    const reads = section(HUB_API, '## Shared Lists (indexer endpoints)', '## Fee Quotes');
    const fees = section(HUB_API, '## Fee Quotes', '## Cross-Chain Attestations');

    assertNames(sync, 'components/hub/api.md Hub DB Sync', [
        'GET /hub-db/snapshot/list_snapshots',
        '`list_snapshots`',
        '`heights`',
        '`schema_version`',
        '`btc_chain_id`',
    ]);
    assertNames(reads, 'components/hub/api.md shared-list endpoints', [
        '`getlistat`',
        '`getsharedlists`',
        '`getsharedlist`',
        '`gettokenpolicy`',
        '`snapshot_block`',
        '`allow_list_ref`',
        '`block_list_ref`',
        '`LIST_SHARE_PRODUCER_ACTIVATION`',
        '<HOME>:<root>',
    ]);
    assertNames(fees, 'components/hub/api.md fee quotes', [
        '`getfeequote`',
        '`LIST_SHARE`',
        '`LIST_SHARED_EDIT_BASE`',
        '`LIST_SHARED_EDIT_PER_ITEM`',
    ]);
});
