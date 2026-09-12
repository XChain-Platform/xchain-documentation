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
 * Bridge and token-bridge doc verdict-string conformance (lane L9,
 * build-through run: base spec row B12, token spec row T9, policy spec
 * row 7's docs share).
 *
 * WHY. These docs are read by wallet, SDK and dApp authors who copy the
 * verdict strings verbatim to detect a specific refusal. A doc that
 * paraphrases or typos a verdict is worse than one that omits it: a client
 * built against the paraphrase never matches the real `STATUS` string the
 * indexer emits. This test pins the verdict strings this lane's docs state
 * against the wire-exact strings the three specs rule (byte for byte,
 * quoted from `xchain-bridge.md`, `xchain-token-bridge.md`
 * and `xchain-token-bridge-policy.md`), so a doc edit that drifts from the
 * consensus string fails loudly here instead of shipping silently wrong.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Verdict strings this lane's docs must state, quoted byte for byte from
// the three ruled specs (never retyped or paraphrased at the call site).
const VERDICTS = {
  'protocol/actions/xbridge.md': [
    'invalid: XBRIDGE before activation',
    'invalid: XBRIDGE (BTC only)',
    'invalid: XBRIDGE v1 is not valid on BTC',
    'invalid: XBRIDGE v2 is system-injected',
    'invalid: ORIGIN_ADDRESS',
    'invalid: TICK (not native here)',
    'invalid: XBRIDGE v5 is system-injected',
  ],
  'protocol/actions/issue.md': [
    'invalid: TICK (BTC-only)',
    'invalid: BRIDGE_CHAINS',
    'invalid: BRIDGE_CHAINS (locked)',
    'invalid: TICK (subassets are not bridgeable yet)',
    'invalid: TICK (policy-bound tokens are not bridgeable yet)',
    'invalid: TICK (bridged tokens cannot be policy-bound yet)',
    'invalid: TICK (policy list exceeds XPOLICY_MAX_MEMBERS)',
    // R8, amended into the token spec at 04:20Z: reserved future
    // chain roots and the four-character floor on new top-level ticks.
    'invalid: TICK (length)',
    'invalid: TICK (reserved)',
  ],
  'protocol/actions/list.md': [
    'invalid: LIST_ACTION_INDEX (bridge-owned)',
  ],
};

test('bridge action docs state the exact, unparaphrased verdict strings the specs rule', () => {
  for (const [file, verdicts] of Object.entries(VERDICTS)) {
    const text = read(file);
    for (const verdict of verdicts) {
      assert.ok(
        text.includes(verdict),
        `${file} is missing the exact verdict string "${verdict}"`
      );
    }
  }
});

test('the XBRIDGE format table on the action page names all six versions', () => {
  const text = read('protocol/actions/xbridge.md');
  for (let v = 0; v <= 5; v += 1) {
    assert.ok(
      text.includes(`Version \`${v}\``),
      `xbridge.md is missing a "Version \`${v}\`" heading`
    );
  }
});

test('ISSUE format 7 (bridge opt-in) params are documented', () => {
  const text = read('protocol/actions/issue.md');
  for (const field of ['BRIDGE_CHAINS', 'MIN_DEPTH', 'LOCK_BRIDGE']) {
    assert.ok(text.includes(`\`${field}\``), `issue.md is missing the \`${field}\` param`);
  }
  assert.ok(
    text.includes('Bridge opt-in'),
    'issue.md format 7 must be labelled "Bridge opt-in"'
  );
});

test('R8 tick-namespace reservation is documented in issue.md and the action index', () => {
  for (const file of ['protocol/actions/issue.md', 'protocol/actions/README.md']) {
    const text = read(file);
    assert.ok(
      text.includes('TICK_NAMESPACE_ACTIVATION'),
      `${file} must name the TICK_NAMESPACE_ACTIVATION flag`
    );
    assert.ok(
      /four.character/.test(text),
      `${file} must state the four-character floor on new top-level ticks`
    );
    assert.ok(
      /RESERVED_FUTURE_ROOTS/.test(text),
      `${file} must name the RESERVED_FUTURE_ROOTS list`
    );
  }
});

test('the policy-inheritance section exists exactly where the doc pages link it', () => {
  const text = read('protocol/token-bridge.md');
  assert.match(text, /^## Policy inheritance$/m);
  // every cross-reference this lane added to "#policy-inheritance" must
  // resolve to that exact heading slug (mirrors what
  // internal-link-integrity.test.js checks repo-wide, scoped here to this
  // lane's own edits so a slug rename is caught even before that suite runs).
  const referrers = ['protocol/actions/issue.md', 'protocol/actions/list.md', 'concepts/token-bridge.md'];
  for (const referrer of referrers) {
    const referrerText = read(referrer);
    if (referrerText.includes('#policy-inheritance')) {
      assert.match(
        referrerText,
        /token-bridge\.md#policy-inheritance/,
        `${referrer} links #policy-inheritance but not via token-bridge.md`
      );
    }
  }
});

test('gas.md no longer states XCHAIN is BTC-only without qualification', () => {
  const text = read('concepts/gas.md');
  // The three lines D50 named must each acknowledge the bridge's shadow
  // balance now that XBRIDGE exists, not read as an absolute platform-wide
  // BTC-only claim for XCHAIN's existence.
  assert.ok(
    /BTC only for now/.test(text),
    'gas.md fee-payment lines must qualify "BTC only" now that XCHAIN-balance fees off BTC are a stated future milestone, not a permanent limit'
  );
  assert.ok(
    /shadow balance/.test(text),
    'gas.md must mention the bridge shadow balance next to the BTC-only issuance statement'
  );
});
