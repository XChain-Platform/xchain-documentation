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
 * Layout-document currency gate.
 *
 * WHY. CONTRIBUTING.md and MAINTAINERS.md describe the repo's shape, and
 * nothing linked to those descriptions, so two sweeps walked past them. The
 * lowercase rename of the three root docs left CONTRIBUTING's layout tree and
 * MAINTAINERS' ownership table naming BLOCKCHAINS.md / OVERVIEW.md /
 * WHITEPAPER.md, which is the exact SCREAMING_CASE the same file forbids at
 * CONTRIBUTING.md's file-naming rule. The operator-dashboard removal swept the
 * components index, the README table, the platform map and the test counts,
 * and left MAINTAINERS.md claiming 15 documented components against 14 on
 * disk. Both are the same failure: a prose description of the tree with no
 * derivation from the tree.
 *
 * WHAT IT CHECKS.
 *
 *   1. Every path named in CONTRIBUTING.md's repo-layout tree exists at the
 *      repo root, matched case-exactly.
 *   2. Every path named in MAINTAINERS.md's areas-of-responsibility table
 *      exists at the repo root, matched case-exactly.
 *   3. Every "<n> components" claim in the prose equals the number of
 *      component directories under components/.
 *
 * CASE-EXACT IS THE WHOLE POINT OF CHECKS 1 AND 2. macOS is case-insensitive,
 * so fs.existsSync('BLOCKCHAINS.md') returns true against blockchains.md and a
 * guard written that way would pass on a contributor's laptop while the defect
 * it exists to catch sat in the file. Every lookup here reads a directory
 * listing and compares strings.
 *
 * WHAT IT DOES NOT CHECK: that the DESCRIPTIONS beside each path are accurate,
 * or that everything on disk appears in the tree. The tree is a reader's
 * orientation aid and deliberately omits bin/, lib/, test/ and the package
 * files, so completeness in that direction is not a defect.
 *
 ********************************************************************/

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/** Reads a directory listing once, so every existence test is case-exact. */
function entries(dir) {
  const out = { files: new Set(), dirs: new Set() };
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    (e.isDirectory() ? out.dirs : out.files).add(e.name);
  }
  return out;
}

const ROOT_ENTRIES = entries(ROOT);

/** Resolves a root-relative token from prose; a trailing slash means directory. */
function missingReason(token) {
  const isDir = token.endsWith('/');
  const name = isDir ? token.slice(0, -1) : token;
  if (name.includes('/')) return null; // nested paths are out of this guard's scope
  if (isDir) return ROOT_ENTRIES.dirs.has(name) ? null : 'no such directory at the repo root';
  if (ROOT_ENTRIES.files.has(name)) return null;
  const other = [...ROOT_ENTRIES.files].find((f) => f.toLowerCase() === name.toLowerCase());
  return other ? `the file on disk is named ${other}` : 'no such file at the repo root';
}

/** Pulls the entry names out of the fenced ASCII tree under a given heading. */
function layoutTreeEntries(markdown, heading) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  assert.ok(start >= 0, `CONTRIBUTING.md no longer has the "${heading}" section`);
  const open = lines.indexOf('```', start);
  const close = lines.indexOf('```', open + 1);
  assert.ok(open > 0 && close > open, 'the repo-layout section no longer holds a fenced block');
  const out = [];
  for (let i = open + 1; i < close; i += 1) {
    const m = /^[├└]──\s+(\S+)/.exec(lines[i]);
    if (m) out.push({ token: m[1], line: i + 1 });
  }
  return out;
}

/** Pulls inline-code path tokens out of the rows of a named Markdown table. */
function tableCodePaths(markdown, heading) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  assert.ok(start >= 0, `MAINTAINERS.md no longer has the "${heading}" section`);
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const token = m[1];
      if (token.endsWith('/') || token.endsWith('.md')) out.push({ token, line: i + 1 });
    }
  }
  return out;
}

/** A documented component is a subdirectory of components/. */
function documentedComponents() {
  return [...entries(path.join(ROOT, 'components')).dirs].sort();
}

function markdownFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'dist') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      // CHANGELOG is history: its old counts were true when written.
      else if (e.name.endsWith('.md') && e.name !== 'CHANGELOG.md') out.push(f);
    }
  })(ROOT);
  return out;
}

/*
 * Counts that legitimately measure a set other than the documented components.
 * Registered per claim and per occurrence, following action-count-claims.js: a
 * file-level allowlist would bless every future wrong number in that file, and
 * an entry that stops matching is itself a failure, so a deleted claim takes
 * its exemption with it. Empty today, and that is a fact about the repo rather
 * than a shortcut: every digit-form component claim currently counts the
 * documented set. Release-train and library counts are spelled out in words
 * ("nine components", "five component libraries"), which the digit-form regex
 * below does not reach, and they count release scope rather than the docs set.
 */
const SCOPED = [];

// Qualifiers may carry a hyphen or the xchain-* glob, which is how
// MAINTAINERS.md phrases its claim; a plain \w+ run misses it entirely.
const CLAIM = /\b(\d{1,3})\s+((?:[A-Za-z][A-Za-z0-9*-]*\s+){0,3})components?\b/g;

test('the repo-layout tree in CONTRIBUTING.md names paths that exist', () => {
  const md = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8');
  const found = layoutTreeEntries(md, '## Repo layout in 30 seconds');
  assert.ok(found.length >= 10, 'the layout tree parsed to almost nothing, so this guard is inert');

  const bad = found
    .map(({ token, line }) => {
      const why = missingReason(token);
      return why ? `CONTRIBUTING.md:${line} names ${token}: ${why}` : null;
    })
    .filter(Boolean);

  assert.deepStrictEqual(bad, [],
    'the repo-layout tree describes a tree that no longer exists. Update the prose to match disk '
    + '(renaming the file instead is a URL change and needs a redirect entry):\n' + bad.join('\n'));
});

test('the areas-of-responsibility table in MAINTAINERS.md names paths that exist', () => {
  const md = fs.readFileSync(path.join(ROOT, 'MAINTAINERS.md'), 'utf8');
  const found = tableCodePaths(md, '## Areas of responsibility');
  assert.ok(found.length >= 10, 'the ownership table parsed to almost nothing, so this guard is inert');

  const bad = found
    .map(({ token, line }) => {
      const why = missingReason(token);
      return why ? `MAINTAINERS.md:${line} names ${token}: ${why}` : null;
    })
    .filter(Boolean);

  assert.deepStrictEqual(bad, [],
    'the ownership table assigns an area that no longer exists under that name:\n' + bad.join('\n'));
});

test('the component count is derived from components/, not typed into the docs', () => {
  const components = documentedComponents();
  assert.ok(components.length > 0, 'components/ must hold one directory per documented component');

  const allowed = components.length;
  const budget = new Map(SCOPED.map((s) => [`${s.file}|${s.claim}`, s.count]));

  const bad = [];
  for (const file of markdownFiles()) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      CLAIM.lastIndex = 0;
      let m;
      while ((m = CLAIM.exec(line))) {
        if (Number(m[1]) === allowed) continue;
        const key = `${rel}|${m[0].trim()}`;
        const left = budget.get(key) || 0;
        if (left > 0) { budget.set(key, left - 1); continue; }
        bad.push(`${rel}:${i + 1} claims ${m[1]}: "${m[0].trim()}"`);
      }
    });
  }

  const unspent = [...budget.entries()].filter(([, left]) => left > 0)
    .map(([key, left]) => `${key} (${left} unmatched)`);
  assert.deepStrictEqual(unspent, [],
    'SCOPED registers a claim that is no longer in the docs. Delete the entry:\n' + unspent.join('\n'));

  assert.deepStrictEqual(bad, [],
    `components/ documents ${allowed} components (${components.join(', ')}). These claims say `
    + 'otherwise. If a number measures a different set, add it to SCOPED with the reason rather '
    + 'than editing prose to fit the guard:\n' + bad.join('\n'));
});
