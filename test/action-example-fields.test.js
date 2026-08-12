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
 * Action wire-format example lint.
 *
 * WHY. Five of the seven DISPENSER v0 examples had drifted one field
 * short. They predated the GIVE_OWNERSHIP insertion at position 5, so every field
 * from GIVE_ESCROW rightwards was shifted by one. Both FIAT examples were among
 * them, so a reader copying the canonical "price a dispenser in USD" example
 * encoded GIVE_ESCROW=BTC, GET_AMOUNT=<address> and FIAT_CODE=0.05 and got a
 * confusing rejection from the indexer. The class is silent (the docs render
 * fine) and it hands readers malformed transactions, so it is worth a gate.
 *
 * FOUR TIERS, because one rule does not fit every action.
 *
 * A first cut asserted "every example carries the field count its format
 * declares" across all 36 action docs and failed 17 of them, none of it this
 * defect. Working out why produced the arity rules below.
 *
 *   - Trailing fields are omittable. ISSUE v0 declares 25 and its examples
 *     correctly show 2 to 10, so a SHORT example is normal, not drift. That
 *     kills an exact-count rule in general.
 *   - Some formats end in a REST field: `...CONSTRUCTOR_PARAMS` (DEPLOY v0/v2),
 *     `...PARAMS` (EXECUTE), `...ITEM` (LIST). Those legitimately exceed their
 *     declared count. DEPLOY is precise about it: v0/v2 take CONSTRUCTOR_PARAMS
 *     as a rest field while v1/v3 do not, because COOLDOWN_BLOCKS +
 *     SLASH_DESTINATION trail the constructor args, and the doc marks exactly
 *     v0/v2 (matching deploy.js).
 *   - Some formats end in a bare `...` meaning "the preceding group repeats"
 *     (ANCHOR/ATTEST signature pairs, PRICE pair lists). Also unbounded.
 *   - BATCH is not pipe-counted at all: `VERSION|COMMAND;COMMAND` embeds whole
 *     actions whose own params use `|`, so the delimiter is nested.
 *
 * TIER 1, notation. One rest-field notation, the leading `...FIELD`. Both
 * positions were in use (`PARAMS...` and `...CONSTRUCTOR_PARAMS`) and the lint
 * used to accept either, which left the reader guessing whether the two meant
 * different things. The prefix form wins because it is the one the code already
 * runs on: xchain-sdk `formatSelector.js` sets `REST_PREFIX = '...'` and its
 * format table writes `VERSION|TYPE|...ITEM`, so a doc format string is now
 * character-identical to the SDK's. `protocol/actions/README.md` documents the
 * three legal markers; this tier keeps new docs on them.
 *
 * TIER 2, coverage. The general check used to recognise exactly one way of
 * writing a format line (a `- \`VERSION|...\`` bullet), so it silently covered
 * NOTHING in ANCHOR, ATTEST, COLLECT, PRICE and VOTE, which write theirs as
 * `- \`ATTEST|1|...\`` or inside a fenced block. A lint that skips a fifth of the
 * corpus without saying so is worse than no lint, so the parser now reads all
 * three dialects and this tier asserts the result: every action doc declares at
 * least one format, and every example belongs to a version that has one.
 *
 * TIER 3, upper bound. The one invariant that holds everywhere: a format with no
 * rest field and no repeat marker is an UPPER BOUND. An example may omit trailing
 * fields but may never carry more than the format declares. That catches a field
 * added to an example without being added to the format, or a format that lost
 * one.
 *
 * TIER 4, DISPENSER exact count, stricter because that doc supports it: every v0
 * example there spells the format out to its end, trailing empties included, so
 * an exact count is a real contract and mid-format insertions like the
 * GIVE_OWNERSHIP drift are caught. The upper-bound tier alone would NOT have
 * caught that bug, since a short example passes it.
 *
 * The sweep also found the one genuine notation gap it was looking for: LIST
 * v0/v1 take a repeatable ITEM (list.js loops params[idx] for idx > 1 and > 2)
 * but declared no rest marker, so list.md now writes `...ITEM`.
 *
 * The parser is exercised on synthetic docs at the bottom of this file, so its
 * sensitivity is proven on every run rather than by a one-off manual injection.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const ACTIONS_DIR  = path.resolve(__dirname, '../protocol/actions');
const SDK_ACTIONS  = path.resolve(__dirname, '../components/sdk/actions.md');
const DISPENSER_MD = path.join(ACTIONS_DIR, 'dispenser.md');
const src = fs.readFileSync(DISPENSER_MD, 'utf8');

