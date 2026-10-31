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
 * consensus runtime: xchain-vm's src/consensus-runtime.js pins the Node ABI to
 * 127 and checkConsensusRuntime() rejects any other. Pages that blame a
 * compile failure send operators after a toolchain the install does not need
 * and hide the check that actually fails them. isolated-vm also ships musl
 * prebuilds, so "musl breaks native builds" is the same wrong reason for
 * avoiding alpine; the real one is that consensus parity is confirmed only on
 * glibc.
 *
 * WHAT IT CHECKS. No living page restates the compile or musl-build rationale,
 * on one line or split across two adjacent lines (a Dockerfile comment wraps).
 * CHANGELOG.md and operations/releases.md are history and are skipped.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HISTORY = new Set(['CHANGELOG.md', path.join('operations', 'releases.md')]);
const STALE = /cannot build (the (native )?)?`isolated-vm`|breaks native compilation|`isolated-vm` does not build on Node|`isolated-vm` requires native C\+\+ compilation|(can'?t|cannot|can not|fails? to) build (the )?(native )?`?isolated-vm`?|musl('s)? breaks native/i;
const COMMENT_LEAD = /^\s*(#|\/\/|\*|>)*\s*/;

// Return the line numbers (1-based) whose text, alone or joined to the line before, is stale.
function staleLines(text) {
  const lines = text.split('\n');
  const hits = new Set();
  lines.forEach((line, i) => {
    if (STALE.test(line)) hits.add(i + 1);
    else if (i > 0) {
      const joined = lines[i - 1].replace(COMMENT_LEAD, '') + ' ' + line.replace(COMMENT_LEAD, '');
      if (STALE.test(joined) && !hits.has(i)) hits.add(i + 1);
    }
  });
  return [...hits];
}

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
    for (const n of staleLines(fs.readFileSync(file, 'utf8'))) bad.push(`${rel}:${n}`);
  }
  assert.deepEqual(bad, [],
    'isolated-vm installs from a prebuilt binding on Node 22 and 24; the pin is the Node ABI 127 '
    + 'consensus-runtime check in xchain-vm (checkConsensusRuntime()). Say that instead:\n' + bad.join('\n'));
});

test('the stale-rationale scan catches the wording when a comment wraps it across two lines', () => {
  const wrapped = '# Node 22 exactly (bookworm, not alpine): node:latest = Node 24+ can\'t build\n'
    + '# isolated-vm, and alpine\'s musl breaks native addon builds.\n';
  assert.deepEqual(staleLines(wrapped), [2]);
  const correct = '# Node 24 fails checkConsensusRuntime() (Node ABI 127); isolated-vm\n'
    + '# installs there from a prebuilt binding. Consensus parity is confirmed on glibc only.\n';
  assert.deepEqual(staleLines(correct), []);
});
