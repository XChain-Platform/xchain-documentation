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
 * Flag-day literals in prose.
 *
 * WHY. The coordinated contract-era flag-day has been repinned twice
 * (2026-10-01 -> 2026-08-17 -> 2026-08-07), and each repin rotted a different
 * set of sentences. Measured 2026-08-06: five pages still carried the first
 * retired stamp, and the review findings that flagged them proposed the SECOND
 * retired stamp, so the docs and the report disagreed with the constant in two
 * different directions at once. That timestamp backs 32 mainnet gates; a reader
 * who trusts a rotted page plans a fleet upgrade for the wrong week.
 *
 * WHAT IT CHECKS.
 *
 *   1. protocol/flag-days.md is what bin/generate-flag-days.js emits from the
 *      indexer's registry today. Skipped when the sibling xchain-indexer
 *      checkout is absent, because the generated page is committed and a
 *      standalone documentation clone can still read correct values.
 *   2. No prose page states a live flag-day timestamp or its UTC date. The
 *      generated page is the one place a value lives; every other page names
 *      the gate and links there.
 *   3. No prose page states a RETIRED flag-day date. This half is retroactive
 *      and unconditional: those two dates are dead everywhere in the tree, and
 *      pinning them literally is what stops a revert from being blessed.
 *
 * WHY CHECK 2 NEEDS A CUE AND CHECK 3 DOES NOT. `2026-08-07` is a live gate
 * date AND an ordinary calendar day that the wallet release runbooks use to
 * date seven unrelated measurements ("Re-measured 2026-08-07: both domains now
 * publish SPF"). Banning the string outright would demand those be falsified.
 * So a live date is a finding only next to flag-day language. A RETIRED date
 * has no such legitimate use: it was never anything but this constant.
 *
 * CHANGELOG.md is history, exempt from all three: its entries were true when
 * written, and rewriting them would be the actual lie.
 *
 * Run: node --test test/flag-day-literals.test.js   (Node 22)
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gen = require('../bin/generate-flag-days.js');

const DOC_ROOT = path.join(__dirname, '..');
const GENERATED = path.join(DOC_ROOT, 'protocol', 'flag-days.md');
const HAS_INDEXER = fs.existsSync(gen.REGISTRY);

/**
 * Flag-day dates the platform has retired. Pinned literally, which is the
 * whole point: a value read from today's source cannot know what yesterday's
 * was, so only a written-down list makes this guard retroactive.
 *
 *   2026-10-01  the original contract-era anchor (BTC-height-derived)
 *   2026-08-17  the  repin, itself retired by  before the docs
 *               that quoted the FIRST one had even been corrected
 */
const RETIRED_DATES = ['2026-10-01', '2026-08-17'];

/** The same two, as the Unix values that appeared alongside them. */
const RETIRED_TIMESTAMPS = ['1790812800', '1786924800'];

/**
 * Flag-day language. A live gate date next to any of these is a claim about
 * the constant; the same date anywhere else is an ordinary calendar date and
 * none of this guard's business. Deliberately narrow: "gate" alone matched a
 * release runbook's artifact-set gate, and a cue that broad turns the guard
 * into a list of sentences somebody had to exempt.
 */
const CUE = /flag[- ]day|contract[- ]era|cohort a|activation|activated|activates/i;

function markdownFiles(dir = DOC_ROOT, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'dist') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) markdownFiles(p, out);
        // CHANGELOG is a record of what was true when written.
        else if (e.name.endsWith('.md') && e.name !== 'CHANGELOG.md' && p !== GENERATED) out.push(p);
    }
    return out;
}

function proseLines() {
    const out = [];
    for (const file of markdownFiles()) {
        const rel = path.relative(DOC_ROOT, file);
        fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => out.push({ rel, no: i + 1, line }));
    }
    return out;
}

test('the generated flag-day page matches the indexer registry', { skip: HAS_INDEXER ? false : 'no sibling xchain-indexer checkout' }, () => {
    assert.ok(fs.existsSync(GENERATED), 'protocol/flag-days.md is missing. Run node bin/generate-flag-days.js');
    assert.strictEqual(
        fs.readFileSync(GENERATED, 'utf8'),
        gen.generate(),
        'protocol/flag-days.md is stale against xchain-indexer/src/protocol_changes.js. '
        + 'Run `node bin/generate-flag-days.js` and commit the result. Do not hand-edit the page: '
        + 'the values are generated so that a repin costs one file instead of a dozen sentences.',
    );
});

