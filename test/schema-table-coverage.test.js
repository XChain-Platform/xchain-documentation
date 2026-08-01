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
 * bar, not column-level detail: the indexer has 124 tables and documenting
 * each column would rot faster than it helps, whereas an unnamed table is
 * invisible to a reader.
 *
 * Migration files are excluded: `src/sql/migrations/` holds ALTERs against
 * tables the base schema already declares.
 *
 * These are sibling repos, not dependencies. The gate skips in a standalone
 * clone of the docs.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, '..');

const COMPONENTS = [
    { doc: 'decoder', repo: 'xchain-decoder' },
    { doc: 'indexer', repo: 'xchain-indexer' },
    { doc: 'hub',     repo: 'xchain-hub' },
];

describe('schema table coverage', () => {
    for (const { doc, repo } of COMPONENTS) {
        const sqlDir  = path.resolve(DOC_ROOT, '..', repo, 'src/sql');
        const dbDoc   = path.join(DOC_ROOT, 'components', doc, 'database.md');
        const havePair = fs.existsSync(sqlDir) && fs.existsSync(dbDoc);

        test(`${doc}: every table in src/sql is named in database.md`,
            { skip: !havePair && `${repo} not present in this checkout` }, () => {

            const tables = fs.readdirSync(sqlDir)
                .filter((f) => f.endsWith('.sql'))
                .map((f) => f.replace(/\.sql$/, ''));

            assert.ok(tables.length > 0, `no .sql files found under ${repo}/src/sql`);

            const text = fs.readFileSync(dbDoc, 'utf8');
            const missing = tables.filter((t) => !new RegExp(`\\b${t}\\b`).test(text));

            assert.deepEqual(missing, [],
                `${repo} has ${tables.length} tables; these are undocumented in components/${doc}/database.md:\n  ` +
                missing.join('\n  '));
        });
    }
});
