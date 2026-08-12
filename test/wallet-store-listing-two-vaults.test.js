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
 * Two-vaults disclosure gate.
 *
 * WHY. A user who installs the wallet from a store AND from the download page
 * ends up with two separate wallets. That is structural, not a bug: MSIX
 * virtualizes a package's writes on Windows, the App Sandbox isolates the Mac
 * App Store build, and strict confinement redirects a Snap's writes. The
 * operator decided on 2026-08-03 that the wallets ARE separate,
 * that the copy says so plainly, and that the encrypted backup export/import is
 * the supported bridge. No cross-install detection ships, and none is planned,
 * because a sandboxed build largely cannot see the other install anyway.
 *
 * So the ONLY thing standing between a user and an unpleasant surprise is a
 * sentence, in three places at once: the download page (xchain-websites) and
 * the two store listings that live here. Prose with nothing checking it is
 * exactly what goes stale first, and here the failure is silent: a listing that
 * quietly loses the sentence still submits, still certifies, and still ships.
 * This gate keeps the sentence in place. The download page's half of the same
 * pin lives in xchain-websites/test/wallet-two-vaults-copy.test.js, which also
 * reads these files when the two repos are checked out beside each other.
 *
 * WHAT IT CHECKS. For every desktop channel page, in both of the places the
 * words have to appear:
 *
 *   1. The prose section an operator reads while running the lane.
 *   2. The `## Listing collateral` → `### Description` block, which is the text
 *      pasted into the store console and therefore the one users actually read.
 *
 * Each block must state both halves of the disclosure: that the installs are
 * separate wallets, and that the encrypted backup export/import moves a wallet
 * between them. Half of it is worse than none, since "they are separate" with
 * no way out reads as data loss.
 *
 * NOTE: this gate blocks either store listing going public.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DESKTOP = path.join(__dirname, '..', 'components', 'wallet', 'release', 'desktop');

/*
 * The three store lanes each sit beside a direct download, and the disclosure
 * has to be on both sides of every pair: someone who reads only the download
 * page still has to learn it. `collateral` marks the pages that carry listing
 * text an operator pastes into a console; the direct-download pages have none.
 */
const PAGES = [
    { file: 'mac-app-store.md',   collateral: true  },
    { file: 'microsoft-store.md', collateral: true  },
    { file: 'snap-store.md',      collateral: true  },
    { file: 'macos.md',           collateral: false },
    { file: 'windows.md',         collateral: false },
    { file: 'linux.md',           collateral: false },
];

const read = (file) => fs.readFileSync(path.join(DESKTOP, file), 'utf8');

// Markdown wraps at column ~80, so every claim below spans line breaks in at
// least one page. Match against flattened text or match nothing.
const flatten = (s) => s.replace(/\s+/g, ' ').trim();

/*
 * Pull the body of one heading: everything from it up to the next heading at
 * the same level or higher. Returns null when the heading is absent, which is
 * itself a failure the callers report by name.
 */
function section(markdown, level, title) {
    const lines = markdown.split('\n');
    const open = new RegExp(`^#{${level}}\\s+${title}\\s*$`);
    const close = new RegExp(`^#{1,${level}}\\s+`);
    const start = lines.findIndex((l) => open.test(l));
    if (start === -1) return null;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => close.test(l));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/*
 * The two halves of the disclosure. Deliberately generous about wording, since
 * each page states it in its own terms (a sandbox, a package container and
 * confinement are three different mechanisms), and strict about meaning: a
 * block has to say the wallets are separate AND name the way across.
 */
const SEPARATE = /(do(?:es)? not share (?:a|the same) wallet|separate wallets?|wallet storage, separate)/i;
const BACKUP   = /encrypted backup/i;
const EXPORT   = /\bexport/i;
const IMPORT   = /\bimport/i;

