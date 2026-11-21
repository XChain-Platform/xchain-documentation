/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 *********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const cov = require('../../lib/env-var-doc-coverage.js');
const flags = require('../../bin/generate-flag-days.js');

function defaultOf(source) {
    cov.ENV_READ.lastIndex = 0;
    const read = cov.ENV_READ.exec(source);
    assert.ok(read, `fixture has no environment read: ${source}`);
    return cov.extractDefault(source, read.index + read[0].length);
}

function fixtureRegistry(body, siblings = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-fidelity-'));
    fs.writeFileSync(path.join(dir, 'protocol_changes.js'), body);
    fs.mkdirSync(path.join(dir, 'protocol_changes'));
    fs.writeFileSync(path.join(dir, 'protocol_changes', 'core.js'), 'const UNARMED = 9999999999;\n');
    for (const [name, source] of Object.entries(siblings)) fs.writeFileSync(path.join(dir, name), source);
    return dir;
}

test('whitespace before a literal bracket stays in the named-read partition', () => {
    const direct = "const a = process.env ['DIRECT_KEY'];";
    assert.deepStrictEqual([...cov.scanSource(direct).keys()], ['DIRECT_KEY']);
    assert.deepStrictEqual(cov.scanComputedReads(direct), []);

    const wrapped = "const a = process.env\n  ['WRAPPED_KEY'];";
    assert.deepStrictEqual([...cov.scanSource(wrapped).keys()], ['WRAPPED_KEY']);
    assert.deepStrictEqual(cov.scanComputedReads(wrapped), []);

    const view = "const a = this.configInfo.env ['VIEW_KEY'];";
    assert.deepStrictEqual([...cov.scanSource(view, { configView: true }).keys()], ['VIEW_KEY']);
    assert.deepStrictEqual(cov.scanComputedReads(view, { configView: true }), []);

    const call = "const a = require('../config.js').env() ['CALL_KEY'];";
    assert.deepStrictEqual([...cov.scanSource(call, { configCall: true }).keys()], ['CALL_KEY']);
    assert.deepStrictEqual(cov.scanComputedReads(call, { configCall: true }), []);
});

test('whitespace before a concatenated bracket key stays computed', () => {
    const direct = "const a = process.env ['DIRECT_' + coin];";
    assert.equal(cov.scanSource(direct).size, 0);
    assert.deepStrictEqual(cov.scanComputedReads(direct), [1]);

    const view = "const a = env ['VIEW_' + coin];";
    assert.equal(cov.scanSource(view, { configView: true }).size, 0);
    assert.deepStrictEqual(cov.scanComputedReads(view, { configView: true }), [1]);
});

test('wrapped bracket reads stay in exactly one named or computed partition', () => {
    const computed = 'const a = process.env\n    [key];';
    assert.equal(cov.scanSource(computed).size, 0);
    assert.deepStrictEqual(cov.scanComputedReads(computed), [1]);

    const concatenated = "const x = 1;\nconst a = process.env\n    ['P_' + coin];";
    assert.equal(cov.scanSource(concatenated).size, 0);
    assert.deepStrictEqual(cov.scanComputedReads(concatenated), [2]);

    const literal = "const b = process.env[\n    'GAMMA'\n];";
    assert.deepStrictEqual([...cov.scanSource(literal).keys()], ['GAMMA']);
    assert.deepStrictEqual(cov.scanComputedReads(literal), []);

    const multiline = 'const c = process.env[\n    key\n];';
    assert.deepStrictEqual(cov.scanComputedReads(multiline), [1]);
});

test('an operator between an env read and a later fallback ends the search', () => {
    assert.equal(defaultOf('const t = Number(process.env.X_S) * 1000 || 5000;'), null);
    assert.equal(defaultOf('const r = process.env.RETRIES * 2 || 6;'), null);
    assert.equal(defaultOf("const m = process.env.MODE === 'a' || 'b';"), null);
    assert.equal(defaultOf('const t = parseInt(process.env.X, 10) * 1000 || 5000;'), null);
});

