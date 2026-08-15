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
 * Genesis supply, distribution and snapshot figures.
 *
 * WHY. White paper §13.3 carried a placeholder for over a year: "genesis
 * distribution figures are finalized at genesis and announced separately".
 * While it stood, four other pages filled the vacuum with absolutes that were
 * true only of the placeholder world, chiefly "supply is created only through
 * public mints" and "there is no operator allocation". Those sentences are
 * cheap to write and expensive to leave behind: the moment the real split was
 * published, every one of them became a published contradiction of the same
 * repo's own token page, and nothing in the suite could tell.
 *
 * WHAT IT CHECKS.
 *
 *   1. The §13.3 allocation table is arithmetically closed: the legs sum to
 *      the cap the same section states, and the percentages sum to 100.
 *      A table that does not add up is the failure mode a reader spots first.
 *   2. The cap in §13.3 equals the cap the genesis runbook documents as the
 *      pinned `MAX_SUPPLY`, so prose and runbook cannot drift apart.
 *   3. The snapshot pins named in §13.3 equal the genesis pins in the runbook.
 *   4. The open-mint terms (per-mint quantity, no per-address cap, no closing
 *      date) appear in both places and agree.
 *   5. The retired placeholder, and the absolutes that only held while it
 *      stood, appear nowhere in the published set.
 *
 * Nothing here is typed as an expected constant except the two identities the
 * check is ABOUT: the table must close on itself, and the pages must agree
 * with each other. A future genesis re-cut therefore edits the documents and
 * this guard follows, while a re-cut that lands in one page only goes red.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT   = path.join(__dirname, '..');
const WHITEPAPER = path.join(DOC_ROOT, 'whitepaper.md');
const RUNBOOK    = path.join(DOC_ROOT, 'operations', 'xchain-genesis.md');

const read = (p) => fs.readFileSync(p, 'utf8');
// Line wrapping is an authoring artifact: "BTC mainnet block\n950,000" and
// "BTC mainnet block 950,000" are the same claim, so every regex below runs
// against a single-spaced copy.
const flat = (s) => s.replace(/\s+/g, ' ');
const num  = (s) => Number(String(s).replace(/[,\s]/g, ''));

function section(markdown, heading) {
    const start = markdown.indexOf(heading);
    assert.notEqual(start, -1, `section heading not found: ${heading}`);
    const rest = markdown.slice(start + heading.length);
    const end  = rest.search(/\n#{2,4} /);
    return rest.slice(0, end === -1 ? rest.length : end);
}

// Every markdown file that ships, so the placeholder sweep is repo-wide rather
// than a list someone has to remember to extend.
function markdownFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) markdownFiles(p, out);
        else if (e.name.endsWith('.md')) out.push(p);
    }
    return out;
}

const whitepaper = read(WHITEPAPER);
const runbook    = read(RUNBOOK);
const genesis    = section(whitepaper, '### 13.3 Genesis and fair launch');

// The allocation table: | name | XCHAIN | share | notes |. Header and the
// |---|---| rule are skipped by requiring a numeric second column.
function allocationRows(md) {
    const rows = [];
    for (const line of md.split('\n')) {
        if (!line.trim().startsWith('|')) continue;
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        if (cells.length < 3) continue;
        if (!/^\*{0,2}[\d,]+\*{0,2}$/.test(cells[1])) continue;
        const share = cells[2].match(/^([\d.]+)%$/);
        if (!share) continue;
        rows.push({ name: cells[0], amount: num(cells[1].replace(/\*/g, '')), share: Number(share[1]) });
    }
    return rows;
}

describe('white paper §13.3 genesis figures', () => {

    test('the section states a cap and no longer defers it', () => {
        assert.match(genesis, /\*\*100,000,000\*\*/,
            '§13.3 must state the XCHAIN cap in figures');
        assert.doesNotMatch(whitepaper, /announced separately/i,
            'the "announced separately" deferral is retired; §13.3 states the figures');
    });

    test('the allocation table closes on the stated cap', () => {
        const rows = allocationRows(genesis);
        assert.ok(rows.length >= 6, `expected the allocation legs, parsed ${rows.length} rows`);

        const cap = num(genesis.match(/\*\*([\d,]+)\*\* units/)[1]);
        const allocated = rows.reduce((t, r) => t + r.amount, 0);
        assert.equal(allocated, cap,
            `allocations sum to ${allocated}, cap is ${cap}: ${rows.map((r) => `${r.name}=${r.amount}`).join(', ')}`);

        // Shares are quoted to one decimal, so compare in tenths of a percent
        // rather than in floats.
        const shares = rows.reduce((t, r) => t + Math.round(r.share * 10), 0);
        assert.equal(shares, 1000, `share column sums to ${shares / 10}%, not 100%`);
    });

    test('each leg\'s share matches its own amount', () => {
        const cap = num(genesis.match(/\*\*([\d,]+)\*\* units/)[1]);
        for (const r of allocationRows(genesis)) {
            const derived = Math.round((r.amount / cap) * 1000) / 10;
            assert.equal(derived, r.share,
                `${r.name}: ${r.amount} of ${cap} is ${derived}%, table says ${r.share}%`);
        }
    });

    test('a zero-allocation team leg is stated, not merely implied', () => {
        const team = allocationRows(genesis).find((r) => /team|founder/i.test(r.name));
        assert.ok(team, '§13.3 must name the team/founder leg explicitly');
        assert.equal(team.amount, 0, 'the team leg is zero');
    });
});

