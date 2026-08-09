#!/usr/bin/env node
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
 * Generates protocol/flag-days.md from the indexer's activation registry.
 *
 * WHY. Five doc pages and the whitepaper quoted the coordinated
 * contract-era flag-day as a literal DATE. A flag-day date is not a fact about
 * the protocol, it is the current value of a constant, and the constant has
 * been repinned twice (2026-10-01 -> 2026-08-17 -> 2026-08-07). Prose has no
 * way to notice its source moving, so every repin silently rotted a dozen
 * sentences at once, and the 2026-08-06 review found BOTH the pages and the
 * findings that flagged them stale against the same constant.
 *
 * THE REPAIR IS THE DIRECTION OF THE COPY. Rather than sweeping the date into
 * more places and guarding each one, every page now names the GATE and links
 * here, and this one page is generated. A repin regenerates one file; nothing
 * else in the tree carries a value that can rot.
 *
 * WHERE THE VALUES COME FROM. `xchain-indexer/src/protocol_changes.js` is the
 * registry: `addChange(name, version, mainnet_time, ...)` plus the handful of
 * gates declared as `const NAME_MAINNET_TIME`. Three more time-keyed gates ship
 * as standalone sibling modules in the same directory (they are registered next
 * to the query they gate rather than in the registry), so those are read too;
 * leaving them out would publish an inventory that calls itself complete and is
 * not.
 *
 * THE SOURCE IS READ AS TEXT, NOT REQUIRED. `require('protocol_changes.js')`
 * pulls in the indexer's config and database layer, and this must run in a
 * documentation checkout with neither. The same reason claude/bin/
 * vm-gate-timestamp-claim.test.js reads the VM source as text.
 *
 * A standalone documentation clone has no sibling indexer. The generated page
 * is COMMITTED, so such a clone still reads correct values; only regeneration
 * needs the sibling, and test/flag-day-literals.test.js skips its currency
 * check when the sibling is absent rather than failing on a missing repo.
 *
 * Run: node bin/generate-flag-days.js   (from the documentation repo root)
 *
 ********************************************************************/

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.resolve(__dirname, '..');
const INDEXER_SRC = path.resolve(DOC_ROOT, '../xchain-indexer/src');
const REGISTRY = path.join(INDEXER_SRC, 'protocol_changes.js');
const OUTPUT = path.join(DOC_ROOT, 'protocol', 'flag-days.md');

/**
 * Lower bound for "this number is a Unix timestamp, not a block height".
 * Block heights are seven digits today and stay under a billion for centuries;
 * every real activation timestamp is past 2001. The two ranges cannot collide,
 * which is what lets one scan read both kinds of threshold without a per-gate
 * table saying which is which.
 */
const TIMESTAMP_FLOOR = 1_000_000_000;

/**
 * Upper bound past which a value is an UNARMED sentinel rather than a date
 * anybody scheduled. `price_pair_activation.js` parks 9999999999 (year 2286)
 * exactly so no operator reads it as a plan. Publishing it as a flag day would
 * put a fake commitment on a page implementers read.
 */
const SENTINEL_FLOOR = 4_102_444_800; // 2100-01-01T00:00:00Z

/** `2026-08-07 00:00:00 UTC` from a Unix seconds value. */
function utcInstant(seconds) {
    return `${new Date(seconds * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')} UTC`;
}

