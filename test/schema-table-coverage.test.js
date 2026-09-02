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
 **********************************************************************
 *
 * Schema table-coverage gate.
 *
 * WHY. The 2026-06-20 round verified the hub's database.md against
 * `ls src/sql/` and found all 20 tables documented. By 2026-07-27 the hub had
 * 23 and the indexer was missing 9, including the entire VOTE governance set
 * (`polls`, `votes`, `poll_results`, `vote_delegations`) and `coinpays`. A
 * table lands with its feature; the doc row does not, and nothing notices,
 * because a missing row reads exactly like a table that does not exist.
 *
 * WHAT IT CHECKS. Every `src/sql/*.sql` file in the decoder, indexer and hub
 * has its table named somewhere in that component's database.md. Naming is the
 * bar, not column-level detail: the indexer has 129 tables and documenting
 * each column would rot faster than it helps, whereas an unnamed table is
 * invisible to a reader.
 *
 * Migration files are excluded: `src/sql/migrations/` holds ALTERs against
 * tables the base schema already declares.
 *
 * WHY THE RULES ARE NOT INLINE HERE ANY MORE. These are sibling
 * repos, not dependencies, so the cross-repo half of this file skips in a
 * standalone clone of the docs, and the docs CI checkout is deliberately
 * hermetic. That made the gate vacuous on every push it actually ran on: the
 * three ROLLCALL tables sat undocumented on a published surface while this
 * suite reported green. The rules now live in lib/schema-table-coverage.js so
 * the platform-side trigger, XChain-Platform/bin/check-schema-table-doc-
 * coverage.js, runs them from the shared checkout where the siblings exist.
 *
 * So this file has two halves, and the split is the point: the rule tests
 * below are hermetic and run EVERYWHERE, including the docs CI, so a refactor
 * that breaks the scanner is caught here; the cross-repo assertion still skips
 * where the siblings are absent, and is no longer the only place the invariant
 * is enforced.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const cov = require('../lib/schema-table-coverage.js');

const DOC_ROOT      = path.join(__dirname, '..');
const PLATFORM_ROOT = path.resolve(DOC_ROOT, '..');

/* ------------------------------------------------------------------ *
 *  Hermetic: the rules themselves, with no sibling checkout in sight
 * ------------------------------------------------------------------ */

describe('schema table coverage rules', () => {

    test('base-schema files are one segment deep; migrations are not tables', () => {
        assert.equal(cov.isBaseSchemaPath('src/sql/rollcalls.sql'), true);
        assert.equal(cov.isBaseSchemaPath('src/sql/migrations/2026-07-01-add-col.sql'), false,
            'a migration ALTERs a table the base schema already declares; it names no new one');
        assert.equal(cov.isBaseSchemaPath('src/sql/README.md'), false);
        assert.equal(cov.isBaseSchemaPath('src/sql'), false);
    });

    test('table names come from the base-schema filenames, sorted and deduplicated', () => {
        assert.deepEqual(
            cov.tableNamesFrom([
                'src/sql/rollcall_signers.sql',
                'src/sql/migrations/0001-rollcalls-rolled.sql',
                'src/sql/rollcalls.sql',
                'src/sql/rollcalls.sql',
            ]),
            ['rollcall_signers', 'rollcalls']);
    });

    test('a table named nowhere on the page is reported', () => {
        assert.deepEqual(
            cov.undocumentedTables(['rollcalls', 'blocks'], '| `blocks` | one row per block |'),
            ['rollcalls']);
    });

    // The regression the ledger item names. Before the rows landed, all three
    // were absent at once, and a substring-shaped rule would have called two of
    // them documented the moment the third was written.
    test('a longer table name does not document a shorter one it contains', () => {
        const page = '| `rollcall_signers` | signatures collected from ROLLCALL actions |';
        assert.deepEqual(cov.undocumentedTables(['rollcalls'], page), ['rollcalls'],
            'rollcall_signers must not discharge rollcalls');
        assert.deepEqual(cov.undocumentedTables(['actions'], '| `anchor_actions` | ... |'), ['actions'],
            'underscore is a word character, so anchor_actions is not a match for actions');
    });

    test('a table name carrying regex metacharacters is a problem, not a pattern', () => {
        assert.deepEqual(cov.undocumentedTables(['roll.alls'], 'rollcalls rollXalls roll.alls'),
            ['roll.alls'],
            'escaping it into a match would hide a malformed schema filename');
    });

    test('an empty page is reported as unreadable rather than as full coverage', () => {
        const survey = new Map([['indexer',
            { doc: 'indexer', repo: 'xchain-indexer', tables: [], docText: '   \n' }]]);
        assert.deepEqual(cov.checkPagesReadable(survey),
            ['indexer: components/indexer/database.md read as empty; it cannot be judged']);
    });

    test('a scan that comes back under the floor is "could not run", not a pass', () => {
        const survey = new Map([['indexer',
            { doc: 'indexer', repo: 'xchain-indexer', tables: ['actions'], docText: '`actions`' }]]);
        assert.deepEqual(cov.checkUndocumented(survey), [],
            'nothing is undocumented, which is exactly why the floor has to speak');
        assert.equal(cov.checkFloors(survey).length, 1);
        assert.match(cov.checkFloors(survey)[0], /only 1 base-schema table/);
    });

    test('the floor sits under every gated component\'s real table count', () => {
        for (const { doc } of cov.COMPONENTS) {
            assert.ok(typeof cov.TABLE_FLOOR[doc] === 'number',
                `${doc} has no floor, so an empty scan of it would read as a pass`);
        }
    });
});

/* ------------------------------------------------------------------ *
 *  Cross-repo: the real invariant, when the siblings are here
 * ------------------------------------------------------------------ */

describe('schema table coverage', () => {
    for (const component of cov.COMPONENTS) {
        const { doc, repo } = component;
        const sqlDir  = path.resolve(PLATFORM_ROOT, repo, cov.SQL_ROOT);
        const dbDoc   = path.join(DOC_ROOT, cov.docPathFor(doc));
        const havePair = fs.existsSync(sqlDir) && fs.existsSync(dbDoc);

        test(`${doc}: every table in src/sql is named in database.md`,
            { skip: !havePair && `${repo} not present in this checkout` }, () => {

            const reader = cov.workingTreeReader();
            const survey = cov.buildSurvey({
                platformRoot:  PLATFORM_ROOT,
                docRoot:       DOC_ROOT,
                components:    [component],
                serviceReader: reader,
                docReader:     reader,
            });

            assert.deepEqual(cov.checkFloors(survey), []);
            assert.deepEqual(cov.checkPagesReadable(survey), []);

            const missing = cov.checkUndocumented(survey);
            assert.deepEqual(missing, [],
                `${repo} has ${cov.totalTables(survey)} tables; these are undocumented in ` +
                `${cov.docPathFor(doc)}:\n  ` + missing.join('\n  '));
        });
    }
});
