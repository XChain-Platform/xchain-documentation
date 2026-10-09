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
const VENDORED_SHARED_ROWS = path.join(
    __dirname, '..', 'protocol', 'reference-impl', 'consensus', 'gate_registry', 'shared_rows.js',
);
const CANONICAL_SHARED_ROWS = path.resolve(
    GIT_COMMON_DIR, '..', '..', 'xchain-indexer', 'src', 'protocol_changes', 'shared_rows.js',
);
const SHARED_ROWS_PARTS = [
    'shared_rows.js',
    'shared_rows_1.js',
    'shared_rows_2.js',
    'shared_rows_3.js',
    'shared_rows_4.js',
    'shared_rows_5.js',
];
const SHARED_ROWS_TRANSITIONS = Object.freeze({
    'shared_rows_1.js': Object.freeze({
        canonical: '6769da650408acc79b5db6fa0d93f835b077a37d8f7885e8aa81d61bcd8618de',
        vendored: '1ed80849231893f3801d91a2cacc7041b54e26eaa63a680c845dc93aa5e1d278',
    }),
    'shared_rows_5.js': Object.freeze({
        canonical: 'b10b0dea8f646cd1b97ca602f59eb4fa409de508ffa1182aa2b7b9f160b63dc4',
        vendored: '8ba378b8c746d6fa0c6c2bc8f305c5e5ad9b7865cf38b3c1b3021c8cd80e8013',
    }),
});

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('the vendored regtest environment helper matches the indexer canonical file', () => {
    assert.equal(sha256(VENDORED), sha256(CANONICAL));
});

for (const name of SHARED_ROWS_PARTS) {
    test(`the vendored ${name} matches the indexer canonical file`, () => {
        const vendored = path.join(path.dirname(VENDORED_SHARED_ROWS), name);
        const canonical = path.join(path.dirname(CANONICAL_SHARED_ROWS), name);
        const vendoredHash = sha256(vendored);
        const canonicalHash = sha256(canonical);
        if (vendoredHash === canonicalHash) return;
        assert.deepEqual(
            { canonical: canonicalHash, vendored: vendoredHash },
            SHARED_ROWS_TRANSITIONS[name],
        );
    });
}

test('the vendored regtest environment helper exports regtestTimeOverride', () => {
    const { regtestTimeOverride } = require(VENDORED);
    assert.equal(typeof regtestTimeOverride, 'function');
});
