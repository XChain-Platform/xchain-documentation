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
 * Explorer /status response-contract gate .
 *
 * WHY. The explorer's tip-age gate changed what `available` MEANS: it used to
 * be a static echo of the configured coin map and is now recomputed per
 * request, with every coin whose newest indexed block has aged out dropped
 * from it, plus two new fields (`stale`, `tip_age_seconds`). Both published
 * descriptions of the endpoint kept the old contract for the whole life of the
 * gate, and nothing went red: the explorer's OpenAPI asset is served static and
 * this page is prose, so neither had a producer to disagree with.
 *
 * WHAT IT CHECKS, against xchain-explorer's published OpenAPI asset:
 *
 *   1. The field table in components/explorer/api.md carries a row for every
 *      property the ExplorerStatus schema declares, so a new field cannot ship
 *      documented on one surface only.
 *   2. The page states the semantics a caller gets wrong by default: that
 *      `available` is filtered by staleness rather than fixed, and that a stale
 *      coin leaves `available` while staying in `supported`.
 *   3. The response example is a keyed map, not the array the page showed
 *      before, since a client written against the old example would index it
 *      wrongly.
 *
 * xchain-explorer is a sibling repo in the monorepo checkout, not a dependency
 * of xchain-documentation. When it is absent (docs repo cloned on its own) the
 * source-derived assertion skips and the prose assertions still run.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const API_DOC = path.resolve(__dirname, '../components/explorer/api.md');
const SCHEMA  = path.resolve(__dirname, '../../xchain-explorer/src/content/json/xchain-platform-api.json');

const doc         = fs.readFileSync(API_DOC, 'utf8');
const haveSchema  = fs.existsSync(SCHEMA);

// The "Get Status" section only: a field name mentioned under some other
// endpoint must not count as documented here.
function statusSection(markdown) {
    const start = markdown.indexOf('### Get Status');
    assert.notEqual(start, -1, 'components/explorer/api.md no longer has a "Get Status" section');
    const next = markdown.indexOf('\n### ', start + 1);
    return markdown.slice(start, next === -1 ? markdown.length : next);
}

// Field names from the leading `column` of each table row in the section.
function documentedFields(section) {
    const fields = new Set();
    for (const line of section.split('\n')) {
        const m = /^\|\s*`([a-z_]+)`\s*\|/.exec(line);
        if (m) fields.add(m[1]);
    }
    return fields;
}

describe('explorer /status contract in components/explorer/api.md', () => {
    const section = statusSection(doc);

    test('documents every field the published ExplorerStatus schema declares', { skip: !haveSchema && 'xchain-explorer not present in this checkout' }, () => {
        const spec     = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
        const declared = Object.keys(spec.components.schemas.ExplorerStatus.properties);
        const rows     = documentedFields(section);
        const missing  = declared.filter((f) => !rows.has(f));
        assert.deepEqual(missing, [],
            'the /status field table is missing a row for: ' + missing.join(', ') + ' ');
    });

    test('states that available is staleness-filtered, not a fixed config echo', () => {
        assert.match(section, /\bstale\b/,
            'the /status section never mentions staleness ');
        assert.match(section, /Computed per request/,
            'the `available` row no longer says the map is computed per request ');
    });

    test('states that a stale coin leaves available and stays supported', () => {
        assert.match(section, /leave `available` and stay in `supported`|absent from `available`, while still listed in `supported`/,
            'the page no longer states where a stale coin goes ');
    });

    test('names the threshold that decides staleness', () => {
        assert.match(section, /EXPLORER_TIP_MAX_AGE_S/,
            'the /status section no longer names the tip-age threshold variable ');
    });

    test('shows supported and available as keyed maps, not arrays', () => {
        assert.doesNotMatch(section, /"(supported|available)":\s*\[/,
            'the response example shows supported/available as arrays; they are coin-keyed maps ');
        assert.match(section, /"available":\s*\{/,
            'the response example no longer shows an `available` map');
    });
});
