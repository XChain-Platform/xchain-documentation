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
 * Wallet signer-surface gate.
 *
 * WHY. Two failures of the same shape, a year apart in the same doc set:
 *
 *   - The 2026-06-20 round fixed "a non-existent concrete signer class
 *     described as implemented". It fixed one instance. README.md kept listing
 *     `MultisigSigner` among the pluggable signers until 2026-07-27, when the
 *     class still did not exist: Signer.js names it as planned (§17.5), and
 *     keys-signing.md correctly said "planned but not yet implemented", so the
 *     doc set disagreed with itself and the README was the copy readers hit
 *     first.
 *   - `subscribe()` was on the Signer base class and absent from the
 *     architecture.md interface list.
 *
 * A vapour class is worse than a missing one: it sends an integrator looking
 * for an implementation that was never written.
 *
 * WHAT IT CHECKS.
 *
 *   1. Every method on the Signer base class appears in architecture.md.
 *   2. Every `*Signer` class name the docs mention exists in the code, unless
 *      the sentence marks it as planned/not implemented.
 *   3. Every spelled-out "N concrete signers" count matches how many exist.
 *      Check 2 catches a named vapour class but not a bare miscount: #3862 found
 *      keys-signing.md promising "five concrete signer implementations" while its
 *      own body listed four and called MultisigSigner planned.
 *
 * xchain-wallet is a sibling repo, not a dependency; the gate skips when it is
 * absent.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT   = path.join(__dirname, '..');
const WALLET     = path.resolve(DOC_ROOT, '../xchain-wallet');
const SIGNER_SRC = path.join(WALLET, 'packages/core/src/signers/Signer.js');
const ARCH_DOC   = path.join(DOC_ROOT, 'components/wallet/architecture.md');
const haveWallet = fs.existsSync(SIGNER_SRC);

// Methods on the abstract base, excluding the constructor and the protected
// helpers (leading underscore) that are not part of the published surface.
function signerMethods() {
    const src = fs.readFileSync(SIGNER_SRC, 'utf8');
    const names = [...src.matchAll(/^\s{4}(?:async\s+)?([a-zA-Z][A-Za-z0-9_]*)\s*\(/gm)].map((m) => m[1]);
    return [...new Set(names)].filter((n) => n !== 'constructor');
}

// Every *Signer identifier that exists as a class anywhere in the wallet.
function concreteSignerClasses() {
    const found = new Set();
    const walk = (dir) => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!/\.(js|jsx|ts)$/.test(e.name)) continue;
            const src = fs.readFileSync(p, 'utf8');
            for (const m of src.matchAll(/class\s+([A-Za-z0-9_]*Signer)\b/g)) found.add(m[1]);
        }
    };
    walk(path.join(WALLET, 'packages'));
    return found;
}

describe('wallet signer surface', () => {

    test('every Signer base-class method is listed in architecture.md',
        { skip: !haveWallet && 'xchain-wallet not present in this checkout' }, () => {
        const doc = fs.readFileSync(ARCH_DOC, 'utf8');
        const missing = signerMethods().filter((m) => !doc.includes(m + '('));
        assert.deepEqual(missing, [],
            'Signer methods absent from components/wallet/architecture.md:\n  ' + missing.join('\n  '));
    });

    test('no doc presents a signer class that does not exist',
        { skip: !haveWallet && 'xchain-wallet not present in this checkout' }, () => {

        const real = concreteSignerClasses();
        assert.ok(real.size >= 4, 'found only ' + real.size + ' signer classes; the scan is probably broken');

        // A mention is fine when the same SENTENCE says it is not built yet.
        //
        // Sentence-scoped, not line-scoped, and that distinction is load-bearing:
        // the line-scoped first draft of this gate silently passed a planted
        // `PhantomSigner` because the same bullet also said `MultisigSigner` "is
        // planned but not implemented", so one planned mention excused every other
        // name on the line. That bullet is exactly where a vapour class would be
        // added, which made the check worthless precisely where it mattered.
        const PLANNED = /\b(planned|not yet implemented|not implemented|future|proposed)\b/i;
        const offenders = [];

        // Split on sentence boundaries, keeping enough context that "X is planned"
        // stays attached to X.
        const sentencesOf = (line) => line.split(/(?<=[.;])\s+/);

        const walk = (dir) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
                const p = path.join(dir, e.name);
                if (e.isDirectory()) { walk(p); continue; }
                if (!e.name.endsWith('.md')) continue;
                const lines = fs.readFileSync(p, 'utf8').split('\n');
                lines.forEach((line, i) => {
                    for (const sentence of sentencesOf(line)) {
                        const planned = PLANNED.test(sentence);
                        for (const m of sentence.matchAll(/`([A-Za-z0-9_]*Signer)`/g)) {
                            const name = m[1];
                            if (name === 'Signer' || real.has(name)) continue;
                            if (planned) continue;
                            offenders.push(`${path.relative(DOC_ROOT, p)}:${i + 1}  ${name}`);
                        }
                    }
                });
            }
        };
        walk(path.join(DOC_ROOT, 'components/wallet'));

        assert.deepEqual(offenders, [],
            'signer classes named in the docs with no implementation, and not marked planned:\n  ' +
            offenders.join('\n  '));
    });

    test('every spelled-out concrete-signer count matches the code',
        { skip: !haveWallet && 'xchain-wallet not present in this checkout' }, () => {

        // Count from source only: the extension's built bundles re-declare the
        // same classes, and a dist copy is not a fifth signer.
        const concrete = new Set(
            [...concreteSignerClasses()].filter((n) => n !== 'Signer' && n !== 'CoSigner'),
        );
        const expected = concrete.size;
        assert.ok(expected >= 4, 'found only ' + expected + ' concrete signers; the scan is probably broken');

        const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
        const COUNT_RE = /\b(one|two|three|four|five|six|seven|eight|\d+)\s+concrete\s+signers?\b/gi;
        const wrong = [];

        const walk = (dir) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
                const p = path.join(dir, e.name);
                if (e.isDirectory()) { walk(p); continue; }
                if (!e.name.endsWith('.md')) continue;
                fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
                    for (const m of line.matchAll(COUNT_RE)) {
                        const claimed = WORDS[m[1].toLowerCase()] ?? Number(m[1]);
                        if (claimed === expected) continue;
                        wrong.push(`${path.relative(DOC_ROOT, p)}:${i + 1}  claims ${claimed}, code has ${expected}`);
                    }
                });
            }
        };
        walk(path.join(DOC_ROOT, 'components/wallet'));

        assert.deepEqual(wrong, [],
            'concrete-signer counts that disagree with the wallet source (' +
            [...concrete].sort().join(', ') + '):\n  ' + wrong.join('\n  '));
    });
});
