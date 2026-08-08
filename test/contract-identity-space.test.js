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
 * Contract identity-space gate for documented VM examples.
 *
 * WHY. XChain contracts carry two identity spaces that never mix: method
 * callers, admins and SLASH_DESTINATION are base-chain addresses, and
 * xchain.getSourceAddress() is the only accessor for one; stakers are keyed by
 * their Ed25519 signing pubkey, which is what getStake/slash/STAKE v3 use.
 * Conflating them fails closed and silently: getStake(<an address>) returns
 * '0' for every real staker, and an admin stored as a pubkey can never equal
 * getSourceAddress(), so the guard returns 'unauthorized' unconditionally.
 *
 * #3909 and #3910 found both halves in build-a-stakeable-contract.md, a
 * copy-pasteable public tutorial: getSecret gated on getStake(caller, ...) and
 * so granted access to nobody, and slashStaker compared an address caller
 * against a stored adminPubkey and so slashed for nobody.
 *
 * WHAT IT CHECKS, over every ```js fence in the docs tree.
 *
 *   1. No value read from getSourceAddress() reaches a pubkey-keyed accessor
 *      (getStake / slash / getStakerAmount) as its subject argument.
 *   2. No state key that is later compared against getSourceAddress() is
 *      seeded from a pubkey-named variable.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'test']);

// Every ```js fence in the tree, tagged with its file and starting line.
function jsFences() {
    const out = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { walk(p); continue; }
            if (!e.name.endsWith('.md')) continue;
            const lines = fs.readFileSync(p, 'utf8').split('\n');
            let open = null;
            lines.forEach((line, i) => {
                if (open === null) {
                    if (/^\s*```(js|javascript)\s*$/.test(line)) open = i;
                    return;
                }
                if (/^\s*```\s*$/.test(line)) {
                    out.push({ file: path.relative(DOC_ROOT, p), line: open + 2, code: lines.slice(open + 1, i).join('\n') });
                    open = null;
                }
            });
        }
    };
    walk(DOC_ROOT);
    return out;
}

// Pubkey-keyed accessors: their subject argument is a staker signing pubkey.
const PUBKEY_KEYED = ['getStake', 'slash', 'getStakerAmount'];

describe('contract identity spaces in documented examples', () => {

    test('no address from getSourceAddress() is fed to a pubkey-keyed accessor', () => {
        const offenders = [];

        for (const fence of jsFences()) {
            // Variables bound to the caller address in this fence.
            const addressVars = new Set(
                [...fence.code.matchAll(/\b(?:var|let|const)\s+([A-Za-z0-9_$]+)\s*=\s*[A-Za-z0-9_$.]*\bgetSourceAddress\s*\(/g)]
                    .map((m) => m[1]),
            );
            if (addressVars.size === 0) continue;

            for (const accessor of PUBKEY_KEYED) {
                const re = new RegExp(`\\b${accessor}\\s*\\(\\s*([A-Za-z0-9_$.]+)`, 'g');
                for (const m of fence.code.matchAll(re)) {
                    const subject = m[1];
                    const bare = subject.replace(/^xchain\./, '');
                    if (!addressVars.has(subject) && !addressVars.has(bare)) continue;
                    offenders.push(
                        `${fence.file}:~${fence.line}  ${accessor}(${subject}) - ` +
                        `${subject} holds a base-chain address; these accessors are keyed by signing pubkey`,
                    );
                }
                // Inline form: getStake(xchain.getSourceAddress(), ...)
                const inline = new RegExp(`\\b${accessor}\\s*\\(\\s*[A-Za-z0-9_$.]*\\bgetSourceAddress\\s*\\(`, 'g');
                for (const _ of fence.code.matchAll(inline)) {
                    offenders.push(
                        `${fence.file}:~${fence.line}  ${accessor}(getSourceAddress()) - ` +
                        'these accessors are keyed by signing pubkey, not by address',
                    );
                }
            }
        }

        assert.deepEqual(offenders, [],
            'documented examples feeding an address into a pubkey-keyed accessor:\n  ' + offenders.join('\n  '));
    });

    test('no state key compared against getSourceAddress() is seeded from a pubkey', () => {
        const offenders = [];
        const PUBKEY_NAMED = /pubkey|pubKey|publicKey/i;

        for (const fence of jsFences()) {
            // State keys read back and compared against the caller address.
            const compared = new Set();
            for (const m of fence.code.matchAll(/\bstate\.get\s*\(\s*'([^']+)'/g)) {
                const key = m[1];
                const usesCaller = new RegExp(
                    `(${key}\\s*[!=]==?|[!=]==?\\s*[A-Za-z0-9_$.]*\\b${key})`,
                ).test(fence.code);
                if (usesCaller || /getSourceAddress\s*\(/.test(fence.code)) compared.add(key);
            }
            if (compared.size === 0) continue;
            if (!/getSourceAddress\s*\(/.test(fence.code)) continue;

            for (const m of fence.code.matchAll(/\bstate\.set\s*\(\s*'([^']+)'\s*,\s*([A-Za-z0-9_$.]+)\s*\)/g)) {
                const [, key, value] = m;
                if (!compared.has(key)) continue;
                if (!PUBKEY_NAMED.test(value)) continue;
                offenders.push(
                    `${fence.file}:~${fence.line}  state.set('${key}', ${value}) - ` +
                    `'${key}' is compared against getSourceAddress(), so it must hold an address, not a pubkey`,
                );
            }
        }

        assert.deepEqual(offenders, [],
            'documented examples storing a pubkey where an address comparison expects an address:\n  ' +
            offenders.join('\n  '));
    });
});
