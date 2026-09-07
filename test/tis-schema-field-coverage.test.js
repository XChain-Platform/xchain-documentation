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
 *      the images/audio/video/files definitions).
 *   2. Every character bound the prose states equals the schema's maxLength.
 *   3. The worked example parses and uses no key the schema does not declare.
 *   4. v1.0.0 stays frozen: still stamped 1.0.0 and still without the gating
 *      fields, so drift is never "fixed" by rewriting a published version.
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

const CURRENT = '1.1.0';
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

function readJson(name) {
    return JSON.parse(fs.readFileSync(path.join(JSON_DIR, name), 'utf8'));
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
    });

    test('both field tables were actually read', () => {
        assert.ok(TOP_ROWS.length >= 12,
            `only ${TOP_ROWS.length} top-level field rows parsed out of ` +
            'protocol/token-information-standard.md; the table format changed and this gate ' +
            'is no longer reading it');
        assert.ok(ENTRY_ROWS.length >= 5,
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

    test(`every documented file-entry field is declared in all four media definitions`, () => {
        const undeclared = [];
        for (const def of MEDIA) {
            const props = schema.definitions[def].properties;
            for (const row of ENTRY_ROWS)
                if (!(row.name in props)) undeclared.push(`${def}.${row.name}`);
        }
        assert.deepEqual(undeclared, [],
            'the file-entry table says it applies to files, audio, video and images alike, so a ' +
            'field missing from any one of them is a contract that differs by array:\n  ' +
            undeclared.join('\n  '));
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

    test(`the current schema and example are stamped v${CURRENT}`, () => {
        assert.equal(schema.version, CURRENT);
        assert.ok(SPEC_TEXT.includes(`token-information-standard-v${CURRENT}-schema.json`),
            'the spec page must link the current schema, or readers land on the frozen one');
    });
});
