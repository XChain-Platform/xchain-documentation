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
 ********************************************************************/

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { describe, test } = require('node:test');

const constants = require('../protocol/constants.js');
const { buildEquivCanonical } = require('../protocol/reference-impl/consensus/equivocation_header.js');
const vectors = require('../protocol/test-vectors/list_share.json');

const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const utf8BinCompare = (left, right) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
const canonicalOrder = values => values.slice().sort(utf8BinCompare);

function assertCanonicalSet(values, label) {
    assert.deepEqual(values, canonicalOrder(values), label + ' is not in utf8_bin order');
    assert.equal(new Set(values).size, values.length, label + ' contains duplicates');
}

function validateStrictDelta(delta) {
    assertCanonicalSet(delta.prev, 'prev');
    assertCanonicalSet(delta.added, 'added');
    assertCanonicalSet(delta.removed, 'removed');

    const prev = new Set(delta.prev);
    const added = new Set(delta.added);
    for (const member of delta.removed) {
        assert(!added.has(member), 'member occurs in both added and removed: ' + member);
    }
    for (const member of delta.added) {
        assert(!prev.has(member), 'added member is already present: ' + member);
    }
    for (const member of delta.removed) {
        assert(prev.has(member), 'removed member is absent: ' + member);
    }
}

function encodeAdmitBlocks(map) {
    return Object.keys(map).sort().map(code => code + ':' + map[code]).join(',');
}

describe('shared-list snapshot ids', () => {
    for (const vector of vectors.snapshotIds) {
        test(vector.name, () => {
            const preimage = [
                'XLISTSHARE',
                vector.network,
                vector.homeChain + ':' + vector.homeListIndex,
                vector.seq,
                vector.snapshotBlock,
            ].join('|');

            assert.equal(vector.preimage, preimage);
            assert.match(vector.expected, /^[0-9a-f]{64}$/);
            assert.equal(vector.expected, sha256(preimage));
        });
    }
});

describe('shared-list members hashes', () => {
    for (const vector of vectors.membersHash) {
        test(vector.name, () => {
            assertCanonicalSet(vector.members, vector.name + ' members');
            const preimage = ['MEMBERS', vector.members.length, ...vector.members].join('|');
            assert.equal(vector.preimage, preimage);
            assert.match(vector.expected, /^[0-9a-f]{64}$/);
            assert.equal(vector.expected, sha256(preimage));
        });
    }
});

describe('shared-list meta hashes', () => {
    for (const vector of vectors.metaHashes) {
        test(vector.label, () => {
            if (vector.nameBytes !== undefined) {
                assert.equal(Buffer.byteLength(vector.name, 'utf8'), vector.nameBytes);
            }
            if (vector.descriptionBytes !== undefined) {
                assert.equal(Buffer.byteLength(vector.description, 'utf8'), vector.descriptionBytes);
            }
            if (vector.name === null && vector.description === null) {
                assert.equal(vector.preimage, '');
                assert.equal(vector.expected, '');
                return;
            }

            const preimage = ['LISTMETA', vector.name || '', vector.description || ''].join('|');
            assert.equal(vector.preimage, preimage);
            assert.match(vector.expected, /^[0-9a-f]{64}$/);
            assert.equal(vector.expected, sha256(preimage));
        });
    }
});

describe('shared-list deltas', () => {
    for (const vector of vectors.deltas) {
        test(vector.name, () => {
            validateStrictDelta(vector);
            assertCanonicalSet(vector.next, vector.name + ' next');

            const removed = new Set(vector.removed);
            const applied = canonicalOrder([
                ...vector.prev.filter(member => !removed.has(member)),
                ...vector.added,
            ]);
            assert.deepEqual(applied, vector.next);
        });
    }

    for (const vector of vectors.nonStrictDeltas) {
        test(vector.name, () => {
            assert.throws(() => validateStrictDelta(vector));
        });
    }
});

describe('shared-list signed canonicals', () => {
    test('the canonical snapshot is in the EQUIV and mirror-admission eras', () => {
        assert(160000 >= constants.EQUIV_HEADER_ACTIVATION.testnet);
        assert(160000 >= constants.MIRROR_ADMISSION_ACTIVATION['BTC:testnet']);
    });

    test('the required meta-gated canonical pair is beside the below-gate bytes', () => {
        const snapshotId = vectors.snapshotIds[0].expected;
        const belowGate = vectors.canonicals.find(vector => (
            vector.snapshot_id === snapshotId && !Object.hasOwn(vector, 'meta_hash')
        ));
        assert.ok(belowGate, 'missing below-gate canonical');

        const namedMetaHash = vectors.metaHashes.find(vector => (
            vector.name !== null && vector.description !== null
        )).expected;
        const gated = vectors.canonicals.filter(vector => (
            vector.snapshot_id === snapshotId && Object.hasOwn(vector, 'meta_hash')
        ));
        assert.deepEqual(
            gated.map(vector => vector.meta_hash).sort(),
            ['', namedMetaHash].sort(),
            'missing required canonical with a populated or empty meta hash',
        );
        for (const vector of gated) {
            assert.equal(vector.text, belowGate.text + '|' + vector.meta_hash);
        }
    });

    for (const vector of vectors.canonicals) {
        test(vector.name, () => {
            assert.equal(vector.snapshot_block, 160000);
            assert.equal(vector.network, 'testnet');
            assert.equal(vector.admissionText, encodeAdmitBlocks(vector.admission));

            const snapshotPreimage = [
                'XLISTSHARE',
                vector.network,
                vector.home_chain + ':' + vector.home_list_index,
                vector.seq,
                vector.snapshot_block,
            ].join('|');
            assert.equal(vector.snapshot_id, sha256(snapshotPreimage));

            let members;
            if (vector.kind === 'full') {
                members = vector.members;
            } else {
                validateStrictDelta(vector);
                const removed = new Set(vector.removed);
                members = canonicalOrder([
                    ...vector.prev.filter(member => !removed.has(member)),
                    ...vector.added,
                ]);
            }
            assertCanonicalSet(members, vector.name + ' resulting members');
            assert.equal(
                vector.members_hash,
                sha256(['MEMBERS', members.length, ...members].join('|')),
            );

            const fields = [
                'XLISTSHARE',
                vector.snapshot_id,
                vector.snapshot_block,
                vector.home_chain,
                vector.home_list_index,
                vector.list_type,
                vector.seq,
                vector.kind,
                vector.origin_block,
                vector.members_hash,
                vector.network,
                vector.admissionText,
            ];
            if (Object.hasOwn(vector, 'meta_hash')) {
                fields.push(vector.meta_hash);
            }
            assert.equal(vector.text, fields.join('|'));
            assert.equal(vector.text.split('|')[2], String(vector.snapshot_block));
            assert.equal(
                vector.expected,
                buildEquivCanonical('XLISTSHARE', vector.snapshot_id, vector.view, vector.text),
            );

            for (const member of [...(vector.added || []), ...(vector.removed || [])]) {
                assert(!vector.text.includes(member), 'delta member leaked into signed bytes: ' + member);
            }
        });
    }
});
