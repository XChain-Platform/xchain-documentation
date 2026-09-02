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
 * Drift lint for the VM consensus wall-clock rule as this documentation set
 * states it.
 *
 * WHY. The per-execution wall-clock budget stopped being a node setting and
 * became a consensus quantity: at/after the gate every node runs a consensus
 * execution against `CONSENSUS_MAX_WALL_MS`, whatever its own
 * `limits.maxCpuTimeMs` says. Status and `gasUsed` are both consensus-visible,
 * so a node that still bound executions with its own knob would commit
 * different bytes for the same block than its peers. For a while the rule was
 * live in `xchain-vm` and described nowhere a third-party implementer reads:
 * the VM configuration page still presented `maxCpuTimeMs` as the wall-clock
 * limit, with no note that it stops binding. This guard exists so that gap
 * cannot silently reopen, in either direction:
 *
 *   1. the millisecond figure and the constant's name on the pages that quote
 *      them stay equal to what `xchain-vm` declares today;
 *   2. the activation the pages describe (testnet and regtest from genesis,
 *      mainnet and any unknown network at the contract-era flag day, a
 *      non-finite block time pre-activation) stays equal to what
 *      `isConsensusWallClockActive` actually resolves;
 *   3. the flag-day block time the VM rides is still the same instant the
 *      generated Flag Days page publishes, since the VM page sends the reader
 *      there instead of quoting a date.
 *
 * Values are read out of the sibling source, never typed here, and every
 * assertion SKIPS when the sibling checkout is absent rather than failing:
 * the same convention fee-and-limit-claims.test.js uses.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const test   = require('node:test');
const fs     = require('node:fs');
const path   = require('node:path');

const ROOT   = path.resolve(__dirname, '..');
const VM_SRC = path.resolve(ROOT, '../xchain-vm/src');

const WALL_CLOCK_JS = path.join(VM_SRC, 'consensus-wall-clock.js');
const VM_INDEX_JS   = path.join(VM_SRC, 'index.js');

const haveVm = fs.existsSync(WALL_CLOCK_JS) && fs.existsSync(VM_INDEX_JS);
const noVm   = 'sibling xchain-vm not present in this checkout';

const readDoc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readVm  = (file) => fs.readFileSync(file, 'utf8');

const CONFIG_PAGE    = 'components/vm/configuration.md';
const OPERATIONS_PAGE = 'components/vm/operations.md';
const FLAG_DAYS_PAGE = 'protocol/flag-days.md';

// Pull `const NAME = <integer>;` out of a VM source file.
function sourceConstant(src, name, where) {
    const m = new RegExp(`^const ${name}\\s*=\\s*(\\d+);`, 'm').exec(src);
    assert.ok(m, `${name} declaration not found in ${where}; `
        + 'the declaration shape changed, re-point this regex');
    return Number(m[1]);
}

// The whole body of the network-aware activation resolver, so the doc's
// activation table is compared against the code that decides it and not
// against a comment near it.
function activationBody(src) {
    const m = /function isConsensusWallClockActive\(network, blockTime\) \{([\s\S]*?)\n\}/
        .exec(src);
    assert.ok(m, 'isConsensusWallClockActive not found in xchain-vm/src/index.js; '
        + 'the resolver was renamed or reshaped, re-point this regex');
    return m[1];
}

test('the wall-clock budget the VM pages quote is the constant xchain-vm declares',
    { skip: !haveVm && noVm }, () => {
        const declared = sourceConstant(readVm(WALL_CLOCK_JS), 'CONSENSUS_MAX_WALL_MS',
            'xchain-vm/src/consensus-wall-clock.js');
        const printed  = `${declared.toLocaleString('en-US')} ms`;

        for (const page of [CONFIG_PAGE, OPERATIONS_PAGE]) {
            const doc = readDoc(page);
            assert.ok(doc.includes('CONSENSUS_MAX_WALL_MS'),
                `${page} does not name CONSENSUS_MAX_WALL_MS; the consensus wall-clock `
                + 'rule is live in xchain-vm and must stay described here');
            assert.ok(doc.includes(printed),
                `${page} does not state the consensus wall-clock budget as "${printed}"; `
                + `xchain-vm declares CONSENSUS_MAX_WALL_MS = ${declared}`);
        }
    });

