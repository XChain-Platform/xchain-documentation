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

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const api = read('components', 'encoder', 'api.md');
const registry = read('protocol', 'error-codes.md');

const section = api.slice(api.indexOf('### `broadcast_tx`'), api.indexOf('### `get_utxos`'));

test('the broadcast_tx section documents both node-verdict reasons and node_code', () => {
  assert.match(section, /`-32010`/);
  assert.match(section, /`NODE_REJECTED`/);
  assert.match(section, /`TX_ALREADY_IN_CHAIN`/);
  assert.match(section, /`node_code`/);
});

test('the broadcast_tx section keeps transport faults on -32603', () => {
  assert.match(section, /transport fault[^.]*`-32603`/);
});

test('the registry rows carry both reasons and name broadcast_tx', () => {
  for (const reason of ['NODE_REJECTED', 'TX_ALREADY_IN_CHAIN']) {
    const row = registry.split('\n').find((l) => l.startsWith(`| \`${reason}\``));
    assert.ok(row, `${reason} has a registry row`);
    assert.match(row, /broadcast_tx/);
    assert.match(row, /node_code/);
  }
  assert.match(registry, /`create_envelope_cancel_tx`, `broadcast_tx`/);
});
