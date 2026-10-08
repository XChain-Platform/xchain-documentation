/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC - https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 *
 * The two staking clocks in the node CLI reference.
 *
 * WHY. `validator unstake` starts two clocks: the stake leaves the active set
 * after ACTIVATION_DELAY_BLOCKS, and the XCHAIN stays locked for
 * COOLDOWN_BLOCKS. The CLI prints both on purpose, and the operator guide
 * states both, but the component reference named only the short one, so an
 * operator reading it planned for an hour and waited a week.
 *
 * The prose side runs unconditionally; the source side skips by name when a
 * sibling checkout is absent.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const BTC_REL = 'src/coins/BTC.js';
const CLI_REL = 'src/cli/output.js';
const indexer = sibling('xchain-indexer', [BTC_REL]);
const node = sibling('xchain-node', [CLI_REL]);
const ops = fs.readFileSync(path.join(DOC_ROOT, 'components', 'node', 'operations.md'), 'utf8');

// Slice a section by its heading, up to the next heading of the same or higher level.
function section(heading) {
    const at = ops.indexOf(`\n${heading}\n`);
    assert.ok(at >= 0, `operations.md no longer has the "${heading}" heading`);
    const next = ops.indexOf('\n### ', at + heading.length + 1);
    return ops.slice(at, next < 0 ? undefined : next);
}

const stake = section('### `validator stake`');
const unstake = section('### `validator unstake`');

test('the unstake reference states the cooldown beside the active-set delay', () => {
    assert.match(unstake, /COOLDOWN_BLOCKS/, 'the unstake section does not name the cooldown clock');
    assert.match(unstake, /ACTIVATION_DELAY_BLOCKS/, 'the unstake section does not name the active-set clock');
    assert.match(unstake, /not spendable/i, 'the unstake section does not say when the XCHAIN is spendable');
    assert.match(stake, /COOLDOWN_BLOCKS/, 'the stake section does not state the exit cost before staking');
});

test('the stake signature lists every registered option the prose describes', () => {
    const signature = stake.split('\n').find((l) => l.startsWith('xchain-node validator stake'));
    assert.ok(signature, 'the stake section lost its signature line');
    assert.match(signature, /\[--serialize\]/, 'the stake signature omits --serialize');
});

test('the clock values the reference quotes match the BTC registry', { skip: indexer.skip }, () => {
    const btc = fs.readFileSync(path.join(indexer.root, BTC_REL), 'utf8');
    const block = btc.slice(btc.indexOf('STAKING: {'));
    const cooldown = /COOLDOWN_BLOCKS:\s*(\d+)/.exec(block);
    const delay = /ACTIVATION_DELAY_BLOCKS:\s*(\d+)/.exec(block);
    assert.ok(cooldown && delay, 'BTC.js STAKING no longer declares both clocks');
    for (const [name, value] of [['COOLDOWN_BLOCKS', cooldown[1]], ['ACTIVATION_DELAY_BLOCKS', delay[1]]])
        for (const [label, text] of [['stake', stake], ['unstake', unstake]])
            assert.match(text, new RegExp(`\\b${value} (more )?blocks`),
                `the ${label} section does not quote ${name} = ${value}`);
});

test('validator stake still registers --serialize', { skip: node.skip }, () => {
    const cli = fs.readFileSync(path.join(node.root, CLI_REL), 'utf8');
    const at = cli.indexOf(".command('stake')");
    assert.ok(at >= 0, 'output.js no longer registers validator stake');
    assert.match(cli.slice(at, cli.indexOf('.action(', at)), /'--serialize'/,
        'validator stake no longer registers --serialize, so the signature line is wrong');
});
