/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 * The protocol index must link every canonical JSON test vector.
 *********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const README = fs.readFileSync(path.join(ROOT, 'protocol/README.md'), 'utf8');
const VECTOR_DIR = path.join(ROOT, 'protocol/test-vectors');
const FIXTURES = fs.readdirSync(VECTOR_DIR).filter((name) => name.endsWith('.json')).sort();

function vectorLinks(markdown) {
    const rows = markdown.split('\n').filter((line) => line.startsWith('| [Conformance Test Vectors]'));
    assert.equal(rows.length, 1, 'protocol README must have exactly one conformance-vector row');
    return [...rows[0].matchAll(/\.\/test-vectors\/([^\s)]+\.json)/g)]
        .map((match) => match[1]).sort();
}

function assertIndexMatches(markdown) {
    const links = vectorLinks(markdown);
    const missing = FIXTURES.filter((name) => !links.includes(name));
    const dangling = links.filter((name) => !FIXTURES.includes(name));
    assert.deepEqual({ missing, dangling }, { missing: [], dangling: [] });
}

test('the protocol index links exactly the canonical JSON test vectors', () => {
    assert.ok(FIXTURES.length > 0, 'protocol/test-vectors has no JSON fixtures');
    assertIndexMatches(README);
});

test('falsification: omitted checkpoint and multipart fixtures are reported', () => {
    const stale = README
        .replace(/, \[checkpoints\]\([^)]*\)/, '')
        .replace(/, and \[multipart FILE reassembly\]\([^)]*\)/, '');
    assert.notEqual(stale, README, 'fixture links moved; repoint this falsification');
    assert.throws(() => assertIndexMatches(stale), (error) => {
        assert.match(error.message, /checkpoint_canonical\.json/);
        assert.match(error.message, /multipart_file\.json/);
        return true;
    });
});