test('both registry parses still find their gates', { skip: HAS_INDEXER ? false : 'no sibling xchain-indexer checkout' }, () => {
    // collectGates reads the registry with two independent regexes, and the
    // check above cannot tell you when one of them stops matching: it compares
    // the COMMITTED page against a fresh render, so it goes red only until
    // somebody regenerates. Regenerating on a broken parse rewrites the page to
    // agree with the loss, and the gate list then ships one row short with
    // every test green. These names are the anchor that survives that, one per
    // parse path, so a formatting change or a rename fails here first.
    const byName = new Map(gen.collectGates().map((g) => [g.gate, g.time]));

    // `const NAME_MAINNET_TIME = ...` path (collectGates strips the suffix).
    for (const gate of ['VM_BANNED_ASYNC', 'NATIVE_FEE_PRICE_TIME_GATE']) {
        assert.ok(byName.has(gate),
            `${gate} is absent from collectGates(): the \`const NAME_MAINNET_TIME\` parse in `
            + 'bin/generate-flag-days.js stopped matching, so protocol/flag-days.md is short a row.');
    }

    // `addChange('NAME', 'version', mainnet_time, ...)` path.
    assert.ok(byName.has('DEPLOY_BASE64_CODE'),
        'DEPLOY_BASE64_CODE is absent from collectGates(): the addChange(...) parse in '
        + 'bin/generate-flag-days.js stopped matching, so protocol/flag-days.md is short a row.');

    // All three ride the coordinated instant. Asserted as equality against a
    // value read from the registry, never as a literal: a repin is legitimate
    // and must not have to edit this file.
    const anchor = gen.coordinatedFlagDay(gen.collectGates()).time;
    assert.ok(anchor >= gen.TIMESTAMP_FLOOR && anchor < gen.SENTINEL_FLOOR, 'the anchor is not a plausible gate time');
    for (const gate of ['VM_BANNED_ASYNC', 'NATIVE_FEE_PRICE_TIME_GATE', 'DEPLOY_BASE64_CODE']) {
        assert.strictEqual(byName.get(gate), anchor, `${gate} no longer rides the coordinated flag day`);
    }
});

/*  ------------------------------------------------------------------
 *  Completeness: a declaration the parse cannot read must be LOUD
 *  ------------------------------------------------------------------
 *
 *  The anchor test above can only name gates that already exist, which is no
 *  help for the gate somebody adds tomorrow in a style the regexes miss: it
 *  would drop from the page, the generator would rewrite the page to agree,
 *  and every test here would stay green (). These fixtures drive
 *  collectGates against a synthetic registry, so they run in a standalone
 *  clone with no sibling indexer.
 */

/** A throwaway indexer src dir holding one fixture registry. */
function fixtureRegistry(body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagday-registry-'));
    fs.writeFileSync(path.join(dir, 'protocol_changes.js'), body);
    return dir;
}

test('an addChange call the parse cannot read is refused, not skipped', () => {
    const dir = fixtureRegistry('this.addChange("FOO", "1.0.0", 1786060800, 0, 0, 0, 0, 0);\n');
    assert.throws(
        () => gen.collectGates(dir),
        /FOO/,
        'a double-quoted call was dropped in silence, which is how the page ships one row short',
    );
});

test('a drifted _MAINNET_TIME constant is refused, not skipped', () => {
    const dir = fixtureRegistry('const FOO_MAINNET_TIME = 1_786_060_800;\n');
    assert.throws(() => gen.collectGates(dir), /FOO_MAINNET_TIME/);
});

test('the check is structural: a legitimately value-filtered gate does not throw', () => {
    // A block-height threshold and the unarmed sentinel are both READ and then
    // dropped by the value filter. That is correct, and must not read as an
    // unparsable declaration.
    const dir = fixtureRegistry(
        "this.addChange('BY_HEIGHT', '1.0.0', 850000, 0, 0, 0, 0, 0);\n"
        + "this.addChange('UNARMED', '1.0.0', 9999999999, 0, 0, 0, 0, 0);\n"
        + "this.addChange('REAL', '1.0.0', 1786060800, 0, 0, 0, 0, 0);\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => g.gate), ['REAL']);
});

test('a call passing a collected constant by name does not throw', () => {
    // The registry's own shape for the two cohort constants: declared as a
    // const, then handed to addChange by identifier. The call is unreadable to
    // changeRe, and nothing is lost, because the const pass already has it.
    const dir = fixtureRegistry(
        'const REAL_MAINNET_TIME = 1786060800;\n'
        + "this.addChange('REAL', '2.0.0', REAL_MAINNET_TIME, 0, 0, 0, 0, 0);\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => g.gate), ['REAL']);
});

test('a commented-out declaration is not mistaken for a live one', () => {
    const dir = fixtureRegistry(
        "// this.addChange(\"OLD\", '1.0.0', 1786060800, 0, 0, 0, 0, 0);\n"
        + "this.addChange('REAL', '1.0.0', 1786060800, 0, 0, 0, 0, 0);\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => g.gate), ['REAL']);
});

/*  ------------------------------------------------------------------
 *  The other half of that check: what it must stay QUIET about
 *  ------------------------------------------------------------------
 *
 *  Most of the registry is not on this page. Around forty gates carry
 *  mainnet_time 0, several carry block heights, and one parks the unarmed
 *  sentinel, so a check that fires on unreadable SYNTAX alone fires hardest on
 *  declarations that could never have contributed a row. Regenerating today's
 *  registry cannot show that, because every call in it is single-quoted and no
 *  arm of the check is exercised at all; only fixtures can.
 */

test('an unreadable call for a gate active since genesis does not throw', () => {
    const dir = fixtureRegistry(
        "this.addChange('REAL', '1.0.0', 1786060800, 0, 0, 0, 0, 0);\n"
        + 'this.addChange("ADDRESS", "1.0.0", 0, 0, 0, 0, 0, 0);\n',
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => g.gate), ['REAL']);
});

test('an unreadable call keyed to a block height does not throw', () => {
    // Heights are not this page's subject, so an unreadable one drops nothing.
    const dir = fixtureRegistry(
        "this.addChange('REAL', '1.0.0', 1786060800, 0, 0, 0, 0, 0);\n"
        + 'this.addChange("BY_HEIGHT", "1.0.0", 961000, 0, 0, 0, 0, 0);\n',
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => g.gate), ['REAL']);
});

test('a call whose time is an identifier the const pass never saw does not throw', () => {
    // No text scan can tell a parked sentinel from a live timestamp behind a
    // name, and guessing is what turns a build gate into noise.
    const dir = fixtureRegistry(
        'const PRICE_PAIR_SENTINEL = 9999999999;\n'
        + "this.addChange('REAL', '1.0.0', 1786060800, 0, 0, 0, 0, 0);\n"
        + "this.addChange('PRICE_PAIR', '1.0.0', PRICE_PAIR_SENTINEL, 0, 0, 0, 0, 0);\n",
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => g.gate), ['REAL']);
});

