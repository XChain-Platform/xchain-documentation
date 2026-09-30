'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { COMPUTED_READ_BASELINE } = require('../lib/env-var-doc-coverage.js');

test('computed-read baselines include both regtest time-override twins', () => {
    assert.equal(COMPUTED_READ_BASELINE.sync, 8);
    assert.equal(COMPUTED_READ_BASELINE.sdk, 5);
});
