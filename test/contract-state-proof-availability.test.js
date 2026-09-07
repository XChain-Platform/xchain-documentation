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
 * Contract-state proof availability in prose.
 *
 * WHY. The endpoint shipped, the contract_state_root slot was armed on BTC
 * regtest and from genesis on the three testnets, and five reader-facing
 * passages went on calling the route reserved, unimplemented, or a 501
 * UNSUPPORTED_VERSION. Nothing went red, because the handler and the prose have
 * no producer in common: the wrong status reached docs.xchain.io and the
 * explorer's served openapi.json, where client codegen reads it, so integrators
 * could gate off a working capability.
 *
 * WHAT IT CHECKS.
 *
 *   1. No prose page calls the contract-state proof endpoint unimplemented,
 *      reserved, deferred, or a 501/UNSUPPORTED_VERSION answer, for as long as
 *      the armed map has at least one entry for contract_state_root. The gate
 *      is conditional on the map on purpose: before arming, those sentences
 *      were true, and a guard that forbids a true sentence is a guard that gets
 *      deleted.
 *   2. UNSUPPORTED_VERSION is never named for this endpoint anywhere in the
 *      tree. The handler has no such branch at all, so the code is unreachable
 *      whatever the arming state.
 *
 * CHANGELOG.md is history, exempt from both: its entries were true when
 * written.
 *
 * xchain-explorer is a sibling repo in the monorepo checkout, not a dependency
 * of xchain-documentation. When it is absent (docs repo cloned on its own) the
 * armed-map read skips and check 2 still runs.
 *
 * Run: node --test test/contract-state-proof-availability.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT   = path.resolve(__dirname, '..');
const ACTIVATION = path.resolve(__dirname, '../../xchain-explorer/src/state_subtree_activation.js');

const haveExplorer = fs.existsSync(ACTIVATION);

// Every tracked .md page except history and vendored trees.
function docPages(dir, out) {
    out = out || [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'archive') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { docPages(full, out); continue; }
        if (!entry.name.endsWith('.md')) continue;
        if (entry.name === 'CHANGELOG.md') continue;
        out.push(full);
    }
    return out;
}

// Lines naming the contract-state proof surface, so a stale phrase about some
// other subject cannot be scored against this endpoint.
const SUBJECT = /contract[-_ ]state|contractStateProof|verifyContractStateProof/i;
const STALE   = /not yet implemented|not implemented|is reserved|\breserved;|deferred to a later|UNSUPPORTED_VERSION|returns 501|HTTP 501/i;

function staleLines(file) {
    const hits = [];
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        if (!SUBJECT.test(line)) return;
        if (!STALE.test(line)) return;
        hits.push(path.relative(DOC_ROOT, file) + ':' + (i + 1) + '  ' + line.trim());
    });
    return hits;
}

describe('contract-state proof availability in documentation', () => {
    test('no page calls the endpoint unimplemented while the slot is armed somewhere', { skip: !haveExplorer && 'xchain-explorer not present in this checkout' }, () => {
        const { STATE_SUBTREE_ACTIVATION } = require(ACTIVATION);
        const armed = Object.keys(STATE_SUBTREE_ACTIVATION.contract_state_root || {});
        if (armed.length === 0) return; // pre-arming: the stale sentences are true

        const hits = docPages(DOC_ROOT).flatMap(staleLines);
        assert.deepEqual(hits, [],
            'contract_state_root is armed on ' + armed.join(', ')
            + ' and the explorer serves the route, but these passages still say otherwise:\n  '
            + hits.join('\n  '));
    });

    test('UNSUPPORTED_VERSION is never named for this endpoint', () => {
        const hits = docPages(DOC_ROOT).flatMap((file) => {
            const out = [];
            fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                if (/UNSUPPORTED_VERSION/.test(line) && SUBJECT.test(line))
                    out.push(path.relative(DOC_ROOT, file) + ':' + (i + 1));
            });
            return out;
        });
        assert.deepEqual(hits, [],
            'the contract-state proof handler has no UNSUPPORTED_VERSION branch; documented at: ' + hits.join(', '));
    });
});
