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
 * Environment-variable documentation coverage gate .
 *
 * WHY. The 2026-07-27 docs audit found 169 environment variables that the
 * services read and the doc set never mentioned. Nothing had gone wrong; the
 * gap simply accumulated, one tuning knob at a time, because no check ever
 * compared `process.env` reads against the documented set. The audit closed
 * the gap with a throwaway script, which means the gap re-opens at the rate
 * the services grow. This file is that script, checked in, so the next
 * undocumented variable fails the build instead of waiting for the next audit.
 *
 * WHAT IT CHECKS. Three things, all of which the audit proved necessary:
 *
 *   1. Coverage, scoped per component. A variable read by the hub must appear
 *      on the HUB's pages. Matching against the whole doc repo lets a name
 *      documented elsewhere, with a different meaning, read as covered.
 *   2. Documented defaults match the code. The default written in the docs is
 *      cross-checked against the literal on the line that reads the variable.
 *      This is what caught the NODE_RPC_TIMEOUT divergence.
 *   3. Cross-component divergence. A variable read by two components with
 *      DIFFERENT defaults is a trap: one doc row silently describes the wrong
 *      behaviour for the other component. Each side must carry its own value.
 *
 * WHAT IT DOES NOT CHECK. Only production source is scanned (src/, bin/,
 * mcp/, index.js). Test fixtures, benchmark scripts and operator one-offs set
 * env vars for their own purposes and are not part of the configuration
 * surface an operator needs documented. Reads inside xchain-node/modules/ are
 * skipped too: that directory holds vendored copies of the other services,
 * whose variables belong to those components' pages.
 *
 * WHY THE HARNESS HAS ITS OWN TESTS. The audit's first default-checker
 * reported false green: the regex meant to drop the radix argument of
 * `parseInt(x, 10)` swallowed the default it was supposed to read, so a pass
 * over ~145 sites was partly vacuous, and it was only caught by accident. A
 * silent checker is worse than no checker, so `extractDefault` and the
 * scanners are exercised against fixtures below, including that exact case.
 * Those self-tests run everywhere, including in a standalone clone of this
 * repo where the sibling service checkouts are absent.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

/*  ------------------------------------------------------------------
 *  Layout
 *  ------------------------------------------------------------------ */

// This repo sits beside the service repos in the platform tree. In a
// standalone clone the siblings are absent and the coverage half of this
// suite skips; the harness self-tests still run.
const DOC_ROOT      = path.join(__dirname, '..');
const PLATFORM_ROOT = path.join(DOC_ROOT, '..');

// Doc directory name -> service repo name. Only shipped services are gated.
// xchain-contracts, xchain-e2e-test and xchain-wallet are excluded: the first
// two are harnesses whose env reads configure a test run, and the wallet
// reads build-time `import.meta.env`, not `process.env`.
const COMPONENTS = [
    'decoder', 'encoder', 'explorer', 'hub', 'indexer', 'node',
    'regtest-miner', 'sdk', 'sync', 'utxo-tracker', 'vm'
];

// Directories and entry files that make up a service's production surface.
const SOURCE_ROOTS = ['src', 'bin', 'mcp', 'index.js'];

// Never descend into these, wherever they appear.
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', 'modules', 'test', 'tests']);

// Injected by the runtime, not configured by an operator, so not documentable.
const NOT_CONFIGURATION = (name) => name.startsWith('npm_') || name === 'NODE_V8_COVERAGE';

/*  ------------------------------------------------------------------
 *  Known gaps at the time this gate landed (2026-07-27)
 *  ------------------------------------------------------------------
 *
 *  This gate is stricter than the audit's own script: it scans every
 *  production source file and requires the variable on the reading
 *  component's OWN pages. That turns up variables the audit's pass missed.
 *  They are listed here rather than left to silently fail, so the gate can
 *  land today and hold the line from here.
 *
 *  The list is a ratchet, not a parking lot. It may only shrink: an entry
 *  that no longer describes an undocumented read fails the build and must be
 *  deleted. Document the variable, delete its line.
 */
