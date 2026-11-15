/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025-2026 Dankest, LLC */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(
    path.join(__dirname, '..', 'protocol', 'token-gated-content.md'),
    'utf8',
);

function mermaidAfterHeading(source, heading) {
    const headingIndex = source.indexOf(heading);
    assert.notEqual(headingIndex, -1, `missing heading: ${heading}`);
    const start = source.indexOf('```mermaid', headingIndex);
    const end = source.indexOf('```', start + 10);
    assert.ok(start > headingIndex && end > start, `missing mermaid block after: ${heading}`);
    return source.slice(start, end);
}

function assertUnlockCompression(source) {
    const diagram = mermaidAfterHeading(source, '## How unlock works');
    assert.match(diagram, /COMPRESSION=1[\s\S]*inflate/,
        'unlock diagram must include the conditional inflate step');
    assert.ok(diagram.indexOf('inflate') > diagram.indexOf('AES-256-GCM-decrypt'),
        'unlock diagram must inflate after decrypting');
}

test('unlock diagram inflates compressed plaintext after decryption', () => {
    assertUnlockCompression(page);
    const broken = page.replace(
        'if the FILE carries COMPRESSION=1, inflate',
        'compression step removed',
    );
    assert.throws(() => assertUnlockCompression(broken), /conditional inflate step/);
});

test('publish diagram deflates plaintext before encryption', () => {
    const diagram = mermaidAfterHeading(page, '## How publishing works');
    assert.match(diagram, /participant Issuer/);
    assert.ok(diagram.indexOf('deflate') < diagram.indexOf('encrypt with AES-256-GCM'),
        'publish diagram must deflate before encrypting the single-file path');
});
