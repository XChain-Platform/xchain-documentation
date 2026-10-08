/*********************************************************************
 *
 * Copyright © 2026 Dankest, LLC
 * Based on XChain Platform by Dankest, LLC - https://dankest.llc
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 *
 * The reference registry ENTRY (protocol/reference-impl/consensus/
 * gate_registry.js) assembles itself from load-for-effect part requires that
 * nothing else validates, and it is not a twin, so no reconciler covers it.
 * The vector suite reads only a handful of keys, all from two of the parts, so
 * a dropped, duplicated or unwired part would ship a reference registry
 * missing whole row families with every other test green. This file pins the
 * assembled key set to the union the part files declare, plus the miss and
 * regtest-arming read paths the entry re-exports.
 *
 * Run: node --test test/reference-impl-gate-registry-entry.test.js   (Node 22)
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONSENSUS = path.join(__dirname, '..', 'protocol', 'reference-impl', 'consensus');
const CONSTANTS_PATH = path.join(__dirname, '..', 'protocol', 'constants.js');
const ENTRY_PATH = path.join(CONSENSUS, 'gate_registry.js');
const PART_DIR = path.join(CONSENSUS, 'gate_registry');
const PART_RE = /^shared_rows_\d+\.js$/;
const REQUIRE_RE = /^require\('\.\/gate_registry\/(shared_rows_\d+\.js)'\);$/gm;
const ADD_GATE_RE = /^addGate\('([^']+)'/gm;

const LISTS_MARKET_HEIGHT_ENV = 'XC_LISTS_MARKET_REGTEST_ACTIVATION';
const LISTS_MARKET_TIME_ENV = 'XC_LISTS_MARKET_REGTEST_TIME';
const LISTS_MARKET_HEIGHT_KEYS = [
    'list_owner_activation.LIST_OWNER_ACTIVATION',
    'empty_allow_list_denies_activation.EMPTY_ALLOW_LIST_DENIES',
    'swap_edit_rematch_activation.SWAP_EDIT_REMATCH_ACTIVATION',
    'token_gate_list_at_block.TOKEN_GATE_LIST_AT_BLOCK',
    'list_reference_validity_activation.LIST_REFERENCE_REQUIRES_VALID_LIST',
    'list_head_follows_edit_chain.LIST_HEAD_FOLLOWS_EDIT_CHAIN',
    'order_swap_maker_policy_admission.ORDER_SWAP_MAKER_POLICY_ADMISSION',
    'order_swap_payout_policy_activation.ORDER_SWAP_PAYOUT_POLICY_PER_TOKEN',
    'issue_policy_list_detach.ISSUE_POLICY_LIST_DETACH',
    'bridge_policy_detach_activation.BRIDGE_POLICY_DETACH',
    'callback_compensation_activation.CALLBACK_COMPENSATES_EVERY_DEBITED_HOLDER',
];
const LISTS_MARKET_TIME_KEYS = [
    'dispenser_settlement_price_activation.DISPENSER_SETTLEMENT_PRICE_ACTIVATION',
    'dispenser_freshness_proven_use_activation.DISPENSER_FRESHNESS_PROVEN_USE_ACTIVATION',
    'list_edit_remove_activation.LIST_EDIT_REMOVE_ACTIVATION',
];
const LISTS_MARKET_KEYS = LISTS_MARKET_HEIGHT_KEYS.concat(LISTS_MARKET_TIME_KEYS);

const entry = require(ENTRY_PATH);
const sharedRows = require(path.join(PART_DIR, 'shared_rows.js'));

/** Part files on disk, in name order. */
function partFiles() {
    return fs.readdirSync(PART_DIR).filter((f) => PART_RE.test(f)).sort();
}

/** Keys a part file registers through top-level addGate() calls. */
function partKeys(file) {
    const src = fs.readFileSync(path.join(PART_DIR, file), 'utf8');
    return [...src.matchAll(ADD_GATE_RE)].map((m) => m[1]);
}

/** Symmetric difference, for a failure message that names families, not ~90 strings. */
function diff(actual, expected) {
    const a = new Set(actual);
    const e = new Set(expected);
    return {
        missing: expected.filter((k) => !a.has(k)),
        unexpected: actual.filter((k) => !e.has(k)),
    };
}

function listsMarketRows(height, time) {
    const env = {
        [LISTS_MARKET_HEIGHT_ENV]: height,
        [LISTS_MARKET_TIME_ENV]: time,
    };
    let arm;
    sharedRows.registerRows({
        addGate() {},
        setReadOverlay(fn) { arm = fn; },
    }, env);
    const committed = Object.freeze({ mainnet: 10, testnet: 20, regtest: 0 });
    return new Map(LISTS_MARKET_KEYS.map((key) => [key, arm(key, committed)]));
}

