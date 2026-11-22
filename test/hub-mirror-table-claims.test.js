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
 **********************************************************************
 *
 * Keeps the hub-DB mirror claims consistent across pages. The indexer's
 * MIRRORED_TABLES is the source of truth for which hub tables an indexer
 * copies; the database-design page must list every one of them, the hub API
 * page must not deny a mirrored table, and the hub architecture bootstrap
 * table must carry a row for every snapshot route the API page documents.
 */
'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..');
const MIRROR_SRC = 'src/hub/hub_db_sync/mirror_tables.js';
const indexer = sibling('xchain-indexer', [MIRROR_SRC]);

const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function mirroredTables(source) {
    const m = /const MIRRORED_TABLES\s*=\s*\[([^\]]*)\]/.exec(source);
    assert.ok(m, 'MIRRORED_TABLES declaration not found');
    return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

function hubDbCopyList(markdown) {
    const start = markdown.indexOf('### Hub DB (local copy)');
    assert.notEqual(start, -1, 'Hub DB (local copy) heading not found');
    const rest = markdown.slice(start + 1);
    const next = rest.search(/\n#{2,3} /);
    return next === -1 ? rest : rest.slice(0, next);
}

function missingFromHubDbCopy(markdown, tables) {
    const section = hubDbCopyList(markdown);
    return tables.filter((t) => !section.includes(`\`${t}\``));
}

function deniedMirrors(markdown, tables) {
    return tables.filter((t) => new RegExp(`\`${t}\`[^.\\n]*indexers do not mirror`, 'i').test(markdown));
}

function snapshotHeadings(apiMarkdown) {
    return [...apiMarkdown.matchAll(/^### `GET \/hub-db\/snapshot\/([a-z_]+)/gm)].map((m) => m[1]);
}

function missingBootstrapRows(apiMarkdown, archMarkdown) {
    const start = archMarkdown.indexOf('### REST Bootstrap Endpoints');
    assert.notEqual(start, -1, 'REST Bootstrap Endpoints heading not found');
    const rest = archMarkdown.slice(start + 1);
    const next = rest.search(/\n#{2,3} /);
    const table = next === -1 ? rest : rest.slice(0, next);
    return snapshotHeadings(apiMarkdown)
        .filter((route) => !table.includes(`| \`GET /hub-db/snapshot/${route}?`));
}

test('database-design lists every table the indexer mirrors from the hub', { skip: indexer.skip }, () => {
    const tables = mirroredTables(fs.readFileSync(path.join(indexer.root, MIRROR_SRC), 'utf8'));
    assert.ok(tables.length >= 12, 'the mirror set parsed shorter than the known set');
    assert.deepEqual(missingFromHubDbCopy(readDoc('architecture/database-design.md'), tables), []);
});

test('hub API page does not deny a mirrored table', { skip: indexer.skip }, () => {
    const tables = mirroredTables(fs.readFileSync(path.join(indexer.root, MIRROR_SRC), 'utf8'));
    assert.deepEqual(deniedMirrors(readDoc('components/hub/api.md'), tables), []);
});

test('hub architecture bootstrap table has a row for every documented snapshot route', () => {
    const api = readDoc('components/hub/api.md');
    assert.ok(snapshotHeadings(api).length >= 12, 'snapshot route headings parsed short');
    assert.deepEqual(missingBootstrapRows(api, readDoc('components/hub/architecture.md')), []);
});

test('falsification: a dropped mirror-list entry is caught', () => {
    const page = readDoc('architecture/database-design.md');
    const stale = page.replace(', `remote_token_snapshots`', '');
    assert.notEqual(stale, page, 'the list moved; re-point this falsification');
    assert.deepEqual(missingFromHubDbCopy(stale, ['remote_token_snapshots']), ['remote_token_snapshots']);
});

test('falsification: the old denial sentence is caught', () => {
    const page = readDoc('components/hub/api.md');
    const stale = `${page}\nThe hub also broadcasts \`remote_token_snapshots\` rows on this channel; indexers do not mirror that table.\n`;
    assert.deepEqual(deniedMirrors(stale, ['remote_token_snapshots']), ['remote_token_snapshots']);
});

test('falsification: a missing bootstrap row is caught', () => {
    const arch = readDoc('components/hub/architecture.md');
    const stale = arch.replace('| `GET /hub-db/snapshot/list_snapshots?', '| `GET /hub-db/snapshot/list_snapshot_gone?');
    assert.notEqual(stale, arch, 'the row moved; re-point this falsification');
    assert.deepEqual(missingBootstrapRows(readDoc('components/hub/api.md'), stale), ['list_snapshots']);
});
