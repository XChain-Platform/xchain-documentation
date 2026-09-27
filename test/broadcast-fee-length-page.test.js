/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
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

const page = fs.readFileSync(
  path.join(__dirname, '..', 'protocol', 'actions', 'broadcast.md'),
  'utf8',
);

test('the BROADCAST page documents the gated FEE length rule', () => {
  assert.match(page, /`BROADCAST_FEE_LENGTH`/);
  assert.match(page, /\[Flag-Day Values\]\(\.\.\/flag-days\.md\)/);
  assert.match(page, /`invalid: FEE \(length\)`/);
});
