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
 * Conformance harness for the canonical consensus primitives this repo is the
 * source of record for. protocol/reference-impl/*.js is vendored byte-identically
 * into xchain-hub, xchain-indexer, xchain-explorer, xchain-sdk, and xchain-sync;
 * protocol/test-vectors/*.json is the shared corpus each of those repos' own
 * ConsensusPrimitiveConformance suite runs against its local copy. Until this
 * test existed, nothing in THIS repo ran the vectors against the canonical
 * source itself, and nothing asserted the two per-network activation maps here
 * matched constants.js. Both are ARMED for mainnet at height 961000.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');

const constants = require('../protocol/constants.js');
const swq = require('../protocol/reference-impl/stake_weighted_quorum.js');
const eqh = require('../protocol/reference-impl/equivocation_header.js');

const swqVectors = require('../protocol/test-vectors/stake_weighted_quorum.json');
const eqhVectors = require('../protocol/test-vectors/equivocation_header.json');

describe('constants.js <-> reference-impl activation parity (consensus-critical)', () => {
    test('STAKE_WEIGHTED_QUORUM_ACTIVATION matches between constants.js and the reference impl', () => {
        assert.deepEqual(swq.STAKE_WEIGHTED_QUORUM_ACTIVATION, constants.STAKE_WEIGHTED_QUORUM_ACTIVATION);
    });

    test('EQUIV_HEADER_ACTIVATION matches between constants.js and the reference impl', () => {
        assert.deepEqual(eqh.EQUIV_HEADER_ACTIVATION, constants.EQUIV_HEADER_ACTIVATION);
    });
});

describe('reference-impl/stake_weighted_quorum.js (STAKE_WEIGHTED_QUORUM / WI-1)', () => {
    describe('meetsStakeThreshold', () => {
        for (const v of swqVectors.meetsStakeThreshold) {
            test(v.name, () => {
                // The `truncated` flag is a property on the validators ARRAY itself
                // (matching getStakeWeightsByCapability's return shape), not a sibling
                // field of a plain-JSON validator row, so it must be reattached here.
                const validators = v.validators.slice();
                if (v.truncated) validators.truncated = true;
                assert.equal(swq.meetsStakeThreshold(validators, v.signers), v.expected);
            });
        }
    });

    describe('totalStake', () => {
        for (const v of swqVectors.totalStake) {
            test(v.name, () => {
                const validators = v.validators.slice();
                if (v.truncated) validators.truncated = true;
                if (v.throws) {
                    assert.throws(() => swq.totalStake(validators));
                } else {
                    const result = swq.totalStake(validators);
                    assert.equal(result.toString(), v.expected);
                }
            });
        }
    });
});

describe('reference-impl/equivocation_header.js (EQUIV_HEADER / WI-2 bump 2)', () => {
    test('ENGINE_TAGS matches the canonical vector table', () => {
        assert.deepEqual(eqh.ENGINE_TAGS, eqhVectors.engineTags);
    });

    describe('equivKey', () => {
        for (const v of eqhVectors.equivKey) {
            test(v.name, () => {
                assert.equal(eqh.equivKey(v.engineTag, v.roundId, v.view), v.expected);
            });
        }
    });

    describe('equivPrefix', () => {
        for (const v of eqhVectors.equivPrefix) {
            test(v.name, () => {
                assert.equal(eqh.equivPrefix(v.key), v.expected);
            });
        }
    });

    describe('buildEquivCanonical', () => {
        for (const v of eqhVectors.buildEquivCanonical) {
            test(v.name, () => {
                assert.equal(eqh.buildEquivCanonical(v.engineTag, v.roundId, v.view, v.content), v.expected);
            });
        }
    });
});

// The two activation predicates have zero vectors today. A vector authored from
// the implementation under test would only prove the implementation equals
// itself, so synthesizing one here is deliberately out of scope; these named,
// skipped placeholders keep the gap visible in every test run instead of letting
// it disappear silently. See the observability/verification-gate review pass
// (2026-07-09) that added this harness for the full rationale.
describe('activation predicates (KNOWN GAP: no normative vectors exist yet)', () => {
    test('isStakeWeightedQuorumActive: no vectors for the mainnet 960999/961000 boundary, NaN snapshotBlock, or an unknown network', { skip: true }, () => {});
    test('isEquivHeaderActive: no vectors for the mainnet 960999/961000 boundary, NaN snapshotBlock, or an unknown network', { skip: true }, () => {});
});
