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
 * BET wire-format example lint ( P1).
 *
 * Same defect class as the DISPENSER lint next door : an example whose
 * fields are shifted by one renders fine and hands the reader a transaction the
 * indexer rejects for a reason that points at the wrong field. It bit BET
 * immediately: the first v0 example was authored with five empty separators
 * where six were needed, so its MEMO prose landed in the DETAILS slot and would
 * have been rejected as non-base64, and a second example carried a trailing
 * space that became a one-character MEMO.
 *
 * The DISPENSER lint asserts an EXACT field count because every example in that
 * doc spells its format out to the end. BET deliberately does not: v0 declares
 * 12 fields and its examples stop early when the tail is empty, which is the
 * normal wire shape. So the mechanical contract here is the pair of properties
 * that actually distinguish drift from a short example:
 *
 *   - no example may carry MORE fields than its format declares (the shift
 *     symptom, and the only unambiguous count-based signal for BET);
 *   - the slots that carry a distinguishing value in each example are pinned
 *     by name, so a field inserted mid-format fails here instead of silently
 *     re-labelling every value after it.
 *
 * Trailing whitespace is checked too: a trailing space is invisible in review
 * and lands as a real (space) value in the last populated field.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const BET_MD = path.resolve(__dirname, '../protocol/actions/bet.md');
const src = fs.readFileSync(BET_MD, 'utf8');

