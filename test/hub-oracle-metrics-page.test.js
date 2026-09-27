/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('./helpers/sibling_checkout.js');

const PAGE = fs.readFileSync(path.resolve(__dirname, '../components/hub/operations.md'), 'utf8');
const SERIES = [
    'xchain_oracle_last_finalized_round_timestamp_seconds',
    'xchain_oracle_current_round',
    'xchain_oracle_consecutive_skipped_rounds',
    'xchain_oracle_round_timeouts_total',
    'xchain_oracle_single_source_rounds_total',
    'xchain_oracle_price_source_live',
    'xchain_oracle_price_source_bound_rejects_total',
];
const HUB = sibling('xchain-hub', ['src/api']);

function oracleMetricsSection(markdown) {
    const match = markdown.match(/^## Oracle Metrics\n([\s\S]*?)(?=^## )/m);
    assert.ok(match, 'operations.md is missing its Oracle Metrics section');
    return match[1];
}

function assertOracleMetrics(section, series = SERIES) {
    for (const name of series) {
        assert.match(section, new RegExp(`\\b${name}\\b`), `Oracle Metrics is missing ${name}`);
    }
    assert.match(section, /\| `source` \|/);
    assert.match(section, /\[?`METRICS_ENABLED`\]?\(\.\/configuration\.md#metrics-and-log-shipping\)/);
}

function jsFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) jsFiles(file, out);
        else if (entry.name.endsWith('.js')) out.push(file);
    }
    return out;
}

function quotedOracleSeries(apiDir) {
    const names = new Set();
    const pattern = /['"`](xchain_oracle_[a-z0-9_]+)['"`]/g;
    for (const file of jsFiles(apiDir)) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(pattern)) names.add(match[1]);
    }
    return [...names].sort();
}

test('hub operations documents every oracle metric series', () => {
    assertOracleMetrics(oracleMetricsSection(PAGE));
});

test('hub operations covers every oracle series quoted by the hub API', { skip: HUB.skip }, () => {
    const section = oracleMetricsSection(PAGE);
    assertOracleMetrics(section, quotedOracleSeries(path.join(HUB.root, 'src/api')));
});

test('the Oracle Metrics checker rejects a removed series', () => {
    const section = oracleMetricsSection(PAGE);
    assert.throws(() => assertOracleMetrics(section.replace(SERIES[0], 'removed')));
});
