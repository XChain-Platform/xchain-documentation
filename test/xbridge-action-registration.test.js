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
 * L9b follow-on guard: XBRIDGE landed in protocol/action-manifest.json this
 * wave but was missing from three places the wider suite reads. This file
 * pins the fixes narrowly, so a future edit that removes one of them fails
 * loudly here instead of only in the broader (and much slower) test files
 * this guard is a companion to.
 */
const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = path.join(__dirname, '..');
const REGISTRY = path.resolve(DOC_ROOT, '../xchain-indexer/src/protocol_changes.js');
// Skips by name on a bare clone; throws under XCHAIN_REQUIRE_SIBLINGS=1 when the registry is unreadable.
const indexer = sibling('xchain-indexer', [REGISTRY]);

describe('XBRIDGE action registration (L9b follow-on)', () => {

    test('protocol_changes.js registers XBRIDGE at all-zero columns',
        { skip: indexer.skip }, () => {
            // Read through the class, not a text scan: the row is an array
            // literal in a part file under src/protocol_changes/ now, and this
            // guard asserts the columns' VALUES, which the class already parsed.
            const ProtocolChanges = require(REGISTRY);
            const stub = { config: {}, util: { throwError(message) { throw new Error(message); } } };
            const row = new ProtocolChanges(stub).changes.XBRIDGE;
            assert.ok(row, 'XBRIDGE is not registered in the protocol_changes registry');
            const thresholds = [row.mainnet_time, row.testnet_time, row.regtest_time,
                row.mainnet_block, row.testnet_block, row.regtest_block].map(String);
            assert.deepEqual(thresholds, ['0', '0', '0', '0', '0', '0'],
                'XBRIDGE must be registered at all-zero columns like every other ACTION; ' +
                'its real height gates are XCHAIN_BRIDGE_ACTIVATION / TOKEN_BRIDGE_ACTIVATION, ' +
                'not this registry (the ROLLCALL precedent)');
        });

    test('concepts/actions.md documents an XBRIDGE row', () => {
        const text = fs.readFileSync(path.join(DOC_ROOT, 'concepts/actions.md'), 'utf8');
        assert.match(text, /`XBRIDGE`/, 'concepts/actions.md must name XBRIDGE');
        assert.match(text, /XCHAIN_BRIDGE_ACTIVATION/,
            'concepts/actions.md must name the XBRIDGE activation gate');
    });

    test('the ACTION count claims were bumped from 37/31 to 38/32', () => {
        const overview = fs.readFileSync(path.join(DOC_ROOT, 'overview.md'), 'utf8');
        assert.match(overview, /38 standard ACTIONs/, 'overview.md count claim is stale');
        const sdkActions = fs.readFileSync(path.join(DOC_ROOT, 'components/sdk/actions.md'), 'utf8');
        assert.match(sdkActions, /32 ACTION types/, 'components/sdk/actions.md count claim is stale');
    });
});
