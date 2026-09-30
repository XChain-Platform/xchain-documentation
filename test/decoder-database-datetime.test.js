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
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = path.join(__dirname, '..', 'components', 'decoder', 'database.md');

function tableCells(line) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells[0] === '') cells.shift();
    if (cells.at(-1) === '') cells.pop();
    return cells;
}

function isSeparator(cells) {
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function allTables(markdown) {
    const lines = markdown.split(/\r?\n/);
    const tables = [];
    for (let index = 0; index < lines.length - 1; index += 1) {
        const header = tableCells(lines[index]);
        const separator = tableCells(lines[index + 1]);
        if (!lines[index].includes('|') || !isSeparator(separator)
            || separator.length !== header.length) continue;
        const rows = [];
        for (const line of lines.slice(index + 2)) {
            if (!line.includes('|')) break;
            rows.push(tableCells(line));
        }
        tables.push({ header, rows });
    }
    return tables;
}

function findTableByHeaderCell(markdown, headerCell) {
    const table = allTables(markdown).find((candidate) => candidate.header.includes(headerCell));
    if (table === undefined) throw new Error(`no table with header cell "${headerCell}" found`);
    return table;
}

function sectionMarkdown(markdown, headingText) {
    const lines = markdown.split(/\r?\n/);
    const heading = new RegExp(`^###\\s+${headingText}(?:\\s|$)`);
    const start = lines.findIndex((line) => heading.test(line));
    if (start === -1) throw new Error(`heading "${headingText}" not found`);
    const endOffset = lines.slice(start + 1)
        .findIndex((line) => /^#{1,3}\s+/.test(line));
    const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
    return lines.slice(start, end).join('\n');
}

function checkMempoolFirstSeen(markdown) {
    const table = findTableByHeaderCell(sectionMarkdown(markdown, 'mempool_transactions'), 'Column');
    const row = table.rows.find((cells) => cells[0] === '`first_seen`');
    if (row === undefined) throw new Error('mempool_transactions.first_seen row not found');
    const type = row[1].replace(/`/g, '');
    if (!type.startsWith('DATETIME')) {
        throw new Error(`first_seen type "${type}" does not start with DATETIME`);
    }
    return row;
}

function checkMigrationMode(markdown, file, expectedMode) {
    const table = findTableByHeaderCell(markdown, 'File');
    const row = table.rows.find((cells) => cells[0] === `\`${file}\``);
    if (row === undefined) throw new Error(`migration row for ${file} not found`);
    if (row[1] !== expectedMode) {
        throw new Error(`migration ${file} has mode "${row[1]}", expected "${expectedMode}"`);
    }
    return row;
}

function checkNoTimestampCells(markdown) {
    for (const table of allTables(markdown)) {
        for (const row of table.rows) {
            for (const cell of row) {
                const bare = cell.replace(/`/g, '');
                if (bare.startsWith('TIMESTAMP')) {
                    throw new Error(`table cell "${cell}" starts with TIMESTAMP`);
                }
            }
        }
    }
}

function checkDecoderDatabaseDatetimeDocs(markdown) {
    checkMempoolFirstSeen(markdown);
    checkMigrationMode(markdown, '2026-08-22-mempool-first-seen.sql', 'auto');
    checkMigrationMode(markdown, '2026-09-27-mempool-first-seen-datetime.sql', 'manual');
    if (!markdown.includes('schema_migrations.applied_at')) {
        throw new Error('page does not name schema_migrations.applied_at');
    }
    if (!markdown.includes('UTC')) {
        throw new Error('page does not name UTC');
    }
    checkNoTimestampCells(markdown);
}

test('mempool_transactions documents first_seen as DATETIME', () => {
    const markdown = fs.readFileSync(PAGE_PATH, 'utf8');
    const row = checkMempoolFirstSeen(markdown);
    assert.equal(row[0], '`first_seen`');
});

test('migrations table documents both first_seen migrations with modes', () => {
    const markdown = fs.readFileSync(PAGE_PATH, 'utf8');
    checkMigrationMode(markdown, '2026-08-22-mempool-first-seen.sql', 'auto');
    checkMigrationMode(markdown, '2026-09-27-mempool-first-seen-datetime.sql', 'manual');
});

test('page names schema_migrations.applied_at and UTC', () => {
    const markdown = fs.readFileSync(PAGE_PATH, 'utf8');
    assert.match(markdown, /schema_migrations\.applied_at/);
    assert.match(markdown, /UTC/);
});

test('no table cell on the page starts with TIMESTAMP', () => {
    const markdown = fs.readFileSync(PAGE_PATH, 'utf8');
    assert.doesNotThrow(() => checkNoTimestampCells(markdown));
});

test('the live decoder database page passes the full datetime check', () => {
    const markdown = fs.readFileSync(PAGE_PATH, 'utf8');
    assert.doesNotThrow(() => checkDecoderDatabaseDatetimeDocs(markdown));
});

test('the checker throws when the first_seen row is removed', () => {
    const markdown = fs.readFileSync(PAGE_PATH, 'utf8');
    const withoutFirstSeen = markdown
        .split(/\r?\n/)
        .filter((line) => !line.includes('`first_seen`'))
        .join('\n');
    assert.throws(
        () => checkDecoderDatabaseDatetimeDocs(withoutFirstSeen),
        /first_seen row not found/,
    );
});
