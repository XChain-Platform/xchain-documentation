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
 * Generates protocol/flag-days.md from the indexer's activation registry and
 * the documentation canon's published activation maps.
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
 * registry's entry, and its rows live in the part files under
 * `src/protocol_changes/`: the time table as array rows
 * `['NAME', 'X.Y.Z', mainnet_time, ...]` in `changes_*.js` (the older
 * `addChange(name, version, mainnet_time, ...)` call shape is still read, for
 * a tree that predates the split), plus the handful of gates declared as
 * `const NAME_MAINNET_TIME` in `flag_times*.js`. Three more time-keyed gates
 * ship as standalone sibling modules in `src/` (they are registered next to
 * the query they gate rather than in the registry), so those are read too;
 * leaving them out would publish an inventory that calls itself complete and
 * is not.
 *
 * THE SOURCE IS READ AS TEXT, NOT REQUIRED. What this page asserts about the
 * registry is asserted about its LITERALS: a retired row parked in a comment
 * must not be published, a separator-formatted or arithmetic time slot must be
 * refused rather than guessed at, and a declaration in a shape the parse does
 * not know must be loud. A required module has already resolved all of that
 * away, so the fixtures under test/flag-day-literals.test.js could not drive
 * it. The entry plus every part is read as one text (lib/indexer-source.js),
 * and every refusal names the part file and line it came from.
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
const { locatedModuleSource } = require('../lib/indexer-source.js');
const { stripComments } = require('../lib/env-var-doc-coverage.js');

const DOC_ROOT = path.resolve(__dirname, '..');
const INDEXER_SRC = path.resolve(DOC_ROOT, '../xchain-indexer/src');
const REGISTRY = path.join(INDEXER_SRC, 'protocol_changes.js');
const OUTPUT = path.join(DOC_ROOT, 'protocol', 'flag-days.md');
const CANONICAL_CONSTANTS = path.join(DOC_ROOT, 'protocol', 'constants.js');

// The registry's own files as ONE text, comments blanked, with the map back to
// the part file and line an offset came from. Every registry pass below reads
// this rather than the entry alone, because the rows moved into the parts and
// a pass that read the entry would find no row and publish an empty page.
function registrySources(indexerSrc) {
    const source = locatedModuleSource(path.join(indexerSrc, 'protocol_changes.js'));
    const rel = (file) => path.relative(indexerSrc, file);
    return {
        raw: source.text,
        // Blanked FILE BY FILE and re-joined the same way, so an unterminated
        // shape in one part cannot blank the next and every offset still maps.
        scannable: source.parts.map((p) => withoutComments(p.text)).join('\n'),
        fileAt: (index) => rel(source.where(index).file),
        where: (index) => { const at = source.where(index); return `${rel(at.file)} line ${at.line}`; },
    };
}

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
 * anybody scheduled. `consensus/gates/price_pair_gate.js` parks 9999999999 (year 2286)
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

// The comment stripper is the one lib/env-var-doc-coverage.js owns: it was
// ported from here and the two had to stay byte-identical, so this file now
// reads the one copy instead of carrying a twin. It blanks every comment body,
// keeping length and newlines, so offsets and line numbers still line up with
// the raw text; a regex literal and a string are copied whole, because the
// `//` inside either starts no comment. The completeness scan reads this
// rather than the source, because dead code inside a block comment is not a
// declaration.
const withoutComments = stripComments;

/**
 * The mainnet_time argument of a call, when it is a literal this page covers.
 *
 * Returns null for anything else: a literal outside the time-keyed window, an
 * identifier, or a call shape with too few arguments. Null means "not a row
 * this page would have carried", which is what makes the check below quiet
 * about declarations that were never its business.
 *
 * `open` is the index of the `(` of a call or the `[` of an array row; the
 * arguments are read the same way from either.
 */
