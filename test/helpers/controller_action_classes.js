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
const { sibling } = require('./sibling_checkout.js');

const CONTROLLER_GUARD = 'src/utility/controller_guard.js';

function closingBrace(source, open) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let i = open; i < source.length; i += 1) {
        const char = source[i];
        const next = source[i + 1];
        if (lineComment) {
            if (char === '\n') lineComment = false;
            continue;
        }
        if (blockComment) {
            if (char === '*' && next === '/') {
                blockComment = false;
                i += 1;
            }
            continue;
        }
        if (quote !== null) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '/' && next === '/') {
            lineComment = true;
            i += 1;
        } else if (char === '/' && next === '*') {
            blockComment = true;
            i += 1;
        } else if (char === '\'' || char === '"' || char === '`') {
            quote = char;
        } else if (char === '{') {
            depth += 1;
        } else if (char === '}' && --depth === 0) {
            return i;
        }
    }
    return -1;
}

function blockMatching(source, pattern) {
    const match = pattern.exec(source);
    if (match === null) return null;
    const open = match.index + match[0].lastIndexOf('{');
    const close = closingBrace(source, open);
    return close === -1 ? null : source.slice(open + 1, close);
}

function parseControllerActionClasses(source) {
    const method = blockMatching(source,
        /^[ \t]*controllerActionClass\s*\(\s*actionType\s*\)\s*\{/m);
    if (method === null) throw new Error('controllerActionClass method not found');
    const switchBody = blockMatching(method, /\bswitch\s*\(\s*actionType\s*\)\s*\{/m);
    if (switchBody === null) throw new Error('controllerActionClass switch not found');

    const classes = {};
    const pending = [];
    const body = switchBody.replace(/^[ \t]*\/\/.*$/gm, '');
    const tokens = /\bcase\s+(['"])([^'"\r\n]+)\1\s*:|\bdefault\s*:|\breturn\s+(?:(['"])([^'"\r\n]+)\3|[^;]+)\s*;/g;
    for (const token of body.matchAll(tokens)) {
        if (token[2] !== undefined) {
            pending.push(token[2]);
        } else if (token[0].trimStart().startsWith('return')) {
            if (token[4] !== undefined) {
                for (const action of pending) classes[action] = token[4];
            }
            pending.length = 0;
        }
    }
    if (Object.keys(classes).length === 0) {
        throw new Error('controllerActionClass switch yielded no case');
    }
    return classes;
}

function readControllerActionClasses() {
    const checkout = sibling('xchain-indexer', [CONTROLLER_GUARD]);
    if (checkout.skip) return { skip: checkout.skip };
    const source = fs.readFileSync(path.join(checkout.root, CONTROLLER_GUARD), 'utf8');
    return { skip: false, classes: parseControllerActionClasses(source) };
}

module.exports = { parseControllerActionClasses, readControllerActionClasses };
