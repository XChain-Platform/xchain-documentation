/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
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
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = path.join(__dirname, '..');
const UPGRADING = path.join(DOC_ROOT, 'operations', 'upgrading.md');
const HEADING = '### Time columns move from TIMESTAMP to DATETIME';
const MIGRATIONS_DIR = path.join('src', 'sql', 'migrations');

// Maps each dated migration file the subsection must name to the mode the page gives it.
const FILE_MODES = {
    'xchain-indexer': {
        '2026-09-27-datetime-bridge-policy.sql': 'auto',
        '2026-09-27-datetime-hub-mirrors.sql': 'auto',
        '2026-09-27-datetime-anchor-reward-attestations.sql': 'manual',
        '2026-09-27-datetime-not-null-columns.sql': 'manual',
    },
    'xchain-decoder': {
        '2026-09-27-mempool-first-seen-datetime.sql': 'manual',
    },
};

const COMMANDS = ['node src/db/migration/migrate.js', 'npm run migrate'];

/** Text of the named heading up to the next heading of level 1-3, or end of string. */
function extractSubsection(markdown, heading = HEADING) {
    const start = markdown.indexOf(heading);
    if (start === -1) throw new Error(`heading not found: ${heading}`);
    const rest = markdown.slice(start + heading.length);
    const next = rest.search(/\n#{1,3}\s/);
    return heading + (next === -1 ? rest : rest.slice(0, next));
}

/** Throws naming the first required string missing from the subsection text. */
function checkSubsection(text) {
    const filenames = Object.values(FILE_MODES).flatMap((modes) => Object.keys(modes));
    const required = ['UTC', '2038', 'manual', ...filenames, ...COMMANDS];
    for (const item of required) {
        if (!text.includes(item)) throw new Error(`upgrading.md time-column subsection is missing "${item}"`);
    }
}

describe('upgrading.md: time columns move from TIMESTAMP to DATETIME', () => {
    const markdown = fs.readFileSync(UPGRADING, 'utf8');
    const subsection = extractSubsection(markdown);

    test('names UTC, 2038, every dated migration file, both commands, and manual', () => {
        assert.doesNotThrow(() => checkSubsection(subsection));
    });

    test('the checker throws when a manual migration file is dropped from the text', () => {
        const dropped = subsection.replace('2026-09-27-datetime-not-null-columns.sql', '');
        assert.throws(() => checkSubsection(dropped), /datetime-not-null-columns\.sql/);
    });

    for (const [repo, modes] of Object.entries(FILE_MODES)) {
        const { root, skip } = sibling(repo, [MIGRATIONS_DIR]);

        test(`${repo}: dated migration files tag the mode the page gives them`, { skip }, () => {
            for (const [file, mode] of Object.entries(modes)) {
                const filePath = path.join(root, MIGRATIONS_DIR, file);
                if (!fs.existsSync(filePath)) continue;
                const tag = fs.readFileSync(filePath, 'utf8').match(/--\s*xchain:migration\s+mode=(\w+)/);
                assert.ok(tag, `${file} carries no xchain:migration mode= tag`);
                assert.equal(tag[1], mode, `${file} is tagged mode=${tag[1]}, page says mode=${mode}`);
            }
        });
    }
});
