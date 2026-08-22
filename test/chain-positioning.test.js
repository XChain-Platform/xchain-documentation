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
 * Chain positioning: no bare closed-list definitions of the platform.
 *
 * WHY. XChain is a token platform for ANY blockchain. Adding a UTXO chain is a
 * configuration change (see blockchains.md), and account-model chains are a
 * public roadmap item (whitepaper §16, concepts/scope-and-non-goals.md).
 * Bitcoin, Litecoin, and Dogecoin are where it is LIVE TODAY, not what it is.
 *
 * The failure mode this guard exists for is quiet and one-directional. Every
 * page that introduces the platform reaches for the concrete roster because it
 * reads better than an abstraction, and a closed list stated as a definition
 * ("XChain is a metalayer on Bitcoin, Litecoin, and Dogecoin") is indistinguish-
 * able, to a reader, from a hard architectural limit. On the 2026-08-21 sweep
 * ten such sentences were live across the intro pages, the FAQ, the use-cases
 * page, the key-terms glossary, and the SDK and wallet component READMEs, while
 * overview.md and whitepaper.md were already saying the opposite on the same
 * site. Nothing was factually wrong; the positioning was, and no existing guard
 * could see it. Each new chain the platform adds rots another one of these, in
 * the direction of understating the product.
 *
 * THE HOUSE RULE: capability first, roster second, roster always time-stamped.
 *
 * WHAT IT CHECKS. One thing, deliberately narrow. A sentence fails when all
 * three hold:
 *
 *   1. it names the full three-chain roster (any order, "and"/"&"/bare-comma
 *      joins, full names or BTC/LTC/DOGE tickers), AND
 *   2. it carries a DEFINITIONAL verb phrase about the platform ("XChain is",
 *      "runs on top of", "brings ... to", "supports", ...), AND
 *   3. neither the sentence nor the 200 characters in front of it carries a
 *      qualifier that time-stamps the roster ("today", "currently", "the first
 *      three", "live in production on", "supported chain", "chain-agnostic",
 *      "any UTXO", "more chains", ...).
 *
 * Condition 3 is why the fix is almost always one word rather than a rewrite:
 * "Bitcoin, Litecoin, and Dogecoin today" passes, and says the true thing.
 *
 * A NEGATED capability claim ("SWAP does not support native coins (BTC, LTC,
 * DOGE) directly") is carved out ahead of condition 2: it scopes one feature
 * and cannot understate the platform's chain reach.
 *
 * WHAT IT DOES NOT CHECK. Roster ORDER (always "Bitcoin, Litecoin, and
 * Dogecoin"), and the many legitimate three-chain mentions that are not
 * definitions: per-chain parameter tables, coin-node inventories, flag-day
 * mechanics, dust thresholds, "Most Bitcoin, Litecoin, and Dogecoin wallets
 * support this natively". Those are facts about the three chains that are
 * deployed, and rewriting them would make the docs worse. Condition 2 is what
 * keeps them out, so widening the verb list is not a free change.
 *
 * Run: node --test test/chain-positioning.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/*
 * Paths this guard does not read. Kept short on purpose: an exemption is a
 * place the rule stops applying forever, so each one has to be a page whose
 * text is not ours to rewrite, not a page that was inconvenient to fix.
 */
const EXEMPT = [
  { prefix: 'CHANGELOG.md',
    why: 'history; entries were true when written and rewriting them is the actual lie' },
  { prefix: 'components/wallet/release/',
    why: 'verbatim store-listing copy already submitted to Chrome/Play/Apple/Microsoft/Snap; '
       + 'the text on file must match the text under review' },
  { prefix: 'components/wallet/privacy/',
    why: 'published legal text (single-purpose and privacy statements) quoted verbatim from '
       + 'what was filed with the stores' },
];

/** Chain families. All three must appear for a roster match. */
const FAMILIES = [
  /\b(?:Bitcoin|BTC)\b/i,
  /\b(?:Litecoin|LTC)\b/i,
  /\b(?:Dogecoin|DOGE)\b/i,
];

/*
 * A three-item run joined by commas and/or "and"/"&". Written as a run rather
 * than as "all three names appear somewhere in the sentence" so that a sentence
 * naming the chains in separate clauses ("Tokens on Bitcoin are not tokens on
 * Litecoin, even where Dogecoin ...") is not read as a roster claim.
 */
const NAME = '(?:Bitcoin|BTC|Litecoin|LTC|Dogecoin|DOGE)';
const JOIN = '(?:\\s*,\\s*(?:and\\s+|&\\s+)?|\\s+(?:and|&)\\s+)';
const ROSTER = new RegExp(`\\b${NAME}(?:'s)?${JOIN}${NAME}(?:'s)?${JOIN}${NAME}(?:'s)?\\b`, 'ig');

/*
 * Definitional verb phrases: the sentence is saying what the PLATFORM (or one
 * of its components, which readers generalize from) is or does, rather than
 * stating a fact about the deployed chains.
 */
const DEFINITIONAL = [
  /\bXChain\b[^.]{0,40}?\bis\b/i,
  /\bXChain (?:Platform |Wallet )?\w*\s?(?:runs|works|operates|supports|is deployed)\b/i,
  /\bruns (?:natively |independently |directly |simultaneously )?on\b/i,
  /\bruns on top of\b/i,
  /\ba token platform for\b/i,
  /\ba metalayer on\b/i,
  /\btoken protocol (?:that runs )?on\b/i,
  /\bbrings\b[^.]{0,60}\bto\b/i,
  /\bsupports?\b(?!\s+this\b)/i,
  /\bsupport\*?\*?:/i,
  /\bworks on\b/i,
  /\bavailable on\b/i,
  /\bdeployed (?:and running )?on\b/i,
];

/*
 * A NEGATED capability claim is never a positioning problem: "SWAP does not
 * support native coins (BTC, LTC, DOGE) directly" is scoping one action, not
 * defining the platform. Checked sentence-wide rather than at the verb, because
 * the negation and the verb are usually a word or two apart.
 */
const NEGATED = /\b(?:does not|doesn't|do not|don't|cannot|can't|never|no longer|is not|isn't)\s+(?:\w+\s+){0,2}(?:supports?|runs?|works?|available|deployed)\b/i;

/*
 * Qualifiers that time-stamp the roster or state the capability. Any one of
 * these, in the sentence or in the 200 characters before it, makes the roster a
 * snapshot rather than a definition, which is all the rule asks for.
 */
const QUALIFIER = new RegExp([
  'today',
  'currently',
  'at launch',
  'so far',
  'for now',
  'first three',
  'live (?:in production )?on',
  'supported (?:chain|blockchain|network)',
  'chains? (?:XChain |it |the platform )?(?:runs on|supports)',
  'any (?:blockchain|chain|UTXO|Bitcoin-compatible|number of blockchains|suitable chain)',
  'every (?:chain|blockchain|supported)',
  'all (?:chains|three chains|supported)',
  '(?:chain|blockchain)-agnostic',
  '(?:more|additional|new|future) chains',
  'adding (?:a |another )?(?:new )?(?:UTXO )?chain',
  'roadmap',
].join('|'), 'i');

/** Every prose page in the tree, minus the exemptions above. */
function markdownFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith('.md')) out.push(abs);
    }
  })(ROOT);
  return out.filter((abs) => {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    return !EXEMPT.some((x) => rel === x.prefix || rel.startsWith(x.prefix));
  }).sort();
}

