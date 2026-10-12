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
 * How a controller payout leg's bps is read.
 *
 * WHY. The controller guard reads each leg's bps with parseInt of its string
 * form, so exponent notation and prefixed strings are read by their leading
 * digits (5e-7 as 5, 1e21 as 1). The spec described plain numeric truncation.
 * The read value is the one checked against the cap, stored and applied, so a
 * guard author needs the real rule.
 *
 * The prose side runs unconditionally; the source side skips by name when the
 * xchain-indexer sibling is absent.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { readModuleSource } = require('../lib/indexer-source.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const INDEXER = path.resolve(path.join(__dirname, '..'), '../xchain-indexer/src');
const GUARD = path.join(INDEXER, 'actions', 'execute', 'controller_guard.js');
const skipNoIndexer = sibling('xchain-indexer', [GUARD]).skip;
const spec = fs.readFileSync(path.join(DOC_ROOT, 'protocol', 'controller-bound-tokens.md'), 'utf8');

test('the controller guard still reads bps with parseInt', { skip: skipNoIndexer }, () => {
    const guard = readModuleSource(GUARD);
    assert.match(guard, /isNumeric\(leg\.bps\)\) \? parseInt\(leg\.bps\)/,
        'controller_guard.js no longer reads bps with parseInt. If a gate now truncates the '
        + 'number instead, controller-bound-tokens.md must describe both rules');
});

test('the spec states the parseInt read and its exponent-form cases', () => {
    assert.match(spec, /`parseInt` of the value's string form/,
        'controller-bound-tokens.md no longer says bps is read with parseInt of its string form');
    assert.match(spec, /`5e-7` reads as `5`/,
        'controller-bound-tokens.md no longer shows that an exponent-form bps reads by its leading digits');
});
