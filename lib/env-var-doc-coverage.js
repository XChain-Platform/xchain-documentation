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
 * Environment-variable documentation coverage: the scanning core.
 *
 * WHY THIS IS A LIBRARY. The gate began as one test file in this repo, which
 * meant it only ever executed when somebody ran the docs suite. A service repo
 * could therefore add a `process.env` read, push it, and leave the gate red
 * with no signal anywhere: it sat red for days after a change added
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
 * COMPUTED READS ARE A KNOWN BLIND SPOT, now held rather than merely recorded
 *. `ENV_READ` resolves `process.env.NAME` and a quoted literal in
 * brackets; `process.env[envVar]` over a key map, and concatenated per-coin
 * keys, carry no name a doc row could be matched against, so they never enter
 * the survey. Measured 2026-08-11 across the committed trees: 95 such sites in
 * 37 files across 10 of the 11 gated components, the live count being whatever
 * `COMPUTED_READ_BASELINE` says. That set is RATCHETED by `checkComputedReads`,
 * so the blind spot can shrink and cannot silently widen. It is not closed:
 * a key added to an EXISTING map creates no new site (xchain-node/src/services/
 * DatabaseService.js reads three keys through one `process.env[envVar]`), and
 * waiving the sites is barred by the KNOWN_GAPS admission rule below, which
 * requires the variable's doc row already written. Recovering the names needs
 * cross-file tracing of the key maps, including prefixes built from constructor
 * arguments (xchain-hub/src/lib/spend_ceiling.js), which is a separate piece of
 * work, not a tightening here.
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
                try {
                    entries = fs.readdirSync(abs, { withFileTypes: true });
                } catch (err) {
                    // Same policy as readFiles below, and for the same reason:
                    // only the mid-scan race is benign. A directory that cannot
                    // be LISTED (permission, disk, symlink loop) otherwise looks
                    // exactly like a directory with nothing in it, so the survey
                    // reports zero reads for the component and passes.
                    if (err.code === 'ENOENT') return;
                    throw err;
                }
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
                try {
                    st = fs.statSync(abs);
                } catch (err) {
                    // ENOENT is the ordinary case: most services have no mcp/.
                    // Anything else means the prefix exists and cannot be
                    // reached, which must not read as "this service has no bin/".
                    if (err.code === 'ENOENT') continue;
                    throw err;
                }
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
                    // which is exactly the failure mode this scanner guards
                    // against, so it surfaces. The
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

// Coercions that take the read as their ONLY argument, so a `|| default` after
// them still belongs to the variable. Deliberately numeric-only: broadening this
// to any single-identifier call misreads `getConfig(env.X).timeout || 5000`.
const NUMERIC_WRAPPERS = new Set(['parseInt', 'parseFloat', 'Number']);

// Helpers whose SECOND argument is the fallback value rather than parseInt's
// radix. Every name here is a function that exists in the fleet and whose second
// parameter is literally the default: `parseIntSafe(val, defaultVal)` plus
// `parseIntMin0`/`parseIntMin1` in the sync, indexer, explorer and sdk config
// modules, and `resolveLimit(rawValue, defaultLimit)` in each service's
// concurrencyGate. A name reaches this set by grep, never by analogy: a
// plausible-sounding sibling that nothing defines (`parseFloatSafe` was in this
// set for exactly that reason) costs a wrong default read the day
// somebody writes a real function under that name with a different signature.
// `parseInt` is emphatically NOT here, which is the distinction the whole
// scanner exists to keep.
const DEFAULT_ARG_HELPERS = new Set([
    'parseIntSafe', 'parseIntMin0', 'parseIntMin1', 'resolveLimit',
]);

/**
 * Names the call that directly encloses the read, or null when it sits bare.
 *
 * Scans BACKWARD from the read, because the two rules that need this fire at
 * the call's closing `)` or its argument comma, by which point the callee is
 * long behind the cursor. Bracket reads (`process.env['X']`) balance out on the
 * way back, so the same walk serves both read forms.
 *
 * @returns {string|null} the final segment, so `gate.resolveLimit` reads as `resolveLimit`
 */
