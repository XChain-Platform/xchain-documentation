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
 * Byte-size constant claims in prose.
 *
 * WHY. When a protocol constant changes, the sweep that follows is a grep for
 * the IDENTIFIER across the repos that vendor it, and prose is not a vendoring
 * copy. A correction dropped ENVELOPE_MAX_PAYLOAD from 400000 to 390000 because
 * a 400,000-byte payload compiles to a 402,789 WU reveal, over Bitcoin Core's
 * MAX_STANDARD_TX_WEIGHT: the encoder built it, the validator accepted it, and
 * no node would relay it. The constant was then swept across twelve vendoring
 * copies and verified inside the running mainnet containers. It was never swept
 * through the documentation's own sentences, so for three days docs.xchain.io
 * published 400,000 to every third-party implementer, on the two pages a
 * would-be implementer actually reads, while 390,000 appeared on no page at
 * all. A published spec that names an unbroadcastable cap is worse than one
 * that names none.
 *
 * THE TRAP this guard is built around: 400,000 is simultaneously WRONG as a
 * payload byte count and RIGHT as a weight. MAX_STANDARD_TX_WEIGHT is exactly
 * 400000, and it is the very bound that forced the payload cap down. So a
 * guard that bans the integer would ban the correct sentence too. Everything
 * here keys on the number being presented in BYTES.
 *
 * WHAT IT CHECKS:
 *
 *   1. Where prose names a guarded constant and then states a byte size, that
 *      size equals the value protocol/constants.js exports today.
 *   2. A superseded value of a guarded constant appears nowhere in prose as a
 *      byte quantity, even in a sentence that never names the constant. This
 *      is the check that catches "Capacity: up to 400,000 bytes of data",
 *      which names nothing and was the more misleading of the two pages.
 *
 * WHAT IT DOES NOT CHECK: prose that describes a size in words, or that
 * rounds ("~390 KB" is fine and deliberate). Rounded prose is a reading
 * judgement; an exact superseded integer is not.
 *
 * Values come from protocol/constants.js, never typed here, so the next
 * correction updates this guard by being made. Adding the OLD value to
 * `superseded` is the one manual step, and it is what makes the guard
 * retroactive rather than merely current.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CONSTANTS = require(path.join(ROOT, 'protocol', 'constants.js'));

/*
 * Constants whose value is quoted in prose as a number of bytes. `superseded`
 * lists values this constant USED to have; each one is a value that must never
 * again be presented as a byte size anywhere in the docs.
 */
const GUARDED = [
  {
    name: 'ENVELOPE_MAX_PAYLOAD',
    superseded: [400000],
    why: '2026-07-31: 400000 admitted a ~397,010..400,000 band the encoder built, '
      + 'the validator accepted and no node relayed, because the reveal exceeded MAX_STANDARD_TX_WEIGHT',
  },
  {
    name: 'MAX_ACTION_DATA_LENGTH',
    superseded: [],
    why: 'the legacy-lane ceiling; guarded so a future per-encoding change cannot leave prose behind',
  },
];

/*
 * Sentences that legitimately state a superseded value as bytes: a page
 * narrating the correction itself, for instance. Each needs a reason, because
 * an unexplained exemption is how a guard rots into a list of numbers somebody
 * silenced. Keyed per file and per occurrence count, so a NEW stale claim in an
 * already-exempt file is still caught.
 *
 * Empty on purpose as of 2026-08-03: no doc page narrates the correction.
 * The history lives in protocol/constants.js comments (a .js file, which
 * this guard does not read).
 */
const SCOPED = [];

/**
 * A number presented as a quantity of bytes: "400,000 bytes", "8,192-byte",
 * "390000 bytes". Thousands separators are optional because both styles appear
 * in the docs, and a guard that only understood one would miss half the repo.
 */
const BYTE_QUANTITY = /\b(\d{1,3}(?:,\d{3})+|\d{3,})\s*-?\s*bytes?\b/gi;

