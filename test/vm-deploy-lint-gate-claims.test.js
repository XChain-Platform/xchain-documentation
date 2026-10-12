/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

// Pins the deploy-lint pages to the shipped VM rule set and the per-coin testnet arming of
// the with-ban, destructure and nesting-depth gates, read from the sibling sources.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('./helpers/sibling_checkout.js');

const VM_CONSTANTS = 'src/lint-core/constants.js';
const VM_MAPS = {
    LINT_BANNED_WITH_ACTIVATION: 'src/index/lint_banned_with_heights.js',
    LINT_DESTRUCTURE_ACTIVATION: 'src/index/lint_destructure_heights.js',
};
const NESTING_ROW = 'vm_lint_nesting_depth_activation.VM_LINT_NESTING_DEPTH_ACTIVATION';
const vm = sibling('xchain-vm', [VM_CONSTANTS, ...Object.values(VM_MAPS)]);
const indexer = sibling('xchain-indexer', ['src/protocol_changes']);

const read = (rel) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
const PAGES = {
    operations: read('components/vm/operations.md'),
    architecture: read('components/vm/architecture.md'),
    guide: read('developer-guide/smart-contract-development.md'),
    deploy: read('protocol/actions/deploy.md'),
};
const STALE = /(?:unarmed|inert) on (?:mainnet and testnet|public networks)/;

// Read every `'COIN:testnet': height` slot from one map body.
function testnetHeights(body, where) {
    const heights = [...body.matchAll(/'([A-Z]+):testnet':\s*(\d+)/g)].map((m) => `\`${m[1]}:testnet\` ${m[2]}`);
    assert.equal(heights.length, 3, `parsed ${heights.length} testnet heights from ${where}`);
    return heights;
}

function vmMapHeights(root, name) {
    const src = fs.readFileSync(path.join(root, VM_MAPS[name]), 'utf8');
    const map = src.match(new RegExp(`const ${name} = Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);`));
    assert.ok(map, `xchain-vm no longer declares ${name} as a frozen map`);
    return testnetHeights(map[1], VM_MAPS[name]);
}

function nestingRowHeights(root) {
    const dir = path.join(root, 'src/protocol_changes');
    const text = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    const row = text.match(new RegExp(`addGate\\('${NESTING_ROW.replace('.', '\\.')}', 'height', \\{([\\s\\S]*?)\\}\\);`));
    assert.ok(row, `indexer registry no longer carries ${NESTING_ROW}`);
    return testnetHeights(row[1], NESTING_ROW);
}

