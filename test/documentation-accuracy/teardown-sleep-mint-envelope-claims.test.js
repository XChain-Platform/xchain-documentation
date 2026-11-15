// Copyright © 2025–2026 Dankest, LLC
// Based on XChain Platform by Dankest, LLC – https://dankest.llc
//
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// This file is part of XChain Platform. Licensed under the GNU Affero
// General Public License v3.0 or later; see LICENSE.md. A commercial
// license (without AGPL source-disclosure terms) is available -
// contact legal@dankest.llc.

'use strict';

// Pins four claims that drifted from shipped behaviour:
//   1. the e2e stake-teardown budget default in the venue policy page,
//   2. the Mint Supply wording (a full-settings re-issue also mints),
//   3. the Taproot envelope vectors carry no provisional build-time wording,
//   4. the envelope header is read after decompilation, so push framing never decides recognition.
// Claims 1 and 2 also read a sibling source file and skip by name when it is absent.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('../helpers/sibling_checkout.js');

const DOC_ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8');

/* 1. The documented teardown budget default is the code default. */

const e2e = sibling('xchain-e2e-test', ['test/helpers/stakeTeardown.js']);

function documentedBudgetMs(policyText) {
    const row = policyText.split('\n').find((l) => l.startsWith('| `E2E_STAKE_TEARDOWN_BUDGET_MS` |'));
    assert.ok(row, 'staking-venue-policy.md no longer has an E2E_STAKE_TEARDOWN_BUDGET_MS row');
    return Number(row.split('|')[2].trim());
}

function codeBudgetMs() {
    const src = fs.readFileSync(path.join(e2e.root, 'test/helpers/stakeTeardown.js'), 'utf8');
    const m = src.match(/const DEFAULT_BUDGET_MS = (\d+) \* 60 \* 1000/);
    assert.ok(m, 'stakeTeardown.js no longer spells DEFAULT_BUDGET_MS as <minutes> * 60 * 1000; repoint this test');
    return Number(m[1]) * 60 * 1000;
}

test('the staking venue policy documents the teardown budget the harness applies', { skip: e2e.skip }, () => {
    const policy = read('components/e2e-test/staking-venue-policy.md');
    assert.equal(documentedBudgetMs(policy), codeBudgetMs());
    const stale = policy.replace('| 1200000 |', '| 600000 |');
    assert.notEqual(documentedBudgetMs(stale), codeBudgetMs(), 'the comparison must fail on a stale number');
});

/* 2. A full-settings re-issue that carries Mint Supply mints again. */

const issueSrc = sibling('xchain-indexer', ['src/actions/issue/index.js']);

test('the Mint Supply bullet names both re-issue paths and the lock that closes them', () => {
    const bullet = read('user-guide/creating-tokens.md').split('\n').find((l) => l.startsWith('- **Mint Supply**:'));
    assert.ok(bullet, 'creating-tokens.md no longer carries a "- **Mint Supply**:" bullet');
    assert.doesNotMatch(bullet, /only by sending a mint-settings edit/);
    assert.match(bullet, /mint-settings edit/);
    assert.match(bullet, /full-settings re-issue/);
    assert.match(bullet, /Lock Mint Supply to close both paths/);
});

test('the full-settings ISSUE format still carries MINT_SUPPLY', { skip: issueSrc.skip }, () => {
    const src = fs.readFileSync(path.join(issueSrc.root, 'src/actions/issue/index.js'), 'utf8');
    const f0 = src.match(/this\.formats\[0\]\s*=\s*'([^']*)'/);
    assert.ok(f0, 'issue/index.js no longer declares formats[0] as a string literal');
    assert.ok(f0[1].split('|').includes('MINT_SUPPLY'), 'format 0 no longer carries MINT_SUPPLY; the guide wording is stale');
});

/* 3. The envelope vectors state settled rules as rules. */

