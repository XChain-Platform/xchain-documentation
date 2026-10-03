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
 ********************************************************************/

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const LIST = fs.readFileSync(path.join(ROOT, 'protocol', 'actions', 'list.md'), 'utf8');
const INDEX_REFS = fs.readFileSync(path.join(ROOT, 'protocol', 'index-id-references.md'), 'utf8');
const INDEX_REFS_FLAT = INDEX_REFS.replace(/\s+/g, ' ');

function declaredFormats(markdown) {
    const formats = new Map();
    let version = null;
    for (const line of markdown.split('\n')) {
        const heading = line.match(/^### Version `([0-9]+)`/);
        if (heading) {
            version = heading[1];
            continue;
        }
        const format = line.match(/^- `([^`]+)`$/);
        if (version !== null && format) {
            formats.set(version, format[1].split('|'));
            version = null;
        }
    }
    return formats;
}

function wireExamples(markdown) {
    return markdown.split('\n').filter((line) => /^LIST\|[0-9]+\|/.test(line));
}

function assertDeclaredArity(line, formats) {
    const fields = line.split('|');
    const version = fields[1];
    const declared = formats.get(version);
    assert.ok(declared, `${line}: version ${version} has no declared format`);
    const params = fields.slice(1);
    const rest = declared.at(-1).startsWith('...');
    if (rest) {
        assert.ok(
            params.length >= declared.length,
            `${line}: expected at least ${declared.length} fields, found ${params.length}`,
        );
    } else {
        assert.equal(
            params.length,
            declared.length,
            `${line}: expected ${declared.length} fields, found ${params.length}`,
        );
    }
}

test('LIST documents the sharing, transfer, union, and mirror wire names', () => {
    const required = [
        '`DESTINATION`',
        '3=UNION',
        '`VERSION|LIST_ACTION_INDEX|MEMO`',
        '`VERSION|LIST_ACTION_INDEX|DESTINATION|MEMO`',
        '`LIST_SHARE_ACTIVATION`',
        '`LIST_TRANSFER_ACTIVATION`',
        '`LIST_UNION_ACTIVATION`',
        '`LIST_ADDRESS_REF_ACTIVATION`',
        '`LIST_SHARE_CONSUMER_ACTIVATION`',
        '`LIST_SHARE_MAX_MEMBERS`',
        '`LIST_UNION_MAX_MEMBERS`',
        '`LIST_SHARED_EDIT_BASE`',
        '`LIST_SHARED_EDIT_PER_ITEM`',
        '`BRIDGE_<HOME>`',
    ];
    for (const name of required) {
        assert.ok(LIST.includes(name), `protocol/actions/list.md must name ${name}`);
    }
});

test('index ID references document both resolved LIST address fields and their gates', () => {
    const required = [
        '`LIST.ITEM`',
        '`LIST.DESTINATION`',
        '`LIST_ADDRESS_REF_ACTIVATION`',
        '`LIST_TRANSFER_ACTIVATION`',
        'block-stamped address set',
        'before the format check',
        'resolved before its address check',
    ];
    for (const name of required) {
        assert.ok(INDEX_REFS_FLAT.includes(name), `protocol/index-id-references.md must name ${name}`);
    }
});

test('new LIST examples parse at their declared arity', () => {
    const formats = declaredFormats(LIST);
    assert.deepEqual(formats.get('0'), ['VERSION', 'TYPE', 'MEMO', '...ITEM']);
    assert.deepEqual(formats.get('2'), ['VERSION', 'LIST_ACTION_INDEX', 'MEMO']);
    assert.deepEqual(formats.get('3'), ['VERSION', 'LIST_ACTION_INDEX', 'DESTINATION', 'MEMO']);
    assert.deepEqual(
        formats.get('4'),
        ['VERSION', 'TYPE', 'NAME', 'DESCRIPTION', 'MEMO', '...ITEM'],
    );
    assert.deepEqual(
        formats.get('5'),
        ['VERSION', 'LIST_ACTION_INDEX', 'NAME', 'DESCRIPTION', 'MEMO'],
    );

    const examples = wireExamples(LIST);
    const unions = examples.filter((line) => line.startsWith('LIST|0|3|'));
    const shares = examples.filter((line) => line.startsWith('LIST|2|'));
    const transfers = examples.filter((line) => line.startsWith('LIST|3|'));
    const metaCreates = examples.filter((line) => line.startsWith('LIST|4|'));
    const metaSets = examples.filter((line) => line.startsWith('LIST|5|'));

    assert.equal(unions.length, 1, 'expected one type 3 union create example');
    assert.equal(shares.length, 1, 'expected one format 2 SHARE example');
    assert.equal(transfers.length, 2, 'expected two format 3 TRANSFER examples');
    assert.equal(metaCreates.length, 2, 'expected two format 4 CREATE WITH META examples');
    assert.equal(metaSets.length, 2, 'expected two format 5 SET META examples');

    for (const line of [...unions, ...shares, ...transfers, ...metaCreates, ...metaSets]) {
        assertDeclaredArity(line, formats);
    }

    const destinations = transfers.map((line) => line.split('|')[3]);
    assert.ok(destinations.some((value) => /^\^[1-9][0-9]*$/.test(value)));
    assert.ok(destinations.some((value) => !value.startsWith('^')));
});

test('LIST example arity guard rejects malformed bounded and rest examples', () => {
    const formats = declaredFormats(LIST);
    assert.throws(
        () => assertDeclaredArity('LIST|2|1234|memo|extra', formats),
        /expected 3 fields, found 4/,
    );
    assert.throws(
        () => assertDeclaredArity('LIST|0|3|', formats),
        /expected at least 4 fields, found 3/,
    );
});