function consensusRules(root) {
    const src = fs.readFileSync(path.join(root, VM_CONSTANTS), 'utf8');
    const set = src.match(/const CONSENSUS_RULES = new Set\(\[([\s\S]*?)\]\);/);
    assert.ok(set, 'xchain-vm no longer declares CONSENSUS_RULES as a Set literal');
    return [...set[1].replace(/\/\/.*$/gm, '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
}

// Every page states each armed testnet height and never calls these gates unarmed on testnet.
function assertArming(pages, heights) {
    for (const [name, text] of Object.entries(pages)) {
        assert.doesNotMatch(text.split('\n').filter((l) => /with|destructur|nesting/i.test(l)).join('\n'), STALE,
            `${name} still calls a deploy-lint gate unarmed on testnet`);
        for (const quoted of heights) assert.ok(text.includes(quoted), `${name} omits ${quoted}`);
    }
}

// The rule count and names on the operations and architecture pages match CONSENSUS_RULES.
function assertRuleSet(pages, rules) {
    assert.match(pages.architecture, new RegExp(`the ${rules.length}-member set of deploy-blocking rule names`));
    assert.match(pages.operations, new RegExp(`are the ${rules.length} deploy-blocking consensus rules`));
    for (const rule of rules) {
        assert.ok(pages.architecture.includes(`\`${rule}\``), `architecture.md omits ${rule}`);
        assert.ok(pages.operations.includes(`\`${rule}\``), `operations.md omits ${rule}`);
    }
}

function assertDestructureSpellings(operations) {
    const section = operations.match(/### Global-object spellings\n([\s\S]*?)(?=\n## )/);
    assert.ok(section, 'operations.md is missing its Global-object spellings section');
    for (const marker of ['LINT_DESTRUCTURE_ACTIVATION', 'enforceLintDestructure', 'const { Promise } = globalThis']) {
        assert.ok(section[1].includes(marker), `Global-object spellings omits ${marker}`);
    }
}

test('the deploy-lint pages quote each armed testnet height of the with, destructure and nesting gates',
    { skip: vm.skip || indexer.skip }, () => {
        const heights = new Set([
            ...vmMapHeights(vm.root, 'LINT_BANNED_WITH_ACTIVATION'),
            ...vmMapHeights(vm.root, 'LINT_DESTRUCTURE_ACTIVATION'),
            ...nestingRowHeights(indexer.root),
        ]);
        assertArming(PAGES, [...heights]);
    });

test('the deploy-lint pages state the shipped CONSENSUS_RULES count and names', { skip: vm.skip }, () => {
    assertRuleSet(PAGES, consensusRules(vm.root));
});

test('Global-object spellings documents the destructured banned-global reads', () => {
    assertDestructureSpellings(PAGES.operations);
});

// The activation page's parenthetical for each testnet-armed VM map must not call testnet inert.
function assertActivationRow(markdown) {
    const row = markdown.split('\n').find((line) => line.startsWith('| `xchain-vm` |'));
    assert.ok(row, 'protocol activation page is missing the xchain-vm service row');
    for (const name of ['LINT_BANNED_WITH_ACTIVATION', 'LINT_DESTRUCTURE_ACTIVATION', 'BIGINT_SURFACE_STRIP_ACTIVATION']) {
        const note = row.match(new RegExp(`\`${name}\`[^(]*\\(([^)]*)\\)`));
        assert.ok(note, `xchain-vm row has no note for ${name}`);
        assert.doesNotMatch(note[1], STALE, `xchain-vm row calls ${name} unarmed on testnet`);
        assert.match(note[1], /armed on testnet/, `xchain-vm row omits the testnet arming of ${name}`);
    }
}

test('the activation page records the testnet arming of the with, destructure and BigInt-strip maps', () => {
    assertActivationRow(read('protocol/protocol-activation.md'));
});

test('the deploy-lint guards fail on a stale claim, a dropped height or a miscounted rule set',
    { skip: vm.skip || indexer.skip }, () => {
        const heights = vmMapHeights(vm.root, 'LINT_BANNED_WITH_ACTIVATION');
        const stale = { ...PAGES, deploy: `${PAGES.deploy}\nThe with ban is unarmed on mainnet and testnet.` };
        assert.throws(() => assertArming(stale, heights), /unarmed on testnet/);
        const dropped = { ...PAGES, guide: PAGES.guide.replaceAll(heights[0], 'removed') };
        assert.throws(() => assertArming(dropped, heights), /guide omits/);
        const rules = consensusRules(vm.root);
        assert.throws(() => assertRuleSet(PAGES, [...rules, 'banned-future']), /member set|consensus rules/);
        const lost = { ...PAGES, operations: PAGES.operations.replaceAll('`nesting-depth`', 'removed') };
        assert.throws(() => assertRuleSet(lost, rules), /operations\.md omits nesting-depth/);
        assert.throws(() => assertDestructureSpellings(PAGES.operations.replaceAll('enforceLintDestructure', 'x')));
        const activation = read('protocol/protocol-activation.md');
        const inert = activation.replace(/(`LINT_DESTRUCTURE_ACTIVATION` in [^(]*\()[^)]*\)/,
            '$1inert on mainnet and testnet until an operator arms it)');
        assert.notEqual(inert, activation, 'falsification fixture did not rewrite the destructure note');
        assert.throws(() => assertActivationRow(inert), /LINT_DESTRUCTURE_ACTIVATION/);
    });
