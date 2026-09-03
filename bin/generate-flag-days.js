#!/usr/bin/env node
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
 * Generates protocol/flag-days.md from the indexer's activation registry.
 *
 * WHY. Five doc pages and the whitepaper quoted the coordinated
 * contract-era flag-day as a literal DATE. A flag-day date is not a fact about
 * the protocol, it is the current value of a constant, and the constant has
 * been repinned twice (2026-10-01 -> 2026-08-17 -> 2026-08-07). Prose has no
 * way to notice its source moving, so every repin silently rotted a dozen
 * sentences at once, and the 2026-08-06 review found BOTH the pages and the
 * findings that flagged them stale against the same constant.
 *
 * THE REPAIR IS THE DIRECTION OF THE COPY. Rather than sweeping the date into
 * more places and guarding each one, every page now names the GATE and links
 * here, and this one page is generated. A repin regenerates one file; nothing
 * else in the tree carries a value that can rot.
 *
 * WHERE THE VALUES COME FROM. `xchain-indexer/src/protocol_changes.js` is the
 * registry: `addChange(name, version, mainnet_time, ...)` plus the handful of
 * gates declared as `const NAME_MAINNET_TIME`. Three more time-keyed gates ship
 * as standalone sibling modules in the same directory (they are registered next
 * to the query they gate rather than in the registry), so those are read too;
 * leaving them out would publish an inventory that calls itself complete and is
 * not.
 *
 * THE SOURCE IS READ AS TEXT, NOT REQUIRED. `require('protocol_changes.js')`
 * pulls in the indexer's config and database layer, and this must run in a
 * documentation checkout with neither. Other tooling in this monorepo reads
 * source files as text for the same reason.
 *
 * A standalone documentation clone has no sibling indexer. The generated page
 * is COMMITTED, so such a clone still reads correct values; only regeneration
 * needs the sibling, and test/flag-day-literals.test.js skips its currency
 * check when the sibling is absent rather than failing on a missing repo.
 *
 * Run: node bin/generate-flag-days.js   (from the documentation repo root)
 *
 ********************************************************************/

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.resolve(__dirname, '..');
const INDEXER_SRC = path.resolve(DOC_ROOT, '../xchain-indexer/src');
const REGISTRY = path.join(INDEXER_SRC, 'protocol_changes.js');
const OUTPUT = path.join(DOC_ROOT, 'protocol', 'flag-days.md');

/**
 * Lower bound for "this number is a Unix timestamp, not a block height".
 * Block heights are seven digits today and stay under a billion for centuries;
 * every real activation timestamp is past 2001. The two ranges cannot collide,
 * which is what lets one scan read both kinds of threshold without a per-gate
 * table saying which is which.
 */
const TIMESTAMP_FLOOR = 1_000_000_000;

/**
 * Upper bound past which a value is an UNARMED sentinel rather than a date
 * anybody scheduled. `price_pair_activation.js` parks 9999999999 (year 2286)
 * exactly so no operator reads it as a plan. Publishing it as a flag day would
 * put a fake commitment on a page implementers read.
 */
const SENTINEL_FLOOR = 4_102_444_800; // 2100-01-01T00:00:00Z

/** `2026-08-07 00:00:00 UTC` from a Unix seconds value. */
function utcInstant(seconds) {
    return `${new Date(seconds * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')} UTC`;
}