describe('reference registry ENTRY assembly', () => {
    test('reward activation comments do not describe the retired push rail as live', () => {
        const sources = [
            fs.readFileSync(CONSTANTS_PATH, 'utf8'),
            fs.readFileSync(path.join(PART_DIR, 'shared_rows_1.js'), 'utf8'),
        ];
        for (const source of sources) {
            assert.doesNotMatch(source, /pushvalidatorrewards|push path stands/);
        }
    });

    test('requires every part file on disk exactly once, and no part that is absent', () => {
        const parts = partFiles();
        assert.ok(parts.length >= 1, `no shared_rows_N.js found under ${PART_DIR}: the part scan broke`);
        const src = fs.readFileSync(ENTRY_PATH, 'utf8');
        const required = [...src.matchAll(REQUIRE_RE)].map((m) => m[1]);
        const seen = new Map();
        for (const r of required) seen.set(r, (seen.get(r) || 0) + 1);
        for (const [file, n] of seen) {
            assert.equal(n, 1, `gate_registry.js requires ${file} ${n} times`);
            assert.ok(parts.includes(file), `gate_registry.js requires ${file}, which is not on disk`);
        }
        for (const file of parts) {
            assert.ok(seen.has(file), `${file} is on disk but gate_registry.js never requires it`);
        }
    });

    test('the assembled keys are exactly the union the part files register', () => {
        const owner = new Map();
        for (const file of partFiles()) {
            const keys = partKeys(file);
            assert.ok(keys.length > 0, `${file} yielded no addGate keys: the scan matched nothing`);
            for (const key of keys) {
                assert.ok(!owner.has(key), `${key} is registered by both ${owner.get(key)} and ${file}`);
                owner.set(key, file);
            }
        }
        const expected = [...owner.keys()].sort();
        const actual = [...entry.keys()].sort();
        const { missing, unexpected } = diff(actual, expected);
        const families = [...new Set(missing.map((k) => owner.get(k)))];
        assert.deepEqual(
            { missing, unexpected }, { missing: [], unexpected: [] },
            `the reference registry drifted from its part files; missing keys come from ${families.join(', ') || 'none'}`,
        );
        assert.equal(actual.length, expected.length);
    });
});

describe('reference registry ENTRY reads', () => {
    test('a miss throws RegistryMissError naming the key, and has() says false', () => {
        const key = 'no_such_stem.NO_SUCH_KEY';
        assert.equal(entry.has(key), false);
        assert.throws(() => entry.get(key), (err) => err instanceof entry.RegistryMissError && err.message.includes(key));
    });

    test('a regtest-armed row follows process.env at read time', () => {
        const key = 'rollcall_gates_activation.ROLLCALL_GATES_ACTIVATION';
        const envName = 'XC_ROLLCALL_GATES_REGTEST_ACTIVATION';
        const had = Object.prototype.hasOwnProperty.call(process.env, envName);
        const saved = process.env[envName];
        try {
            delete process.env[envName];
            assert.equal(entry.get(key).regtest, entry.UNPINNED, 'an unset venue must leave regtest unpinned');
            process.env[envName] = 'armed';
            assert.equal(entry.get(key).regtest, 0, 'the armed form resolves to the rule height');
            process.env[envName] = '7';
            assert.equal(entry.get(key).regtest, 7, 'a numeric form resolves to that height');
        } finally {
            if (had) process.env[envName] = saved;
            else delete process.env[envName];
        }
    });

    test('the lists and market venue variables own exactly fourteen rows', () => {
        const rules = Object.entries(sharedRows.REGTEST_ARMING);
        assert.deepEqual(
            rules.filter(([, rule]) => rule.env === LISTS_MARKET_HEIGHT_ENV).map(([key]) => key),
            LISTS_MARKET_HEIGHT_KEYS,
        );
        assert.deepEqual(
            rules.filter(([, rule]) => rule.env === LISTS_MARKET_TIME_ENV).map(([key]) => key),
            LISTS_MARKET_TIME_KEYS,
        );

        const bare = listsMarketRows(undefined, undefined);
        const heightArmed = listsMarketRows('41', undefined);
        const timeArmed = listsMarketRows(undefined, '1790812800');

        assert.deepEqual(
            LISTS_MARKET_KEYS.filter((key) => heightArmed.get(key).regtest !== bare.get(key).regtest),
            LISTS_MARKET_HEIGHT_KEYS,
        );
        assert.deepEqual(
            LISTS_MARKET_KEYS.filter((key) => timeArmed.get(key).regtest !== bare.get(key).regtest),
            LISTS_MARKET_TIME_KEYS,
        );
        for (const key of LISTS_MARKET_HEIGHT_KEYS) assert.equal(heightArmed.get(key).regtest, 41, key);
        for (const key of LISTS_MARKET_TIME_KEYS) assert.equal(timeArmed.get(key).regtest, 1790812800, key);
    });

    test('disabled lists and market arming leaves committed and public-network values intact', () => {
        const bare = listsMarketRows(undefined, undefined);
        const disabled = listsMarketRows('off', 'off');
        const armed = listsMarketRows('41', '1790812800');

        for (const key of LISTS_MARKET_KEYS) {
            assert.equal(bare.get(key).regtest, 0, `${key} committed regtest`);
            assert.equal(disabled.get(key).regtest, 0, `${key} disabled regtest`);
            for (const network of ['mainnet', 'testnet']) {
                assert.equal(armed.get(key)[network], bare.get(key)[network], `${key} ${network}`);
            }
        }
    });
});