/**
 * How far past a constant's name a number may sit and still count as a claim
 * about its value. Wide enough for "`ENVELOPE_MAX_PAYLOAD` (390,000 bytes)"
 * and any brief qualifier; far too narrow to reach across a sentence into a
 * neighbouring quantity.
 */
const NEAR = 40;

function markdownFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      // CHANGELOG is history: its old values were true when written.
      else if (e.name.endsWith('.md') && e.name !== 'CHANGELOG.md') out.push(f);
    }
  })(ROOT);
  return out;
}

function readLines() {
  const out = [];
  for (const file of markdownFiles()) {
    const rel = path.relative(ROOT, file);
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => out.push({ rel, no: i + 1, line }));
  }
  return out;
}

test('every guarded constant is actually exported by protocol/constants.js', () => {
  for (const g of GUARDED) {
    assert.strictEqual(typeof CONSTANTS[g.name], 'number',
      `${g.name} is guarded here but protocol/constants.js does not export it as a number. `
      + 'Either the constant was renamed (update this test) or the export was lost.');
    assert.ok(!g.superseded.includes(CONSTANTS[g.name]),
      `${g.name} is exported as ${CONSTANTS[g.name]}, which this test lists as SUPERSEDED. `
      + 'A revert of the constant would otherwise be blessed by its own guard.');
  }
});

test('prose that names a byte constant states its current value', () => {
  const bad = [];
  for (const { rel, no, line } of readLines()) {
    for (const g of GUARDED) {
      const at = line.indexOf(g.name);
      if (at === -1) continue;
      // Only a byte quantity sitting immediately after the name is the one
      // being presented AS its value. The window matters: concepts/encoding.md
      // names MAX_ACTION_DATA_LENGTH and then, four hundred characters later in
      // the same paragraph-as-one-line, correctly says a ~8,190-byte decoded
      // payload can compile past the 8,192 cap. Those are two different
      // quantities and the sentence is right, so an unbounded look-ahead makes
      // this guard demand that correct prose be broken.
      BYTE_QUANTITY.lastIndex = 0;
      const m = BYTE_QUANTITY.exec(line.slice(at, at + g.name.length + NEAR));
      if (!m) continue;
      // "~8,190 bytes" and "about 390 KB" are deliberate roundings, not claims
      // about the constant's exact value.
      if (/[~≈]\s*$/.test(line.slice(at, at + g.name.length + m.index))) continue;
      const claimed = Number(m[1].replace(/,/g, ''));
      if (claimed === CONSTANTS[g.name]) continue;
      bad.push(`${rel}:${no} presents ${g.name} as ${claimed} bytes, but it is ${CONSTANTS[g.name]}`);
    }
  }
  assert.deepStrictEqual(bad, [],
    'these sentences name a constant and then state the wrong size:\n' + bad.join('\n'));
});

/*
 * ── BATCH_COMMAND_LIMIT (a COUNT, not a byte size) ─────────────────────────
 *
 * WHY A SECOND MECHANISM. Everything above keys on the literal identifier
 * name sitting next to the number (`ENVELOPE_MAX_PAYLOAD` (390,000 bytes)`).
 * No prose page ever writes `BATCH_COMMAND_LIMIT`; every page just says
 * "250 commands" or "the 250-command cap". The identifier-adjacency anchor
 * therefore cannot see this constant at all, so it needs its own claim
 * scan rather than an entry in GUARDED (a `bytes` claim, wrong unit) or a
 * silent no-op entry.
 *
 * WHY EVERY COMMAND COUNT IS CHECKED, with no digit floor. The first cut of
 * this guard borrowed BYTE_QUANTITY's 3-digit floor to keep two unrelated
 * phrases out ("21 commands" for the CLI, "35 commands" for the ACTION set).
 * That was measured and REJECTED on 2026-08-13: driving a real prose page
 * from "250 commands" to "260 commands" reddened the guard, but driving it
 * to "99 commands" passed SILENTLY, because the drifted value fell under the
 * floor. A guard that only catches drift which stays 3 digits wide is not a
 * guard, and the drift direction it misses (a smaller cap) is the one a
 * careless edit is likelier to produce.
 *
 * So the floor is gone and the three legitimate non-BATCH claims are named
 * explicitly in COMMAND_SCOPED instead. An explicit allowlist states what is
 * exempt and why; a digit heuristic only states what happened to be true of
 * the numbers in the repo the day it was written. The unspent-entry
 * assertion below is what keeps the allowlist honest: delete one of those
 * three prose lines and the run fails until the exemption goes too.
 */
