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
 * Every sibling source path the documentation names must exist in that sibling.
 *
 * WHY. Nothing here caught a stale path into a sibling repo: proven 2026-09-14,
 * with `node src/migrate.js` restored into both indexer pages after the rename
 * had moved it to `src/migration/migrate.js`, this suite still read 493 pass and
 * exit 0. A layout pass renames dozens of files per repo, and each rename left
 * the pages that cite the old path reading green. This file resolves every
 * cited path against the checkout beside this repo and fails naming each one
 * that is gone, so the next rename fails here instead of on a reader.
 *
 * WHAT counts as a reference, and against what it resolves:
 *   - `xchain-<repo>/<path>` anywhere in the corpus, against that repo;
 *   - a bare `<top>/<path>` on a page under components/<name>/, against
 *     xchain-<name>, when <top> is a top-level entry of that repo (so `api/v1`
 *     and other non-path slashes never count). A line that names another
 *     component ("the indexer's src/actions/index.js" on a VM page) may resolve
 *     in that repo too, and "platform" adds the platform checkout itself.
 *   Either form may carry `:<line>`, and the line must exist in the file.
 *   Resolution follows what a reader would do: the path as written, then a
 *   Node specifier (`+.js`, `/index.js`), then the split convention this
 *   platform uses (`name.js` moved to `name/index.js`).
 *
 * WHAT the venue decides. The bare form is classified against the top-level
 * entries of the component's checkout, so a component whose sibling is absent
 * yields no bare references at all, not a skip per reference. GitHub CI checks
 * out ONE sibling (xchain-indexer, see .github/workflows/ci.yml) and so finds
 * the repo-qualified corpus plus the indexer pages' bare paths, about a quarter
 * of what the platform checkout finds: measured 2026-09-16, 133 against 466.
 * The corpus floor therefore has two parts: the repo-qualified half, which
 * needs no sibling and is judged everywhere, and the whole-corpus floor, which
 * is judged where every declared component sibling is present and otherwise
 * skips NAMING the absent trees (the env-var coverage suite gates its fleet
 * floor the same way). Under XCHAIN_REQUIRE_SIBLINGS=1 an absent declared
 * sibling throws before either floor is read.
 *
 * WHAT is left alone, each for a reason a reader can check:
 *   - HTML comments: the `<!-- ported from ... -->` stamps record where a page
 *     came from, and the source file was deleted by that port;
 *   - CHANGELOG.md: history, true when written;
 *   - placeholders (`<COIN>`, `vX.Y.Z`, `FOO`) and build outputs (dist/,
 *     release-artifacts/), which no checkout carries;
 *   - a path the sibling's own .gitignore ignores (a generated config), since
 *     the page describes a runtime file, not source;
 *   - a path the line places "in the platform checkout" that no sibling has:
 *     the platform root is not a declared sibling, so the venue cannot grade it;
 *   - URLs, where the path after the host is someone else's namespace.
 *
 * Sibling absence goes through test/helpers/sibling_checkout.js like every
 * other cross-repo suite: a named skip on a bare clone, a throw under
 * XCHAIN_REQUIRE_SIBLINGS=1. A repo the docs cite that .ci-siblings does not
 * declare skips by name even under the switch, since the venue never has it.
 */
'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { DOC_ROOT, PLATFORM_ROOT, sibling } = require('./helpers/sibling_checkout.js');

/* ------------------------------------------------------------------ *
 *  Corpus and repo roster
 * ------------------------------------------------------------------ */

// Every tracked page except history and vendored trees, the convention the
// claim suites share.
function markdownFiles(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) markdownFiles(p, out);
        else if (e.name.endsWith('.md') && e.name !== 'CHANGELOG.md') out.push(p);
    }
    return out;
}