/** `2026-08-07` from a Unix seconds value. */
function utcDate(seconds) {
    return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/**
 * Every mainnet time-keyed gate the indexer declares, as
 * `{ gate, time, source }`, sorted by time then name so the output is stable
 * across runs (an unstable generator makes every regeneration look like a
 * change).
 */
function collectGates(indexerSrc = INDEXER_SRC) {
    const found = new Map();

    const add = (gate, time, source) => {
        if (!Number.isFinite(time) || time < TIMESTAMP_FLOOR || time >= SENTINEL_FLOOR) return;
        // First declaration wins: the registry is read before the siblings, so
        // a gate that appears in both is attributed to the registry.
        if (!found.has(gate)) found.set(gate, { gate, time, source });
    };

    const registry = fs.readFileSync(path.join(indexerSrc, 'protocol_changes.js'), 'utf8');

    // addChange('NAME', 'version', mainnet_time, ...)
    const changeRe = /addChange\(\s*'([A-Z0-9_]+)'\s*,\s*'([0-9.]+)'\s*,\s*(\d+)/g;
    let match;
    while ((match = changeRe.exec(registry)) !== null) {
        add(match[1], Number(match[3]), 'protocol_changes.js');
    }

    // const NAME_MAINNET_TIME = 1786060800;  (gates the registry declares as a
    // shared constant because a second repo has to stay byte-identical to it)
    const constRe = /const\s+([A-Z][A-Z0-9_]*)_MAINNET_TIME\s*=\s*(\d+)\s*;/g;
    while ((match = constRe.exec(registry)) !== null) {
        add(match[1], Number(match[2]), 'protocol_changes.js');
    }

    // Sibling `*_activation.js` modules: a mainnet threshold above the
    // timestamp floor is a time-keyed gate; below it, a block height, which
    // this page does not cover.
    for (const name of fs.readdirSync(indexerSrc).filter((f) => f.endsWith('_activation.js')).sort()) {
        const text = fs.readFileSync(path.join(indexerSrc, name), 'utf8');
        const m = /^\s*mainnet:\s*(\d+)/m.exec(text);
        if (!m) continue;
        add(name.replace(/\.js$/, '').toUpperCase(), Number(m[1]), name);
    }

    return [...found.values()].sort((a, b) => (a.time - b.time) || a.gate.localeCompare(b.gate));
}

/**
 * The coordinated contract-era flag day: the timestamp the most gates ride.
 * Derived rather than named, because naming it here would reintroduce exactly
 * the hardcoded value this generator exists to remove. Cohort A is 30+ gates
 * on one instant and the outliers are deliberate single rules, so the mode is
 * unambiguous by a wide margin; a tie means the cohort has genuinely split and
 * a human has to say which is the anchor.
 */
function coordinatedFlagDay(gates) {
    const counts = new Map();
    for (const g of gates) counts.set(g.time, (counts.get(g.time) || 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
    if (ranked.length === 0) throw new Error('no mainnet time-keyed gates found; the registry parse is wrong');
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
        throw new Error(
            `two timestamps tie for the coordinated flag day (${ranked[0][0]} and ${ranked[1][0]}, `
            + `${ranked[0][1]} gates each). The cohort has split; name the anchor explicitly rather than deriving it.`,
        );
    }
    return { time: ranked[0][0], count: ranked[0][1] };
}

function render(gates) {
    const anchor = coordinatedFlagDay(gates);
    const others = gates.filter((g) => g.time !== anchor.time);

    const rows = gates.map((g) => {
        const note = g.time === anchor.time ? 'contract-era flag day' : 'own date';
        return `| \`${g.gate}\` | \`${g.time}\` | ${utcInstant(g.time)} | ${note} | \`${g.source}\` |`;
    });

    const outliers = others.length === 0
        ? 'Every mainnet time-keyed gate rides the coordinated instant; none carries a date of its own.'
        : `${others.length === 1 ? 'One gate does' : `${others.length} gates do`} not ride it and `
          + `${others.length === 1 ? 'carries' : 'carry'} a date of its own: `
          + `${others.map((g) => `\`${g.gate}\` at ${utcInstant(g.time)}`).join(', ')}. `
          + 'The reason each is armed separately is on '
          + '[Protocol Activation](./protocol-activation.md#additional-armed-gates-service-carried).';

    return `<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->
<!-- GENERATED FILE. Do not edit: run \`node bin/generate-flag-days.js\`. -->

# Flag-Day Values

**This page is generated** from \`xchain-indexer/src/protocol_changes.js\` and the
time-keyed activation modules beside it. Do not edit it by hand: run
\`node bin/generate-flag-days.js\` from the repository root and commit the result.

Every other page in this documentation set names the **gate** and links here
instead of quoting a date, because a flag-day value is not a fact about the
protocol, it is the current setting of a constant, and it has been repinned
before. One generated page moves on a repin; a dozen sentences do not.

For what a flag day is, how \`isEnabled\` evaluates it, which cohort a gate
belongs to, and what happens to a node that misses one, see
[Protocol Activation](./protocol-activation.md).

## Contract-era flag day

The coordinated instant that the **Cohort A** contract-era rules switch on,
simultaneously on Bitcoin, Litecoin, and Dogecoin.

| | |
|---|---|
| **Mainnet block time** | \`${anchor.time}\` |
| **UTC instant** | ${utcInstant(anchor.time)} |
| **Gates riding it** | ${anchor.count} |

${outliers}

**Testnet and regtest are genesis-active** for the time-keyed gates: they carry
threshold \`0\`, so a testnet or regtest stack has always run the
post-activation behavior. The values on this page are mainnet values only.

## Mainnet time-keyed gates

| Gate | Block time | UTC instant | Rides | Declared in |
|---|---|---|---|---|
${rows.join('\n')}

Thresholds keyed on a **block height** rather than a block time (the
validator-era Cohort B rules and the per-chain Cohort C rules) are not listed
here; they are inventoried on
[Protocol Activation](./protocol-activation.md#the-three-cohorts).
`;
}

function generate(indexerSrc = INDEXER_SRC) {
    return render(collectGates(indexerSrc));
}

if (require.main === module) {
    if (!fs.existsSync(REGISTRY)) {
        console.error(`cannot generate: ${REGISTRY} is not present.\n`
            + 'This generator needs the sibling xchain-indexer checkout. The generated page is\n'
            + 'committed, so a standalone documentation clone reads correct values without it.');
        process.exit(1);
    }
    const text = generate();
    const unchanged = fs.existsSync(OUTPUT) && fs.readFileSync(OUTPUT, 'utf8') === text;
    fs.writeFileSync(OUTPUT, text);
    console.log(`${unchanged ? 'unchanged' : 'WROTE'}  ${path.relative(DOC_ROOT, OUTPUT)}`);
    if (!unchanged) {
        console.log('The flag-day values moved. Stage this page; no prose page needs editing.');
    }
}

module.exports = {
    collectGates, coordinatedFlagDay, render, generate, utcInstant, utcDate,
    DOC_ROOT, INDEXER_SRC, REGISTRY, OUTPUT, TIMESTAMP_FLOOR, SENTINEL_FLOOR,
};
