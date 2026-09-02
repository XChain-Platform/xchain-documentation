/*********************************************************************
 *
 * Copyright © 2025-2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC - https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md. A commercial
 * license (without AGPL source-disclosure terms) is available -
 * contact legal@dankest.llc.
 *
 **********************************************************************
 * Schema table-coverage rules.
 *
 * WHAT THE INVARIANT IS. Every base-schema table a service declares under
 * `src/sql/*.sql` must be named somewhere in that component's database.md.
 * Naming is the bar, not column-level detail: the indexer alone declares 129
 * tables and a column-by-column doc would rot faster than it helps, whereas an
 * unnamed table is invisible to a reader of a published page.
 *
 * WHY THE RULES LIVE HERE RATHER THAN IN THE TEST. They used to be inline in
 * test/schema-table-coverage.test.js, which made the gate a one-repo trigger:
 * it ran only when somebody ran the docs suite, and the docs CI checkout is
 * deliberately hermetic (no sibling repos), so the test SKIPPED there and the
 * gate was vacuous everywhere it actually ran on a push. That is how the three
 * ROLLCALL tables (`rollcalls`, `rollcall_signers`, `rollcall_absences`) sat
 * undocumented on a published surface served from master while the suite
 * reported green. Extracting the rules lets the platform-side trigger,
 * bin/check-schema-table-doc-coverage.js, run the same checks from the shared
 * checkout where all the siblings are present, exactly the way an earlier fix closed
 * the identical blind spot for the env-var gate.
 *
 * MIGRATIONS ARE NOT BASE SCHEMA. `src/sql/migrations/` holds ALTERs against
 * tables the base schema already declares, so only the top-level
 * `src/sql/<name>.sql` files name a table. The recursive readers below return
 * the migration paths too, hence the explicit one-segment filter: a
 * readdirSync-shaped assumption about depth is what would silently re-admit
 * them.
 *
 * The file readers come from lib/env-var-doc-coverage.js rather than being
 * reimplemented: the committed-tree reader in particular is fiddly (one
 * `git cat-file --batch` per repo, -z listing, missing blobs skipped) and two
 * copies would drift.
 *********************************************************************/

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const { workingTreeReader, committedTreeReader, isGitRepo } =
    require('./env-var-doc-coverage.js');

/** The components whose base schema is gated, and the repo each lives in. */
const COMPONENTS = [
    { doc: 'decoder', repo: 'xchain-decoder' },
    { doc: 'indexer', repo: 'xchain-indexer' },
    { doc: 'hub',     repo: 'xchain-hub' },
];

/** Where a service declares its base schema, one file per table. */
const SQL_ROOT = 'src/sql';

/**
 * Per-component floor on the number of base-schema tables found.
 *
 * A scanner that returns nothing must read as "could not run", never as a
 * clean bill of health; that is a known failure mode and the whole reason
 * this item exists. The floors sit well under the real counts at the time of
 * writing (decoder 9, indexer 129, hub 28) so ordinary growth or a table
 * genuinely being dropped does not trip them, while a moved source layout or
 * an unreadable checkout does.
 */
const TABLE_FLOOR = { decoder: 5, indexer: 100, hub: 20 };

/** The published page a component's tables must be named on. */
function docPathFor(doc) {
    return `components/${doc}/database.md`;
}

/**
 * Is this a base-schema file, as opposed to a migration or a stray?
 *
 * Exactly `src/sql/<name>.sql`, one segment deep. Paths arrive with forward
 * slashes from both readers (git ls-tree, and the working-tree walker builds
 * them itself), so no separator normalisation is needed.
 */
function isBaseSchemaPath(rel) {
    return /^src\/sql\/[^/]+\.sql$/.test(rel);
}

/**
 * Table names from a list of repo-relative paths.
 *
 * @returns {string[]} sorted, deduplicated
 */
function tableNamesFrom(rels) {
    const names = new Set();
    for (const rel of rels) {
        if (!isBaseSchemaPath(rel)) continue;
        names.add(path.posix.basename(rel, '.sql'));
    }
    return [...names].sort();
}

/**
 * Which of these tables is not named anywhere in the page text?
 *
 * A word-boundary match on the bare name, which is what the doc rows use
 * (`` `rollcall_signers` ``). Underscore is a word character, so
 * `\bactions\b` does NOT spuriously match `anchor_actions` and a component
 * cannot document one table by documenting a longer one that contains it.
 *
 * A name carrying regex metacharacters would silently change the pattern's
 * meaning, so it is reported as a problem in its own right rather than being
 * escaped into a match nobody can read: a table file called `a.b.sql` is a
 * mistake to surface, not a case to support.
 *
 * @returns {string[]} the undocumented names, in the order given
 */
