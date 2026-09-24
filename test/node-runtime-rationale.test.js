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
 * Node 22 pin rationale.
 *
 * WHY. isolated-vm 6.2.0 ships prebuilt bindings per Node ABI, so Node 24
 * installs it without a compiler. What holds the platform on Node 22 is the
 * consensus runtime: xchain-vm's src/consensus_runtime.js pins the Node ABI to
 * 127 and checkConsensusRuntime() rejects any other. Pages that blame a
 * compile failure send operators after a toolchain the install does not need
 * and hide the check that actually fails them.
 *
 * WHAT IT CHECKS. No living page restates the compile rationale. CHANGELOG.md
 * and operations/releases.md are history and are skipped.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HISTORY = new Set(['CHANGELOG.md', path.join('operations', 'releases.md')]);
const STALE = /cannot build (the (native )?)?`isolated-vm`|breaks native compilation|`isolated-vm` does not build on Node|`isolated-vm` requires native C\+\+ compilation/;

function markdownFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.md')) out.push(f);
    }
  })(ROOT);
  return out;
}

test('no living page blames the Node 22 pin on an isolated-vm build failure', () => {
  const files = markdownFiles();
  assert.ok(files.length > 50, 'found almost no markdown, so this guard is inert');
  const bad = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (HISTORY.has(rel)) continue;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (STALE.test(line)) bad.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, [],
    'isolated-vm installs from a prebuilt binding on Node 22 and 24; the pin is the Node ABI 127 '
    + 'consensus-runtime check in xchain-vm (checkConsensusRuntime()). Say that instead:\n' + bad.join('\n'));
});
