'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling, pinnedCommit } = require('./helpers/sibling_checkout.js');

const VENDORED = path.join(
    __dirname, '..', 'protocol', 'reference-impl', 'consensus', 'gate_registry', 'regtest_env.js',
);
const GIT_COMMON_DIR = execFileSync(
    'git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: path.join(__dirname, '..') },
).toString().trim();
// The canonical twin is the indexer checked out beside this repo, the same sibling every
// other cross-repo guard reads, so a release worktree compares against its own release
// indexer. A lane with no sibling beside it falls back to the main checkout's indexer.
const ADJACENT_INDEXER = path.resolve(__dirname, '..', '..', 'xchain-indexer');
const INDEXER_ROOT = fs.existsSync(path.join(ADJACENT_INDEXER, 'package.json'))
    ? ADJACENT_INDEXER : path.resolve(GIT_COMMON_DIR, '..', '..', 'xchain-indexer');
// Full sha of the indexer commit the vendored copies are compared against.
const XCHAIN_TWIN_COMMIT = 'e49fc3e32675457d84d8856f9a35283ae308cd13';
const indexer = sibling('xchain-indexer', [], { platformRoot: path.dirname(INDEXER_ROOT) });
const CANONICAL = 'src/protocol_changes/regtest_env.js';
const VENDORED_SHARED_ROWS = path.join(
    __dirname, '..', 'protocol', 'reference-impl', 'consensus', 'gate_registry', 'shared_rows.js',
);
const SHARED_ROWS_PARTS = [
    'shared_rows.js',
    'shared_rows_1.js',
    'shared_rows_2.js',
    'shared_rows_3.js',
    'shared_rows_4.js',
    'shared_rows_5.js',
];

function sha256(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function canonicalAt(rel) {
    return pinnedCommit(INDEXER_ROOT, XCHAIN_TWIN_COMMIT).show(rel);
}

test('the vendored regtest environment helper matches the indexer canonical file', { skip: indexer.skip }, () => {
    assert.equal(sha256(fs.readFileSync(VENDORED)), sha256(canonicalAt(CANONICAL)));
});

for (const name of SHARED_ROWS_PARTS) {
    test(`the vendored ${name} matches the indexer canonical file`, { skip: indexer.skip }, () => {
        const vendored = path.join(path.dirname(VENDORED_SHARED_ROWS), name);
        assert.equal(sha256(fs.readFileSync(vendored)), sha256(canonicalAt(`src/protocol_changes/${name}`)));
    });
}

test('the vendored regtest environment helper exports regtestTimeOverride', () => {
    const { regtestTimeOverride } = require(VENDORED);
    assert.equal(typeof regtestTimeOverride, 'function');
});
