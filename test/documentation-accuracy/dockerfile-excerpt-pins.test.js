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
 * Dockerfile excerpt runtime and source parity.
 *
 * WHY. These operator-facing excerpts are usable build instructions. A
 * floating Node base can move beyond the Node ABI required by the consensus
 * runtime, while partial copies can omit files or process-lifecycle behavior.
 *
 * WHAT IT CHECKS. Every Node base in a markdown dockerfile block is a
 * digest-pinned Node 22 bookworm image. The hub and explorer excerpts also
 * contain the same instruction lines, in order, as their source Dockerfiles.
 *
 ********************************************************************/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('../helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..', '..');
const HISTORY = new Set(['CHANGELOG.md', path.join('operations', 'releases.md')]);
const PINNED_NODE = /^FROM node:22\.\d+\.\d+-bookworm@sha256:[0-9a-f]{64}(?:\s|$)/;

function markdownFiles() {
    const out = [];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.name.endsWith('.md')) out.push(file);
        }
    }
    walk(ROOT);
    return out;
}

function dockerfileBlocks(text) {
    const blocks = [];
    const pattern = /^```dockerfile\s*$([\s\S]*?)^```\s*$/gim;
    for (const match of text.matchAll(pattern)) blocks.push(match[1]);
    return blocks;
}

function instructionLines(text) {
    return text.split('\n').map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
}

function unpinnedNodeLines(text) {
    const bad = [];
    text.split('\n').forEach((line, index) => {
        if (/^FROM node:/i.test(line.trim()) && !PINNED_NODE.test(line.trim())) bad.push(index + 1);
    });
    return bad;
}

test('markdown Dockerfile excerpts use a digest-pinned Node 22 bookworm base', () => {
    const files = markdownFiles();
    assert.ok(files.length > 50, 'found almost no markdown, so this guard is inert');
    const bad = [];
    for (const file of files) {
        const rel = path.relative(ROOT, file);
        if (HISTORY.has(rel)) continue;
        for (const block of dockerfileBlocks(fs.readFileSync(file, 'utf8'))) {
            for (const line of unpinnedNodeLines(block)) bad.push(`${rel}:dockerfile-block-line-${line}`);
        }
    }
    assert.deepEqual(bad, [], 'Node Dockerfile excerpts must pin Node 22 bookworm by digest:\n' + bad.join('\n'));
});

test('the Node base guard rejects floating and tag-only examples', () => {
    assert.deepEqual(unpinnedNodeLines('FROM node:latest'), [1]);
    assert.deepEqual(unpinnedNodeLines('FROM node:22-bookworm'), [1]);
    assert.deepEqual(unpinnedNodeLines(
        'FROM node:22.23.4-bookworm@sha256:' + 'a'.repeat(64)), []);
});

for (const component of ['explorer', 'hub']) {
    const repo = `xchain-${component}`;
    const source = sibling(repo, ['Dockerfile']);
    test(`${component} operations excerpt matches its source Dockerfile`, { skip: source.skip }, () => {
        const page = path.join(ROOT, 'components', component, 'operations.md');
        const blocks = dockerfileBlocks(fs.readFileSync(page, 'utf8'));
        assert.strictEqual(blocks.length, 1, `${page} must contain exactly one dockerfile block`);
        const expected = instructionLines(fs.readFileSync(path.join(source.root, 'Dockerfile'), 'utf8'));
        assert.deepEqual(instructionLines(blocks[0]), expected);
    });
}
