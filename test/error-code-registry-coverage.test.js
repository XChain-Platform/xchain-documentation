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
 * fails naming any code that has no row in the page's Explorer REST API section,
 * and any row in that section that nothing emits unless the row is marked
 * historical.
 *
 * Collection is by emit shape rather than by a bare literal scan. Five shapes
 * are read: a `code:` line, so the ternary fallback form
 * (`code: cond ? x : 'READ_FAILED'`) is caught alongside the plain `code: 'X'`
 * form; a status-map row (`CODE: [409, 'message']`), which the proof routes
 * declare and then send by reference as `code: code`; a positional helper
 * call (`error(res, 503, 'message', 'CODE')`), which the bridge panel routes
 * use; a `VmQueryError('CODE', ...)` throw, which the contract simulation
 * route forwards to the client as `code: e.code`; and a mirror-gate verdict
 * (`blocked: 'CODE'`), which the mirror gate sends by reference as
 * `code: blocked`. A new emit shape needs its own rule here, or its codes go
 * unchecked. Only the five REST-side sources are read for the registry
 * (contract/vm_query.js is one because its throws reach the wire through the
 * state-proof routes):
 * src/ws/ carries the WebSocket channel codes, which are a separate surface
 * documented in components/explorer/websocket.md and explicitly excluded by the
 * registry page's own closing note. The second test below holds that page's
 * Error Codes table equal to the codes src/ws/ sends, in both directions.
 *
 * xchain-explorer is a sibling repo in the monorepo checkout, not a dependency
 * of xchain-documentation. When the REPO is absent (docs repo cloned on its
 * own) the source-derived assertion skips. When the repo is present but one of
 * the emit sites below has moved, the gate FAILS naming the missing path:
 * keying the skip on the files rather than the repo is how a move would
 * silently unpin the whole registry check.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT          = path.resolve(__dirname, '..');
const EXPLORER      = path.resolve(ROOT, '../xchain-explorer');
const EXPLORER_SRC  = path.join(EXPLORER, 'src');
const REGISTRY_PAGE = path.join(ROOT, 'protocol/error-codes.md');

// REST-side emit sites. src/ws/ is deliberately absent (separate surface).
const SOURCES = ['XChainExplorer.js', 'api.js', 'http/concurrency_gate.js', 'contract/vm_query.js', 'http/bridge_panel_routes.js']
    .map((file) => path.join(EXPLORER_SRC, file));

// An entry file whose long methods were split keeps its path and gains a
// sibling directory of parts, so an emit site can sit in either. The explorer
// names those directories after the entry, except for its two top-level entries
// (XChainExplorer.js to src/explorer/, api.js to src/http/api_boot/), which is
// the same alias map the explorer's own source-text helper carries.
const PART_DIRS = {
    'XChainExplorer.js':          path.join(EXPLORER_SRC, 'explorer'),
    'api.js':                     path.join(EXPLORER_SRC, 'http/api_boot'),
    'http/concurrency_gate.js':   path.join(EXPLORER_SRC, 'http/concurrency_gate'),
};

// Every .js file under a directory, sorted, so the emit sites are read in a
// stable order however deep the split goes.
function jsFilesUnder(dir) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
    const out = [];
    for (const name of fs.readdirSync(dir).sort()) {
        const abs = path.join(dir, name);
        if (fs.statSync(abs).isDirectory()) out.push(...jsFilesUnder(abs));
        else if (name.endsWith('.js')) out.push(abs);
    }
    return out;
}

// Codes documented elsewhere on purpose. Each entry names where it lives, so a
// future addition is a documentation decision rather than a way to quiet the
// test. Loosening the collection regex is not the way to make this pass.
const DOCUMENTED_ELSEWHERE = Object.create(null);

// Repo presence only: a pinned file gone from a PRESENT explorer fails inside the test by
// name (readSource below). Skips by name on a bare clone; throws under XCHAIN_REQUIRE_SIBLINGS=1.
const noExplorer   = sibling('xchain-explorer').skip;

