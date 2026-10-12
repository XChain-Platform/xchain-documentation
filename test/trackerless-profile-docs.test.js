/* SPDX-License-Identifier: AGPL-3.0-or-later */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const PAGE_PATH = 'components/utxo-tracker/trackerless-profile.md';
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const page = read(PAGE_PATH);

test('component indexes link the remote tracker contract', () => {
  assert.match(read('components/utxo-tracker/README.md'), /\[Remote Tracker Profile\]\(trackerless-profile\.md\)/);
  assert.match(read('components/encoder/README.md'), /\[Remote Tracker Profile\]\(\.\.\/utxo-tracker\/trackerless-profile\.md\)/);
});

test('the contract names every tracker and encoder endpoint in the profile path', () => {
  for (const endpoint of ['get_sync_status', 'get_utxos', 'get_tx_block', 'create_tx', 'health', 'GET /status']) {
    assert.ok(page.includes(`\`${endpoint}\``), `${PAGE_PATH} is missing ${endpoint}`);
  }
  assert.match(page, /`ping` only proves/);
});

test('the contract defines the freshness payload and decision fields', () => {
  const fields = [
    'committed_height', 'tracker_height', 'node_height', 'lag', 'synced',
    'mempool_ready', 'halted', 'halt_reason', 'reorg_count',
  ];
  for (const field of fields) {
    assert.ok(page.includes(`| \`${field}\` |`), `${PAGE_PATH} is missing the ${field} field row`);
  }
  assert.match(page, /`lag` \| `node_height - tracker_height`/);
  assert.match(page, /negative value means the tracker is ahead/);
  assert.match(page, /refusal order is significant: halted, stale, then mempool not ready/);
  assert.match(page, /remote `create_tx` path refuses the same status as `UTXO_TRACKER_SYNC_MISSING`/);
});

test('the contract pins the complete typed tracker error set', () => {
  const errors = [
    'UTXO_TRACKER_NOT_CONFIGURED',
    'UTXO_TRACKER_UNREACHABLE',
    'UTXO_TRACKER_SYNC_MISSING',
    'UTXO_TRACKER_HALTED',
    'UTXO_TRACKER_STALE',
    'UTXO_TRACKER_NOT_READY',
  ];
  for (const code of errors) {
    assert.ok(page.includes(`| \`${code}\` |`), `${PAGE_PATH} is missing ${code}`);
  }
  assert.match(page, /code `-32010`/);
  assert.match(page, /`error\.data\.reason`/);
  assert.match(page, /`error\.xchainCode`/);
});

test('the contract states profile configuration, Pi-class state, and scope limits', () => {
  for (const setting of [
    'UTXO_TRACKER_PROFILE=remote',
    'UTXO_TRACKER_URL',
    'UTXO_TRACKER_API_PORT',
    'UTXO_TRACKER_MAX_LAG_BLOCKS',
  ]) {
    assert.ok(page.includes(setting), `${PAGE_PATH} is missing ${setting}`);
  }
  assert.match(page, /Pi-class application host/);
  assert.match(page, /does not eliminate serving state/);
  assert.match(page, /non-empty caller-supplied `utxos` array bypasses tracker fetching/);
  assert.match(page, /P2SH or P2WSH reveal/);
  assert.match(page, /Freshness is not authenticity/);
});