test('literal arithmetic is reduced with JavaScript precedence', () => {
    const cases = [
        ['10 + 1', '11'],
        ['(1 + 2) * 1000', '3000'],
        ['2 ** 10', '1024'],
        ['100 / 4', '25'],
        ['10 - 1', '9'],
        ['10 % 4', '2'],
        ['-10 + 3', '-7'],
        ['0x10', '16'],
        ['0o20', '16'],
        ['0b10000', '16'],
        ['2 + 3 * 4', '14'],
        ['2 ** 3 ** 2', '512'],
    ];
    for (const [expression, value] of cases) {
        assert.deepStrictEqual(defaultOf(`const n = process.env.VALUE || ${expression};`), { value, numeric: true });
    }
    assert.deepStrictEqual(
        defaultOf('const n = process.env.VALUE || 10\n    + 1;'),
        { value: '11', numeric: true },
    );
    assert.deepStrictEqual(
        defaultOf('const n = parseIntMin0(process.env.VALUE, 3000 + 6);'),
        { value: '3006', numeric: true },
    );
});

test('nonconstant fallback expressions have no comparable default', () => {
    const expressions = [
        '4 * factor', '10 + offset', "'abc' + suffix", "'x'.repeat(3)", '10n',
        '10 === expected', '10 & mask', '10 instanceof Number',
    ];
    for (const expression of expressions) {
        assert.equal(defaultOf(`const n = process.env.VALUE || ${expression};`), null, expression);
    }
});

test('keyword operators after a newline continue the fallback expression', () => {
    const sources = [
        'const n = process.env.VALUE || 10\n    instanceof Number;',
        'const n = process.env.VALUE || 10\n    in values;',
        "const n = process.env.VALUE || 'a'\n    in values;",
    ];
    for (const source of sources) assert.equal(defaultOf(source), null, source);
    assert.deepStrictEqual(
        defaultOf('const a = process.env.VALUE || 10\ninside()'),
        { value: '10', numeric: true },
    );
    assert.deepStrictEqual(
        defaultOf('const a = process.env.VALUE || 10\ninstanceCount = 1'),
        { value: '10', numeric: true },
    );
});

test('operand boundaries do not absorb the next expression', () => {
    assert.deepStrictEqual(defaultOf('const n = process.env.VALUE || 10;'), { value: '10', numeric: true });
    assert.deepStrictEqual(
        defaultOf("const n = parseInt(process.env.VALUE || '10', 10);"),
        { value: '10', numeric: true },
    );
    assert.deepStrictEqual(
        defaultOf('const n = process.env.VALUE || 10 ? yes : no;'),
        { value: '10', numeric: true },
    );
    assert.deepStrictEqual(
        defaultOf('const a = process.env.VALUE || 10\nconst b = 2;'),
        { value: '10', numeric: true },
    );
});

test('arithmetic defaults drive the documentation drift comparison', () => {
    const siteDefault = defaultOf('const n = process.env.RATE || 10 + 1;');
    const entry = (documented) => ({
        vars: new Map([['RATE', [{ file: 'src/config.js', line: 1, default: siteDefault }]]]),
        docLines: [`| \`RATE\` | No | \`${documented}\` | request rate |`],
        docProse: [`| \`RATE\` | No | \`${documented}\` | request rate |`],
    });
    assert.deepStrictEqual(cov.checkDefaultDrift('sync', entry('10')), [
        'RATE: code default 11 (src/config.js:1) appears on no doc line for it',
    ]);
    assert.deepStrictEqual(cov.checkDefaultDrift('sync', entry('11')), []);
});

test('multiline mainnet arithmetic in an addGate row is refused', () => {
    const dir = fixtureRegistry(
        "addGate('foo_activation.FOO_ACTIVATION', 'time', {\n"
        + '  mainnet: 1786060800\n'
        + '    + 86400,\n'
        + '  testnet: 0,\n'
        + '});\n',
    );
    assert.throws(() => flags.collectGates(dir), /FOO_ACTIVATION/);
});

test('multiline arithmetic in a sibling activation map is refused', () => {
    const dir = fixtureRegistry('', {
        'foo_activation.js': 'const FOO_ACTIVATION = {\n  mainnet: 1786060800\n    + 86400,\n};\n',
    });
    assert.throws(() => flags.collectGates(dir), /FOO_ACTIVATION/);
});

