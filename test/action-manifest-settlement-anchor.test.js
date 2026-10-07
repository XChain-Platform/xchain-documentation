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

const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'protocol', 'action-manifest.json'), 'utf8'));
const DOC = fs.readFileSync(path.join(__dirname, '..', 'protocol', 'action-manifest.md'), 'utf8');
const ANCHORS = ['LIST_SHARE', 'XPOLICY'];

test('settlement-anchor category is declared', () => {
    assert.equal(typeof MANIFEST.categories['settlement-anchor'], 'string');
});

test('XPOLICY and LIST_SHARE are explorerRender-only settlement anchors', () => {
    for (const name of ANCHORS) {
        assert.deepEqual(MANIFEST.actions[name], { category: 'settlement-anchor', explorerRender: true }, name);
    }
});

test('settlement-anchor category holds exactly the two anchors', () => {
    const members = Object.keys(MANIFEST.actions).filter((n) => MANIFEST.actions[n].category === 'settlement-anchor').sort();
    assert.deepEqual(members, ANCHORS);
});

test('the doc names the category', () => {
    assert.match(DOC, /settlement-anchor/);
});