const KNOWN_GAPS = {
    // Empty as of 2026-07-27: every entry this gate landed with has been
    // documented and deleted. A new entry may only be added with the
    // variable's doc row already written and a reason it cannot land yet.
};

/*  ------------------------------------------------------------------
 *  Harness
 *  ------------------------------------------------------------------ */

const ENV_READ = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)|process\.env\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g;

/**
 * Reads the effective default off the expression that follows an env read.
 *
 * Written as a small scanner rather than a regex on purpose. The regex version
 * is what reported false green during the audit: `parseInt(process.env.X, 10)`
 * and `parseInt(process.env.X || '30000', 10)` differ only in where the comma
 * sits, and a pattern loose enough to skip the radix in the first is loose
 * enough to eat the default in the second.
 *
 * Rules, applied left to right from just after the read:
 *   - a `,` at the read's own depth means the read is an argument and what
 *     follows is a sibling argument (the radix), so jump past the enclosing
 *     call and keep looking;
 *   - `||` or `??` introduces a fallback: a literal is the default, an
 *     identifier (`cfg.X`) is another lookup, so keep going;
 *   - anything else ends the search.
 *
 * `'30000'` and `30000` are the same default to an operator, so the quoting is
 * not carried through: what matters downstream is whether the value is a
 * number, since that is the part a doc row gets wrong.
 *
 * @param {string} text  the source line, or the source from the read onward
 * @param {number} from  index just past the `process.env.X` read
 * @returns {{ value: string, numeric: boolean }|null}
 */
function extractDefault(text, from) {
    let i = from;
    let depth = 0;

    while (i < text.length) {
        const ch = text[i];

        if (ch === '(' || ch === '[' || ch === '{') { depth++; i++; continue; }

        if (ch === ')' || ch === ']' || ch === '}') {
            // Closing past our own depth means the enclosing expression ended.
            if (depth === 0) return null;
            depth--; i++; continue;
        }

        if (ch === ',' && depth === 0) {
            // We are an argument; skip the remaining arguments of this call.
            i = skipToEnclosingClose(text, i);
            if (i === -1) return null;
            continue;
        }

        if (depth === 0 && (text.startsWith('||', i) || text.startsWith('??', i))) {
            const operand = readOperand(text, i + 2);
            if (!operand) return null;
            if (operand.literal) return { value: operand.value, numeric: /^-?\d+(\.\d+)?$/.test(operand.value) };
            // A non-literal fallback (cfg.X, DEFAULTS.X); the real default is
            // further along the chain, so resume scanning after it.
            i = operand.end;
            continue;
        }

        if (ch === ';') return null;

        i++;
    }
    return null;
}

/** Advances past the `)` that closes the call the cursor sits inside. */
function skipToEnclosingClose(text, i) {
    let depth = 0;
    for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') {
            if (depth === 0) return i + 1;
            depth--;
        }
    }
    return -1;
}

/** Reads one operand after a `||`/`??`, reporting whether it is a literal. */
function readOperand(text, i) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) return null;

    const ch = text[i];

    if (ch === "'" || ch === '"' || ch === '`') {
        const end = text.indexOf(ch, i + 1);
        if (end === -1) return null;
        return { literal: true, value: text.slice(i + 1, end), end: end + 1 };
    }

    const num = /^-?\d[\d_]*(\.\d+)?/.exec(text.slice(i));
    if (num) {
        return { literal: true, value: num[0].replace(/_/g, ''), end: i + num[0].length };
    }

    // Identifier, member expression or call: not a literal default.
    const ident = /^[A-Za-z_$][A-Za-z0-9_$.]*(\([^)]*\))?/.exec(text.slice(i));
    if (ident) return { literal: false, end: i + ident[0].length };

    return null;
}

/**
 * Collects every env read in a source string.
 *
 * @returns {Map<string, Array<{line:number, default:object|null}>>}
 */
