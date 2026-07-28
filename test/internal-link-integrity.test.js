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
 * Internal link integrity gate.
 *
 * WHY. The 2026-07-27 docs audit resolved every relative link in the set and
 * found 13 dead in-page anchors. None of them were typos in the usual sense:
 * every one assumed that punctuation in a heading becomes a hyphen in the
 * slug, so `## Asking the Outside World: The Attestation Framework` was linked
 * as `#asking-the-outside-world--the-attestation-framework`. The docs site
 * DELETES punctuation instead, so the real slug carries a single hyphen and
 * all thirteen links landed nowhere. They render as ordinary links and fail
 * silently in the reader's browser, which is why they accumulated unnoticed.
 *
 * WHAT IT CHECKS.
 *
 *   1. Every relative link and image target resolves to a file on disk.
 *   2. Every `#fragment`, in-page or cross-page, matches a heading in the
 *      target file, slugged exactly as the site slugs it.
 *
 * External links (http/https/mailto) are not fetched: a network call in the
 * test suite trades a real check for a flaky one.
 *
 * THE SLUG RULE IS COPIED, SO IT IS ALSO PINNED. `slugify` below must match
 * xchain-websites/docs.xchain.io/build/docs.build.js, which is the code that
 * actually renders the site. A copy that silently drifts would validate
 * anchors against a rule the site does not use, which is worse than not
 * checking: the suite would go green while the links stayed dead. The last
 * test reads the site's own source when that sibling repo is present and
 * fails if the two rules disagree; it skips in a standalone clone.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const path = require('node:path');

const DOC_ROOT   = path.join(__dirname, '..');
const SITE_BUILD = path.resolve(DOC_ROOT, '../xchain-websites/docs.xchain.io/build/docs.build.js');

// Must match the site's markdown-it-anchor slugify. Punctuation is removed,
// not replaced; runs of whitespace collapse to one hyphen.
const slugify = (s) => s.toLowerCase().trim().replace(/[^\w\- ]/g, '').replace(/\s+/g, '-');

function markdownFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) markdownFiles(p, out);
        else if (e.name.endsWith('.md')) out.push(p);
    }
    return out;
}

const FILES = markdownFiles(DOC_ROOT);

// file -> Set(slug). Fenced code blocks are skipped so a `# comment` line in a
// bash example is not mistaken for a heading.
const HEADINGS = new Map();
for (const f of FILES) {
    const set = new Set();
    let fenced = false;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
        if (fenced) continue;
        const m = /^#{1,6}\s+(.*)$/.exec(line);
        if (m) set.add(slugify(m[1]));
    }
    HEADINGS.set(f, set);
}

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const rel  = (p) => path.relative(DOC_ROOT, p);

describe('internal link integrity', () => {

    test('every relative link resolves to a file that exists', () => {
        const broken = [];
        for (const f of FILES) {
            const text = fs.readFileSync(f, 'utf8');
            LINK.lastIndex = 0;
            let m;
            while ((m = LINK.exec(text)) !== null) {
                const target = m[1];
                if (/^(https?:|mailto:|#)/.test(target)) continue;
                const file = target.split('#')[0];
                if (!file) continue;
                if (!fs.existsSync(path.resolve(path.dirname(f), file)))
                    broken.push(`${rel(f)} -> ${target}`);
            }
        }
        assert.deepEqual(broken, [], 'links pointing at files that do not exist:\n  ' + broken.join('\n  '));
    });

    test('every #fragment matches a heading in its target file', () => {
        const dangling = [];
        for (const f of FILES) {
            const text = fs.readFileSync(f, 'utf8');
            LINK.lastIndex = 0;
            let m;
            while ((m = LINK.exec(text)) !== null) {
                const target = m[1];
                if (/^(https?:|mailto:)/.test(target)) continue;
                const [file, frag] = target.split('#');
                if (!frag) continue;
                const abs = file ? path.resolve(path.dirname(f), file) : f;
                if (!abs.endsWith('.md') || !fs.existsSync(abs)) continue;   // covered by the test above
                const set = HEADINGS.get(abs);
                if (set && !set.has(frag.toLowerCase()))
                    dangling.push(`${rel(f)} -> ${target}`);
            }
        }
        assert.deepEqual(dangling, [], 'anchors matching no heading (remember: the site DELETES punctuation, ' +
            'so "Foo: Bar" slugs to #foo-bar, not #foo--bar):\n  ' + dangling.join('\n  '));
    });

    // Without this, the copy above could drift from the renderer and quietly
    // start validating against a rule the site does not use.
    test('the slug rule still matches the docs site', { skip: !fs.existsSync(SITE_BUILD) && 'xchain-websites not present in this checkout' }, () => {
        const source = fs.readFileSync(SITE_BUILD, 'utf8');
        const m = /slugify:\s*\(s\)\s*=>\s*([^\n]+?)\s*\}\)/.exec(source);
        assert.ok(m, 'could not find the slugify option in docs.build.js; this gate needs updating');

        const siteSlugify = new Function('s', 'return ' + m[1]);
        // Exercise the shapes that actually appear in the headings here.
        for (const sample of [
            'Asking the Outside World: The Attestation Framework',
            'Contract-Targeted Staking: `xchain.contract.*`',
            'ORDER offers & partial fills',
            'Sleep / Pause an Address',
            'Proceeds split (royalty / fee `payout_legs`)',
            '`signIn(params)`: Sign-In with XChain',
        ]) {
            assert.equal(slugify(sample), siteSlugify(sample),
                'the local slug rule disagrees with the site for: ' + sample);
        }
    });
});