function enclosingCallName(text, from) {
    let depth = 0;
    let i = from - 1;
    for (; i >= 0; i--) {
        const ch = text[i];
        if (ch === ')' || ch === ']' || ch === '}') { depth++; continue; }
        if (ch === '(' || ch === '[' || ch === '{') {
            if (depth === 0) break;
            depth--;
        }
    }
    if (i < 0 || text[i] !== '(') return null;

    let j = i - 1;
    while (j >= 0 && /\s/.test(text[j])) j--;
    const end = j + 1;
    while (j >= 0 && /[A-Za-z0-9_$.]/.test(text[j])) j--;
    const name = text.slice(j + 1, end);
    return name ? name.split('.').pop() : null;
}

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
 *     call and keep looking, UNLESS the call is one of the helpers below whose
 *     second argument is the fallback itself;
 *   - a `)` at the read's own depth ends the enclosing call: that is the end of
 *     the search, unless the call is a bare numeric coercion, which puts the
 *     fallback just outside itself;
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
    // Both call-shaped rules below describe the call that DIRECTLY encloses the
    // read, so each may fire at most once: past that call, a `,` or `)` at depth
    // zero belongs to some outer expression whose arguments are not ours to read.
    let left = false;

    while (i < text.length) {
        const ch = text[i];

        if (ch === '(' || ch === '[' || ch === '{') { depth++; i++; continue; }

        if (ch === ')' || ch === ']' || ch === '}') {
            // Closing past our own depth means the enclosing expression ended.
            if (depth === 0) {
                // ...except that a numeric coercion taking the read as its only
                // argument carries its fallback OUTSIDE itself, as in
                // `parseInt(process.env.X) || 86400000`.
                // Stepping out once reaches it; the `left` guard stops a second
                // step from attributing an outer expression's fallback here.
                if (!left && NUMERIC_WRAPPERS.has(enclosingCallName(text, from))) {
                    left = true; i++; continue;
                }
                return null;
            }
            depth--; i++; continue;
        }

        if (ch === ',' && depth === 0) {
            // A helper whose SECOND argument is the fallback, not a radix, is
            // read rather than skipped: `parseIntMin0(process.env.X, 3006)` is
            // the sync/indexer/sdk config idiom.
            if (!left && DEFAULT_ARG_HELPERS.has(enclosingCallName(text, from))) {
                const arg = readOperand(text, i + 1);
                if (arg && arg.literal) {
                    return { value: arg.value, numeric: /^-?\d+(\.\d+)?$/.test(arg.value) };
                }
            }
            // We are an argument; skip the remaining arguments of this call.
            left = true;
            i = skipToEnclosingClose(text, i);
            if (i === -1) return null;
            continue;
        }

        if (depth === 0 && (text.startsWith('||', i) || text.startsWith('??', i))) {
            const operand = readOperand(text, i + 2);
            if (!operand) return null;
            if (operand.literal) return { value: operand.value, numeric: /^-?\d+(\.\d+)?$/.test(operand.value) };
            // A CALL fallback IS the default and no doc row can carry it, so the
            // search ends here. Walking past one is how `VALIDATOR_ID ||
            // require('os').hostname() || 'unknown'` reported `unknown` as the
            // default against a row that correctly said "system hostname"
            //: the last-resort operand of a computed chain is not
            // the effective default of anything.
            if (operand.call) return null;
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

/**
 * Reads one operand after a `||`/`??`, reporting whether it is a literal and,
 * when it is not, whether it is a CALL. The two non-literal shapes mean
 * opposite things to the walk, so they cannot share an answer.
 */
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
        // A product of literals is one literal. `|| 4 * 1024 * 1024` recorded a
        // default of `4` and then passed against a row asserting `4194304`,
        // because the row's own `(4 MiB)` gloss matched. Folding
        // stops at the first non-literal factor, so `|| 4 * factor` still
        // reports the bare `4` it always did rather than inventing a number.
        const product = /^\s*\*\s*(\d[\d_]*(?:\.\d+)?)/;
        let value = Number(num[0].replace(/_/g, ''));
        let end = i + num[0].length;
        let more;
        while ((more = product.exec(text.slice(end))) !== null) {
            value *= Number(more[1].replace(/_/g, ''));
            end += more[0].length;
        }
        return { literal: true, value: String(value), end };
    }

    // Identifier, member expression or call: not a literal default.
    const ident = /^[A-Za-z_$][A-Za-z0-9_$.]*(\([^)]*\))?/.exec(text.slice(i));
    if (ident) return { literal: false, call: /\)$/.test(ident[0]), end: i + ident[0].length };

    return null;
}

