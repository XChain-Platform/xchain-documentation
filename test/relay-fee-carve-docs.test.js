/*********************************************************************
 *
 * Copyright © 2025-2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC - https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('./helpers/sibling_checkout.js');

const constants = require('../protocol/constants.js');
const flagDays = fs.readFileSync(path.resolve(__dirname, '../protocol/flag-days.md'), 'utf8');
const catalogue = fs.readFileSync(path.resolve(__dirname, '../protocol/activation-catalogue.md'), 'utf8');
const indexer = sibling('xchain-indexer', ['src/protocol_changes.js', 'src/protocol_changes/gates_2.js']);

const MAP_NAME = 'ATTEST_RELAY_FEE_ACTIVATION';
const REGISTRY_KEY = `attest_relay_fee_activation.${MAP_NAME}`;
const EXPECTED = {
    mainnet: 9999999999,
    'BTC:testnet': 9999999999,
    'LTC:testnet': 9999999999,
    'DOGE:testnet': 9999999999,
    testnet: 9999999999,
    regtest: 0,
};

function occurrences(text, line) {
    return text.split('\n').filter((candidate) => candidate === line).length;
}

function assertPublished(flagDayText, catalogueText) {
    assert.equal(occurrences(flagDayText, `- \`${MAP_NAME}\``), 1,
        `${MAP_NAME} must appear exactly once in the canonical activation-map index`);
    const row = `| \`attest_relay_fee_activation\` | \`${MAP_NAME}\` | height |`;
    assert.equal(occurrences(catalogueText, row), 1,
        'the relay fee activation must have one exact catalogue row');
}

test('the relay fee activation map publishes the registry network selectors', () => {
    assert.deepEqual(constants[MAP_NAME], EXPECTED);
    assert.equal(Object.isFrozen(constants[MAP_NAME]), true);
});

test('the relay fee activation map is value-identical to the indexer registry',
    { skip: indexer.skip }, () => {
        const ProtocolChanges = require(path.join(indexer.root, 'src/protocol_changes.js'));
        assert.equal(ProtocolChanges.registry.unitOf(REGISTRY_KEY), 'height');
        assert.deepEqual(constants[MAP_NAME], ProtocolChanges.get(REGISTRY_KEY));
    });

test('the generated flag-day page and activation catalogue publish the relay fee gate', () => {
    assertPublished(flagDays, catalogue);
});

test('dropping either relay fee documentation entry is detected', () => {
    assert.throws(
        () => assertPublished(flagDays.replace(`- \`${MAP_NAME}\`\n`, ''), catalogue),
        /canonical activation-map index/,
    );
    assert.throws(
        () => assertPublished(flagDays, catalogue.replace(
            `| \`attest_relay_fee_activation\` | \`${MAP_NAME}\` | height |\n`, '')),
        /exact catalogue row/,
    );
});
