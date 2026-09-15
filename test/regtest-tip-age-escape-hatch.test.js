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
 * Regtest tip-age escape-hatch documentation gate.
 *
 * WHY. The explorer's tip-age gate refuses reads for a coin whose newest
 * indexed block has aged past six hours. On a live chain that never fires. On
 * regtest it fires by design, because blocks are mined on demand, so an idle
 * dev stack wakes up answering 503 COIN_DATA_STALE on every endpoint for that
 * coin. The gate has an escape hatch (`EXPLORER_TIP_MAX_AGE_S_<COIN>=0`) and
 * the operator decision of 2026-08-11 was to keep it an env knob and DOCUMENT
 * it, explicitly rejecting a built-in regtest exemption: the gate fails
 * closed, and a rule keyed on a network name would let anything calling itself
 * regtest re-open that hole with no operator signal.
 *
 * So the documentation is the whole fix, and a fix that lives only in prose is
 * exactly the kind that gets reworded away. This gate holds both halves of the
 * decision in place:
 *
 *   1. The dev-facing page names the escape hatch, in both its per-coin and
 *      global spelling, alongside the error code a developer will actually be
 *      looking at when they search for it.
 *   2. The explorer configuration page points dev/regtest installs at the same
 *      knob, rather than leaving it as one undifferentiated row in a table of
 *      sixty variables.
 *   3. `Database#tipMaxAgeSeconds` in xchain-explorer still resolves from the
 *      environment alone, with no network-name branch. If somebody later adds
 *      the built-in regtest default the operator turned down, this goes red
 *      and the decision gets re-made deliberately instead of by patch.
 *
 * WHERE THE EXPLORER HALF LIVES. The explorer's db.js was split into a
 * composition root, now `src/db/index.js`, plus per-family reader modules. The
 * tip-age constant and `tipMaxAgeSeconds` both live in `src/db/readers/health.js`,
 * and src/db/index.js mixes that module into Database.prototype, so each source
 * assertion reads the one file its behaviour lives in, and src/db/index.js is
 * pinned only for the fact that it still composes health.js (otherwise the
 * regex would guard an orphan). Never widen these to a glob over `src/db/`: a
 * glob matches wherever the text happens to appear, not where the method
 * Database actually runs is defined.
 *
 * xchain-explorer is a sibling repo in the monorepo checkout, not a dependency
 * of xchain-documentation. When the REPO is absent (docs repo cloned on its
 * own) the source-derived assertions skip and the prose assertions still run.
 * When the repo is present but a file this gate reads has moved, the gate
 * FAILS: keying the skip on the file rather than the repo is how a later move
 * would silently unpin it.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DEV_DOC = path.resolve(__dirname, '../developer-guide/regtest-development.md');
const CFG_DOC = path.resolve(__dirname, '../components/explorer/configuration.md');
const EXPLORER   = path.resolve(__dirname, '../../xchain-explorer');
const DB_SRC     = path.join(EXPLORER, 'src/db/index.js');
const HEALTH_SRC = path.join(EXPLORER, 'src/db/readers/health.js');

const devDoc = fs.readFileSync(DEV_DOC, 'utf8');
const cfgDoc = fs.readFileSync(CFG_DOC, 'utf8');
// Repo presence only: a pinned file gone from a PRESENT explorer fails inside the test by
// name (readSource below). Skips by name on a bare clone; throws under XCHAIN_REQUIRE_SIBLINGS=1.
const noExplorer   = sibling('xchain-explorer').skip;

// Reads an explorer source file this gate is pinned to, failing with the path
// named when it is gone: with the repo present, a missing file means the code
// moved and this pin has to follow it, never that the assertion may skip.
function readExplorerSource(file) {
    assert.ok(fs.existsSync(file),
        path.relative(EXPLORER, file) + ' is gone from xchain-explorer; repoint this gate at the file the behaviour moved to');
    // A reader family is an entry file plus a sibling directory of parts named
    // after it, so the behaviour this gate pins can sit in either. Read both,
    // in sorted path order, the way the explorer's own source-text helper does.
    const parts = file.replace(/\.js$/, '');
    let text = fs.readFileSync(file, 'utf8');
    if (fs.existsSync(parts) && fs.statSync(parts).isDirectory())
        for (const name of fs.readdirSync(parts).sort())
            if (name.endsWith('.js')) text += '\n' + fs.readFileSync(path.join(parts, name), 'utf8');
    return text;
}