// The characters after which a `/` cannot be dividing a finished operand, so
// it opens a regex literal. Kept byte-identical to the twin in
// bin/generate-flag-days.js.
const REGEX_POSITION_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_POSITION_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'yield', 'await']);

/**
 * The index just past the regex literal starting at `i`, or -1 when there is
 * no literal here to read.
 *
 * FAIL-SAFE BY CONSTRUCTION. Both ambiguous cases return -1, which leaves the
 * caller doing exactly what it did before this existed: a `/` that follows a
 * finished operand (so it divides), and a literal with no unescaped closing
 * `/` before the newline (so the line is not the shape it looked like). Only
 * an unambiguous literal takes the branch, so the walk is a strict superset of
 * the previous behaviour rather than a new guess.
 *
 * RESIDUAL LIMIT, and it is deliberate: `}` and `{` are read as regex position
 * even though a division can legally follow a block, and a division after
 * `)` or `]` is always read as division even though no regex can follow those.
 * Both readings are wrong only for source that does not exist here (measured
 * 2026-08-20 across all 696 production files in the 11 gated components: zero
 * change to the env-read survey and zero change to the computed-read ratchet).
 *
 * `[...]` classes are honoured, because a `/` inside one does not close.
 */
function regexLiteralEnd(source, i) {
    let k = i - 1;
    while (k >= 0 && (source[k] === ' ' || source[k] === '\t')) k--;
    if (k >= 0 && source[k] !== '\n' && !REGEX_POSITION_AFTER.has(source[k])) {
        if (!/[A-Za-z0-9_$]/.test(source[k])) return -1;
        let start = k;
        while (start >= 0 && /[A-Za-z0-9_$]/.test(source[start])) start--;
        if (!REGEX_POSITION_KEYWORDS.has(source.slice(start + 1, k + 1))) return -1;
    }

    let j = i + 1;
    let inClass = false;
    while (j < source.length) {
        const c = source[j];
        if (c === '\n') return -1;
        if (c === '\\') { j += 2; continue; }
        if (inClass) { if (c === ']') inClass = false; j++; continue; }
        if (c === '[') { inClass = true; j++; continue; }
        if (c === '/') return j + 1;
        j++;
    }
    return -1;
}

/**
 * The source with every comment blanked to spaces, strings left whole.
 *
 * A commented-out read documents nothing and configures nothing, so the scans
 * below have to see past comments. The per-line `replace(/\/\/.*$/, '')` is
 * not that: it cuts at the first `//` WHEREVER it sits, so
 * `process.env.RPC_URL || 'http://localhost:8332'` was truncated to `'http:`,
 * `readOperand` found no closing quote, and the variable was recorded with no
 * default -- silently exempt from the drift check forever. Any second read after
 * such a string on the same line vanished from the survey outright, which is a
 * false green for the coverage check itself. The same walk also blanks block
 * comments, which the per-line strip never touched at all, so read-shaped text
 * inside one would scan as live configuration.
 *
 * Blanks rather than deletes, so every offset, column and newline survives and
 * the callers' `idx + 1` line numbers still name the real line. Ported from
 * `withoutComments` in xchain-documentation/bin/generate-flag-days.js, which
 * solved this for the flag-day generator first.
 *
 * A REGEX LITERAL IS COPIED WHOLE for the same reason a string is: the `//`
 * inside `str.replace(/\/\//, '-')` starts no comment, and blanking from it
 * dropped every env read and `|| 'default'` later on that line. See
 * `regexLiteralEnd` for the two shapes still read as division rather than as a
 * literal, which is the residual heuristic limit here.
 */
