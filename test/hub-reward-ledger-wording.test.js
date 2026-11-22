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
 * The hub's `validator_rewards` table is a local visibility ledger. The chain
 * mints no oracle round reward and a COLLECT reads only the indexer's table of
 * the same name, so a hub page that calls these rows rewards "distributed" to
 * validators, or a `claimed` flag a payout, sends an operator looking for a
 * balance that does not exist. The hub README and the hub schema page must
 * keep the hub-local, not-a-COLLECT-source framing.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');

const ROOT    = path.resolve(__dirname, '..');
const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const README = 'components/hub/README.md';
const SCHEMA = 'components/hub/database.md';

const PAYOUT_WORDING = /rewards? (?:are |is )?distributed|rewards earned by validators/i;

// The README line that introduces reward tracking.
const readmeRewardLine = (page) =>
    page.split('\n').filter((line) => /\*\*Reward tracking\*\*/.test(line)).join('\n');

// The body of the schema page's validator_rewards section, up to the next heading.
const ledgerSection = (page) => {
    const start = page.indexOf('### `validator_rewards`');
    if (start < 0) return '';
    const rest = page.slice(start + 1);
    const next = rest.search(/\n#{2,3} /);
    return next < 0 ? rest : rest.slice(0, next);
};

const offenders = (readme, schema) => [
    ...(PAYOUT_WORDING.test(readmeRewardLine(readme)) ? [README] : []),
    ...(PAYOUT_WORDING.test(ledgerSection(schema)) ? [SCHEMA] : []),
];

const framed = (text) => /hub-local/i.test(text) && /not a `?COLLECT`? source/i.test(text);

test('the hub README reward line is framed as a hub-local ledger, not a payout', () => {
    const line = readmeRewardLine(readDoc(README));
    assert.notEqual(line, '', 'the README reward-tracking feature line moved');
    assert.ok(framed(line), 'README reward tracking must say hub-local and not a COLLECT source');
});

test('the hub schema validator_rewards section is framed as a hub-local ledger', () => {
    const section = ledgerSection(readDoc(SCHEMA));
    assert.notEqual(section, '', 'the validator_rewards section moved');
    assert.ok(framed(section), 'validator_rewards must say hub-local and not a COLLECT source');
});

test('the hub schema validator_rewards section lists the ledger key qualifier', () => {
    const section = ledgerSection(readDoc(SCHEMA));
    assert.match(section, /\| `round_qualifier` \|/);
    assert.match(section, /\(validator_pubkey, round_number, reward_type, round_qualifier\)/);
});

test('no hub page presents the ledger as rewards distributed to validators', () => {
    assert.deepEqual(offenders(readDoc(README), readDoc(SCHEMA)), []);
});

test('falsification: the README distributed-rewards sentence is caught', () => {
    const page = readDoc(README);
    const stale = page.replace(/(\*\*Reward tracking\*\*:)[^\n]*/,
        '$1 per-round XCHAIN rewards distributed equally among participating oracle validators');
    assert.notEqual(stale, page, 'the README reward line moved; re-point this falsification');
    assert.deepEqual(offenders(stale, readDoc(SCHEMA)), [README]);
    assert.equal(framed(readmeRewardLine(stale)), false);
});

test('falsification: the schema earned-and-distributed sentence is caught', () => {
    const page = readDoc(SCHEMA);
    const start = page.indexOf('### `validator_rewards`');
    assert.ok(start >= 0, 'the validator_rewards heading moved; re-point this falsification');
    const stale = page.slice(0, start) + '### `validator_rewards`\n\n'
        + 'Tracks XCHAIN rewards earned by validators for participating in oracle rounds. '
        + 'Rewards are distributed equally among all participants in a finalized round.\n'
        + page.slice(page.indexOf('\n| Column |', start));
    assert.deepEqual(offenders(readDoc(README), stale), [SCHEMA]);
    assert.equal(framed(ledgerSection(stale)), false);
});
