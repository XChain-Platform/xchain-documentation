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
 * XCALL client-integration boundary gate.
 *
 * WHY . A wallet e2e pass looked for a "cross-chain contract call"
 * flow, found no XCALL entry in any wallet form or composer dropdown, and
 * logged it as a wallet coverage gap. It is not one: XCALL v0 is emitted only
 * from inside contract code via xchain.emit.crossExecute(...), and XCALL v2 is
 * synthesized by every indexer from block height, so no client has anything to
 * submit. The client's whole request-side involvement is generic DEPLOY +
 * EXECUTE of a contract that happens to call crossExecute.
 *
 * Cross_Chain_Calls.md now states that boundary so the next reader does not
 * re-derive it. This gate keeps the statement and the machine-readable facts
 * it rests on from drifting apart:
 *
 *   - if XCALL/XEXEC ever become user-encodable or gain a wallet form, the
 *     manifest changes and the prose becomes wrong, so the gate fires and the
 *     doc has to be revisited rather than silently rotting;
 *   - if DEPLOY/EXECUTE ever stop being the user-facing surface the boundary
 *     points at, the same applies from the other direction.
 *
 * This is a documentation-consistency gate, not a protocol test. The on-chain
 * behaviour it describes is exercised on the XCALL drill venue.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const PROTOCOL_DIR = path.resolve(__dirname, '../protocol');
const MANIFEST     = require(path.join(PROTOCOL_DIR, 'action-manifest.json'));
const ARCH_DOC     = path.join(PROTOCOL_DIR, 'Cross_Chain_Calls.md');
const XCALL_DOC    = path.join(PROTOCOL_DIR, 'actions/XCALL.md');

const arch  = fs.readFileSync(ARCH_DOC, 'utf8');
const xcall = fs.readFileSync(XCALL_DOC, 'utf8');

describe('XCALL client-integration boundary', () => {

    // The boundary rests on XCALL never reaching a client's action surface.
    // Category alone is not enough: userEncodable/walletForm are the two flags
    // an action picks up when it does get one, so all three are pinned.
    for (const name of ['XCALL', 'XEXEC']) {
        test(name + ' is not a user-submittable action', () => {
            const entry = MANIFEST.actions[name];
            assert.ok(entry, name + ' missing from action-manifest.json');
            assert.notEqual(entry.category, 'wire-user',
                name + ' became wire-user; Cross_Chain_Calls.md "Client integration boundary" is now wrong');
            assert.notEqual(entry.userEncodable, true,
                name + ' became userEncodable; the SDK would need an encoder and the boundary section needs rewriting');
            assert.notEqual(entry.walletForm, true,
                name + ' gained a wallet form; the boundary section claims wallets expose none');
        });
    }

    // The other half of the claim: the request side IS reachable from a client,
    // just through generic contract tooling rather than an XCALL-specific form.
    for (const name of ['DEPLOY', 'EXECUTE']) {
        test(name + ' remains the client surface the boundary points at', () => {
            const entry = MANIFEST.actions[name];
            assert.ok(entry, name + ' missing from action-manifest.json');
            assert.equal(entry.userEncodable, true, name + ' is no longer user-encodable');
            assert.equal(entry.walletForm, true, name + ' no longer has a wallet form');
        });
    }

    test('the architecture doc carries the boundary section', () => {
        assert.match(arch, /^## Client integration boundary/m,
            'Cross_Chain_Calls.md lost its "Client integration boundary" section ');
        assert.match(arch, /^### Exercising the request side/m,
            'the boundary section lost its request-side recipe');

        // The recipe is only useful if it keeps naming the pieces a reader has
        // to assemble: both contract halves, the allowlist, and the emit call.
        for (const token of ['crossExecute', 'crossCallable', 'DEPLOY', 'EXECUTE']) {
            assert.ok(arch.includes(token),
                'the boundary section no longer mentions ' + token);
        }
    });

    test('the XCALL action doc still states the no-user-broadcast rule', () => {
        assert.match(xcall, /never broadcast by users/,
            'XCALL.md dropped the rule the client boundary is derived from');
        assert.match(xcall, /Version `0` - Request \(VM-emitted\)/,
            'XCALL v0 is no longer documented as VM-emitted');
    });
});
