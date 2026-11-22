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
 * The hub refuses to boot with no HUB_API_KEY in every mode, standalone and
 * validator alike, unless HUB_ALLOW_UNAUTHENTICATED=true declares keyless
 * operation. Pages that scope the refusal to validator mode, or that say no
 * service refuses to start without a key, send a standalone operator into a
 * crash at boot they were told would be a warning.
 *
 * Each block carries a falsification that feeds the stale wording back in, so
 * a guard that matches nothing fails rather than passing quietly.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const ROOT    = path.resolve(__dirname, '..');
const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const HUB_PAGES = [
    'components/hub/configuration.md',
    'components/hub/operations.md',
    'operations/api-keys.md',
];

const offendingLines = (markdown, pattern) =>
    markdown.split('\n').filter((line) => pattern.test(line)).map((line) => line.trim());

/* Refusal scoped to validator mode, or a standalone hub said to run open. */
const VALIDATOR_ONLY_REFUSAL = new RegExp([
    String.raw`validator mode[^.|\n]{0,80}refuses? to (?:boot|start)`,
    String.raw`standalone hub runs with all methods open`,
].join('|'), 'i');

/* The platform-wide claim that no service refuses to start keyless. */
const NO_SERVICE_REFUSES = /None of them refuse to start/i;

test('no hub page limits the keyless refusal to validator mode', () => {
    for (const rel of HUB_PAGES) {
        assert.deepEqual(offendingLines(readDoc(rel), VALIDATOR_ONLY_REFUSAL), [], rel);
    }
});

test('the api-keys page does not say every service starts without a key', () => {
    assert.deepEqual(offendingLines(readDoc('operations/api-keys.md'), NO_SERVICE_REFUSES), []);
});

test('each hub page states the refusal holds in every mode', () => {
    for (const rel of HUB_PAGES) {
        assert.match(readDoc(rel), /refuses to (?:boot|start)[^.|\n]{0,40}every mode|refuses to boot unless keyless/i, rel);
    }
});

test('falsification: validator-only and no-refusal wording is caught', () => {
    const staleHub = 'a hub in validator mode (`P2P_VALIDATOR_ADDR` set) with no key refuses to boot.';
    assert.equal(offendingLines(staleHub, VALIDATOR_ONLY_REFUSAL).length, 1);
    const staleStandalone = 'a standalone hub runs with all methods open (a warning is logged).';
    assert.equal(offendingLines(staleStandalone, VALIDATOR_ONLY_REFUSAL).length, 1);
    assert.equal(offendingLines('None of them refuse to start without one.', NO_SERVICE_REFUSES).length, 1);
});

const noHub = sibling('xchain-hub', ['src/api/auth_posture.js']).skip;

test('the hub code refuses a keyless boot in standalone and validator mode alike', { skip: noHub }, () => {
    const { evaluateAuthPosture } = require(
        path.join(sibling('xchain-hub').root, 'src/api/auth_posture.js'));
    for (const validatorMode of [false, true]) {
        const posture = evaluateAuthPosture({ apiKey: '', allowUnauthenticated: false, validatorMode });
        assert.equal(posture.refuse, true, `validatorMode=${validatorMode}`);
    }
    const declared = evaluateAuthPosture({ apiKey: '', allowUnauthenticated: true, validatorMode: false });
    assert.equal(declared.refuse, false);
});
