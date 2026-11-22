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
 *********************************************************************/

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const constants = require('../protocol/constants.js');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

describe('per-block cap documentation', () => {
    test('CROSS_SETTLE mainnet arming matches the exported gate narrative', () => {
        const text = read('protocol/constants.js');
        assert.match(text, /CROSS_SETTLE_PER_BLOCK_CAP/);
        assert.match(text, /armed at genesis[\s\S]{0,80}mainnet|mainnet[\s\S]{0,80}armed at genesis/i);
        assert.doesNotMatch(text, /unarmed on mainnet|full effective backlog, exactly as it always has/i);
    });

    test('cross-chain DEX pages document the capped settlement order', () => {
        const spec = read('protocol/cross-chain-dex.md');
        const paper = read('whitepaper.md');
        const stale = /appl(?:y|ies) a match at the first block whose/i;
        assert.match(spec, /CROSS_SETTLE_MAX_PER_BLOCK/);
        assert.match(spec, /\(snapshot_block, match_id\)/);
        assert.match(spec, /overflow carries forward/i);
        assert.doesNotMatch(spec, stale);
        assert.doesNotMatch(paper, stale);
        assert.match(paper, new RegExp(`at most ${constants.CROSS_SETTLE_MAX_PER_BLOCK} matches per block`));
    });

    test('ATTEST documents its bounded expiry sweep', () => {
        const text = read('protocol/actions/attest.md');
        assert.match(text,
            /ORDER BY deadline_block ASC, action_index ASC LIMIT ATTEST_MAX_EXPIRIES_PER_BLOCK/);
        assert.match(text, /\(deadline_block, action_index\)/);
        assert.match(text, new RegExp(`ATTEST_MAX_EXPIRIES_PER_BLOCK[^\n]*` +
            `${constants.ATTEST_MAX_EXPIRIES_PER_BLOCK}[^\n]*per block`));
        assert.match(text, /overflow[^\n]*carr(?:y|ies) forward/i);
        for(const page of [
            'concepts/smart-contracts.md',
            'protocol/providers/README.md',
            'protocol/providers/llm.md',
        ]) assert.match(read(page), /expiry backlog[\s\S]{0,180}capped per block/i);
    });

    test('bridge pages document transfer and policy scheduling', () => {
        const action = read('protocol/actions/xbridge.md');
        const bridge = read('protocol/xchain-bridge.md');
        const policy = read('protocol/token-bridge.md');
        const concepts = read('concepts/token-bridge.md');
        assert.match(action, /XBRIDGE_MAX_PER_BLOCK/);
        assert.match(action, /XPOLICY_MAX_PER_BLOCK/);
        assert.match(action, /\(snapshot_block, transfer_id\)/);
        assert.match(bridge, new RegExp(`XBRIDGE_MAX_PER_BLOCK[\\s\\S]{0,100}` +
            `${constants.XBRIDGE_MAX_PER_BLOCK}[^\n]*per destination chain per block`));
        assert.match(policy, new RegExp(`XPOLICY_MAX_PER_BLOCK[\\s\\S]{0,100}` +
            `${constants.XPOLICY_MAX_PER_BLOCK}[\\s\\S]{0,80}per block per chain`));
        assert.match(policy, /\(snapshot_block, snapshot_id\)/);
        assert.match(policy, /policy_seq/);
        assert.match(concepts, /backlog|many bridge updates are waiting/i);
    });

    test('protocol index links each canonical implementation resource', () => {
        const text = read('protocol/README.md');
        for(const target of [
            './constants.js',
            './flag-days.md',
            './activation-catalogue.md',
            './reference-impl/consensus/stake_weighted_quorum.js',
            './test-vectors/stake_weighted_quorum.json',
        ]) assert.match(text, new RegExp(`\\]\\(${target.replaceAll('.', '\\.')}\\)`));
        assert.doesNotMatch(text, /\]\(\.\/(?:reference-impl\/consensus|test-vectors)\/\)/);
    });
});
