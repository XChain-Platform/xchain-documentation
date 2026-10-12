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
 * How the developer tutorials mine a block on the regtest miner.
 *
 * WHY. Two tutorials mined their transactions by calling continue_mining,
 * which only resumes the auto-miner after a pause and mines nothing itself.
 * A lookup made right after it raced the miner's mempool timers. The miner's
 * on-demand call is generate_blocks, which the miner reference documents.
 *
 * The prose side runs unconditionally; the source side skips by name when the
 * xchain-regtest-miner sibling is absent.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const TUTORIALS = ['developer-guide/regtest-development.md', 'developer-guide/build-your-first-token.md'];
const SCHEDULE_REL = 'src/XChainRegtestMiner/mining_schedule.js';
const miner = sibling('xchain-regtest-miner', [SCHEDULE_REL]);

test('no tutorial mines a block by calling continue_mining', () => {
    const hits = TUTORIALS.filter((rel) =>
        /method:\s*'continue_mining'/.test(fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8')));
    assert.deepStrictEqual(hits, [],
        'a tutorial calls continue_mining to mine; it only resumes auto-mining. '
        + 'Use generate_blocks with { count: 1 }');
});

test('each tutorial mines with generate_blocks', () => {
    for (const rel of TUTORIALS) {
        assert.match(fs.readFileSync(path.join(DOC_ROOT, rel), 'utf8'),
            /method:\s*'generate_blocks',\s*params:\s*\{\s*count:\s*1\s*\}/,
            `${rel} no longer mines its transaction with generate_blocks`);
    }
});

test('the miner still resumes, not mines, on continue_mining', { skip: miner.skip }, () => {
    const src = fs.readFileSync(path.join(miner.root, SCHEDULE_REL), 'utf8');
    const body = src.match(/async continueMining\(\)\s*\{([\s\S]*?)\n {4}\}/);
    assert.ok(body, 'mining_schedule.js lost continueMining');
    assert.doesNotMatch(body[1], /generate/i,
        'continueMining now mines; the tutorials may call it again');
});
