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
 * Which ref each sibling checkout in .github/workflows/ci.yml resolves to,
 * driven as the runner would resolve it: the expression is READ OUT OF THE
 * WORKFLOW and evaluated here, so a copy of the rule cannot drift away from the
 * rule the venue runs.
 *
 * The case this exists for: on a pull_request event github.ref is
 * refs/pull/<n>/merge, never refs/heads/master, so an expression that decides
 * "is this master?" from github.ref alone sends a master-BOUND pull request to
 * the sibling's develop. The corpus on master documents the RELEASED platform,
 * so it is judged against unreleased code and fails on file moves that have not
 * shipped. PR 44 (the v0.19.1 release mirror) died that way on four citations
 * of indexer files that live at src/ on master and moved under src/consensus/
 * on develop.
 *
 * Every checkout step that names a `repository:` is covered, not just the
 * indexer one, because the next sibling added here will be copy-pasted from it.
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');

/* ------------------------------------------------------------------ *
 * A GitHub Actions expression evaluator, over the subset ci.yml uses.
 * Anything outside that subset throws rather than guessing, so a future
 * expression this cannot actually evaluate fails loudly here instead of
 * being graded against a wrong answer.
 * ------------------------------------------------------------------ */

function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === "'") {
            // GitHub escapes a single quote inside a string literal by doubling it.
            let j = i + 1;
            let s = '';
            for (;;) {
                if (j >= src.length) throw new Error('unterminated string literal');
                if (src[j] === "'" && src[j + 1] === "'") { s += "'"; j += 2; continue; }
                if (src[j] === "'") break;
                s += src[j++];
            }
            out.push({ kind: 'string', value: s });
            i = j + 1;
            continue;
        }
        const two = src.slice(i, i + 2);
        if (two === '&&' || two === '||' || two === '==' || two === '!=') {
            out.push({ kind: 'op', value: two });
            i += 2;
            continue;
        }
        if (c === '(' || c === ')' || c === ',') { out.push({ kind: c }); i++; continue; }
        const word = /^[A-Za-z_][A-Za-z0-9_.-]*/.exec(src.slice(i));
        if (word) { out.push({ kind: 'word', value: word[0] }); i += word[0].length; continue; }
        const num = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i));
        if (num) { out.push({ kind: 'number', value: Number(num[0]) }); i += num[0].length; continue; }
        throw new Error('unsupported character in expression: ' + JSON.stringify(c));
    }
    return out;
}

// GitHub's falsy set: empty string, 0, false, null. Everything else is truthy.
function truthy(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v !== '';
    if (typeof v === 'number') return v !== 0;
    return v !== false;
}

// A context property that is not set for the event (github.base_ref on a push)
// reaches the expression as null and casts to the empty string.
function asString(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
}

// GitHub compares strings case-insensitively.
function equals(a, b) {
    if (typeof a === 'string' || typeof b === 'string') {
        return asString(a).toLowerCase() === asString(b).toLowerCase();
    }
    return a === b;
}

const FUNCTIONS = {
    startswith: (s, p) => asString(s).toLowerCase().startsWith(asString(p).toLowerCase()),
    endswith: (s, p) => asString(s).toLowerCase().endsWith(asString(p).toLowerCase()),
    contains: (s, p) => asString(s).toLowerCase().includes(asString(p).toLowerCase()),
};

function evaluate(expression, context) {
    const tokens = tokenize(expression);
    let pos = 0;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];

    function lookup(dotted) {
        let node = context;
        for (const part of dotted.split('.')) {
            if (node === null || node === undefined || !(part in node)) {
                throw new Error('expression reads an unmodelled context property: ' + dotted);
            }
            node = node[part];
        }
        return node;
    }

    function primary() {
        const t = take();
        if (!t) throw new Error('expression ended early');
        if (t.kind === 'string' || t.kind === 'number') return t.value;
        if (t.kind === '(') {
            const v = orExpr();
            const close = take();
            if (!close || close.kind !== ')') throw new Error('missing closing parenthesis');
            return v;
        }
        if (t.kind === 'word') {
            if (peek() && peek().kind === '(') {
                take();
                const args = [];
                if (peek() && peek().kind !== ')') {
                    args.push(orExpr());
                    while (peek() && peek().kind === ',') { take(); args.push(orExpr()); }
                }
                const close = take();
                if (!close || close.kind !== ')') throw new Error('missing closing parenthesis');
                const fn = FUNCTIONS[t.value.toLowerCase()];
                if (!fn) throw new Error('unsupported expression function: ' + t.value);
                return fn(...args);
            }
            if (t.value === 'true') return true;
            if (t.value === 'false') return false;
            if (t.value === 'null') return null;
            return lookup(t.value);
        }
        throw new Error('unexpected token: ' + JSON.stringify(t));
    }

    function cmpExpr() {
        let left = primary();
        while (peek() && peek().kind === 'op' && (peek().value === '==' || peek().value === '!=')) {
            const op = take().value;
            const right = primary();
            left = op === '==' ? equals(left, right) : !equals(left, right);
        }
        return left;
    }

    // && and || yield an OPERAND, not a boolean: `a && b` is b when a is truthy
    // and a otherwise, which is what makes the ternary idiom in ci.yml work.
    function andExpr() {
        let left = cmpExpr();
        while (peek() && peek().kind === 'op' && peek().value === '&&') {
            take();
            const right = cmpExpr();
            left = truthy(left) ? right : left;
        }
        return left;
    }

    function orExpr() {
        let left = andExpr();
        while (peek() && peek().kind === 'op' && peek().value === '||') {
            take();
            const right = andExpr();
            left = truthy(left) ? left : right;
        }
        return left;
    }

    const value = orExpr();
    if (pos !== tokens.length) throw new Error('trailing tokens in expression');
    return value;
}

