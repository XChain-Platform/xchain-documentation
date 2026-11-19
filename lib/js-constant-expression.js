/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 *********************************************************************/

'use strict';

const NUMBER = /^(?:0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*|\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?)/;

class ConstantParser {
    constructor(text, start) {
        this.text = text;
        this.i = start;
    }

    spacedIndex() {
        let i = this.i;
        while (i < this.text.length && /\s/.test(this.text[i])) i++;
        return i;
    }

    take(...operators) {
        const at = this.spacedIndex();
        for (const operator of operators.sort((a, b) => b.length - a.length)) {
            if (this.text.startsWith(operator, at)) {
                this.i = at + operator.length;
                return operator;
            }
        }
        return null;
    }

    primary() {
        const start = this.i;
        const at = this.spacedIndex();
        const number = NUMBER.exec(this.text.slice(at));
        if (number) {
            this.i = at + number[0].length;
            return Number(number[0].replace(/_/g, ''));
        }
        this.i = at;
        if (this.take('(') !== null) {
            const value = this.additive();
            if (value !== null && this.take(')') !== null) return value;
        }
        this.i = start;
        return null;
    }

    power() {
        const left = this.primary();
        if (left === null) return null;
        const end = this.i;
        if (this.take('**') === null) return left;
        const right = this.unary();
        if (right !== null) return left ** right;
        this.i = end;
        return left;
    }

    unary() {
        const start = this.i;
        const operator = this.take('+', '-');
        if (operator === null) return this.power();
        const value = this.unary();
        if (value !== null) return operator === '-' ? -value : value;
        this.i = start;
        return null;
    }

    product() {
        let value = this.unary();
        if (value === null) return null;
        while (true) {
            const end = this.i;
            const operator = this.take('*', '/', '%');
            if (operator === null || operator === '*' && this.text[this.i] === '*') {
                this.i = end;
                return value;
            }
            const right = this.unary();
            if (right === null) {
                this.i = end;
                return value;
            }
            if (operator === '*') value *= right;
            else if (operator === '/') value /= right;
            else value %= right;
        }
    }

    additive() {
        let value = this.product();
        if (value === null) return null;
        while (true) {
            const end = this.i;
            const operator = this.take('+', '-');
            if (operator === null) return value;
            const right = this.product();
            if (right === null) {
                this.i = end;
                return value;
            }
            value = operator === '+' ? value + right : value - right;
        }
    }
}

function constantExpression(text, start) {
    const parser = new ConstantParser(text, start);
    const value = parser.additive();
    if (value === null || !Number.isFinite(value)) return null;
    return { value, end: parser.i };
}

function operandContinues(text, end) {
    let i = end;
    let crossedLine = false;
    while (i < text.length && /\s/.test(text[i])) {
        if (text[i] === '\n') crossedLine = true;
        i++;
    }
    if (i === text.length) return false;
    if (text.startsWith('||', i) || text.startsWith('??', i)) return false;
    if (':,;)]}'.includes(text[i])) return false;
    if (text[i] === '?' && text[i + 1] !== '.' && text[i + 1] !== '?') return false;
    // A newline ends the statement before an identifier in repos without
    // semicolons, except the keyword operators, which carry the expression on.
    if (crossedLine && /[A-Za-z_$]/.test(text[i])) {
        return /^(?:in|instanceof)(?![A-Za-z0-9_$])/.test(text.slice(i));
    }
    return true;
}

module.exports = { constantExpression, operandContinues };
