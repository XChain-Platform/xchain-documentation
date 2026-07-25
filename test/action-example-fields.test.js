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
 * DISPENSER wire-format example lint .
 *
 * Five of the seven DISPENSER v0 examples had drifted one field short. They
 * predated the GIVE_OWNERSHIP insertion at position 5, so every field from
 * GIVE_ESCROW rightwards was shifted by one. Both FIAT examples were among them,
 * so a reader copying the canonical "price a dispenser in USD" example encoded
 * GIVE_ESCROW=BTC, GET_AMOUNT=<address> and FIAT_CODE=0.05 and got a confusing
 * rejection from the indexer. The class is silent (the docs render fine) and it
 * hands readers malformed transactions, so it is worth a mechanical gate.
 *
 * TWO TIERS, because one rule does not fit every action .
 *
 * A first cut asserted "every example carries the field count its format
 * declares" across all 36 action docs and failed 17 of them, none of it this
 * defect. Working out why produced the arity rules below.
 *
 *   - Trailing fields are omittable. ISSUE v0 declares 25 and its examples
 *     correctly show 2 to 10, so a SHORT example is normal, not drift. That
 *     kills an exact-count rule in general.
 *   - Some formats end in a REST field, marked with an ellipsis in either
 *     position: `PARAMS...` (EXECUTE) or `...CONSTRUCTOR_PARAMS` (DEPLOY v0/v2).
 *     Those legitimately exceed their declared count. DEPLOY is precise about
 *     it: v0/v2 take CONSTRUCTOR_PARAMS as a rest field while v1/v3 do not,
 *     because COOLDOWN_BLOCKS + SLASH_DESTINATION trail the constructor args,
 *     and the doc marks exactly v0/v2 (matching deploy.js).
 *   - BATCH is not pipe-counted at all: `VERSION|COMMAND;COMMAND` embeds whole
 *     actions whose own params use `|`, so the delimiter is nested.
 *
 * So the general tier enforces the one invariant that does hold: a
 * non-rest-field format is an UPPER BOUND. An example may omit trailing fields
 * but may never carry more than the format declares. That catches a field added
 * to an example without being added to the format, or a format that lost one.
 *
 * The DISPENSER tier is stricter because that doc supports it: every v0 example
 * there spells the format out to its end, trailing empties included, so an exact
 * count is a real contract and mid-format insertions like the GIVE_OWNERSHIP
 * drift are caught. The upper-bound tier alone would NOT have caught that bug,
 * since a short example passes it.
 *
 * The sweep also found the one genuine notation gap it was looking for: LIST
 * v0/v1 take a repeatable ITEM (list.js loops params[idx] for idx > 1 and > 2)
 * but declared no rest marker, so LIST.md now writes `ITEM...`.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DISPENSER_MD = path.resolve(__dirname, '../protocol/actions/DISPENSER.md');
const src = fs.readFileSync(DISPENSER_MD, 'utf8');

