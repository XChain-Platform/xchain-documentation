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
 * Environment-variable documentation coverage: the scanning core (,
 * factored out under ).
 *
 * WHY THIS IS A LIBRARY. The gate began as one test file in this repo, which
 * meant it only ever executed when somebody ran the docs suite. A service repo
 * could therefore add a `process.env` read, push it, and leave the gate red
 * with no signal anywhere: it sat red for days after added
 * REPLICA_DB_READONLY, and was noticed only because an unrelated run happened
 * to falsify it. The cross-repo trigger that fixes that
 * (`bin/check-env-var-doc-coverage.js` at the platform root) has to apply the
 * SAME rules as the docs suite, and a second copy of a scanner this fiddly
 * would drift within a month. So the rules live here and both callers import
 * them.
 *
 * WHICH TREE GETS SCANNED, AND WHY IT IS ASYMMETRIC. Reading a sibling repo's
 * working tree is what made this gate unusable on a shared checkout: on
 * 2026-08-06 the docs suite went red on two variables that existed only in
 * another session's uncommitted experiment in xchain-indexer, so one session's
 * in-flight edit reddened every other session's suite for an API that might
 * never land in that shape. A repo's committed tree is the only state its
 * neighbours can be held to. Hence two readers, and callers pick per side:
 *
 *   - the docs suite reads SERVICE source from the committed tree (a sibling's
 *     in-flight work is not yet a claim on anyone) and its OWN doc pages from
 *     the working tree (a suite that ignored the row you just wrote would be
 *     useless to edit against);
 *   - the platform-root trigger reads BOTH sides committed, because it is
 *     nobody's working tree and its job is to police the shared reality.
 *
 * WHAT IS CHECKED. Four things, all of which the 2026-07-27 audit proved
 * necessary; see `check*` below for the individual rationales.
 *
 * WHAT IS NOT SCANNED. Only production source (src/, bin/, mcp/, index.js).
 * Test fixtures, benchmarks and operator one-offs set env vars for their own
 * purposes and are not a configuration surface an operator needs documented.
 * Reads inside xchain-node/modules/ are skipped too: that directory holds
 * vendored copies of the other services, whose variables belong to those
 * components' pages.
 *
 ********************************************************************/

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/*  ------------------------------------------------------------------
 *  Layout
 *  ------------------------------------------------------------------ */

// Doc directory name -> service repo name (`xchain-<name>`). Only shipped
// services are gated. xchain-contracts, xchain-e2e-test and xchain-wallet are
// excluded: the first two are harnesses whose env reads configure a test run,
// and the wallet reads build-time `import.meta.env`, not `process.env`.
const COMPONENTS = [
    'decoder', 'encoder', 'explorer', 'hub', 'indexer', 'node',
    'regtest-miner', 'sdk', 'sync', 'utxo-tracker', 'vm'
];

// Top-level directories and entry files that make up a service's production surface.
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
 *  They are listed here rather than left to silently fail, so the gate could
 *  land and hold the line from there.
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
 *  Path predicates (shared by both readers, so the two trees are
 *  filtered identically)
 *  ------------------------------------------------------------------ */

/** Is this repo-relative path part of a service's production source surface? */
function isSourcePath(rel) {
    const parts = rel.split('/');
    if (parts.some((p) => SKIP_DIRS.has(p))) return false;
    if (!/\.(js|cjs|mjs)$/.test(parts[parts.length - 1])) return false;
    // A bare `index.js` counts; anything else must sit under src/, bin/ or mcp/.
    if (parts.length === 1) return SOURCE_ROOTS.includes(parts[0]);
    return ['src', 'bin', 'mcp'].includes(parts[0]);
}

/** Is this docs-repo-relative path one of `component`'s own pages? */
function isDocPath(rel, component) {
    return rel.startsWith(`components/${component}/`) && rel.endsWith('.md');
}

/*  ------------------------------------------------------------------
 *  Tree readers
 *  ------------------------------------------------------------------
 *
 *  Both expose the same two calls, so the survey builder never knows which
 *  tree it is looking at:
 *
 *    listPaths(repoDir, prefixes) -> repo-relative POSIX paths
 *    readFiles(repoDir, rels)     -> Map<rel, contents>
 */