function stripComments(source) {
    let out = '';
    let i = 0;
    const blank = (s) => s.replace(/[^\n]/g, ' ');

    while (i < source.length) {
        const two = source.slice(i, i + 2);
        if (two === '//') {
            const end  = source.indexOf('\n', i);
            const stop = end === -1 ? source.length : end;
            out += blank(source.slice(i, stop)); i = stop; continue;
        }
        if (two === '/*') {
            const end  = source.indexOf('*/', i + 2);
            const stop = end === -1 ? source.length : end + 2;
            out += blank(source.slice(i, stop)); i = stop; continue;
        }
        if (source[i] === '/') {
            // Copy the regex literal whole: the `//` inside one starts no
            // comment. Runs AFTER the two branches above, never before them,
            // because `//` is how JavaScript itself spells a comment rather
            // than an empty literal: testing this first reads every ordinary
            // comment line as a zero-length regex, leaves the body live, and
            // any apostrophe in it then opens a string that eats the file.
            const end = regexLiteralEnd(source, i);
            if (end !== -1) { out += source.slice(i, end); i = end; continue; }
        }
        const ch = source[i];
        if (ch === "'" || ch === '"' || ch === '`') {
            // Copy the string whole: a `//` inside one starts no comment.
            let j = i + 1;
            while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
            out += source.slice(i, Math.min(j + 1, source.length)); i = j + 1; continue;
        }
        out += ch; i++;
    }
    return out;
}

/**
 * Collects every env read in a source string.
 *
 * @returns {Map<string, Array<{line:number, default:object|null}>>}
 */
