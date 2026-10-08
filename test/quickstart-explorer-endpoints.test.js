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
 * Explorer endpoints in the node-operator quickstart.
 *
 * WHY. The quickstart told new operators the JSON-RPC API was at /api and the
 * REST API at /rest. The explorer serves REST under /{COIN}/api/..., mounts
 * JSON-RPC at the root path, and serves /api as its API documentation page;
 * no /rest route exists. The API reference already said so.
 *
 * The prose side runs unconditionally; the source side skips by name when the
 * xchain-explorer sibling is absent.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const QUICKSTART = path.join(DOC_ROOT, 'getting-started', 'quickstart-node-operator.md');
const JSON_RPC_REL = 'src/http/api_boot/json_rpc.js';
const explorer = sibling('xchain-explorer', [JSON_RPC_REL]);

test('the quickstart names no /rest route and no coin-less JSON-RPC path', () => {
    const page = fs.readFileSync(QUICKSTART, 'utf8');
    assert.ok(!page.includes('localhost:18080/rest'),
        'the quickstart points at /rest, which the explorer does not serve');
    assert.doesNotMatch(page, /```\nhttp:\/\/localhost:18080\/api\n```/,
        'the quickstart offers /api as an API endpoint; it is the documentation page');
});

test('the quickstart shows the coin-prefixed REST form and the root JSON-RPC POST', () => {
    const page = fs.readFileSync(QUICKSTART, 'utf8');
    assert.match(page, /localhost:18080\/[A-Z]+\/api\/status/,
        'the quickstart lost its /{COIN}/api/ REST example');
    assert.match(page, /-X POST http:\/\/localhost:18080\/ /,
        'the quickstart lost its root-path JSON-RPC example');
});

test('xchain-explorer still mounts JSON-RPC at the root path', { skip: explorer.skip }, () => {
    const src = fs.readFileSync(path.join(explorer.root, JSON_RPC_REL), 'utf8');
    assert.match(src, /app\.use\(jsonRouter\(/,
        'the explorer no longer mounts its JSON-RPC router at the root, so the '
        + 'quickstart and the API reference may need to follow it');
});
