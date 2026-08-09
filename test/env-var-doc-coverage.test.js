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
 * Environment-variable documentation coverage gate .
 *
 * WHY. The 2026-07-27 docs audit found 169 environment variables that the
 * services read and the doc set never mentioned. Nothing had gone wrong; the
 * gap simply accumulated, one tuning knob at a time, because no check ever
 * compared `process.env` reads against the documented set. The audit closed
 * the gap with a throwaway script, which means the gap re-opens at the rate
 * the services grow. This is that script, checked in, so the next
 * undocumented variable fails the build instead of waiting for the next audit.
 *
 * WHAT IT CHECKS, and why the scanner lives elsewhere: the rules are in
 * ../lib/env-var-doc-coverage.js, because this suite is no longer their only
 * caller. It only ran when somebody ran the docs suite, so a service repo
 * could add a variable and leave the gate red indefinitely with no signal;
 * bin/check-env-var-doc-coverage.js at the platform root is the cross-repo
 * trigger that fixes that , and it applies these exact rules.
 *
 * WHICH TREE THIS SUITE READS. The sibling services are read at their
 * COMMITTED state, this repo's own pages as they sit on disk. Reading a
 * sibling's working tree is what made this gate unusable on a shared
 * checkout: on 2026-08-06 it went red on two variables that existed only in
 * another session's uncommitted experiment in xchain-indexer, for an API that
 * might never land in that shape. Our own pages stay working-tree, because a
 * suite that ignored the doc row you just wrote would be useless to edit
 * against. Full reasoning in the library header.
 *
 * WHY THE HARNESS HAS ITS OWN TESTS. The audit's first default-checker
 * reported false green: the regex meant to drop the radix argument of
 * `parseInt(x, 10)` swallowed the default it was supposed to read, so a pass
 * over ~145 sites was partly vacuous, and it was only caught by accident. A
 * silent checker is worse than no checker, so `extractDefault` and the
 * scanners are exercised against fixtures below, including that exact case.
 * Those self-tests run everywhere, including in a standalone clone of this
 * repo where the sibling service checkouts are absent.
 *
 ********************************************************************/

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const cov = require('../lib/env-var-doc-coverage.js');

const {
    ENV_READ, extractDefault, scanSource, docLinesFor, defaultDocumented, isSourcePath,
} = cov;

// This repo sits beside the service repos in the platform tree. In a
// standalone clone the siblings are absent and the coverage half of this
// suite skips; the harness self-tests still run.
const DOC_ROOT      = path.join(__dirname, '..');
const PLATFORM_ROOT = path.join(DOC_ROOT, '..');

/*  ------------------------------------------------------------------
 *  Harness self-tests: these run everywhere, siblings or not
 *  ------------------------------------------------------------------ */

describe('extractDefault (the checker that reported false green during the audit)', () => {
    const defaultOf = (line) => {
        ENV_READ.lastIndex = 0;
        const m = ENV_READ.exec(line);
        assert.ok(m, `fixture has no env read: ${line}`);
        return extractDefault(line, m.index + m[0].length);
    };

    test('reads the default past a parseInt radix argument', () => {
        // The exact shape the audit's regex swallowed.
        assert.deepEqual(
            defaultOf("const t = parseInt(process.env.NODE_RPC_TIMEOUT, 10) || 60000;"),
            { value: '60000', numeric: true }
        );
    });

    test('reads a default that sits inside the parseInt call', () => {
        assert.deepEqual(
            defaultOf("const t = parseInt(process.env.NODE_RPC_TIMEOUT || '30000', 10);"),
            { value: '30000', numeric: true }
        );
    });

    test('walks past non-literal fallbacks to the real default', () => {
        assert.deepEqual(
            defaultOf("this.max = parseInt(process.env.ANCHOR_QUEUE_MAX || cfg.ANCHOR_QUEUE_MAX || '500');"),
            { value: '500', numeric: true }
        );
    });

    test('reads a bare || default', () => {
        assert.deepEqual(defaultOf("const p = process.env.PORT || 3000;"), { value: '3000', numeric: true });
    });

    test('reads a ?? default', () => {
        assert.deepEqual(defaultOf("const p = Number(process.env.PORT ?? 8080);"), { value: '8080', numeric: true });
    });

    test('reads a string default', () => {
        assert.deepEqual(defaultOf("const h = process.env.DB_HOST || '127.0.0.1';"), { value: '127.0.0.1', numeric: false });
    });

    test('reports no default for a boolean switch', () => {
        assert.equal(defaultOf("const on = process.env.FEATURE === '1';"), null);
    });

    test('reports no default for a bare read', () => {
        assert.equal(defaultOf("const key = process.env.HUB_API_KEY;"), null);
    });

    test('does not leak a default across a statement boundary', () => {
        assert.equal(defaultOf("const key = process.env.HUB_API_KEY; const p = x || 3000;"), null);
    });

    test('does not mistake a later argument for a default', () => {
        assert.equal(defaultOf("logger.warn(process.env.MODE, 'fallback');"), null);
    });
});

