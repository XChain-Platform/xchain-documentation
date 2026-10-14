'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { COMPUTED_READ_BASELINE } = require('../lib/env-var-doc-coverage.js');

test('computed-read baselines include every vendored regtest time-override twin', () => {
    assert.equal(COMPUTED_READ_BASELINE.sync, 8);
    assert.equal(COMPUTED_READ_BASELINE.sdk, 5);
    // 14 since the computed lookahead began counting quoted-prefix keys (six explorer sites).
    assert.equal(COMPUTED_READ_BASELINE.explorer, 14);
});
