/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC – https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 *
 * Explorer rate-limit default drift lint.
 *
 * WHY. The explorer lowered its app-wide per-IP limit to 180 a minute and its
 * checkpoint-verify limit to 60, and eleven lines across eight pages kept the
 * old 1080 and 90. A client pacing to the published budget hits 429 RATE_LIMITED at a
 * sixth of it. The env-var coverage gate passed throughout, because it accepts
 * any line naming the variable with the right number, and one row already did.
 *
 * This test reads both fallbacks from the explorer source and holds every page
 * line that restates them to the same number. Each anchor must match exactly
 * once, so a reworded line fails by name instead of dropping out of the check.
 * It skips by name when the xchain-explorer sibling is absent.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.resolve(__dirname, '..');

// The two explorer files whose `|| N` fallbacks are the shipped defaults.
const APP_WIDE_SRC = 'src/http/api_boot/rate_limits.js';
const VERIFY_SRC   = 'src/explorer/mount/limiters.js';
const explorer     = sibling('xchain-explorer', [APP_WIDE_SRC, VERIFY_SRC]);

// Every page line that restates a default, as [page, anchor capturing the number].
const APP_WIDE_CLAIMS = [
    ['protocol/error-codes.md', /app-wide default (\d+)\/min/g],
    ['components/explorer/configuration.md', /Max requests per window \| (\d+) \(override via `EXPLORER_RATE_LIMIT_RPM`\)/g],
    ['components/explorer/configuration.md', /^\| `EXPLORER_RATE_LIMIT_RPM` \| No \| `(\d+)` \|/gm],
    ['components/explorer/api.md', /Rate limit exceeded \((\d+) requests per IP/g],
    ['components/explorer/operations.md', /\*\*Max requests:\*\* (\d+) per window per IP/g],
    ['components/explorer/operations.md', /default app-wide limit is (\d+) requests per 60-second window/g],
    ['components/explorer/architecture.md', /\*\*Rate limiter\*\*: (\d+) requests per 60-second window/g],
    ['components/explorer/README.md', /\(default (\d+) requests per minute/g],
    ['components/node/configuration.md', /^\| `EXPLORER_RATE_LIMIT_RPM` \| _\(unset; explorer defaults to `(\d+)`\)_/gm],
    ['developer-guide/api-reference.md', /`429` after (\d+) requests per IP/g],
];
const VERIFY_CLAIMS = [
    ['components/explorer/configuration.md', /^\| `EXPLORER_CHECKPOINT_VERIFY_RATE_LIMIT_RPM` \| No \| `(\d+)` \|/gm],
    ['components/node/configuration.md', /^\| `EXPLORER_CHECKPOINT_VERIFY_RATE_LIMIT_RPM` \| _\(unset; explorer defaults to `(\d+)`\)_/gm],
];

// The `|| N` fallback the source applies when the variable is unset.
function sourceDefault(rel, envVar) {
    const text = fs.readFileSync(path.join(explorer.root, rel), 'utf8');
    const m = text.match(new RegExp(envVar + ',\\s*10\\)\\s*\\|\\|\\s*(\\d+)'));
    assert.ok(m, `${rel} no longer reads ${envVar} with a numeric fallback; repoint this test`);
    return Number(m[1]);
}

// Each claim that does not state `expected`, or whose anchor is not found exactly once.
function claimDrift(claims, expected, readPage) {
    const drift = [];
    for (const [page, anchor] of claims) {
        const hits = [...readPage(page).matchAll(anchor)].map((m) => Number(m[1]));
        if (hits.length !== 1) drift.push(`${page}: anchor ${anchor} matched ${hits.length} times`);
        else if (hits[0] !== expected) drift.push(`${page}: states ${hits[0]}, source default is ${expected}`);
    }
    return drift;
}

const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('every page states the explorer app-wide and checkpoint-verify rate-limit defaults', { skip: explorer.skip }, () => {
    const appWide = sourceDefault(APP_WIDE_SRC, 'EXPLORER_RATE_LIMIT_RPM');
    const verify  = sourceDefault(VERIFY_SRC, 'EXPLORER_CHECKPOINT_VERIFY_RATE_LIMIT_RPM');
    assert.deepEqual(claimDrift(APP_WIDE_CLAIMS, appWide, readDoc), [],
        'a page restates the explorer app-wide rate limit with a number the source does not apply');
    assert.deepEqual(claimDrift(VERIFY_CLAIMS, verify, readDoc), [],
        'a page restates the checkpoint-verify rate limit with a number the source does not apply');
});

test('the rate-limit drift check fails on a stale number and on a reworded line', { skip: explorer.skip }, () => {
    const appWide = sourceDefault(APP_WIDE_SRC, 'EXPLORER_RATE_LIMIT_RPM');
    // Feed the stale 1080 back into the registry row: the check must name that page.
    const stale = (rel) => rel === 'protocol/error-codes.md'
        ? readDoc(rel).replace(`app-wide default ${appWide}/min`, 'app-wide default 1080/min') : readDoc(rel);
    assert.deepEqual(claimDrift(APP_WIDE_CLAIMS, appWide, stale),
        [`protocol/error-codes.md: states 1080, source default is ${appWide}`]);
    // Reword the README line so its anchor no longer matches: the check must not drop it silently.
    const reworded = (rel) => rel === 'components/explorer/README.md'
        ? readDoc(rel).replace(`(default ${appWide} requests per minute`, '(a default budget per minute') : readDoc(rel);
    assert.equal(claimDrift(APP_WIDE_CLAIMS, appWide, reworded).length, 1);
});
