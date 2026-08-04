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
 * Platform-map integrity gate.
 *
 * WHY. architecture/platform-map.html is an interactive diagram and
 * architecture/platform-map.json is the same graph published for tools
 * and AI agents. The HTML embeds its own copy of the JSON (the page is
 * self-contained by design), so there are two copies of one dataset in
 * this repo, and a hand edit to either one would silently fork them: a
 * human would see one topology while an agent walks another. The graph
 * also references itself (edges name node ids, flow steps name node and
 * edge ids), and a dangling reference renders as a hole in the diagram
 * with no error anywhere.
 *
 * WHAT IT CHECKS.
 *
 *   1. The JSON is structurally sound: ids unique, every edge endpoint
 *      is a real node, every flow step references a real node/edge.
 *   2. The graph embedded in the HTML deep-equals the published JSON.
 *   3. Both files are free of internal workspace references (they were
 *      authored from an internal snapshot and re-scrubbed on export).
 *   4. When the xchain-platform-ai workspace checkout is present as the
 *      parent directory (its architecture/xchain.likec4 is the declared
 *      source of truth for the service topology), every element and
 *      relationship modelled there is covered by this graph. The map is
 *      allowed to be a superset (it also models docs, websites, the
 *      contracts library, and DB internals the LikeC4 model elides);
 *      LikeC4 is the floor, not the ceiling. Skipped in a standalone
 *      clone, same as the internal-link gate skips its sibling check.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, '..');
const HTML = path.join(DOC_ROOT, 'architecture/platform-map.html');
const JSON_FILE = path.join(DOC_ROOT, 'architecture/platform-map.json');
// In the platform workspace layout this repo is cloned inside the
// xchain-platform-ai checkout, so the LikeC4 model is the parent's.
const LIKEC4 = path.resolve(DOC_ROOT, '../architecture/xchain.likec4');

const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

describe('platform-map structural integrity', () => {
    test('node and edge ids are unique', () => {
        const nids = data.nodes.map((n) => n.id);
        const eids = data.edges.map((e) => e.id);
        assert.equal(new Set(nids).size, nids.length, 'duplicate node id');
        assert.equal(new Set(eids).size, eids.length, 'duplicate edge id');
    });

    test('every edge endpoint is a real node', () => {
        const nids = new Set(data.nodes.map((n) => n.id));
        for (const e of data.edges) {
            assert.ok(nids.has(e.source), `edge ${e.id}: unknown source ${e.source}`);
            assert.ok(nids.has(e.target), `edge ${e.id}: unknown target ${e.target}`);
        }
    });

    test('every flow step references a real node/edge, numbered from 1', () => {
        const nids = new Set(data.nodes.map((n) => n.id));
        const eids = new Set(data.edges.map((e) => e.id));
        for (const f of data.flows) {
            assert.ok(f.steps.length > 0, `flow ${f.id} has no steps`);
            f.steps.forEach((s, i) => {
                assert.equal(s.n, i + 1, `flow ${f.id}: step numbering gap at ${s.n}`);
                if (s.node) assert.ok(nids.has(s.node), `flow ${f.id} step ${s.n}: unknown node ${s.node}`);
                if (s.edge) assert.ok(eids.has(s.edge), `flow ${f.id} step ${s.n}: unknown edge ${s.edge}`);
            });
        }
    });
});

describe('platform-map HTML/JSON parity', () => {
    test('the graph embedded in the HTML equals the published JSON', () => {
        const html = fs.readFileSync(HTML, 'utf8');
        const m = html.match(/<script id="graph-data" type="application\/json">([\s\S]*?)<\/script>/);
        assert.ok(m, 'HTML has no graph-data block');
        assert.deepEqual(JSON.parse(m[1]), data,
            'platform-map.html embeds a different graph than platform-map.json; regenerate the JSON from the HTML');
    });
});

describe('platform-map scrub', () => {
    // These files were first authored against an internal workspace
    // snapshot; the export scrubs workspace paths, ledger ids, and
    // internal hosts. Keep the published copies clean on every edit.
    const PATTERNS = [
        ['workspace path', /\bclaude\//],
        ['ledger id', /\bXC-\d+/],
    ];
    for (const file of [HTML, JSON_FILE]) {
        test(`${path.basename(file)} carries no internal references`, () => {
            const text = fs.readFileSync(file, 'utf8');
            for (const [name, re] of PATTERNS) {
                assert.ok(!re.test(text), `${path.basename(file)}: found ${name} (${re})`);
            }
        });
    }
});

describe('platform-map covers the LikeC4 topology model', { skip: !fs.existsSync(LIKEC4) && 'xchain-platform-ai workspace checkout not present' }, () => {
    if (!fs.existsSync(LIKEC4)) return;
    const src = fs.readFileSync(LIKEC4, 'utf8');
    // The one id the two files spell differently.
    const ALIAS = { enduser: 'user' };
    const mapId = (id) => ALIAS[id] || id;

    // Elements: "name = kind 'Label'" declarations inside model { }.
    const model = src.slice(src.indexOf('model {'), src.indexOf('views {'));
    const elements = [...model.matchAll(/^\s*(\w+)\s*=\s*(?:actor|platform|service|library|database|external)\s+'/gm)]
        .map((m) => m[1])
        .filter((id) => id !== 'xchain'); // the enclosing platform boundary, not a component

    // Relationships: "a -> b" and "a -[kind]-> b".
    const rels = [...model.matchAll(/^\s*(\w+)\s*-(?:\[\w+\]-)?>\s*(\w+)/gm)]
        .map((m) => [m[1], m[2]]);

    test('parses a non-trivial model (guards against silent regex rot)', () => {
        assert.ok(elements.length >= 15, `only ${elements.length} elements parsed`);
        assert.ok(rels.length >= 20, `only ${rels.length} relationships parsed`);
    });

    test('every LikeC4 element exists in the platform map', () => {
        const nids = new Set(data.nodes.map((n) => n.id));
        for (const el of elements) {
            assert.ok(nids.has(mapId(el)), `LikeC4 element "${el}" missing from platform-map.json nodes`);
        }
    });

    test('every LikeC4 relationship exists in the platform map', () => {
        const pairs = new Set(data.edges.map((e) => `${e.source}>${e.target}`));
        for (const [a, b] of rels) {
            assert.ok(pairs.has(`${mapId(a)}>${mapId(b)}`),
                `LikeC4 relationship ${a} -> ${b} missing from platform-map.json edges`);
        }
    });
});
