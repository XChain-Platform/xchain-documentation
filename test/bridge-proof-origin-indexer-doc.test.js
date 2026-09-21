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
 **********************************************************************/

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\s+/g, ' ');

const DOCS = [
  'components/indexer/configuration.md',
  'operations/run-a-validator.md',
];

const DIRECTIONAL_REQUIREMENT =
  "Every destination indexer crediting a bridged transfer must have the origin chain's indexer API URL configured as `<COIN>_INDEXER_URL` or `<COIN>_INDEXER_API_URL`.";
const HOLD_BEHAVIOR =
  'Without either URL, that destination holds silently at the bridge proof barrier until the default 900-second (15-minute) hold ceiling; reaching the ceiling can re-drive the wait but never credits an unproven transfer.';

for (const file of DOCS) {
  test(`${file} states the directional origin-indexer bridge proof requirement`, () => {
    const text = read(file);
    assert.ok(
      text.includes(DIRECTIONAL_REQUIREMENT),
      `${file} must state that every crediting destination indexer needs the origin indexer URL`
    );
  });

  test(`${file} states the silent 900-second bridge proof hold`, () => {
    const text = read(file);
    assert.ok(
      text.includes(HOLD_BEHAVIOR),
      `${file} must state that a missing origin URL holds silently at the bridge proof barrier until the 900-second ceiling without crediting`
    );
  });
}
