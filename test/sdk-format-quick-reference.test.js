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
 * The SDK format pages agree with the SDK's own format table.
 *
 * components/sdk/format-selection.md carries a per-version quick reference and
 * components/sdk/actions.md restates every LIST format. Both are prose copies of
 * xchain-sdk src/protocol/formats.js, so a version the SDK gains reads as "None"
 * or goes missing until something compares them. This suite reads the table from
 * the sibling checkout and checks:
 *
 *   1. every action with more than one SDK format has a quick-reference row, and
 *      the omission sentence names exactly the single-format actions;
 *   2. each row marks a version "None" exactly when the SDK has no format for it;
 *   3. every pin-only version is marked pin-only;
 *   4. the actions.md LIST section declares every SDK LIST format, field for field.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT = path.join(__dirname, '..');
const SDK = path.join(ROOT, '..', 'xchain-sdk', 'src', 'protocol');
const FORMATS = path.join(SDK, 'formats.js');
const FIELD_NAMES = path.join(SDK, 'format_selector', 'field_names.js');
const noSdk = sibling('xchain-sdk', [FORMATS, FIELD_NAMES]).skip;

const doc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// The quick-reference rows as { ACTION: [cell v0, cell v1, ...] }
function quickReference() {
  const text = doc('components/sdk/format-selection.md');
  const section = text.split('## Version Quick Reference')[1].split('\n## ')[0];
  const rows = {};
  for (const line of section.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (/^[A-Z]+$/.test(cells[0] || '') && cells[0] !== 'ACTION') rows[cells[0]] = cells.slice(1);
  }
  return { section, rows };
}

test('every multi-format action has a row and the omission sentence names the rest',
  { skip: noSdk }, () => {
    const formats = require(FORMATS);
    const { section, rows } = quickReference();
    const multi = Object.keys(formats).filter((a) => Object.keys(formats[a]).length > 1).sort();
    const single = Object.keys(formats).filter((a) => Object.keys(formats[a]).length === 1).sort();
    assert.deepStrictEqual(Object.keys(rows).sort(), multi, 'quick-reference rows');
    const omitted = section.match(/single format version \(([^)]+)\)/)[1].split(',').map((s) => s.trim()).sort();
    assert.deepStrictEqual(omitted, single, 'the omission sentence');
  });

test('a row reads None exactly where the SDK has no format and marks pin-only versions',
  { skip: noSdk }, () => {
    const formats = require(FORMATS);
    const { PIN_ONLY_VERSIONS } = require(FIELD_NAMES);
    const { rows } = quickReference();
    for (const [action, cells] of Object.entries(rows)) {
      cells.forEach((cell, v) => {
        const absent = cell === 'None' || cell.startsWith('_(unused');
        assert.strictEqual(absent, formats[action][v] === undefined, action + ' v' + v + ': ' + cell);
        const pinOnly = (PIN_ONLY_VERSIONS[action] || []).includes(v);
        assert.strictEqual(/\(pin-only\)/.test(cell), pinOnly, action + ' v' + v + ' pin-only marking');
      });
    }
  });

test('the SDK reference LIST section declares every SDK LIST format',
  { skip: noSdk }, () => {
    const formats = require(FORMATS);
    const list = doc('components/sdk/actions.md').split('\n### LIST\n')[1].split('\n### ')[0];
    for (const [v, fields] of Object.entries(formats.LIST)) {
      const m = list.match(new RegExp('\\*\\*Format v' + v + ' [^*]*\\*\\*\\s*`LIST\\|([^`]+)`'));
      assert.ok(m, 'components/sdk/actions.md LIST declares no format v' + v);
      assert.strictEqual(m[1], fields, 'LIST v' + v + ' fields');
    }
  });