test('the envelope vector file carries no provisional build-time wording', () => {
    const raw = read('protocol/test-vectors/taproot_envelope.json');
    assert.doesNotMatch(raw, /once review lands|build_time_task|build-time task/);
    const spec = read('protocol/taproot-envelope.md');
    assert.match(spec, /the action's source is \*\*the address that funded the commit\*\*/);
    assert.match(spec, /Fee sufficiency is evaluated against \*\*the requirement in force at the reveal's block height\*\*/);
});

/* 4. Header framing is read after decompilation. */

// Decompile a script the way a canonicalising decompiler does: an empty push is OP_0, a lone
// 0x01-0x10 / 0x81 byte is OP_N / OP_1NEGATE, anything else is data.
function decompile(buf) {
    const out = [];
    for (let i = 0; i < buf.length;) {
        const op = buf[i++];
        let len = -1;
        if (op >= 0x01 && op <= 0x4b) len = op;
        else if (op === 0x4c) { len = buf[i]; i += 1; }
        else if (op === 0x4d) { len = buf.readUInt16LE(i); i += 2; }
        else if (op === 0x4e) { len = buf.readUInt32LE(i); i += 4; }
        if (len < 0) { out.push(`op:${op}`); continue; }
        const data = buf.subarray(i, i + len);
        assert.equal(data.length, len, 'truncated push');
        i += len;
        if (len === 0) out.push('op:0');
        else if (len === 1 && data[0] >= 1 && data[0] <= 16) out.push(`op:${0x50 + data[0]}`);
        else if (len === 1 && data[0] === 0x81) out.push('op:79');
        else out.push(`data:${data.toString('hex')}`);
    }
    return out;
}

const VECTORS = JSON.parse(read('protocol/test-vectors/taproot_envelope.json'));
const GOLDEN = VECTORS.envelope_grammar.envelope_script_hex;
const FRAMING = VECTORS.header_framing.vectors;
const byName = (name) => FRAMING.find((v) => v.name === name);

test('each re-framed header vector decompiles to the golden element list', () => {
    const golden = decompile(Buffer.from(GOLDEN, 'hex'));
    const recognized = FRAMING.filter((v) => v.expect === 'recognized');
    assert.deepEqual(recognized.map((v) => v.name),
        ['nonminimal_op_false', 'nonminimal_magic_push', 'nonminimal_format_push', 'nonminimal_internal_key_push']);
    for (const v of recognized) {
        assert.notEqual(v.envelope_script_hex, GOLDEN, `${v.name} must differ from the golden bytes`);
        assert.deepEqual(decompile(Buffer.from(v.envelope_script_hex, 'hex')), golden, v.name);
        // The key vector re-frames the tail, so its header bytes stay literal; the others break the prefix.
        const keyVector = v.name === 'nonminimal_internal_key_push';
        assert.equal(v.envelope_script_hex.startsWith('0063045843484e0100'), keyVector, `${v.name} header bytes`);
        assert.equal(v.envelope_script_hex.endsWith('68' + '20' + VECTORS.envelope_grammar.internal_pubkey_xonly + 'ac'), !keyVector,
            `${v.name} key framing`);
    }
    assert.ok(GOLDEN.startsWith('0063045843484e0100'));
});

test('a bare OP_0 in the format position changes the decompiled header', () => {
    const golden = decompile(Buffer.from(GOLDEN, 'hex'));
    const bare = decompile(Buffer.from(byName('bare_op_0_format').envelope_script_hex, 'hex'));
    assert.equal(byName('bare_op_0_format').expect, 'not_recognized');
    assert.equal(golden[3], 'data:00');
    assert.equal(bare[3], 'op:0');
    assert.deepEqual(bare.filter((_, i) => i !== 3), golden.filter((_, i) => i !== 3));
});

test('the spec states the header rule the vectors pin', () => {
    const spec = read('protocol/taproot-envelope.md');
    assert.match(spec, /Every grammar element is read after decompilation, so push framing never affects recognition/);
    assert.match(spec, /`header_framing` vectors/);
});