describe('scanSource', () => {
    test('finds dot and bracket reads and records their lines', () => {
        const found = scanSource([
            "const a = process.env.ALPHA || 1;",
            "const b = process.env['BETA'] || 'x';"
        ].join('\n'));
        assert.deepEqual([...found.keys()].sort(), ['ALPHA', 'BETA']);
        assert.equal(found.get('ALPHA')[0].line, 1);
        assert.equal(found.get('BETA')[0].default.value, 'x');
    });

    test('ignores a commented-out read', () => {
        const found = scanSource("// const a = process.env.GHOST || 1;");
        assert.equal(found.size, 0);
    });

    test('records every site of a variable read more than once', () => {
        const found = scanSource("const a = process.env.DUP || 1;\nconst b = process.env.DUP || 2;");
        assert.equal(found.get('DUP').length, 2);
    });
});

describe('the production-source predicate', () => {
    // Both readers filter through this one function, so the committed tree and
    // the working tree cannot disagree about what counts as production source.
    test('accepts the source roots and the bare entry file', () => {
        assert.equal(isSourcePath('src/config.js'), true);
        assert.equal(isSourcePath('bin/run.mjs'), true);
        assert.equal(isSourcePath('mcp/server.cjs'), true);
        assert.equal(isSourcePath('index.js'), true);
    });

    test('rejects tests, vendored copies and everything outside the roots', () => {
        assert.equal(isSourcePath('test/unit/db.test.js'), false);
        assert.equal(isSourcePath('src/test/helper.js'), false);
        assert.equal(isSourcePath('modules/xchain-vm/src/vm.js'), false);
        assert.equal(isSourcePath('node_modules/x/index.js'), false);
        assert.equal(isSourcePath('scripts/one-off.js'), false);
        assert.equal(isSourcePath('src/README.md'), false);
        assert.equal(isSourcePath('server.js'), false);
    });
});

describe('the two tree readers (why a neighbour\'s in-flight edit no longer reddens this suite)', () => {
    // Fixture repos under the temp dir, real git, no sibling checkout needed.
    // Identity and signing are pinned per-invocation so these do not depend on
    // (or disturb) the machine's global git config.
    const GIT_ID = [
        '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
    ];
    const git = (dir, ...args) =>
        execFileSync('git', ['-C', dir, ...GIT_ID, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    /** A repo whose src/config.js is committed, then edited but not committed. */
    const fixture = () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envvar-reader-'));
        fs.mkdirSync(path.join(dir, 'src'));
        fs.writeFileSync(path.join(dir, 'src', 'config.js'), 'const p = process.env.COMMITTED || 3000;\n');
        git(dir, 'init', '-q', '-b', 'main');
        git(dir, 'add', '-A');
        git(dir, 'commit', '-q', '-m', 'committed');
        fs.appendFileSync(path.join(dir, 'src', 'config.js'), 'const q = process.env.IN_FLIGHT || 1;\n');
        return dir;
    };

    const readsOf = (reader, dir) => {
        const paths = reader.listPaths(dir, cov.SOURCE_ROOTS).filter(cov.isSourcePath);
        const names = new Set();
        for (const text of reader.readFiles(dir, paths).values()) {
            for (const n of scanSource(text).keys()) names.add(n);
        }
        return names;
    };

    test('the committed reader cannot see an uncommitted read', () => {
        const names = readsOf(cov.committedTreeReader('HEAD'), fixture());
        assert.equal(names.has('COMMITTED'), true);
        assert.equal(names.has('IN_FLIGHT'), false, 'a neighbour\'s uncommitted experiment leaked into the gate');
    });

    test('the working-tree reader sees both, which is why the doc side uses it', () => {
        const names = readsOf(cov.workingTreeReader(), fixture());
        assert.equal(names.has('COMMITTED'), true);
        assert.equal(names.has('IN_FLIGHT'), true);
    });

    test('both readers agree on which paths are production source', () => {
        const dir = fixture();
        fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'test', 'x.test.js'), 'process.env.TEST_ONLY;\n');
        git(dir, 'add', '-A');
        git(dir, 'commit', '-q', '-m', 'a test file');

        const paths = (reader) => reader.listPaths(dir, cov.SOURCE_ROOTS).filter(cov.isSourcePath).sort();
        assert.deepEqual(paths(cov.committedTreeReader('HEAD')), ['src/config.js']);
        assert.deepEqual(paths(cov.workingTreeReader()), ['src/config.js']);
    });
});