// The observability logger's first argument is an EVENT name, not a response
// code; a log line also carrying the Node errno as `code: err.code` would
// otherwise read that event name as a REST code the registry owes a row.
const LOGGER_EVENT = /\blog\.(?:trace|debug|info|warn|error|fatal)\(\s*'[A-Z][A-Z0-9_]*'/g;

// Key of a `CODE: [status, 'message']` status-map row, wherever it sits on the line
// (the first key shares its line with `let map = {`). The three-digit status keeps
// non-code constants such as `ROLES: ['EXPLORER']` out.
const STATUS_MAP_KEY = /\b([A-Z][A-Z0-9_]{2,})\s*:\s*\[\s*[0-9]{3}\s*,/g;

// A positional error helper called as `helper(res, status, message, 'CODE')`.
const STATUS_HELPER_CALL = /\(\s*res\s*,\s*[0-9]{3}\s*,/;

// A contract simulation throw, `new VmQueryError('CODE', message, status)`.
const VM_QUERY_THROW = /\bVmQueryError\(\s*'([A-Z][A-Z0-9_]{2,})'/g;

// A mirror-gate verdict, `{ blocked: 'CODE', annotate }`, sent later as `code: blocked`.
const MIRROR_BLOCKED = /\bblocked\s*:\s*'([A-Z][A-Z0-9_]{2,})'/g;

// Every SCREAMING_SNAKE string literal on a line that carries `code:` or a
// positional helper call, plus every status-map key, simulation throw and
// mirror-gate verdict, minus a logger event name leading that line's log call.
function emittedCodes() {
    const found = new Map();
    const files = SOURCES.slice();
    for (const [entry, dir] of Object.entries(PART_DIRS)) {
        if (!SOURCES.includes(path.join(EXPLORER_SRC, entry))) continue;
        files.push(...jsFilesUnder(dir));
    }
    for (const file of files) {
        // With the repo present, a missing emit site means the code moved and
        // this list has to follow it, never that the check may skip.
        assert.ok(fs.existsSync(file),
            path.relative(EXPLORER, file) + ' is gone from xchain-explorer; repoint SOURCES at the file the emit site moved to');
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
            const where   = `${path.basename(file)}:${i + 1}`;
            const record  = (code) => { if (!found.has(code)) found.set(code, where); };
            const emitted = line.replace(LOGGER_EVENT, '');
            for (const m of emitted.matchAll(STATUS_MAP_KEY)) record(m[1]);
            for (const m of emitted.matchAll(VM_QUERY_THROW)) record(m[1]);
            for (const m of emitted.matchAll(MIRROR_BLOCKED)) record(m[1]);
            if (!line.includes('code:') && !STATUS_HELPER_CALL.test(line)) return;
            for (const quoted of emitted.match(/'([A-Z][A-Z0-9_]{2,})'/g) || [])
                record(quoted.slice(1, -1));
        });
    }
    return found;
}

// The Explorer REST API section of the registry page, up to the next `## `
// heading: the JSON-RPC table below it uses the same row format, so a page-wide
// match would let a JSON-RPC row stand in for a REST one.
function restSection(page) {
    const start = page.indexOf('\n## Explorer REST API\n');
    assert.ok(start >= 0, 'protocol/error-codes.md lost its "## Explorer REST API" section');
    return page.slice(start + 1).split(/\n## /)[0];
}

// Codes and historical markers of the REST table rows.
function restRows(section) {
    const rows = new Map();
    for (const m of section.matchAll(/^\| `([A-Z][A-Z0-9_]+)` \|.*$/gm))
        rows.set(m[1], m[0].includes('**Historical:'));
    return rows;
}

// Emitted codes with no REST row, and REST rows nothing emits unless marked historical.
function registryDrift(emitted, rows) {
    const missing = [];
    for (const [code, where] of emitted) {
        if (code in DOCUMENTED_ELSEWHERE) continue;
        if (!rows.has(code)) missing.push(`${code} (emitted at ${where})`);
    }
    const phantoms = [...rows].filter(([code, historical]) => !historical && !emitted.has(code))
        .map(([code]) => code);
    return { missing, phantoms };
}

test('every explorer REST error code has a registry row', { skip: noExplorer }, () => {
    const rows    = restRows(restSection(fs.readFileSync(REGISTRY_PAGE, 'utf8')));
    const emitted = emittedCodes();

    assert.ok(emitted.size > 20,
        `collected only ${emitted.size} codes from the explorer source; the emit `
        + 'shape changed, re-point the collection in this test');

    assert.deepEqual(registryDrift(emitted, rows), { missing: [], phantoms: [] },
        'protocol/error-codes.md calls itself the complete append-only registry, so every '
        + 'code the explorer emits needs a REST row there, and a REST row nothing emits must '
        + 'carry a **Historical:** marker (or the emit shape that sends it needs a rule here)');
});

test('the REST registry check fails on a dropped row or an unemitted row', { skip: noExplorer }, () => {
    const page    = fs.readFileSync(REGISTRY_PAGE, 'utf8');
    const emitted = emittedCodes();
    for (const code of ['VM_BUSY', 'MIRROR_STALE']) {
        assert.ok(emitted.has(code), `${code} is no longer collected from the explorer source`);
        const dropped = page.replace(new RegExp('^\\| `' + code + '` \\|.*\\n', 'm'), '');
        assert.notEqual(dropped, page, `falsification fixture did not drop the ${code} row`);
        assert.deepEqual(registryDrift(emitted, restRows(restSection(dropped))).missing.map((m) => m.split(' ')[0]),
            [code]);
    }
    const fake    = '| `FAKE_GONE_CODE` | 400 | test | No |\n';
    const inRest  = page.replace('| `MISSING_PARAMETER` |', fake + '| `MISSING_PARAMETER` |');
    assert.deepEqual(registryDrift(emitted, restRows(restSection(inRest))).phantoms, ['FAKE_GONE_CODE']);
    const marked  = inRest.replace('| test |', '| test. **Historical: test.** |');
    assert.deepEqual(registryDrift(emitted, restRows(restSection(marked))).phantoms, []);
    const rpcRow  = page.indexOf('\n| `', page.indexOf('\n## JSON-RPC'));
    assert.ok(page.indexOf('\n## JSON-RPC') >= 0 && rpcRow >= 0, 'protocol/error-codes.md lost its JSON-RPC table');
    const inRpc   = page.slice(0, rpcRow + 1) + fake + page.slice(rpcRow + 1);
    assert.ok(inRpc.includes(fake), 'falsification fixture did not add the JSON-RPC row');
    assert.equal(restRows(restSection(inRpc)).has('FAKE_GONE_CODE'), false);
});

// The WebSocket error codes: a `sendError(client, 'CODE'` call or a `code: 'CODE'`
// result anywhere under src/ws/, read fresh each run.
function emittedWsCodes() {
    const wsDir = path.join(EXPLORER_SRC, 'ws');
    assert.ok(fs.existsSync(wsDir), 'src/ws is gone from xchain-explorer; repoint the WebSocket check');
    const found = new Map();
    for (const file of jsFilesUnder(wsDir)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(/sendError\([^,]+,\s*'([A-Z][A-Z0-9_]{2,})'|code:\s*'([A-Z][A-Z0-9_]{2,})'/g)) {
            const code = m[1] || m[2];
            if (!found.has(code)) found.set(code, path.relative(EXPLORER, file));
        }
    }
    return found;
}

test('the websocket.md Error Codes table matches the codes src/ws sends', { skip: noExplorer }, () => {
    const page    = fs.readFileSync(path.join(ROOT, 'components/explorer/websocket.md'), 'utf8');
    const start   = page.indexOf('\n## Error Codes\n');
    assert.ok(start >= 0, 'components/explorer/websocket.md lost its "## Error Codes" section');
    const table   = page.slice(start + '\n## Error Codes\n'.length).split(/\n(?:## |---\n)/)[0];
    const rows    = [...table.matchAll(/^\| `([A-Z][A-Z0-9_]+)` \|/gm)].map((m) => m[1]);
    const emitted = emittedWsCodes();

    assert.ok(emitted.size >= 8, `collected only ${emitted.size} codes from src/ws; the emit shape changed`);
    const missing  = [...emitted].filter(([code]) => !rows.includes(code)).map(([c, where]) => `${c} (${where})`);
    const phantoms = rows.filter((code) => !emitted.has(code));
    assert.deepEqual({ missing, phantoms }, { missing: [], phantoms: [] },
        'websocket.md Error Codes must list exactly the codes the WebSocket server sends');
});
