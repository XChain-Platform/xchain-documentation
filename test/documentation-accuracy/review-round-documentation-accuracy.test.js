/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 *********************************************************************/

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('XCALL reference documents callback bounds and the caller default', () => {
  const action = read('protocol/actions/xcall.md');
  const guide = read('developer-guide/smart-contract-development.md');
  assert.match(action, /CALLBACK_METHOD[^\n]*64 UTF-8 bytes[^\n]*no `\|`/);
  assert.match(action, /complete serialized JSON array[^\n]*1024 UTF-8 bytes/);
  assert.match(action, /caller API fills in 400[^\n]*not a protocol bound/);
  assert.match(guide, /Invalid arguments throw at emit time:[^\n]*before an XCALL is emitted[^\n]*Contract code can catch the exception/);
  assert.doesNotMatch(guide, /invalid inputs synchronously throw and revert the calling method/);
});

test('deploy gas documentation distinguishes inline and chunked billing', () => {
  const gas = read('concepts/gas.md');
  const guide = read('developer-guide/smart-contract-development.md');
  const b64Length = 4 * Math.ceil(10000 / 3);
  assert.strictEqual(100000 + b64Length * 10, 233360);
  assert.match(gas, /Deploy 10KB contract chunked[^\n]*233,360/);
  assert.match(guide, /Chunked deployment gas[^\n]*total_base64_CODE_PART_characters/);
  assert.doesNotMatch(guide, /Deployment gas is calculated as `VM_DEPLOY_BASE \+ \(code_bytes/);
});

test('gas concepts describe AST metering and capability stake floors', () => {
  const gas = read('concepts/gas.md');
  assert.match(gas, /AST-based metering[^\n]*acorn[^\n]*control flow[^\n]*calls/);
  assert.doesNotMatch(gas, /1\/instruction|Metered by isolated-vm/);
  assert.match(gas, /500 for `oracle_publish`[^\n]*5,000 for `cross_chain`/);
  assert.doesNotMatch(gas, /1,000 for oracle/);
});

test('BATCH pages document gated per-leg AIRDROP weighting', () => {
  for (const file of ['protocol/actions/batch.md', 'developer-guide/batch-operations.md']) {
    const prose = read(file);
    assert.match(prose, /BATCH_AIRDROP_LEG_WEIGHT_ACTIVATION/);
    assert.match(prose, /per-leg AIRDROP weighting|AIRDROP[^\n]*costs 25 per leg/i);
  }
  assert.doesNotMatch(read('protocol/actions/batch.md'), /weight is flat because the recipient count/);
});

test('SDK contracts guide assigns DEPLOY v1 to stakeable contracts', () => {
  const contracts = read('components/sdk/contracts.md');
  assert.match(contracts, /DEPLOY v0 \(standard, with or without constructor params\)/);
  assert.match(contracts, /v1 \(stakeable/);
  assert.doesNotMatch(contracts, /v0 \(no constructor\)|v1 \(with constructor\)/);
});

test('SDK contracts guide shows the emitted float warning', () => {
  const contracts = read('components/sdk/contracts.md');
  assert.match(contracts, /WARNING: decimal number literal \(1\.5\) detected at line 1/);
  assert.doesNotMatch(contracts, /Float literal \(1\.5\) at line 1/);
});

test('contract slash reference documents gateway validation', () => {
  const staking = read('protocol/contract-staking.md');
  assert.match(staking, /#### Throws and argument validation/);
  assert.match(staking, /64 hexadecimal characters/);
  assert.match(staking, /fractional ceiling is 8 digits[^\n]*18 digits/);
  assert.match(staking, /pattern accepts zero/);
  assert.match(staking, /Contract code can catch the exception and continue[^\n]*not caught[^\n]*EXECUTE fails/);
  assert.doesNotMatch(staking, /validation error throws synchronously, fails the calling EXECUTE/);
});

test('ORDER and SWAP specs document same-token refusal', () => {
  for (const file of ['protocol/actions/order.md', 'protocol/actions/swap.md']) {
    const prose = read(file);
    assert.match(prose, /### Same-Token Offers/);
    assert.match(prose, /invalid: cannot trade a token for itself/);
    assert.match(prose, /SAME_TOKEN_OFFER_REFUSAL_ACTIVATION/);
  }
});

test('accuracy predicates reject the former claims', () => {
  const oldClaims = [
    'Metered by isolated-vm; one charge per control-flow point',
    'DEPLOY v0 (no constructor) or v1 (with constructor)',
    'the weight is flat because the recipient count is not on the wire',
    'validators must stake XCHAIN (1,000 for oracle, 5,000 for cross-chain)'
  ];
  const stale = /Metered by isolated-vm|v0 \(no constructor\)|weight is flat because|1,000 for oracle/;
  for (const claim of oldClaims) assert.match(claim, stale);
});
