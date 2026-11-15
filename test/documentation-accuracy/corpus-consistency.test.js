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
const { sibling } = require('../helpers/sibling_checkout.js');

const ROOT = path.join(__dirname, '..', '..');
const NODE = sibling('xchain-node', [
  'src/services/module_service/build_and_up.js',
  'src/services/database_service/database_module.js',
  'src/db/index.js',
]);
const SDK = sibling('xchain-sdk', ['package.json']);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertSharedExplorerTopology(markdown) {
  assert.doesNotMatch(markdown, /runs its own[^.\n]*\bexplorer\b|one explorer per chain|decoder, indexer, explorer/i);
  assert.match(markdown, /decoder, indexer, encoder, and UTXO tracker run once per chain\/network/i);
  assert.match(markdown, /hub, explorer, and sync each run as a single shared instance/i);
}

function assertNodeDescription(componentMap, quickstart, regtest) {
  const corpus = [componentMap, quickstart, regtest].join('\n');
  assert.doesNotMatch(corpus, /downloads service images|service images from registry|downloads images, creates/i);
  assert.match(componentMap, /module-to-container state in the `xchain_node` MariaDB database/i);
  assert.match(componentMap, /clones service repositories and builds images locally/i);
  assert.match(componentMap, /pulls the MariaDB base image from Docker Hub/i);
  assert.match(quickstart, /clones service repositories[^\n]*builds the service and coin-node images locally/i);
  assert.match(regtest, /clones service repos, builds images, creates containers/i);
}

function assertSdkBundler(componentMap, packageJson) {
  const scripts = JSON.parse(packageJson).scripts;
  assert.match(scripts.build, /\bbrowserify\b/);
  assert.match(scripts.build, /\buglify-js\b/);
  assert.match(scripts['build:dev'], /\bbrowserify\b/);
  assert.match(componentMap, /browser bundle via browserify \(minified with uglify-js\)/i);
  assert.doesNotMatch(componentMap, /browser bundle via webpack/i);
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

test('supported-blockchain topology keeps the explorer shared', () => {
  assertSharedExplorerTopology(read('concepts/blockchains.md'));
});

test('falsification: a per-chain explorer pipeline is rejected', () => {
  const stale = 'Each blockchain runs its own pipeline (decoder, indexer, explorer, UTXO tracker).';
  assert.throws(() => assertSharedExplorerTopology(stale));
});

test('node installation and storage descriptions agree', () => {
  assertNodeDescription(
    read('architecture/component-map.md'),
    read('getting-started/quickstart-node-operator.md'),
    read('developer-guide/regtest-development.md'),
  );
});

test('falsification: registry-image and config-only node claims are rejected', () => {
  const stale = '| **Storage** | Local config files |\n'
    + '| **Communication** | Docker Engine API; downloads service images from registry |';
  assert.throws(() => assertNodeDescription(stale, 'downloads service images', 'downloads images, creates'));
});

test('node docs match clone, build, MariaDB pull, and state source paths', { skip: NODE.skip }, () => {
  const build = fs.readFileSync(path.join(NODE.root, 'src/services/module_service/build_and_up.js'), 'utf8');
  const database = fs.readFileSync(path.join(NODE.root, 'src/services/database_service/database_module.js'), 'utf8');
  const store = fs.readFileSync(path.join(NODE.root, 'src/db/index.js'), 'utf8');
  assert.match(build, /execFile\('docker', \['build'/);
  assert.match(database, /\['pull', 'mariadb:11\.8'\]/);
  assert.match(store, /class MariaDbStore/);
});

test('component map names the SDK browser tools used by its scripts', { skip: SDK.skip }, () => {
  assertSdkBundler(read('architecture/component-map.md'), fs.readFileSync(path.join(SDK.root, 'package.json'), 'utf8'));
});

test('falsification: a webpack SDK claim is rejected', () => {
  const sdkPackage = JSON.stringify({ scripts: { build: 'browserify | uglify-js', 'build:dev': 'browserify' } });
  assert.throws(() => assertSdkBundler('browser bundle via webpack', sdkPackage));
});