// ---------------------------------------------------------------------------
// Shared parser
// ---------------------------------------------------------------------------

// The `## Formats` section only. Rules and Examples sections quote wire strings
// too, and picking one of those up as a declared format would compare an example
// against itself.
function formatsSection(doc) {
    const out = [];
    let inSection = false;
    for (const line of doc.split('\n')) {
        if (/^##\s+/.test(line) && !/^###/.test(line)) { inSection = /^##\s+Formats\b/.test(line); continue; }
        if (inSection) out.push(line);
    }
    return out;
}

// version -> declared format string, for the three dialects in use:
//   - `- \`VERSION|TICK|...\``       (most docs)
//   - `- \`ATTEST|1|REQUEST_ID|...\`` (ANCHOR, ATTEST, VOTE: action name + literal version)
//   - a fenced block holding the format line (PRICE)
function parseFormats(doc) {
    const formats = new Map();
    let version = null;
    let fenced  = false;
    for (const line of formatsSection(doc)) {
        if (/^```/.test(line)) { fenced = !fenced; continue; }
        const header = line.match(/^###\s+Version\s+`?(\d+)`?/);
        if (header) { version = header[1]; continue; }
        if (version === null) continue;

        const bullet = line.match(/^-\s+`([^`]+)`\s*$/);
        const candidate = bullet ? bullet[1] : (fenced ? line.trim() : null);
        if (!candidate || !candidate.includes('|')) continue;
        if (!/^[A-Z][A-Z0-9_]*\[?\|/.test(candidate)) continue;   // not a wire format line
        if (!formats.has(version)) formats.set(version, candidate);
    }
    return formats;
}

// Format string -> field tokens, counted the same way an example line is: the
// leading action name is not a field, `[...]` optional-tail brackets do not
// change the upper bound.
function fieldsOf(format, action) {
    const tokens = format.replace(/[[\]]/g, '').split('|');
    return (action && tokens[0] === action) ? tokens.slice(1) : tokens;
}

const REST_PREFIX  = '...';                                        // matches xchain-sdk formatSelector.js
const isRestField  = token => token.startsWith(REST_PREFIX) && token.length > REST_PREFIX.length;
const isRepeat     = token => token === REST_PREFIX;
const isUnbounded  = tokens => tokens.some(t => isRestField(t) || isRepeat(t));

function exampleLines(action, doc) {
    const re = new RegExp('^' + action + '\\|(\\d+)\\|');
    return doc.split('\n')
        .map((text, i) => ({ line: i + 1, text, version: (text.match(re) || [])[1] }))
        .filter(e => e.version !== undefined);
}

// The upper-bound rule, as a pure function so the synthetic-doc tests below
// exercise exactly the code the corpus runs through.
function upperBoundProblems(action, doc) {
    const formats = parseFormats(doc);
    const problems = [];
    for (const example of exampleLines(action, doc)) {
        const format = formats.get(example.version);
        if (!format) continue;                       // reported by the coverage tier
        if (/;/.test(format)) continue;              // nested delimiter (BATCH)
        const tokens = fieldsOf(format, action);
        if (isUnbounded(tokens)) continue;           // rest field or repeat marker
        const count = example.text.split('|').length - 1;
        if (count > tokens.length) {
            problems.push(`  line ${example.line}: v${example.version} example has ${count} fields, ` +
                          `format declares ${tokens.length} and has no rest field\n    ${example.text}`);
        }
    }
    return problems;
}

const actionDocs = fs.readdirSync(ACTIONS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(file => ({
        file,
        action: path.basename(file, '.md'),
        doc:    fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8')
    }));

assert.ok(actionDocs.length > 0, 'no action docs found');

// ---------------------------------------------------------------------------
// Tier 1: one rest-field notation across every declared format
// ---------------------------------------------------------------------------

// A field carrying an ellipsis anywhere other than as a leading `...` prefix, or
// as the standalone repeat marker, is off-convention. `FIELD...` is the notation
// this sweep removed; anything else with a stray ellipsis is equally unreadable.
function notationProblems(format, action) {
    return fieldsOf(format, action)
        .filter(t => t.includes(REST_PREFIX) && !isRestField(t) && !isRepeat(t))
        .map(t => `field \`${t}\` in \`${format}\``);
}

describe('declared formats use one rest-field notation', () => {

    for (const { file, action, doc } of actionDocs) {
        test(file, () => {
            const problems = [];
            for (const [version, format] of parseFormats(doc))
                for (const problem of notationProblems(format, action))
                    problems.push(`  v${version}: ${problem}`);
            assert.equal(problems.length, 0,
                `${file}: a rest field is written suffix-style. The canonical notation is the ` +
                `leading \`...FIELD\`, matching the SDK format table (formatSelector.js REST_PREFIX); ` +
                `a bare \`...\` means the preceding group repeats. See protocol/actions/README.md:\n` +
                problems.join('\n'));
        });
    }

    test('components/sdk/actions.md uses the same notation', () => {
        // The SDK reference restates every wire format, and carried the suffix
        // form for DEPLOY v0/v2 and EXECUTE v0 while the protocol docs carried
        // the prefix form. Two spellings of one concept in the two documents a
        // reader compares side by side is the whole point of this tier.
        const doc = fs.readFileSync(SDK_ACTIONS, 'utf8');
        const problems = [];
        doc.split('\n').forEach((line, i) => {
            const m = line.match(/^\*\*Format[^*]*\*\*\s*`([^`]+)`/);
            if (!m || !m[1].includes('|')) return;
            for (const problem of notationProblems(m[1], null))
                problems.push(`  line ${i + 1}: ${problem}`);
        });
        assert.equal(problems.length, 0,
            'components/sdk/actions.md: rest fields must be written `...FIELD`:\n' + problems.join('\n'));
    });
});

// ---------------------------------------------------------------------------
// Tier 2: the lint actually reaches every action
// ---------------------------------------------------------------------------

describe('every action doc declares a parseable format', () => {

    test('each doc has at least one declared format', () => {
        const missing = actionDocs
            .filter(({ doc }) => parseFormats(doc).size === 0)
            .map(({ file }) => `  ${file}`);
        assert.equal(missing.length, 0,
            'these docs declare no format the lint can parse, so every check below silently ' +
            'skips them. Either the `## Formats` section is missing, or its format lines are ' +
            'written in a dialect parseFormats() does not read yet:\n' + missing.join('\n'));
    });

    test('every example belongs to a version that declares a format', () => {
        const orphans = [];
        for (const { file, action, doc } of actionDocs) {
            const formats = parseFormats(doc);
            for (const example of exampleLines(action, doc))
                if (!formats.has(example.version))
                    orphans.push(`  ${file}:${example.line}: v${example.version} has no declared format\n    ${example.text}`);
        }
        assert.equal(orphans.length, 0,
            'an example demonstrates a version the Formats section never defines, so nothing ' +
            'checks its field layout:\n' + orphans.join('\n'));
    });
});

// ---------------------------------------------------------------------------
// Tier 3 (all actions): a bounded format is an upper bound on example fields.
// ---------------------------------------------------------------------------

describe('action examples never exceed their declared format', () => {

    for (const { file, action, doc } of actionDocs) {
        test(file, () => {
            const problems = upperBoundProblems(action, doc);
            assert.equal(problems.length, 0,
                `${file}: an example carries more fields than its format allows. Either the ` +
                `format gained a field the doc did not, or the tail is a rest field and the ` +
                `format should say so (\`...FIELD\`):\n` + problems.join('\n'));
        });
    }
});

// ---------------------------------------------------------------------------
// Tier 4: DISPENSER exact count
// ---------------------------------------------------------------------------

// Declared formats: `### Version `N` - Title` followed by `- `VERSION|...``.
function declaredFormat(version) {
    const format = parseFormats(src).get(String(version));
    return format ? format.split('|') : null;
}

function examples(version) {
    const re = new RegExp('^DISPENSER\\|' + version + '\\|');
    return src.split('\n')
        .map((text, i) => ({ line: i + 1, text }))
        .filter(e => re.test(e.text));
}

describe('DISPENSER v0 examples match the declared format', () => {

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
        // dispenser.md and price.md contradicted each other and the code:
        // dispenser.md said the first price for a feed took effect immediately
        // and only updates were delayed, while PriceAggregator.js applies a flat
        // +86400 to EVERY publish (verified live: three rows, first publishes
        // included, all delay_seconds = 86400). price.md already documented the
        // uniform rule and the consensus reason for it. Someone following the old
        // dispenser.md text would stand up an oracle-priced dispenser and watch
        // every dispense fail for a day with no explanation.
        const section = src.split('### Oracle Front-Running Protection')[1] || '';
        assert.ok(section, 'the front-running section must still exist');
        assert.ok(!/first[\s\S]{0,80}takes effect immediately/i.test(section),
            'dispenser.md must not claim the first oracle price is effective immediately');
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

// ---------------------------------------------------------------------------
// The lint's own sensitivity, on synthetic docs
// ---------------------------------------------------------------------------

// A lint whose parser quietly stops matching is indistinguishable from a clean
// corpus, which is exactly how the earlier version of this lint came to skip
// five docs. So prove on every run that each dialect parses and that a
// too-long example fails.
const doc = (formatLines, exampleLines = []) =>
    ['# Fake', '', '## Formats', '', ...formatLines, '', '## Examples', '```', ...exampleLines, '```', ''].join('\n');

describe('the lint itself catches a too-long example', () => {

    test('bullet dialect: `- `VERSION|...``', () => {
        const md = doc(['### Version `0`', '- `VERSION|TICK|AMOUNT|DESTINATION|MEMO`'],
                       ['SEND|0|PEPECASH|100|1Addr|memo|extra']);
        const problems = upperBoundProblems('SEND', md);
        assert.equal(problems.length, 1, 'a 6-field example against a 5-field format must fail');
        assert.match(problems[0], /has 6 fields, format declares 5/);
    });

    test('action-name dialect: `- `ATTEST|1|...``', () => {
        const md = doc(['### Version `1`', '- `ATTEST|1|REQUEST_ID|PROVIDER_ID`'],
                       ['ATTEST|1|abc|http_get|surplus']);
        const problems = upperBoundProblems('ATTEST', md);
        assert.equal(problems.length, 1, 'the action-name dialect must be parsed, not skipped');
        assert.match(problems[0], /has 4 fields, format declares 3/);
    });

    test('fenced dialect: the format inside a code block', () => {
        const md = doc(['### Version `0`', '```', 'VERSION|ROUND|TIMESTAMP', '```'],
                       ['PRICE|0|1402|1712500000|surplus']);
        const problems = upperBoundProblems('PRICE', md);
        assert.equal(problems.length, 1, 'the fenced dialect must be parsed, not skipped');
        assert.match(problems[0], /has 4 fields, format declares 3/);
    });

    test('legal shapes stay silent', () => {
        const shorter  = doc(['### Version `0`', '- `VERSION|TICK|AMOUNT|DESTINATION|MEMO`'], ['SEND|0|PEPECASH|100']);
        const rest     = doc(['### Version `0`', '- `VERSION|TYPE|...ITEM`'],                  ['LIST|0|1|A|B|C|D']);
        const repeat   = doc(['### Version `1`', '- `ATTEST|1|SIG_COUNT|PUBKEY1|SIG1|...`'],   ['ATTEST|1|2|p1|s1|p2|s2']);
        const optional = doc(['### Version `0`', '- `VERSION[|AMOUNT]`'],                      ['COLLECT|0|500']);
        const nested   = doc(['### Version `0`', '- `VERSION|COMMAND;COMMAND`'],               ['BATCH|0|SEND|0|A|1|addr;MINT|0|A|5']);
        assert.deepEqual(upperBoundProblems('SEND',    shorter),  [], 'omitted trailing fields are legal');
        assert.deepEqual(upperBoundProblems('LIST',    rest),     [], 'a rest field is unbounded');
        assert.deepEqual(upperBoundProblems('ATTEST',  repeat),   [], 'a repeat marker is unbounded');
        assert.deepEqual(upperBoundProblems('COLLECT', optional), [], 'an optional bracketed tail is not an extra field');
        assert.deepEqual(upperBoundProblems('BATCH',   nested),   [], 'a nested-delimiter format is not pipe-counted');
    });

    test('only the Formats section declares formats', () => {
        // A wire string quoted under Rules or Examples must not be mistaken for a
        // declaration, or an example would be compared against itself.
        const md = ['# Fake', '', '## Formats', '', '### Version `0`', '- `VERSION|TICK|AMOUNT`', '',
                    '## Rules', '- `VERSION|TICK|AMOUNT|MEMO|EXTRA` is not a declaration', '',
                    '## Examples', '```', 'SEND|0|PEPECASH|100|memo', '```', ''].join('\n');
        const problems = upperBoundProblems('SEND', md);
        assert.equal(problems.length, 1, 'the Rules-section string must not widen the declared format');
    });

    test('the notation check flags a suffix rest field', () => {
        assert.deepEqual(notationProblems('VERSION|TYPE|...ITEM', 'LIST'), []);
        assert.deepEqual(notationProblems('VERSION|SIG_COUNT|PUBKEY1|SIG1|...', 'ATTEST'), []);
        const flagged = notationProblems('VERSION|TYPE|ITEM...', 'LIST');
        assert.equal(flagged.length, 1, 'the suffix form must be rejected');
        assert.match(flagged[0], /ITEM\.\.\./);
    });
});