const BATCH_COMMAND_LIMIT_NAME = 'BATCH_COMMAND_LIMIT';

/** Same shape as BYTE_QUANTITY, unit swapped from bytes to commands, no floor (see above). */
const COMMAND_QUANTITY = /\b(\d{1,3}(?:,\d{3})+|\d+)\s*-?\s*commands?\b/gi;

/*
 * Claims that legitimately state a command count unrelated to the BATCH cap.
 * `times` is how many occurrences that file is allowed, NOT the number being
 * claimed: the two are different and conflating them made an exemption for
 * "21 commands" quietly permit twenty-one of them.
 */
const COMMAND_SCOPED = [
  { file: 'components/node/architecture.md', count: 21, times: 2,
    why: 'the xchain-node Commander CLI verb count, nothing to do with BATCH' },
  { file: 'getting-started/what-is-xchain.md', count: 35, times: 1,
    why: 'the size of the ACTION set, nothing to do with BATCH' },
];

test('prose command counts for the BATCH cap match the canonical value', () => {
  const budget = new Map(COMMAND_SCOPED.map((s) => [`${s.file}|${s.count}`, s.times]));
  const bad = [];
  for (const { rel, no, line } of readLines()) {
    COMMAND_QUANTITY.lastIndex = 0;
    let m;
    while ((m = COMMAND_QUANTITY.exec(line))) {
      const claimed = Number(m[1].replace(/,/g, ''));
      if (claimed === CONSTANTS.BATCH_COMMAND_LIMIT) continue;
      const key = `${rel}|${claimed}`;
      const left = budget.get(key) || 0;
      if (left > 0) { budget.set(key, left - 1); continue; }
      bad.push(`${rel}:${no} states ${claimed} commands, but ${BATCH_COMMAND_LIMIT_NAME} is `
        + `${CONSTANTS.BATCH_COMMAND_LIMIT}: "${m[0].trim()}"`);
    }
  }

  const unspent = [...budget.entries()].filter(([, left]) => left > 0)
    .map(([key, left]) => `${key} (${left} unmatched)`);
  assert.deepStrictEqual(unspent, [],
    'COMMAND_SCOPED registers exemptions that no longer appear. Delete them:\n' + unspent.join('\n'));

  assert.deepStrictEqual(bad, [],
    'these state a BATCH command count that disagrees with protocol/constants.js. Fix the sentence, '
    + 'or if it genuinely measures something other than the BATCH cap, add it to COMMAND_SCOPED with '
    + 'a reason:\n' + bad.join('\n'));
});

/*
 * ── Cross-repo drift: the same 250 in xchain-indexer and xchain-sdk ────────
 *
 * protocol/constants.js is this repo's canonical copy, but the number that
 * actually runs lives in two sibling repos, each with its own literal:
 * xchain-indexer/src/actions/batch.js (`this.commandLimit`) and
 * xchain-sdk/src/batchLimits.js (`BATCH_COMMAND_LIMIT`). Prose drifting from
 * this file is the smaller failure mode; code drifting from this file, or
 * the two services drifting from each other, is the one that actually
 * breaks something on chain.
 *
 * Read as source and parsed with a regex, exactly like action-activation-model
 * .test.js reads xchain-indexer/src/protocol_changes.js and sdk-action-surface
 * .test.js reads xchain-sdk/src/*.js: these are sibling repos in the monorepo
 * checkout, not dependencies, so the assertion skips (not fails) when a
 * sibling checkout is absent, the same convention every other cross-repo test
 * in this directory uses.
 */
