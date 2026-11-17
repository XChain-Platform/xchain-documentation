/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 * Source-to-registry checks for request validation and multipart FILE errors.
 *********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { sibling } = require('../helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY = fs.readFileSync(path.join(ROOT, 'protocol/error-codes.md'), 'utf8');
const API_PAGE = fs.readFileSync(path.join(ROOT, 'components/explorer/api.md'), 'utf8');
const SOURCE_PATHS = [
    'src/explorer/fees_preflight.js',
    'src/explorer/mount.js',
    'src/http/api_boot/json_body.js',
    'src/explorer/multipart_file.js',
    'src/explorer/multipart_stream.js',
];
const explorer = sibling('xchain-explorer', SOURCE_PATHS);

function source(rel) {
    return fs.readFileSync(path.join(explorer.root, rel), 'utf8');
}

function registryRow(code, page = REGISTRY) {
    const rows = page.match(new RegExp('^\\| `' + code + '` \\|.*$', 'gm')) || [];
    assert.equal(rows.length, 1, `${code} must have exactly one registry row`);
    return rows[0];
}

function namedString(sourceText, name) {
    const match = sourceText.match(new RegExp('const ' + name + " = '([^']+)'"));
    assert.ok(match, `${name} must remain a string constant; repoint this test if it moves`);
    return match[1];
}

function assertActionClaim(row, limit) {
    assert.match(row, /The `action` parameter is malformed \(fee quote and preflight routes\)\./);
    assert.match(row, new RegExp(`raw value longer than ${limit} characters`));
    assert.match(row, /trims surrounding whitespace and uppercases/);
    assert.match(row, /`send` and ` SEND ` are accepted/);
    assert.match(row, /forwarded to the indexer exactly as sent, not in normalized form/);
    assert.doesNotMatch(row, /names no known action|case-sensitive|does not trim/);
}

function assertBodyClaim(row, preflightLimit, contractLimit) {
    assert.equal(preflightLimit, '2.5mb');
    assert.equal(contractLimit, '256kb');
    assert.match(row, /2\.5 MB on `POST \/\{COIN\}\/api\/preflight` and `POST \/\{COIN\}\/api\/feequote`/);
    assert.match(row, /256 KB on `POST \/\{COIN\}\/api\/contract\/\{contractIndex\}\/call`/);
    assert.match(row, /10 KB on every other route/);
    assert.doesNotMatch(row, /allow 1 MB/);
}

function multipartErrors(sourceText) {
    const found = new Map();
    for (const match of sourceText.matchAll(/new (?:\w+\.)?MultipartFileError\('([A-Z][A-Z0-9_]+)',\s*(\d+)/g)) {
        if (!found.has(match[1])) found.set(match[1], Number(match[2]));
    }
    return found;
}

test('INVALID_ACTION matches the explorer normalization check', { skip: explorer.skip }, () => {
    const fees = source('src/explorer/fees_preflight.js');
    const match = fees.match(/const MAX_PROXY_ACTION_LENGTH = (\d+);/);
    assert.ok(match, 'MAX_PROXY_ACTION_LENGTH must remain numeric; repoint this test if it moves');
    assert.match(fees, /raw\.length <= MAX_PROXY_ACTION_LENGTH/);
    assert.match(fees, /\.test\(raw\.trim\(\)\.toUpperCase\(\)\)/);
    assertActionClaim(registryRow('INVALID_ACTION'), Number(match[1]));

    const stale = registryRow('INVALID_ACTION').replace(
        /\*\*What is checked:\*\*.* \| No \|$/,
        '**What is checked:** the check is case-sensitive and does not trim | No |');
    assert.throws(() => assertActionClaim(stale, Number(match[1])));

    const contradictory = registryRow('INVALID_ACTION').replace(
        'The `action` parameter is malformed', 'The `action` parameter names no known action');
    assert.throws(() => assertActionClaim(contradictory, Number(match[1])));
});

test('BODY_TOO_LARGE matches every explorer parser ceiling', { skip: explorer.skip }, () => {
    const mount = source('src/explorer/mount.js');
    const jsonBody = source('src/http/api_boot/json_body.js');
    const preflight = namedString(mount, 'PREFLIGHT_BODY_LIMIT');
    const contract = namedString(mount, 'CONTRACT_CALL_BODY_LIMIT');
    assert.match(mount, /express\.json\(\{ limit: PREFLIGHT_BODY_LIMIT \}\)/);
    assert.match(mount, /express\.json\(\{ limit: CONTRACT_CALL_BODY_LIMIT \}\)/);
    assert.match(jsonBody, /express\.json\(\{ limit: '10kb' \}\)/);
    assert.match(jsonBody, /isContractCallPostRequest\(req\)\) return next\(\)/);
    assertBodyClaim(registryRow('BODY_TOO_LARGE'), preflight, contract);

    const stale = registryRow('BODY_TOO_LARGE').replace('2.5 MB', '1 MB');
    assert.throws(() => assertBodyClaim(stale, preflight, contract));
});

test('multipart FILE refusals keep their registry statuses and API references', { skip: explorer.skip }, () => {
    // The raw-route refusals moved into multipart_stream.js (FILE_PART_CORRUPT), so a
    // code counts when either explorer file emits it.
    const emitted = new Map([
        ...multipartErrors(source('src/explorer/multipart_stream.js')),
        ...multipartErrors(source('src/explorer/multipart_file.js')),
    ]);
    const expected = new Map([
        ['FILE_PART', 404],
        ['FILE_INCOMPLETE', 409],
        ['FILE_ASSEMBLY_MISMATCH', 422],
        ['FILE_PART_CORRUPT', 500],
    ]);
    for (const [code, status] of expected) {
        assert.equal(emitted.get(code), status, `${code} source status`);
        assert.match(registryRow(code), new RegExp('^\\| `' + code + '` \\| ' + status + ' \\|'));
        assert.match(API_PAGE, new RegExp('(?:^|\\s)' + status + ' `' + code + '`'));
    }
    assert.match(registryRow('FILE_INCOMPLETE'), /`parts_received` and `total_parts`/);

    const missing = REGISTRY.replace(/^\| `FILE_INCOMPLETE` \|.*\n/m, '');
    assert.throws(() => registryRow('FILE_INCOMPLETE', missing));
});