test('the enforcing VM re-exports the same constant the budget module declares',
    { skip: !haveVm && noVm }, () => {
        const wallClock = readVm(WALL_CLOCK_JS);
        const index     = readVm(VM_INDEX_JS);

        assert.match(wallClock, /module\.exports\s*=\s*\{[\s\S]*CONSENSUS_MAX_WALL_MS/,
            'consensus-wall-clock.js no longer exports CONSENSUS_MAX_WALL_MS; the docs '
            + 'present it as a readable protocol constant');
        assert.match(index, /module\.exports\.CONSENSUS_MAX_WALL_MS\s*=\s*CONSENSUS_MAX_WALL_MS;/,
            'xchain-vm/src/index.js no longer re-exports CONSENSUS_MAX_WALL_MS');
    });

test('the activation the VM configuration page describes is the one the VM resolves',
    { skip: !haveVm && noVm }, () => {
        const body = activationBody(readVm(VM_INDEX_JS));

        // Pre-launch networks: unconditional, no flag-day comparison in that arm.
        assert.match(body, /network === 'testnet'/,
            'the activation no longer special-cases testnet; the docs say testnet is '
            + 'genesis-active for this rule');
        assert.match(body, /network === 'regtest'/,
            'the activation no longer special-cases regtest; the docs say regtest is '
            + 'genesis-active for this rule');
        assert.match(body, /(testnet|regtest)'[\s\S]*?return true;/,
            'the pre-launch networks no longer resolve unconditionally active');

        // Everything else, mainnet and any unknown or empty network alike,
        // waits for the flag-day block time and treats a non-finite block time
        // as pre-activation.
        assert.match(body, /BINARY_ALLOC_GATE_BLOCK_TIME/,
            'the activation no longer rides BINARY_ALLOC_GATE_BLOCK_TIME; the docs send '
            + 'the reader to the contract-era flag day for the mainnet threshold');
        assert.match(body, /Number\.isFinite\(blockTime\)/,
            'the activation no longer requires a finite block time; the docs state that a '
            + 'block time that is not a finite number resolves to pre-activation');

        const doc = readDoc(CONFIG_PAGE);
        assert.ok(/Unknown or unset/.test(doc),
            `${CONFIG_PAGE} no longer states how an unknown or unset network resolves`);
        assert.ok(doc.includes('does not bind a consensus execution'),
            `${CONFIG_PAGE} no longer states that limits.maxCpuTimeMs stops binding a `
            + 'consensus execution, which is the whole point of the rule');
    });

test('the flag day the VM rides is the contract-era instant the generated page publishes',
    { skip: !haveVm && noVm }, () => {
        const gate = sourceConstant(readVm(VM_INDEX_JS), 'BINARY_ALLOC_GATE_BLOCK_TIME',
            'xchain-vm/src/index.js');
        const flagDays = readDoc(FLAG_DAYS_PAGE);

        const m = /\*\*Mainnet block time\*\*\s*\|\s*`(\d+)`/.exec(flagDays);
        assert.ok(m, 'the contract-era flag-day block time was not found on '
            + `${FLAG_DAYS_PAGE}; the generated table shape changed, re-point this regex`);
        assert.equal(Number(m[1]), gate,
            'the VM consensus wall-clock gate no longer rides the contract-era flag day '
            + `published on ${FLAG_DAYS_PAGE}; ${CONFIG_PAGE} sends the reader there for `
            + 'the mainnet threshold and would now be wrong');

        assert.ok(readDoc(CONFIG_PAGE).includes('protocol/flag-days.md'),
            `${CONFIG_PAGE} no longer links the mainnet threshold to the generated `
            + 'Flag Days page; it must never quote the date inline');
    });

test('the CPU-time knob is documented as non-binding for consensus executions',
    { skip: !haveVm && noVm }, () => {
        const index = readVm(VM_INDEX_JS);
        assert.match(index, /_wallClockBudgetMs/,
            'the per-execution budget resolver is gone from xchain-vm/src/index.js; the '
            + 'docs describe a resolved budget rather than the raw knob');

        const doc = readDoc(CONFIG_PAGE);
        const row = /\|\s*CPU timeout\s*\|[^\n]*\n/.exec(doc);
        assert.ok(row, `${CONFIG_PAGE} no longer carries the maxCpuTimeMs row`);
        assert.match(row[0], /ungated/,
            `${CONFIG_PAGE} presents maxCpuTimeMs without saying it bounds ungated `
            + '(non-consensus) executions only; that is the claim that was wrong before '
            + 'the consensus budget was mirrored here');
    });
