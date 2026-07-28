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
 * ACTION activation-model gate.
 *
 * WHY. Three separate pages told readers that the non-genesis ACTIONs
 * "activate at later block heights". They do not. Every one of the 36 actions
 * in protocol_changes.js is registered with an activation time AND height of 0
 * on all three networks; what gates them is condition 1 of isEnabled(), the
 * indexer's own protocol version. Non-zero thresholds in that registry all
 * belong to behaviour changes applied to already-live actions.
 *
 * The claim was wrong in a way that reads plausibly, survived a prior audit
 * round, and was even extended (BET was added to the "later" list during the
 * 2026-07-27 audit before the registry was actually read). That is the profile
 * of a fact worth pinning to source rather than to prose.
 *
 * WHAT IT CHECKS, against xchain-indexer/src/protocol_changes.js:
 *
 *   1. No ACTION carries a non-zero activation time or height.
 *   2. The version split the docs state (21 at 1.0.0, 15 at 2.0.0) is real.
 *   3. BET specifically is a 1.0.0 action, since that is the one the audit
 *      got backwards.
 *   4. The docs do not reintroduce the "actions activate at block heights"
 *      phrasing.
 *
 * The registry is parsed rather than required: protocol_changes.js is a class
 * that wants a live indexer to construct, and the addChange(...) calls are
 * literal enough to read directly.
 *
 * xchain-indexer is a sibling repo, not a dependency. Source-derived
 * assertions skip when it is absent; the prose check always runs.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, '..');
const REGISTRY = path.resolve(DOC_ROOT, '../xchain-indexer/src/protocol_changes.js');
const haveRegistry = fs.existsSync(REGISTRY);

// The 36 documented ACTIONs: one page per action under protocol/actions/.
const ACTIONS = fs.readdirSync(path.join(DOC_ROOT, 'protocol/actions'))
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => f.replace(/\.md$/, ''));

function readRegistry() {
    const src = fs.readFileSync(REGISTRY, 'utf8');
    const re  = /this\.addChange\(\s*'([A-Z_]+)'\s*,\s*'([\d.]+)'\s*,([^)]*)\)/g;
    const out = [];
    let m;
    while ((m = re.exec(src)) !== null) {
        out.push({
            name: m[1],
            version: m[2],
            thresholds: m[3].split(',').map((s) => s.trim()).filter((s) => s !== ''),
        });
    }
    assert.ok(out.length > 50, 'parsed only ' + out.length + ' addChange calls; the registry format changed');
    return out;
}

describe('ACTION activation model', () => {

    test('every ACTION is registered', { skip: !haveRegistry && 'xchain-indexer not present in this checkout' }, () => {
        const names = new Set(readRegistry().map((r) => r.name));
        const missing = ACTIONS.filter((a) => !names.has(a));
        assert.deepEqual(missing, [], 'documented actions absent from protocol_changes.js: ' + missing.join(', '));
    });

    test('no ACTION carries a non-zero activation time or height', { skip: !haveRegistry && 'xchain-indexer not present in this checkout' }, () => {
        const gated = readRegistry()
            .filter((r) => ACTIONS.includes(r.name))
            .filter((r) => r.thresholds.some((t) => t !== '0'))
            .map((r) => r.name + ' => ' + r.thresholds.join(','));
        assert.deepEqual(gated, [],
            'these ACTIONs now carry a real activation threshold, so the docs must stop saying ' +
            'version alone gates them:\n  ' + gated.join('\n  '));
    });

    test('the documented 21/15 version split matches the registry', { skip: !haveRegistry && 'xchain-indexer not present in this checkout' }, () => {
        const acts = readRegistry().filter((r) => ACTIONS.includes(r.name));
        const byVersion = {};
        for (const a of acts) (byVersion[a.version] = byVersion[a.version] || []).push(a.name);

        assert.deepEqual(Object.keys(byVersion).sort(), ['1.0.0', '2.0.0'],
            'actions are now registered at versions beyond 1.0.0/2.0.0: ' + Object.keys(byVersion).join(', '));
        assert.equal(byVersion['1.0.0'].length, 21, 'v1.0.0 action count changed; update the docs');
        assert.equal(byVersion['2.0.0'].length, 15, 'v2.0.0 action count changed; update the docs');
        assert.ok(byVersion['1.0.0'].includes('BET'),
            'BET moved off 1.0.0; concepts/ACTIONS.md and components/indexer/ACTIONS.md name it as a 1.0.0 action');
    });

    // Guards the prose itself, so the corrected pages cannot quietly regress.
    test('no page claims that ACTIONs activate at block heights', () => {
        const bad = [];
        const walk = (dir) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
                const p = path.join(dir, e.name);
                if (e.isDirectory()) { walk(p); continue; }
                if (!e.name.endsWith('.md')) continue;
                const text = fs.readFileSync(p, 'utf8');
                // The claim, in the shapes it actually appeared in.
                if (/actions? activate at (later |specific )?block heights?/i.test(text)
                    || /actions (are )?activate[sd]? at later block/i.test(text))
                    bad.push(path.relative(DOC_ROOT, p));
            }
        };
        walk(DOC_ROOT);
        assert.deepEqual(bad, [],
            'these pages say ACTIONs activate at block heights; they are gated by indexer version ' +
            '(all 36 carry zero thresholds):\n  ' + bad.join('\n  '));
    });
});