function scanSource(source) {
    const found = new Map();
    const lines = source.split('\n');

    lines.forEach((line, idx) => {
        // A commented-out read documents nothing and configures nothing.
        const code = line.replace(/\/\/.*$/, '');
        ENV_READ.lastIndex = 0;
        let m;
        while ((m = ENV_READ.exec(code)) !== null) {
            const name = m[1] || m[2];
            if (!found.has(name)) found.set(name, []);
            found.get(name).push({ line: idx + 1, default: extractDefault(code, m.index + m[0].length) });
        }
    });

    return found;
}

/** Every .js/.cjs/.mjs file under a service's production source roots. */
function sourceFiles(repoDir) {
    const out = [];
    const walk = (dir) => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (SKIP_DIRS.has(e.name)) continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.(js|cjs|mjs)$/.test(e.name)) out.push(p);
        }
    };

    for (const root of SOURCE_ROOTS) {
        const p = path.join(repoDir, root);
        if (!fs.existsSync(p)) continue;
        if (fs.statSync(p).isDirectory()) walk(p);
        else out.push(p);
    }
    return out;
}

/** Reads a component's own doc pages as one text blob plus its lines. */
function readComponentDocs(docDir) {
    const lines = [];
    const walk = (dir) => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith('.md')) {
                for (const l of fs.readFileSync(p, 'utf8').split('\n')) lines.push(l);
            }
        }
    };
    walk(docDir);
    return lines;
}