// Declared formats: `### Version `N` - Title` followed by `- `VERSION|...``.
function declaredFormat(version) {
    const lines = src.split('\n');
    let current = null;
    for (const line of lines) {
        const header = line.match(/^###\s+Version\s+`(\d+)`/);
        if (header) { current = header[1]; continue; }
        const fmt = line.match(/^-\s+`(VERSION\|[^`]+)`\s*$/);
        if (fmt && current === String(version)) return fmt[1].split('|');
    }
    return null;
}

function examples(version) {
    const re = new RegExp('^DISPENSER\\|' + version + '\\|');
    return src.split('\n')
        .map((text, i) => ({ line: i + 1, text }))
        .filter(e => re.test(e.text));
}

// ---------------------------------------------------------------------------
// Tier 1 (all actions): a non-rest format is an upper bound on example fields.
// ---------------------------------------------------------------------------

const ACTIONS_DIR = path.resolve(__dirname, '../protocol/actions');

// A format ends in a rest field when it carries an ellipsis in either supported
// position. Both notations are in use; normalising them is cosmetic and tracked
// separately, so accept both rather than forcing one here.
const hasRestField = fmt => /\.\.\./.test(fmt);

function formatsFor(src) {
    const out = new Map();
    let current = null;
    for (const line of src.split('\n')) {
        const header = line.match(/^###\s+Version\s+`(\d+)`/);
        if (header) { current = header[1]; continue; }
        const fmt = line.match(/^-\s+`(VERSION\|[^`]+)`\s*$/);
        if (fmt && current !== null && !out.has(current)) out.set(current, fmt[1]);
    }
    return out;
}

describe('action examples never exceed their declared format ', () => {
    const files = fs.readdirSync(ACTIONS_DIR).filter(f => f.endsWith('.md')).sort();
    assert.ok(files.length > 0, 'no action docs found');

    for (const file of files) {
        const action = path.basename(file, '.md');
        const src = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
        const formats = formatsFor(src);
        const re = new RegExp('^' + action + '\\|(\\d+)\\|');

        test(file, () => {
            const problems = [];
            src.split('\n').forEach((line, i) => {
                const m = line.match(re);
                if (!m) return;
                const fmt = formats.get(m[1]);
                if (!fmt) return;                       // no declared format for this version
                if (hasRestField(fmt)) return;          // rest field: unbounded by design
                if (/;/.test(fmt)) return;              // nested delimiter (BATCH)
                const declared = fmt.split('|').length;
                const count = line.split('|').length - 1;
                if (count > declared) {
                    problems.push(`  line ${i + 1}: v${m[1]} example has ${count} fields, ` +
                                  `format declares ${declared} and has no rest field\n    ${line}`);
                }
            });
            assert.equal(problems.length, 0,
                `${file}: an example carries more fields than its format allows. Either the ` +
                `format gained a field the doc did not, or the tail is a rest field and the ` +
                `format should say so (\`FIELD...\`):\n` + problems.join('\n'));
        });
    }
});

describe('DISPENSER v0 examples match the declared format ', () => {

    test('the v0 format still has GIVE_OWNERSHIP at position 5', () => {
        // The insertion that caused the drift. If it moves again, every example
        // below needs re-checking, so pin the position rather than just the count.
        const fields = declaredFormat(0);
        assert.ok(fields, 'the v0 format line must be present');
        assert.equal(fields.length, 17);
        assert.equal(fields[0], 'VERSION');
        assert.equal(fields[4], 'GIVE_OWNERSHIP');
        assert.equal(fields[16], 'MEMO');
    });

    test('every v0 example carries all 17 fields', () => {
        const declared = declaredFormat(0).length;
        const found = examples(0);
        assert.ok(found.length >= 7, `expected the v0 examples to still be present, found ${found.length}`);

        const short = found
            .map(e => ({ ...e, count: e.text.split('|').length - 1 }))
            .filter(e => e.count !== declared)
            .map(e => `  line ${e.line}: ${e.count} fields, format declares ${declared}\n    ${e.text}`);

        assert.equal(short.length, 0,
            'DISPENSER v0 examples must spell the format out to the end. A field was ' +
            'probably inserted into the format without updating the examples, which ' +
            'silently shifts every field after it:\n' + short.join('\n'));
    });

    test('the two FIAT examples specifically are full-length', () => {
        // These are the ones a reader copies to build a fiat-priced dispenser,
        // and both were broken. Pinned by name so a future edit that drops one
        // fails loudly instead of shrinking the sweep above.
        const modeA = examples(0).find(e => /\|USD\|0\.05\|/.test(e.text));
        const modeB = examples(0).find(e => /1OracleSourceAddr/.test(e.text));
        assert.ok(modeA, 'the Mode A (validator snapshot) FIAT example must exist');
        assert.ok(modeB, 'the Mode B (user oracle) FIAT example must exist');
        assert.equal(modeA.text.split('|').length - 1, 17);
        assert.equal(modeB.text.split('|').length - 1, 17);
        // Mode B leaves FIAT_AMOUNT empty and sets ORACLE_ADDRESS; a shifted
        // example would put the address in FIAT_AMOUNT, which is the exact
        // symptom the drift produced.
        const bFields = modeB.text.split('|').slice(1);
        assert.equal(bFields[10], 'JPY',   'FIAT_CODE');
        assert.equal(bFields[11], '',      'FIAT_AMOUNT must be empty when an oracle prices the token');
        assert.match(bFields[12], /^1OracleSourceAddr/, 'ORACLE_ADDRESS');
    });

    test('does not claim a first oracle price is effective immediately', () => {
        // DISPENSER.md and PRICE.md contradicted each other and the code:
        // DISPENSER.md said the first price for a feed took effect immediately
        // and only updates were delayed, while PriceAggregator.js applies a flat
        // +86400 to EVERY publish (verified live: three rows, first publishes
        // included, all delay_seconds = 86400). PRICE.md already documented the
        // uniform rule and the consensus reason for it. Someone following the old
        // DISPENSER.md text would stand up an oracle-priced dispenser and watch
        // every dispense fail for a day with no explanation.
        const section = src.split('### Oracle Front-Running Protection')[1] || '';
        assert.ok(section, 'the front-running section must still exist');
        assert.ok(!/first[\s\S]{0,80}takes effect immediately/i.test(section),
            'DISPENSER.md must not claim the first oracle price is effective immediately');
        assert.match(section, /includ\w*\s+the\s+first/i,
            'the section must state that the delay includes the first publish');
        assert.match(section, /86400|24 hours/,
            'the section must state the delay length');
    });

    test('the v0 examples place GIVE_OWNERSHIP consistently with their prose', () => {
        // An ownership dispenser carries empty GIVE_AMOUNT/GIVE_ESCROW and
        // GIVE_OWNERSHIP=1; a balance dispenser is the inverse. Catches an
        // example fixed by padding the wrong end.
        for (const e of examples(0)) {
            const f = e.text.split('|').slice(1);
            const [giveAmount, giveOwnership, giveEscrow] = [f[3], f[4], f[5]];
            if (giveOwnership === '1') {
                assert.equal(giveAmount, '', `line ${e.line}: ownership dispenser must have empty GIVE_AMOUNT`);
                assert.equal(giveEscrow, '', `line ${e.line}: ownership dispenser must have empty GIVE_ESCROW`);
            } else {
                assert.equal(giveOwnership, '0', `line ${e.line}: balance dispenser must set GIVE_OWNERSHIP=0`);
                assert.notEqual(giveAmount, '', `line ${e.line}: balance dispenser needs a GIVE_AMOUNT`);
                assert.notEqual(giveEscrow, '', `line ${e.line}: balance dispenser needs a GIVE_ESCROW`);
            }
        }
    });
});
