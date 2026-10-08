/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2026 Dankest, LLC */

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { LIST_OWNER_ACTIVATION } = require('../protocol/constants.js');

function assertMainnetArmed(map) {
    assert.equal(map.mainnet, 0, 'LIST_OWNER_ACTIVATION must be armed at mainnet genesis');
}

test('LIST owner validation is armed at mainnet genesis', () => {
    assertMainnetArmed(LIST_OWNER_ACTIVATION);
});

test('the guard rejects the former unarmed sentinel', () => {
    assert.throws(
        () => assertMainnetArmed({ ...LIST_OWNER_ACTIVATION, mainnet: 9999999999 }),
        /armed at mainnet genesis/,
    );
});
