'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const VENDORED = path.join(
    __dirname, '..', 'protocol', 'reference-impl', 'consensus', 'gate_registry', 'regtest_env.js',
);
const CANONICAL = '/Users/jdog/Sites/XChain-Platform/xchain-indexer/src/protocol_changes/regtest_env.js';

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