/** Repos the venue checks out beside this one, from .ci-siblings. */
function declaredSiblings() {
    return fs.readFileSync(path.join(DOC_ROOT, '.ci-siblings'), 'utf8').split('\n')
        .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

const DECLARED = new Set(declaredSiblings());
// A component page names its repo by directory: components/<name>/ is about xchain-<name>.
const COMPONENT_REPOS = fs.readdirSync(path.join(DOC_ROOT, 'components'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => `xchain-${e.name}`);
const KNOWN_REPOS = new Set([...DECLARED, ...COMPONENT_REPOS, 'xchain-documentation']);

/** Where a repo's tree is read from: this checkout for itself, the sibling slot otherwise. */
function repoRoot(repo) {
    return repo === 'xchain-documentation' ? DOC_ROOT : path.join(PLATFORM_ROOT, repo);
}

/* ------------------------------------------------------------------ *
 *  Classifying a line
 * ------------------------------------------------------------------ */

// A repo-qualified reference. The character before it may not be part of a
// longer path or a URL (`/`, `.`), an npm scope (`@`), a shell variable or
// home (`$`, `~`), or a word.
const EXPLICIT_RE = /(^|[^\w/.@$~-])(xchain-[a-z0-9-]+)\/((?:[\w.-]+\/)*[\w.-]*)(?::(\d+))?/g;
// A bare path with at least one slash, same left context.
const BARE_RE = /(^|[^\w/.@$~-])((?:[\w.-]+\/)+[\w.-]*)(?::(\d+))?/g;

const OUTPUT_DIRS = new Set(['dist', 'build', 'release-artifacts', 'coverage', 'node_modules']);

/** A token no checkout could carry: a template slot or a build product. */
function isPlaceholder(rel) {
    if (/X\.Y\.Z|[<>*{}$]|\b(FOO|BAR|BAZ)\b/.test(rel)) return true;
    return rel.split('/').some((seg) => OUTPUT_DIRS.has(seg));
}

/** The path as a reader would take it: no trailing slash or sentence dot. */
function cleanRel(rel) {
    return rel.replace(/[/.]+$/, '');
}

/** The match runs into a template slot (`src/configs/<COIN>.js`), so it is a prefix, not a path. */
function runsIntoSlot(line, m) {
    return /[<{$*]/.test(line.charAt(m.index + m[0].length));
}

/** `true` when the match at `index` sits inside a URL on this line. */
function insideUrl(line, index) {
    return /https?:\/\/[^\s)>\]]*$/.test(line.slice(0, index + 1));
}

/**
 * The sibling-path references one line makes.
 *
 * @param {string} rawLine
 * @param {object} ctx
 * @param {string|null} ctx.sectionRepo  xchain-<name> for a components/<name>/ page
 * @param {(repo: string) => Set<string>} ctx.topsOf  top-level entries of a repo's tree
 * @param {Set<string>} ctx.known  repo names a reference may name
 * @returns {Array<{repo: string, rel: string, line: number|null, candidates: string[], form: 'explicit'|'bare'}>}
 *   `form` says which grammar matched: 'explicit' needs no sibling tree to be
 *   classified, 'bare' needs the section repo's top-level entries, so the two
 *   are floored apart (see the corpus test).
 */
function referencesIn(rawLine, ctx) {
    const line = rawLine.replace(/<!--.*?-->/g, (m) => ' '.repeat(m.length));
    const out = [];
    let m;
    EXPLICIT_RE.lastIndex = 0;
    while ((m = EXPLICIT_RE.exec(line))) {
        const [, lead, repo, rawRel, ln] = m;
        const rel = cleanRel(rawRel);
        if (!ctx.known.has(repo) || !rel || isPlaceholder(rel) || runsIntoSlot(line, m)) continue;
        if (insideUrl(line, m.index + lead.length)) continue;
        out.push({ repo, rel, line: ln ? Number(ln) : null, candidates: [repo], form: 'explicit' });
    }
    if (!ctx.sectionRepo) return out;
    const sectionTops = ctx.topsOf(ctx.sectionRepo);
    BARE_RE.lastIndex = 0;
    while ((m = BARE_RE.exec(line))) {
        const [, lead, rawRel, ln] = m;
        const rel = cleanRel(rawRel);
        const top = rel.split('/')[0];
        if (!rel || !sectionTops.has(top) || isPlaceholder(rel) || runsIntoSlot(line, m)) continue;
        if (insideUrl(line, m.index + lead.length)) continue;
        // The section repo first; then any repo the line names by its short
        // name, and the platform checkout when the line says "platform".
        const candidates = [ctx.sectionRepo];
        for (const repo of ctx.known) {
            if (repo === ctx.sectionRepo) continue;
            const word = repo.slice('xchain-'.length).replace(/-/g, '[- ]');
            if (new RegExp(`\\b${word}\\b`, 'i').test(line) && ctx.topsOf(repo).has(top)) candidates.push(repo);
        }
        if (/\bplatform\b/i.test(line)) candidates.push('.');
        out.push({ repo: ctx.sectionRepo, rel, line: ln ? Number(ln) : null, candidates, form: 'bare' });
    }
    return out;
}

/* ------------------------------------------------------------------ *
 *  Resolving a reference against a tree
 * ------------------------------------------------------------------ */

/**
 * Where `rel` lands under `root`, the way a reader or require() would look.
 *
 * @returns {{found: string|null, tried: string[]}}
 */
function resolveUnder(root, rel) {
    const abs = path.join(root, rel);
    const tried = [abs, `${abs}.js`, path.join(abs, 'index.js')];
    if (abs.endsWith('.js')) tried.push(path.join(abs.slice(0, -3), 'index.js'));
    return { found: tried.find((p) => fs.existsSync(p)) || null, tried };
}

/** Line `n` exists in the file (a directory has no lines). */
function hasLine(file, n) {
    let stat;
    try { stat = fs.statSync(file); } catch { return false; }
    if (!stat.isFile()) return false;
    return fs.readFileSync(file, 'utf8').split('\n').length >= n;
}

/**
 * Whether the sibling's own .gitignore ignores `rel`: a generated file the page
 * describes at runtime, not a source path. Read from the checkout's real
 * location, since git refuses a pathspec that crosses a symlink.
 */
function ignoredBy(root, rel) {
    let real;
    try { real = path.dirname(fs.realpathSync(path.join(root, 'package.json'))); } catch { return false; }
    try {
        execFileSync('git', ['-C', real, 'check-ignore', '-q', '--', rel], { stdio: 'ignore' });
        return true;
    } catch (err) {
        return false; // status 1: not ignored; anything else: not a repo, so not ignored either
    }
}

/**
 * @returns {{ok: boolean, why: string}} where `why` names what was tried
 */
function checkReference(ref, roots) {
    const tried = [];
    for (const repo of ref.candidates) {
        const root = roots(repo);
        if (!root) continue;
        const r = resolveUnder(root, ref.rel);
        tried.push(...r.tried);
        if (!r.found) continue;
        if (ref.line === null) return { ok: true, why: r.found };
        if (hasLine(r.found, ref.line)) return { ok: true, why: `${r.found}:${ref.line}` };
        tried.push(`${r.found} has fewer than ${ref.line} lines`);
    }
    if (ref.line === null && ref.candidates.some((repo) => roots(repo) && ignoredBy(roots(repo), ref.rel))) {
        return { ok: true, why: 'gitignored in the sibling' };
    }
    if (ref.candidates.includes('.')) return { ok: true, why: 'placed in the platform checkout, which is not a sibling' };
    return { ok: false, why: tried.map((p) => path.relative(PLATFORM_ROOT, p) || p).join(', ') };
}

/* ------------------------------------------------------------------ *
 *  The scan
 * ------------------------------------------------------------------ */

const topsCache = new Map();
function topsOf(repo) {
    if (!topsCache.has(repo)) {
        const root = repo === '.' ? PLATFORM_ROOT : repoRoot(repo);
        let entries = [];
        try { entries = fs.readdirSync(root); } catch { entries = []; }
        topsCache.set(repo, new Set(entries));
    }
    return topsCache.get(repo);
}

function scanCorpus() {
    const refs = [];
    for (const file of markdownFiles(DOC_ROOT)) {
        const rel = path.relative(DOC_ROOT, file);
        const section = rel.match(/^components\/([a-z0-9-]+)\//);
        const sectionRepo = section && KNOWN_REPOS.has(`xchain-${section[1]}`) ? `xchain-${section[1]}` : null;
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((text, i) => {
            for (const ref of referencesIn(text, { sectionRepo, topsOf, known: KNOWN_REPOS })) {
                refs.push({ ...ref, at: `${rel}:${i + 1}` });
            }
        });
    }
    return refs;
}

const REFS = scanCorpus();
const BY_REPO = new Map();
for (const ref of REFS) {
    if (!BY_REPO.has(ref.repo)) BY_REPO.set(ref.repo, []);
    BY_REPO.get(ref.repo).push(ref);
}

/* ------------------------------------------------------------------ *
 *  The classifier and resolver on synthetic input
 * ------------------------------------------------------------------ */

describe('sibling path reference classification', () => {
    const known = new Set(['xchain-indexer', 'xchain-vm', 'xchain-hub']);
    const tops = { 'xchain-indexer': new Set(['src', 'bin', 'package.json']), 'xchain-vm': new Set(['src', 'toolkit.js']), 'xchain-hub': new Set(['src']), '.': new Set(['bin']) };
    const ctx = { sectionRepo: null, topsOf: (r) => tops[r] || new Set(), known };
    const onIndexerPage = { ...ctx, sectionRepo: 'xchain-indexer' };

    test('a repo-qualified path is a reference to that repo, with its line number', () => {
        assert.deepEqual(referencesIn('see `xchain-indexer/src/migration/migrate.js:12` for the loop', ctx),
            [{ repo: 'xchain-indexer', rel: 'src/migration/migrate.js', line: 12, candidates: ['xchain-indexer'], form: 'explicit' }]);
    });

    test('a repo the roster and the components tree do not know is not a reference', () => {
        assert.deepEqual(referencesIn('xchain-nothing/src/a.js', ctx), []);
    });

    test('a provenance comment, a URL and a placeholder are not references', () => {
        assert.deepEqual(referencesIn('<!-- ported 2026-08-02 from xchain-indexer/docs/GONE.md (worktree) -->', ctx), []);
        assert.deepEqual(referencesIn('https://github.com/XChain-Platform/xchain-indexer/blob/master/src/a.js', ctx), []);
        assert.deepEqual(referencesIn('cp xchain-hub/src/coins/FOO.js', ctx), []);
        assert.deepEqual(referencesIn('`xchain-indexer/src/configs/<COIN>.js`', ctx), []);
        assert.deepEqual(referencesIn('unzip release-artifacts/vX.Y.Z/x.zip', onIndexerPage), []);
    });

    test('a bare path counts only on a component page and only under a top-level entry of that repo', () => {
        assert.deepEqual(referencesIn('run `node src/migrate.js` then', ctx), []);
        assert.deepEqual(referencesIn('run `node src/migrate.js` then', onIndexerPage),
            [{ repo: 'xchain-indexer', rel: 'src/migrate.js', line: null, candidates: ['xchain-indexer'], form: 'bare' }]);
        assert.deepEqual(referencesIn('GET api/v1/blocks', onIndexerPage), []);
        assert.deepEqual(referencesIn('a/b in prose', onIndexerPage), []);
    });

    test('a bare path on a page whose sibling tree is absent cannot be classified, an explicit one still is', () => {
        // The venue effect the corpus floor is built around: no tree, no
        // top-level entries, so the bare grammar has nothing to match against.
        const onAbsentSiblingPage = { ...ctx, sectionRepo: 'xchain-sync' };
        assert.deepEqual(referencesIn('run `node src/migrate.js` then', onAbsentSiblingPage), []);
        assert.equal(referencesIn('see xchain-indexer/src/a.js', onAbsentSiblingPage).length, 1);
    });

    test('a line that names another component may resolve there, and "platform" adds the platform root', () => {
        assert.deepEqual(referencesIn("the VM's src/index.js", onIndexerPage)[0].candidates, ['xchain-indexer', 'xchain-vm']);
        assert.deepEqual(referencesIn('bin/check.sh in the platform checkout', onIndexerPage)[0].candidates, ['xchain-indexer', '.']);
    });

    test('a trailing slash or sentence dot is not part of the path', () => {
        assert.equal(referencesIn('under xchain-indexer/src/actions/.', ctx)[0].rel, 'src/actions');
    });
});

describe('sibling path resolution', () => {
    let root;
    test.before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'xchain-docs-paths-'));
        fs.mkdirSync(path.join(root, 'src', 'batch'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'batch', 'index.js'), 'a\nb\nc\n');
        fs.writeFileSync(path.join(root, 'toolkit.js'), '');
        fs.writeFileSync(path.join(root, 'package.json'), '{}\n');
        fs.writeFileSync(path.join(root, '.gitignore'), 'src/config.json\n');
        execFileSync('git', ['init', '-q', root]);
    });
    test.after(() => fs.rmSync(root, { recursive: true, force: true }));

    test('the path as written, a Node specifier, and the split convention all resolve', () => {
        assert.ok(resolveUnder(root, 'src/batch/index.js').found);
        assert.ok(resolveUnder(root, 'toolkit').found, 'require specifier without .js');
        assert.ok(resolveUnder(root, 'src/batch').found, 'directory module');
        assert.ok(resolveUnder(root, 'src/batch.js').found, 'name.js moved to name/index.js');
        assert.equal(resolveUnder(root, 'src/gone.js').found, null);
    });

    test('a cited line must exist in the file', () => {
        const roots = () => root;
        assert.equal(checkReference({ rel: 'src/batch/index.js', line: 4, candidates: ['x'] }, roots).ok, true);
        assert.equal(checkReference({ rel: 'src/batch/index.js', line: 5, candidates: ['x'] }, roots).ok, false);
        assert.equal(checkReference({ rel: 'src/batch', line: 1, candidates: ['x'] }, roots).ok, false, 'a directory has no lines');
    });

    test('a dead reference names every path tried', () => {
        const r = checkReference({ rel: 'src/gone.js', line: null, candidates: ['x'] }, () => root);
        assert.equal(r.ok, false);
        assert.match(r.why, /src\/gone\.js/);
        assert.match(r.why, /src\/gone\/index\.js/);
    });

    test('a missing gitignored runtime file is expected absent, not a dead source citation', () => {
        const roots = () => root;
        const ignored = checkReference({ rel: 'src/config.json', line: null, candidates: ['x'] }, roots);
        const untracked = checkReference({ rel: 'src/missing.json', line: null, candidates: ['x'] }, roots);
        assert.deepEqual(ignored, { ok: true, why: 'gitignored in the sibling' });
        assert.equal(untracked.ok, false, 'an arbitrary missing file must still fail');
    });
});

