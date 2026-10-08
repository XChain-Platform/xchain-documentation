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
 * Token Information Standard: field table vs published JSON Schema.
 *
 * WHY. The TIS prose grew the token-gating fields (`packs`, `title`,
 * `data_ref`, `locked`, `pack_id`) as the explorer and indexer started using
 * them, and the published schema never did. They validated anyway, because the
 * media definitions do not set `additionalProperties: false`, so they passed by
 * omission rather than by contract and a strict validator or a code generator
 * dropped them. The `website` bound drifted the same silent way: 100 in the
 * prose, 255 in the schema, with nothing comparing the two.
 *
 * WHAT IT CHECKS.
 *
 *   1. Every row of the two TIS field tables is declared in the CURRENT schema
 *      (top-level rows as top-level properties; file-entry rows in all four of
 *      the images/audio/video/files definitions, or only in the one a leading
 *      `*(images only)*` marker names), and every property the schema declares
 *      has a row, so a field cannot drift out of the tables in either direction.
 *   2. Every character bound the prose states equals the schema's maxLength.
 *   3. The worked example parses and uses no key the schema does not declare.
 *   4. v1.0.0 and v1.1.0 stay frozen: each still stamped with its own version,
 *      v1.0.0 still without the gating fields and v1.1.0 still carrying the
 *      `["type", "data"]` media requirement v1.1.1 relaxed, so drift is never
 *      "fixed" by rewriting a published version. v1.1.1 stays frozen the same
 *      way, still carrying the `dns` conditional v1.1.2 restates.
 *   5. A media entry carrying only `data_ref` satisfies the CURRENT schema's
 *      media requirement, and an entry carrying neither `data` nor `data_ref`
 *      still fails it. The pair runs the requirement rather than asserting it:
 *      v1.1.0 required `data` outright and so rejected the fully on-chain form
 *      the prose recommends, and a one-sided check would have passed on the
 *      relaxed schema and on a schema that required nothing at all.
 *   6. The CURRENT schema uses no keyword newer than the draft-04 it declares,
 *      and its `dns` rule runs: v1.0.0 through v1.1.1 wrote that rule with
 *      if/then/else and const, which a draft-04 validator skips, so no `dns`
 *      entry was ever checked by a validator that honored the declaration.
 *
 * FLOORS, BECAUSE A PARSER THAT MATCHES NOTHING READS AS GREEN. A markdown
 * table lint that silently stops matching passes forever. The row floors below
 * fail with "the table format changed" rather than reporting full coverage of
 * an empty set, and the parser and comparators are exercised on fixtures so a
 * refactor that breaks them is caught here rather than by their silence.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, '..');
const SPEC     = path.join(DOC_ROOT, 'protocol/token-information-standard.md');
const JSON_DIR = path.join(DOC_ROOT, 'protocol/json');

const CURRENT = '1.1.2';
const MEDIA   = ['images', 'audio', 'video', 'files'];

