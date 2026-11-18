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
// an entry plus every part it was split into, at whichever spelling the sibling checkout uses
const { moduleEntry, readModuleSource } = require('../lib/indexer-source.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.join(__dirname, '..');
const CONSTANTS = require(path.join(ROOT, 'protocol', 'constants.js'));

test('multi-part FILE limits and activation times are pinned', () => {
  assert.strictEqual(CONSTANTS.MULTIPART_FILE_MAX_PARTS, 65535);
  assert.strictEqual(CONSTANTS.MULTIPART_FILE_MAX_BYTES, 262140000000);
  assert.deepStrictEqual(CONSTANTS.FILE_MULTIPART_ACTIVATION_TIME, {
    mainnet: null,
    testnet: 1794787200,
    regtest: 0,
  });
});

// Constants quoted in prose as a byte count; each `superseded` value must never
// again appear in the docs as a byte size.
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

// Sentences allowed to state a superseded value as bytes, each with a reason, keyed per
// file and occurrence count so a NEW stale claim in an exempt file still fails.
// Empty: no doc page narrates the correction.
const SCOPED = [];

/** A number presented as bytes ("400,000 bytes", "8,192-byte", "390000 bytes");
 * thousands separators are optional because the docs use both styles. */
const BYTE_QUANTITY = /\b(\d{1,3}(?:,\d{3})+|\d{3,})\s*-?\s*bytes?\b/gi;

/** How far past a constant's name a number still counts as a claim about its value:
 * wide enough for "`ENVELOPE_MAX_PAYLOAD` (390,000 bytes)", too narrow to reach a neighbour. */
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
      // Only a byte quantity right after the name claims its value; a bounded window keeps
      // a later, correct figure on the same line (concepts/encoding.md, ~8,190 bytes)
      // from being read as the constant's value.
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

// BATCH_COMMAND_LIMIT is a count and prose says "250 commands", never the identifier, so it
// gets its own scan. Every command count is checked with no digit floor (a smaller drifted
// value must fail too); legitimate others sit in COMMAND_SCOPED and unspent entries fail.
const BATCH_COMMAND_LIMIT_NAME = 'BATCH_COMMAND_LIMIT';

/** Same shape as BYTE_QUANTITY, unit swapped from bytes to commands, no floor (see above). */
const COMMAND_QUANTITY = /\b(\d{1,3}(?:,\d{3})+|\d+)\s*-?\s*commands?\b/gi;

// Command counts unrelated to the BATCH cap. `times` is how many occurrences the file may
// carry, not the number claimed.
const COMMAND_SCOPED = [
  { file: 'components/node/architecture.md', count: 21, times: 2,
    why: 'the xchain-node Commander CLI verb count, nothing to do with BATCH' },
  { file: 'getting-started/what-is-xchain.md', count: 38, times: 1,
    why: 'the size of the named ACTION set, nothing to do with BATCH' },
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

// Cross-repo drift: the limit that runs lives in xchain-indexer src/actions/batch.js and
// xchain-sdk src/protocol/batch_limits.js. Both are read as source text and skip (not fail)
// when a sibling checkout is absent, like every other cross-repo test here.
const INDEXER_BATCH = moduleEntry(path.resolve(ROOT, '../xchain-indexer/src/actions/batch.js'));

/* Limits are matched as SOURCE TEXT, so resolve to the file that declares them: follow a
 * bare re-export stub (the SDK file moved from batchLimits.js), try the pre-move spelling,
 * and report the path actually READ. */
function resolveSdkSource(pinned, premove) {
    const read = (rel) => {
        const abs = path.resolve(ROOT, rel);
        if (!fs.existsSync(abs)) return null;
        const body = fs.readFileSync(abs, 'utf8');
        const reexport = body.match(/^module\.exports\s*=\s*require\('([^']+)'\);\s*$/m);
        const code = body.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').trim();
        if (!reexport || code !== reexport[0].trim()) return { rel, body };
        const target = path.join(path.dirname(rel), reexport[1]);
        const abs2 = path.resolve(ROOT, target);
        return fs.existsSync(abs2) ? { rel: target, body: fs.readFileSync(abs2, 'utf8') } : null;
    };
    return read(pinned) || read(premove);
}
const SDK_BATCH = resolveSdkSource('../xchain-sdk/src/protocol/batch_limits.js',
                                   '../xchain-sdk/src/batchLimits.js');
const SDK_BATCH_LIMITS = SDK_BATCH ? SDK_BATCH.rel : '../xchain-sdk/src/protocol/batch_limits.js';
/* A bare clone skips by name; a run that declares the siblings supplied
 * (XCHAIN_REQUIRE_SIBLINGS=1 plus .ci-siblings) throws in the helper, so a missing
 * one never goes green. */
const noIndexerBatch = sibling('xchain-indexer',
    [[INDEXER_BATCH, path.join(INDEXER_BATCH.replace(/\.js$/, ''), 'index.js')]]).skip;
const noSdkBatchLimits = sibling('xchain-sdk', SDK_BATCH ? [] : [[
    path.resolve(ROOT, '../xchain-sdk/src/protocol/batch_limits.js'),
    path.resolve(ROOT, '../xchain-sdk/src/batchLimits.js'),
]]).skip;

test('xchain-indexer commandLimit matches the canonical BATCH_COMMAND_LIMIT',
  { skip: noIndexerBatch }, () => {
    const src = readModuleSource(INDEXER_BATCH);
    const m = /this\.commandLimit\s*=\s*(\d+)\s*;/.exec(src);
    assert.ok(m, 'this.commandLimit assignment not found in xchain-indexer/src/actions/batch.js; '
      + 'the declaration shape changed, re-point this regex');
    assert.strictEqual(Number(m[1]), CONSTANTS.BATCH_COMMAND_LIMIT,
      `xchain-indexer's this.commandLimit is ${m[1]}, but protocol/constants.js BATCH_COMMAND_LIMIT `
      + `is ${CONSTANTS.BATCH_COMMAND_LIMIT}`);
  });

test('xchain-sdk BATCH_COMMAND_LIMIT matches the canonical value',
  { skip: noSdkBatchLimits }, () => {
    const src = SDK_BATCH.body;
    const m = /const\s+BATCH_COMMAND_LIMIT\s*=\s*(\d+)\s*;/.exec(src);
    assert.ok(m, `BATCH_COMMAND_LIMIT declaration not found in ${SDK_BATCH_LIMITS}; `
      + 'the declaration shape changed, re-point this regex');
    assert.strictEqual(Number(m[1]), CONSTANTS.BATCH_COMMAND_LIMIT,
      `xchain-sdk's BATCH_COMMAND_LIMIT is ${m[1]}, but protocol/constants.js BATCH_COMMAND_LIMIT `
      + `is ${CONSTANTS.BATCH_COMMAND_LIMIT}`);
  });

// Weighted budget and per-action weights: canonical in protocol/constants.js, copied into the
// indexer (actions/batch.js) and SDK (protocol/batch_limits.js). Drift forks the SDK pre-flight
// from the arbiter, so each copy is pinned; same sibling-skip convention as above.
test('xchain-indexer weightBudget matches the canonical BATCH_WEIGHT_BUDGET',
  { skip: noIndexerBatch }, () => {
    const src = readModuleSource(INDEXER_BATCH);
    const m = /this\.weightBudget\s*=\s*(\d+)\s*;/.exec(src);
    assert.ok(m, 'this.weightBudget assignment not found in xchain-indexer/src/actions/batch.js; '
      + 'the declaration shape changed, re-point this regex');
    assert.strictEqual(Number(m[1]), CONSTANTS.BATCH_WEIGHT_BUDGET,
      `xchain-indexer's this.weightBudget is ${m[1]}, but protocol/constants.js BATCH_WEIGHT_BUDGET `
      + `is ${CONSTANTS.BATCH_WEIGHT_BUDGET}`);
  });

test('xchain-sdk BATCH_WEIGHT_BUDGET matches the canonical value',
  { skip: noSdkBatchLimits }, () => {
    const src = SDK_BATCH.body;
    const m = /const\s+BATCH_WEIGHT_BUDGET\s*=\s*(\d+)\s*;/.exec(src);
    assert.ok(m, `BATCH_WEIGHT_BUDGET declaration not found in ${SDK_BATCH_LIMITS}; `
      + 'the declaration shape changed, re-point this regex');
    assert.strictEqual(Number(m[1]), CONSTANTS.BATCH_WEIGHT_BUDGET,
      `xchain-sdk's BATCH_WEIGHT_BUDGET is ${m[1]}, but protocol/constants.js BATCH_WEIGHT_BUDGET `
      + `is ${CONSTANTS.BATCH_WEIGHT_BUDGET}`);
  });

test('xchain-indexer commandWeights matches the canonical BATCH_COMMAND_WEIGHTS',
  { skip: noIndexerBatch }, () => {
    const src = readModuleSource(INDEXER_BATCH);
    const table = {};
    const entry = /this\.commandWeights\[['"]([A-Z]+)['"]\]\s*=\s*(\d+)\s*;/g;
    let m;
    while ((m = entry.exec(src))) table[m[1]] = Number(m[2]);
    assert.ok(Object.keys(table).length > 0,
      'no this.commandWeights[...] assignments found in xchain-indexer/src/actions/batch.js; '
      + 'the declaration shape changed, re-point this regex');
    assert.deepStrictEqual(table, { ...CONSTANTS.BATCH_COMMAND_WEIGHTS },
      'xchain-indexer commandWeights disagrees with protocol/constants.js BATCH_COMMAND_WEIGHTS '
      + '(actions and weights must match exactly, absences included: an action absent on both '
      + 'sides weighs the default 1)');
  });

test('xchain-sdk BATCH_COMMAND_WEIGHTS matches the canonical table',
  { skip: noSdkBatchLimits }, () => {
    const src = SDK_BATCH.body;
    const block = /const\s+BATCH_COMMAND_WEIGHTS\s*=\s*Object\.freeze\(\{([^}]*)\}\)/.exec(src);
    assert.ok(block, `BATCH_COMMAND_WEIGHTS literal not found in ${SDK_BATCH_LIMITS}; `
      + 'the declaration shape changed, re-point this regex');
    const table = {};
    const entry = /([A-Z]+)\s*:\s*(\d+)/g;
    let m;
    while ((m = entry.exec(block[1]))) table[m[1]] = Number(m[2]);
    assert.deepStrictEqual(table, { ...CONSTANTS.BATCH_COMMAND_WEIGHTS },
      'xchain-sdk BATCH_COMMAND_WEIGHTS disagrees with protocol/constants.js BATCH_COMMAND_WEIGHTS');
  });

test('every canonical batch weight is an integer of at least 1', () => {
  // The invariant that keeps the count cap a sound pre-filter for the budget
  // (count > cap implies weight sum > budget). A zero or fractional weight
  // would silently break that ordering in both vendoring services.
  for (const [action, w] of Object.entries(CONSTANTS.BATCH_COMMAND_WEIGHTS)) {
    assert.ok(Number.isInteger(w) && w >= 1,
      `BATCH_COMMAND_WEIGHTS.${action} is ${w}; every weight must be an integer >= 1`);
  }
});

// Prose never names BATCH_WEIGHT_BUDGET; it says "weight budget of 250" or "weighs 30", so only
// those phrasings are scanned (a bare number near "weight" drowns in VOTE modes). Drifted prose
// fails, and both batch pages must state the budget, the default and every weight.
const WEIGHT_PAGES = ['protocol/actions/batch.md', 'developer-guide/batch-operations.md'];

test('every prose weight claim states a value the canonical table carries', () => {
  const legal = new Set([1, ...Object.values(CONSTANTS.BATCH_COMMAND_WEIGHTS)]);
  const bad = [];
  for (const { rel, no, line } of readLines()) {
    const re = /\bweighs\s+(?:the\s+default\s+)?(\d+)\b|\bweight\s+budget\s+of\s+\*{0,2}(\d+)\b/gi;
    let m;
    while ((m = re.exec(line))) {
      if (m[2] !== undefined) {
        const claimed = Number(m[2]);
        if (claimed !== CONSTANTS.BATCH_WEIGHT_BUDGET) {
          bad.push(`${rel}:${no} states a weight budget of ${claimed}, but BATCH_WEIGHT_BUDGET `
            + `is ${CONSTANTS.BATCH_WEIGHT_BUDGET}`);
        }
      } else {
        const claimed = Number(m[1]);
        if (!legal.has(claimed)) {
          bad.push(`${rel}:${no} says something weighs ${claimed}, a value BATCH_COMMAND_WEIGHTS `
            + `does not carry (legal: ${[...legal].sort((a, b) => a - b).join(', ')})`);
        }
      }
    }
  }
  assert.deepStrictEqual(bad, [],
    'these state a batch weight that disagrees with protocol/constants.js:\n' + bad.join('\n'));
});

test('the batch pages teach every weight class at its current value', () => {
  for (const rel of WEIGHT_PAGES) {
    const src = fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
    assert.match(src, new RegExp(`weight\\s+budget\\s+of\\s+\\*{0,2}${CONSTANTS.BATCH_WEIGHT_BUDGET}\\b`, 'i'),
      `${rel} never states the current weight budget (${CONSTANTS.BATCH_WEIGHT_BUDGET})`);
    assert.match(src, /default\s+weight\s+of\s+\*{0,2}1\b/i,
      `${rel} never states the default weight of 1`);
    for (const [action, w] of Object.entries(CONSTANTS.BATCH_COMMAND_WEIGHTS)) {
      assert.match(src, new RegExp('`' + action + '`[^\\n]*\\b' + w + '\\b'),
        `${rel} never puts \`${action}\` on a line with its current weight ${w}`);
    }
  }
});

// The indexer arms BATCH_COST_WEIGHTING at genesis on mainnet, so the batch pages must not call
// the weighted budget testnet-only or upcoming; keyed on that mainnet value, so it asserts
// nothing if it ever moves to a future instant.
const STALE_WEIGHT_STATUS = /testnet and regtest only|not yet\b[^.]*\bmainnet|once cost weighting activates|at\/after the cost-weighting activation|today a batch is bounded by a flat count/i;

/** Lines of the batch pages that describe the weighted budget as not live on mainnet. */
function staleWeightStatusLines(pages) {
  const bad = [];
  for (const [rel, src] of pages) {
    src.split('\n').forEach((line, i) => {
      if (/weight|budget/i.test(line) && STALE_WEIGHT_STATUS.test(line)) bad.push(`${rel}:${i + 1}`);
    });
  }
  return bad;
}

test('the batch pages do not call the weighted budget off on mainnet while the indexer arms it at genesis',
  { skip: noIndexerBatch }, () => {
    const src = readModuleSource(moduleEntry(path.resolve(ROOT,
      '../xchain-indexer/src/protocol_changes/flag_times_batch_fees.js')));
    const m = /const\s+BATCH_COST_WEIGHTING_MAINNET_TIME\s*=\s*(\d+)\s*;/.exec(src);
    assert.ok(m, 'BATCH_COST_WEIGHTING_MAINNET_TIME declaration not found in xchain-indexer/src/'
      + 'protocol_changes/flag_times_batch_fees.js; the declaration shape changed, re-point this regex');
    if (Number(m[1]) !== 0) return;
    const pages = WEIGHT_PAGES.map((rel) => [rel, fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8')]);
    const bad = staleWeightStatusLines(pages);
    assert.deepStrictEqual(bad, [],
      'these lines say the weighted BATCH budget is not live on mainnet, but BATCH_COST_WEIGHTING is '
      + 'armed at genesis there (effective with BATCH_ISSUANCE_LIMITS):\n' + bad.join('\n'));
  });

test('the weighted-budget status guard fires on the stale mainnet wording it exists to catch', () => {
  const stale = '*Unlike the batch limits above, the weighted budget is live on testnet and regtest only; '
    + 'it is not yet switched on for mainnet.*';
  assert.deepStrictEqual(staleWeightStatusLines([['x.md', stale]]), ['x.md:1']);
  const live = '*The weighted budget is in force on every network; on mainnet it took effect with the batch limits.*';
  assert.deepStrictEqual(staleWeightStatusLines([['x.md', live]]), []);
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