/** Reads the checkout as it sits on disk, uncommitted edits included. */
function workingTreeReader() {
    return {
        label: 'working tree',
        listPaths(repoDir, prefixes) {
            const out = [];
            const walk = (abs, rel) => {
                let entries;
                try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
                for (const e of entries) {
                    if (SKIP_DIRS.has(e.name)) continue;
                    const childRel = rel ? `${rel}/${e.name}` : e.name;
                    if (e.isDirectory()) walk(path.join(abs, e.name), childRel);
                    else out.push(childRel);
                }
            };
            for (const prefix of prefixes) {
                const abs = path.join(repoDir, prefix);
                let st;
                try { st = fs.statSync(abs); } catch { continue; }
                if (st.isDirectory()) walk(abs, prefix);
                else out.push(prefix);
            }
            return out;
        },
        readFiles(repoDir, rels) {
            const out = new Map();
            for (const rel of rels) {
                try {
                    out.set(rel, fs.readFileSync(path.join(repoDir, rel), 'utf8'));
                } catch (err) {
                    // Tolerate only the genuine race: a file listed a moment ago
                    // can be gone before it is read (an edit landing mid-scan).
                    // Any other fault (permission, disk, is-a-directory) makes
                    // the survey under-report while still reading complete,
                    // which is 's failure mode, so it surfaces. The
                    // committed reader is already this strict: catFileBatch
                    // skips blobs git reports missing and nothing else.
                    if (err.code === 'ENOENT') continue;
                    throw err;
                }
            }
            return out;
        },
    };
}

/**
 * Reads a git ref, so a neighbour's uncommitted work is invisible.
 *
 * @param {string} ref  any rev-parse-able ref; HEAD in every wired caller
 */
function committedTreeReader(ref = 'HEAD') {
    return {
        label: `committed tree (${ref})`,
        ref,
        listPaths(repoDir, prefixes) {
            // -z because a path with a space or a quote is otherwise shell-quoted
            // by ls-tree and would silently not match anything downstream.
            const out = git(repoDir, ['ls-tree', '-r', '-z', '--name-only', ref, '--', ...prefixes], 'utf8');
            return out.split('\0').filter(Boolean);
        },
        readFiles(repoDir, rels) {
            return catFileBatch(repoDir, ref, rels);
        },
    };
}

/** Does this directory have a git object database to read a ref out of? */
function isGitRepo(repoDir) {
    try {
        git(repoDir, ['rev-parse', '--git-dir'], 'utf8');
        return true;
    } catch { return false; }
}

