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
 *********************************************************************
 *
 * State hash version claims.
 *
 * WHY. The state hash preimage folds in `state_hash_version`, so a follower
 * built from a page that names the wrong version computes a different digest
 * and halts. The reference implementation's gate registry is the source.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('the whitepaper and block-hashes page name the reference implementation STATE_HASH_VERSION', () => {
    const registry = read('protocol/reference-impl/consensus/gate_registry/shared_rows_3.js');
    const m = registry.match(/addGate\('stateHash\.STATE_HASH_VERSION', 'constant', (\d+)\)/);
    assert.ok(m, 'the reference implementation no longer registers stateHash.STATE_HASH_VERSION');
    const version = m[1];
    const paper = read('whitepaper.md').match(/\(`STATE_HASH_VERSION` (\d+)\)/);
    assert.ok(paper, 'the whitepaper no longer names STATE_HASH_VERSION in its state hash paragraph');
    assert.equal(paper[1], version, 'whitepaper.md names a different STATE_HASH_VERSION than the reference implementation');
    const hashes = read('concepts/block-hashes.md').match(/`state_hash_version` field \(currently `(\d+)`/);
    assert.ok(hashes, 'concepts/block-hashes.md no longer states the current state_hash_version');
    assert.equal(hashes[1], version, 'concepts/block-hashes.md names a different state_hash_version than the reference implementation');
});
