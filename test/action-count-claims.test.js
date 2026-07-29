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
 * ACTION count claims.
 *
 * WHY. Counts of things are the most reliable stale fact in this repo, because
 * adding an ACTION means adding a file and nobody greps for every integer that
 * described the old set. BET landed in July 2026 and by the 2026-07-29 sweep
 * eight surfaces were still quoting pre-BET numbers, across four repos' worth
 * of readers: CONTRIBUTING, OVERVIEW, README, METALAYER, Use_Cases twice, and
 * the SDK's own ACTIONS and SESSIONS pages, which claimed the SDK supported 30
 * action types while documenting all 31 of them on the same page.
 *
 * The trap this guard is built around: 35 and 36 are BOTH correct, for
 * different sets, and a sweep that flattens them makes the docs worse.
 *
 *   36  named ACTIONs         every spec in protocol/actions/
 *   35  wire-decoded ACTIONs  the above minus XCALL, which is mirror-injected
 *                             into the destination chain's index rather than
 *                             decoded from a transaction
 *   31  user-submittable      the above minus the four validator/system
 *                             actions; equals the SDK's builder methods
 *
 * WHAT IT CHECKS:
 *
 *   1. The three counts are derived from protocol/actions/, not typed here.
 *   2. Every "<n> ACTIONs" style claim in the prose is one of those three, or
 *      is listed in SCOPED below with the reason it counts something else.
 *
 * WHAT IT DOES NOT CHECK: whether a given page picked the RIGHT one of the
 * three. That is a reading judgement. This catches the number that belongs to
 * no set at all, which is what every one of the eight stale claims was.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SPECS = path.join(ROOT, 'protocol', 'actions');

/** Actions that exist but are never decoded from a wire transaction. */
const MIRROR_INJECTED = ['XCALL'];
/** Actions written by validators or synthesized, so never user-submittable. */
const NOT_USER_SUBMITTABLE = ['ANCHOR', 'ATTEST', 'NODEPROOF', 'SLASH'];

function namedActions() {
  return fs.readdirSync(SPECS)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => f.replace(/\.md$/, '').toUpperCase())
    .sort();
}

/*
 * Counts that legitimately measure something other than the ACTION set. Keyed
 * per claim and per occurrence for the same reason as WIRE_SCOPED: a
 * file-plus-number exemption blesses every future claim of that number in that
 * file. Each needs a reason, because an unexplained exemption is how a guard
 * rots into a list of numbers somebody silenced.
 *
 * These exempt a claim from the ACTION-set check; they do NOT assert the number
 * is right. Three were checked against source on 2026-07-29 and two were wrong:
 * the e2e tree said 59 action test files against 64 on disk, and 36 helper
 * modules against 40. Verifying the rest means deriving each from its own repo,
 * which is a separate job. `46 action` in particular resisted a cheap check:
 * 51 handler files and 49 instantiation sites measure different things, and
 * neither is obviously the documented figure, so it is left alone and labelled
 * rather than guessed at.
 */
/*
 * The wire-decoded count (36 minus XCALL) is correct only where the text is
 * genuinely talking about what comes off a transaction. Everywhere else a 35 is
 * a pre-XCALL leftover, which is what it was on four pages in the 07-29 sweep.
 * So this count is allowed only where somebody has said why, rather than being
 * a default. A page that means "every ACTION" should say 36.
 *
 * Registered per CLAIM and per occurrence count, not per file. A file-level
 * allowlist would let a NEW bare 35 slip into any page that already had a
 * legitimate one, and the three files below are exactly the pages most likely
 * to grow another. `claim` must equal the matched text exactly; `count` is how
 * many times it legitimately appears. An entry that stops matching anything is
 * itself an error, so a claim that gets deleted takes its entry with it.
 */
const WIRE_SCOPED = [
  { file: 'components/decoder/CONFIGURATION.md', claim: '35 ACTION names', count: 1,
    why: 'the decoder only ever sees the wire-decoded names' },
  { file: 'concepts/ACTIONS.md', claim: '35 ACTION types', count: 1,
    why: 'defines the wire-decoded set, and says so on the same line' },
  { file: 'concepts/ACTIONS.md', claim: '35 wire-decoded ACTION types', count: 1,
    why: 'explains XCALL sitting outside that set' },
  { file: 'getting-started/What_Is_XChain.md', claim: '35 ACTION commands', count: 1,
    why: 'the page presents the wire-decoded set and documents XCALL separately' },
  { file: 'getting-started/What_Is_XChain.md', claim: '35 ACTIONs', count: 2,
    why: 'the section heading, and the four validator/system actions within that set' },
  { file: 'getting-started/What_Is_XChain.md', claim: '35 actions', count: 2,
    why: 'chain parity, and the 31-of-35 developer-invocable split' },
  { file: 'getting-started/What_Is_XChain.md', claim: '35 wire-decoded ACTIONs', count: 1,
    why: 'names the scope explicitly where XCALL is introduced' },
];