/**
 * Split a page into sentences, keeping each one's line number and the 200
 * characters of page text that precede it. Sentences break on a newline or on
 * ". " / "; " so a qualifier in a neighbouring clause of the same sentence
 * still counts, while a qualifier three paragraphs away does not.
 */
function sentences(text) {
  const out = [];
  let line = 1;
  let buf = '';
  let start = 0;
  const flush = (endOffset) => {
    if (buf.trim()) out.push({ text: buf, line, before: text.slice(Math.max(0, start - 200), start) });
    buf = '';
    start = endOffset;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') { flush(i + 1); line++; continue; }
    buf += c;
    if ((c === '.' || c === ';') && text[i + 1] === ' ') flush(i + 2);
  }
  flush(text.length);
  return out;
}

/** True when the matched run actually names all three chain families. */
function isFullRoster(run) {
  return FAMILIES.every((f) => f.test(run));
}

function findBareDefinitions(rel, text) {
  const bad = [];
  for (const s of sentences(text)) {
    ROSTER.lastIndex = 0;
    let m;
    let roster = null;
    while ((m = ROSTER.exec(s.text))) {
      if (isFullRoster(m[0])) { roster = m[0]; break; }
    }
    if (!roster) continue;
    if (NEGATED.test(s.text)) continue;
    if (!DEFINITIONAL.some((d) => d.test(s.text))) continue;
    if (QUALIFIER.test(s.text) || QUALIFIER.test(s.before)) continue;
    bad.push({ rel, line: s.line, sentence: s.text.trim(), roster });
  }
  return bad;
}