function git(repoDir, args, encoding) {
    return execFileSync('git', ['-C', repoDir, ...args], {
        encoding, maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
}

/**
 * Reads many blobs out of one `git cat-file --batch` process.
 *
 * One process per repo rather than one per file: the fleet's production
 * surface is a few thousand files, and a spawn each would put this gate out of
 * reach of a pre-push hook, which is where it has to run to be a trigger at all.
 *
 * @returns {Map<string,string>} only the paths that resolved; a missing one is
 *          skipped rather than thrown, since a prefix may not exist in the ref
 */
function catFileBatch(repoDir, ref, rels) {
    const out = new Map();
    if (rels.length === 0) return out;

    const input = rels.map((r) => `${ref}:${r}`).join('\n') + '\n';
    const buf = execFileSync('git', ['-C', repoDir, 'cat-file', '--batch'], {
        input, maxBuffer: 512 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });

    let off = 0;
    for (const rel of rels) {
        const nl = buf.indexOf(0x0a, off);
        if (nl === -1) break;
        const header = buf.slice(off, nl).toString('utf8');
        const m = /^([0-9a-f]{40,64}) (\S+) (\d+)$/.exec(header);
        if (!m) {                       // "<spec> missing"
            off = nl + 1;
            continue;
        }
        const size  = Number(m[3]);
        const start = nl + 1;
        out.set(rel, buf.slice(start, start + size).toString('utf8'));
        off = start + size + 1;         // git writes a newline after the payload
    }
    return out;
}

/*  ------------------------------------------------------------------
 *  Scanner
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
 *  Survey
 *  ------------------------------------------------------------------ */

/**
 * Which of the gated components are actually checked out beside the docs repo.
 *
 * @param {string} platformRoot
 * @returns {string[]}
 */
function presentComponents(platformRoot) {
    return COMPONENTS.filter((c) => fs.existsSync(path.join(platformRoot, `xchain-${c}`, 'package.json')));
}

/**
 * Builds the env-read + doc-line picture each check below reads from.
 *
 * @param {object} opts
 * @param {string} opts.platformRoot   directory holding the xchain-* repos
 * @param {string} opts.docRoot        the xchain-documentation checkout
 * @param {object} opts.serviceReader  tree reader for the service repos
 * @param {object} opts.docReader      tree reader for the doc pages
 * @param {string[]} [opts.components] defaults to those present on disk
 * @returns {Map<string, {vars: Map<string, Array<object>>, docLines: string[]}>}
 */
function buildSurvey({ platformRoot, docRoot, serviceReader, docReader, components }) {
    const present = components || presentComponents(platformRoot);
    const survey  = new Map();

    const docPaths = docReader.listPaths(docRoot, ['components']);

    for (const c of present) {
        const repo  = path.join(platformRoot, `xchain-${c}`);
        const paths = serviceReader.listPaths(repo, SOURCE_ROOTS).filter(isSourcePath);
        const files = serviceReader.readFiles(repo, paths);

        const vars = new Map();
        for (const [rel, source] of files) {
            for (const [name, sites] of scanSource(source)) {
                if (NOT_CONFIGURATION(name)) continue;
                if (!vars.has(name)) vars.set(name, []);
                for (const s of sites) vars.get(name).push({ ...s, file: rel });
            }
        }

        const mine  = docPaths.filter((p) => isDocPath(p, c));
        const pages = docReader.readFiles(docRoot, mine);
        const docLines = [];
        for (const text of pages.values()) for (const l of text.split('\n')) docLines.push(l);

        survey.set(c, { vars, docLines });
    }

    return survey;
}

/** Total env reads across the survey; a floor on this catches a dead scanner. */
function totalReads(survey) {
    return [...survey.values()].reduce((n, s) => n + s.vars.size, 0);
}

/*  ------------------------------------------------------------------
 *  Checks. Each returns a list of human-readable problems, empty when clean,
 *  so the docs suite can assert on them and the CLI can print them.
 *  ------------------------------------------------------------------ */

/**
 * Coverage, scoped per component. A variable read by the hub must appear on
 * the HUB's pages: matching against the whole doc repo lets a name documented
 * elsewhere, with a different meaning, read as covered.
 */
function checkUndocumented(component, entry) {
    const waived = new Set(KNOWN_GAPS[component] || []);
    const out = [];
    for (const [name, sites] of entry.vars) {
        if (waived.has(name)) continue;
        if (docLinesFor(entry.docLines, name).length === 0) {
            out.push(`${name} (read at ${sites[0].file}:${sites[0].line})`);
        }
    }
    return out;
}

/**
 * Documented defaults match the code. The default written in the docs is
 * cross-checked against the literal on the line that reads the variable; this
 * is what caught the NODE_RPC_TIMEOUT divergence.
 */
function checkDefaultDrift(component, entry) {
    const out = [];
    for (const [name, sites] of entry.vars) {
        const rows = docLinesFor(entry.docLines, name);
        if (rows.length === 0) continue;   // checkUndocumented owns this

        const numeric = sites.filter((s) => s.default && s.default.numeric);
        if (numeric.length === 0) continue;

        // Distinct defaults within one component are usually a per-call
        // override rather than drift, so any documented one counts; a value
        // documented nowhere does not.
        const values = [...new Set(numeric.map((s) => s.default.value))];
        if (!values.some((v) => defaultDocumented(rows, v))) {
            out.push(`${name}: code default ${values.join(' or ')} (${numeric[0].file}:${numeric[0].line}) appears on no doc line for it`);
        }
    }
    return out;
}

/**
 * Cross-component divergence. A variable read by two components with DIFFERENT
 * defaults is a trap: one doc row silently describes the wrong behaviour for
 * the other component, so each side must carry its own value.
 *
 * NODE_RPC_TIMEOUT is why this exists: 30000 in the decoder, encoder and
 * utxo-tracker, 60000 in the regtest-miner. Only the decoder's value was
 * documented, so the miner's real timeout was undocumented behind a number
 * that was wrong for it.
 */
function checkDivergentDefaults(survey) {
    const byName = new Map();
    for (const [c, entry] of survey) {
        for (const [name, sites] of entry.vars) {
            const values = [...new Set(sites.filter((s) => s.default && s.default.numeric).map((s) => s.default.value))];
            if (values.length !== 1) continue;
            if (!byName.has(name)) byName.set(name, new Map());
            byName.get(name).set(c, values[0]);
        }
    }

    const out = [];
    for (const [name, perComponent] of byName) {
        if (new Set(perComponent.values()).size < 2) continue;
        for (const [c, value] of perComponent) {
            const rows = docLinesFor(survey.get(c).docLines, name);
            if (rows.length === 0) continue;   // checkUndocumented owns this
            if (!defaultDocumented(rows, value)) {
                out.push(`${name} defaults to ${value} in ${c} but components/${c}/ does not say so (values across components: ${[...perComponent].map(([k, v]) => `${k}=${v}`).join(', ')})`);
            }
        }
    }
    return out;
}

/** The ratchet: a KNOWN_GAPS entry that no longer describes a gap must go. */
function checkStaleKnownGaps(survey) {
    const out = [];
    for (const [c, names] of Object.entries(KNOWN_GAPS)) {
        if (!survey.has(c)) continue;
        const entry = survey.get(c);
        for (const name of names) {
            if (!entry.vars.has(name)) out.push(`${c}/${name}: no longer read by the code`);
            else if (docLinesFor(entry.docLines, name).length > 0) out.push(`${c}/${name}: now documented`);
        }
    }
    return out;
}

module.exports = {
    COMPONENTS, SOURCE_ROOTS, SKIP_DIRS, KNOWN_GAPS, ENV_READ, NOT_CONFIGURATION,
    isSourcePath, isDocPath,
    workingTreeReader, committedTreeReader, isGitRepo,
    extractDefault, scanSource, docLinesFor, defaultDocumented,
    presentComponents, buildSurvey, totalReads,
    checkUndocumented, checkDefaultDrift, checkDivergentDefaults, checkStaleKnownGaps,
};