const SCOPED = [
  { file: 'components/e2e-test/ARCHITECTURE.md', claim: '64 action', count: 1,
    why: 'test files, several per action; re-counted from the directory 2026-07-29' },
  { file: 'components/e2e-test/README.md', claim: '27 ACTION', count: 1,
    why: 'test suites, not actions; the sentence enumerates all 27' },
  { file: 'components/indexer/ARCHITECTURE.md', claim: '46 action', count: 1,
    why: 'handler classes plus an internal sub-handler. NOT verified against source' },
  { file: 'components/indexer/ACTIONS.md', claim: '21 actions', count: 1,
    why: 'the subset registered at protocol version 1.0.0; 21 + 15 = 36 on the same page' },
  { file: 'components/vm/ARCHITECTURE.md', claim: '19 action types', count: 1,
    why: 'emit-API types the VM can construct; verified against gateway-emit.js 2026-07-29' },
  { file: 'components/wallet/UX.md', claim: '5 actions', count: 1,
    why: 'history strip length, unrelated to the action set' },
  { file: 'components/explorer/WEBSOCKET.md', claim: '1,000 actions', count: 1,
    why: 'a lag threshold measured in actions, not a set size' },
  { file: 'WHITEPAPER.md', claim: '1 ACTION', count: 1,
    why: 'a false positive on the section number in "4.1 ACTION string format"' },
];

// Two things matter in this regex. The thousands separator, because without it
// "1,000 actions" parses as 0 and the exemption for it never matches. And the
// ORDER of the noun alternatives: they are longest-first, because `ACTIONs?`
// placed first would match inside "35 ACTION names" and every claim would
// report as the uninformative "35 ACTION".
const CLAIM = /\b(\d{1,3}(?:,\d{3})*)\s+(?:standard |named |core |on-chain |protocol |wire-decoded |different |registered )?(?:ACTION commands?|ACTION definitions?|ACTION types?|ACTION names?|action types?|ACTIONs?|actions?)\b/g;

function markdownFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      // CHANGELOG is history: its old counts were true when written.
      else if (e.name.endsWith('.md') && e.name !== 'CHANGELOG.md') out.push(f);
    }
  })(ROOT);
  return out;
}

test('the counts are derived from the spec directory, not from prose', () => {
  const named = namedActions();
  assert.ok(named.length > 0, 'protocol/actions/ must hold the ACTION specs');
  for (const a of [...MIRROR_INJECTED, ...NOT_USER_SUBMITTABLE]) {
    assert.ok(named.includes(a), `${a} is named in this test but has no spec in protocol/actions/`);
  }
});

test('every ACTION count in the prose refers to a set that exists', () => {
  const named = namedActions().length;
  const wire = named - MIRROR_INJECTED.length;
  const submittable = wire - NOT_USER_SUBMITTABLE.length;
  const allowed = new Set([named, submittable]);
  // Each registered wire-decoded claim is spent as it is matched, so an extra
  // occurrence of an otherwise-legitimate sentence is still caught.
  const budget = new Map([...WIRE_SCOPED, ...SCOPED].map((s) => [`${s.file}|${s.claim}`, s.count]));

  const bad = [];
  for (const file of markdownFiles()) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      CLAIM.lastIndex = 0;
      let m;
      while ((m = CLAIM.exec(line))) {
        const n = Number(m[1].replace(/,/g, ''));
        if (allowed.has(n)) continue;
        const key = `${rel}|${m[0].trim()}`;
        const left = budget.get(key) || 0;
        if (left > 0) { budget.set(key, left - 1); continue; }
        bad.push(`${rel}:${i + 1} claims ${n}: "${m[0].trim()}"`);
      }
    });
  }

  // A registered claim that no longer appears is stale. Leaving it would
  // silently re-open the file-level hole this registry exists to close.
  const unspent = [...budget.entries()].filter(([, left]) => left > 0)
    .map(([key, left]) => `${key} (${left} unmatched)`);
  assert.deepStrictEqual(unspent, [],
    'WIRE_SCOPED registers claims that are no longer in the docs. Delete the entry:\n' + unspent.join('\n'));

  assert.deepStrictEqual(bad, [],
    `these do not match an ACTION set. ${named} (named) and ${submittable} (user-submittable) are `
    + `allowed anywhere; ${wire} (wire-decoded) only in the files listed in WIRE_SCOPED, because a `
    + 'bare 35 is usually a pre-XCALL leftover. If a number measures something else entirely, add it '
    + 'to SCOPED with the reason rather than editing prose to fit the guard:\n'
    + bad.join('\n'));
});
