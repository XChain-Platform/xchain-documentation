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
 * A run in which a file's child exited 0 before its event stream was whole
 * must not grade green: proved over synthetic streams and by driving a real
 * runner over a throwaway file that exits mid-suite.
 */
'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const reporter = require('../bin/complete_run_reporter.js');
const { audit } = reporter;

const REPORTER = path.join(__dirname, '..', 'bin', 'complete_run_reporter.js');

const A = '/tree/test/a.test.js';
const B = '/tree/test/b.test.js';

const counts = (tests) => ({ tests, failed: 0, passed: tests, cancelled: 0, skipped: 0, todo: 0, topLevel: tests, suites: 0 });
const pass = (file, name) => ({ type: 'test:pass', data: { file, name, nesting: 0, details: { type: 'test' } } });
const suitePass = (file, name) => ({ type: 'test:pass', data: { file, name, nesting: 0, details: { type: 'suite' } } });
const start = (file, name) => ({ type: 'test:start', data: { file, name, nesting: 0 } });
const fileSummary = (file, tests) => ({ type: 'test:summary', data: { file, success: true, counts: counts(tests) } });
const runSummary = (tests) => ({ type: 'test:summary', data: { file: undefined, success: true, counts: counts(tests) } });
// The parent's own placeholder pass for a file whose child reported nothing.
const placeholder = (file) => ({ type: 'test:pass', data: { file, name: file, nesting: 0, details: { type: 'test' } } });
const source = (text) => () => text;

describe('audit over an event stream', () => {
    test('a whole run, every file summarised and the counts adding up, has no problems', async () => {
        const verdict = await audit([
            pass(A, 'one'), pass(A, 'two'), suitePass(A, 'group'), fileSummary(A, 2),
            pass(B, 'three'), fileSummary(B, 1),
            runSummary(3),
        ]);
        assert.deepEqual(verdict, { problems: [], files: 2, total: 3 });
    });

    // The captured shape: the file's stream stops on a test:start, the parent
    // still prints a summary of what it saw, and the exit code was 0.
    test('a file whose stream ended before its summary is named, with what was seen last', async () => {
        const { problems } = await audit([
            pass(A, 'one'), pass(A, 'two'), start(A, 'three'),
            pass(B, 'four'), fileSummary(B, 1),
            runSummary(3),
        ]);
        assert.equal(problems.length, 1);
        assert.match(problems[0], /a\.test\.js ended without reporting its summary after 2 of its tests were seen/);
        assert.match(problems[0], /last event: test:start three/);
    });

    test('a file that loads node:test but delivered nothing at all is refused', async () => {
        const { problems } = await audit([
            { type: 'test:enqueue', data: { file: A, name: A, nesting: 0 } },
            placeholder(A),
            pass(B, 'four'), fileSummary(B, 1),
            runSummary(2),
        ], source("const { test } = require('node:test');"));
        assert.equal(problems.length, 1);
        assert.match(problems[0], /a\.test\.js loads node:test but delivered no events at all/);
    });

    test('a helper under test/ that never touches node:test is graded by its placeholder pass alone', async () => {
        const verdict = await audit([
            { type: 'test:enqueue', data: { file: A, name: A, nesting: 0 } },
            placeholder(A),
            pass(B, 'four'), fileSummary(B, 1),
            runSummary(2),
        ], source("module.exports = { resolve: () => 1 };"));
        assert.deepEqual(verdict, { problems: [], files: 2, total: 2 });
    });

    test('a silent file that cannot be read back is refused rather than assumed to be a helper', async () => {
        const { problems } = await audit([placeholder(A), runSummary(1)], () => { throw new Error('ENOENT'); });
        assert.equal(problems.length, 1);
        assert.match(problems[0], /a\.test\.js loads node:test but delivered no events at all/);
    });

    test('a file summary that disagrees with the events the parent saw is a problem', async () => {
        const { problems } = await audit([pass(A, 'one'), fileSummary(A, 2), runSummary(1)]);
        assert.deepEqual(problems, ['test/a.test.js reported 2 tests but the runner saw 1'.replace('test/a.test.js', path.relative(process.cwd(), A))]);
    });

    test('per-file totals that do not add up to the run total are a problem', async () => {
        const { problems } = await audit([
            pass(A, 'one'), fileSummary(A, 1),
            pass(B, 'two'), fileSummary(B, 1),
            runSummary(3),
        ]);
        assert.deepEqual(problems, ['the files that reported account for 2 tests but the runner counted 3']);
    });

    test('a run with no cumulative summary at all is refused rather than trusted', async () => {
        const { problems } = await audit([pass(A, 'one'), fileSummary(A, 1)]);
        assert.equal(problems.length, 1);
        assert.match(problems[0], /ended without its cumulative summary/);
    });

    test('the reporter prints nothing for a whole run and one line per problem otherwise', async () => {
        const collect = async (events) => {
            const out = [];
            for await (const chunk of reporter(events)) out.push(chunk);
            return out.join('');
        };
        const before = process.exitCode;
        try {
            assert.equal(await collect([pass(A, 'one'), fileSummary(A, 1), runSummary(1)]), '');
            assert.equal(process.exitCode, before);

            const text = await collect([pass(A, 'one'), start(A, 'two'), runSummary(1)]);
            assert.match(text, /^test run incomplete, refusing to grade it green:\n {2}.*a\.test\.js ended without reporting its summary/);
            assert.equal(process.exitCode, 1);
        } finally {
            process.exitCode = before;
        }
    });
});

