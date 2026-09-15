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
 * Explorer REST endpoint-count gate.
 *
 * WHY. component-map.md quotes hard numbers for the explorer's REST
 * surface. Those numbers were written by a 2026-06-20 audit and had gone stale
 * by 2026-07-27 (129/68 against a real 144/74), because the explorer gained BET,
 * oracle-fee-quote and preflight surfaces in between and nobody re-counted. A
 * prose number with no gate behind it rots silently, so this test re-derives the
 * counts from the explorer source on every run and fails when the doc drifts.
 *
 * The expected figures are read out of the doc rather than repeated here. An
 * earlier draft hard-coded them in both places, so a genuine source change fired
 * two failures at once and could be "fixed" by editing only the test, leaving the
 * prose readers see still wrong. With the doc as the single source, source drift
 * can only be settled by correcting the doc.
 *
 * The explorer registers its REST surface two different ways, and both are
 * counted here:
 *
 *   - a dispatch table built by setupUrls() in src/XChainExplorer.js, whose
 *     keys are matched by a single Express catch-all handler; and
 *   - a handful of hand-registered this.app.get/post routes that never reach
 *     the dispatch loop.
 *
 * Deriving the table means evaluating the object literal rather than parsing it
 * with a regex: duplicate keys collapse at runtime (the html section has one),
 * so a line count would over-report what the dispatch loop actually iterates.
 * The literal is sliced out by brace matching and evaluated on its own, because
 * the enclosing method also touches `this.app` and cannot run standalone.
 *
 * xchain-explorer is a sibling repo in the monorepo checkout, not a dependency
 * of xchain-documentation. When the REPO is absent (docs repo cloned on its
 * own) the source-derived assertions skip and only the doc's internal arithmetic
 * runs. When the repo is present but a file this gate reads has moved, the gate
 * FAILS naming the missing path, because a skip or an empty stand-in keyed on
 * the file is how a move would silently unpin it.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const COMPONENT_MAP  = path.resolve(__dirname, '../architecture/component-map.md');
const EXPLORER        = path.resolve(__dirname, '../../xchain-explorer');
const EXPLORER_SOURCE = path.join(EXPLORER, 'src/XChainExplorer.js');
// The three route-table modules setupUrls() now builds its object from, in the
// order it declares them. The explorer's own identity tool joins the same three
// in the same order (bin/explorer-identity.js routeTableSource), which is what
// keeps this gate and the explorer's route digest reading one surface.
const ROUTE_TABLES = ['static_and_html', 'api_methods', 'explorer_feeds']
    .map((name) => path.join(EXPLORER, 'src/explorer/routes', name + '.js'));

// The dispatch table's declaration text, wherever it lives: the entry file while
// setupUrls() held the literal, the joined route modules once they carry it.
const ROUTES_INDEX = path.join(EXPLORER, 'src/explorer/routes/index.js');

// The dispatch table itself. The explorer builds it in src/explorer/routes/,
// which exports routeTables() returning a fresh object with the same keys in
// the same order setupUrls() declared, so this gate loads it rather than
// re-parsing a literal out of source text. The text path stays for a checkout
// from before that move.
function dispatchTable() {
    if (fs.existsSync(ROUTES_INDEX)) {
        const { routeTables } = require(requireExplorerFile(ROUTES_INDEX));
        assert.equal(typeof routeTables, 'function',
            'src/explorer/routes/index.js no longer exports routeTables(); this gate needs updating');
        return routeTables();
    }
    return readDispatchTable(fs.readFileSync(requireExplorerFile(EXPLORER_SOURCE), 'utf8'));
}

// The class entry's text followed by every .js module under src/explorer/, in
// path order, as one string for the route-registration scans.
function explorerClassSource() {
    const files = [requireExplorerFile(EXPLORER_SOURCE)];
    if (fs.existsSync(EXPLORER_STAGES)) {
        const walk = (dir) => {
            for (const name of fs.readdirSync(dir).sort()) {
                const full = path.join(dir, name);
                if (fs.statSync(full).isDirectory()) walk(full);
                else if (name.endsWith('.js')) files.push(full);
            }
        };
        walk(EXPLORER_STAGES);
    }
    return files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}
const STATIC_MOUNTS   = path.join(EXPLORER, 'src/http/static_mounts.js');
// The hand-registered routes live in the class entry or in the stage modules
// it delegates to under src/explorer/ (mount.js today), so this gate reads the
// entry plus every module in that tree; a text read pinned to one file would
// count zero the moment the registrations moved and never fail.
const EXPLORER_STAGES = path.join(EXPLORER, 'src/explorer');

const doc = fs.readFileSync(COMPONENT_MAP, 'utf8');
const haveExplorer = fs.existsSync(path.join(EXPLORER, 'package.json'));

// Reads an explorer source file this gate is pinned to, failing with the path
// named when it is gone: with the repo present, a missing file means the code
// moved and this pin has to follow it, never that the assertion may skip.
function requireExplorerFile(file) {
    assert.ok(fs.existsSync(file),
        path.relative(EXPLORER, file) + ' is gone from xchain-explorer; repoint this gate at the file the behaviour moved to');
    return file;
}