describe('doc matching', () => {
    test('a variable name is not matched by a longer name containing it', () => {
        const rows = docLinesFor(['| `XCHAIN_HUB_API_KEY` | the hub key |'], 'HUB_API_KEY');
        assert.deepEqual(rows, []);
    });

    test('a variable is matched inside a table row', () => {
        const rows = docLinesFor(['| `HUB_API_KEY` | the hub key | none |'], 'HUB_API_KEY');
        assert.equal(rows.length, 1);
    });

    test('a documented default is found anywhere in the row', () => {
        assert.equal(defaultDocumented(['| `NODE_RPC_TIMEOUT` | timeout | `30000` |'], '30000'), true);
    });

    test('a `|| 0` default is satisfied by a row that says the feature is off', () => {
        assert.equal(defaultDocumented(['| `MIRROR_MAX_LAG_S` | No | None | warn above this lag |'], '0'), true);
        assert.equal(defaultDocumented(['| `SOME_CAP` | No | `500` | a real number |'], '0'), false);
    });

    test('a wrong documented default is rejected, and a prefix does not count', () => {
        assert.equal(defaultDocumented(['| `NODE_RPC_TIMEOUT` | timeout | `30000` |'], '3000'), false);
        assert.equal(defaultDocumented(['| `NODE_RPC_TIMEOUT` | timeout | `30000` |'], '60000'), false);
    });
});

/*  ------------------------------------------------------------------
 *  The gate itself
 *  ------------------------------------------------------------------ */

const present = cov.presentComponents(PLATFORM_ROOT);

// Reading a sibling at HEAD needs its object database. A service checked out
// without one (an export, a tarball) cannot be judged, and guessing from its
// working tree is the failure this suite is fixing, so it drops out.
const readable = present.filter((c) => cov.isGitRepo(path.join(PLATFORM_ROOT, `xchain-${c}`)));
const unreadable = present.filter((c) => !readable.includes(c));

const siblingsMissing = readable.length === 0;

const survey = siblingsMissing ? new Map() : cov.buildSurvey({
    platformRoot:  PLATFORM_ROOT,
    docRoot:       DOC_ROOT,
    serviceReader: cov.committedTreeReader('HEAD'),
    docReader:     cov.workingTreeReader(),
    components:    readable,
});

describe('environment-variable documentation coverage ', { skip: siblingsMissing ? 'sibling service repos not checked out' : false }, () => {
    test('every checked-out sibling could be read at HEAD', () => {
        // A sibling silently dropping out is how a gate goes green while
        // proving less than it did yesterday , so name it loudly.
        assert.deepEqual(unreadable, [], `checked out but not a git repo, so not gated: ${unreadable.join(', ')}`);
    });

    test('the survey actually found something to check', () => {
        // A refactor that breaks the scanner must not read as a clean bill of
        // health. The services read hundreds of variables between them.
        const total = cov.totalReads(survey);
        assert.ok(total > 300, `only ${total} env reads found across ${readable.length} components; the scanner is probably broken`);
    });

    for (const c of readable) {
        describe(c, () => {
            test('every variable the code reads is documented on this component\'s own pages', () => {
                const undocumented = cov.checkUndocumented(c, survey.get(c));
                assert.deepEqual(
                    undocumented, [],
                    `undocumented in components/${c}/:\n  ${undocumented.join('\n  ')}\n` +
                    `Add a row for each to components/${c}/configuration.md (name, meaning, default).`
                );
            });

            test('documented numeric defaults match the literal on the reading line', () => {
                const wrong = cov.checkDefaultDrift(c, survey.get(c));
                assert.deepEqual(wrong, [], `default drift in components/${c}/:\n  ${wrong.join('\n  ')}`);
            });
        });
    }

    test('a variable read by several components with different defaults says so on each', () => {
        const unflagged = cov.checkDivergentDefaults(survey);
        assert.deepEqual(unflagged, [], `divergent defaults documented on only one side:\n  ${unflagged.join('\n  ')}`);
    });

    test('the known-gap list only shrinks', () => {
        const stale = cov.checkStaleKnownGaps(survey);
        assert.deepEqual(
            stale, [],
            `KNOWN_GAPS entries that no longer describe a gap; delete these lines from lib/env-var-doc-coverage.js:\n  ${stale.join('\n  ')}`
        );
    });
});

// Referenced by the doc-page reader; kept so a standalone clone still fails
// loudly if the components tree goes missing entirely.
test('the components doc tree exists', () => {
    assert.ok(fs.existsSync(path.join(DOC_ROOT, 'components')), 'components/ is missing from the docs repo');
});
