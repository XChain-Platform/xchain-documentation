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
 * DEPLOY CODE_ENCODING gate.
 *
 * WHY. Inline DEPLOY v0/v1 contract code is base64 at and after the
 * DEPLOY_BASE64_CODE activation and hex before it. The indexer round-trips the
 * field and rejects non-canonical base64 (xchain-indexer/src/actions/deploy.js),
 * and protocol_changes enables the branch from genesis on testnet and regtest,
 * so a hex worked example has never run on the networks a developer tries
 * first. Mainnet passed the flag day on 2026-08-07.
 *
 * #3911 found two sites still on the old form: a `DEPLOY|1|<hex>|...` worked
 * example in protocol/contract-staking.md and an unqualified "hex-encoded"
 * claim in whitepaper.md.
 *
 * WHAT IT CHECKS.
 *
 *   1. No DEPLOY example uses a hex code placeholder.
 *   2. Any sentence calling contract code hex-encoded names the
 *      DEPLOY_BASE64_CODE activation, which is what makes it a history note
 *      rather than a current claim.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT  = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'test']);
// CHANGELOG entries are a dated record of what changed; they keep their wording.
const SKIP_FILES = new Set(['CHANGELOG.md']);

function markdownFiles() {
    const out = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!e.name.endsWith('.md') || SKIP_FILES.has(e.name)) continue;
            out.push(p);
        }
    };
    walk(DOC_ROOT);
    return out;
}

describe('DEPLOY contract-code encoding claims', () => {

    test('no DEPLOY example carries a hex code placeholder', () => {
        // Field 2 of a DEPLOY line is CODE_ENCODING; flag a placeholder that
        // names hex. `<base64_code>` and `<code>` are the accepted forms.
        const HEX_PLACEHOLDER = /\bDEPLOY\|\d+\|<[^>]*hex[^>]*>/i;
        const offenders = [];

        for (const p of markdownFiles()) {
            fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
                if (!HEX_PLACEHOLDER.test(line)) return;
                offenders.push(`${path.relative(DOC_ROOT, p)}:${i + 1}  ${line.trim()}`);
            });
        }

        assert.deepEqual(offenders, [],
            'DEPLOY examples using a hex code placeholder; inline code is base64 ' +
            'at/after DEPLOY_BASE64_CODE:\n  ' + offenders.join('\n  '));
    });

    test('every hex-encoded contract-code claim names the activation that ended it', () => {
        const offenders = [];

        for (const p of markdownFiles()) {
            fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
                // Sentence-scoped: one qualified mention must not excuse an
                // unqualified one elsewhere on the same line.
                for (const sentence of line.split(/(?<=[.;])\s+/)) {
                    if (!/\bhex[- ]encoded\b/i.test(sentence)) continue;
                    if (!/\b(contract|CODE_ENCODING|DEPLOY)\b/i.test(sentence)) continue;
                    if (/DEPLOY_BASE64_CODE/.test(sentence)) continue;
                    // A sentence naming base64 alongside hex is contrasting the two
                    // formats, not claiming hex is current.
                    if (/\bbase64\b/i.test(sentence)) continue;
                    offenders.push(`${path.relative(DOC_ROOT, p)}:${i + 1}  ${sentence.trim()}`);
                }
            });
        }

        assert.deepEqual(offenders, [],
            'unqualified hex-encoding claims about contract code; base64 is the ' +
            'active format, so a hex mention must cite DEPLOY_BASE64_CODE:\n  ' +
            offenders.join('\n  '));
    });
});
