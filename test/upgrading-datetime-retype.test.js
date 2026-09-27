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

const COMMANDS = ['node src/db/migration/migrate.js', 'npm run migrate -- --file'];
const COMPONENTS_BY_MODE = {
    auto: ['hub', 'indexer', 'sync', 'decoder'],
    manual: ['indexer', 'decoder'],
};

/** Extract the named heading through the next heading of level 1-3 or the end. */
function extractSubsection(markdown, heading = HEADING) {
    const lines = markdown.split('\n');
    const start = lines.indexOf(heading);
    if (start === -1) throw new Error(`heading not found: ${heading}`);
    const next = lines.findIndex((line, index) => index > start && /^#{1,3}\s/.test(line));
    return lines.slice(start, next === -1 ? undefined : next).join('\n');
}

/** Throw with the first required string missing from the subsection text. */
function checkSubsection(text) {
    const autoStart = text.indexOf('Most of this runs by itself at startup');
    const manualStart = text.indexOf('Three migrations are `mode=manual`');
    if (autoStart === -1) throw new Error('upgrading.md time-column subsection is missing "automatic"');
    if (manualStart === -1) throw new Error('upgrading.md time-column subsection is missing "manual"');
    if (manualStart <= autoStart) throw new Error('manual migrations must follow automatic migrations');
    const byMode = { auto: text.slice(autoStart, manualStart), manual: text.slice(manualStart) };
    const required = ['v0.21.0', 'UTC', '2038', 'manual', ...COMMANDS];
    for (const item of required) {
        if (!text.includes(item)) throw new Error(`upgrading.md time-column subsection is missing "${item}"`);
    }
    for (const [mode, components] of Object.entries(COMPONENTS_BY_MODE)) {
        for (const component of components) {
            if (!byMode[mode].toLowerCase().includes(component)) {
                throw new Error(`${mode} migrations are missing component "${component}"`);
            }
        }
    }
    for (const [repo, modes] of Object.entries(FILE_MODES)) {
        for (const [file, mode] of Object.entries(modes)) {
            if (!byMode[mode].includes(file)) throw new Error(`${repo} ${mode} migrations are missing "${file}"`);
        }
    }
}

describe('upgrading.md: time columns move from TIMESTAMP to DATETIME', () => {
    const markdown = process.env.XCHAIN_UPGRADING_MARKDOWN || fs.readFileSync(UPGRADING, 'utf8');

    test('uses the exact heading and names every required migration detail', () => {
        const subsection = extractSubsection(markdown);
        assert.doesNotThrow(() => checkSubsection(subsection));
    });

    test('the checker throws when a manual migration file is dropped from the text', () => {
        const subsection = extractSubsection(markdown);
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
