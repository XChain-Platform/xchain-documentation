/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC – https://dankest.llc
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

const constants = require('../protocol/constants.js');

const CONFIGURATION_PAGES = [
    'components/indexer/configuration.md',
    'components/hub/configuration.md',
    'components/sync/configuration.md',
    'components/sdk/configuration.md',
    'components/explorer/configuration.md',
];

test('fold gates use the public-network sentinel and remain inert on regtest', () => {
    for (const mapName of ['ANCHOR_FOLD_ACTIVATION', 'ARCHIVE_SECTION_VERDICT_STATE_HASH_ACTIVATION']) {
        const map = constants[mapName];
        assert.equal(map.mainnet, 9999999999, `${mapName}.mainnet must use the UNARMED sentinel`);
        assert.equal(map.testnet, 9999999999, `${mapName}.testnet must use the UNARMED sentinel`);
        assert.equal(map.regtest, null, `${mapName}.regtest must remain null by default`);
    }
});

test('every component configuration table names the fold arming variable in its first cell', () => {
    for (const relativePath of CONFIGURATION_PAGES) {
        const contents = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
        const firstCells = contents.split('\n')
            .filter((line) => line.startsWith('|'))
            .map((line) => line.split('|')[1].trim());
        assert.ok(firstCells.includes('`XC_ANCHOR_FOLD_REGTEST_ACTIVATION`'),
            `${relativePath} must document XC_ANCHOR_FOLD_REGTEST_ACTIVATION in a table row's first cell`);
    }
});
