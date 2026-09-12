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

const DOC_ROOT = path.join(__dirname, '..');
const REGISTRY = path.resolve(DOC_ROOT, '../xchain-indexer/src/protocol_changes.js');
const haveRegistry = fs.existsSync(REGISTRY);

describe('XBRIDGE action registration (L9b follow-on)', () => {

    test('protocol_changes.js registers XBRIDGE at all-zero columns',
        { skip: !haveRegistry && 'xchain-indexer not present in this checkout' }, () => {
            const src = fs.readFileSync(REGISTRY, 'utf8');
            const m = src.match(/this\.addChange\(\s*'XBRIDGE'\s*,\s*'([\d.]+)'\s*,([^)]*)\)/);
            assert.ok(m, 'XBRIDGE is not registered in protocol_changes.js');
            const thresholds = m[2].split(',').map((s) => s.trim()).filter((s) => s !== '');
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
