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
 * SDK action-surface gate: which actions, not how many.
 *
 * WHY. action-count-claims.test.js pins the integers, and integers are the
 * cheap half of the problem. On 2026-07-29, with every count correct, the
 * sessions.md convenience-method table was still missing `bet` and `vote` and
 * still implied `batch` was among them. A reader counting the table would have
 * got a plausible number and the wrong set, which is precisely the drift a
 * count guard cannot see.
 *
 * That same session also produced the mistake this file exists to stop: the
 * sessions.md count was "corrected" from 30 to 31 using the XChainSDK builder
 * list, which is the wrong authority for a page about sessions. Sessions expose
 * 30 of the 31 action types; BATCH is composed with the batch builder instead.
 * Two nearly identical surfaces, two different correct numbers.
 *
 * WHAT IT CHECKS, against xchain-sdk source rather than against prose:
 *
 *   1. concepts/actions.md names every action in protocol/actions/.
 *   2. components/sdk/actions.md names exactly the SDK-invocable set, and
 *      never the five that are not invocable, so nobody goes looking for a
 *      builder that does not exist.
 *   3. The sessions.md convenience table lists exactly the action types
 *      walletSession.js actually exposes.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SPECS = path.join(ROOT, 'protocol', 'actions');
const SDK = path.join(ROOT, '..', 'xchain-sdk', 'src');
const SDK_MAIN = path.join(SDK, 'XChainSDK.js');
const SDK_SESSION = path.join(SDK, 'walletSession.js');
const haveSdk = fs.existsSync(SDK_MAIN) && fs.existsSync(SDK_SESSION);

/** Actions that exist but are never user-submittable, so never in the SDK. */
const NOT_INVOCABLE = ['ANCHOR', 'ATTEST', 'NODEPROOF', 'ROLLCALL', 'SLASH', 'XCALL'];

const NAMED = fs.readdirSync(SPECS)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => f.replace(/\.md$/, '').toUpperCase())
  .sort();

/** Action names for which `source` defines a method of the same name. */
function methodsFor(source) {
  return NAMED.filter((n) => new RegExp(`\\n\\s*(async\\s+)?${n.toLowerCase()}\\s*\\(`, 'i').test(source)).sort();
}

function doc(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Actions named anywhere in a document. */
function named(text) {
  return NAMED.filter((n) => new RegExp(`\\b${n}\\b`).test(text)).sort();
}

test('concepts/actions.md names every action that has a spec', () => {
  const missing = NAMED.filter((n) => !named(doc('concepts/actions.md')).includes(n));
  assert.deepStrictEqual(missing, [],
    'the canonical ACTION concept page does not mention: ' + missing.join(', '));
});

test('the SDK reference covers exactly the invocable set',
  { skip: !haveSdk && 'xchain-sdk not present in this checkout' }, () => {
    const invocable = methodsFor(fs.readFileSync(SDK_MAIN, 'utf8'));
    assert.deepStrictEqual(invocable, NAMED.filter((n) => !NOT_INVOCABLE.includes(n)),
      'the SDK builder methods no longer match "every action except ' + NOT_INVOCABLE.join(', ')
      + '". Re-derive the split before touching the docs.');

    const listed = named(doc('components/sdk/actions.md'));
    const missing = invocable.filter((n) => !listed.includes(n));
    const bogus = NOT_INVOCABLE.filter((n) => listed.includes(n));

    assert.deepStrictEqual(missing, [],
      'components/sdk/actions.md documents the SDK surface but never mentions: ' + missing.join(', '));
    assert.deepStrictEqual(bogus, [],
      'components/sdk/actions.md names actions the SDK cannot build, which sends a developer '
      + 'hunting for a method that does not exist: ' + bogus.join(', '));
  });

test('the session convenience table lists exactly the session methods',
  { skip: !haveSdk && 'xchain-sdk not present in this checkout' }, () => {
    const sessionActions = methodsFor(fs.readFileSync(SDK_SESSION, 'utf8'));

    // Only the convenience-method table, not the whole page: the prose below it
    // discusses BATCH and the version-pinned variants by name on purpose.
    const page = doc('components/sdk/sessions.md');
    const from = page.indexOf('### Available Action Methods');
    assert.notStrictEqual(from, -1, 'the "Available Action Methods" heading moved; re-point this test');
    const table = page.slice(from, page.indexOf('\n###', from + 1));

    const listed = [...new Set([...table.matchAll(/`([a-z][a-zA-Z]*)`/g)].map((m) => m[1].toUpperCase()))];
    const missing = sessionActions.filter((n) => !listed.includes(n));
    const absent = listed.filter((n) => NAMED.includes(n) && !sessionActions.includes(n));

    assert.deepStrictEqual(missing, [],
      'walletSession.js exposes these action types and the table omits them: ' + missing.join(', '));
    assert.deepStrictEqual(absent, [],
      'the table offers action methods the session does not have: ' + absent.join(', '));
  });
