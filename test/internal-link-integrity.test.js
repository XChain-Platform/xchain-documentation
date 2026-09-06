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

// Raw HTML links. The pages that use <table> for the on-chain format specs
// carry their cross-references as <a href="..."> rather than as markdown, and
// LINK cannot see those: two dead ./actions/FILE.md hrefs sat on the normative
// action-resolution table while this suite reported green.
const HTML_LINK = /(?:href|src)\s*=\s*"([^"]+)"/g;

// Pull the relative in-repo targets out of one page's HTML attributes. Fenced
// blocks and inline code spans are skipped: `<script src="dist/...">` inside an
// ```html example is a snippet the reader pastes elsewhere, not a link this
// repo has to resolve.
function htmlTargets(text) {
    const out = [];
    let fenced = false;
    for (const line of text.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
        if (fenced) continue;
        const prose = line.replace(/`[^`]*`/g, '');
        HTML_LINK.lastIndex = 0;
        let m;
        while ((m = HTML_LINK.exec(prose)) !== null) {
            const target = m[1];
            if (/^(https?:|mailto:|#|\/\/|data:)/.test(target)) continue;
            const file = target.split('#')[0];
            if (file) out.push(target);
        }
    }
    return out;
}

// Case-exact resolution. fs.existsSync answers on the DEVELOPER's filesystem,
// which is case-insensitive on macOS, so ./actions/FILE.md "exists" locally and
// 404s on the case-sensitive host that serves the site. Compare each segment
// against the real directory entries instead of asking the filesystem.
function existsCaseExact(abs) {
    const relative = path.relative(DOC_ROOT, abs);
    if (relative === '' || relative.startsWith('..')) return false;
    let dir = DOC_ROOT;
    for (const segment of relative.split(path.sep)) {
        let entries;
        try { entries = fs.readdirSync(dir); } catch { return false; }
        if (!entries.includes(segment)) return false;
        dir = path.join(dir, segment);
    }
    return true;
}

describe('internal link integrity', () => {

    // A link that climbs out of this repo resolves on a developer's monorepo
    // checkout and nowhere else: not in a docs-only clone, and not on the
    // published site, which serves this repo alone. Checked separately from a
    // plain missing file so the failure names the real problem. The convention
    // everywhere else in the set is a GitHub URL for cross-repo references.
    test('no link escapes the documentation repo', () => {
        const escaping = [];
        for (const f of FILES) {
            const text = fs.readFileSync(f, 'utf8');
            LINK.lastIndex = 0;
            let m;
            while ((m = LINK.exec(text)) !== null) {
                const target = m[1];
                if (/^(https?:|mailto:|#)/.test(target)) continue;
                const file = target.split('#')[0];
                if (!file) continue;
                const abs = path.resolve(path.dirname(f), file);
                if (!abs.startsWith(DOC_ROOT + path.sep))
                    escaping.push(`${rel(f)} -> ${target}`);
            }
        }
        assert.deepEqual(escaping, [],
            'relative links pointing outside xchain-documentation. These resolve only in a full ' +
            'monorepo checkout, never on the published site. Use a ' +
            'https://github.com/XChain-Platform/<repo>/blob/master/... URL instead:\n  ' +
            escaping.join('\n  '));
    });

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
                const abs = path.resolve(path.dirname(f), file);
                if (!abs.startsWith(DOC_ROOT + path.sep)) continue;   // reported by the test above
                if (!fs.existsSync(abs))
                    broken.push(`${rel(f)} -> ${target}`);
            }
        }
        assert.deepEqual(broken, [], 'links pointing at files that do not exist:\n  ' + broken.join('\n  '));
    });

    // The scanner and the resolver, exercised on fixtures rather than on the
    // tree. A regex that matched nothing and a resolver that answered "yes" to
    // everything would leave the scan below green forever, and neither failure
    // is visible from a passing run over real files.
    test('the HTML scanner and the case-exact resolver can both say no', () => {
        assert.deepEqual(
            htmlTargets('<a href="./actions/file.md">FILE</a> <a href="https://x.io">x</a> ' +
                        '<a href="#anchor">a</a> <img src="../img/logo.png">'),
            ['./actions/file.md', '../img/logo.png'],
            'the attribute scanner must see relative href and src and skip absolute ones');

        assert.deepEqual(
            htmlTargets('```html\n<script src="dist/bundle.js"></script>\n```\n' +
                        'inline `<img src="dist/bundle.js">` too\n'),
            [],
            'a snippet the reader pastes into their own page is not a link this repo resolves');

        assert.equal(existsCaseExact(path.join(DOC_ROOT, 'protocol/actions/file.md')), true);
        assert.equal(existsCaseExact(path.join(DOC_ROOT, 'protocol/actions/FILE.md')), false,
            'a case-mismatched target must be rejected even where the local filesystem is ' +
            'case-insensitive; the host serving the site is not');
        assert.equal(existsCaseExact(path.join(DOC_ROOT, 'protocol/actions/nope.md')), false);
    });

    test('every relative HTML href/src resolves, case included', () => {
        const broken = [];
        for (const f of FILES) {
            for (const target of htmlTargets(fs.readFileSync(f, 'utf8'))) {
                const abs = path.resolve(path.dirname(f), target.split('#')[0]);
                if (!abs.startsWith(DOC_ROOT + path.sep)) { broken.push(`${rel(f)} -> ${target} (escapes the repo)`); continue; }
                if (!existsCaseExact(abs)) broken.push(`${rel(f)} -> ${target}`);
            }
        }
        assert.deepEqual(broken, [],
            'raw HTML links pointing at files that do not exist under that exact spelling. ' +
            'The docs host is case-sensitive, so ./actions/FILE.md is a 404 even though ' +
            'protocol/actions/file.md is right there:\n  ' + broken.join('\n  '));
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

    // Keep every user-guide page on the curated topical trail the "See also"
    // footers carry. Reachability is NOT the rationale: docs.build.js
    // auto-generates the sidebar from the directory tree, so every sibling
    // already links every page (dist/user-guide/trading.html carries
    // /user-guide/betting). `betting.md` shipped as a first-class guide and was
    // swept into none of the five footers, which is a process miss in the
    // curation, not a broken link.
    //
    // Deliberately weak: at least ONE sibling must link the page. The footers
    // are curated, not exhaustive, and asserting completeness would force every
    // page into every footer.
    test('every user-guide page is linked from at least one sibling footer', () => {
        const dir   = path.join(DOC_ROOT, 'user-guide');
        const pages = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md');

        const linkedFromASibling = new Set();
        for (const from of pages) {
            for (const line of fs.readFileSync(path.join(dir, from), 'utf8').split('\n')) {
                if (!/^\*See also:/.test(line)) continue;
                LINK.lastIndex = 0;
                let m;
                while ((m = LINK.exec(line)) !== null) {
                    const file = m[1].split('#')[0].replace(/^\.\//, '');
                    if (file && file !== from) linkedFromASibling.add(file);
                }
            }
        }

        const orphaned = pages.filter((p) => !linkedFromASibling.has(p));
        assert.deepEqual(orphaned, [],
            'user-guide pages missing from every sibling "See also" footer, so the curated ' +
            'topical trail skips them (the auto-generated sidebar still links them):\n  ' + orphaned.join('\n  '));
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
