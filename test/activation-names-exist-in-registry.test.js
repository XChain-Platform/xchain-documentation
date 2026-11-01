// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2025–2026 Dankest, LLC

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = path.resolve(__dirname, '..');
const PROTOCOL_DIR = path.join(DOC_ROOT, 'protocol');
const CANONICAL_CONSTANTS = path.join(PROTOCOL_DIR, 'constants.js');
const REFERENCE_REGISTRY_DIR = path.join(PROTOCOL_DIR, 'reference-impl', 'consensus');
const INDEXER_REGISTRY_FILE = 'src/protocol_changes.js';
const INDEXER_REGISTRY_DIR = 'src/protocol_changes';
const INDEXER_MANIFEST_FILE = 'src/consensus/armed_map/manifest.js';
const INDEXER_CHILD_TICK_RULES = 'src/actions/issue/tick_rules.js';
const VM_SRC_DIR = 'src';
const indexer = sibling('xchain-indexer', [
    INDEXER_REGISTRY_FILE,
    INDEXER_REGISTRY_DIR,
    INDEXER_MANIFEST_FILE,
    INDEXER_CHILD_TICK_RULES,
]);
const vm = sibling('xchain-vm', [VM_SRC_DIR]);
const { CHILD_TOKEN_INDEPENDENT_EDITS_ACTIVATION } = require(CANONICAL_CONSTANTS);

// Matches an upper-case gate name: an optional prefix of words, ending in _ACTIVATION.
const ACTIVATION_NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_ACTIVATION\b/g;

function walk(dir, ext) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules') out.push(...walk(full, ext));
        } else if (entry.name.endsWith(ext)) {
            out.push(full);
        }
    }
    return out;
}

function activationNames(text) {
    return new Set(text.match(ACTIVATION_NAME) || []);
}

// Names a source file declares or reads in code. Comment lines are blanked because a retired
// gate usually survives only in a comment, and a comment is not a registry row.
function codeNames(source) {
    const code = source.split('\n').filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n');
    return activationNames(code);
}

// The VM-side gates (lint, meter and sandbox heights) are declared by xchain-vm and listed in
// the indexer's armed-map manifest rather than in the protocol_changes rows.
function registryNames(indexerRoot, vmRoot) {
    const files = [CANONICAL_CONSTANTS, ...walk(REFERENCE_REGISTRY_DIR, '.js')];
    if (indexerRoot) {
        files.push(path.join(indexerRoot, INDEXER_REGISTRY_FILE));
        files.push(...walk(path.join(indexerRoot, INDEXER_REGISTRY_DIR), '.js'));
        files.push(path.join(indexerRoot, INDEXER_MANIFEST_FILE));
    }
    if (vmRoot) files.push(...walk(path.join(vmRoot, VM_SRC_DIR), '.js'));
    const names = new Set();
    for (const file of files) {
        for (const name of codeNames(fs.readFileSync(file, 'utf8'))) names.add(name);
    }
    return names;
}

// Documented *_ACTIVATION names, keyed by name to the pages that carry them. The reference
// implementation is code, not prose, so only the markdown pages are scanned.
function documentedNames() {
    const found = new Map();
    for (const file of walk(PROTOCOL_DIR, '.md')) {
        if (file.includes(`${path.sep}reference-impl${path.sep}`)) continue;
        for (const name of activationNames(fs.readFileSync(file, 'utf8'))) {
            if (!found.has(name)) found.set(name, new Set());
            found.get(name).add(path.relative(DOC_ROOT, file));
        }
    }
    return found;
}

function unknownNames(documented, known) {
    return [...documented.keys()].filter((name) => !known.has(name)).sort();
}

test(
    'every *_ACTIVATION name a protocol page uses exists in a gate registry',
    { skip: indexer.skip || vm.skip },
    () => {
        const documented = documentedNames();
        assert.ok(documented.size > 0, 'the page scan found no *_ACTIVATION names');
        assert.deepEqual(
            unknownNames(documented, registryNames(indexer.root, vm.root)),
            [],
            'protocol pages name *_ACTIVATION gates that no registry carries',
        );
    },
);

