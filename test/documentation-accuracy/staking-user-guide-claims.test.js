// Copyright © 2025-2026 Dankest, LLC
// Based on XChain Platform by Dankest, LLC - https://dankest.llc
//
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// This file is part of XChain Platform. Licensed under the GNU Affero
// General Public License v3.0 or later; see LICENSE.md.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { sibling } = require('../helpers/sibling_checkout.js');

const DOC_ROOT = path.resolve(__dirname, '../..');
const readDoc = (relative) => fs.readFileSync(path.join(DOC_ROOT, relative), 'utf8');
const indexer = sibling('xchain-indexer', [
    'src/coins/index.js',
    'src/XChainIndexer/hub_config.js',
    'src/db/contracts/slash.js',
    'src/db/contracts/slash_grid_gate.js',
    'src/protocol_changes/gates_3.js',
    'src/actions/send/validate.js',
]);
const contracts = sibling('xchain-contracts', ['vesting/vesting.js']);

function section(markdown, start, end) {
    const from = markdown.indexOf(start);
    const to = markdown.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing section ${start}`);
    return markdown.slice(from, to);
}

test('staking timing pages describe fixed consensus constants', () => {
    const contract = readDoc('protocol/contract-staking.md');
    const related = [
        readDoc('protocol/actions/stake.md'),
        readDoc('protocol/actions/unstake.md'),
        readDoc('components/hub/decentralization.md'),
        readDoc('components/indexer/database.md'),
    ].join('\n');

    assert.match(contract, /fixed, chain-wide consensus constant/);
    assert.match(contract, /Changing it requires a coordinated consensus upgrade/);
    assert.match(contract, /separate from the contract's deploy-time `COOLDOWN_BLOCKS`/);
    assert.doesNotMatch(contract, /override it per deployment/);
    assert.doesNotMatch(related, /configurable via `STAKING\.(?:ACTIVATION_DELAY_BLOCKS|COOLDOWN_BLOCKS)`/);
    assert.doesNotMatch(related, /`STAKING\.ACTIVATION_DELAY_BLOCKS` default/);
});

test('staking timing wording is pinned to the indexer consensus configuration', { skip: indexer.skip }, () => {
    const coins = fs.readFileSync(path.join(indexer.root, 'src/coins/index.js'), 'utf8');
    const hub = fs.readFileSync(path.join(indexer.root, 'src/XChainIndexer/hub_config.js'), 'utf8');

    assert.match(coins, /STAKING:\s+coin\.STAKING/);
    assert.match(hub, /const SCALAR_PARAMS = Object\.freeze\(\[\]\)/);
    assert.match(hub, /const BLOB_PARAMS\s+= Object\.freeze\(\[\]\)/);
    assert.match(hub, /may change only via a coordinated node upgrade/);
});

test('slash documentation states flooring, zero no-op, and active heights', { skip: indexer.skip }, () => {
    const contract = readDoc('protocol/contract-staking.md');
    const precision = section(contract, '#### Amount precision and flooring', '## Cooldown release');
    const gates = fs.readFileSync(path.join(indexer.root, 'src/protocol_changes/gates_3.js'), 'utf8');
    const slash = fs.readFileSync(path.join(indexer.root, 'src/db/contracts/slash.js'), 'utf8');
    const gate = fs.readFileSync(path.join(indexer.root, 'src/db/contracts/slash_grid_gate.js'), 'utf8');
    const gateRow = section(
        gates,
        "addGate('slash_grid_activation.SLASH_GRID_ACTIVATION'",
        '\n});',
    );
    const heights = [...gateRow.matchAll(/'(BTC|LTC|DOGE):testnet':\s+(\d+)/g)];

    assert.deepEqual(heights.map((match) => match[1]), ['BTC', 'LTC', 'DOGE']);
    for (const match of heights) assert.match(precision, new RegExp(`${match[1]} block \\*\\*${match[2]}\\*\\*`));
    assert.match(gate, /validates the amount's[\s\S]*SHAPE only[\s\S]*never the token's DECIMALS/);
    assert.match(slash, /bcmulfloor\(remaining, '1', dec\)/);
    assert.match(slash, /return \{ total: '0', releases: \[\] \}/);
    assert.match(precision, /floors the requested amount once to the token's decimal grid/);
    assert.match(precision, /writes no `slash_events` row/);
    assert.doesNotMatch(contract, /written for every successful slash/);
});

test('slash table and author guides qualify zero deductions', () => {
    const pages = [
        readDoc('components/indexer/database.md'),
        readDoc('developer-guide/build-a-stakeable-contract.md'),
        readDoc('developer-guide/smart-contract-development.md'),
        readDoc('concepts/smart-contracts.md'),
    ];

    assert.match(pages[0], /slash that deducts a non-zero amount/);
    for (const page of pages.slice(1)) {
        assert.match(page, /(?:floors the amount|amount is floored) to the token's decimals/);
        assert.match(page, /writes no `slash_events` row/);
    }
    assert.doesNotMatch(pages[0], /One row per VM-emitted slash:/);
});

test('gift-card guidance includes both list sides and directional policy', () => {
    const guide = readDoc('user-guide/use-cases.md');
    const giftCard = section(guide, '### Gift Cards and Store Credit', '### Revenue Sharing and Dividends');

    assert.match(giftCard, /both the sender and recipient/);
    assert.match(giftCard, /every customer who will hold the card must be listed/);
    assert.match(giftCard, /controller-bound-tokens\.md/);
    assert.match(giftCard, /checks `from` and `to`/);
    assert.match(giftCard, /bind both `transfer` and `trade`/);
    assert.doesNotMatch(giftCard, /restrict the token to your own addresses/);
});

test('gift-card list warning matches SEND validation', { skip: indexer.skip }, () => {
    const send = fs.readFileSync(path.join(indexer.root, 'src/actions/send/validate.js'), 'utf8');

    assert.match(send, /invalid: SOURCE \(not authorized\)/);
    assert.match(send, /invalid: DESTINATION \(not authorized\)/);
});

test('vesting pages distinguish automatic accrual from beneficiary claim', () => {
    const guide = readDoc('user-guide/use-cases.md');
    const concepts = readDoc('concepts/smart-contracts.md');

    assert.match(guide, /tokens unlock for a recipient as blocks pass/);
    assert.match(guide, /beneficiary sends an EXECUTE call to `claim`/);
    assert.match(concepts, /beneficiary claims the vested amount with an EXECUTE call/);
    assert.doesNotMatch(guide, /without anyone needing to push a button/);
    assert.doesNotMatch(concepts, /Automatically release tokens on a schedule/);
});

test('vesting claim wording matches the shipped contract', { skip: contracts.skip }, () => {
    const source = fs.readFileSync(path.join(contracts.root, 'vesting/vesting.js'), 'utf8');
    const claim = section(source, 'claim: function (xchain)', 'revoke: function (xchain)');

    assert.match(claim, /only the beneficiary can claim/);
    assert.match(claim, /xchain\.emit\.send\(/);
    assert.match(claim, /vestedAmount\(xchain\)/);
});