test('multiline arithmetic in an addGate testnet slot is refused', () => {
    const dir = fixtureRegistry(
        "addGate('foo_activation.FOO_ACTIVATION', 'time', {\n"
        + '  mainnet: UNARMED,\n'
        + '  testnet: 1787961600\n'
        + '    + 86400,\n'
        + '});\n',
    );
    assert.throws(() => flags.collectTestnetArms(dir), /FOO_ACTIVATION/);
});

test('the unread addGate guard refuses multiline arithmetic', () => {
    const dir = fixtureRegistry(
        "const UNIT = 'time';\n"
        + "addGate('foo_activation.FOO_ACTIVATION', UNIT, {\n"
        + '  mainnet: 1786060800\n'
        + '    + 86400,\n'
        + '});\n',
    );
    assert.throws(() => flags.collectGates(dir), /FOO_ACTIVATION/);
});

test('property expressions do not stop at nested or quoted commas', () => {
    for (const expression of ['"value,with,commas"', 'pick(1786060800, 86400)']) {
        const dir = fixtureRegistry(
            `addGate('foo_activation.FOO_ACTIVATION', 'time', { mainnet: ${expression} });\n`,
        );
        assert.throws(
            () => flags.collectGates(dir),
            (error) => error.message.includes(expression),
            expression,
        );
    }
});

test('full property reads retain supported slot shapes', () => {
    const dir = fixtureRegistry(
        "addGate('foo_activation.REAL_ACTIVATION', 'time', {\n"
        + '  mainnet: 1786060800 // activation instant\n'
        + ', testnet: 0 });\n'
        + "addGate('foo_activation.PARKED_ACTIVATION', 'time', { mainnet: UNPINNED });\n"
        + "addGate('foo_activation.NAMED_ACTIVATION', 'time', { mainnet: SOME_SENTINEL });\n"
        + "addGate('foo_activation.FUTURE_ACTIVATION', 'time', { mainnet: 9999999999 });\n",
    );
    assert.deepStrictEqual(flags.collectGates(dir).map((g) => g.gate), ['REAL_ACTIVATION']);
    assert.deepStrictEqual(flags.collectMainnetUnpinned(dir).map((g) => g.gate), ['PARKED_ACTIVATION']);
});

test('double-quoted constant-backed registry rows are refused', () => {
    const dir = fixtureRegistry(
        'const CROSS_SETTLE_CAP_MAINNET_TIME = 1786060800;\n'
        + '["CROSS_SETTLE_PER_BLOCK_CAP", "0.2.0", CROSS_SETTLE_CAP_MAINNET_TIME, 0, 0, 0, 0, 0]\n',
    );
    assert.throws(() => flags.collectGates(dir), /CROSS_SETTLE_PER_BLOCK_CAP/);
});

test('unread constant-backed calls are refused for every parser mismatch', () => {
    for (const call of [
        'this.addChange("FOO_PER_BLOCK_CAP", "2.0.0", FOO_CAP_MAINNET_TIME, 0, 0, 0, 0, 0);',
        "this.addChange ('FOO_PER_BLOCK_CAP', '2.0.0', FOO_CAP_MAINNET_TIME, 0, 0, 0, 0, 0);",
    ]) {
        const dir = fixtureRegistry(`const FOO_CAP_MAINNET_TIME = 1786060800;\n${call}\n`);
        assert.throws(() => flags.collectGates(dir), /FOO_PER_BLOCK_CAP/);
    }
});

test('out-of-window and unknown constant-backed rows stay quiet', () => {
    const parked = fixtureRegistry(
        'const FOO_CAP_MAINNET_TIME = 0;\n'
        + '["FOO_PER_BLOCK_CAP", "2.0.0", FOO_CAP_MAINNET_TIME, 0, 0, 0, 0, 0]\n',
    );
    assert.doesNotThrow(() => flags.collectGates(parked));

    const unknown = fixtureRegistry(
        '["FOO_PER_BLOCK_CAP", "2.0.0", SOME_SENTINEL, 0, 0, 0, 0, 0]\n',
    );
    assert.doesNotThrow(() => flags.collectGates(unknown));
});
