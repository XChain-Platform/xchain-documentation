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
 * The testnet cross-chain pair recipe must exist, be reachable from the
 * validator guide, name both install commands, and cite only env names that
 * a source file or another page defines.
 *
 *********************************************************************/

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'operations', 'testnet-cross-chain-pair.md');
const GUIDE = path.join(ROOT, 'operations', 'run-a-validator.md');
const SIBLING_ENV_FILES = [
  ['xchain-indexer', '.env.example'],
  ['xchain-node', path.join('src', 'services', 'config_service', 'services.js')],
].map(([repo, file]) => path.join(ROOT, '..', repo, file));

function listMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === '.git' ? [] : listMarkdown(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

function citedEnvNames(text) {
  const names = text.match(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g) || [];
  return [...new Set(names.map((n) => n.slice(1, -1)))];
}

function otherSources() {
  const pages = listMarkdown(ROOT).filter((f) => f !== PAGE);
  const siblings = SIBLING_ENV_FILES.filter((f) => fs.existsSync(f));
  return [...pages, ...siblings].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}

test('the recipe page exists', () => {
  assert.ok(fs.existsSync(PAGE));
});

test('run-a-validator links the recipe', () => {
  assert.match(fs.readFileSync(GUIDE, 'utf8'), /\]\(\.\/testnet-cross-chain-pair\.md\)/);
});

test('the recipe names both testnet install commands', () => {
  const page = fs.readFileSync(PAGE, 'utf8');
  assert.match(page, /^xchain-node install all bitcoin testnet$/m);
  assert.match(page, /^xchain-node install all litecoin testnet$/m);
});

test('every env name the recipe cites appears in another source', () => {
  const names = citedEnvNames(fs.readFileSync(PAGE, 'utf8'));
  assert.ok(names.length > 0);
  const haystack = otherSources();
  const missing = names.filter((n) => !haystack.includes(n));
  assert.deepEqual(missing, []);
});