/* ------------------------------------------------------------------ *
 *  The corpus against the checkouts
 * ------------------------------------------------------------------ */

describe('every sibling source path the documentation cites exists', () => {
    test('the scan found the repo-qualified corpus', () => {
        // The explicit grammar needs only the roster and the components tree,
        // both in this repo, so it is judged on every venue. Measured
        // 2026-09-16: 133 references. A scan reading far under that has lost
        // the corpus or the classifier and must not pass as "nothing to check".
        const explicit = REFS.filter((r) => r.form === 'explicit').length;
        assert.ok(explicit >= 80, `only ${explicit} repo-qualified references found; the scanner is probably broken`);
    });

    // The bare grammar reads each component's checkout, so the whole-corpus
    // floor is a full-checkout figure. A venue missing a declared component
    // sibling (GitHub CI checks out xchain-indexer alone) cannot be held to it
    // and is told which trees it lacks rather than accused of a broken
    // scanner. Undeclared component repos (none of the ci venues ship them)
    // do not gate the floor; their pages' references are a bonus where present.
    const absentTrees = COMPONENT_REPOS.filter((repo) => DECLARED.has(repo) && !sibling(repo, [], { required: false }).have);
    test('the scan found the whole corpus',
        { skip: absentTrees.length ? `whole-corpus floor needs every declared component sibling; absent: ${absentTrees.join(', ')}` : false }, () => {
            // Measured 2026-09-16 in the platform checkout: 466 references
            // (133 repo-qualified and 333 bare) into 15 repos.
            assert.ok(REFS.length >= 300, `only ${REFS.length} references found; the scanner is probably broken`);
            assert.ok(BY_REPO.size >= 8, `references to only ${BY_REPO.size} repos found`);
        });

    for (const repo of [...BY_REPO.keys()].sort()) {
        const refs = BY_REPO.get(repo);
        // Declared siblings go through the switch; a cited repo the venue never
        // checks out skips by name so the switch cannot demand it.
        const declared = DECLARED.has(repo) || repo === 'xchain-documentation';
        const state = repo === 'xchain-documentation'
            ? { skip: false }
            : sibling(repo, [], declared ? {} : { required: false });
        const skip = state.skip ? `${state.skip}${declared ? '' : ' (not in .ci-siblings)'}` : false;

        test(`${repo}: ${refs.length} cited path(s) resolve in the checkout`, { skip }, () => {
            const roots = (r) => {
                if (r === '.') return PLATFORM_ROOT;
                const st = r === repo ? { have: true } : sibling(r, [], { required: false });
                return st.have ? repoRoot(r) : null;
            };
            const dead = [];
            for (const ref of refs) {
                const r = checkReference(ref, roots);
                if (!r.ok) dead.push(`${ref.at}  ${repo}/${ref.rel}${ref.line ? `:${ref.line}` : ''}  (tried ${r.why})`);
            }
            assert.deepEqual(dead, [], `${dead.length} documentation reference(s) into ${repo} point at nothing; `
                + `repoint each at the file the code moved to:\n  ${dead.join('\n  ')}`);
        });
    }
});