test('a documented name absent from every registry is reported and a registered one is not', () => {
    const documented = new Map([
        ['ANCHOR_ACTIVATION', new Set(['protocol/x.md'])],
        ['ZZZ_RETIRED_FIXTURE_ACTIVATION', new Set(['protocol/x.md'])],
    ]);
    const known = registryNames(null, null);
    assert.ok(known.has('ANCHOR_ACTIVATION'), 'the canonical constants no longer carry ANCHOR_ACTIVATION');
    assert.deepEqual(unknownNames(documented, known), ['ZZZ_RETIRED_FIXTURE_ACTIVATION']);
});

test('a name that survives only in a comment is not a registry row', () => {
    const source = [
        "// ZZZ_COMMENT_ONLY_ACTIVATION was retired",
        " * ZZZ_BLOCK_COMMENT_ACTIVATION",
        "addGate('zzz_live.ZZZ_LIVE_ACTIVATION', 'height', {});",
    ].join('\n');
    assert.deepEqual([...codeNames(source)].sort(), ['ZZZ_LIVE_ACTIVATION']);
});

test('the child independent-edit map mirrors the ISSUE handler gate', { skip: indexer.skip }, () => {
    const source = fs.readFileSync(path.join(indexer.root, INDEXER_CHILD_TICK_RULES), 'utf8');
    const match = /childTokenIndependentEditsGate\.addGate\([\s\S]*?\n\}\);/.exec(source);
    assert.ok(match, 'the ISSUE child independent-edit gate declaration was not found');
    const block = match[0];
    const labels = {
        mainnet: 'mainnet',
        'BTC:testnet': "'BTC:testnet'",
        'LTC:testnet': "'LTC:testnet'",
        'DOGE:testnet': "'DOGE:testnet'",
        testnet: 'testnet',
        regtest: 'regtest',
    };
    for (const [network, height] of Object.entries(CHILD_TOKEN_INDEPENDENT_EDITS_ACTIVATION)) {
        const literal = height === 9999999999 ? 'UNARMED' : String(height);
        assert.ok(block.includes(`${labels[network]}: ${literal},`), `${network} child edit height drifted`);
    }
    assert.equal(
        CHILD_TOKEN_INDEPENDENT_EDITS_ACTIVATION.mainnet,
        9999999999,
        'the documented mainnet caveat must change when the gate is armed',
    );
    assert.match(source, /if\(parts\.length>1\)/, 'parent checks no longer depend on a dotted wire TICK');
    assert.match(source, /str\.substring\(0,1\)!='\^'/, 'full-name gate no longer excludes caret references');
});

test('the child-token pages distinguish creation from activation-gated edits', () => {
    const nft = fs.readFileSync(path.join(PROTOCOL_DIR, 'nft-standard.md'), 'utf8');
    const issue = fs.readFileSync(path.join(PROTOCOL_DIR, 'actions', 'issue.md'), 'utf8');
    assert.match(nft, /Creating a new child[\s\S]*current owner of the parent/);
    assert.match(nft, /Editing an existing child[\s\S]*depends on[\s\S]*CHILD_TOKEN_INDEPENDENT_EDITS_ACTIVATION/);
    assert.match(nft, /Below the[\s\S]*editor must own both parent and child/);
    assert.match(nft, /compact `\^id`[\s\S]*does not run the[\s\S]*parent-owner or parent-escrow checks/);
    assert.match(issue, /invalid: TICK \(parent issued by another address\)/);
    assert.match(issue, /invalid: TICK \(parent ownership escrowed\)/);
    assert.match(issue, /compact `\^id` reference has no parent name and skips the parent checks/);
    const caveatPages = [
        nft,
        issue,
        ...['dispenser.md', 'order.md', 'swap.md']
            .map((name) => fs.readFileSync(path.join(PROTOCOL_DIR, 'actions', name), 'utf8')),
        ...['creating-tokens.md', 'faq.md']
            .map((name) => fs.readFileSync(path.join(DOC_ROOT, 'user-guide', name), 'utf8')),
    ];
    for (const page of caveatPages) {
        assert.match(page, /currently unarmed on mainnet/, 'a child-edit page omits the mainnet gate state');
    }
});
