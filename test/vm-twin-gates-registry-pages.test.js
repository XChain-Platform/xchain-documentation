/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025-2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const ACTIVATION = fs.readFileSync(path.join(ROOT, 'protocol', 'protocol-activation.md'), 'utf8');
const FLAG_DAYS = fs.readFileSync(path.join(ROOT, 'protocol', 'flag-days.md'), 'utf8');

const TWIN_GATES = [
    {
        vm: 'ACCESSOR_OWN_KEY_ACTIVATION',
        registry: 'READONLY_ACCESSOR_OWN_KEY',
        unarmed: ['mainnet'],
    },
    {
        vm: 'JSON_STRINGIFY_HOOK_GATE_BLOCK_TIME',
        registry: 'JSON_STRINGIFY_HOOK',
        unarmed: ['mainnet'],
    },
    {
        vm: 'APPLY_LENGTH_METER_ACTIVATION',
        registry: 'APPLY_LENGTH_METER',
        unarmed: ['mainnet', 'testnet'],
    },
    {
        vm: 'ITER_SET_METER_ACTIVATION',
        registry: 'ITER_SET_METER',
        unarmed: ['mainnet', 'testnet'],
    },
];

function vmServiceRow(markdown) {
    const row = markdown.split('\n').find((line) => line.startsWith('| `xchain-vm` |'));
    assert.ok(row, 'protocol-activation.md is missing its xchain-vm service row');
    return row;
}

function unarmedRoster(markdown, network) {
    const match = new RegExp(
        `\\*\\*(?:One gate is|\\d+ gates are) UNARMED on ${network}\\*\\* \\(([^)]*)\\):`,
    ).exec(markdown);
    assert.ok(match, `flag-days.md is missing its ${network} unarmed roster`);
    return match[1];
}

function assertTwinRegistryPages(activation, flagDays) {
    const row = vmServiceRow(activation);
    const rosters = {
        mainnet: unarmedRoster(flagDays, 'mainnet'),
        testnet: unarmedRoster(flagDays, 'testnet'),
    };

    for (const gate of TWIN_GATES) {
        assert.ok(row.includes(`\`${gate.vm}\``), `xchain-vm row omits ${gate.vm}`);
        assert.ok(
            row.includes(`indexer twin is \`${gate.registry}\``),
            `xchain-vm row does not pair ${gate.vm} with ${gate.registry}`,
        );
        for (const network of gate.unarmed) {
            assert.ok(
                rosters[network].includes(`\`${gate.registry}\``),
                `${gate.registry} is missing from the ${network} unarmed roster`,
            );
        }
    }
}

test('VM twin gates are named on the activation and generated registry pages', () => {
    assertTwinRegistryPages(ACTIVATION, FLAG_DAYS);
});

test('the registry-page guard fails when a VM gate, twin, or unarmed entry is removed', () => {
    for (const gate of TWIN_GATES) {
        assert.throws(
            () => assertTwinRegistryPages(ACTIVATION.replace(`\`${gate.vm}\``, '`removed`'), FLAG_DAYS),
            new RegExp(`omits ${gate.vm}|does not pair ${gate.vm}`),
        );
        assert.throws(
            () => assertTwinRegistryPages(
                ACTIVATION.replace(`indexer twin is \`${gate.registry}\``, 'indexer twin is `removed`'),
                FLAG_DAYS,
            ),
            new RegExp(`does not pair ${gate.vm}`),
        );
        for (const network of gate.unarmed) {
            const roster = unarmedRoster(FLAG_DAYS, network);
            const withoutGate = FLAG_DAYS.replace(
                roster,
                roster.replace(`\`${gate.registry}\``, '`removed`'),
            );
            assert.throws(
                () => assertTwinRegistryPages(ACTIVATION, withoutGate),
                new RegExp(`${gate.registry} is missing from the ${network}`),
            );
        }
    }
});