/** `2026-08-07` from a Unix seconds value. */
function utcDate(seconds) {
    return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** 1-based line number of a character offset, for naming an offending line. */
function lineAt(text, index) {
    return text.slice(0, index).split('\n').length;
}

// The characters after which a `/` cannot be dividing a finished operand, so
// it opens a regex literal. Kept byte-identical to the twin in
// lib/env-var-doc-coverage.js.
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
function regexLiteralEnd(text, i) {
    let k = i - 1;
    while (k >= 0 && (text[k] === ' ' || text[k] === '\t')) k--;
    if (k >= 0 && text[k] !== '\n' && !REGEX_POSITION_AFTER.has(text[k])) {
        if (!/[A-Za-z0-9_$]/.test(text[k])) return -1;
        let start = k;
        while (start >= 0 && /[A-Za-z0-9_$]/.test(text[start])) start--;
        if (!REGEX_POSITION_KEYWORDS.has(text.slice(start + 1, k + 1))) return -1;
    }

    let j = i + 1;
    let inClass = false;
    while (j < text.length) {
        const c = text[j];
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
 * Blanks every comment body, keeping length and newlines so offsets and line
 * numbers still line up with the raw text.
 *
 * The completeness scan below reads this rather than the source, because dead
 * code inside a block comment is not a declaration: a leading-token test only
 * recognises the slash-slash and star shapes, so a commented-out call whose own
 * line starts with `this.` read as live and failed the build over nothing.
 *
 * A REGEX LITERAL IS COPIED WHOLE for the same reason a string is: the `//`
 * inside `text.replace(/\/\//, '-')` starts no comment, and blanking from it
 * drops every declaration later on that line. See `regexLiteralEnd` for the
 * two shapes still read as division rather than as a literal.
 */
function withoutComments(text) {
    let out = '';
    let i = 0;
    const blank = (s) => s.replace(/[^\n]/g, ' ');

    while (i < text.length) {
        const two = text.slice(i, i + 2);
        if (two === '//') {
            const end = text.indexOf('\n', i);
            const stop = end === -1 ? text.length : end;
            out += blank(text.slice(i, stop)); i = stop; continue;
        }
        if (two === '/*') {
            const end = text.indexOf('*/', i + 2);
            const stop = end === -1 ? text.length : end + 2;
            out += blank(text.slice(i, stop)); i = stop; continue;
        }
        if (text[i] === '/') {
            // Copy the regex literal whole: the `//` inside one starts no
            // comment. Runs AFTER the two branches above, never before them,
            // because `//` is how JavaScript itself spells a comment rather
            // than an empty literal: testing this first reads every ordinary
            // comment line as a zero-length regex, leaves the body live, and
            // any apostrophe in it then opens a string that eats the file.
            const end = regexLiteralEnd(text, i);
            if (end !== -1) { out += text.slice(i, end); i = end; continue; }
        }
        const ch = text[i];
        if (ch === "'" || ch === '"' || ch === '`') {
            // Copy the string whole: a `//` inside one starts no comment.
            let j = i + 1;
            while (j < text.length && text[j] !== ch) j += text[j] === '\\' ? 2 : 1;
            out += text.slice(i, Math.min(j + 1, text.length)); i = j + 1; continue;
        }
        out += ch; i++;
    }
    return out;
}

/**
 * The mainnet_time argument of a call, when it is a literal this page covers.
 *
 * Returns null for anything else: a literal outside the time-keyed window, an
 * identifier, or a call shape with too few arguments. Null means "not a row
 * this page would have carried", which is what makes the check below quiet
 * about declarations that were never its business.
 */
function mainnetTimeLiteral(text, callIndex) {
    const open = text.indexOf('(', callIndex);
    if (open === -1) return null;

    const args = [];
    let depth = 0;
    let start = open + 1;
    let i = start;
    for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') {
            if (depth === 0) { args.push(text.slice(start, i)); break; }
            depth--;
        } else if (ch === ',' && depth === 0) { args.push(text.slice(start, i)); start = i + 1; }
    }
    if (args.length < 3) return null;

    const raw = args[2].trim().replace(/_/g, '');
    if (!/^\d+$/.test(raw)) return null;
    const time = Number(raw);
    return (time >= TIMESTAMP_FLOOR && time < SENTINEL_FLOOR) ? time : null;
}

/**
 * The `{ ... }` body of the object literal whose opening brace sits at `open`,
 * or null when the braces never close.
 *
 * Brace-counted rather than matched, because an activation map nests:
 * `state_subtree_activation.js` keys three per-slot maps inside one const.
 */
function objectBody(text, open) {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
    }
    return null;
}

