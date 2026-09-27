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

const fs = require('node:fs');
const path = require('node:path');

function tableCells(line) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells[0] === '') cells.shift();
    if (cells.at(-1) === '') cells.pop();
    return cells;
}

function isSeparator(cells) {
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function sectionLines(markdown, title) {
    const lines = markdown.split(/\r?\n/);
    const heading = new RegExp(`^###\\s+${title}(?:\\s|$)`);
    const start = lines.findIndex((line) => heading.test(line));
    if (start === -1) throw new Error(`${title} heading not found`);
    const endOffset = lines.slice(start + 1)
        .findIndex((line) => /^#{1,3}\s+/.test(line));
    const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
    return lines.slice(start + 1, end);
}

function tableRows(markdown, title) {
    const lines = sectionLines(markdown, title);
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
        if (rows.length === 0) throw new Error(`${title} table has no data rows`);
        return rows;
    }
    throw new Error(`${title} table not found`);
}

function backticked(cell, title) {
    const match = /`([^`]+)`/.exec(cell);
    if (match === null) throw new Error(`${title} table row has no backticked value`);
    return match[1].trim();
}

function parseInvocationTable(markdown) {
    const invocations = {};
    for (const cells of tableRows(markdown, 'Invocation points')) {
        invocations[backticked(cells[0] || '', 'Invocation points')]
            = backticked(cells[1] || '', 'Invocation points');
    }
    return invocations;
}

function parseActionClassesTable(markdown) {
    const classes = {};
    for (const cells of tableRows(markdown, 'Action classes')) {
        const name = backticked(cells[0] || '', 'Action classes');
        const actions = [...(cells[2] || '').matchAll(/`([^`]+)`/g)]
            .map((match) => match[1].trim());
        if (actions.length === 0) {
            throw new Error('Action classes table row has no backticked names');
        }
        classes[name] = actions;
    }
    return classes;
}

function readControllerBoundTokensPage() {
    const page = path.join(__dirname, '..', '..', 'protocol', 'controller-bound-tokens.md');
    return fs.readFileSync(page, 'utf8');
}

module.exports = {
    parseInvocationTable,
    parseActionClassesTable,
    readControllerBoundTokensPage,
};