// Driving the real runner: one healthy file and one whose second test calls
// process.exit(0), so that child exits clean before its third test or its
// summary can be written, the same cut the force-exit truncation made.

function runner(cwd, files) {
    // This test itself runs inside a runner child; the nested runner must not
    // inherit that marker or it declines to run files at all.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, [
        '--test', '--test-timeout=20000',
        '--test-reporter=tap', '--test-reporter-destination=stdout',
        `--test-reporter=${REPORTER}`, '--test-reporter-destination=stderr',
        ...files,
    ], { cwd, env, encoding: 'utf8' });
}

const HEALTHY = `
'use strict';
const { test } = require('node:test');
test('one', () => {});
test('two', () => {});
`;

const EARLY_EXIT = `
'use strict';
const { test } = require('node:test');
test('runs', () => {});
test('exits the child clean before the rest can report', () => { process.exit(0); });
test('never runs', () => {});
`;

// The same exit after a turn of the event loop, so the events before it
// have reached the parent: the stream is cut instead of empty.
const LATE_EXIT = `
'use strict';
const { test } = require('node:test');
const { setTimeout: sleep } = require('node:timers/promises');
test('runs', () => {});
test('exits the child clean after its first events were written', async () => { await sleep(200); process.exit(0); });
test('never runs', () => {});
`;

const HELPER = `
'use strict';
module.exports = { answer: () => 42 };
`;

describe('driving node --test with the reporter attached', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'complete-run-reporter-'));
    fs.writeFileSync(path.join(dir, 'healthy.test.js'), HEALTHY);
    fs.writeFileSync(path.join(dir, 'early_exit.test.js'), EARLY_EXIT);
    fs.writeFileSync(path.join(dir, 'late_exit.test.js'), LATE_EXIT);
    fs.writeFileSync(path.join(dir, 'helper.js'), HELPER);

    test('a run whose files all finish exits 0 and the reporter stays silent', () => {
        const r = runner(dir, ['healthy.test.js']);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /^# tests 2$/m);
        assert.equal(r.stderr, '');
    });

    test('a file that exits 0 before its stream is whole fails the run and is named', () => {
        const r = runner(dir, ['healthy.test.js', 'late_exit.test.js']);
        // Without the reporter this run is green: the child's exit code was 0.
        assert.match(r.stdout, /^# fail 0$/m, r.stdout);
        assert.equal(r.status, 1, r.stdout + r.stderr);
        assert.match(r.stderr, /test run incomplete, refusing to grade it green:/);
        assert.match(r.stderr, /late_exit\.test\.js ended without reporting its summary after 1 of its tests/);
        assert.doesNotMatch(r.stderr, /healthy\.test\.js/);
    });

    test('a file that exits 0 before writing a single event fails the run too', () => {
        const r = runner(dir, ['healthy.test.js', 'early_exit.test.js']);
        assert.match(r.stdout, /^ok \d+ - early_exit\.test\.js$/m, r.stdout);
        assert.equal(r.status, 1, r.stdout + r.stderr);
        assert.match(r.stderr, /early_exit\.test\.js loads node:test but delivered no events at all/);
    });

    test('a helper the glob swept in, with no tests and no node:test, passes as the runner grades it', () => {
        const r = runner(dir, ['healthy.test.js', 'helper.js']);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        assert.match(r.stdout, /^ok \d+ - helper\.js$/m);
        assert.match(r.stdout, /^# tests 3$/m);
        assert.equal(r.stderr, '');
    });
});
