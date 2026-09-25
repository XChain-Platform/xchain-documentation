/*********************************************************************
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2025–2026 Dankest, LLC
 *
 ********************************************************************/

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');

const DOC_PATH = path.resolve(__dirname, '../protocol/actions/anchor.md');
const doc = fs.readFileSync(DOC_PATH, 'utf8');

const ROW_KEYS = {
    bridge_transfers: [
        'id', 'transfer_id', 'snapshot_block', 'network', 'src_chain', 'src_action_index',
        'src_address', 'dest_chain', 'dest_address', 'tick', 'decimals', 'amount',
        'effective_time', 'admit_block_btc', 'admit_block_ltc', 'admit_block_doge',
        'finalizing_view', 'validator_signatures', 'status',
    ],
    policy_snapshots: [
        'id', 'snapshot_id', 'snapshot_block', 'network', 'origin_chain', 'tick', 'policy_seq',
        'origin_block', 'policy_hash', 'allow_list', 'block_list', 'sleeping', 'effective_time',
        'admit_block_btc', 'admit_block_ltc', 'admit_block_doge', 'finalizing_view',
        'validator_signatures', 'status',
    ],
    state_checkpoints: [
        'id', 'chain', 'network', 'block_index', 'block_hash', 'ledger_hash', 'actions_hash',
        'contract_hash', 'checkpoint_seq', 'snapshot_block', 'state_root', 'state_root_version',
        'block_merkle_root', 'block_merkle_version', 'validator_signatures',
    ],
    price_snapshots: [
        'id', 'round_number', 'coin_pair', 'price', 'reference_block', 'reference_chain',
        'block_timestamp', 'validator_count', 'consensus_round', 'consensus_proof', 'status',
        'source_chain', 'source_action_index', 'batch_block_time', 'admit_block_btc',
        'admit_block_ltc', 'admit_block_doge',
    ],
    price_tombstones: ['round_number', 'coin_pair'],
};

const TOP_LEVEL_KEYS = [
    'v', 'network', 'batch_seq', 'matches', 'calls', 'rewards', 'bridge_transfers',
    'policy_snapshots', 'state_checkpoints', 'price_snapshots', 'price_tombstones',
    'capability_snapshots',
];

const RECOVERY_TABLES = [
    'cross_chain_matches', 'cross_chain_calls', 'capability_snapshots', 'bridge_transfers',
    'policy_snapshots', 'state_checkpoints', 'price_snapshots',
];

function namedSection(markdown, heading) {
    const start = markdown.indexOf(`## ${heading}`);
    assert.notEqual(start, -1, `missing ${heading} section`);
    const tail = markdown.slice(start);
    const next = tail.slice(3).search(/\n## /);
    return next === -1 ? tail : tail.slice(0, next + 3);
}

function archiveTopLevelKeys(markdown) {
    const section = namedSection(markdown, 'Archive JSON (v1/v2 payload, after gunzip)');
    const block = section.match(/```json\n([\s\S]*?)\n```/);
    assert.ok(block, 'Archive JSON section must contain a JSON example');
    return [...block[1].matchAll(/^  "([^"]+)":/gm)].map((match) => match[1]);
}

function documentedRowKeys(markdown, name) {
    const section = namedSection(markdown, 'Archive JSON (v1/v2 payload, after gunzip)');
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = section.match(new RegExp(
        '`' + escaped + '\\[\\]`[\\s\\S]*?Fixed row key order: `([^`]+)`\\.',
    ));
    assert.ok(match, `missing fixed row key order for ${name}`);
    return match[1].split(',').map((key) => key.trim());
}

function documentedRecoveryTables(markdown) {
    const section = namedSection(markdown, 'Recovery procedure (full-parse)');
    const match = section.match(/rebuilds these seven[\s\S]*?tables:([\s\S]*?)\. Latest-status-wins/);
    assert.ok(match, 'missing the seven-table recovery inventory');
    return [...match[1].matchAll(/`([^`]+)`/g)].map((entry) => entry[1]);
}

describe('ANCHOR archive quorum-table documentation', () => {
    test('the archive example pins every top-level key in byte order', () => {
        assert.deepEqual(archiveTopLevelKeys(doc), TOP_LEVEL_KEYS);
    });

    test('every added archive row pins its serialized key order', () => {
        for (const [name, keys] of Object.entries(ROW_KEYS)) {
            assert.deepEqual(documentedRowKeys(doc, name), keys, `${name} key order drifted`);
        }
    });

    test('the recovery procedure pins all seven rebuilt mirror tables', () => {
        assert.deepEqual(documentedRecoveryTables(doc), RECOVERY_TABLES);
    });

    test('the false v0 checkpoint recovery claim is absent and its replacement is present', () => {
        assert.doesNotMatch(doc, /A v0 bundle rebuilds one `state_checkpoints` row per section/i);
        assert.match(doc, /Recovery rebuilds `state_checkpoints` from the archive's `state_checkpoints\[\]`/);
        assert.match(doc, /v0\s+sections themselves remain on chain in `anchor_actions`/);
    });

    test('falsification helpers expose reordered keys and an incomplete recovery inventory', () => {
        const reordered = doc.replace(
            '"bridge_transfers": [ { ...full bridge_transfers row... } ],\n'
                + '  "policy_snapshots":',
            '"policy_snapshots": [ { ...full policy_snapshots row... } ],\n'
                + '  "bridge_transfers":',
        );
        assert.notDeepEqual(archiveTopLevelKeys(reordered), TOP_LEVEL_KEYS);
        const incomplete = doc.replace(', and\n   `price_snapshots`. Latest-status-wins',
            '. Latest-status-wins');
        assert.notDeepEqual(documentedRecoveryTables(incomplete), RECOVERY_TABLES);
    });
});