function assertStatesBothHalves(text, where) {
    const flat = flatten(text);
    // A block that shrank to nothing would satisfy nothing, but say why.
    assert.ok(flat.length > 80, `${where}: the block is ${flat.length} characters; it cannot be carrying the disclosure`);
    assert.match(flat, SEPARATE,
        `${where} does not say a store install and a direct install are separate wallets. `
        + 'That sentence is the whole mitigation; there is no in-app detection behind it.');
    assert.ok(BACKUP.test(flat) && EXPORT.test(flat) && IMPORT.test(flat),
        `${where} says the installs are separate but does not name the encrypted backup export/import as the way `
        + 'to move a wallet between them. Half the disclosure reads as data loss.');
}

describe('every desktop channel page discloses that a store install and a direct install are separate wallets', () => {
    for (const { file } of PAGES) {
        test(`${file} carries the disclosure in its prose`, () => {
            const md = read(file);
            /*
             * The store pages give it a heading of its own; the direct-download
             * pages state it inline in a bolded paragraph. Either is fine, so
             * fall back to the whole page rather than forcing one shape.
             */
            const body = section(md, 2, 'Separate installs hold separate wallets') || md;
            assertStatesBothHalves(body, `${file} (prose)`);
        });
    }
});

describe('the listing text pasted into each store console carries the disclosure', () => {
    for (const { file, collateral } of PAGES.filter((p) => p.collateral)) {
        test(`${file} listing description states it`, () => {
            const md = read(file);
            const block = section(md, 2, 'Listing collateral');
            assert.ok(block, `${file} has no "## Listing collateral" section; the listing text moved or was dropped`);
            const description = section(block, 3, 'Description');
            assert.ok(description, `${file} has no "### Description" under "## Listing collateral"`);
            /*
             * This is the one users read. The runbook section above it is
             * internal, so a page can be perfectly honest to an operator and
             * still ship a listing that never mentions it.
             */
            assertStatesBothHalves(description, `${file} listing description`);
            assert.ok(collateral);
        });
    }
});

describe('the disclosure names the mechanism, so a reader can tell it is structural', () => {
    // Without this the sentence reads as a bug someone will fix later, and the
    // decision was explicitly that it will not be.
    const MECHANISM = {
        'mac-app-store.md':   /sandbox/i,
        'microsoft-store.md': /(msix|virtualiz)/i,
        'snap-store.md':      /confinement/i,
    };
    for (const [file, re] of Object.entries(MECHANISM)) {
        test(`${file} names why the storage is separate`, () => {
            const body = section(read(file), 2, 'Separate installs hold separate wallets');
            assert.ok(body, `${file} lost its "Separate installs hold separate wallets" section`);
            assert.match(flatten(body), re, `${file} states the outcome but not the mechanism behind it`);
        });
    }
});

describe('the matcher is not vacuous', () => {
    /*
     * Every check above is "this text contains X". A matcher that accepted
     * anything would pass forever on a page that had lost the sentence, which
     * is the failure this whole file exists to catch, so prove it rejects.
     */
    const listingSansDisclosure = 'XChain Wallet is a self-custody wallet for the XChain platform and the coins '
        + 'it runs on: Bitcoin, Litecoin and Dogecoin. Your keys stay on your machine. The wallet is free and '
        + 'open source, licensed under the AGPL.';

    test('text with no disclosure fails', () => {
        assert.throws(() => assertStatesBothHalves(listingSansDisclosure, 'fixture'), /separate wallets/);
    });

    test('half the disclosure fails', () => {
        const halfOnly = `${listingSansDisclosure} This build keeps its own wallet storage, separate from a wallet `
            + 'installed from our download page.';
        assert.throws(() => assertStatesBothHalves(halfOnly, 'fixture'), /encrypted backup/);
    });

    test('an emptied block fails rather than passing on nothing', () => {
        assert.throws(() => assertStatesBothHalves('', 'fixture'), /cannot be carrying the disclosure/);
    });

    test('section() returns null for a heading that is not there', () => {
        assert.equal(section('# Title\n\nBody.\n', 2, 'Nope'), null);
        assert.match(section('## A\n\nfirst\n\n## B\n\nsecond\n', 2, 'A'), /first/);
        assert.ok(!section('## A\n\nfirst\n\n## B\n\nsecond\n', 2, 'A').includes('second'),
            'section() must stop at the next heading of the same level');
    });
});
