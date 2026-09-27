'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const VENDORED = path.join(
    __dirname, '..', 'protocol', 'reference-impl', 'consensus', 'gate_registry', 'regtest_env.js',
);
const GIT_COMMON_DIR = execFileSync(
    'git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: path.join(__dirname, '..') },
).toString().trim();
const CANONICAL = path.resolve(
    GIT_COMMON_DIR, '..', '..', 'xchain-indexer', 'src', 'protocol_changes', 'regtest_env.js',
);

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('the vendored regtest environment helper matches the indexer canonical file', () => {
    assert.equal(sha256(VENDORED), sha256(CANONICAL));
});

test('the vendored regtest environment helper exports regtestTimeOverride', () => {
    const { regtestTimeOverride } = require(VENDORED);
    assert.equal(typeof regtestTimeOverride, 'function');
});
