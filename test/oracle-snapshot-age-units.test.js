'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const API_PAGE = 'concepts/smart-contracts.md';
const GAS_PAGE = 'components/vm/configuration.md';

function apiRow() {
    const line = read(API_PAGE).split('\n').find((l) => l.includes('`xchain.oracle.getSnapshotAge()`'));
    assert.ok(line, 'getSnapshotAge row missing from the contract API table');
    return line;
}

function gasNote() {
    const line = read(GAS_PAGE).split('\n').find((l) => l.includes('`oracle.getSnapshotAge()` is also gas-free'));
    assert.ok(line, 'getSnapshotAge gas-free note missing from the VM gas section');
    return line;
}

test('contract API table gives getSnapshotAge as consensus seconds after the flag day', () => {
    const row = apiRow();
    assert.match(row, /consensus seconds/i);
    assert.match(row, /flag day/i);
    assert.match(row, /whole blocks before/i);
    assert.doesNotMatch(row, /\| Blocks since last snapshot/);
});

test('VM gas note gives getSnapshotAge as consensus seconds after the flag day', () => {
    const note = gasNote();
    assert.match(note, /consensus seconds/i);
    assert.match(note, /flag day/i);
    assert.match(note, /whole blocks before/i);
});

test('the two pages agree on the unit', () => {
    for (const text of [apiRow(), gasNote()]) {
        assert.match(text, /snapshot-age seconds flag day/);
    }
});