function undocumentedTables(tables, text) {
    return tables.filter((t) => {
        if (!/^[A-Za-z0-9_]+$/.test(t)) return true;
        return !new RegExp(`\\b${t}\\b`).test(text);
    });
}

/**
 * The components whose repo AND database.md are both readable from here.
 *
 * Existence is answered on disk even when the contents will be read at a ref:
 * a repo that is not checked out has no ref to read either.
 */
function presentComponents(platformRoot, docRoot) {
    return COMPONENTS.filter(({ doc, repo }) =>
        fs.existsSync(path.join(platformRoot, repo, SQL_ROOT)) &&
        fs.existsSync(path.join(docRoot, docPathFor(doc))));
}

/**
 * Read one component's tables and its page.
 *
 * @param {object}   o
 * @param {string}   o.platformRoot  the directory holding the sibling repos
 * @param {string}   o.docRoot       xchain-documentation
 * @param {object}   o.component     one COMPONENTS entry
 * @param {object}   o.serviceReader reader for the service repo
 * @param {object}   o.docReader     reader for the docs repo
 * @returns {{doc: string, repo: string, tables: string[], docText: string}}
 */
function readComponent({ platformRoot, docRoot, component, serviceReader, docReader }) {
    const { doc, repo } = component;
    const repoDir = path.join(platformRoot, repo);

    const tables  = tableNamesFrom(serviceReader.listPaths(repoDir, [SQL_ROOT]));
    const docRel  = docPathFor(doc);
    const docText = docReader.readFiles(docRoot, [docRel]).get(docRel) || '';

    return { doc, repo, tables, docText };
}

/**
 * Read every gated component.
 *
 * @returns {Map<string, {doc, repo, tables, docText}>} keyed by doc name
 */
function buildSurvey({ platformRoot, docRoot, components, serviceReader, docReader }) {
    const survey = new Map();
    for (const component of components) {
        survey.set(component.doc,
            readComponent({ platformRoot, docRoot, component, serviceReader, docReader }));
    }
    return survey;
}

/**
 * Components whose scan came back implausible, described.
 *
 * Separated from the coverage verdict on purpose: an empty or truncated scan
 * is "the check could not run", not "the docs are complete".
 *
 * @returns {string[]}
 */
function checkFloors(survey) {
    const out = [];
    for (const [doc, entry] of survey) {
        const floor = TABLE_FLOOR[doc];
        if (floor === undefined) continue;
        if (entry.tables.length < floor) {
            out.push(`${doc}: only ${entry.tables.length} base-schema table(s) found under ` +
                     `${entry.repo}/${SQL_ROOT} (floor ${floor}); a moved layout or an unreadable checkout, ` +
                     'not a documentation gap');
        }
    }
    return out;
}

/**
 * An empty page is the mirror failure: a database.md that read as zero bytes
 * would make every table look undocumented, which is loud, but a page that is
 * present and trivially short is not evidence of anything.
 *
 * @returns {string[]}
 */
function checkPagesReadable(survey) {
    const out = [];
    for (const [doc, entry] of survey) {
        if (entry.docText.trim().length === 0) {
            out.push(`${doc}: ${docPathFor(doc)} read as empty; it cannot be judged`);
        }
    }
    return out;
}

/**
 * The coverage verdict.
 *
 * @returns {string[]} one line per undocumented table
 */
function checkUndocumented(survey) {
    const out = [];
    for (const [doc, entry] of survey) {
        for (const t of undocumentedTables(entry.tables, entry.docText)) {
            out.push(`${doc}: ${t} (${entry.repo}/${SQL_ROOT}/${t}.sql) is not named in ${docPathFor(doc)}`);
        }
    }
    return out;
}

/** Total tables gated, for the pass line. */
function totalTables(survey) {
    let n = 0;
    for (const entry of survey.values()) n += entry.tables.length;
    return n;
}

module.exports = {
    COMPONENTS, SQL_ROOT, TABLE_FLOOR,
    docPathFor, isBaseSchemaPath, tableNamesFrom, undocumentedTables,
    presentComponents, readComponent, buildSurvey,
    checkFloors, checkPagesReadable, checkUndocumented, totalTables,
    workingTreeReader, committedTreeReader, isGitRepo,
};
