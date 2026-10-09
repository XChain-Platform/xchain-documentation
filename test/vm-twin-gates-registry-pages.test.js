/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025-2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { SENTINEL_FLOOR } = require('../bin/generate-flag-days.js');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..');
const ACTIVATION = fs.readFileSync(path.join(ROOT, 'protocol', 'protocol-activation.md'), 'utf8');
const FLAG_DAYS = fs.readFileSync(path.join(ROOT, 'protocol', 'flag-days.md'), 'utf8');
const vm = sibling('xchain-vm', ['src/index.js', 'src/index']);
const REQUIRED_VM_TWINS = Object.freeze([
    ['GAS_CEILING_SUCCESS_ACTIVATION', 'GAS_CEILING_SUCCESS'],
    ['ITER_SET_METER_ACTIVATION', 'ITER_SET_METER'],
]);

function vmServiceRow(markdown) {
    const row = markdown.split('\n').find((line) => line.startsWith('| `xchain-vm` |'));
    assert.ok(row, 'protocol-activation.md is missing its xchain-vm service row');
    return row;
}

function assertRequiredVmTwins(markdown) {
    const row = vmServiceRow(markdown);
    for (const [vmGate, registryGate] of REQUIRED_VM_TWINS) {
        assert.ok(row.includes(`\`${vmGate}\``), `xchain-vm row omits ${vmGate}`);
        assert.ok(
            row.includes(`indexer twin is \`${registryGate}\``),
            `xchain-vm row does not pair ${vmGate} with ${registryGate}`,
        );
    }
}

function unarmedRosterMatch(markdown, network) {
    const match = new RegExp(
        `\\*\\*(One gate is|(\\d+) gates are) UNARMED on ${network}\\*\\* \\(([^)]*)\\):`,
    ).exec(markdown);
    assert.ok(match, `flag-days.md is missing its ${network} unarmed roster`);
    return match;
}

function unarmedRoster(markdown, network) {
    const match = unarmedRosterMatch(markdown, network);
    const gates = [...match[3].matchAll(/`([A-Z0-9_]+)`/g)].map((entry) => entry[1]);
    assert.equal(gates.length, match[1] === 'One gate is' ? 1 : Number(match[2]));
    assert.equal(new Set(gates).size, gates.length, `${network} unarmed roster contains a duplicate`);
    return new Set(gates);
}

function replaceUnarmedEntry(markdown, network, gate) {
    const match = unarmedRosterMatch(markdown, network);
    return markdown.slice(0, match.index)
        + match[0].replace(`\`${gate}\``, '`REMOVED`')
        + markdown.slice(match.index + match[0].length);
}

function readVmSources(root) {
    const src = path.join(root, 'src');
    const skip = new Set([path.join(src, 'protocol'), path.join(src, 'toolkit')]);
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { if (!skip.has(full)) walk(full); }
            else if (entry.name.endsWith('.js')) files.push(full);
        }
    };
    walk(src);
    return files.sort().map((file) => fs.readFileSync(file, 'utf8'));
}

function vmNetworkTables(sources) {
    const text = sources.join('\n');
    const constants = new Map(
        [...text.matchAll(/^const ([A-Z0-9_]+) = (null|\d+);/gm)]
            .map((entry) => [entry[1], entry[2] === 'null' ? null : Number(entry[2])]),
    );
    const declarations = /^const ([A-Z0-9_]+_ACTIVATION) = Object\.(?:freeze|seal)\(\{([\s\S]*?)\}\);/gm;
    return [...text.matchAll(declarations)].map((declaration) => {
        const slots = new Map(
            [...declaration[2].matchAll(/^\s*(mainnet|testnet|regtest):\s*([^,\n]+),/gm)]
                .map((entry) => [entry[1], entry[2].trim()]),
        );
        if (slots.size === 0) return null;
        assert.deepEqual([...slots.keys()], ['mainnet', 'testnet', 'regtest'],
            `${declaration[1]} is not a per-network activation table`);
        const threshold = (network) => {
            const value = slots.get(network);
            if (value === 'null') return null;
            if (/^\d+$/.test(value)) return Number(value);
            assert.ok(constants.has(value), `${declaration[1]}.${network} uses unresolved ${value}`);
            return constants.get(value);
        };
        const mainnetMarker = slots.get('mainnet');
        return {
            vm: declaration[1],
            marker: /^[A-Z0-9_]+_GATE_BLOCK_TIME$/.test(mainnetMarker)
                ? mainnetMarker : declaration[1],
            registry: declaration[1] === 'ACCESSOR_OWN_KEY_ACTIVATION'
                ? 'READONLY_ACCESSOR_OWN_KEY' : declaration[1].replace(/_ACTIVATION$/, ''),
            thresholds: { mainnet: threshold('mainnet'), testnet: threshold('testnet') },
        };
    }).filter(Boolean);
}

