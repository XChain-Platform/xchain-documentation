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
 * Light-client mainnet status in prose.
 *
 * WHY. The light-client path rests on two activation maps: the per-block state
 * and content roots (STATE_COMMITMENT_ACTIVATION) and the checkpoint commitment
 * (CHECKPOINT_COMMITMENT_ACTIVATION). Both carry real mainnet heights, and the
 * activation page records those heights as crossed. A sentence calling the path
 * "gated off on mainnet pending a flag-day" therefore understates the protocol,
 * and nothing else in the tree reads the prose against the constants.
 *
 * WHAT IT CHECKS.
 *
 *   1. While both maps carry a mainnet height, the whitepaper and the scope page
 *      never call the base path pending a flag-day on mainnet, and never tie the
 *      escrow and contract-state proofs to "the same gate" as that base path.
 *   2. Those same pages still say the escrow and contract-state proofs are
 *      unarmed on mainnet, so a rewrite cannot overclaim in the other direction.
 *
 * Run: node --test test/light-client-mainnet-status-claims.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONSTANTS = require(path.join(ROOT, 'protocol', 'constants.js'));
const PAGES = ['whitepaper.md', 'concepts/scope-and-non-goals.md'];

const STALE = [
    /pending a flag-day/i,
    /mainnet pending/i,
    /gated off on mainnet/i,
    /behind the same gat/i,
    /activate with it/i,
    /unarmed on mainnet with the rest of it/i,
    /remaining work is mainnet flag-day activation/i,
];
const STAGED_UNARMED = /separately staged commitment[^.]*unarmed on mainnet/i;

function readDoc(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Return true when the map holds a non-null mainnet height under any mainnet key.
function armedOnMainnet(map) {
    return Object.entries(map || {}).some(([k, v]) => /mainnet/.test(k) && Number.isInteger(v) && v > 0);
}

function assertLightClientStatus(name, text) {
    for (const re of STALE) {
        assert.doesNotMatch(text, re,
            `${name} still calls the light-client path pending on mainnet (${re}), but `
            + 'protocol/constants.js arms both of its maps there; fix the prose, not the constant');
    }
    assert.match(text, STAGED_UNARMED,
        `${name} no longer says the escrow and contract-state proofs are a separately staged `
        + 'commitment that is unarmed on mainnet');
}

test('the base light-client maps both carry a mainnet height', () => {
    assert.ok(armedOnMainnet(CONSTANTS.STATE_COMMITMENT_ACTIVATION),
        'STATE_COMMITMENT_ACTIVATION has no mainnet height; the prose guard below is out of date');
    assert.ok(armedOnMainnet(CONSTANTS.CHECKPOINT_COMMITMENT_ACTIVATION),
        'CHECKPOINT_COMMITMENT_ACTIVATION has no mainnet height; the prose guard below is out of date');
});

test('prose states the light-client mainnet status the constants carry', () => {
    for (const rel of PAGES) assertLightClientStatus(rel, readDoc(rel));
});

test('falsification: the pending-flag-day wording is caught', () => {
    const stale = readDoc('concepts/scope-and-non-goals.md').replace(
        /and its mainnet activation heights have passed/,
        'gated off on mainnet pending a flag-day');
    assert.notEqual(stale, readDoc('concepts/scope-and-non-goals.md'),
        'the scope page sentence moved; re-point this falsification');
    assert.throws(() => assertLightClientStatus('scope page', stale));
});

test('falsification: dropping the staged-commitment caveat is caught', () => {
    const overclaim = readDoc('whitepaper.md').replace(/separately staged commitment/g, 'live commitment');
    assert.notEqual(overclaim, readDoc('whitepaper.md'),
        'the whitepaper caveat moved; re-point this falsification');
    assert.throws(() => assertLightClientStatus('whitepaper', overclaim));
});
