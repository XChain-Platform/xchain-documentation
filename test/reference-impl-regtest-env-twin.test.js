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
const SHARED_ROWS_SHA256 = Object.freeze({
    'shared_rows.js': '1db6bd06818eca6fc27a57858ac820592e6dc9e366e87e75be28ea099f8780dc',
    'shared_rows_1.js': '6769da650408acc79b5db6fa0d93f835b077a37d8f7885e8aa81d61bcd8618de',
    'shared_rows_2.js': '8c9ddc10be60387322faa3facbda25b7f17ac1c5ecefaf6340e78bb96dd7e496',
    'shared_rows_3.js': '89127614a54b9a4007b8e63f18c4f8abb0873d8f8cb0d3f31a1115d67485c2b4',
    'shared_rows_4.js': 'dec84cd5f6e10b5bc631eb3a68ddcdfa5e37c5fb10cdf01ddd43cbb35980dc9b',
    'shared_rows_5.js': 'c6749ca7043a9a0c3057ed3a7b4dfd92362dee351a9a3d7611efff69bfd1b7ae',
});

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('the vendored regtest environment helper matches the indexer canonical file', () => {
    assert.equal(sha256(VENDORED), sha256(CANONICAL));
});

for (const [name, expected] of Object.entries(SHARED_ROWS_SHA256)) {
    test(`the vendored ${name} matches the indexer canonical snapshot`, () => {
        const vendored = path.join(path.dirname(VENDORED_SHARED_ROWS), name);
        assert.equal(sha256(vendored), expected);
    });
}

test('the vendored regtest environment helper exports regtestTimeOverride', () => {
    const { regtestTimeOverride } = require(VENDORED);
    assert.equal(typeof regtestTimeOverride, 'function');
});
