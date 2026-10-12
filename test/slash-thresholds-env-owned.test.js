/* SPDX-License-Identifier: AGPL-3.0-or-later */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const CONFIGURATION = fs.readFileSync(
    path.join(ROOT, 'components/hub/configuration.md'),
    'utf8'
);
const VALIDATOR_GUIDE = fs.readFileSync(
    path.join(ROOT, 'operations/run-a-validator.md'),
    'utf8'
);

function tableRow(document, variable) {
    const prefix = `| \`${variable}\` |`;
    return document.split('\n').find((line) => line.startsWith(prefix)) || '';
}

function assertEnvOwnedAndRefused(text, variable) {
    assert.match(text, new RegExp('`' + variable + '` is env-owned'));
    assert.match(
        text,
        /hub refuses (?:a|any) governance proposal that attempts to change (?:its value|it)/
    );
}

test('SLASH_DEVIATION_THRESHOLD row says the threshold is env-owned and proposals are refused', () => {
    assertEnvOwnedAndRefused(tableRow(CONFIGURATION, 'SLASH_DEVIATION_THRESHOLD'),
        'SLASH_DEVIATION_THRESHOLD');
});

test('SLASH_MISSED_ROUNDS_THRESHOLD row says the threshold is env-owned and proposals are refused', () => {
    assertEnvOwnedAndRefused(tableRow(CONFIGURATION, 'SLASH_MISSED_ROUNDS_THRESHOLD'),
        'SLASH_MISSED_ROUNDS_THRESHOLD');
});

test('validator guide says both thresholds are env-owned and their proposals are refused', () => {
    const paragraph = VALIDATOR_GUIDE.split(/\n\s*\n/).find((block) =>
        block.includes('SLASH_DEVIATION_THRESHOLD')
        && block.includes('SLASH_MISSED_ROUNDS_THRESHOLD')) || '';

    assert.match(
        paragraph,
        /`SLASH_DEVIATION_THRESHOLD` and `SLASH_MISSED_ROUNDS_THRESHOLD` are both\s+env-owned/
    );
    assert.match(
        paragraph,
        /For either\s+variable, the hub refuses a governance proposal that attempts to change its\s+value\./
    );
});