/** Lines of a component's docs that mention the variable by name. */
function docLinesFor(docLines, name) {
    const mention = new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`);
    return docLines.filter((l) => mention.test(l));
}

// A `|| 0` default is almost always "feature off", and a doc row that says so
// in words is correct, not stale. Anything narrower produces noise; anything
// wider lets a real number rot.
const MEANS_ZERO = /\b(none|unset|disabled|disable|off|no limit|unlimited)\b/i;

/**
 * Is a numeric default present on any doc line for the variable?
 *
 * Deliberately lenient about where in the row the number sits: the doc set
 * uses several table shapes, and pinning a column would break on the next one.
 * Strict about the value, which is the part that goes stale.
 */
function defaultDocumented(rows, value) {
    const asNumber = new RegExp(`(?<![\\d.])${value.replace('.', '\\.')}(?![\\d.])`);
    return rows.some((r) => asNumber.test(r) || (value === '0' && MEANS_ZERO.test(r)));
}

/*  ------------------------------------------------------------------
 *  Harness self-tests: these run everywhere, siblings or not
 *  ------------------------------------------------------------------ */

describe('extractDefault (the checker that reported false green during the audit)', () => {
    const defaultOf = (line) => {
        ENV_READ.lastIndex = 0;
        const m = ENV_READ.exec(line);
        assert.ok(m, `fixture has no env read: ${line}`);
        return extractDefault(line, m.index + m[0].length);
    };

    test('reads the default past a parseInt radix argument', () => {
        // The exact shape the audit's regex swallowed.
        assert.deepEqual(
            defaultOf("const t = parseInt(process.env.NODE_RPC_TIMEOUT, 10) || 60000;"),
            { value: '60000', numeric: true }
        );
    });

    test('reads a default that sits inside the parseInt call', () => {
        assert.deepEqual(
            defaultOf("const t = parseInt(process.env.NODE_RPC_TIMEOUT || '30000', 10);"),
            { value: '30000', numeric: true }
        );
    });

    test('walks past non-literal fallbacks to the real default', () => {
        assert.deepEqual(
            defaultOf("this.max = parseInt(process.env.ANCHOR_QUEUE_MAX || cfg.ANCHOR_QUEUE_MAX || '500');"),
            { value: '500', numeric: true }
        );
    });

    test('reads a bare || default', () => {
        assert.deepEqual(defaultOf("const p = process.env.PORT || 3000;"), { value: '3000', numeric: true });
    });

    test('reads a ?? default', () => {
        assert.deepEqual(defaultOf("const p = Number(process.env.PORT ?? 8080);"), { value: '8080', numeric: true });
    });

    test('reads a string default', () => {
        assert.deepEqual(defaultOf("const h = process.env.DB_HOST || '127.0.0.1';"), { value: '127.0.0.1', numeric: false });
    });

    test('reports no default for a boolean switch', () => {
        assert.equal(defaultOf("const on = process.env.FEATURE === '1';"), null);
    });

    test('reports no default for a bare read', () => {
        assert.equal(defaultOf("const key = process.env.HUB_API_KEY;"), null);
    });

    test('does not leak a default across a statement boundary', () => {
        assert.equal(defaultOf("const key = process.env.HUB_API_KEY; const p = x || 3000;"), null);
    });

    test('does not mistake a later argument for a default', () => {
        assert.equal(defaultOf("logger.warn(process.env.MODE, 'fallback');"), null);
    });
});

describe('scanSource', () => {
    test('finds dot and bracket reads and records their lines', () => {
        const found = scanSource([
            "const a = process.env.ALPHA || 1;",
            "const b = process.env['BETA'] || 'x';"
        ].join('\n'));
        assert.deepEqual([...found.keys()].sort(), ['ALPHA', 'BETA']);
        assert.equal(found.get('ALPHA')[0].line, 1);
        assert.equal(found.get('BETA')[0].default.value, 'x');
    });

    test('ignores a commented-out read', () => {
        const found = scanSource("// const a = process.env.GHOST || 1;");
        assert.equal(found.size, 0);
    });

    test('records every site of a variable read more than once', () => {
        const found = scanSource("const a = process.env.DUP || 1;\nconst b = process.env.DUP || 2;");
        assert.equal(found.get('DUP').length, 2);
    });
});

describe('doc matching', () => {
    test('a variable name is not matched by a longer name containing it', () => {
        const rows = docLinesFor(['| `XCHAIN_HUB_API_KEY` | the hub key |'], 'HUB_API_KEY');
        assert.deepEqual(rows, []);
    });

    test('a variable is matched inside a table row', () => {
        const rows = docLinesFor(['| `HUB_API_KEY` | the hub key | none |'], 'HUB_API_KEY');
        assert.equal(rows.length, 1);
    });

    test('a documented default is found anywhere in the row', () => {
        assert.equal(defaultDocumented(['| `NODE_RPC_TIMEOUT` | timeout | `30000` |'], '30000'), true);
    });

    test('a `|| 0` default is satisfied by a row that says the feature is off', () => {
        assert.equal(defaultDocumented(['| `MIRROR_MAX_LAG_S` | No | None | warn above this lag |'], '0'), true);
        assert.equal(defaultDocumented(['| `SOME_CAP` | No | `500` | a real number |'], '0'), false);
    });

    test('a wrong documented default is rejected, and a prefix does not count', () => {
        assert.equal(defaultDocumented(['| `NODE_RPC_TIMEOUT` | timeout | `30000` |'], '3000'), false);
        assert.equal(defaultDocumented(['| `NODE_RPC_TIMEOUT` | timeout | `30000` |'], '60000'), false);
    });
});

/*  ------------------------------------------------------------------
 *  The gate itself
 *  ------------------------------------------------------------------ */

const present = COMPONENTS.filter((c) => fs.existsSync(path.join(PLATFORM_ROOT, `xchain-${c}`, 'package.json')));
const siblingsMissing = present.length === 0;

// Gathered once; every gate test below reads from this.
const survey = new Map();
for (const c of present) {
    const repo = path.join(PLATFORM_ROOT, `xchain-${c}`);
    const vars = new Map();

    for (const file of sourceFiles(repo)) {
        const found = scanSource(fs.readFileSync(file, 'utf8'));
        for (const [name, sites] of found) {
            if (NOT_CONFIGURATION(name)) continue;
            if (!vars.has(name)) vars.set(name, []);
            for (const s of sites) vars.get(name).push({ ...s, file: path.relative(repo, file) });
        }
    }

    survey.set(c, { vars, docLines: readComponentDocs(path.join(DOC_ROOT, 'components', c)) });
}

describe('environment-variable documentation coverage ', { skip: siblingsMissing ? 'sibling service repos not checked out' : false }, () => {
    test('the survey actually found something to check', () => {
        const total = [...survey.values()].reduce((n, s) => n + s.vars.size, 0);
        // A refactor that breaks the scanner must not read as a clean bill of
        // health. The services read hundreds of variables between them.
        assert.ok(total > 300, `only ${total} env reads found across ${present.length} components; the scanner is probably broken`);
    });

    for (const c of present) {
        describe(c, () => {
            const { vars, docLines } = survey.get(c);
            const waived = new Set(KNOWN_GAPS[c] || []);

            test('every variable the code reads is documented on this component\'s own pages', () => {
                const undocumented = [];
                for (const [name, sites] of vars) {
                    if (waived.has(name)) continue;
                    if (docLinesFor(docLines, name).length === 0) {
                        undocumented.push(`${name} (read at ${sites[0].file}:${sites[0].line})`);
                    }
                }
                assert.deepEqual(
                    undocumented, [],
                    `undocumented in components/${c}/:\n  ${undocumented.join('\n  ')}\n` +
                    `Add a row for each to components/${c}/configuration.md (name, meaning, default).`
                );
            });

            test('documented numeric defaults match the literal on the reading line', () => {
                const wrong = [];
                for (const [name, sites] of vars) {
                    const rows = docLinesFor(docLines, name);
                    if (rows.length === 0) continue; // coverage test owns this

                    const numeric = sites.filter((s) => s.default && s.default.numeric);
                    if (numeric.length === 0) continue;

                    // Distinct defaults within one component are usually a
                    // per-call override rather than drift, so any documented
                    // one counts; a value documented nowhere does not.
                    const values = [...new Set(numeric.map((s) => s.default.value))];
                    if (!values.some((v) => defaultDocumented(rows, v))) {
                        wrong.push(`${name}: code default ${values.join(' or ')} (${numeric[0].file}:${numeric[0].line}) appears on no doc line for it`);
                    }
                }
                assert.deepEqual(wrong, [], `default drift in components/${c}/:\n  ${wrong.join('\n  ')}`);
            });
        });
    }

    test('a variable read by several components with different defaults says so on each', () => {
        // NODE_RPC_TIMEOUT is why this exists: 30000 in the decoder, encoder
        // and utxo-tracker, 60000 in the regtest-miner. Only the decoder's
        // value was documented, so the miner's real timeout was undocumented
        // behind a number that was wrong for it.
        const byName = new Map();
        for (const c of present) {
            for (const [name, sites] of survey.get(c).vars) {
                const values = [...new Set(sites.filter((s) => s.default && s.default.numeric).map((s) => s.default.value))];
                if (values.length !== 1) continue;
                if (!byName.has(name)) byName.set(name, new Map());
                byName.get(name).set(c, values[0]);
            }
        }

        const unflagged = [];
        for (const [name, perComponent] of byName) {
            if (new Set(perComponent.values()).size < 2) continue;
            for (const [c, value] of perComponent) {
                const rows = docLinesFor(survey.get(c).docLines, name);
                if (rows.length === 0) continue; // coverage test owns this
                if (!defaultDocumented(rows, value)) {
                    unflagged.push(`${name} defaults to ${value} in ${c} but components/${c}/ does not say so (values across components: ${[...perComponent].map(([k, v]) => `${k}=${v}`).join(', ')})`);
                }
            }
        }
        assert.deepEqual(unflagged, [], `divergent defaults documented on only one side:\n  ${unflagged.join('\n  ')}`);
    });

    test('the known-gap list only shrinks', () => {
        const stale = [];
        for (const [c, names] of Object.entries(KNOWN_GAPS)) {
            if (!survey.has(c)) continue;
            const { vars, docLines } = survey.get(c);
            for (const name of names) {
                if (!vars.has(name)) stale.push(`${c}/${name}: no longer read by the code`);
                else if (docLinesFor(docLines, name).length > 0) stale.push(`${c}/${name}: now documented`);
            }
        }
        assert.deepEqual(
            stale, [],
            `KNOWN_GAPS entries that no longer describe a gap; delete these lines from ${path.basename(__filename)}:\n  ${stale.join('\n  ')}`
        );
    });
});
