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
 * Explorer host port in the developer tutorials.
 *
 * WHY. The tutorials run against the local xchain-node regtest stack, which
 * publishes the explorer on the host at EXPLORER_PORT_HTTP (18080); 8080 is
 * only the container-internal port. Four tutorials pointed the SDK and curl at
 * localhost:8080, so a reader who skipped hub discovery got connection refused.
 *
 * The prose side runs unconditionally; the source side skips by name when the
 * xchain-node sibling is absent.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const TUTORIAL_DIRS = ['developer-guide', 'getting-started'];
const DEFAULTS_REL = 'src/services/config_service/defaults.js';
const node = sibling('xchain-node', [DEFAULTS_REL]);

// List every markdown file under a docs directory, at any depth.
function markdownUnder(dir){
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if(e.isDirectory()) return markdownUnder(p);
        return e.name.endsWith('.md') ? [p] : [];
    });
}

test('no tutorial points at the container-internal explorer port', () => {
    const files = TUTORIAL_DIRS.flatMap((d) => markdownUnder(path.join(DOC_ROOT, d)));
    assert.ok(files.length > 5, `found only ${files.length} tutorial pages; the walk broke`);
    const hits = files.filter((f) => fs.readFileSync(f, 'utf8').includes('localhost:8080'))
        .map((f) => path.relative(DOC_ROOT, f));
    assert.deepStrictEqual(hits, [],
        'tutorial pages use localhost:8080, the explorer port inside the container. The '
        + 'regtest stack publishes the explorer on the host at EXPLORER_PORT_HTTP (18080).');
});

test('the regtest guide publishes the host port the tutorials use', () => {
    const guide = fs.readFileSync(path.join(DOC_ROOT, 'developer-guide', 'regtest-development.md'), 'utf8');
    assert.match(guide, /\| xchain-explorer \| 18080 \|/,
        'regtest-development.md no longer lists the explorer on host port 18080');
});

test('xchain-node still publishes the explorer on host port 18080', { skip: node.skip }, () => {
    const defaults = fs.readFileSync(path.join(node.root, DEFAULTS_REL), 'utf8');
    assert.match(defaults, /"EXPLORER_PORT_HTTP":\s*18080/,
        'xchain-node no longer defaults EXPLORER_PORT_HTTP to 18080, so the tutorials\' '
        + 'localhost:18080 explorer URLs may need to follow it');
});
