/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025-2026 Dankest, LLC */

/*
 * Pins what the gated-content pages say about which gated FILEs count toward a
 * SEND's key handoff: every valid one, on the token's own chain, grouped per
 * (publisher, GATE_TICKER, KEY_HASH), with the GATE_MIN_AMOUNT exemption stated
 * wherever the handoff requirement is. XCHAIN_DOCS_ROOT aims the prose half at
 * another checkout so a tree with the old wording can be shown to fail.
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
const FILES_DB = path.join(INDEXER, 'db', 'files', 'index.js');
const FILE_ACT = path.join(INDEXER, 'actions', 'file.js');

const skipNoIndexer = sibling('xchain-indexer', [[FILES_DB], [FILE_ACT]]).skip;

const readDoc = (rel) => fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(readDoc(rel));

const send   = readDoc('protocol/actions/send.md');
const batch  = readDoc('protocol/actions/batch.md');
const gated  = readDoc('protocol/token-gated-content.md');
const tis    = readDoc('protocol/token-information-standard.md');
const terms  = readDoc('getting-started/key-terms.md');
const paper  = readDoc('whitepaper.md');

// Return the markdown line that starts with the given prefix, or fail naming it.
function lineStarting(md, prefix, label){
    const line = md.split('\n').find((l) => l.startsWith(prefix));
    assert.ok(line, `${label} has no line starting ${JSON.stringify(prefix)}`);
    return line;
}

// List every data_ref that a locked entry and an unlocked entry both use.
function sharedLockedRefs(doc){
    const entries = ['images', 'audio', 'video', 'files'].flatMap((k) => doc[k] || []);
    const locked = new Set(entries.filter((e) => e.locked === true && e.data_ref).map((e) => e.data_ref));
    return entries.filter((e) => e.locked !== true && locked.has(e.data_ref)).map((e) => e.data_ref);
}

// List every locked entry whose data_ref names a sibling chain (action:<COIN>:<index>).
function siblingChainLocked(doc){
    const entries = ['images', 'audio', 'video', 'files'].flatMap((k) => doc[k] || []);
    return entries.filter((e) => e.locked === true && /^action:[A-Z]+:/.test(String(e.data_ref || '')))
        .map((e) => e.name);
}

test('no gated-content page says a gated FILE can be superseded', () => {
    for(const [label, md] of [['send.md', send], ['token-gated-content.md', gated]]){
        assert.ok(!/not (?:been )?superseded/i.test(md), `${label} again says a gated FILE can be superseded; `
            + 'the indexer counts every valid gated FILE with no retirement path');
    }
});

test('send.md and the key rotation non-goal state that valid gated FILEs stay active', () => {
    assert.match(send, /A gated `FILE` stays active once it is recorded `valid`/,
        'send.md no longer says a valid gated FILE stays active');
    assert.match(send, /Only a chain reorg that rolls back the block holding the `FILE` removes it/,
        'send.md no longer names a reorg as the only way a gated FILE stops counting');
    const rotation = lineStarting(gated, '- **Key rotation.**', 'token-gated-content.md');
    assert.match(rotation, /Republishing does not retire the old files/,
        'the key rotation non-goal no longer says republishing leaves the old pack counting');
});

test('every statement of the handoff requirement carries the threshold exemption', () => {
    const composition = lineStarting(batch, '- `BATCH(SEND, MESSAGE)` is the canonical composition', 'batch.md');
    assert.match(composition, /unless every pack gating that token sets an unlock threshold/,
        'batch.md states the handoff MESSAGE as always required');
    assert.match(composition, /token-gated-content\.md#unlock-thresholds-gate_min_amount/,
        'batch.md no longer links the unlock-threshold section');
    const sendBullet = lineStarting(paper, '- **SEND** transfers balances.', 'whitepaper.md');
    assert.match(sendBullet, /unless every pack gating that token sets a `GATE_MIN_AMOUNT` unlock threshold/,
        'the white paper SEND bullet states the handoff MESSAGE as always required');
    assert.match(gated, /^### Unlock thresholds \(`GATE_MIN_AMOUNT`\)$/m,
        'the unlock-threshold heading batch.md links to is gone');
});

test('the TIS and glossary group packs by publisher, GATE_TICKER and KEY_HASH', () => {
    const packRow = lineStarting(tis, '| pack_id ', 'token-information-standard.md');
    assert.ok(!/groups by `KEY_HASH` directly/.test(packRow),
        'the TIS pack_id row again says the protocol groups packs by KEY_HASH alone');
    assert.match(packRow, /\(publisher, `GATE_TICKER`, `KEY_HASH`\) triple/,
        'the TIS pack_id row no longer names the publisher-inclusive pack triple');
    const keyHash = lineStarting(terms, '**KEY_HASH**:', 'key-terms.md');
    assert.ok(!/implicit pack identifier: two or more gated FILEs sharing the same `KEY_HASH`/.test(keyHash),
        'the KEY_HASH glossary entry again makes KEY_HASH alone the pack identifier');
    const pack = lineStarting(terms, '**Pack**:', 'key-terms.md');
    assert.match(pack, /by the same publisher sharing the same `GATE_TICKER` and `KEY_HASH`/,
        'the Pack glossary entry no longer includes the publisher in the pack key');
});

test('the pages state that gating covers only same-chain gated FILEs', () => {
    assert.match(gated, /The rule covers only gated `FILE`s on the token's own chain/,
        'token-gated-content.md no longer says the handoff rule covers only same-chain gated FILEs');
    const lockedRow = lineStarting(tis, '| locked ', 'token-information-standard.md');
    assert.match(lockedRow, /apply only to a gated FILE on the token's own chain/,
        'the TIS locked row no longer carries the same-chain caveat');
    const refRow = lineStarting(tis, '| data_ref ', 'token-information-standard.md');
    assert.match(refRow, /A sibling-chain FILE is not gated by the token/,
        'the TIS data_ref row no longer says a sibling-chain FILE is ungated');
});

test('the current TIS example keeps locked entries same-chain and unshared', () => {
    const current = readJson('protocol/json/token-information-standard-v1.1.2-example.json');
    assert.deepEqual(sharedLockedRefs(current), [],
        'a public entry in the current TIS example points at the same FILE as a locked entry');
    assert.deepEqual(siblingChainLocked(current), [],
        'a locked entry in the current TIS example points at a sibling-chain FILE the token cannot gate');
    // Prove both detectors fire: the frozen v1.1.1 example carries both layouts.
    const frozen = readJson('protocol/json/token-information-standard-v1.1.1-example.json');
    assert.deepEqual(sharedLockedRefs(frozen), ['action:12345'],
        'the shared-ref detector no longer sees the frozen v1.1.1 collision');
    assert.deepEqual(siblingChainLocked(frozen), ['stems.zip'],
        'the sibling-chain detector no longer sees the frozen v1.1.1 stems entry');
});

test('the gated pack source facts behind the prose still hold', { skip: skipNoIndexer }, () => {
    const db = readModuleSource(FILES_DB);
    const fn = db.match(/async getGatedPackThresholds\(tick\)\{[\s\S]*?\n    \},/);
    assert.ok(fn, 'db/files/index.js no longer defines getGatedPackThresholds as expected');
    const where = fn[0].match(/WHERE([\s\S]*?)ORDER BY/);
    assert.ok(where, 'getGatedPackThresholds no longer has a WHERE ... ORDER BY query');
    assert.deepEqual(where[1].replace(/\s+/g, ' ').trim(), "gf.gate_ticker = ? AND s.status = 'valid'",
        'getGatedPackThresholds now filters gated FILEs on more than ticker and valid status; '
        + 'the "stays active" wording in send.md and token-gated-content.md must be revisited');
    assert.match(fn[0], /let key\s*= publisher \+ '\|' \+ keyHash;/,
        'getGatedPackThresholds no longer keys a pack by publisher and KEY_HASH within a ticker');
    const file = readModuleSource(FILE_ACT);
    assert.match(file, /getTokenInfo\(data\['GATE_TICKER'\]/,
        'file.js no longer resolves GATE_TICKER against its own chain\'s token registry');
    assert.match(file, /tokenInfo\['OWNER'\] !== data\['SOURCE'\]/,
        'file.js no longer requires the gated FILE publisher to own GATE_TICKER');
});
