// Copyright © 2025–2026 Dankest, LLC
// Based on XChain Platform by Dankest, LLC – https://dankest.llc
//
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// This file is part of XChain Platform. Licensed under the GNU Affero
// General Public License v3.0 or later; see LICENSE.md. A commercial
// license (without AGPL source-disclosure terms) is available -
// contact legal@dankest.llc.

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { COMPUTED_READ_BASELINE } = require('../lib/env-var-doc-coverage.js');

test('computed-read baselines include every vendored regtest time-override twin', () => {
    // These totals include computed reads, the vendored time-override twin and
    // the whole-object escapes that joined the same ratchet.
    assert.equal(COMPUTED_READ_BASELINE.sync, 23);
    assert.equal(COMPUTED_READ_BASELINE.sdk, 11);
    assert.equal(COMPUTED_READ_BASELINE.explorer, 28);
});