function assertTwinRegistryPages(activation, flagDays, tables) {
    const row = vmServiceRow(activation);
    const rosters = {
        mainnet: unarmedRoster(flagDays, 'mainnet'),
        testnet: unarmedRoster(flagDays, 'testnet'),
    };

    assert.ok(tables.length > 0, 'xchain-vm has no sealed per-network activation tables');
    for (const gate of tables) {
        assert.ok(row.includes(`\`${gate.marker}\``), `xchain-vm row omits ${gate.vm}`);
        assert.ok(
            row.includes(`indexer twin is \`${gate.registry}\``),
            `xchain-vm row does not pair ${gate.vm} with ${gate.registry}`,
        );
        for (const network of ['mainnet', 'testnet']) {
            const threshold = gate.thresholds[network];
            const unarmed = threshold === null || threshold >= SENTINEL_FLOOR;
            assert.equal(
                rosters[network].has(gate.registry),
                unarmed,
                `${gate.registry} has the wrong ${network} unarmed-roster membership`,
            );
        }
    }
}

test('required VM twins are named in the xchain-vm service row', () => {
    assertRequiredVmTwins(ACTIVATION);
});

test('the required VM twin guard fails when a gate or twin is removed', () => {
    for (const [vmGate, registryGate] of REQUIRED_VM_TWINS) {
        assert.throws(() => assertRequiredVmTwins(ACTIVATION.replace(`\`${vmGate}\``, '`removed`')),
            new RegExp(`omits ${vmGate}`));
        assert.throws(() => assertRequiredVmTwins(
            ACTIVATION.replace(`indexer twin is \`${registryGate}\``, 'indexer twin is `removed`'),
        ), new RegExp(`does not pair ${vmGate}`));
    }
});

test('VM network tables are named on both registry pages', { skip: vm.skip }, () => {
    assertTwinRegistryPages(ACTIVATION, FLAG_DAYS, vmNetworkTables(readVmSources(vm.root)));
});

test('the registry-page guard fails when a VM gate, twin, or roster entry is removed', { skip: vm.skip }, () => {
    const sources = readVmSources(vm.root);
    const tables = vmNetworkTables(sources);
    for (const gate of tables) {
        assert.throws(
            () => assertTwinRegistryPages(
                ACTIVATION.replace(`\`${gate.marker}\``, '`removed`'), FLAG_DAYS, tables,
            ),
            new RegExp(`omits ${gate.vm}|does not pair ${gate.vm}`),
        );
        assert.throws(
            () => assertTwinRegistryPages(
                ACTIVATION.replace(`indexer twin is \`${gate.registry}\``, 'indexer twin is `removed`'),
                FLAG_DAYS,
                tables,
            ),
            new RegExp(`does not pair ${gate.vm}`),
        );
        for (const network of ['mainnet', 'testnet']) {
            if (!unarmedRoster(FLAG_DAYS, network).has(gate.registry)) continue;
            const withoutGate = replaceUnarmedEntry(FLAG_DAYS, network, gate.registry);
            assert.throws(
                () => assertTwinRegistryPages(ACTIVATION, withoutGate, tables),
                new RegExp(`${gate.registry} has the wrong ${network}`),
            );
        }
    }
    const future = sources.concat(
        'const FUTURE_METER_ACTIVATION = Object.seal({\nmainnet: null,\ntestnet: null,\nregtest: 0,\n});',
    );
    assert.throws(
        () => assertTwinRegistryPages(ACTIVATION, FLAG_DAYS, vmNetworkTables(future)),
        /omits FUTURE_METER_ACTIVATION/,
    );
});
