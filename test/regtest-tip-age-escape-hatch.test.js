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
 * xchain-explorer is a sibling repo in the monorepo checkout, not a dependency
 * of xchain-documentation. When it is absent (docs repo cloned on its own) the
 * source-derived assertions skip and the prose assertions still run.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DEV_DOC = path.resolve(__dirname, '../developer-guide/regtest-development.md');
const CFG_DOC = path.resolve(__dirname, '../components/explorer/configuration.md');
const DB_SRC  = path.resolve(__dirname, '../../xchain-explorer/src/db.js');

const devDoc = fs.readFileSync(DEV_DOC, 'utf8');
const cfgDoc = fs.readFileSync(CFG_DOC, 'utf8');
const haveDb = fs.existsSync(DB_SRC);

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

    test('the documented default matches the explorer default', { skip: !haveDb && 'xchain-explorer not present in this checkout' }, () => {
        const m = /TIP_MAX_AGE_DEFAULT_S\s*=\s*(\d+)/.exec(fs.readFileSync(DB_SRC, 'utf8'));
        assert.ok(m, 'xchain-explorer no longer defines TIP_MAX_AGE_DEFAULT_S');
        assert.match(devDoc, new RegExp('\\b' + m[1] + '\\b'),
            'the regtest guide states a tip-age default other than the explorer\'s ' + m[1] + 's');
    });

    test('no built-in regtest exemption was added to the explorer', { skip: !haveDb && 'xchain-explorer not present in this checkout' }, () => {
        const body = tipMaxAgeSource(fs.readFileSync(DB_SRC, 'utf8'));
        // Comments explain the regtest case, and should: it is the reason the
        // hatch exists. Only executable text is searched for a network name.
        const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        assert.doesNotMatch(code, /regtest|testnet|mainnet/i,
            'tipMaxAgeSeconds branches on a network name; the operator chose an env knob over a built-in exemption ' +
            'precisely so no network name can re-open the fail-open hole');
    });
});
