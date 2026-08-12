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
 * Environment-variable documentation coverage gate.
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
 * trigger that fixes that, and it applies these exact rules.
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

    // The recorded default was `4`, which the row's own `(4 MiB)`
    // gloss then satisfied while the row actually asserts `4194304`.
    test('folds a product of literals into the number the code actually uses', () => {
        assert.deepEqual(
            defaultOf('return parseInt(process.env.EXPLORER_VM_MAX_STATE_BYTES, 10) || 4 * 1024 * 1024;'),
            { value: '4194304', numeric: true }
        );
    });

    test('stops folding at the first non-literal factor', () => {
        assert.deepEqual(defaultOf('const n = process.env.CAP || 4 * factor;'), { value: '4', numeric: true });
    });

    test('reads a string default', () => {
        assert.deepEqual(defaultOf("const h = process.env.DB_HOST || '127.0.0.1';"), { value: '127.0.0.1', numeric: false });
    });

    test('reports no default for a boolean switch', () => {
        assert.equal(defaultOf("const on = process.env.FEATURE === '1';"), null);
    });

    // A CALL fallback is the effective default and no doc row can carry it, so
    // the walk must stop rather than run on to the last-resort literal behind
    // it. Reporting `unknown` here is what would have failed a VALIDATOR_ID row
    // that correctly said "system hostname".
    test('stops at a computed fallback instead of reading past it', () => {
        assert.equal(
            defaultOf("this.validatorId = process.env.VALIDATOR_ID || require('os').hostname() || 'unknown';"),
            null
        );
    });

    test('still walks past a plain lookup to the literal behind it', () => {
        assert.deepEqual(
            defaultOf("const m = process.env.SYNC_MODE || DEFAULTS.SYNC_MODE || 'server';"),
            { value: 'server', numeric: false }
        );
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

    // A numeric coercion taking the read as its ONLY argument leaves the
    // fallback outside its closing paren, where the scanner used to stop dead.
    // The idiom is everywhere: hub, decoder, indexer, sync.
    test('steps out of a single-argument numeric wrapper to reach the default', () => {
        assert.deepEqual(
            defaultOf("this.maxLookbackMs = parseInt(process.env.REORG_MAX_LOOKBACK_MS) || 86400000;"),
            { value: '86400000', numeric: true }
        );
        assert.deepEqual(
            defaultOf("const STALL_ALERT_MS = Number(process.env.DECODER_STALL_ALERT_MS) || 900000"),
            { value: '900000', numeric: true }
        );
        assert.deepEqual(
            defaultOf("const r = parseFloat(process.env.RATE) ?? 0.5;"),
            { value: '0.5', numeric: true }
        );
    });

    test('steps out of at most one wrapper, so an outer expression keeps its own default', () => {
        // `getConfig(...)` is not a numeric coercion, so its trailing fallback
        // describes the config object, not the variable.
        assert.equal(defaultOf("const t = getConfig(process.env.PROFILE).timeout || 5000;"), null);
        // Two closes deep, the second belongs to somebody else.
        assert.equal(defaultOf("const a = wrap(parseInt(process.env.X)) || 5;"), null);
    });

    // parseInt's second argument is a radix and must stay skipped; these
    // helpers' second argument IS the fallback, and skipping it left every
    // sync/indexer/sdk config default unchecked.
    test('reads a helper default that sits where parseInt would take a radix', () => {
        assert.deepEqual(
            defaultOf("config['SYNC_API_PORT'] = parseIntMin0(process.env.SYNC_API_PORT, 3006);"),
            { value: '3006', numeric: true }
        );
        assert.deepEqual(
            defaultOf("limit: concurrencyGate.resolveLimit(process.env.ENCODER_MAX_CONCURRENT_PROBES, 16),"),
            { value: '16', numeric: true }
        );
    });

    test('a helper whose fallback is not a literal still reports no default', () => {
        // The real default is behind another lookup, and guessing the next
        // argument of some enclosing call is how this scanner reports false.
        assert.equal(defaultOf("const v = parseIntMin1(process.env.HUB_PORT, DEFAULTS.PORT), w = f(a, 7);"), null);
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

// These are the reads the scanner cannot name, so the coverage check
// cannot fail on them; the ratchet below is what keeps the set from growing.
describe('scanComputedReads (the blind spot the gate cannot see into)', () => {
    test('finds the computed shapes and leaves the literal ones to scanSource', () => {
        const lines = cov.scanComputedReads([
            "const a = process.env[envVar];",
            "const b = process.env['BETA'];",
            'const c = process.env[`${coin}_INDEXER_URL`];',
            "const d = process.env.DELTA;",
            "const e = process.env[ prefix + '_MAX' ];",
        ].join('\n'));
        assert.deepEqual(lines, [1, 3, 5]);
    });

    test('ignores a commented-out computed read', () => {
        assert.deepEqual(cov.scanComputedReads("// const a = process.env[ghost];"), []);
    });
});

describe('checkComputedReads (the blind-spot ratchet)', () => {
    const entryWith = (n) => ({
        vars: new Map(), docLines: [], docProse: [], sourceFiles: 1,
        computed: Array.from({ length: n }, (_, i) => ({ file: 'src/x.js', line: i + 1 })),
    });
    const baseline = cov.COMPUTED_READ_BASELINE.decoder;

    test('a new computed read fails, because it is new unscannable configuration', () => {
        const problems = cov.checkComputedReads(new Map([['decoder', entryWith(baseline + 1)]]));
        assert.equal(problems.length, 1);
        assert.match(problems[0], /computed env reads, baseline/);
    });

    test('the count holding is clean', () => {
        assert.deepEqual(cov.checkComputedReads(new Map([['decoder', entryWith(baseline)]])), []);
    });

    test('a count that dropped fails too, so the ratchet cannot go stale', () => {
        const problems = cov.checkComputedReads(new Map([['decoder', entryWith(baseline - 1)]]));
        assert.equal(problems.length, 1);
        assert.match(problems[0], /set the baseline to/);
    });

    test('a component the baseline does not cover is skipped, not accused', () => {
        assert.deepEqual(cov.checkComputedReads(new Map([['not-a-component', entryWith(9)]])), []);
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

describe('the working-tree reader\'s error handling', () => {
    // A bare catch here made a file the scanner could not READ look exactly
    // like a file that was never there, so a permission or disk fault produced
    // a survey that reported itself complete. Only the race is benign.
    test('a file that vanished mid-scan is skipped; any other read fault is not', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envvar-readfail-'));
        fs.mkdirSync(path.join(dir, 'src'));
        fs.writeFileSync(path.join(dir, 'src', 'kept.js'), 'const a = process.env.KEPT || 1;\n');
        fs.writeFileSync(path.join(dir, 'src', 'raced.js'), 'const b = process.env.RACED || 1;\n');

        const reader = cov.workingTreeReader();
        const listed = reader.listPaths(dir, cov.SOURCE_ROOTS).filter(cov.isSourcePath).sort();
        assert.deepEqual(listed, ['src/kept.js', 'src/raced.js']);

        // The genuine race: listed a moment ago, gone before the read.
        fs.unlinkSync(path.join(dir, 'src', 'raced.js'));
        assert.deepEqual([...reader.readFiles(dir, listed).keys()], ['src/kept.js']);

        // A directory where a file was listed is an I/O fault, not a race, and
        // silently dropping it is how the survey under-reports while looking
        // clean. EISDIR stands in for the whole class (a chmod-based fixture
        // proves nothing when the suite runs as root).
        fs.mkdirSync(path.join(dir, 'src', 'faulty.js'));
        assert.throws(
            () => reader.readFiles(dir, ['src/faulty.js']),
            (err) => {
                assert.notEqual(err.code, 'ENOENT', 'a non-race fault was reported as a missing file');
                return true;
            },
            'an unreadable file was swallowed, so the survey would report itself complete',
        );
    });

    // The LISTING seam had the same bare catch the read seam was fixed for,
    // and it fails harder: a directory that cannot be listed
    // yields an empty path list, so the component contributes zero variables
    // and every per-component check over it becomes vacuously true.
    test('a prefix that is absent is skipped; a prefix that cannot be reached is not', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envvar-listfail-'));
        const reader = cov.workingTreeReader();

        // Benign, and the common case: almost no service has an mcp/ dir.
        fs.mkdirSync(path.join(dir, 'src'));
        fs.writeFileSync(path.join(dir, 'src', 'config.js'), 'const a = process.env.KEPT || 1;\n');
        assert.deepEqual(reader.listPaths(dir, cov.SOURCE_ROOTS), ['src/config.js']);

        // A self-referential symlink resolves to ELOOP, which stands in for the
        // whole unreachable class and, unlike chmod, still fails under root.
        const loopDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envvar-listloop-'));
        fs.symlinkSync('src', path.join(loopDir, 'src'));
        assert.throws(
            () => reader.listPaths(loopDir, cov.SOURCE_ROOTS),
            (err) => {
                assert.notEqual(err.code, 'ENOENT', 'an unreachable prefix was reported as an absent one');
                return true;
            },
            'an unreachable prefix listed as empty, so the component would survey as having no env reads',
        );
    });

    test('a directory that cannot be listed aborts the walk', { skip: process.getuid && process.getuid() === 0 ? 'chmod does not restrict root' : false }, () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envvar-listperm-'));
        fs.mkdirSync(path.join(dir, 'src', 'inner'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'src', 'inner', 'config.js'), 'const a = process.env.HIDDEN || 1;\n');
        fs.chmodSync(path.join(dir, 'src', 'inner'), 0o000);
        try {
            assert.throws(
                () => cov.workingTreeReader().listPaths(dir, cov.SOURCE_ROOTS),
                (err) => {
                    assert.equal(err.code, 'EACCES');
                    return true;
                },
                'an unreadable subdirectory produced a partial tree that looked complete',
            );
        } finally {
            fs.chmodSync(path.join(dir, 'src', 'inner'), 0o700);
        }
    });
});

describe('a partial survey (the subset the CLI builds when only some siblings are gated)', () => {
    // buildSurvey's `components` list is how bin/check-env-var-doc-coverage.js
    // narrows to the siblings it can actually read at a ref. Everything below
    // this point only ever exercises the FULL survey, so nothing pinned what a
    // subset returns: a narrowed survey that dropped a gated component, or
    // quietly surveyed one it was not asked for, would look like a healthy run.
    const GIT_ID = [
        '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid',
        '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
    ];
    const git = (dir, ...args) =>
        execFileSync('git', ['-C', dir, ...GIT_ID, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    /** A platform root holding a docs repo and two committed service repos. */
    const platform = () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'envvar-partial-'));
        const docRoot = path.join(root, 'xchain-documentation');
        for (const [component, vars] of [['sync', ['ALPHA', 'BETA']], ['hub', ['GAMMA']]]) {
            const repo = path.join(root, `xchain-${component}`);
            fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
            fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: `xchain-${component}` }));
            fs.writeFileSync(path.join(repo, 'src', 'config.js'),
                vars.map((v) => `const x = process.env.${v} || 1;`).join('\n') + '\n');
            git(repo, 'init', '-q', '-b', 'main');
            git(repo, 'add', '-A');
            git(repo, 'commit', '-q', '-m', component);

            fs.mkdirSync(path.join(docRoot, 'components', component), { recursive: true });
            fs.writeFileSync(path.join(docRoot, 'components', component, 'configuration.md'),
                vars.map((v) => `| \`${v}\` | No | \`1\` | a knob |`).join('\n') + '\n');
        }
        return { root, docRoot };
    };

    const surveyOf = (components) => {
        const { root, docRoot } = platform();
        return cov.buildSurvey({
            platformRoot:  root,
            docRoot,
            serviceReader: cov.committedTreeReader('HEAD'),
            docReader:     cov.workingTreeReader(),
            components,
        });
    };

    test('a subset surveys exactly the components it was given', () => {
        const survey = surveyOf(['sync']);
        assert.deepEqual([...survey.keys()], ['sync']);
        assert.deepEqual([...survey.get('sync').vars.keys()].sort(), ['ALPHA', 'BETA']);
    });

    test('totalReads counts the subset only, so a narrowed run cannot borrow another component\'s reads', () => {
        assert.equal(cov.totalReads(surveyOf(['sync'])), 2);
        assert.equal(cov.totalReads(surveyOf(['hub'])), 1);
        assert.equal(cov.totalReads(surveyOf(undefined)), 3);   // both, discovered on disk
    });

    test('a component whose source moved out from under the scanner is named, not averaged away', () => {
        // The failure the fleet-wide read floor cannot see: hub's layout moves,
        // its scan finds nothing, sync's reads still clear the floor, and every
        // hub check then passes over an empty set.
        const { root, docRoot } = platform();
        const hub = path.join(root, 'xchain-hub');
        git(hub, 'mv', 'src', 'lib');
        git(hub, 'commit', '-q', '-m', 'move the source out of the scanned roots');

        const survey = cov.buildSurvey({
            platformRoot:  root,
            docRoot,
            serviceReader: cov.committedTreeReader('HEAD'),
            docReader:     cov.workingTreeReader(),
            components:    ['sync', 'hub'],
        });

        assert.equal(survey.get('hub').sourceFiles, 0);
        assert.equal(survey.get('sync').sourceFiles, 1);
        assert.equal(cov.checkUndocumented('hub', survey.get('hub')).length, 0,
            'the vacuous pass this guard exists to catch');
        assert.deepEqual(cov.checkEmptyScan(survey).length, 1);
        assert.match(cov.checkEmptyScan(survey)[0], /^hub: scanned 0 production source files/);
    });

    test('a component that simply reads no configuration is not accused of a broken scan', () => {
        // The guard counts FILES, not variables, precisely so this stays clean.
        const { root, docRoot } = platform();
        const hub = path.join(root, 'xchain-hub');
        fs.writeFileSync(path.join(hub, 'src', 'config.js'), 'const x = 1;\n');
        git(hub, 'commit', '-q', '-a', '-m', 'no env reads left');

        const survey = cov.buildSurvey({
            platformRoot:  root,
            docRoot,
            serviceReader: cov.committedTreeReader('HEAD'),
            docReader:     cov.workingTreeReader(),
            components:    ['hub'],
        });
        assert.equal(survey.get('hub').vars.size, 0);
        assert.deepEqual(cov.checkEmptyScan(survey), []);
    });

    test('the checks still scope doc lines per component inside a subset', () => {
        const survey = surveyOf(['hub']);
        assert.deepEqual(cov.checkUndocumented('hub', survey.get('hub')), []);
        // sync's rows are on sync's pages, so they cannot cover a hub variable.
        assert.equal(survey.get('hub').docLines.some((l) => l.includes('ALPHA')), false);
    });

    test('the survey separates prose from fenced examples', () => {
        const { root, docRoot } = platform();
        fs.appendFileSync(path.join(docRoot, 'components', 'hub', 'configuration.md'),
            '```bash\nexport GAMMA=999\n```\nGAMMA is also mentioned here.\n');

        const survey = cov.buildSurvey({
            platformRoot:  root,
            docRoot,
            serviceReader: cov.committedTreeReader('HEAD'),
            docReader:     cov.workingTreeReader(),
            components:    ['hub'],
        });
        const entry = survey.get('hub');
        assert.equal(entry.docLines.some((l) => l.includes('export GAMMA=999')), true);
        assert.equal(entry.docProse.some((l) => l.includes('export GAMMA=999')), false,
            'a fenced example counted as an assertion about the default');
        assert.equal(entry.docProse.some((l) => l.includes('also mentioned here')), true,
            'the fence never closed, so every later line was swallowed');
        // The example says 999 and the code says 1; only the prose row is evidence.
        assert.deepEqual(cov.checkDefaultDrift('hub', entry), []);
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

    test('a string default is matched and a wrong one is rejected', () => {
        assert.equal(defaultDocumented(['| `SYNC_MODE` | mode | `server` |'], 'server'), true);
        assert.equal(defaultDocumented(['| `SYNC_MODE` | mode | `client` |'], 'server'), false);
    });

    test('a string default is not read out of a longer word', () => {
        assert.equal(defaultDocumented(['| `SYNC_MODE` | proxied by a webserver |'], 'server'), false);
    });

    test('a dotted string default matches literally, not as a wildcard', () => {
        assert.equal(defaultDocumented(['| `DB_HOST` | host | `127.0.0.1` |'], '127.0.0.1'), true);
        assert.equal(defaultDocumented(['| `DB_HOST` | host | `127a0b0c1` |'], '127.0.0.1'), false);
    });

    // A switch's row names BOTH states by construction, so presence
    // alone passed whichever value the code held. The row below is the shipped
    // REQUIRE_SIGNATURES row, which is why `false` must not satisfy it.
    test('a boolean default must be ASSERTED, not merely mentioned', () => {
        const row = ['| `REQUIRE_SIGNATURES` | No | `true` | When `true`, reject unsigned P2P messages. Defaults to `true` in validator mode; pass `false` to bootstrap a new federation before all nodes have keys. |'];
        assert.equal(defaultDocumented(row, 'true'), true);
        assert.equal(defaultDocumented(row, 'false'), false);
    });

    test('a boolean default asserted only in prose still counts', () => {
        assert.equal(defaultDocumented(['`TELEMETRY_ENABLED` defaults to `true`; set it to `false` to opt out.'], 'true'), true);
        assert.equal(defaultDocumented(['`TELEMETRY_ENABLED` defaults to `true`; set it to `false` to opt out.'], 'false'), false);
    });

    // A NUMBER is masked the same way a switch is, by
    // any other number the row carries. The row below is the shipped
    // EXPLORER_VM_MAX_STATE_BYTES row, whose `(4 MiB)` gloss used to satisfy the
    // `4` that extractDefault recorded for `4 * 1024 * 1024`.
    test('a numeric default must be ASSERTED, not merely mentioned', () => {
        const row = ['| `EXPLORER_VM_MAX_STATE_BYTES` | No | `4194304` (4 MiB) | byte cap |'];
        assert.equal(defaultDocumented(row, '4194304'), true);
        assert.equal(defaultDocumented(row, '4'), false);
    });

    test('a quoted or glossed value is still an assertion', () => {
        assert.equal(defaultDocumented(['| `SLASH_MISSED_ROUNDS_THRESHOLD` | No | `"30"` | missed rounds |'], '30'), true);
        assert.equal(defaultDocumented(['| `SOURCE_QUORUM` | No | `0` (auto) | agreeing sources |'], '0'), true);
        assert.equal(defaultDocumented(['On each round, `ORACLE_REWARD_PER_ROUND` (default "10.00000000") XCHAIN is paid.'], '10.00000000'), true);
    });

    test('a number named only in a description does not document the default', () => {
        const row = ['| `HUB_RATE_LIMIT_RPM` | rate-limited to 100 requests per minute, returns `429` past it |'];
        assert.equal(defaultDocumented(row, '429'), false);
        assert.equal(defaultDocumented(row, '100'), false);
    });

    test('a gloss is one trailing parenthetical, not arbitrary trailing prose', () => {
        assert.equal(defaultDocumented(['| `SOME_CAP` | No | `500` requests before it refuses | cap |'], '500'), false);
    });

    // A neighbour's row mentions this variable because that is how it explains
    // itself, and its own default cell then satisfied this variable's
    // comparison: SOURCE_STRIKE_WINDOW's `200` passed for SOURCE_EVICT_THRESHOLD.
    test('a neighbouring variable\'s row does not assert this variable\'s default', () => {
        const rows = [
            '| `SOURCE_EVICT_THRESHOLD` | No | `3` | Strikes within `SOURCE_STRIKE_WINDOW` before eviction |',
            '| `SOURCE_STRIKE_WINDOW` | No | `200` | Window counted toward `SOURCE_EVICT_THRESHOLD` |',
        ];
        const own = cov.assertingRows(rows, 'SOURCE_EVICT_THRESHOLD');
        assert.equal(own.length, 1);
        assert.equal(defaultDocumented(own, '3'), true);
        assert.equal(defaultDocumented(own, '200'), false);
    });

    test('a row whose leading cell is a label, and plain prose, both still count', () => {
        const rows = [
            '| RPC timeout (axios) | `30000` | BlockchainConnector.js | overridable via `NODE_RPC_TIMEOUT` |',
            '`NODE_RPC_TIMEOUT` defaults to `30000`.',
        ];
        assert.deepEqual(cov.assertingRows(rows, 'NODE_RPC_TIMEOUT'), rows);
    });
});

/*  ------------------------------------------------------------------
 *  The comparators, on synthetic entries
 *  ------------------------------------------------------------------
 *
 *  checkDefaultDrift and checkDivergentDefaults were reachable only through
 *  the real survey, which needs the sibling checkouts, so in a standalone
 *  clone nothing exercised them at all. These fixtures run everywhere.
 */

/**
 * A survey entry. `docProse` defaults to the same lines, since a fixture that
 * says nothing about fences has no fenced content; the fence-sensitive cases
 * below pass the two views separately.
 */
const entryOf = (vars, docLines, docProse = docLines) => ({ vars: new Map(vars), docLines, docProse });

describe('checkDefaultDrift', () => {
    test('a mis-documented STRING default is drift, not a pass', () => {
        // The blind spot itself: extractDefault records
        // `|| 'server'`, and a numeric-only filter used to throw it away, so a
        // row saying `client` sailed through.
        const entry = entryOf(
            [['SYNC_MODE', [{ file: 'src/a.js', line: 1, default: { value: 'server', numeric: false } }]]],
            ['| `SYNC_MODE` | No | `client` | which half to run |'],
        );
        assert.deepEqual(cov.checkDefaultDrift('sync', entry), [
            'SYNC_MODE: code default server (src/a.js:1) appears on no doc line for it',
        ]);
    });

    test('a correctly documented string default is clean', () => {
        const entry = entryOf(
            [['SYNC_MODE', [{ file: 'src/a.js', line: 1, default: { value: 'server', numeric: false } }]]],
            ['| `SYNC_MODE` | No | `server` | which half to run |'],
        );
        assert.deepEqual(cov.checkDefaultDrift('sync', entry), []);
    });

    test('an empty-string default is not compared', () => {
        // `|| ''` is "unset", which a row states in words; and an empty needle
        // matches every row, so comparing it would pass whatever the docs said.
        const entry = entryOf(
            [['NETWORK', [{ file: 'src/a.js', line: 1, default: { value: '', numeric: false } }]]],
            ['| `NETWORK` | No | None | chain and network |'],
        );
        assert.deepEqual(cov.checkDefaultDrift('explorer', entry), []);
    });

    // The reason enabling string comparison did not, on its own, close the case
    // it was reported for: the sync pages carry `SYNC_MODE=server` in an env
    // snippet, twice in `export` lines, in a `docker run -e` flag and in a
    // mermaid node, so the table row could be rewritten to `client` and the
    // check stayed green on the live corpus.
    test('a value shown only in an example does not document the default', () => {
        const entry = entryOf(
            [['SYNC_MODE', [{ file: 'src/a.js', line: 1, default: { value: 'server', numeric: false } }]]],
            ['| `SYNC_MODE` | No | `client` | which half to run |', 'export SYNC_MODE=server'],
            ['| `SYNC_MODE` | No | `client` | which half to run |'],
        );
        assert.deepEqual(cov.checkDefaultDrift('sync', entry), [
            'SYNC_MODE: code default server (src/a.js:1) appears on no doc line for it',
        ]);
    });

    test('a variable named only inside a fence is drift here, not silence', () => {
        // checkUndocumented reads every line and is satisfied, so if this check
        // read prose alone it would skip the variable and nothing would judge
        // its default at all.
        const entry = entryOf(
            [['SYNC_MODE', [{ file: 'src/a.js', line: 1, default: { value: 'server', numeric: false } }]]],
            ['export SYNC_MODE=server'],
            [],
        );
        assert.equal(cov.checkUndocumented('sync', entry).length, 0);
        assert.equal(cov.checkDefaultDrift('sync', entry).length, 1);
    });
});

describe('checkDivergentDefaults', () => {
    test('a string default that differs across components must be said on each', () => {
        const survey = new Map([
            ['sync', entryOf(
                [['SYNC_MODE', [{ file: 'src/a.js', line: 1, default: { value: 'server', numeric: false } }]]],
                ['| `SYNC_MODE` | No | `server` | which half to run |'],
            )],
            ['hub', entryOf(
                [['SYNC_MODE', [{ file: 'src/b.js', line: 2, default: { value: 'client', numeric: false } }]]],
                ['| `SYNC_MODE` | No | `server` | which half to run |'],
            )],
        ]);
        const out = cov.checkDivergentDefaults(survey);
        assert.equal(out.length, 1, `expected the hub side to be flagged, got: ${out.join('; ')}`);
        assert.match(out[0], /^SYNC_MODE defaults to client in hub/);
    });
});

describe('checkStaleKnownGaps (the waiver ratchet)', () => {
    // KNOWN_GAPS is empty, and the only other test asserts the ratchet returns
    // [] against the real survey, so both of its stale branches were dead: a
    // body of `return []` passed the suite. The waiver list is the
    // one place this gate can be told to look away, so the check that keeps it
    // shrinking has to be exercised on a non-empty list.
    test('flags a waiver the code dropped and one the docs now cover, but not a live gap', () => {
        const survey = new Map([
            ['decoder', entryOf(
                [
                    ['NOW_DOCUMENTED', [{ file: 'src/a.js', line: 1, default: null }]],
                    ['STILL_A_GAP', [{ file: 'src/b.js', line: 2, default: null }]],
                    // NO_LONGER_READ is deliberately absent from vars.
                ],
                ['| `NOW_DOCUMENTED` | No | None | a knob |'],
            )],
        ]);

        try {
            cov.KNOWN_GAPS.decoder = ['NO_LONGER_READ', 'NOW_DOCUMENTED', 'STILL_A_GAP'];
            assert.deepEqual(cov.checkStaleKnownGaps(survey), [
                'decoder/NO_LONGER_READ: no longer read by the code',
                'decoder/NOW_DOCUMENTED: now documented',
            ]);
        } finally {
            // Leave the ratchet as we found it; every later check reads it.
            delete cov.KNOWN_GAPS.decoder;
        }
    });

    test('a component with no checkout is skipped rather than reported stale', () => {
        try {
            cov.KNOWN_GAPS.decoder = ['ANYTHING'];
            assert.deepEqual(cov.checkStaleKnownGaps(new Map()), []);
        } finally {
            delete cov.KNOWN_GAPS.decoder;
        }
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

describe('environment-variable documentation coverage', { skip: siblingsMissing ? 'sibling service repos not checked out' : false }, () => {
    test('every checked-out sibling could be read at HEAD', () => {
        // A sibling silently dropping out is how a gate goes green while
        // proving less than it did yesterday, so name it loudly.
        assert.deepEqual(unreadable, [], `checked out but not a git repo, so not gated: ${unreadable.join(', ')}`);
    });

    test('the survey actually found something to check', () => {
        // A refactor that breaks the scanner must not read as a clean bill of
        // health. The services read hundreds of variables between them.
        const total = cov.totalReads(survey);
        assert.ok(total > 300, `only ${total} env reads found across ${readable.length} components; the scanner is probably broken`);
    });

    test('every surveyed component contributed source files', () => {
        // The fleet floor above is not enough on its own: the hub is about a
        // third of the fleet's variables, so losing its whole scan to a moved
        // layout still clears 300 while every hub check silently proves
        // nothing.
        const empty = cov.checkEmptyScan(survey);
        assert.deepEqual(empty, [], `component scans that found no source at all:\n  ${empty.join('\n  ')}`);
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

    // A `process.env[key]` read has no name for checkUndocumented to
    // fail on, so the gate cannot see it at all. This does not recover the
    // names; it holds the count, so the unscannable surface cannot grow while
    // the gate reports green.
    test('the computed-read blind spot only shrinks', () => {
        const moved = cov.checkComputedReads(survey);
        assert.deepEqual(
            moved, [],
            `COMPUTED_READ_BASELINE no longer matches the code:\n  ${moved.join('\n  ')}`
        );
    });
});

// Referenced by the doc-page reader; kept so a standalone clone still fails
// loudly if the components tree goes missing entirely.
test('the components doc tree exists', () => {
    assert.ok(fs.existsSync(path.join(DOC_ROOT, 'components')), 'components/ is missing from the docs repo');
});