test('a declaration inside a block comment does not throw', () => {
    // Its own line starts with `this.`, which a leading-token comment test
    // reads as live code.
    const dir = fixtureRegistry(
        "this.addChange('REAL', '1.0.0', 1786060800, 0, 0, 0, 0, 0);\n"
        + '/*\n'
        + 'this.addChange("OLD", "1.0.0", 1786060800, 0, 0, 0, 0, 0);\n'
        + 'const OLD_MAINNET_TIME = someOtherThing;\n'
        + '*/\n',
    );
    assert.deepStrictEqual(gen.collectGates(dir).map((g) => g.gate), ['REAL']);
});

test('a slash-slash inside a string does not blind the scan to the rest of the file', () => {
    const dir = fixtureRegistry(
        "const DOCS = 'https://xchain.dev/gates';\n"
        + 'this.addChange("FOO", "1.0.0", 1786060800, 0, 0, 0, 0, 0);\n',
    );
    assert.throws(() => gen.collectGates(dir), /FOO/);
});

test('the real registry parses clean, so the check is not merely strict', { skip: HAS_INDEXER ? false : 'no sibling xchain-indexer checkout' }, () => {
    assert.ok(gen.collectGates().length > 0);
});

test('the generated page is the only place a live flag-day value appears', { skip: HAS_INDEXER ? false : 'no sibling xchain-indexer checkout' }, () => {
    const gates = gen.collectGates();
    const liveDates = new Set(gates.map((g) => gen.utcDate(g.time)));
    const liveStamps = new Set(gates.map((g) => String(g.time)));

    const bad = [];
    for (const { rel, no, line } of proseLines()) {
        // A raw ten-digit gate timestamp is never anything but the constant,
        // cue or no cue.
        for (const m of line.matchAll(/\b(\d{10})\b/g)) {
            if (!liveStamps.has(m[1])) continue;
            bad.push(`${rel}:${no} states the block time ${m[1]} directly`);
        }
        if (!CUE.test(line)) continue;
        for (const m of line.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) {
            if (!liveDates.has(m[1])) continue;
            bad.push(`${rel}:${no} states the flag-day date ${m[1]} in prose`);
        }
    }

    assert.deepStrictEqual(bad, [],
        'these pages carry a flag-day value that a repin would rot. Name the gate and link to '
        + 'protocol/flag-days.md instead of quoting the value:\n' + bad.join('\n'));
});

test('no retired flag-day value survives anywhere in the prose', () => {
    const bad = [];
    for (const { rel, no, line } of proseLines()) {
        for (const date of RETIRED_DATES) {
            if (line.includes(date)) bad.push(`${rel}:${no} states ${date}, a retired flag-day date`);
        }
        for (const stamp of RETIRED_TIMESTAMPS) {
            if (line.includes(stamp)) bad.push(`${rel}:${no} states ${stamp}, a retired flag-day block time`);
        }
    }
    assert.deepStrictEqual(bad, [],
        'these publish a flag-day the platform repinned away from. Fix the sentence, not the guard:\n'
        + bad.join('\n'));
});

test('every retired value is genuinely retired in the current registry', { skip: HAS_INDEXER ? false : 'no sibling xchain-indexer checkout' }, () => {
    const live = new Set(gen.collectGates().map((g) => String(g.time)));
    for (const stamp of RETIRED_TIMESTAMPS) {
        assert.ok(!live.has(stamp),
            `${stamp} is listed here as RETIRED but the indexer arms a gate on it today. `
            + 'A revert of the flag-day would otherwise be blessed by its own guard.');
    }
});