// Pull the `let urls = { ... }` literal out of setupUrls() by brace matching and
// evaluate it. Returns { html, api, explorer, static } exactly as the running
// explorer sees it, duplicate keys already collapsed.
function readDispatchTable(source) {
    // `let urls = {` while the literal sat in setupUrls(), `urls : {` once the
    // tables became modules that declare the same object under the same name.
    let anchor = source.indexOf('urls : {');
    if (anchor === -1) anchor = source.indexOf('let urls = {');
    assert.notEqual(anchor, -1, 'neither setupUrls() nor the route-table modules declare the urls object; this gate needs updating');
    const open = source.indexOf('{', anchor);
    let depth = 0;
    let close = -1;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) { close = i; break; }
        }
    }
    assert.notEqual(close, -1, 'the urls literal in setupUrls() is unbalanced');
    // The literal's `static` bucket reads the explorer's mount list module by
    // its local binding name `staticMounts`, so the evaluation is given that one
    // binding, loaded from the real module; the counts this gate checks live in
    // the `api` and `explorer` buckets, which are inline.
    const staticMounts = require(requireExplorerFile(STATIC_MOUNTS));
    return new Function('staticMounts', 'return (' + source.slice(open, close + 1) + ')')(staticMounts);
}

// Hand-registered REST routes: this.app.get/post/put/delete whose path sits in
// the /:coin/api/... namespace. The catch-all '/{*path}', the static mounts and
// the non-namespaced routes (/icon, /relay, /openapi.json) are excluded, since
// the documented figure is scoped to /api and /explorer.
function readHandRegisteredApiRoutes(source) {
    const found = [];
    const re = /this\.app\.(get|post|put|delete)\(\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(source)) !== null) {
        if (m[2].startsWith('/:coin/api/')) found.push(m[1].toUpperCase() + ' ' + m[2]);
    }
    return found;
}

// The one number the doc states that is not a sum of the others.
function documentedFigure(label) {
    const re = new RegExp('(\\d+)\\s+' + label);
    const m = doc.match(re);
    assert.ok(m, 'component-map.md no longer states a figure for "' + label + '"');
    return Number(m[1]);
}

describe('explorer REST endpoint counts in component-map.md', () => {

    test('the doc still states a total and a per-namespace breakdown', () => {
        assert.match(doc, /\d+ REST endpoint patterns across the `\/api` and `\/explorer` namespaces/,
            'the explorer endpoint-count sentence changed shape; re-derive the figures');
        assert.match(doc, /\d+ `\/\{COIN\}\/api\/\.\.\.` and \d+ `\/\{COIN\}\/explorer\/\.\.\.` patterns in the dispatch table/,
            'the dispatch-table breakdown changed shape; re-derive the figures');
        assert.match(doc, /\d+ hand-registered `\/\{COIN\}\/api\/\.\.\.` routes/,
            'the hand-registered breakdown changed shape; re-derive the figures');
        assert.match(doc, /\d+ HTML page routes plus `\/openapi\.json`/,
            'the HTML page-route sentence changed shape; re-derive the figures');
    });

    test('the stated parts add up to the stated total', () => {
        const total = documentedFigure('REST endpoint patterns');
        const api   = documentedFigure('`/\\{COIN\\}/api/\\.\\.\\.` and');
        const expl  = documentedFigure('`/\\{COIN\\}/explorer/\\.\\.\\.` patterns');
        const hand  = documentedFigure('hand-registered');
        assert.equal(api + expl + hand, total,
            'the breakdown ' + api + ' + ' + expl + ' + ' + hand + ' does not sum to the stated total ' + total);
    });

    test('the dispatch-table counts match xchain-explorer source', { skip: !haveExplorer && 'xchain-explorer not present in this checkout' }, () => {
        const urls = dispatchTable();
        const api  = Object.keys(urls.api);
        const expl = Object.keys(urls.explorer);

        // A stray key in the wrong bucket would make the namespace labels in the
        // doc wrong even when the totals happen to line up.
        assert.deepEqual(api.filter(u => !u.startsWith('/{COIN}/api/')), [],
            'the api dispatch bucket holds a route outside the /api namespace');
        assert.deepEqual(expl.filter(u => !u.startsWith('/{COIN}/explorer/')), [],
            'the explorer dispatch bucket holds a route outside the /explorer namespace');

        const docApi  = documentedFigure('`/\\{COIN\\}/api/\\.\\.\\.` and');
        const docExpl = documentedFigure('`/\\{COIN\\}/explorer/\\.\\.\\.` patterns');
        const docHtml = documentedFigure('HTML page routes');

        assert.equal(api.length, docApi,
            'the explorer dispatch table now has ' + api.length + ' /api routes, not the documented ' + docApi);
        assert.equal(expl.length, docExpl,
            'the explorer dispatch table now has ' + expl.length + ' /explorer routes, not the documented ' + docExpl);
        assert.equal(Object.keys(urls.html).length, docHtml,
            'the explorer dispatch table now has ' + Object.keys(urls.html).length +
            ' HTML page routes, not the documented ' + docHtml);
    });

    test('the hand-registered /api route count matches xchain-explorer source', { skip: !haveExplorer && 'xchain-explorer not present in this checkout' }, () => {
        const routes  = readHandRegisteredApiRoutes(explorerClassSource());
        const docHand = documentedFigure('hand-registered');
        assert.equal(routes.length, docHand,
            'the explorer hand-registers ' + routes.length + ' /api routes, not the documented ' + docHand + ':\n  ' +
            routes.join('\n  '));
    });

    test('the surfaces the doc calls out by name are really registered', { skip: !haveExplorer && 'xchain-explorer not present in this checkout' }, () => {
        const source = explorerClassSource();
        const urls   = dispatchTable();
        const hand   = readHandRegisteredApiRoutes(source).join('\n');

        // The three surfaces added after the stale 2026-06-20 count, named in the
        // doc so a reader can tell which era the figures belong to.
        assert.ok(hand.includes('/:coin/api/oraclefeequote'), 'the oracle fee-quote route is gone; the doc names it');
        assert.ok(hand.includes('/:coin/api/preflight'),      'the preflight route is gone; the doc names it');
        assert.ok(Object.keys(urls.api).some(u => u.startsWith('/{COIN}/api/bets')),
            'the BET api routes are gone; the doc names betting feeds and bets');
    });
});