// Declared formats: `### Version `N` - Title` followed by `- `VERSION|...``.
function declaredFormat(version) {
    let current = null;
    for (const line of src.split('\n')) {
        const header = line.match(/^###\s+Version\s+`(\d+)`/);
        if (header) { current = header[1]; continue; }
        const fmt = line.match(/^-\s+`(VERSION\|[^`]+)`\s*$/);
        if (fmt && current === String(version)) return fmt[1].split('|');
    }
    return null;
}

// Example lines only: a line that STARTS with `BET|<version>|`. The lifecycle
// diagram mentions `BET|0` mid-line, which is why the anchor matters.
function examples(version) {
    const re = new RegExp('^BET\\|' + version + '\\|');
    return src.split('\n')
        .map((text, i) => ({ line: i + 1, text }))
        .filter(e => re.test(e.text));
}

// Field values of an example, excluding the leading ACTION name.
function fieldsOf(example) {
    return example.text.split('|').slice(1);
}

describe('BET examples match the declared formats ', () => {

    test('all four formats are declared with the field order the spec pins', () => {
        assert.deepEqual(declaredFormat(0), [
            'VERSION', 'LABEL', 'OUTCOMES', 'TICK', 'FEE', 'DEADLINE',
            'REFUND_WINDOW', 'MIN_AMOUNT', 'ALLOW_LIST', 'BLOCK_LIST', 'DETAILS', 'MEMO'
        ]);
        assert.deepEqual(declaredFormat(1), ['VERSION', 'FEED_ACTION_INDEX', 'MEMO']);
        assert.deepEqual(declaredFormat(2), ['VERSION', 'FEED_ACTION_INDEX', 'OUTCOME', 'AMOUNT', 'MEMO']);
        assert.deepEqual(declaredFormat(3), ['VERSION', 'FEED_ACTION_INDEX', 'OUTCOME', 'MEMO']);
    });

    test('no example carries more fields than its format declares', () => {
        const over = [];
        for (const version of [0, 1, 2, 3]) {
            const declared = declaredFormat(version).length;
            for (const e of examples(version)) {
                const count = fieldsOf(e).length;
                if (count > declared)
                    over.push(`  line ${e.line}: ${count} fields, v${version} declares ${declared}\n    ${e.text}`);
            }
        }
        assert.equal(over.length, 0,
            'a BET example has more fields than its format. A field was probably ' +
            'inserted into the format without updating the examples, which shifts ' +
            'every value after it into the wrong slot:\n' + over.join('\n'));
    });

    test('no example line has trailing whitespace', () => {
        const dirty = [0, 1, 2, 3]
            .flatMap(v => examples(v))
            .filter(e => /\s$/.test(e.text))
            .map(e => `  line ${e.line}: ${JSON.stringify(e.text)}`);
        assert.equal(dirty.length, 0,
            'trailing whitespace lands as a real value in the last populated field:\n' + dirty.join('\n'));
    });

    test('every example is present and lands its distinguishing values in the right slots', () => {
        const v0 = examples(0);
        assert.equal(v0.length, 3, 'expected the three v0 examples to still be present');

        // Minimal market: everything after DEADLINE empty except the MEMO. This is
        // the example that was authored one separator short, putting the memo prose
        // into DETAILS, so its MEMO slot is the specific thing worth pinning.
        const minimal = v0.find(e => /Superbowl LX winner/.test(e.text));
        assert.ok(minimal, 'the minimal-market v0 example must exist');
        const mf = fieldsOf(minimal);
        assert.equal(mf[2], 'Chiefs,49ers', 'OUTCOMES');
        assert.equal(mf[4], '1.00',         'FEE is a percent, two decimals');
        assert.equal(mf[10], '',            'DETAILS must be empty, not the memo prose');
        assert.equal(mf[11], 'Bet on the big game', 'MEMO');

        // Full market: the only example populating DETAILS, and the reference for
        // "DETAILS is strict base64 of a JSON object".
        const full = v0.find(e => /BTC above 150k/.test(e.text));
        assert.ok(full, 'the full-market v0 example must exist');
        const ff = fieldsOf(full);
        assert.equal(ff.length, 12, 'the full example spells the format out to the end');
        assert.equal(ff[6], '604800',      'REFUND_WINDOW in seconds');
        assert.equal(ff[7], '10.00000000', 'MIN_AMOUNT at the tick decimals');
        assert.match(ff[10], /^[A-Za-z0-9+/]+=*$/, 'DETAILS is strict base64');
        const decoded = JSON.parse(Buffer.from(ff[10], 'base64').toString('utf8'));
        assert.equal(typeof decoded, 'object', 'DETAILS decodes to a JSON object');
        assert.ok(!Array.isArray(decoded),     'DETAILS must be an object, not an array');

        // Gated market: ALLOW_LIST populated, BLOCK_LIST left off the end.
        const gated = v0.find(e => /Club championship/.test(e.text));
        assert.ok(gated, 'the gated-market v0 example must exist');
        const gf = fieldsOf(gated);
        assert.equal(gf[4], '',     'FEE empty means no oracle cut');
        assert.equal(gf[8], '4321', 'ALLOW_LIST holds the LIST action index');
        assert.equal(gf.length, 9,  'the gated example stops after ALLOW_LIST');

        // The three lifecycle examples. OUTCOME is a zero-based index in both v2
        // and v3, and it sits in the SAME slot in both, which is exactly the pair
        // a mid-format insertion would desynchronize.
        const place = examples(2)[0];
        assert.ok(place, 'the place-bet v2 example must exist');
        assert.equal(fieldsOf(place)[1], '1234',        'FEED_ACTION_INDEX');
        assert.equal(fieldsOf(place)[2], '0',           'OUTCOME is a zero-based index');
        assert.equal(fieldsOf(place)[3], '25.00000000', 'AMOUNT at the tick decimals');

        const resolve = examples(3)[0];
        assert.ok(resolve, 'the resolve v3 example must exist');
        assert.equal(fieldsOf(resolve)[1], '1234', 'FEED_ACTION_INDEX');
        assert.equal(fieldsOf(resolve)[2], '1',    'OUTCOME is a zero-based index');

        const cancel = examples(1)[0];
        assert.ok(cancel, 'the cancel v1 example must exist');
        assert.equal(fieldsOf(cancel)[1], '1234', 'FEED_ACTION_INDEX');
    });

    test('the documented DETAILS cap is one the wire can actually carry', () => {
        // The spec's first value (8192 DECODED bytes) was un-broadcastable: DETAILS
        // is base64 on the wire (+33%) and shares ONE 8192-byte compiled ACTION
        // ceiling with LABEL/OUTCOMES/TICK/MEMO, so a max-size market was ~12.8KB.
        // Pin the doc's number against the same arithmetic the decoder vector uses,
        // so raising it here fails immediately instead of at broadcast time.
        const { MAX_ACTION_DATA_LENGTH, OP_RETURN_PUSH_OVERHEAD } = require('../protocol/constants.js');

        const cap = src.match(/At most (\d+) bytes once decoded/);
        assert.ok(cap, 'bet.md must state the decoded DETAILS cap');
        const decoded = Number(cap[1]);

        const base64 = Math.ceil(decoded / 3) * 4;
        // Worst-case non-DETAILS create: name + 12 pipes + VERSION + 250 LABEL +
        // 16x64 OUTCOMES with commas + 250 TICK + "10.00" + DEADLINE + REFUND_WINDOW
        // + MIN_AMOUNT at 18 decimals + two action indexes + 250 MEMO.
        const worstOther = 3 + 12 + 1 + 250 + (16 * 64 + 15) + 250 + 5 + 10 + 8 + 40 + 12 + 12 + 250;
        const total = worstOther + base64 + OP_RETURN_PUSH_OVERHEAD;

        assert.ok(total <= MAX_ACTION_DATA_LENGTH,
            `a worst-case BET create with a ${decoded}-byte DETAILS compiles to ${total} bytes, ` +
            `over the ${MAX_ACTION_DATA_LENGTH}-byte ACTION cap. bet.md would be documenting a ` +
            'market definition size that cannot be broadcast.');
    });

    test('the worked settlement example still balances (shared vector with the e2e suite)', () => {
        // The doc's payout table is the same vector P6 asserts on regtest. If an
        // edit changes a number here, conservation breaks and the two drift apart
        // silently, so recompute it from the doc's own inputs.
        const T = 17.5, W = 12.5, feePct = 1;
        const fee = Math.floor(T * feePct / 100 * 1e8) / 1e8;
        const pot = T - fee;
        const a   = Math.floor(10  * pot / W * 1e8) / 1e8;
        const c   = Math.floor(2.5 * pot / W * 1e8) / 1e8;

        assert.equal(fee, 0.175);
        assert.equal(pot, 17.325);
        assert.equal(a, 13.86);
        assert.equal(c, 3.465);
        assert.equal(Number((a + c + fee).toFixed(8)), T, 'payouts + fee + dust must equal the total staked');

        for (const literal of ['0.17500000', '17.32500000', '13.86000000', '3.46500000'])
            assert.ok(src.includes(literal), `the worked example must still show ${literal}`);
    });
});
