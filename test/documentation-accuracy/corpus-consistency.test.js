/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 *********************************************************************/

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('regtest miner operations document the default mine-empty heartbeat', () => {
  const operations = read('components/regtest-miner/operations.md');
  assert.match(operations, /"idle_mine_interval_ms": 60000/,
    'the status example must show the boot default');
  assert.match(operations, /defaults to `60000` when unset/,
    'the runtime control must explain that the boot heartbeat defaults on');
  assert.doesNotMatch(operations, /only mines when transactions are present/,
    'troubleshooting must not claim an empty mempool stops the default miner');
});

test('hub operations keep heartbeat, ping, and quorum behavior distinct', () => {
  const operations = read('components/hub/operations.md');
  const overview = read('components/hub/README.md');
  const paper = read('whitepaper.md');
  assert.match(operations, /ping\/pong every 30 seconds.*`P2P_WS_PING_INTERVAL`/s,
    'dead-connection detection must use the 30 second ping interval');
  assert.match(operations, /heartbeat broadcast runs every 15 seconds.*`P2P_HEARTBEAT_INTERVAL`/s,
    'the 15 second heartbeat must be documented separately');
  for (const [name, prose] of [['operations', operations], ['overview', overview], ['whitepaper', paper]]) {
    assert.doesNotMatch(prose, /no peers connected[^\n]*direct execution/i,
      `${name} must not turn peer loss into a consensus bypass`);
    assert.match(prose, /isolated[^\n]*(?:cannot|does not)[^\n]*finalize alone/i,
      `${name} must preserve quorum for an isolated federation member`);
  }
});

test('hub configuration marks the removed model override as inert', () => {
  const configuration = read('components/hub/configuration.md');
  assert.doesNotMatch(configuration, /^\| `LLM_DEFAULT_MODEL` \|/m,
    'the removed override must not appear as a live setting');
  assert.match(configuration, /`LLM_DEFAULT_MODEL` was removed and is ignored if set/,
    'operators with stale settings need an explicit removal note');
  assert.match(configuration, /judge model falls back to `claude-haiku-4-5`/,
    'the compiled judge fallback must match the provider spec');
});

test('whitepaper keeps full-node reward activation on the flag-day release path', () => {
  const paper = read('whitepaper.md');
  const paragraph = paper.match(/^\*\*Verified-node reward tier\.\*\*.*$/m);
  assert.ok(paragraph, 'whitepaper must retain the verified-node reward tier paragraph');
  assert.doesNotMatch(paragraph[0], /governance turns it on/i,
    'a governance vote is not the activation lever');
  assert.match(paragraph[0], /not a governance-tunable setting/i,
    'the reward share must be identified as a pinned consensus parameter');
  assert.match(paragraph[0], /FULLNODE\.REWARD_SHARE/,
    'activation must name the pinned reward-share parameter');
  assert.match(paragraph[0], /mints oracle-round rewards/,
    'activation must name the missing reward mint rail');
  assert.match(paragraph[0], /FULLNODE\.GENESIS_VERIFIERS/,
    'activation must name the bootstrap verifier set');
  assert.match(paragraph[0], /future coordinated release.*fleet-wide flag-day height/,
    'activation must happen through a future coordinated flag-day release');
});

test('supply sanity-check docs describe the post-block invariant', () => {
  const componentMap = read('architecture/component-map.md');
  const database = read('architecture/database-design.md');
  const glossary = read('getting-started/key-terms.md');
  for (const [name, prose] of [['component map', componentMap], ['database design', database]]) {
    assert.doesNotMatch(prose, /after (?:each )?issuance/i,
      `${name} must not limit the supply invariant to issuance`);
    assert.match(prose, /After every block/,
      `${name} must place the supply invariant after every block`);
  }
  assert.match(glossary, /\*\*sanity check\*\*: The supply invariant.*after processing every block/,
    'the glossary must define the post-block supply invariant');
  assert.match(glossary, /distinct from per-action validation.*`invalid`/,
    'the glossary must distinguish routine invalid actions from invariant failure');
});