function scanSource(source) {
    const found = new Map();
    const lines = stripComments(source).split('\n');

    lines.forEach((code, idx) => {
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

// A bracket read whose key is not a quoted literal: `process.env[envVar]`,
// `process.env[`${coin}_INDEXER_URL`]`. ENV_READ resolves the literal form and
// this one resolves nothing, which is the point.
const COMPUTED_READ = /process\.env\s*\[\s*(?!['"])/g;

/**
 * Every computed env read in a source string, by line.
 *
 * @returns {number[]}
 */
function scanComputedReads(source) {
    const lines = [];
    stripComments(source).split('\n').forEach((code, idx) => {
        COMPUTED_READ.lastIndex = 0;
        while (COMPUTED_READ.exec(code) !== null) lines.push(idx + 1);
    });
    return lines;
}

/** Lines of a component's docs that mention the variable by name. */
function docLinesFor(docLines, name) {
    const mention = new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`);
    return docLines.filter((l) => mention.test(l));
}

// A leading table cell of the form `SOME_VARIABLE`, which is how every
// configuration table in the doc set names the row's subject.
const ROW_SUBJECT = /`([A-Z][A-Z0-9_]{3,})`/;

/**
 * The mentioning lines that could ASSERT this variable's default.
 *
 * A neighbour's table row mentions a variable all the time, because that is how
 * a row explains what it relates to: `SOURCE_STRIKE_WINDOW`'s row names
 * `SOURCE_EVICT_THRESHOLD`, and its own default cell (`200`) then satisfied the
 * threshold's comparison as readily as the threshold's real `3`. A
 * table row whose leading cell names a DIFFERENT variable is that variable's
 * claim, so it is dropped here. Prose, and rows whose leading cell is a label
 * rather than a variable, are kept: those genuinely do talk about this one.
 */
function assertingRows(rows, name) {
    return rows.filter((r) => {
        if (!/^\s*\|/.test(r)) return true;
        const first = r.split('|')[1];
        if (first === undefined) return true;
        const subject = ROW_SUBJECT.exec(first);
        return !subject || subject[1] === name;
    });
}

// A `|| 0` default is almost always "feature off", and a doc row that says so
// in words is correct, not stale. Anything narrower produces noise; anything
// wider lets a real number rot.
const MEANS_ZERO = /\b(none|unset|disabled|disable|off|no limit|unlimited)\b/i;

/** Escapes a default value so it matches literally, metacharacters and all. */
function escapeLiteral(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// One trailing parenthetical after a value, which is how the doc set glosses a
// number it has just asserted: `4194304` (4 MiB), `0` (auto), `600000` (10 min).
const GLOSS = '(?:\\s*\\([^)]*\\))?';

/**
 * Does the row ASSERT this value as the default, rather than merely contain it?
 *
 * Two shapes count, neither of which pins a column: a table cell that is the
 * value and nothing else (`| ... | No | \`true\` | ... |`), or the value
 * IMMEDIATELY after a default keyword (`Defaults to \`true\``). A description
 * that only mentions the value ("Set to `false` to stop this hub publishing
 * ANCHORs") does not. The phrase form allows a connector and nothing else,
 * because a window wide enough to skip prose reaches the row's other value:
 * "defaults to `true`; set it to `false`" would assert both.
 *
 * A value may be QUOTED and it may be GLOSSED, and both are still assertions:
 * the shipped rows write `\`4194304\` (4 MiB)`, `\`0\` (auto)` and `\`"30"\``,
 * which state the default and then explain it. The gloss is one trailing
 * parenthetical, not arbitrary trailing text, so a description cell that opens
 * with the value still fails.
 */
function assertsDefault(rows, value) {
    const v = escapeLiteral(value);
    const q = `["']?`;
    const bareCell  = new RegExp(`^\`?${q}${v}${q}\`?${GLOSS}$`, 'i');
    const asserted  = new RegExp(`\\bdefaults?\\s*(?:to|is|=|:)?\\s*\`?${q}${v}${q}\`?(?![A-Za-z0-9_])`, 'i');
    return rows.some((r) => r.split('|').some((cell) => bareCell.test(cell.trim())) || asserted.test(r));
}

/**
 * Is the default present on any doc line for the variable?
 *
 * Deliberately lenient about where in the row the value sits: the doc set
 * uses several table shapes, and pinning a column would break on the next one.
 * Strict about the value, which is the part that goes stale.
 *
 * The boundary guard follows the SHAPE of the value. A number must not be read
 * out of a longer number (`3000` inside `30000`), so digits and dots bound it.
 * A string default is a word, so it is bounded the way a variable name is in
 * `docLinesFor`, which keeps `server` out of `webserver`.
 *
 * BOOLEANS AND NUMBERS must be ASSERTED, because for them presence alone is
 * VACUOUS. A row documenting a switch names both states by
 * construction: `REQUIRE_SIGNATURES` says "Defaults to `true` ... pass `false`
 * to bootstrap", so `true` and `false` were equally "documented" and the check
 * passed whichever one the code held. A number is masked the same way by any
 * other number the row happens to carry: the unit gloss, an HTTP status, a
 * neighbouring variable's value. Measured at HEAD over the 11 gated components,
 * 60 of the 173 numeric passes had a contradicting number in their own rows that
 * matched equally well, `EXPLORER_VM_MAX_STATE_BYTES` among them, where the row
 * asserts `4194304` and the pass came from the `4` in its `(4 MiB)` gloss.
 *
 * The earlier reading that numbers had "zero live instances" of this masking
 * measured only the finding's literal range example (`valid range 1-3000`) and
 * missed the gloss class, which is the one that ships. Requiring assertion for
 * both shapes leaves the whole fleet green, once `readOperand` stops recording
 * `4` for `4 * 1024 * 1024` and the hub's rate limit gets a row that states its
 * default rather than only mentioning it in prose. Together with `assertingRows`
 * dropping a neighbour's table row, that takes the masked numeric passes from 60
 * of 173 to 8.
 *
 * WHAT THE 8 ARE, so the next reader does not re-measure it: a UNIT-CONVERTED
 * gloss that is itself phrased as an assertion, `WS_BACKPRESSURE_MAX_BYTES`'s
 * "default 16 MiB" beside its real `16777216`, plus the two `|| 0` rows the
 * MEANS_ZERO rule deliberately lets a word satisfy. Closing those needs the
 * matcher to understand units, which is a different piece of work from telling
 * an assertion apart from a mention.
 *
 * STRING defaults stay position-free. A word is not masked by a coincidence the
 * way a digit is, and the boundary guard below is what keeps `server` out of
 * `webserver`.
 */
function defaultDocumented(rows, value) {
    if (value === '0' && rows.some((r) => MEANS_ZERO.test(r))) return true;
    const numeric = /^-?\d+(\.\d+)?$/.test(value);
    if (value === 'true' || value === 'false' || numeric) return assertsDefault(rows, value);
    const asWritten = new RegExp(`(?<![A-Za-z0-9_])${escapeLiteral(value)}(?![A-Za-z0-9_])`);
    return rows.some((r) => asWritten.test(r));
}

/**
 * Is this recorded default one a doc row can be checked against?
 *
 * `|| ''` means "unset" rather than a value: it is what a row already says with
 * the word None, and an empty needle matches every row, so comparing it would
 * pass whatever the docs said.
 */
function comparableDefault(site) {
    return Boolean(site.default) && site.default.value !== '';
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
 * @returns {Map<string, {vars: Map<string, Array<object>>, docLines: string[], docProse: string[], sourceFiles: number}>}
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
        const computed = [];
        for (const [rel, source] of files) {
            for (const [name, sites] of scanSource(source)) {
                if (NOT_CONFIGURATION(name)) continue;
                if (!vars.has(name)) vars.set(name, []);
                for (const s of sites) vars.get(name).push({ ...s, file: rel });
            }
            for (const line of scanComputedReads(source)) computed.push({ file: rel, line });
        }

        const mine  = docPaths.filter((p) => isDocPath(p, c));
        const pages = docReader.readFiles(docRoot, mine);
        // Two views of the same pages. `docLines` is everything, which is what
        // "is this variable mentioned at all" has to read. `docProse` drops
        // fenced blocks, because a `.env` snippet, a `docker run -e` line or a
        // mermaid node DEMONSTRATES a value rather than asserting it, and a
        // demonstration launders a wrong default: SYNC_MODE's table row could
        // be rewritten to `client` and five example lines still carried the
        // word `server`, so the drift the check exists for passed.
        const docLines = [];
        const docProse = [];
        for (const text of pages.values()) {
            let fenced = false;
            for (const l of text.split('\n')) {
                docLines.push(l);
                if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; continue; }
                if (!fenced) docProse.push(l);
            }
        }

        // How many files the component actually contributed, which is what
        // separates "reads no configuration" from "was not read at all".
        survey.set(c, { vars, docLines, docProse, computed, sourceFiles: files.size });
    }

    return survey;
}

/** Total env reads across the survey; a floor on this catches a dead scanner. */
function totalReads(survey) {
    return [...survey.values()].reduce((n, s) => n + s.vars.size, 0);
}

/**
 * Components that were surveyed and yielded no source file at all.
 *
 * The fleet-wide floor on `totalReads` only catches a scanner that died
 * outright. One component going silent hides under it: the hub alone
 * contributes about a third of the fleet's variables, and losing its entire
 * scan still clears 300, at which point every per-component check for the hub
 * passes over an empty set and proves nothing. Counts FILES rather than
 * variables on purpose, so a component that
 * genuinely reads no configuration is not accused of a broken scan.
 */
function checkEmptyScan(survey) {
    const out = [];
    for (const [c, entry] of survey) {
        if (entry.sourceFiles === 0) {
            out.push(`${c}: scanned 0 production source files (${SOURCE_ROOTS.join(', ')}), so its coverage checks proved nothing`);
        }
    }
    return out;
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
 *
 * STRING defaults are compared too. They were extracted and then dropped by a
 * numeric-only filter, so `SYNC_MODE || 'server'` could be documented as
 * `client` and pass. A string value rots exactly the way a number
 * does, and the docs are the only place a reader learns it.
 *
 * The comparison reads PROSE, not every line: an example is not an assertion.
 * Enabling string comparison on its own did not actually close the SYNC_MODE
 * case it was reported for, because rewriting that table row to `client` still
 * left `SYNC_MODE=server` in an env snippet, twice in `export` lines, in a
 * `docker run -e` flag and in a mermaid node, any one of which satisfied the
 * match. Whether the variable is mentioned AT ALL is still read from every
 * line, so a variable documented only inside a fence is drift here rather than
 * silence.
 */
function checkDefaultDrift(component, entry) {
    const out = [];
    for (const [name, sites] of entry.vars) {
        if (docLinesFor(entry.docLines, name).length === 0) continue;   // checkUndocumented owns this
        const rows = assertingRows(docLinesFor(entry.docProse, name), name);

        const defaulted = sites.filter(comparableDefault);
        if (defaulted.length === 0) continue;

        // Distinct defaults within one component are usually a per-call
        // override rather than drift, so any documented one counts; a value
        // documented nowhere does not.
        const values = [...new Set(defaulted.map((s) => s.default.value))];
        if (!values.some((v) => defaultDocumented(rows, v))) {
            out.push(`${name}: code default ${values.join(' or ')} (${defaulted[0].file}:${defaulted[0].line}) appears on no doc line for it`);
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
            const values = [...new Set(sites.filter(comparableDefault).map((s) => s.default.value))];
            if (values.length !== 1) continue;
            if (!byName.has(name)) byName.set(name, new Map());
            byName.get(name).set(c, values[0]);
        }
    }

    const out = [];
    for (const [name, perComponent] of byName) {
        if (new Set(perComponent.values()).size < 2) continue;
        for (const [c, value] of perComponent) {
            // Prose only, for the reason checkDefaultDrift gives: an example
            // line carrying the other component's value would launder this one.
            if (docLinesFor(survey.get(c).docLines, name).length === 0) continue;   // checkUndocumented owns this
            const rows = assertingRows(docLinesFor(survey.get(c).docProse, name), name);
            if (!defaultDocumented(rows, value)) {
                out.push(`${name} defaults to ${value} in ${c} but components/${c}/ does not say so (values across components: ${[...perComponent].map(([k, v]) => `${k}=${v}`).join(', ')})`);
            }
        }
    }
    return out;
}

/**
 * The computed-read ratchet: the blind spot may shrink, never grow.
 *
 * `checkUndocumented` can only fail on a variable it can NAME, so every
 * `process.env[key]` read is invisible to it. That blind spot cannot be closed
 * here (recovering the names needs cross-file tracing of the key maps, including
 * prefixes built from constructor arguments in xchain-hub/src/lib/
 * spend_ceiling.js), and it cannot be waived either: KNOWN_GAPS admits an entry
 * only with the variable's doc row already written, and a computed read has no
 * variable name at all.
 *
 * What it CAN do is stop the blind spot widening, which is the failure mode the
 * finding's own proposal C names. A new computed read in a component is a new
 * pocket of unscannable configuration and fails here until the count is
 * deliberately raised, in a commit that says why. A count that DROPS fails too,
 * for the reason KNOWN_GAPS does: a stale ratchet is a ratchet that has stopped
 * ratcheting.
 *
 * Honest about what it does not buy: a key added to an EXISTING map creates no
 * new site (xchain-node/src/services/DatabaseService.js reads three tuning keys
 * through one `process.env[envVar]`), so this holds the line rather than gating
 * those. Gating them is proposal B and a separate piece of work.
 *
 * Counts per component rather than per file, so moving a read between files in
 * one component is not a false red; the failure message names the sites, so a
 * swap that keeps the count is still visible to the reader of the diff.
 */
const COMPUTED_READ_BASELINE = {
    // Measured 2026-08-11 against the committed trees of all 11 gated
    // components: 95 sites in 37 files across 10 of them.
    decoder: 4, encoder: 4, explorer: 7, hub: 31, indexer: 6, node: 16,
    'regtest-miner': 7, sdk: 4, sync: 9, 'utxo-tracker': 7, vm: 0,
};

function checkComputedReads(survey) {
    const out = [];
    for (const [c, entry] of survey) {
        if (!(c in COMPUTED_READ_BASELINE)) continue;
        const sites = entry.computed || [];
        const allowed = COMPUTED_READ_BASELINE[c];
        if (sites.length === allowed) continue;
        const where = sites.map((s) => `${s.file}:${s.line}`).join(', ');
        out.push(sites.length > allowed
            ? `${c}: ${sites.length} computed env reads, baseline ${allowed}. A computed read is invisible to the coverage gate, so this is new unscannable configuration; document the variables and raise the baseline deliberately, or read them by name. Sites: ${where}`
            : `${c}: ${sites.length} computed env reads, baseline ${allowed}. The ratchet only holds if it is lowered when the blind spot shrinks; set the baseline to ${sites.length}. Sites: ${where}`);
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
    COMPONENTS, SOURCE_ROOTS, SKIP_DIRS, KNOWN_GAPS, ENV_READ, COMPUTED_READ, NOT_CONFIGURATION,
    COMPUTED_READ_BASELINE,
    isSourcePath, isDocPath,
    workingTreeReader, committedTreeReader, isGitRepo,
    extractDefault, stripComments, scanSource, scanComputedReads, docLinesFor, assertingRows, defaultDocumented,
    presentComponents, buildSurvey, totalReads, checkEmptyScan,
    checkUndocumented, checkDefaultDrift, checkDivergentDefaults, checkStaleKnownGaps,
    checkComputedReads,
};
