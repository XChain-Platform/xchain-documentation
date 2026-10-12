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
 * Guide install commands name no release.
 *
 * WHY. `xchain-node install` with no ref resolves the latest published
 * release. Setup commands in the getting-started and developer guides once
 * pinned an old release several trains back, one the operations pages record
 * as failing the hub config push and killing coin daemons on update. A pinned
 * ref in a guide goes stale with every train, and on an existing install it
 * pins shared services (hub, explorer) back to that release. The only pinned
 * form allowed is the quickstart sentence that documents the optional ref.
 *
 * The regtest guide's idle-chain step also has to work on a node-managed
 * explorer: that explorer is a shared service, xchain-node reads no
 * per-coin config file for it, and only the global tip-age knob is passed
 * through from the xchain-node `.env`. So the step recreates the explorer
 * rather than reinstalling it, and never appends the knob to a
 * `config/<coin>-<network>` file.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const GUIDE_DIRS = ['developer-guide', 'getting-started'];
const REGTEST_DOC = path.join(ROOT, 'developer-guide', 'regtest-development.md');
const PINNED_INSTALL = /xchain-node install v\d/;
const OPTIONAL_REF_SENTENCE = /^With no version named, `install` resolves the latest published release/;

// Lists every Markdown file under a guide directory, recursively.
function markdownFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...markdownFiles(full));
        else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
}

// Returns `file:line` for every guide line that pins an install to a release.
function pinnedInstallLines() {
    const hits = [];
    for (const dir of GUIDE_DIRS) {
        for (const file of markdownFiles(path.join(ROOT, dir))) {
            fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                if (PINNED_INSTALL.test(line) && !OPTIONAL_REF_SENTENCE.test(line.trim()))
                    hits.push(path.relative(ROOT, file) + ':' + (i + 1));
            });
        }
    }
    return hits;
}

describe('guide install commands name no release', () => {

    test('guide directories hold Markdown pages to scan', () => {
        for (const dir of GUIDE_DIRS)
            assert.ok(markdownFiles(path.join(ROOT, dir)).length > 0, dir + ' has no Markdown pages');
    });

    test('no getting-started or developer-guide command pins an install release', () => {
        assert.deepEqual(pinnedInstallLines(), [],
            'these guide lines pin `xchain-node install` to a release; drop the ref so it resolves the latest');
    });

    test('the quickstart still documents the optional release ref', () => {
        const quickstart = fs.readFileSync(path.join(ROOT, 'getting-started', 'quickstart-node-operator.md'), 'utf8');
        assert.ok(quickstart.split('\n').some(l => OPTIONAL_REF_SENTENCE.test(l.trim()) && PINNED_INSTALL.test(l)),
            'the quickstart sentence that shows how to name a release is gone, so the allowance above guards nothing');
    });

    test('the regtest idle-chain step recreates the explorer from the xchain-node env', () => {
        const doc = fs.readFileSync(REGTEST_DOC, 'utf8');
        assert.match(doc, /xchain-node recreate xchain-explorer/,
            'the regtest guide no longer recreates the explorer to pick up the tip-age setting');
        assert.doesNotMatch(doc, /EXPLORER_TIP_MAX_AGE_S[A-Z_]*=0'?\s*>>\s*config\//,
            'the regtest guide appends the tip-age knob to a coin config file, which a node-managed explorer never reads');
    });
});
