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

// The gated BigInt-surface strip: the names the VM removes and the Package 3 coupling the page states.
const VM_STRIP_SOURCES = ['src/stripped-globals.js', 'src/sandbox.js'];
const vmStrip = sibling('xchain-vm', VM_STRIP_SOURCES);

function bigIntSurfaceNames(root) {
    const globals = fs.readFileSync(path.join(root, VM_STRIP_SOURCES[0]), 'utf8')
        .match(/const BIGINT_SURFACE_STRIPPED_GLOBAL_NAMES = Object\.freeze\(\[([\s\S]*?)\]\);/);
    const methods = fs.readFileSync(path.join(root, VM_STRIP_SOURCES[1]), 'utf8')
        .match(/const BIGINT_SURFACE_STRIPPED_PROTO_METHODS = Object\.freeze\(\[([\s\S]*?)\]\);/);
    assert.ok(globals && methods, 'xchain-vm no longer declares the BigInt-surface strip lists as frozen arrays');
    const names = [...globals[1].matchAll(/'(\w+)'/g), ...methods[1].matchAll(/method:\s*'(\w+)'/g)].map((m) => m[1]);
    assert.equal(names.length, 6, `parsed ${names.length} BigInt-surface names from xchain-vm`);
    return names;
}

// The architecture page names every stripped BigInt-surface entry and ties it to the Package 3 gate.
function assertBigIntSurface(architecture, names) {
    for (const name of names) assert.ok(architecture.includes(`\`${name}\``), `architecture.md omits ${name}`);
    const bullet = architecture.split('\n').find((l) => l.includes('`BigInt64Array`'));
    assert.match(bullet || '', /Package 3/, 'architecture.md no longer ties the BigInt-surface strip to Package 3');
    assert.match(bullet || '', /BIGINT_SURFACE_STRIP_ACTIVATION/, 'architecture.md omits BIGINT_SURFACE_STRIP_ACTIVATION');
}

test('the sandbox page lists the gated BigInt-surface strip the VM ships', { skip: vmStrip.skip }, () => {
    const sandbox = fs.readFileSync(path.join(vmStrip.root, VM_STRIP_SOURCES[1]), 'utf8');
    assert.match(sandbox, /buildStripScript\(\s*names,\s*stripWasm \|\| stripBigIntSurface\)/,
        'sandbox.js no longer runs the BigInt-surface strip under the Package 3 flag; '
        + 'architecture.md says it does, so reword the bullet and re-point this check');
    assertBigIntSurface(PAGES.architecture, bigIntSurfaceNames(vmStrip.root));
});

test('the BigInt-surface page guard fails on a dropped name or a lost gate', { skip: vmStrip.skip }, () => {
    const names = bigIntSurfaceNames(vmStrip.root);
    assert.throws(() => assertBigIntSurface(PAGES.architecture.replaceAll('`BigUint64Array`', 'x'), names),
        /omits BigUint64Array/);
    assert.throws(() => assertBigIntSurface(PAGES.architecture.replaceAll('Package 3', 'x'), names),
        /Package 3/);
});

// The 200-unit syntax-depth bound: its value, message, option and still-unset gate map.
const SYNTAX_DEPTH_MAP = 'src/index/lint_syntax_depth_heights.js';
const vmDepth = sibling('xchain-vm', [VM_CONSTANTS, SYNTAX_DEPTH_MAP]);

function syntaxDepthFacts(root) {
    const bound = fs.readFileSync(path.join(root, VM_CONSTANTS), 'utf8').match(/const MAX_SYNTAX_DEPTH = (\d+);/);
    const map = fs.readFileSync(path.join(root, SYNTAX_DEPTH_MAP), 'utf8')
        .match(/const LINT_SYNTAX_DEPTH_ACTIVATION = Object\.freeze\(\{([\s\S]*?)\}\);/);
    assert.ok(bound && map, 'xchain-vm no longer declares MAX_SYNTAX_DEPTH or LINT_SYNTAX_DEPTH_ACTIVATION in its known shape');
    const slots = [...map[1].matchAll(/'([A-Z]+:(?:mainnet|testnet))':\s*([^,\n]+)/g)].map((m) => [m[1], m[2].trim()]);
    assert.equal(slots.length, 6, `parsed ${slots.length} LINT_SYNTAX_DEPTH_ACTIVATION slots`);
    const armed = slots.filter(([, v]) => v !== 'null');
    return { bound: bound[1], armed: armed.map(([k]) => k), heights: armed.map(([k, v]) => `\`${k}\` ${v}`) };
}

// The guide, VM and DEPLOY pages quote the bound and message; the VM pages name the option and
// gate map; the DEPLOY spec names the indexer gate and quotes each armed testnet height.
function assertSyntaxDepth(pages, facts) {
    const message = `syntax depth exceeds limit (${facts.bound})`;
    for (const name of ['operations', 'guide', 'deploy']) assert.ok(pages[name].includes(message), `${name} omits "${message}"`);
    for (const marker of ['VM_LINT_SYNTAX_DEPTH_ACTIVATION', ...facts.heights]) {
        assert.ok(pages.deploy.includes(marker), `deploy omits ${marker}`);
    }
    for (const name of ['operations', 'architecture']) {
        for (const marker of ['enforceLintSyntaxDepth', 'LINT_SYNTAX_DEPTH_ACTIVATION']) {
            assert.ok(pages[name].includes(marker), `${name} omits ${marker}`);
        }
    }
    // The v0.24.0 cut armed the three testnet keys; mainnet stays unset, as the pages say.
    assert.deepEqual(facts.armed, ['BTC:testnet', 'LTC:testnet', 'DOGE:testnet'], 'LINT_SYNTAX_DEPTH_ACTIVATION now sets a height for '
        + facts.armed.join(', ') + '; the pages say only the three testnet keys are set, so update them');
}

test('the deploy-lint pages document the syntax-depth bound the VM ships', { skip: vmDepth.skip }, () => {
    assertSyntaxDepth(PAGES, syntaxDepthFacts(vmDepth.root));
});

test('the syntax-depth page guard fails on a dropped message, option or a newly armed height', { skip: vmDepth.skip }, () => {
    const facts = syntaxDepthFacts(vmDepth.root);
    const message = `syntax depth exceeds limit (${facts.bound})`;
    assert.throws(() => assertSyntaxDepth({ ...PAGES, guide: PAGES.guide.replaceAll(message, 'x') }, facts), /guide omits/);
    assert.throws(() => assertSyntaxDepth({ ...PAGES, architecture: PAGES.architecture.replaceAll('enforceLintSyntaxDepth', 'x') }, facts),
        /architecture omits enforceLintSyntaxDepth/);
    assert.throws(() => assertSyntaxDepth(PAGES, { ...facts, armed: ['BTC:testnet'] }), /now sets a height/);
    assert.throws(() => assertSyntaxDepth({ ...PAGES, deploy: PAGES.deploy.replaceAll(message, 'x') }, facts), /deploy omits "syntax depth/);
    assert.throws(() => assertSyntaxDepth({ ...PAGES, deploy: PAGES.deploy.replaceAll('VM_LINT_SYNTAX_DEPTH_ACTIVATION', 'x') }, facts),
        /deploy omits VM_LINT_SYNTAX_DEPTH_ACTIVATION/);
    assert.throws(() => assertSyntaxDepth({ ...PAGES, deploy: PAGES.deploy.replaceAll(facts.heights[0], 'x') }, facts), /deploy omits `BTC:testnet`/);
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