test('the guard recognizes a bare closed-list definition', () => {
  // Two sentences that were live in the tree before the 2026-08-21 positioning
  // pass, pinned here so a future loosening of the heuristics is visible.
  const wasLive = [
    'XChain is a token protocol that runs on top of existing blockchains, '
      + 'specifically Bitcoin, Litecoin, and Dogecoin. It lets you create tokens.',
    '**metalayer**: A protocol that runs above an existing blockchain without '
      + 'modifying it. XChain is a metalayer on Bitcoin, Litecoin, and Dogecoin.',
  ];
  for (const sample of wasLive) {
    assert.equal(findBareDefinitions('sample.md', sample).length, 1,
      `this should be caught as a bare closed-list definition:\n${sample}`);
  }

  // And the one-word fix has to be enough, or the guard is unfixable.
  const fixed = [
    'XChain is a token protocol that runs on top of existing blockchains. It is '
      + 'chain-agnostic by design and live in production today on Bitcoin, Litecoin, and Dogecoin.',
    '**metalayer**: A protocol that runs above an existing blockchain without '
      + 'modifying it. XChain is a metalayer on any UTXO blockchain; today Bitcoin, Litecoin, and Dogecoin.',
    'The free window is identical on every supported chain (Bitcoin, Litecoin, and Dogecoin today).',
    // Negated capability claim: scopes one action, cannot understate chain reach.
    'It does not support native coins (BTC, LTC, DOGE) directly.',
    // A fact about the deployed chains, with no definitional verb.
    'Most Bitcoin, Litecoin, and Dogecoin wallets sign this message format natively.',
  ];
  for (const sample of fixed) {
    assert.deepEqual(findBareDefinitions('sample.md', sample), [],
      `a time-stamped roster must pass:\n${sample}`);
  }
});

test('no page defines XChain as a closed list of chains', () => {
  const files = markdownFiles();
  assert.ok(files.length > 50, 'the walker must be finding the documentation tree');

  const bad = [];
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    bad.push(...findBareDefinitions(rel, fs.readFileSync(abs, 'utf8')));
  }

  assert.deepEqual(bad.map((b) => `${b.rel}:${b.line}\n    ${b.sentence}`), [],
    'these sentences define XChain (or one of its components) as the three chains it happens to '
    + 'run on today. XChain is chain-agnostic: adding a UTXO chain is a configuration change, and '
    + 'account-model chains are on the roadmap. Time-stamp the roster rather than deleting it, '
    + 'which is usually one word: "Bitcoin, Litecoin, and Dogecoin today", "live in production '
    + 'today on ...", "every supported chain (Bitcoin, Litecoin, and Dogecoin today)", "the first '
    + 'three supported chains, not the definition of the platform". If the sentence is really a '
    + 'fact about the deployed chains rather than a definition, it should not be tripping the '
    + 'verb list in DEFINITIONAL; fix the sentence or add the page to EXEMPT with a reason:\n'
    + bad.map((b) => `${b.rel}:${b.line}\n    ${b.sentence}`).join('\n'));
});