describe('§13.3 agrees with the genesis runbook', () => {

    test('the cap is the same number in both', () => {
        const paper = num(section(whitepaper, '### 13.2 The XCHAIN monetary model').match(/\*\*([\d,]+)\*\* \(8 decimals\)/)[1]);
        const table = num(flat(runbook).match(/\| `MAX_SUPPLY` \| `(\d+)` \|/)[1]);
        const prose = num(flat(runbook).match(/`MAX_SUPPLY` of ([\d,]+)/)[1]);
        assert.equal(paper, table, 'white paper cap vs the pinned genesis ISSUE');
        assert.equal(prose, table, 'runbook prose cap vs its own pinned table');
        assert.equal(num(genesis.match(/\*\*([\d,]+)\*\* units/)[1]), table, '§13.3 cap vs the pinned genesis ISSUE');
    });

    test('the snapshot pins are the same heights in both', () => {
        const paperBTC  = num(genesis.match(/BTC block ([\d,]+)/)[1]);
        const paperDOGE = num(genesis.match(/DOGE block ([\d,]+)/)[1]);
        const rb = flat(runbook);
        assert.equal(paperBTC,  num(rb.match(/BTC mainnet block ([\d,]+)/)[1]));
        assert.equal(paperDOGE, num(rb.match(/DOGE mainnet block ([\d,]+)/)[1]));

        // The "this is live" banner names the height genesis actually
        // activated at; a snapshot pin that disagreed with it would be a
        // re-cut nobody performed.
        assert.equal(paperBTC, num(rb.match(/genesis activated at block ([\d,]+)/)[1]));
    });

    test('the open-mint terms are the same terms in both', () => {
        const perMint = /1,000 XCHAIN per (?:`MINT`|mint)/;
        assert.match(genesis, perMint, '§13.3 states the per-mint quantity');
        assert.match(flat(runbook), perMint, 'the runbook states the per-mint quantity');
        assert.match(genesis, /no per-address cap/, '§13.3 states there is no per-address cap');
        assert.match(flat(runbook), /no per-address cap/, 'the runbook states there is no per-address cap');
        assert.match(genesis, /no closing date/, '§13.3 states the leg has no closing date');
    });
});

describe('the published set carries no superseded absolutes', () => {

    // Each phrase was accurate only while §13.3 deferred the figures. With a
    // 30% airdrop and treasury, liquidity and validator legs published, any
    // page still carrying one contradicts the token page next to it.
    const retired = [
        { re: /announced separately/i,               why: 'the genesis-figures deferral is retired' },
        { re: /created only through public [Mm]ints/, why: 'only the 25% open-mint leg is publicly minted' },
        { re: /no operator allocation/i,             why: 'treasury, liquidity and validator legs are published in §13.3' },
        { re: /no community airdrop/i,               why: 'the 30% Counterparty/Dogeparty holder airdrop is published in §13.3' },
        { re: /no treasury or market allocation/i,   why: 'both legs are published in §13.3' }
    ];

    for (const { re, why } of retired) {
        test(`no page says ${re.source}`, () => {
            const hits = [];
            for (const file of markdownFiles(DOC_ROOT)) {
                read(file).split('\n').forEach((line, i) => {
                    // CHANGELOG entries are a record of what past releases
                    // said, not a claim this release makes.
                    if (path.basename(file) === 'CHANGELOG.md') return;
                    if (re.test(line)) hits.push(`${path.relative(DOC_ROOT, file)}:${i + 1}`);
                });
            }
            assert.deepEqual(hits, [], `${why}; still present at ${hits.join(', ')}`);
        });
    }
});
