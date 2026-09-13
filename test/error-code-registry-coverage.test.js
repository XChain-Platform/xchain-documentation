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
 * Explorer error-code registry coverage gate.
 *
 * WHY. protocol/error-codes.md opens by calling itself the machine-readable
 * registry for the platform's HTTP APIs and promises the codes are append-only,
 * so a client may branch on them. Nothing enforced that promise from the emit
 * side: the explorer's batch address routes shipped INVALID_ADDRESSES,
 * TOO_MANY_ADDRESSES, INVALID_ADDRESS and the per-address READ_FAILED fallback
 * with no registry row, and the explorer's published OpenAPI enumerates no codes
 * at all, so the registry was the only contract surface and it was incomplete.
 *
 * This test re-derives the emitted set from the explorer source on every run and
 * fails naming any code that has no registry row.
 *
 * Collection is by `code:` line rather than by a bare literal scan, so the
 * ternary fallback form (`code: cond ? x : 'READ_FAILED'`) is caught alongside
 * the plain `code: 'X'` form. Only the three REST-side sources are read:
 * src/ws/ carries the WebSocket channel codes, which are a separate surface
 * documented in components/explorer/websocket.md and explicitly excluded by the
 * registry page's own closing note.
 *
 * xchain-explorer is a sibling repo in the monorepo checkout, not a dependency
 * of xchain-documentation. When it is absent (docs repo cloned on its own) the
 * source-derived assertion skips.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const ROOT          = path.resolve(__dirname, '..');
const EXPLORER_SRC  = path.resolve(ROOT, '../xchain-explorer/src');
const REGISTRY_PAGE = path.join(ROOT, 'protocol/error-codes.md');

// REST-side emit sites. src/ws/ is deliberately absent (separate surface).
const SOURCES = ['XChainExplorer.js', 'api.js', 'concurrencyGate.js']
    .map((file) => path.join(EXPLORER_SRC, file));

// Codes documented elsewhere on purpose. Each entry names where it lives, so a
// future addition is a documentation decision rather than a way to quiet the
// test. Loosening the collection regex is not the way to make this pass.
const DOCUMENTED_ELSEWHERE = Object.create(null);

const haveExplorer = SOURCES.every((file) => fs.existsSync(file));
const noExplorer   = 'sibling xchain-explorer not present in this checkout';

// Every SCREAMING_SNAKE string literal on a line that also carries `code:`.
function emittedCodes() {
    const found = new Map();
    for (const file of SOURCES) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
            if (!line.includes('code:')) return;
            for (const quoted of line.match(/'([A-Z][A-Z0-9_]{2,})'/g) || []) {
                const code = quoted.slice(1, -1);
                if (!found.has(code))
                    found.set(code, `${path.basename(file)}:${i + 1}`);
            }
        });
    }
    return found;
}

test('every explorer REST error code has a registry row', { skip: haveExplorer ? false : noExplorer }, () => {
    const registry = fs.readFileSync(REGISTRY_PAGE, 'utf8');
    const emitted  = emittedCodes();

    assert.ok(emitted.size > 20,
        `collected only ${emitted.size} codes from the explorer source; the emit `
        + 'shape changed, re-point the collection in this test');

    const missing = [];
    for (const [code, where] of emitted) {
        if (code in DOCUMENTED_ELSEWHERE) continue;
        if (!registry.includes('| `' + code + '` |'))
            missing.push(`${code} (emitted at ${where})`);
    }

    assert.deepEqual(missing, [],
        'protocol/error-codes.md calls itself the complete append-only registry, '
        + 'so every code the explorer emits needs a row there. Missing:\n  '
        + missing.join('\n  '));
});
