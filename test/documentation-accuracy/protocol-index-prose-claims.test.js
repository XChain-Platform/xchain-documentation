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
 * Protocol index and activation prose must describe the files and values.
 *********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const README = fs.readFileSync(path.join(ROOT, 'protocol/README.md'), 'utf8');
const JSON_README = fs.readFileSync(path.join(ROOT, 'protocol/json/README.md'), 'utf8');
const MANIFEST_PAGE = fs.readFileSync(path.join(ROOT, 'protocol/action-manifest.md'), 'utf8');
const TIS_PAGE = fs.readFileSync(path.join(ROOT, 'protocol/token-information-standard.md'), 'utf8');
const TIS_SCHEMA = require(path.join(ROOT,
    'protocol/json/token-information-standard-v1.1.2-schema.json'));
const CONSTANTS_SOURCE = fs.readFileSync(path.join(ROOT, 'protocol/constants.js'), 'utf8');
const CONSTANTS = require(path.join(ROOT, 'protocol/constants.js'));

function tableRow(markdown, label) {
    const rows = markdown.split('\n').filter((line) => line.startsWith(`| [${label}]`));
    assert.equal(rows.length, 1, `${label} must have exactly one table row`);
    return rows[0];
}

function assertJsonSchemaRow(markdown, jsonReadme = JSON_README) {
    const row = tableRow(markdown, 'JSON Schemas');
    assert.match(row, /Token Information Standard/);
    assert.match(row, /schemas and worked examples/i);
    assert.match(jsonReadme, /\[Wallet request reference\]\(\.\/wallet-requests\.json\)/);
    assert.doesNotMatch(row, /ACTION payloads|API responses/);
}

function assertIdentityDirection(markdown) {
    const definition = markdown.indexOf('2. **IDENTITY**');
    const reference = markdown.indexOf('IDENTITY assertion above');
    assert.ok(definition >= 0, 'IDENTITY definition is missing');
    assert.ok(reference > definition, 'IDENTITY cross-reference must point above to its definition');
    assert.doesNotMatch(markdown, /IDENTITY assertion below/);
}

function assertTisUntypedFields(markdown, schema) {
    const size = markdown.split('\n').find((line) => line.startsWith('| size '));
    const type = markdown.split('\n').find((line) => line.startsWith('| type '));
    assert.match(size || '', /^\| size\s+\| Any\s+\|/);
    assert.match(size, /v1\.1\.2 does not constrain its JSON type/);
    assert.match(type || '', /^\| type\s+\| String \/ Any\s+\|/);
    assert.match(type, /For `files`, published schema v1\.1\.2 does not constrain the JSON type/);
    assert.equal(Object.hasOwn(schema.definitions.images.properties.size, 'type'), false);
    assert.equal(Object.hasOwn(schema.definitions.files.properties.type, 'type'), false);
}

function activationBlock(source, name) {
    const start = source.indexOf(`// ${name}:`);
    const declaration = source.indexOf(`const ${name} = {`, start);
    const end = source.indexOf('\n};', declaration);
    assert.ok(start >= 0 && declaration > start && end > declaration, `${name} block is missing`);
    return source.slice(start, end + 3);
}

function assertPerChainArmed(name, expected) {
    const block = activationBlock(CONSTANTS_SOURCE, name);
    assert.match(block, /Testnet is armed per chain by the <COIN>:testnet keys/);
    assert.match(block, /bare\s+\/\/ testnet key is only the fallback|bare\n\/\/ testnet key is only the fallback/);
    assert.doesNotMatch(block, /ships on the UNARMED sentinel|next cut sets it/);
    for (const [key, value] of Object.entries(expected)) {
        assert.equal(CONSTANTS[name][key], value, `${name}.${key}`);
    }
}

test('the JSON Schemas row describes the files in protocol/json', () => {
    const files = fs.readdirSync(path.join(ROOT, 'protocol/json')).filter((name) => name.endsWith('.json'));
    assert.ok(files.length > 0, 'protocol/json has no JSON files');
    assert.deepEqual(files.filter((name) => !name.startsWith('token-information-standard-')),
        ['wallet-requests.json']);
    assertJsonSchemaRow(README);
});

test('the action-manifest IDENTITY cross-reference points to the definition above', () => {
    assertIdentityDirection(MANIFEST_PAGE);
});

test('the TIS field table discloses the two types v1.1.2 does not constrain', () => {
    assertTisUntypedFields(TIS_PAGE, TIS_SCHEMA);
    const tightened = structuredClone(TIS_SCHEMA);
    tightened.definitions.images.properties.size.type = 'string';
    assert.throws(() => assertTisUntypedFields(TIS_PAGE, tightened));
    assert.throws(() => assertTisUntypedFields(
        TIS_PAGE.replace(/\| size\s+\| Any\s+\|/, '| size        | String  |'), TIS_SCHEMA));
});

test('per-chain checkpoint and archive heights are described as armed', () => {
    const expected = {
        'BTC:testnet': 158557,
        'LTC:testnet': 4949697,
        'DOGE:testnet': 68035864,
        testnet: 9999999999,
    };
    assertPerChainArmed('CHECKPOINT_SUPERSEDE_ACTIVATION', expected);
    assertPerChainArmed('ARCHIVE_ROLLCALL_PRESENCE_ACTIVATION', expected);
    assert.equal(CONSTANTS.ADMIT_CHAIN_MARGIN_ACTIVATION['LTC:testnet'], 4949697);
    assert.doesNotMatch(CONSTANTS_SOURCE, /'LTC:testnet':\s+4949697,\s*\/\/ UNARMED/);
});

test('falsification: stale index and cross-reference prose is rejected', () => {
    const staleIndex = README.replace(/Machine-readable JSON Schemas[^|]+/,
        'Schemas for ACTION payloads and API responses ');
    const missingWalletReference = JSON_README.replace(/\[Wallet request reference\]\(\.\/wallet-requests\.json\)/,
        'wallet request data');
    const staleManifest = MANIFEST_PAGE.replace('IDENTITY assertion above', 'IDENTITY assertion below');
    assert.notEqual(staleIndex, README, 'JSON Schemas row moved; repoint this falsification');
    assert.throws(() => assertJsonSchemaRow(staleIndex));
    assert.throws(() => assertJsonSchemaRow(README, missingWalletReference));
    assert.throws(() => assertIdentityDirection(staleManifest));
});

test('falsification: pre-arm activation prose is rejected', () => {
    const stale = CONSTANTS_SOURCE.replace(
        'Testnet is armed per chain by the <COIN>:testnet keys; the bare',
        'Testnet ships on the UNARMED sentinel until the next cut; the bare');
    assert.notEqual(stale, CONSTANTS_SOURCE, 'activation prose moved; repoint this falsification');
    assert.throws(() => activationBlock(stale, 'CHECKPOINT_SUPERSEDE_ACTIVATION')
        && assert.match(activationBlock(stale, 'CHECKPOINT_SUPERSEDE_ACTIVATION'),
            /Testnet is armed per chain by the <COIN>:testnet keys/));
});
