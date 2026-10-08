/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC - https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 *
 * What the gated-SEND key-handoff rule rejects, and what it checks.
 *
 * WHY. Two spec sentences described a stricter rule than the indexer applies,
 * and a third-party indexer built from either would disagree on balances:
 *
 *   1. Four places said a missing handoff rejects "the SEND". The indexer judges
 *      each consolidated (DESTINATION, TICK) leg on its own, so only the leg whose
 *      recipient has no MESSAGE v2 is invalid and the other legs still settle.
 *   2. The validation rules said the sibling MESSAGE must be "structurally valid".
 *      The indexer checks only that a MESSAGE sibling with VERSION 2 and a matching
 *      DESTINATION is present, and never consults that MESSAGE's own verdict.
 *
 * WHAT IT CHECKS. The PROSE, which must no longer carry the stricter wording and
 * must state the per-leg and presence-only rule, and the SOURCE facts that wording
 * rests on, read out of the sibling indexer (skipped by name on a bare clone).
 *
 * XCHAIN_DOCS_ROOT points the prose half at another checkout, so the negative
 * control is runnable: aimed at a tree with the old wording, every prose test fails.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { readModuleSource } = require('../lib/indexer-source.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const INDEXER  = path.resolve(path.join(__dirname, '..'), '../xchain-indexer/src');
const SEND_DIR = path.join(INDEXER, 'actions', 'send');

const skipNoIndexer = sibling('xchain-indexer',
    [[path.join(SEND_DIR, 'index.js')], [path.join(SEND_DIR, 'gated_handoff.js')]]).skip;

const readDoc = (rel) => fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8');

const gated   = readDoc('protocol/token-gated-content.md');
const send    = readDoc('protocol/actions/send.md');
const advTok  = readDoc('developer-guide/advanced-token-features.md');

test('no page says a missing handoff rejects the whole SEND', () => {
    const wholeSend = [
        /rejects the `SEND` only/, /the `SEND` is rejected/,
        /SEND is rejected, sibling actions survive/, /indexer rejects the SEND if/,
    ];
    for(const [label, md] of [['token-gated-content.md', gated], ['send.md', send], ['advanced-token-features.md', advTok]]){
        for(const re of wholeSend){
            assert.ok(!re.test(md), `${label} again says a missing handoff rejects the whole SEND (${re}); `
                + 'the indexer rejects only the leg whose recipient lacks the MESSAGE');
        }
    }
});

test('the handoff pages state the per-leg rejection', () => {
    assert.match(gated, /applies this rule per leg of the `SEND`/,
        'token-gated-content.md no longer says the handoff rule is applied per leg');
    assert.match(send, /The rule is judged per leg/,
        'send.md no longer says the token-gated transfer rule is judged per leg');
    assert.match(advTok, /rejects only the leg whose recipient lacks the matching MESSAGE/,
        'advanced-token-features.md no longer says only the leg without a MESSAGE is rejected');
});

test('the validation rules describe a presence check, not MESSAGE validation', () => {
    assert.ok(!/structurally valid sibling/i.test(gated),
        'token-gated-content.md again says the sibling MESSAGE must be structurally valid; the '
        + 'indexer checks only VERSION 2 and a matching DESTINATION and ignores its verdict');
    assert.match(gated, /the `MESSAGE`'s own verdict is not consulted/,
        'token-gated-content.md no longer says the sibling MESSAGE\'s own verdict is ignored');
    assert.match(send, /never the sibling `MESSAGE`'s own verdict/,
        'send.md no longer says the sibling MESSAGE\'s own verdict is ignored');
});

test('the per-leg and presence-only source facts still hold', { skip: skipNoIndexer }, () => {
    const index = readModuleSource(path.join(SEND_DIR, 'index.js'));
    assert.match(index, /for\(let idx in sends\)[\s\S]*?processSendLeg\(/,
        'send/index.js no longer settles each consolidated leg through processSendLeg');
    assert.match(index, /error = await this\.checkGatedHandoff\(send, tokenInfo, data, ctx, error\)/,
        'processSendLeg no longer runs the handoff check per leg');
    const handoff = readModuleSource(path.join(SEND_DIR, 'gated_handoff.js'));
    const fn = handoff.match(/async findGatedHandoff\([\s\S]*?\n    \}/);
    assert.ok(fn, 'gated_handoff.js no longer defines findGatedHandoff as expected');
    assert.match(fn[0], /if\(ver !== '2'\) continue;/, 'findGatedHandoff no longer filters on VERSION 2');
    assert.ok(!/STATUS|params\[3\]|params\[1\]/.test(fn[0]),
        'findGatedHandoff now reads the sibling MESSAGE\'s verdict, COIN or ENCRYPTED_MESSAGE; '
        + 'the presence-only wording in token-gated-content.md and send.md must change');
});
