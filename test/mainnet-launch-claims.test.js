/*********************************************************************
 *
 * Copyright © 2025-2026 Dankest, LLC
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Mainnet launch claims in user-facing introductions.
 *
 * The launch gate skips ordinary mainnet user actions before its published
 * instant. Introductory pages must identify testnet/regtest as the usable
 * networks and direct readers to the launch status. Once the instant arrives,
 * this guard fails so the pre-launch wording cannot silently remain in place.
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const INTRO_PATHS = [
    'getting-started/overview.md',
    'getting-started/what-is-xchain.md',
    'user-guide/faq.md',
    'user-guide/README.md',
    'concepts/blockchains.md',
];

test('the pre-launch guard has not passed the published launch instant', () => {
    const flagDays = read('protocol/flag-days.md');
    const match = flagDays.match(/\| `MAINNET_LAUNCH_ACTIVATION` \| `(\d+)` \|/);
    assert.ok(match, 'Flag-Day Values is missing the MAINNET_LAUNCH_ACTIVATION row');
    const launchTime = Number(match[1]);
    assert.ok(Math.floor(Date.now() / 1000) < launchTime,
        'the mainnet launch instant has arrived; update the status pages and retire this guard');
});

test('user-facing introductions describe mainnet as pre-launch', () => {
    const pages = INTRO_PATHS.map((rel) => ({ rel, text: read(rel) }));
    assert.ok(pages.length === 5, 'the launch-claim selection must not be empty');
    for (const { rel, text } of pages) {
        assert.doesNotMatch(text, /\blive in production\b/i,
            `${rel} calls the platform live in production before mainnet launch`);
        assert.match(text, /flag-days\.md/,
            `${rel} does not link readers to the published launch status`);
    }
    assert.match(read('concepts/blockchains.md'), /mainnet pre-launch/i,
        'the supported-blockchains table does not mark mainnet as pre-launch');
    assert.match(read('user-guide/faq.md'), /MAINNET_PRELAUNCH/,
        'the FAQ does not explain the encoder refusal before launch');
});

test('platform-map copies carry the same qualified status', () => {
    const json = JSON.parse(read('architecture/platform-map.json'));
    const html = read('architecture/platform-map-app.html');
    assert.match(json.meta.description, /testnets and regtest while mainnet remains pre-launch/i);
    assert.match(html, /testnets and regtest while mainnet remains pre-launch/i);
});
