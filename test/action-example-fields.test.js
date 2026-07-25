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
 * WHY THIS IS SCOPED TO DISPENSER RATHER THAN SWEEPING protocol/actions/*.md:
 * a first cut asserted "every example carries the field count its format
 * declares" across all 36 action docs and failed 17 of them, none of it this
 * defect. Two properties of the wire format make a bare count comparison
 * meaningless in general:
 *
 *   - trailing fields are omittable. ISSUE v0 declares 25 fields and its
 *     examples correctly show 2 to 10; a short example is normal, not drift.
 *   - several actions are variadic. BATCH v0 declares `VERSION|ACTIONS` and its
 *     example spells out 7 fields because ACTIONS is itself a delimited list,
 *     so examples legitimately exceed the declared count too.
 *
 * So "count != declared" is not a defect signal, and a lint built on it would
 * have to be silenced across most of the tree, which is worse than no lint.
 * What actually caught the DISPENSER bug is stricter and local: every v0
 * example in THAT doc spells the format out to the end (they all carry their
 * trailing empties), so for this doc, and only while that stays true, an exact
 * count is a real contract. Generalizing needs per-action arity knowledge and
 * is tracked separately rather than guessed at here.
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