/** A `const NAME = {` activation map in a sibling module. */
const SIBLING_MAP = /const\s+([A-Z][A-Z0-9_]*)\s*=\s*\{/g;

/** A `mainnet:` threshold inside such a map, bare or keyed per coin. */
const SIBLING_MAINNET_SLOT = /(?:^|[{,\s])(mainnet|['"][A-Z]+:mainnet['"])\s*:\s*([^,}\n]*)/g;

/**
 * What the sibling scan makes of a `mainnet:` value: a number it read, a shape
 * it is deliberately quiet about, or one it refuses.
 *
 * QUIET BY DESIGN, on the registry arm's own rationale: `null` parks an inert
 * placeholder no operator has ratified, and an identifier is a named constant
 * no text scan can resolve, so guessing at it is what turns a build gate into
 * noise. Everything else is a shape that could hide a live threshold.
 */
function readMainnetSlot(raw) {
    const value = raw.trim().replace(/;$/, '');
    if (value === 'null') return { kind: 'quiet' };
    const digits = value.replace(/_/g, '');
    if (/^\d+$/.test(digits)) return { kind: 'number', time: Number(digits) };
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) return { kind: 'quiet' };
    return { kind: 'unreadable' };
}

/**
 * Every time-keyed gate the sibling `*_activation.js` modules declare, and the
 * slots this scan refuses to guess at.
 *
 * READ WITH THE REGISTRY ARM'S RIGOR, which it once lacked in three ways. It
 * scanned raw text, so a retired map parked in a block comment was published as
 * a live row; it took the FIRST `mainnet:` per file, so the second map in a
 * multi-map module could never enter the page (`anchor_reward_activation.js`
 * alone declares three); and it named the gate after the FILE, which cannot
 * name more than one map. Comments are stripped, every map is scanned, and each
 * gate is named by its enclosing const.
 *
 * WHY THE GUARD IS VALUE-GATED, exactly as `assertEveryDeclarationParsed` is.
 * Eleven of the twenty-four modules declare no bare `mainnet:` slot at all
 * (they key per coin, because one shared height cannot fit BTC and DOGE at
 * once) and one declares no mainnet threshold whatever, so refusing a module
 * that exposes no readable slot would fail the build on twelve correct files.
 * A slot is loud only when it could have carried a row: an unreadable value in
 * any mainnet slot, or a per-coin slot holding a time rather than a height.
 *
 * HONEST LIMIT. A threshold under a RENAMED key (`mainnet_time:`) is still
 * dropped in silence, and cannot be made loud without false-firing on those
 * twelve modules. The registry arm has the same blind spot for the same reason.
 */
function collectSiblingGates(indexerSrc, add) {
    const unreadable = [];

    for (const name of fs.readdirSync(indexerSrc).filter((f) => f.endsWith('_activation.js')).sort()) {
        const text = withoutComments(fs.readFileSync(path.join(indexerSrc, name), 'utf8'));
        for (const decl of text.matchAll(SIBLING_MAP)) {
            const body = objectBody(text, decl.index + decl[0].length - 1);
            if (body === null) continue;
            for (const slot of body.matchAll(SIBLING_MAINNET_SLOT)) {
                const read = readMainnetSlot(slot[2]);
                const where = `${name}: ${decl[1]}.${slot[1]} = ${slot[2].trim() || '(nothing this scan can read)'}`;
                if (read.kind === 'unreadable') unreadable.push(where);
                else if (read.kind !== 'number') continue;
                else if (slot[1] === 'mainnet') add(decl[1], read.time, name);
                else if (read.time >= TIMESTAMP_FLOOR && read.time < SENTINEL_FLOOR) unreadable.push(`${where} is a block TIME, so this page would carry it`);
            }
        }
    }

    if (unreadable.length > 0) {
        throw new Error(
            'a sibling activation module declares a mainnet threshold this generator cannot read, so '
            + 'protocol/flag-days.md would publish an inventory that calls itself complete and is not:\n  '
            + unreadable.join('\n  ')
            + '\n\nThe sibling scan reads `mainnet: <digits>` inside a `const NAME = { ... }` map and stays '
            + 'quiet for `null` and for an identifier it cannot resolve. Either write the threshold in that '
            + 'shape or widen the parse in bin/generate-flag-days.js deliberately.',
        );
    }
}

/**
 * Refuses a registry that declares a gate in a style the two regexes above
 * cannot read.
 *
 * WHY THIS IS LOUD RATHER THAN LENIENT. An unrecognised declaration left
 * unread would be skipped in silence, and the generator would then rewrite protocol/flag-days.md to
 * agree with the loss, so the page would ship one row short with the whole suite
 * green: test/flag-day-literals.test.js can only anchor gate names that already
 * exist, which is no help for the gate somebody adds tomorrow.
 *
 * WHY THE CALL ARM IS VALUE-GATED. Most of the registry is not on this page at
 * all: roughly forty gates carry mainnet_time 0, several carry block heights,
 * and one parks the 9999999999 sentinel. Failing on unreadable SYNTAX alone
 * therefore fires hardest on declarations that could never have contributed a
 * row, and the evidence that was meant to exclude that (regenerate today's
 * registry, see nothing throw) cannot see it: every call in today's registry is
 * single-quoted, so no arm of the check is exercised at all. A call is loud only
 * when its mainnet_time slot holds a literal inside the time-keyed window, which
 * is exactly the condition under which a row went missing.
 *
 * An identifier in that slot stays quiet on the same principle: no text scan can
 * tell `PRICE_PAIR_SENTINEL` from a live timestamp, and guessing is what turns a
 * build gate into noise. The constant arm needs no such test, because
 * `NAME_MAINNET_TIME` says in its own name that it is a time.
 *
 * A call is also fine when its gate was collected some other way: the two cohort
 * constants are declared as `const NAME_MAINNET_TIME` and then passed to
 * `addChange` by identifier, so the call itself is unreadable and nothing is
 * lost by it.
 */
function assertEveryDeclarationParsed(rawRegistry, parsedCalls, parsedConstLines, parsedNames) {
    const unparsed = [];
    const registry = withoutComments(rawRegistry);

    for (const m of registry.matchAll(/addChange\s*\(\s*(['"])([A-Za-z0-9_]+)\1/g)) {
        if (parsedCalls.has(m.index)) continue;
        if (parsedNames.has(m[2])) continue;
        const time = mainnetTimeLiteral(registry, m.index);
        if (time === null) continue;
        unparsed.push(`line ${lineAt(registry, m.index)}: addChange call for ${m[2]} at mainnet_time ${time}`);
    }

    for (const m of registry.matchAll(/const\s+[A-Z][A-Z0-9_]*_MAINNET_TIME\s*=/g)) {
        const line = lineAt(registry, m.index);
        if (parsedConstLines.has(line)) continue;
        unparsed.push(`line ${line}: ${rawRegistry.split('\n')[line - 1].trim()}`);
    }

    if (unparsed.length > 0) {
        throw new Error(
            'protocol_changes.js declares gates this generator cannot read, so protocol/flag-days.md '
            + 'would publish an inventory that calls itself complete and is not:\n  '
            + unparsed.join('\n  ')
            + "\n\ncollectGates reads addChange('NAME', 'version', <digits>, ...) with single quotes and a "
            + 'literal time, and const NAME_MAINNET_TIME = <digits>;. Either write the declaration in one '
            + 'of those shapes or widen the parse in bin/generate-flag-days.js deliberately.',
        );
    }
}

/**
 * Every mainnet time-keyed gate the indexer declares, as
 * `{ gate, time, source }`, sorted by time then name so the output is stable
 * across runs (an unstable generator makes every regeneration look like a
 * change).
 */
function collectGates(indexerSrc = INDEXER_SRC) {
    const found = new Map();

    const add = (gate, time, source) => {
        if (!Number.isFinite(time) || time < TIMESTAMP_FLOOR || time >= SENTINEL_FLOOR) return;
        // First declaration wins: the registry is read before the siblings, so
        // a gate that appears in both is attributed to the registry.
        if (!found.has(gate)) found.set(gate, { gate, time, source });
    };

    // Names the two registry passes understood, so the completeness check below
    // can tell a declaration it READ from one it never saw.
    const parsedCalls = new Set();
    const parsedConstLines = new Set();
    const parsedNames = new Set();

    const registry = fs.readFileSync(path.join(indexerSrc, 'protocol_changes.js'), 'utf8');

    // COLLECT FROM THE COMMENT-STRIPPED COPY, which the completeness check below
    // already did and the two collectors did not. Dead code inside a comment is
    // not a declaration, so a retired gate parked in one used to be collected,
    // published as a row, and counted toward the coordinated flag day: the
    // generator inventing a gate the indexer does not arm, on the page
    // implementers plan fleet upgrades from. `withoutComments` preserves every
    // offset and newline, so the bookkeeping below still lines up with the raw
    // text the check quotes in its error message.
    const scannable = withoutComments(registry);

    // addChange('NAME', 'version', mainnet_time, ...)
    const changeRe = /addChange\(\s*'([A-Z0-9_]+)'\s*,\s*'([0-9.]+)'\s*,\s*(\d+)/g;
    let match;
    while ((match = changeRe.exec(scannable)) !== null) {
        parsedCalls.add(match.index);
        parsedNames.add(match[1]);
        add(match[1], Number(match[3]), 'protocol_changes.js');
    }

    // const NAME_MAINNET_TIME = 1786060800;  (gates the registry declares as a
    // shared constant because a second repo has to stay byte-identical to it)
    const constRe = /const\s+([A-Z][A-Z0-9_]*)_MAINNET_TIME\s*=\s*(\d+)\s*;/g;
    while ((match = constRe.exec(scannable)) !== null) {
        parsedConstLines.add(lineAt(scannable, match.index));
        parsedNames.add(match[1]);
        add(match[1], Number(match[2]), 'protocol_changes.js');
    }

    assertEveryDeclarationParsed(registry, parsedCalls, parsedConstLines, parsedNames);

    // Sibling `*_activation.js` modules: a mainnet threshold above the
    // timestamp floor is a time-keyed gate; below it, a block height, which
    // this page does not cover.
    collectSiblingGates(indexerSrc, add);

    return [...found.values()].sort((a, b) => (a.time - b.time) || a.gate.localeCompare(b.gate));
}

/**
 * Nonzero TESTNET arms, as `{ gate, time }` sorted by time then name. Almost
 * every time-keyed gate is genesis-active off mainnet, and the page states
 * that as an invariant, so a gate that arms testnet at an instant of its own
 * must be surfaced as the exception rather than left silently contradicting
 * the prose. Read from the same two declaration shapes as the mainnet parse:
 * a `const NAME_TESTNET_TIME = <digits>;` line, or a literal nonzero
 * testnet_time slot (the fourth argument) in an addChange call.
 */
function collectTestnetArms(indexerSrc = INDEXER_SRC) {
    const scannable = withoutComments(
        fs.readFileSync(path.join(indexerSrc, 'protocol_changes.js'), 'utf8'),
    );
    const found = new Map();
    const add = (gate, time) => {
        if (!Number.isFinite(time) || time < TIMESTAMP_FLOOR || time >= SENTINEL_FLOOR) return;
        if (!found.has(gate)) found.set(gate, { gate, time });
    };
    let match;
    const constRe = /const\s+([A-Z][A-Z0-9_]*)_TESTNET_TIME\s*=\s*(\d+)\s*;/g;
    while ((match = constRe.exec(scannable)) !== null) add(match[1], Number(match[2]));
    const callRe = /addChange\(\s*'([A-Z0-9_]+)'\s*,\s*'[0-9.]+'\s*,\s*[A-Za-z0-9_]+\s*,\s*([1-9]\d*)/g;
    while ((match = callRe.exec(scannable)) !== null) add(match[1], Number(match[2]));
    return [...found.values()].sort((a, b) => (a.time - b.time) || a.gate.localeCompare(b.gate));
}

/**
 * TESTNET slots parked on an UNARMED sentinel (>= SENTINEL_FLOOR), as `{ gate, time }`
 * sorted by name.
 *
 * These are the OTHER way the "testnet is genesis-active" invariant can be false, and
 * they were impossible until the public testnet launch of 2026-09-01 made testnet a
 * live ledger: a consensus change registered after it cannot arm testnet at genesis
 * without re-deciding history that outside nodes have already committed, so it parks on
 * the sentinel until an operator names an instant. Leaving them unmentioned would let
 * the page assert that a testnet stack "has always run the post-activation behavior" for
 * a rule testnet has never run at all. Read from the same two declaration shapes as the
 * armed parse.
 */
function collectTestnetUnarmed(indexerSrc = INDEXER_SRC) {
    const scannable = withoutComments(
        fs.readFileSync(path.join(indexerSrc, 'protocol_changes.js'), 'utf8'),
    );
    const found = new Map();
    const add = (gate, time) => {
        if (!Number.isFinite(time) || time < SENTINEL_FLOOR) return;
        if (!found.has(gate)) found.set(gate, { gate, time });
    };
    let match;
    const constRe = /const\s+([A-Z][A-Z0-9_]*)_TESTNET_TIME\s*=\s*(\d+)\s*;/g;
    while ((match = constRe.exec(scannable)) !== null) add(match[1], Number(match[2]));
    const callRe = /addChange\(\s*'([A-Z0-9_]+)'\s*,\s*'[0-9.]+'\s*,\s*[A-Za-z0-9_]+\s*,\s*(\d+)/g;
    while ((match = callRe.exec(scannable)) !== null) add(match[1], Number(match[2]));
    return [...found.values()].sort((a, b) => a.gate.localeCompare(b.gate));
}

/**
 * The coordinated contract-era flag day: the timestamp the most gates ride.
 * Derived rather than named, because naming it here would reintroduce exactly
 * the hardcoded value this generator exists to remove. Cohort A is 30+ gates
 * on one instant and the outliers are deliberate single rules, so the mode is
 * unambiguous by a wide margin; a tie means the cohort has genuinely split and
 * a human has to say which is the anchor.
 */
function coordinatedFlagDay(gates) {
    const counts = new Map();
    for (const g of gates) counts.set(g.time, (counts.get(g.time) || 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
    if (ranked.length === 0) throw new Error('no mainnet time-keyed gates found; the registry parse is wrong');
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
        throw new Error(
            `two timestamps tie for the coordinated flag day (${ranked[0][0]} and ${ranked[1][0]}, `
            + `${ranked[0][1]} gates each). The cohort has split; name the anchor explicitly rather than deriving it.`,
        );
    }
    return { time: ranked[0][0], count: ranked[0][1] };
}

function render(gates, testnetArms = [], testnetUnarmed = []) {
    const anchor = coordinatedFlagDay(gates);
    const others = gates.filter((g) => g.time !== anchor.time);

    const rows = gates.map((g) => {
        const note = g.time === anchor.time ? 'contract-era flag day' : 'own date';
        return `| \`${g.gate}\` | \`${g.time}\` | ${utcInstant(g.time)} | ${note} | \`${g.source}\` |`;
    });

    const outliers = others.length === 0
        ? 'Every mainnet time-keyed gate rides the coordinated instant; none carries a date of its own.'
        : `${others.length === 1 ? 'One gate does' : `${others.length} gates do`} not ride it and `
          + `${others.length === 1 ? 'carries' : 'carry'} a date of its own: `
          + `${others.map((g) => `\`${g.gate}\` at ${utcInstant(g.time)}`).join(', ')}. `
          // POINT AT THE DECLARATION, not at a curated section. This used to promise the
          // rationale at protocol-activation.md#additional-armed-gates-service-carried,
          // which covers a disjoint set: that section inventories the HEIGHT-keyed
          // service-carried gates, and every gate this page can list is TIME-keyed, so a
          // reader following it for three of these four found nothing. The reason each is
          // armed on its own date is written where the gate is registered, which is the
          // one place that cannot drift away from the value, and the table below already
          // names that file per gate.
          + 'Each carries the reason it is armed separately in its registration comment, in '
          + 'the file the **Declared in** column names below. For how a gate is evaluated '
          + 'and what happens to a node that misses one, see '
          + '[Protocol Activation](./protocol-activation.md).';

    // A testnet arm is rare enough to be prose, not a table: the invariant
    // paragraph above stays true for every other gate, and the exception names
    // itself with its value so a repin regenerates the sentence.
    const testnetNote = testnetArms.length === 0
        ? 'The values on this page are mainnet values only.'
        : `${testnetArms.length === 1 ? 'One gate is the exception' : `${testnetArms.length} gates are the exception`}: `
          + testnetArms.map((g) => `\`${g.gate}\` arms testnet at \`${g.time}\` (${utcInstant(g.time)})`).join(', ')
          + '. The reason it cannot be genesis-active there is written in its registration '
          + 'comment in \`protocol_changes.js\`. The values on this page are otherwise '
          + 'mainnet values only.';

    // The other way a gate can be off the genesis-active invariant: parked on the UNARMED
    // sentinel on testnet, so testnet has never run that rule and is waiting on an
    // operator to name an instant. Prose for the same reason an arm is.
    const unarmedNote = testnetUnarmed.length === 0
        ? ''
        : `\n\n**${testnetUnarmed.length === 1 ? 'One gate is UNARMED on testnet' : `${testnetUnarmed.length} gates are UNARMED on testnet`}** `
          + `(${testnetUnarmed.map((g) => `\`${g.gate}\``).join(', ')}): testnet carries the `
          + 'sentinel rather than `0`, so a testnet stack has **never** run the '
          + 'post-activation behavior and will not until an operator arms it. A consensus '
          + 'change registered after the public testnet launch cannot be genesis-active '
          + 'there without re-deciding history that outside nodes have already committed. '
          + 'Each names its reason in its registration comment in `protocol_changes.js`.';

    return `<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->
<!-- GENERATED FILE. Do not edit: run \`node bin/generate-flag-days.js\`. -->

# Flag-Day Values

**This page is generated** from \`xchain-indexer/src/protocol_changes.js\` and the
time-keyed activation modules beside it. Do not edit it by hand: run
\`node bin/generate-flag-days.js\` from the repository root and commit the result.

Every other page in this documentation set names the **gate** and links here
instead of quoting a date, because a flag-day value is not a fact about the
protocol, it is the current setting of a constant, and it has been repinned
before. One generated page moves on a repin; a dozen sentences do not.

For what a flag day is, how \`isEnabled\` evaluates it, which cohort a gate
belongs to, and what happens to a node that misses one, see
[Protocol Activation](./protocol-activation.md).

## Contract-era flag day

The coordinated instant that the **Cohort A** contract-era rules switch on,
simultaneously on Bitcoin, Litecoin, and Dogecoin.

| | |
|---|---|
| **Mainnet block time** | \`${anchor.time}\` |
| **UTC instant** | ${utcInstant(anchor.time)} |
| **Gates riding it** | ${anchor.count} |

${outliers}

**Testnet and regtest are genesis-active** for the time-keyed gates: they carry
threshold \`0\`, so a testnet or regtest stack has always run the
post-activation behavior. ${testnetNote}${unarmedNote}

## Mainnet time-keyed gates

| Gate | Block time | UTC instant | Rides | Declared in |
|---|---|---|---|---|
${rows.join('\n')}

Thresholds keyed on a **block height** rather than a block time (the
validator-era Cohort B rules and the per-chain Cohort C rules) are not listed
here; they are inventoried on
[Protocol Activation](./protocol-activation.md#the-three-cohorts).
`;
}

function generate(indexerSrc = INDEXER_SRC) {
    return render(collectGates(indexerSrc), collectTestnetArms(indexerSrc), collectTestnetUnarmed(indexerSrc));
}

if (require.main === module) {
    if (!fs.existsSync(REGISTRY)) {
        console.error(`cannot generate: ${REGISTRY} is not present.\n`
            + 'This generator needs the sibling xchain-indexer checkout. The generated page is\n'
            + 'committed, so a standalone documentation clone reads correct values without it.');
        process.exit(1);
    }
    const text = generate();
    const unchanged = fs.existsSync(OUTPUT) && fs.readFileSync(OUTPUT, 'utf8') === text;
    fs.writeFileSync(OUTPUT, text);
    console.log(`${unchanged ? 'unchanged' : 'WROTE'}  ${path.relative(DOC_ROOT, OUTPUT)}`);
    if (!unchanged) {
        console.log('The flag-day values moved. Stage this page; no prose page needs editing.');
    }
}

module.exports = {
    collectGates, collectTestnetArms, collectTestnetUnarmed, coordinatedFlagDay, render, generate, utcInstant, utcDate,
    DOC_ROOT, INDEXER_SRC, REGISTRY, OUTPUT, TIMESTAMP_FLOOR, SENTINEL_FLOOR,
};
