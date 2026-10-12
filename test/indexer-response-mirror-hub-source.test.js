'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { sibling } = require('./helpers/sibling_checkout.js');

const DOC_ROOT = path.resolve(__dirname, '..');
const README = fs.readFileSync(path.join(DOC_ROOT, 'components/indexer/README.md'), 'utf8');
const CONFIG = fs.readFileSync(path.join(DOC_ROOT, 'components/indexer/configuration.md'), 'utf8');
const STARTUP_REL = 'src/XChainIndexer/startup.js';
const indexer = sibling('xchain-indexer', [STARTUP_REL]);

const REQUIRED_DOC_MARKERS = [
    'ATTEST_RESPONSE_MIRROR_ACTIVATION',
    'attestation_responses',
    'AnchorRecovery cannot reconstruct it',
    'INDEXER_ALLOW_LOCAL_PRICE_SOURCE',
    'BTC testnet and regtest',
];

function missingMarkers(text) {
    return REQUIRED_DOC_MARKERS.filter((marker) => !text.includes(marker));
}

test('the indexer pages state the armed BTC response-mirror hub database requirement', () => {
    for (const [name, text] of [['README', README], ['configuration', CONFIG]]) {
        assert.deepEqual(missingMarkers(text), [], `${name} is missing response-mirror boot markers`);
        assert.match(text, /HUB_DB_HOST[^\n]+HUB_DB_NAME/,
            `${name} does not name both required hub database variables together`);
        assert.match(text, /INDEXER_ALLOW_LOCAL_PRICE_SOURCE[\s\S]{0,240}(?:does not|cannot) bypass/,
            `${name} presents the local-price escape hatch as bypassing the response-mirror guard`);
    }
});

test('the documentation guard fails when a required operational claim is removed', () => {
    for (const marker of REQUIRED_DOC_MARKERS) {
        const changed = CONFIG.split(marker).join('');
        assert.ok(missingMarkers(changed).includes(marker), `removing ${marker} did not trip the guard`);
    }
});

test('the indexer still enforces the documented startup refusal', { skip: indexer.skip }, () => {
    const startup = fs.readFileSync(path.join(indexer.root, STARTUP_REL), 'utf8');
    assert.match(startup, /ATTEST_RESPONSE_MIRROR_ACTIVATION/);
    assert.match(startup, /config\[['"]COIN['"]\]\s*===\s*['"]BTC['"]/);
    assert.match(startup, /HUB_DB_HOST\s*\/\s*HUB_DB_NAME/);
    assert.match(startup, /attestation_responses/);
    assert.match(startup, /AnchorRecovery cannot rebuild it/);
});
