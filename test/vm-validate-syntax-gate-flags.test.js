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
 * The validateSyntax gate flags named on the VM architecture page.
 *
 * WHY. Every flag defaults to true, so a caller that wires only the flags the
 * page names enforces each unnamed rule below its activation height and
 * rejects deploys the network accepts. The page said six gates while the code
 * read more, and new gates keep landing, so the list is checked against the
 * flags validateSyntax actually reads.
 *
 * Skips by name when the xchain-vm sibling is absent.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const PAGE = path.join(DOC_ROOT, 'components', 'vm', 'architecture.md');
const SYNTAX_REL = 'src/syntax.js';
const vm = sibling('xchain-vm', [SYNTAX_REL]);
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'eleven', 'twelve'];

// Collect every opts.enforce* flag validateSyntax reads.
function codeFlags(src){
    const body = src.match(/function validateSyntax\(code, opts\) \{([\s\S]*?)\n\}/);
    assert.ok(body, 'syntax.js lost validateSyntax(code, opts)');
    return [...new Set([...body[1].matchAll(/opts\.(enforce[A-Za-z]+) !== false/g)].map((m) => m[1]))];
}

// Return the syntax.js row of the module table.
function syntaxRow(markdown){
    const row = markdown.split('\n').find((line) => line.startsWith('| `syntax.js` |'));
    assert.ok(row, 'architecture.md lost its syntax.js row');
    return row;
}

test('the syntax.js row names every flag validateSyntax reads', { skip: vm.skip }, () => {
    const flags = codeFlags(fs.readFileSync(path.join(vm.root, SYNTAX_REL), 'utf8'));
    assert.ok(flags.length >= 7, `found only ${flags.length} flags; the parse broke`);
    const row = syntaxRow(fs.readFileSync(PAGE, 'utf8'));
    const missing = flags.filter((f) => !row.includes('`' + f + '`'));
    assert.deepStrictEqual(missing, [], 'architecture.md omits validateSyntax flags');
    const said = row.match(/threads (\w+) independent/);
    assert.ok(said, 'the syntax.js row no longer states how many flags it threads');
    assert.strictEqual(said[1], NUMBER_WORDS[flags.length],
        `the row says ${said[1]} flags; validateSyntax reads ${flags.length}`);
});
