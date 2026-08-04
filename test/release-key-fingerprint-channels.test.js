/*********************************************************************
 *
 * Copyright © 2025–2026 Dankest, LLC
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of XChain Platform. Licensed under the GNU Affero
 * General Public License v3.0 or later; see LICENSE.md.
 *
 **********************************************************************
 *
 * The release-verification recipe's fingerprint references must resolve
 * to a document that actually publishes one.
 *
 * WHY. `components/wallet/release/verify-release.md` told a reader five
 * times to cross-check the release key against `components/wallet/
 * security.md`. That page has no fingerprint in it and never had one:
 * the rails ( §4, K1 policy) publish the fingerprint through two
 * channels OUTSIDE this repository, so the recipe dead-ended at the one
 * step the whole recipe exists for. Every link resolved, so the existing
 * internal-link gate was green throughout: a link can point at a real
 * file and still be a wrong answer, which is the class of defect this
 * file covers and the link gate structurally cannot.
 *
 * WHAT IT CHECKS.
 *
 *   1. Every markdown link on a fingerprint-bearing line of the recipe
 *      points either at one of the two sanctioned channels, at an
 *      in-page section that names them, or at an internal doc that
 *      itself publishes a fingerprint. Nothing else counts.
 *   2. Both channels are named, so a later edit cannot quietly collapse
 *      two independent channels into one. Two channels is the whole
 *      mechanism: one of them alone can be rewritten by whoever owns it.
 *   3. The recipe does NOT carry the fingerprint value itself. A third
 *      transcription is a third thing the key ceremony has to keep in
 *      step, and a stale trust root is worse than a pointer.
 *   4. When the sibling repos are checked out, both channels really are
 *      documents that publish a fingerprint (a value, or a named slot
 *      that states its own empty state while the ceremony is pending).
 *      Skipped in a standalone clone rather than faked.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, '..');
const RECIPE   = path.join(DOC_ROOT, 'components/wallet/release/verify-release.md');

// The two independent channels the rails names ( §4, K1 policy).
// Matched by substring so a trailing slash or a deep link still counts.
const CHANNELS = [
    'github.com/XChain-Platform/xchain-wallet/blob/master/SECURITY.md',
    'https://xchain.io/security',
];

// Must match the site's slugify (see internal-link-integrity.test.js):
// punctuation is deleted, not replaced.
const slugify = (s) => s.toLowerCase().trim().replace(/[^\w\- ]/g, '').replace(/\s+/g, '-');

// A 40-hex GPG fingerprint, bare or in the spaced ten-group form gpg prints.
const FINGERPRINT_VALUE = /\b(?:[0-9A-Fa-f]{4}[  ]+){9}[0-9A-Fa-f]{4}\b|\b[0-9A-Fa-f]{40}\b/;

const read = (p) => fs.readFileSync(p, 'utf8');

// Strip fenced code blocks: a shell example saying `gpg --fingerprint
// <FINGERPRINT>` is not a cross-reference and has no link to check.
function proseLines(text) {
    const out = [];
    let fenced = false;
    text.split('\n').forEach((line, i) => {
        if (/^\s*```/.test(line)) { fenced = !fenced; return; }
        if (!fenced) out.push({ n: i + 1, line });
    });
    return out;
}

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)/g;
const links = (line) => [...line.matchAll(LINK_RE)].map((m) => m[1]);

const isChannel = (target) => CHANNELS.some((c) => target.includes(c));

// Sections of the recipe, keyed by heading slug, so an in-page pointer
// can be checked for what it actually leads the reader to.
function sections(text) {
    const map = new Map();
    let current = null;
    for (const line of text.split('\n')) {
        const h = line.match(/^#{1,6}\s+(.*)$/);
        if (h) { current = slugify(h[1]); map.set(current, []); continue; }
        if (current) map.get(current).push(line);
    }
    return map;
}

describe('release key fingerprint cross-references', () => {
    const text = read(RECIPE);
    const secs = sections(text);

    const fingerprintLinkLines = proseLines(text)
        .filter(({ line }) => /fingerprint/i.test(line) && links(line).length > 0);

    test('the recipe still cross-references the fingerprint somewhere', () => {
        // Guards the guard: if the references were deleted rather than
        // repointed, every check below would pass vacuously.
        assert.ok(
            fingerprintLinkLines.length > 0,
            `${path.relative(DOC_ROOT, RECIPE)} has no linked fingerprint reference at all; ` +
            'the recipe cannot tell a reader where to check the key.',
        );
    });

    test('every fingerprint reference resolves to a document that publishes one', () => {
        const bad = [];
        for (const { n, line } of fingerprintLinkLines) {
            for (const target of links(line)) {
                if (isChannel(target)) continue;

                if (target.startsWith('#')) {
                    const slug = target.slice(1);
                    const body = secs.get(slug);
                    if (!body) {
                        bad.push(`line ${n}: in-page target "${target}" matches no heading`);
                        continue;
                    }
                    const named = CHANNELS.filter((c) => body.join('\n').includes(c));
                    if (named.length !== CHANNELS.length) {
                        bad.push(
                            `line ${n}: in-page target "${target}" leads to a section that names ` +
                            `${named.length} of ${CHANNELS.length} publication channels`,
                        );
                    }
                    continue;
                }

                if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
                    bad.push(`line ${n}: "${target}" is an external URL but not a sanctioned channel`);
                    continue;
                }

                // A relative link to another doc in this set: it may be
                // cited for the fingerprint only if it carries one.
                const resolved = path.resolve(path.dirname(RECIPE), target.split('#')[0]);
                if (!fs.existsSync(resolved)) {
                    bad.push(`line ${n}: "${target}" does not resolve to a file`);
                    continue;
                }
                if (!FINGERPRINT_VALUE.test(read(resolved))) {
                    bad.push(
                        `line ${n}: "${target}" is cited for the fingerprint but ` +
                        `${path.relative(DOC_ROOT, resolved)} publishes none`,
                    );
                }
            }
        }
        assert.deepEqual(bad, [], `dead-end fingerprint references:\n  ${bad.join('\n  ')}`);
    });

    test('both independent channels are named', () => {
        for (const channel of CHANNELS) {
            assert.ok(
                text.includes(channel),
                `${path.relative(DOC_ROOT, RECIPE)} no longer names the channel ${channel}. ` +
                'Two channels is the mechanism; one channel is a trust root its own host can rewrite.',
            );
        }
    });

    test('the recipe does not transcribe the fingerprint itself', () => {
        const offenders = proseLines(text)
            .filter(({ line }) => FINGERPRINT_VALUE.test(line))
            .map(({ n, line }) => `line ${n}: ${line.trim()}`);
        assert.deepEqual(
            offenders, [],
            'the recipe carries a fingerprint value; that is a third copy for the key ceremony ' +
            `to keep in step, and the rails publishes through two channels by design:\n  ${offenders.join('\n  ')}`,
        );
    });

    describe('the channels are documents that publish a fingerprint', () => {
        const wallet   = path.resolve(DOC_ROOT, '../xchain-wallet/SECURITY.md');
        const website  = path.resolve(DOC_ROOT, '../xchain-websites/xchain.io/security/index.html');

        // Pending the key ceremony neither channel carries a VALUE yet, so
        // what is checked is the named slot plus its stated empty state. A
        // channel with no slot at all is the  defect.
        test('channel one: SECURITY.md in xchain-wallet', (t) => {
            if (!fs.existsSync(wallet)) return t.skip('sibling xchain-wallet not checked out');
            const src = read(wallet);
            assert.ok(
                FINGERPRINT_VALUE.test(src) || /PGP fingerprint:/i.test(src),
                'xchain-wallet/SECURITY.md carries neither a fingerprint nor a named slot for one',
            );
            assert.ok(
                src.includes('https://xchain.io/security'),
                'xchain-wallet/SECURITY.md does not name the other channel by URL; two channels ' +
                'that cannot find each other cannot be compared',
            );
        });

        test('channel two: https://xchain.io/security', (t) => {
            if (!fs.existsSync(website)) return t.skip('sibling xchain-websites not checked out');
            const src = read(website);
            assert.ok(
                /id="release-key-fingerprint"/.test(src),
                'the xchain.io security page has no release-key-fingerprint element',
            );
            assert.ok(
                src.includes('xchain-wallet/blob/master/SECURITY.md'),
                'the xchain.io security page does not name the other channel by URL',
            );
        });
    });
});
