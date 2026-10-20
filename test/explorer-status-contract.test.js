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
 * Explorer /status response-contract gate.
 *
 * WHY. `available` is recomputed per request, and whether a stale coin leaves
 * it depends on EXPLORER_STALE_FAIL_CLOSED: by default a stale coin stays
 * listed and is served with a freshness marker. The explorer's OpenAPI asset is
 * served static and this page is prose, so neither has a producer to disagree
 * with, and a wrong statement of that rule goes red nowhere else.
 *
 * WHAT IT CHECKS, against xchain-explorer's published OpenAPI asset and source:
 *
 *   1. The field table in components/explorer/api.md carries a row for every
 *      property the ExplorerStatus schema declares, so a new field cannot ship
 *      documented on one surface only.
 *   2. The page states the semantics a caller gets wrong by default: that a
 *      stale coin stays in `available` unless EXPLORER_STALE_FAIL_CLOSED=1, so
 *      `stale` rather than `available` is the freshness signal.
 *   3. The response example is a keyed map, not the array the page showed
 *      before, since a client written against the old example would index it
 *      wrongly.
 *   4. The hub consensus-hash comparison fields carry their three-state
 *      verdict and mismatch-detail semantics, including their advisory scope.
 *   5. The "Freshness marker" section names every XChain-* header and every
 *      body `freshness` key the explorer's send_response.js emits.
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
const { sibling } = require('./helpers/sibling_checkout.js');

const API_DOC = path.resolve(__dirname, '../components/explorer/api.md');
const SCHEMA  = path.resolve(__dirname, '../../xchain-explorer/src/content/json/xchain-platform-api.json');
const MARKER  = path.resolve(__dirname, '../../xchain-explorer/src/explorer/request/send_response.js');

const doc         = fs.readFileSync(API_DOC, 'utf8');
// Skips by name on a bare clone; throws under XCHAIN_REQUIRE_SIBLINGS=1 when the schema is unreadable.
const noSchema    = sibling('xchain-explorer', [SCHEMA]).skip;
const noMarker    = sibling('xchain-explorer', [MARKER]).skip;

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

    test('documents every field the published ExplorerStatus schema declares', { skip: noSchema }, () => {
        const spec     = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
        const declared = Object.keys(spec.components.schemas.ExplorerStatus.properties);
        const rows     = documentedFields(section);
        const missing  = declared.filter((f) => !rows.has(f));
        assert.deepEqual(missing, [],
            'the /status field table is missing a row for: ' + missing.join(', '));
    });

    test('states that available is staleness-filtered, not a fixed config echo', () => {
        assert.match(section, /\bstale\b/,
            'the /status section never mentions staleness');
        assert.match(section, /Computed per request/,
            'the `available` row no longer says the map is computed per request');
    });

    test('states that a stale coin stays in available unless fail-closed is set', () => {
        assert.match(section, /stays in `available`/,
            'the page no longer states that a stale coin stays listed by default');
        assert.match(section, /EXPLORER_STALE_FAIL_CLOSED=1/,
            'the page no longer names the opt-in that delists a stale coin');
        assert.doesNotMatch(section, /drops every coin the freshness gate marks|absent from `available`, while still listed/,
            'the page says a stale coin always leaves `available`, which is true only under EXPLORER_STALE_FAIL_CLOSED=1');
    });

    test('names the threshold that decides staleness', () => {
        assert.match(section, /EXPLORER_TIP_MAX_AGE_S/,
            'the /status section no longer names the tip-age threshold variable');
    });

    test('shows supported and available as keyed maps, not arrays', () => {
        assert.doesNotMatch(section, /"(supported|available)":\s*\[/,
            'the response example shows supported/available as arrays; they are coin-keyed maps');
        assert.match(section, /"available":\s*\{/,
            'the response example no longer shows an `available` map');
    });

    test('documents the hub consensus-hash comparison fields and their scope', () => {
        const fields = documentedFields(section);
        assert.equal(fields.has('hub_consensus_hash_mismatch'), true,
            'the field table omits hub_consensus_hash_mismatch');
        assert.equal(fields.has('hub_consensus_hash_mismatch_details'), true,
            'the field table omits hub_consensus_hash_mismatch_details');
        assert.match(section, /`true`, `false`, or `null`/,
            'the page does not state the mismatch verdict states');
        assert.match(section, /advisory/i,
            'the page does not state that the mismatch signal is advisory');
        assert.match(section, /never applied/i,
            'the page does not state that hub-served consensus values are never applied');
        assert.match(section, /TICK\/network/,
            'the page does not describe the mismatch detail identifier');
    });
});

// The "Freshness marker" subsection only, up to the next heading of any level.
function markerSection(markdown) {
    const start = markdown.indexOf('### Freshness marker');
    assert.notEqual(start, -1, 'components/explorer/api.md no longer has a "Freshness marker" section');
    const next = markdown.indexOf('\n#', start + 1);
    return markdown.slice(start, next === -1 ? markdown.length : next);
}

describe('explorer freshness marker in components/explorer/api.md', () => {
    test('names every header and body key send_response.js emits', { skip: noMarker }, () => {
        const src     = fs.readFileSync(MARKER, 'utf8');
        const headers = [...src.matchAll(/head\['(XChain-(?:Freshness|Tip-[A-Za-z-]+))'\]/g)].map((m) => m[1]);
        const body    = /json\.freshness\s*=\s*\{([^}]*)\}/.exec(src);
        assert.ok(body, 'send_response.js no longer builds a body `freshness` object this test can read');
        const keys    = [...body[1].matchAll(/^\s*([a-z_]+)\s*:/gm)].map((m) => m[1]);
        // Floors, so a producer rewrite the patterns stop matching fails here instead of passing empty.
        assert.ok(headers.length >= 3, 'read only ' + headers.length + ' XChain-* marker headers from send_response.js');
        assert.ok(keys.length >= 4, 'read only ' + keys.length + ' freshness body keys from send_response.js');
        const section = markerSection(doc);
        const missing = headers.concat(keys).filter((name) => !section.includes('`' + name + '`'));
        assert.deepEqual(missing, [], 'the Freshness marker section does not name: ' + missing.join(', '));
    });
});