/* ------------------------------------------------------------------ *
 * Reading the workflow.
 * ------------------------------------------------------------------ */

// Every `- name:`/`- uses:` step in the file, as raw text blocks. A hand parser
// rather than js-yaml: this repo installs one devDependency and the shape being
// read is four keys under `with:`.
function checkoutStepsWithARepository() {
    const lines = fs.readFileSync(WORKFLOW, 'utf8').split('\n');
    const steps = [];
    let current = null;
    for (const line of lines) {
        if (/^\s*-\s+(name|uses):/.test(line)) {
            if (current) steps.push(current);
            current = [];
        }
        if (current) current.push(line);
    }
    if (current) steps.push(current);

    return steps.map(block => block.join('\n')).filter(text => {
        return /uses:\s*actions\/checkout@/.test(text) && /^\s*repository:\s*\S/m.test(text);
    }).map(text => {
        const repository = /^\s*repository:\s*(\S+)\s*$/m.exec(text);
        const ref = /^\s*ref:\s*\$\{\{(.+)\}\}\s*$/m.exec(text);
        const name = /^\s*-\s+name:\s*(.+)$/m.exec(text);
        return {
            name: name ? name[1].trim() : '(unnamed)',
            repository: repository[1],
            refExpression: ref ? ref[1].trim() : null,
        };
    });
}

// github.ref on a pull_request event is the MERGE ref, which is the whole point:
// it never equals refs/heads/<base>, so nothing about the base can be read off it.
function pullRequestContext(headRef, baseRef) {
    return { github: { event_name: 'pull_request', ref: 'refs/pull/44/merge', head_ref: headRef, base_ref: baseRef } };
}

function pushContext(branch) {
    return { github: { event_name: 'push', ref: 'refs/heads/' + branch, head_ref: null, base_ref: null } };
}

describe('ci.yml sibling checkout ref resolution', () => {
    const steps = checkoutStepsWithARepository();

    test('the workflow still checks out a sibling by an expression', () => {
        assert.ok(steps.length > 0, 'no actions/checkout step with a repository: was found in ' + WORKFLOW);
        assert.ok(
            steps.some(s => s.repository === 'XChain-Platform/xchain-indexer'),
            'the xchain-indexer sibling checkout is gone; the flag-day literals suite would silently skip',
        );
        for (const step of steps) {
            assert.ok(step.refExpression, 'sibling checkout "' + step.name + '" pins no ref: expression');
        }
    });

    for (const step of steps) {
        describe(step.repository, () => {
            const resolve = (context) => evaluate(step.refExpression, context);

            test('a pull request into master reads the sibling master', () => {
                // The PR 44 regression. A page on master documents released code,
                // so it must be graded against the sibling's released branch.
                assert.equal(resolve(pullRequestContext('mirror-v0191', 'master')), 'master');
            });

            test('a release head reads its own release branch', () => {
                assert.equal(resolve(pullRequestContext('release/v0.19.1', 'master')), 'release/v0.19.1');
            });

            test('a push to master reads the sibling master', () => {
                assert.equal(resolve(pushContext('master')), 'master');
            });

            test('a push to develop reads the sibling develop', () => {
                assert.equal(resolve(pushContext('develop')), 'develop');
            });

            test('anything else reads the sibling develop', () => {
                assert.equal(resolve(pushContext('some-lane-branch')), 'develop');
                assert.equal(resolve(pullRequestContext('some-lane-branch', 'develop')), 'develop');
            });
        });
    }
});

describe('the expression evaluator these assertions are made with', () => {
    // The evaluator is the instrument; if it scored every expression 'master'
    // the cases above would agree with each other and prove nothing.
    const ctx = { github: { ref: 'refs/heads/develop', head_ref: 'lane', base_ref: 'master' } };

    test('&& and || return an operand, the way GitHub does', () => {
        assert.equal(evaluate("true && 'a' || 'b'", ctx), 'a');
        assert.equal(evaluate("false && 'a' || 'b'", ctx), 'b');
        assert.equal(evaluate("'' || 'fallback'", ctx), 'fallback');
    });

    test('a ref test that reads github.ref cannot see a pull request base', () => {
        const old = "github.ref == 'refs/heads/master' && 'master' || 'develop'";
        assert.equal(evaluate(old, pullRequestContext('mirror-v0191', 'master')), 'develop');
        assert.equal(evaluate(old, pushContext('master')), 'master');
    });

    test('startsWith and equality are case-insensitive string casts', () => {
        assert.equal(evaluate("startsWith(github.head_ref, 'LA')", ctx), true);
        assert.equal(evaluate("startsWith(github.head_ref, 'release/')", ctx), false);
        assert.equal(evaluate("github.base_ref == 'MASTER'", ctx), true);
    });

    test('an unset context property casts to the empty string, not a crash', () => {
        assert.equal(evaluate("startsWith(github.base_ref, 'release/')", pushContext('master')), false);
        assert.equal(evaluate("github.base_ref == 'master'", pushContext('master')), false);
    });

    test('an unmodelled property or an unknown function throws instead of guessing', () => {
        assert.throws(() => evaluate('github.actor', ctx), /unmodelled context property/);
        assert.throws(() => evaluate("fromJSON('{}')", ctx), /unsupported expression function/);
    });
});
