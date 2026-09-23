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
 * Release-train roster drift.
 *
 * WHY. operations/release-process.md is the page an operator reads while
 * freezing and tagging a train, and its Train members row is the list the
 * repo-scoped steps resolve through. The count there is spelled as a word,
 * which the digit-form count guards do not reach, so a roster short of the
 * real train stays green everywhere else.
 *
 * WHAT IT CHECKS. The Train members row names exactly the components in the
 * newest version table of operations/releases.md, and the spelled-out count
 * in the page's opening sentence matches the roster length.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PROCESS = path.join(ROOT, 'operations', 'release-process.md');
const RELEASES = path.join(ROOT, 'operations', 'releases.md');

const WORDS = {
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
};

function rosterRow(md) {
  const row = md.split('\n').find((l) => l.startsWith('| **Train members** |'));
  assert.ok(row, 'release-process.md has no Train members row');
  return [...row.matchAll(/`(xchain-[a-z0-9-]+)`/g)].map((m) => m[1]).sort();
}

function newestVersionTable(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^\| Component \| Version \|/.test(l));
  assert.ok(start >= 0, 'releases.md has no Component/Version table');
  const out = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const m = lines[i].match(/^\| (xchain-[a-z0-9-]+) \|/);
    if (m) out.push(m[1]);
  }
  return out.sort();
}

test('the Train members row matches the newest release table', () => {
  const roster = rosterRow(fs.readFileSync(PROCESS, 'utf8'));
  const table = newestVersionTable(fs.readFileSync(RELEASES, 'utf8'));
  assert.ok(roster.length > 0, 'parsed an empty Train members row, so this guard is inert');
  assert.ok(table.length > 0, 'parsed an empty release table, so this guard is inert');
  const missing = table.filter((c) => !roster.includes(c));
  const extra = roster.filter((c) => !table.includes(c));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] },
    'release-process.md Train members disagrees with the newest table in releases.md');
});

test('the spelled-out train size matches the roster', () => {
  const md = fs.readFileSync(PROCESS, 'utf8');
  const m = md.match(/ships as a \*\*release train\*\*: (\w+) components/);
  assert.ok(m, 'release-process.md no longer states the train size in its opening sentence');
  const n = WORDS[m[1].toLowerCase()];
  assert.ok(n, `unrecognised count word "${m[1]}"; extend WORDS rather than pass vacuously`);
  assert.equal(n, rosterRow(md).length, `"${m[1]} components" does not match the Train members row`);
});
