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
 * Source readers for the explorer error-code registry gate: the quote-aware
 * argument splitter, and the rule for the explorer's `refusal(message, 'CODE')`
 * helper, which builds `{ refusal: { error, code } }` with shorthand and so
 * leaves no `code:` on the line for the line rules to read.
 *
 ********************************************************************/

const assert = require('node:assert/strict');

// The top-level arguments of the call whose `(` sits at `open`, quote-aware, so a comma,
// semicolon or parenthesis inside a message string does not split it.
function callArguments(text, open) {
    const args = [];
    let depth = 0, quote = null, start = open + 1;
    for (let i = open; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') i++;
            else if (ch === quote) quote = null;
        } else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
        else if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') {
            if (--depth === 0) { args.push(text.slice(start, i).trim()); return args; }
        } else if (ch === ',' && depth === 1) { args.push(text.slice(start, i).trim()); start = i + 1; }
    }
    return null;
}

// Every code sent through a `refusal(message, 'CODE')` call in `text`, as Map code -> line.
// The helper's own declaration is skipped. A call whose code is not a literal fails the
// gate rather than going unread.
function refusalCodes(text, name) {
    const found = new Map();
    for (const m of text.matchAll(/(?<![\w.])refusal\(/g)) {
        if (/function\s+$/.test(text.slice(0, m.index))) continue;
        const where = `${name}:${text.slice(0, m.index).split('\n').length}`;
        const args  = callArguments(text, m.index + m[0].length - 1);
        assert.ok(args && args.length === 2, `unreadable refusal call at ${where}`);
        const code  = args[1].match(/^'([A-Z][A-Z0-9_]{2,})'$/);
        assert.ok(code, `refusal at ${where} sends a code this gate cannot read (${args[1]}); give it a literal code`);
        if (!found.has(code[1])) found.set(code[1], where);
    }
    return found;
}

module.exports = { callArguments, refusalCodes };