// The body of `tipMaxAgeSeconds`, from its signature to the closing brace of
// the method, by brace depth. Read as source text rather than by calling it:
// what this gate is about is the absence of a code path, and a call can only
// ever show that some path was not taken for one input.
function tipMaxAgeSource(src) {
    const start = src.indexOf('tipMaxAgeSeconds(coin) {');
    assert.notEqual(start, -1, 'xchain-explorer no longer declares tipMaxAgeSeconds(coin)');
    let depth = 0;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
    assert.fail('tipMaxAgeSeconds body is unterminated');
}

describe('regtest tip-age escape hatch is documented for dev setups', () => {

    test('the regtest guide names the per-coin and global off switches', () => {
        assert.match(devDoc, /EXPLORER_TIP_MAX_AGE_S_[A-Z<]/,
            'developer-guide/regtest-development.md no longer names the per-coin knob EXPLORER_TIP_MAX_AGE_S_<COIN>');
        assert.match(devDoc, /EXPLORER_TIP_MAX_AGE_S_[A-Z<][A-Z>]*\s*=\s*0/,
            'the per-coin knob is named but never shown set to 0, which is the escape hatch');
        assert.match(devDoc, /`?EXPLORER_TIP_MAX_AGE_S=0`?/,
            'the regtest guide no longer shows the global EXPLORER_TIP_MAX_AGE_S=0 form');
    });

    test('the regtest guide names the symptom a developer searches for', () => {
        assert.match(devDoc, /COIN_DATA_STALE/,
            'the regtest guide never mentions COIN_DATA_STALE, so nobody hitting it finds this page');
    });

    test('the explorer configuration page routes dev/regtest installs to the knob', () => {
        assert.match(cfgDoc, /regtest/i,
            'components/explorer/configuration.md no longer mentions regtest around the tip-age gate');
        assert.match(cfgDoc, /EXPLORER_TIP_MAX_AGE_S_[A-Z<][A-Z>]*\s*=\s*0/,
            'the configuration page no longer shows the per-coin gate disabled for dev/regtest');
    });

    test('the explorer composition root still composes the health readers this gate reads', { skip: noExplorer }, () => {
        assert.match(readExplorerSource(DB_SRC), /require\(\s*['"]\.\/readers\/health(\.js)?['"]\s*\)/,
            'xchain-explorer src/db/index.js no longer requires ./readers/health.js, so the tip-age assertions below read a file Database does not use');
    });

    test('the documented default matches the explorer default', { skip: noExplorer }, () => {
        const m = /TIP_MAX_AGE_DEFAULT_S\s*=\s*(\d+)/.exec(readExplorerSource(HEALTH_SRC));
        assert.ok(m, 'xchain-explorer no longer defines TIP_MAX_AGE_DEFAULT_S');
        assert.match(devDoc, new RegExp('\\b' + m[1] + '\\b'),
            'the regtest guide states a tip-age default other than the explorer\'s ' + m[1] + 's');
    });

    // The guide documents a per-coin knob and a global one. If the method stops
    // reading either, the page describes an escape hatch that no longer opens,
    // and a developer on an idle regtest stack is back to 503s with no recourse.
    test('the explorer still reads both documented knobs, per-coin before global', { skip: noExplorer }, () => {
        const code = tipMaxAgeSource(readExplorerSource(HEALTH_SRC))
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        const perCoin = code.search(/['"]EXPLORER_TIP_MAX_AGE_S_['"]\s*\+/);
        const global  = code.search(/\bEXPLORER_TIP_MAX_AGE_S\b(?!_)/);
        assert.notEqual(perCoin, -1,
            'tipMaxAgeSeconds no longer reads the per-coin EXPLORER_TIP_MAX_AGE_S_<COIN> knob the regtest guide documents');
        assert.notEqual(global, -1,
            'tipMaxAgeSeconds no longer reads the global EXPLORER_TIP_MAX_AGE_S knob the regtest guide documents');
        assert.ok(perCoin < global,
            'tipMaxAgeSeconds reads the global knob before the per-coin one, so a per-coin 0 no longer overrides it');
    });

    test('no built-in regtest exemption was added to the explorer', { skip: noExplorer }, () => {
        const body = tipMaxAgeSource(readExplorerSource(HEALTH_SRC));
        // Comments explain the regtest case, and should: it is the reason the
        // hatch exists. Only executable text is searched for a network name.
        const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        assert.doesNotMatch(code, /regtest|testnet|mainnet/i,
            'tipMaxAgeSeconds branches on a network name; the operator chose an env knob over a built-in exemption ' +
            'precisely so no network name can re-open the fail-open hole');
    });
});