function mainnetTimeLiteral(text, open) {
    if (text[open] !== '(' && text[open] !== '[') return null;

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
 * `consensus/gates/state_subtree_gate.js` keys three per-slot maps inside one const.
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
 * slots this scan refuses to guess at. Since W5 the indexer keeps no top-level
 * `*_activation.js` (every map is a registry row and the logic modules sit under
 * `src/consensus/gates/`), so the scan finds nothing there; it stays as the
 * pre-W3 fallback the registry arm supersedes.
 *
 * READ WITH THE REGISTRY ARM'S RIGOR, which it once lacked in three ways. It
 * scanned raw text, so a retired map parked in a block comment was published as
 * a live row; it took the FIRST `mainnet:` per file, so the second map in a
 * multi-map module could never enter the page (the anchor-reward module
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
            if (body !== null) collectMapSlots(body, decl[1], name, name, add, unreadable);
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
 * Every mainnet slot of one activation map body, into `add` as `(gate, time,
 * source)`, or into `unreadable` under `label` when the scan refuses it. The
 * one reader behind the sibling scan and the gate-row pass: the map is the
 * same shape in a `const NAME = {` declaration and in an `addGate` row.
 */
function collectMapSlots(body, gate, source, label, add, unreadable) {
    for (const slot of body.matchAll(SIBLING_MAINNET_SLOT)) {
        const read = readMainnetSlot(slot[2]);
        const where = `${label}: ${gate}.${slot[1]} = ${slot[2].trim() || '(nothing this scan can read)'}`;
        if (read.kind === 'unreadable') unreadable.push(where);
        else if (read.kind !== 'number') continue;
        else if (slot[1] === 'mainnet') add(gate, read.time, source);
        else if (read.time >= TIMESTAMP_FLOOR && read.time < SENTINEL_FLOOR) unreadable.push(`${where} is a block TIME, so this page would carry it`);
    }
}

/** An `addGate('<stem>.<NAME>', '<unit>', {` row with an object-literal table. */
const GATE_ROW = /addGate\(\s*'([A-Za-z0-9_/]+)\.([A-Z][A-Z0-9_]*)'\s*,\s*'([a-z]+)'\s*,\s*\{/g;

/**
 * Every time-keyed gate the registry's `addGate(key, unit, table)` rows declare.
 *
 * These are the maps the sibling scan above found in `*_activation.js` before W3:
 * the registry owns every activation table now and each module reads its own
 * back from it, so the row is where the threshold and its registration comment
 * live. The gate keeps the name the sibling scan published, the key's export
 * half (`DISPENSER_CAPS_ACTIVATION`), so a table that moved into a row keeps
 * its row on the page. Only `'time'` rows are read: the unit says what the
 * value scan had to infer from the number's size, and a height row is not this
 * page's subject whatever its mainnet slot holds. The slots go through the
 * sibling scan's reader, so the same shapes are quiet and the same are loud.
 */
function collectGateRows(sources, add) {
    const unreadable = [];
    for (const row of sources.scannable.matchAll(GATE_ROW)) {
        if (row[3] !== 'time') continue;
        const body = objectBody(sources.scannable, row.index + row[0].length - 1);
        if (body === null) continue;
        collectMapSlots(body, row[2], sources.fileAt(row.index), sources.where(row.index), add, unreadable);
    }
    if (unreadable.length > 0) {
        throw new Error(
            'a registry addGate row declares a mainnet threshold this generator cannot read, so '
            + 'protocol/flag-days.md would publish an inventory that calls itself complete and is not:\n  '
            + unreadable.join('\n  ')
            + "\n\nThe gate-row pass reads `mainnet: <digits>` inside an addGate('<stem>.<NAME>', 'time', { ... }) "
            + 'table and stays quiet for `null` and for an identifier it cannot resolve. Either write the '
            + 'threshold in that shape or widen the parse in bin/generate-flag-days.js deliberately.',
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
 * and seven park the 9999999999 sentinel (see `collectMainnetUnarmed`, which
 * names them on the page rather than dropping them). Failing on unreadable SYNTAX alone
 * therefore fires hardest on declarations that could never have contributed a
 * row, and the evidence that was meant to exclude that (regenerate today's
 * registry, see nothing throw) cannot see it: every call in today's registry is
 * single-quoted, so no arm of the check is exercised at all. A call is loud only
 * when its mainnet_time slot holds a literal inside the time-keyed window, which
 * is exactly the condition under which a row went missing.
 *
 * An identifier in that slot is resolved when it names one of the registry's own
 * `const NAME_MAINNET_TIME = <digits>;` declarations (see `registryCalls`), and
 * the GATE NAME the call registers is what reaches the page: the constant's
 * prefix is not a gate key, and the two can differ (`CROSS_SETTLE_CAP_MAINNET_TIME`
 * arms `CROSS_SETTLE_PER_BLOCK_CAP`). Any other identifier stays quiet: no text
 * scan can tell `PRICE_PAIR_SENTINEL` from a live timestamp, and guessing is what
 * turns a build gate into noise. The constant arm needs no such test, because
 * `NAME_MAINNET_TIME` says in its own name that it is a time.
 *
 * A call is also fine when its gate was collected some other way, which is how a
 * constant no call consumes still reaches the page under its own prefix.
 *
 * The array row `['NAME', 'X.Y.Z', mainnet_time, ...]` is the same declaration
 * in the part files' shape, and is checked by the same arm: the row's `[` is
 * where a call's `(` is, and the arguments read identically from either.
 */
function assertEveryDeclarationParsed(sources, parsedCalls, parsedConstLines, parsedNames) {
    const unparsed = [];
    const registry = sources.scannable;

    for (const m of registry.matchAll(/(?:addChange\s*\(|\[)\s*(['"])([A-Za-z0-9_]+)\1\s*,\s*(['"])[0-9.]+\3\s*,/g)) {
        if (parsedCalls.has(m.index)) continue;
        if (parsedNames.has(m[2])) continue;
        const time = mainnetTimeLiteral(registry, m.index + m[0].search(/[([]/));
        if (time === null) continue;
        unparsed.push(`${sources.where(m.index)}: declaration of ${m[2]} at mainnet_time ${time}`);
    }

    for (const m of registry.matchAll(/const\s+[A-Z][A-Z0-9_]*_MAINNET_TIME\s*=/g)) {
        const line = lineAt(registry, m.index);
        if (parsedConstLines.has(line)) continue;
        unparsed.push(`${sources.where(m.index)}: ${sources.raw.split('\n')[line - 1].trim()}`);
    }

    if (unparsed.length > 0) {
        throw new Error(
            'the protocol_changes registry declares gates this generator cannot read, so protocol/flag-days.md '
            + 'would publish an inventory that calls itself complete and is not:\n  '
            + unparsed.join('\n  ')
            + "\n\ncollectGates reads addChange('NAME', 'version', <digits>, ...) or the part-file row "
            + "['NAME', 'version', <digits>, ...] with single quotes and a literal time, and "
            + 'const NAME_MAINNET_TIME = <digits>;. A decimal literal may carry `_` separators in either '
            + 'position. Either write the declaration in one of those shapes or widen the parse in '
            + 'bin/generate-flag-days.js deliberately.',
        );
    }
}

// A decimal literal, separators and all: the SAME grammar the time-slot parser
// in `registryCalls` uses. The two were written apart, digits-only here and
// separator-aware there, and that asymmetry is what made a separator-formatted
// declaration unreadable to the const pass while the identical value in a call
// argument read fine.
const TIME_LITERAL = /^\d(?:_?\d)*$/;

// The head of a time-constant declaration. The initializer is read separately,
// up to its `;`, so an unreadable shape is REFUSED rather than left unmatched:
// a regex that demands digits simply does not match a hex or arithmetic
// initializer, and a declaration nothing matched is a declaration nothing can
// report.
const TIME_DECL_HEAD = /const\s+([A-Z][A-Z0-9_]*)_(MAINNET|TESTNET)_TIME\s*=/g;

/**
 * The registry's `const NAME_MAINNET_TIME = <literal>;` and
 * `const NAME_TESTNET_TIME = <literal>;` declarations, read from the
 * comment-stripped text as `{ name, prefix, network, value, line }`.
 *
 * ONE SCANNER, and it REFUSES what it cannot read. Both properties are load
 * bearing. A bare-digit regex per collector and per constant map means widening
 * one leaves four un-widened, and a declaration none of them matches vanishes
 * in silence: a `const FOO_TESTNET_TIME = 1_789_257_600;`
 * consumed by an addChange call resolved to null, the gate dropped out of the
 * testnet-exceptions table, and the page then extended its "genesis-active off
 * mainnet" claim over a gate that arms on a date of its own. The completeness
 * guard could not catch it either: it scans MAINNET declarations only, and
 * `collectTestnetArms`, `collectTestnetUnarmed` and `collectMainnetUnarmed`
 * never reach it at all.
 *
 * Refusal lives here for the reason `registryCalls` gives for its own: this
 * runs inside `registryCalls`, which every collector calls, so an unreadable
 * declaration is loud on every arm or it is loud on one. The name says it is a
 * time, so there is no sentinel-versus-timestamp ambiguity to respect.
 */
function declaredTimeConstants(sources) {
    const out = [];
    const scannable = sources.scannable;
    TIME_DECL_HEAD.lastIndex = 0;
    for (const m of scannable.matchAll(TIME_DECL_HEAD)) {
        const name = `${m[1]}_${m[2]}_TIME`;
        const line = lineAt(scannable, m.index);
        const rest = scannable.slice(m.index + m[0].length);
        const end  = rest.indexOf(';');
        const text = (end === -1 ? rest : rest.slice(0, end)).trim();

        if (end === -1 || !TIME_LITERAL.test(text)) {
            throw new Error(
                `${sources.where(m.index)}: ${name} is declared with an initializer this `
                + `generator cannot read (\`${text.split('\n')[0].slice(0, 60)}\`), so `
                + 'protocol/flag-days.md would publish an inventory that calls itself complete and is '
                + 'not.\n\nA time constant reads as a decimal literal on one line (`1786060800`, '
                + '`_` separators allowed). Write the declaration in that shape or widen the parse in '
                + 'bin/generate-flag-days.js deliberately.',
            );
        }
        out.push({ name, prefix: m[1], network: m[2], value: Number(text.replace(/_/g, '')), line, index: m.index });
    }
    return out;
}

/**
 * The same declarations as an identifier -> value map, for the slot parser.
 */
function registryConstants(sources) {
    const values = new Map();
    for (const d of declaredTimeConstants(sources)) values.set(d.name, d.value);
    return values;
}

/**
 * Every single-quoted `addChange('GATE', 'version', mainnet_time, testnet_time, ...)`
 * call and every single-quoted part-file row `['GATE', 'version', mainnet_time,
 * testnet_time, ...]` in the comment-stripped registry, as
 * `{ index, gate, mainnet, testnet }`.
 *
 * THE ROW IS THE CALL WITHOUT ITS NAME. The part files hold the time table as
 * array literals that core.applyChanges() spreads into addChange(), argument
 * for argument, so the two shapes carry the same slots in the same order and
 * one pattern reads both. The constants a slot names are declared in
 * `flag_times*.js` and consumed in `changes_*.js`; they resolve across the
 * parts because the const pass runs over the whole joined text first.
 *
 * A time slot holding a digit literal reads as that number. A slot holding an
 * identifier reads as the value of the registry constant it names, so the GATE
 * NAME the call registers is what the collectors publish; the constant's prefix
 * is not a gate key `isEnabled` accepts, and the two differ for
 * `CROSS_SETTLE_CAP_MAINNET_TIME` (arms `CROSS_SETTLE_PER_BLOCK_CAP`) and
 * `BATCH_ROOT_SUB_INDEX_MAINNET_TIME` (arms `BATCH_SUBCOMMAND_ROOT_DISCRIMINATOR`).
 * Any other identifier resolves to null and stays quiet. `consumed` names the
 * constants some call resolved, so the constant pass in each collector leaves
 * those to the call and publishes a prefix only for a constant no call reads.
 *
 * THE SLOT PATTERN READS THE WHOLE ARGUMENT, to its `,` or `)`, and never a
 * leading run of it. Capturing `([A-Za-z0-9_]+)` asserted no terminator, so two
 * shapes went wrong in the two directions this generator exists to prevent:
 * `1_786_060_800` matched whole, failed the digits test, resolved to null, and
 * the gate left the page in silence; `1786060800 + 86400` matched only its
 * PREFIX and published an instant a day early. Neither reached
 * `assertEveryDeclarationParsed`, because `collectGates` records the call in
 * `parsedCalls` and its gate in `parsedNames` whether or not the slot resolved,
 * and the check skips on exactly those two sets. Both were reproduced against
 * fixtures before this was written; the live registry carries neither shape
 * today, so this closes a latent hole rather than correcting a published row.
 *
 * REFUSAL LIVES HERE rather than in the completeness check, because
 * `collectTestnetArms`, `collectTestnetUnarmed` and `collectMainnetUnarmed`
 * read the same calls and have no completeness check behind them: a shape this
 * parse cannot read has to be loud on every arm or it is loud on one.
 */
function registryCalls(sources) {
    const scannable = sources.scannable;
    const constants = registryConstants(sources);
    const consumed = new Set();
    const slot = (arg, gate, index) => {
        if (arg === undefined) return null;
        const text = arg.trim();
        if (text === '') return null;

        // A decimal literal, separators and all. Written as the separator
        // grammar rather than a `_`-strip so `_1786060800` stays an identifier:
        // stripping first reads a leading-underscore NAME as a number.
        if (/^\d(?:_?\d)*$/.test(text)) return Number(text.replace(/_/g, ''));

        // An identifier: the registry constant's value when the const pass saw
        // it, and otherwise quiet by design, because no text scan can tell a
        // parked sentinel from a live timestamp behind a name.
        if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)) {
            if (constants.has(text)) { consumed.add(text); return constants.get(text); }
            return null;
        }

        throw new Error(
            `${sources.where(index)}: the ${gate} gate passes a time slot `
            + `this generator cannot read (\`${text}\`), so protocol/flag-days.md would publish an `
            + 'inventory that calls itself complete and is not.\n\n'
            + 'A time slot reads as a decimal literal (`1786060800`, separators allowed) or as the name '
            + 'of a `const NAME_MAINNET_TIME = <digits>;` the registry declares. Write the slot in one of '
            + 'those shapes or widen the parse in bin/generate-flag-days.js deliberately.',
        );
    };
    const callRe = /(?:addChange\(|\[)\s*'([A-Z0-9_]+)'\s*,\s*'[0-9.]+'\s*,\s*([^,)\]]+)(?:\s*,\s*([^,)\]]+))?/g;
    const calls = [];
    for (const m of scannable.matchAll(callRe)) {
        calls.push({
            index: m.index,
            gate: m[1],
            mainnet: slot(m[2], m[1], m.index),
            testnet: slot(m[3], m[1], m.index),
        });
    }
    return { calls, consumed };
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

    // COLLECT FROM THE COMMENT-STRIPPED COPY (registrySources blanks it). Dead
    // code inside a comment is not a declaration, so a retired gate parked in
    // one was collected, published as a row, and counted toward the
    // coordinated flag day: the generator inventing a gate the indexer does not
    // arm, on the page implementers plan fleet upgrades from.
    const sources = registrySources(indexerSrc);

    // addChange('NAME', 'version', mainnet_time, ...) or the part-file row
    // ['NAME', 'version', mainnet_time, ...], the time slot a digit literal or
    // a registry constant passed by name (see registryCalls). "Declared in"
    // names the part the row sits in, where its registration comment is.
    const { calls, consumed } = registryCalls(sources);
    for (const call of calls) {
        parsedCalls.add(call.index);
        parsedNames.add(call.gate);
        if (call.mainnet !== null) add(call.gate, call.mainnet, sources.fileAt(call.index));
    }

    // const NAME_MAINNET_TIME = 1786060800;  (gates the registry declares as a
    // shared constant because a second repo has to stay byte-identical to it).
    // A constant some call consumes is published under that call's gate name
    // above; only a constant no call reads is published under its own prefix.
    for (const d of declaredTimeConstants(sources)) {
        if (d.network !== 'MAINNET') continue;
        parsedConstLines.add(d.line);
        if (consumed.has(d.name)) continue;
        parsedNames.add(d.prefix);
        add(d.prefix, d.value, sources.fileAt(d.index));
    }

    assertEveryDeclarationParsed(sources, parsedCalls, parsedConstLines, parsedNames);

    // The registry's addGate('<stem>.<NAME>', 'time', { mainnet: ... }) rows,
    // then the sibling `*_activation.js` modules for a tree that still declares
    // a map of its own: a mainnet threshold above the timestamp floor is a
    // time-keyed gate; below it, a block height, which this page does not cover.
    collectGateRows(sources, add);
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
    const sources = registrySources(indexerSrc);
    const found = new Map();
    const add = (gate, time) => {
        if (!Number.isFinite(time) || time < TIMESTAMP_FLOOR || time >= SENTINEL_FLOOR) return;
        if (!found.has(gate)) found.set(gate, { gate, time });
    };
    const { calls, consumed } = registryCalls(sources);
    for (const call of calls) if (call.testnet !== null) add(call.gate, call.testnet);
    for (const d of declaredTimeConstants(sources)) {
        if (d.network === 'TESTNET' && !consumed.has(d.name)) add(d.prefix, d.value);
    }
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
    const sources = registrySources(indexerSrc);
    const found = new Map();
    const add = (gate, time) => {
        if (!Number.isFinite(time) || time < SENTINEL_FLOOR) return;
        if (!found.has(gate)) found.set(gate, { gate, time });
    };
    const { calls, consumed } = registryCalls(sources);
    for (const call of calls) if (call.testnet !== null) add(call.gate, call.testnet);
    for (const d of declaredTimeConstants(sources)) {
        if (d.network === 'TESTNET' && !consumed.has(d.name)) add(d.prefix, d.value);
    }
    return [...found.values()].sort((a, b) => a.gate.localeCompare(b.gate));
}

/**
 * MAINNET slots parked on an UNARMED sentinel (>= SENTINEL_FLOOR), as `{ gate, time }`
 * sorted by name.
 *
 * `collectGates` drops these deliberately: publishing 9999999999 as a flag day would put
 * a fake commitment on a page implementers plan fleet upgrades from. Dropping them with
 * no trace is the other failure, and it is the one that shipped: a gate absent from the
 * table reads as a gate that does not exist, so `sweep.md` could send a reader here "for
 * where the gate stands on each network" and the page would not say. Naming them without
 * an instant keeps both properties.
 *
 * Scoped to the registry's own files, exactly like the testnet twin above. A sibling
 * `*_activation.js` module can also park a mainnet sentinel, and this scan does not reach
 * it; the note it feeds says so rather than claiming a completeness it does not have.
 */
function collectMainnetUnarmed(indexerSrc = INDEXER_SRC) {
    const sources = registrySources(indexerSrc);
    const found = new Map();
    const add = (gate, time) => {
        if (!Number.isFinite(time) || time < SENTINEL_FLOOR) return;
        if (!found.has(gate)) found.set(gate, { gate, time });
    };
    const { calls, consumed } = registryCalls(sources);
    for (const call of calls) if (call.mainnet !== null) add(call.gate, call.mainnet);
    for (const d of declaredTimeConstants(sources)) {
        if (d.network === 'MAINNET' && !consumed.has(d.name)) add(d.prefix, d.value);
    }
    return [...found.values()].sort((a, b) => a.gate.localeCompare(b.gate));
}

/** Every activation map the documentation canon publishes, sorted for stable output. */
function collectCanonicalActivationMaps(constantsPath = CANONICAL_CONSTANTS) {
    const resolved = require.resolve(constantsPath);
    delete require.cache[resolved];
    return Object.keys(require(resolved))
        .filter((name) => name.endsWith('_ACTIVATION'))
        .sort();
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

function render(gates, testnetArms = [], testnetUnarmed = [], mainnetUnarmed = [], canonicalActivationMaps = []) {
    const anchor = coordinatedFlagDay(gates);
    const others = gates.filter((g) => g.time !== anchor.time);

    const rows = gates.map((g) => {
        const note = g.time === anchor.time ? 'contract-era flag day' : 'own date';
        return `| \`${g.gate}\` | \`${g.time}\` | ${utcInstant(g.time)} | ${note} | \`${g.source}\` |`;
    });
    const canonicalRows = canonicalActivationMaps.map((name) => `- \`${name}\``);

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
          + 'comment under \`xchain-indexer/src/protocol_changes/\`. The values on this page are otherwise '
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
          + 'Each names its reason in its registration comment under `xchain-indexer/src/protocol_changes/`.';

    // The symmetric mainnet note. Without it a sentinel-parked gate leaves no trace on the
    // page at all, so the table below reads as the whole registry and the testnet sentence
    // above reads as if mainnet were armed. Names, never instants: the sentinel is not a
    // date anybody scheduled.
    const mainnetUnarmedNote = mainnetUnarmed.length === 0
        ? ''
        : `\n\n**${mainnetUnarmed.length === 1 ? 'One gate is UNARMED on mainnet' : `${mainnetUnarmed.length} gates are UNARMED on mainnet`}** `
          + `(${mainnetUnarmed.map((g) => `\`${g.gate}\``).join(', ')}): each parks the sentinel `
          + 'rather than an instant, so mainnet has **never** run the post-activation behavior '
          + 'and will not until an operator names a date. They carry no row in the table below, '
          + 'because publishing the sentinel as a flag day would put a commitment on this page '
          + 'that nobody made. Each names its reason in its registration comment under '
          + '`xchain-indexer/src/protocol_changes/`. This note covers the registry only; a sibling '
          + '`*_activation.js` module can park a mainnet sentinel too, and those are not '
          + 'enumerated here.';

    return `<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->
<!-- GENERATED FILE. Do not edit: run \`node bin/generate-flag-days.js\`. -->

# Flag-Day Values

**This page is generated** from \`xchain-indexer/src/protocol_changes.js\`, its part files
under \`src/protocol_changes/\`, the time-keyed activation modules beside them, and
\`protocol/constants.js\`. Do not edit it by hand: run \`node bin/generate-flag-days.js\`
from the repository root and commit the result.

Every other page in this documentation set names the **gate** and links here
instead of quoting a date, because a flag-day value is not a fact about the
protocol, it is the current setting of a constant, and it has been repinned
before. One generated page moves on a repin; a dozen sentences do not.

For what a flag day is, how \`isEnabled\` evaluates it, which cohort a gate
belongs to, and what happens to a node that misses one, see
[Protocol Activation](./protocol-activation.md).

## Canonical activation maps

These names are exported by [\`protocol/constants.js\`](./constants.js). The index includes
scheduled, inert, genesis-active, time-keyed, and height-keyed maps so a gate remains
discoverable here even when it has no mainnet date for the table below.

${canonicalRows.join('\n')}

## Contract-era flag day

The coordinated instant that the **Cohort A** contract-era rules switch on,
simultaneously on Bitcoin, Litecoin, and Dogecoin.

| | |
|---|---|
| **Mainnet block time** | \`${anchor.time}\` |
| **UTC instant** | ${utcInstant(anchor.time)} |
| **Gates riding it** | ${anchor.count} |

${outliers}${mainnetUnarmedNote}

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
    return render(collectGates(indexerSrc), collectTestnetArms(indexerSrc),
                  collectTestnetUnarmed(indexerSrc), collectMainnetUnarmed(indexerSrc),
                  collectCanonicalActivationMaps());
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
    collectGates, collectTestnetArms, collectTestnetUnarmed, collectMainnetUnarmed,
    collectCanonicalActivationMaps, coordinatedFlagDay, render, generate, utcInstant, utcDate,
    DOC_ROOT, INDEXER_SRC, REGISTRY, OUTPUT, CANONICAL_CONSTANTS, TIMESTAMP_FLOOR, SENTINEL_FLOOR,
};