const INDEXER_BATCH = path.resolve(ROOT, '../xchain-indexer/src/actions/batch.js');
const SDK_BATCH_LIMITS = path.resolve(ROOT, '../xchain-sdk/src/batchLimits.js');
const haveIndexerBatch = fs.existsSync(INDEXER_BATCH);
const haveSdkBatchLimits = fs.existsSync(SDK_BATCH_LIMITS);

test('xchain-indexer commandLimit matches the canonical BATCH_COMMAND_LIMIT',
  { skip: !haveIndexerBatch && 'sibling xchain-indexer not present in this checkout' }, () => {
    const src = fs.readFileSync(INDEXER_BATCH, 'utf8');
    const m = /this\.commandLimit\s*=\s*(\d+)\s*;/.exec(src);
    assert.ok(m, 'this.commandLimit assignment not found in xchain-indexer/src/actions/batch.js; '
      + 'the declaration shape changed, re-point this regex');
    assert.strictEqual(Number(m[1]), CONSTANTS.BATCH_COMMAND_LIMIT,
      `xchain-indexer's this.commandLimit is ${m[1]}, but protocol/constants.js BATCH_COMMAND_LIMIT `
      + `is ${CONSTANTS.BATCH_COMMAND_LIMIT}`);
  });

test('xchain-sdk BATCH_COMMAND_LIMIT matches the canonical value',
  { skip: !haveSdkBatchLimits && 'sibling xchain-sdk not present in this checkout' }, () => {
    const src = fs.readFileSync(SDK_BATCH_LIMITS, 'utf8');
    const m = /const\s+BATCH_COMMAND_LIMIT\s*=\s*(\d+)\s*;/.exec(src);
    assert.ok(m, 'BATCH_COMMAND_LIMIT declaration not found in xchain-sdk/src/batchLimits.js; '
      + 'the declaration shape changed, re-point this regex');
    assert.strictEqual(Number(m[1]), CONSTANTS.BATCH_COMMAND_LIMIT,
      `xchain-sdk's BATCH_COMMAND_LIMIT is ${m[1]}, but protocol/constants.js BATCH_COMMAND_LIMIT `
      + `is ${CONSTANTS.BATCH_COMMAND_LIMIT}`);
  });

test('no superseded byte value survives anywhere in the prose', () => {
  const stale = new Map();
  for (const g of GUARDED) {
    for (const v of g.superseded) stale.set(v, g);
  }
  const budget = new Map(SCOPED.map((s) => [`${s.file}|${s.value}`, s.count]));

  const bad = [];
  for (const { rel, no, line } of readLines()) {
    BYTE_QUANTITY.lastIndex = 0;
    let m;
    while ((m = BYTE_QUANTITY.exec(line))) {
      const n = Number(m[1].replace(/,/g, ''));
      const g = stale.get(n);
      if (!g) continue;
      const key = `${rel}|${n}`;
      const left = budget.get(key) || 0;
      if (left > 0) { budget.set(key, left - 1); continue; }
      bad.push(`${rel}:${no} states ${n} bytes, a superseded value of ${g.name} (now ${CONSTANTS[g.name]}). ${g.why}`);
    }
  }

  // A registered exemption that no longer matches is stale, and leaving it
  // would silently re-open the hole for the whole file.
  const unspent = [...budget.entries()].filter(([, left]) => left > 0)
    .map(([key, left]) => `${key} (${left} unmatched)`);
  assert.deepStrictEqual(unspent, [],
    'SCOPED registers exemptions that no longer appear. Delete them:\n' + unspent.join('\n'));

  assert.deepStrictEqual(bad, [],
    'these publish a value the platform has corrected. Fix the sentence rather than the guard, '
    + 'unless the page is deliberately narrating the correction, in which case add it to SCOPED '
    + 'with a reason:\n' + bad.join('\n'));
});