// A row is `| field | Type | Description`. The header and the `| :--- |`
// separator are not rows; neither is anything outside the named section.
function fieldRows(markdown, heading) {
    const lines = markdown.split('\n');
    const start = lines.findIndex((l) => l.trim() === heading);
    if (start === -1) return [];
    const rows = [];
    let seenTable = false;
    for (const line of lines.slice(start + 1)) {
        if (/^#{1,6}\s/.test(line)) break;
        if (!line.startsWith('|')) { if (seenTable) break; continue; }
        seenTable = true;
        const cells = line.split('|').slice(1).map((c) => c.trim());
        const name  = cells[0];
        if (!name || /^:?-{3,}/.test(name) || name === 'Field') continue;
        rows.push({ name, type: cells[1] || '', description: cells.slice(2).join('|').trim() });
    }
    return rows;
}

// "2048 characters max." in the prose is a claim about the schema's maxLength.
function statedBound(description) {
    const m = /(\d+)\s+characters max/i.exec(description);
    return m ? Number(m[1]) : null;
}

// A leading `*(images only)*` narrows a file-entry row to that one media
// definition; an unmarked row applies to all four.
function rowScope(row) {
    const m = /^\*\((\w+) only\)\*/.exec(row.description);
    return m ? [m[1]] : MEDIA;
}

function readJson(name) {
    return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8'));
}

// Keywords a draft-04 validator does not know and so skips without complaint.
const POST_DRAFT_04 = new Set(['if', 'then', 'else', 'const', 'contains', 'propertyNames',
    'examples', '$comment', '$id', '$defs', 'dependentRequired', 'dependentSchemas',
    'unevaluatedProperties', 'unevaluatedItems', 'prefixItems', 'minContains', 'maxContains',
    'readOnly', 'writeOnly', 'contentMediaType', 'contentEncoding']);

// Collect every post-draft-04 keyword path; the keys of a name map are names, not keywords.
function newerKeywords(node, at = '', found = []) {
    if (!node || typeof node !== 'object') return found;
    for (const [key, value] of Object.entries(node)) {
        if (Array.isArray(node) || !POST_DRAFT_04.has(key)) {
            const names = !Array.isArray(node) && (key === 'properties' || key === 'definitions');
            const kids = names && value && typeof value === 'object' ? Object.entries(value) : [[key, value]];
            for (const [k, v] of kids) newerKeywords(v, `${at}/${names ? key + '/' : ''}${k}`, found);
        } else found.push(`${at}/${key}`);
    }
    return found;
}

// Run a `dns` definition the way a draft-04 validator does: `required`, then `anyOf`
// branches of `required` plus an enum or not-enum on `type`. Anything else is skipped.
function dnsAccepts(def, entry) {
    const has = (names) => (names || []).every((n) => n in entry);
    const typeOk = (rule) => !rule || (rule.enum ? rule.enum.includes(entry.type)
        : !(rule.not && rule.not.enum && rule.not.enum.includes(entry.type)));
    if (!has(def.required)) return false;
    if (!Array.isArray(def.anyOf)) return true;
    return def.anyOf.some((b) => has(b.required) && typeOk((b.properties || {}).type));
}

const SPEC_TEXT  = fs.readFileSync(SPEC, 'utf8');
const TOP_ROWS   = fieldRows(SPEC_TEXT, '#### JSON Field Definitions');
const ENTRY_ROWS = fieldRows(SPEC_TEXT, '#### File Entry Fields');

const schema  = readJson(`token-information-standard-v${CURRENT}-schema.json`);
const example = readJson(`token-information-standard-v${CURRENT}-example.json`);

describe('TIS field table / schema coverage', () => {

    // Fixtures, not the real page. A parser that returned [] and a bound
    // reader that returned null would leave every assertion below vacuously
    // true, and neither failure is visible from a green run over real files.
    test('the table parser and the bound reader can both say no', () => {
        const sample = [
            '#### JSON Field Definitions',
            '',
            '| Field       | Type   | Description',
            '| :---        | :---   | :---',
            '| tick        | String | The TICK of the token',
            '| website     | String | A link. 255 characters max.',
            '',
            '#### File Entry Fields',
            '',
            '| Field    | Type   | Description',
            '| :---     | :---   | :---',
            '| data_ref | String | *(since v1.1.0)* A ref. See [`FILE`](./actions/file.md).',
            '',
        ].join('\n');

        assert.deepEqual(fieldRows(sample, '#### JSON Field Definitions').map((r) => r.name),
            ['tick', 'website'], 'the header and the :--- separator are not field rows');
        assert.deepEqual(fieldRows(sample, '#### File Entry Fields').map((r) => r.name),
            ['data_ref'], 'a second table must not bleed into the first');
        assert.deepEqual(fieldRows(sample, '#### No Such Heading'), [],
            'a renamed heading yields nothing, which is what the floors below catch');

        assert.equal(statedBound('A link. 255 characters max.'), 255);
        assert.equal(statedBound('A link. 100 characters max.'), 100);
        assert.equal(statedBound('The TICK of the token'), null);

        const [scoped, plain, since] = fieldRows([
            '#### Scope',
            '',
            '| Field | Type   | Description',
            '| :---  | :---   | :---',
            '| size  | String | *(images only)* Pixels.',
            '| hash  | String | A hash.',
            '| title | String | *(since v1.1.0)* A title.',
            '',
        ].join('\n'), '#### Scope');
        assert.deepEqual(rowScope(scoped), ['images'], 'the images-only marker was not read');
        assert.deepEqual(rowScope(plain), MEDIA, 'an unmarked row covers all four arrays');
        assert.deepEqual(rowScope(since), MEDIA, 'a since-version marker is not a scope');
    });

    test('both field tables were actually read', () => {
        assert.ok(TOP_ROWS.length >= 12,
            `only ${TOP_ROWS.length} top-level field rows parsed out of ` +
            'protocol/token-information-standard.md; the table format changed and this gate ' +
            'is no longer reading it');
        assert.ok(ENTRY_ROWS.length >= 9,
            `only ${ENTRY_ROWS.length} file-entry field rows parsed; the table format changed`);
    });

    test(`every documented top-level field is declared in the v${CURRENT} schema`, () => {
        const undeclared = TOP_ROWS.map((r) => r.name).filter((n) => !(n in schema.properties));
        assert.deepEqual(undeclared, [],
            'field-table rows with no property in ' +
            `token-information-standard-v${CURRENT}-schema.json. A field that only the prose ` +
            'declares validates by omission, and a code generator drops it:\n  ' +
            undeclared.join('\n  '));
    });

    test('every documented file-entry field is declared in each media definition its row covers', () => {
        const undeclared = [];
        for (const row of ENTRY_ROWS) {
            const scope = rowScope(row);
            for (const def of MEDIA) {
                const declared = row.name in schema.definitions[def].properties;
                if (scope.includes(def) && !declared) undeclared.push(`${def}.${row.name}`);
                if (!scope.includes(def) && declared)
                    undeclared.push(`${def}.${row.name} is declared, but the row is marked ${scope} only`);
            }
            for (const def of scope)
                if (!MEDIA.includes(def)) undeclared.push(`${row.name}: scope "${def}" is no media array`);
        }
        assert.deepEqual(undeclared, [],
            'an unmarked file-entry row applies to files, audio, video and images alike, and a ' +
            'marked one to its named array alone, so a mismatch is a contract that differs by ' +
            'array:\n  ' + undeclared.join('\n  '));
    });

    test(`every v${CURRENT} top-level property has a row in the field table`, () => {
        const documented = new Set(TOP_ROWS.map((r) => r.name));
        const missing = Object.keys(schema.properties).filter((n) => !documented.has(n));
        assert.deepEqual(missing, [],
            'schema properties an implementer reading the field table never sees:\n  ' +
            missing.join('\n  '));
    });

    test(`every v${CURRENT} media property has a file-entry row covering its array`, () => {
        const missing = [];
        for (const def of MEDIA)
            for (const name of Object.keys(schema.definitions[def].properties))
                if (!ENTRY_ROWS.some((r) => r.name === name && rowScope(r).includes(def)))
                    missing.push(`${def}.${name}`);
        assert.deepEqual(missing, [],
            'media-entry properties the schema declares and the file-entry table omits, so a ' +
            'third party implementing from the table neither emits nor reads them:\n  ' +
            missing.join('\n  '));
    });

    test('every character bound the prose states matches the schema maxLength', () => {
        const drifted = [];
        for (const row of TOP_ROWS) {
            const stated = statedBound(row.description);
            if (stated === null) continue;
            const declared = (schema.properties[row.name] || {}).maxLength;
            if (declared !== stated)
                drifted.push(`${row.name}: prose says ${stated}, schema says ${declared}`);
        }
        for (const row of ENTRY_ROWS) {
            const stated = statedBound(row.description);
            if (stated === null) continue;
            for (const def of rowScope(row)) {
                const declared = ((schema.definitions[def] || {}).properties || {})[row.name];
                if ((declared || {}).maxLength !== stated)
                    drifted.push(`${def}.${row.name}: prose says ${stated}, schema says ${(declared || {}).maxLength}`);
            }
        }
        assert.deepEqual(drifted, [],
            'a publisher truncating to the documented bound and a validator enforcing the ' +
            'schema disagree about what is valid:\n  ' + drifted.join('\n  '));
    });

    test('the worked example uses no key the schema does not declare', () => {
        const unknown = Object.keys(example).filter((k) => !(k in schema.properties));
        assert.deepEqual(unknown, [], 'top-level keys in the example that the schema omits');

        const perEntry = [];
        for (const def of MEDIA) {
            const props = schema.definitions[def].properties;
            for (const entry of example[def] || [])
                for (const k of Object.keys(entry))
                    if (!(k in props)) perEntry.push(`${def}[].${k}`);
        }
        assert.deepEqual(perEntry, [], 'entry keys in the example that the schema omits');

        // The example has to exercise the gating fields, or it documents them
        // by describing them and by showing nothing.
        const entries = MEDIA.flatMap((def) => example[def] || []);
        for (const field of ['title', 'data_ref', 'locked', 'pack_id'])
            assert.ok(entries.some((e) => field in e),
                `no entry in the v${CURRENT} example uses ${field}`);
        assert.ok(example.packs && Object.keys(example.packs).length > 0,
            `the v${CURRENT} example declares no packs map`);
        for (const entry of entries)
            if (entry.pack_id)
                assert.ok(entry.pack_id in example.packs,
                    `example pack_id "${entry.pack_id}" keys into no packs entry`);
    });

    test('v1.0.0 stays frozen at what it published', () => {
        const published = readJson('token-information-standard-v1.0.0-schema.json');
        assert.equal(published.version, '1.0.0');
        assert.equal('packs' in published.properties, false,
            'the gating fields postdate v1.0.0; declaring them there rewrites a published ' +
            'contract instead of superseding it');
        for (const def of MEDIA)
            for (const field of ['title', 'data_ref', 'locked', 'pack_id'])
                assert.equal(field in published.definitions[def].properties, false,
                    `v1.0.0 ${def}.${field} appeared; publish v${CURRENT} instead`);
    });

    test('v1.1.0 stays frozen at what it published', () => {
        const published = readJson('token-information-standard-v1.1.0-schema.json');
        assert.equal(published.version, '1.1.0');
        for (const def of MEDIA)
            assert.deepEqual(published.definitions[def].required, ['type', 'data'],
                `v1.1.0 ${def}.required moved; a published version is superseded, never edited`);
    });

    test('the v1.0.0 compatibility prose keeps the caveat the open v1.0.0 objects force', () => {
        // Source half: v1.0.0 leaves the root and media objects open, so an extra named
        // like a gating field takes any type there, while v1.1.x declares a type for it.
        const v100 = readJson('token-information-standard-v1.0.0-schema.json');
        const open = [v100, ...MEDIA.map((def) => v100.definitions[def])]
            .every((o) => o.additionalProperties === undefined || o.additionalProperties === true);
        const typed = MEDIA.every((def) => schema.definitions[def].properties.locked.type === 'boolean')
            && schema.properties.packs.type === 'object';
        assert.ok(open, 'v1.0.0 closes its root or media objects, so the compatibility caveat below is no longer true');
        assert.ok(typed, 'v1.1.x no longer types locked/packs, so the compatibility caveat below is no longer true');
        const readme = fs.readFileSync(path.join(JSON_DIR, 'README.md'), 'utf8');
        for (const [label, text] of [['token-information-standard.md', SPEC_TEXT], ['json/README.md', readme]]) {
            const flat = text.replace(/\s+/g, ' ');
            for (const claim of ['forbids nothing v1.0.0 allowed', 'every v1.1.0 and v1.0.0 document',
                                 'so every v1.0.0 document is a valid v1.1.0 document'])
                assert.ok(!flat.includes(claim),
                    `${label} again says "${claim}"; a v1.0.0 document with "locked": "yes" is valid there and rejected by v1.1.x`);
            assert.match(flat, /type or length/, `${label} no longer states which v1.0.0 documents v1.1.x rejects`);
        }
    });

    test('a data_ref-only media entry satisfies the current schema, and an entry with neither does not', () => {
        // Runs the requirement the way a validator does: every name in `required`
        // must be present, and when the definition carries an `anyOf` of required
        // clauses at least one branch must also be satisfied.
        const satisfies = (def, entry) => {
            for (const name of def.required || [])
                if (!(name in entry)) return false;
            if (!Array.isArray(def.anyOf)) return true;
            return def.anyOf.some((branch) =>
                (branch.required || []).every((name) => name in entry));
        };

        const frozen = readJson('token-information-standard-v1.1.0-schema.json');
        for (const name of MEDIA) {
            const def  = schema.definitions[name];
            const type = (def.properties.type.enum || ['other'])[0];

            assert.equal(satisfies(def, { type, data_ref: 'action:12345' }), true,
                `v${CURRENT} ${name} rejects a data_ref-only entry, which is the fully ` +
                'on-chain form this standard recommends');
            assert.equal(satisfies(def, { type, data: 'https://domain.com/f' }), true,
                `v${CURRENT} ${name} rejects a data-only entry, which every published ` +
                'document uses');
            assert.equal(satisfies(def, { type }), false,
                `v${CURRENT} ${name} accepts an entry carrying neither data nor data_ref, ` +
                'so the requirement is gone rather than relaxed');
            assert.equal(satisfies(def, { data_ref: 'action:12345' }), false,
                `v${CURRENT} ${name} accepts an entry with no type`);

            // The negative control for the checker itself: the same data_ref-only
            // entry must still fail against the frozen v1.1.0 definition, which is
            // the defect v1.1.1 exists to fix.
            assert.equal(satisfies(frozen.definitions[name], { type, data_ref: 'action:12345' }), false,
                `v1.1.0 ${name} accepts a data_ref-only entry, so this checker cannot ` +
                'tell the relaxed schema from the frozen one');
        }
    });

    test('v1.1.1 stays frozen at what it published', () => {
        const published = readJson('token-information-standard-v1.1.1-schema.json');
        assert.equal(published.version, '1.1.1');
        for (const key of ['if', 'then', 'else'])
            assert.ok(key in published.definitions.dns,
                `v1.1.1 dns.${key} moved; a published version is superseded, never edited`);
        for (const def of MEDIA)
            assert.ok(Array.isArray(published.definitions[def].anyOf),
                `v1.1.1 ${def}.anyOf moved; the data/data_ref relaxation is what it published`);
    });

    test('the current schema uses no keyword newer than its declared draft-04', () => {
        assert.deepEqual(newerKeywords({ properties: { if: { if: {} } } }), ['/properties/if/if'],
            'the walker must flag a keyword and pass over a property that merely shares its name');
        assert.ok(newerKeywords(readJson('token-information-standard-v1.1.1-schema.json'))
            .includes('/definitions/dns/if'), 'the walker no longer sees the frozen v1.1.1 conditional');
        assert.match(schema.$schema, /draft-04/, `v${CURRENT} no longer declares draft-04`);
        assert.deepEqual(newerKeywords(schema), [],
            'a draft-04 validator skips these keywords, so the rules they carry are never enforced');
    });

    test('the current dns rule requires type, host and value, and priority on MX', () => {
        const dns = schema.definitions.dns;
        for (const entry of example.dns || [])
            assert.equal(dnsAccepts(dns, entry), true, `the v${CURRENT} example dns entry ${entry.type} fails`);
        assert.ok((example.dns || []).some((e) => e.type === 'MX'), 'the example no longer exercises MX');
        const bad = [{ type: 'MX', host: '@', value: 'mx.example.com' }, { type: 'A', value: '1.2.3.4' },
            { type: 'A', host: '@' }, { host: '@', value: 'x' }];
        for (const entry of bad)
            assert.equal(dnsAccepts(dns, entry), false, `v${CURRENT} dns accepts ${JSON.stringify(entry)}`);
        assert.equal(dnsAccepts(dns, { type: 'A', host: '@', value: '1.2.3.4' }), true);
        // Negative control: the frozen draft-07 conditional is invisible to this reading.
        const frozen = readJson('token-information-standard-v1.1.1-schema.json').definitions.dns;
        assert.equal(dnsAccepts(frozen, bad[0]), true,
            'the checker cannot tell the frozen v1.1.1 dns rule from the current one');
    });

    test(`the current schema and example are stamped v${CURRENT}`, () => {
        assert.equal(schema.version, CURRENT);
        assert.ok(SPEC_TEXT.includes(`token-information-standard-v${CURRENT}-schema.json`),
            'the spec page must link the current schema, or readers land on the frozen one');
    });
});
