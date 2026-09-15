'use strict';

// Refuses a node --test run in which a file's child exited before its event
// stream was whole: the runner trusts exit codes alone, so a lost stream tail
// otherwise grades green with the tests in it never counted. Node 22.10+.

const fs = require('node:fs');
const path = require('node:path');

const fileKey = (file) => (file ? path.resolve(file) : null);

// A file the runner loaded that never touched node:test (a helper living
// under test/) emits nothing and is graded by the parent's placeholder pass;
// that is the one shape in which silence from the child is not a lost stream.
const LOADS_NODE_TEST = /['"]node:test['"]|require\(\s*['"]test['"]\s*\)|from\s+['"]test['"]/;
const loadsNodeTest = (file, readFile) => {
    try { return LOADS_NODE_TEST.test(readFile(file, 'utf8')); } catch { return true; }
};

// Walks a test-event stream and names what is missing: the run summary, a
// file's own summary (the last thing a child writes), or counts that differ.
// Returns { problems: string[], files: number, total: number|null }.
async function audit(events, readFile = fs.readFileSync) {
    const files = new Map();
    let total = null;

    for await (const { type, data } of events) {
        if (type === 'test:summary') {
            if (!data.file) { total = data; continue; }
            fileEntry(files, data.file).summary = data;
            continue;
        }
        if (!data || !data.file) continue;
        const entry = fileEntry(files, data.file);
        // The parent's own bookkeeping for the file (enqueue, complete) is
        // named after the file; the last event worth naming is the child's.
        if (!(data.name && fileKey(data.name) === fileKey(data.file))) {
            entry.lastEvent = `${type} ${data.name || ''}`.trim();
            entry.childEvents += 1;
        }
        if ((type === 'test:pass' || type === 'test:fail') && data.details?.type !== 'suite') {
            entry.seen += 1;
        }
    }

    const problems = [];
    if (total === null) {
        problems.push('the runner ended without its cumulative summary (Node 22.10 or later delivers one)');
    }

    let accounted = 0;
    for (const [file, entry] of files) {
        const rel = path.relative(process.cwd(), file) || file;
        if (!entry.summary && entry.childEvents === 0 && !loadsNodeTest(file, readFile)) {
            accounted += entry.seen;
            continue;
        }
        if (!entry.summary && entry.childEvents === 0) {
            problems.push(`${rel} loads node:test but delivered no events at all: it exited before its ` +
                'first event was written (a helper that registers no tests belongs outside the test glob)');
            continue;
        }
        if (!entry.summary) {
            problems.push(`${rel} ended without reporting its summary after ${entry.seen} of its tests ` +
                `were seen (last event: ${entry.lastEvent})`);
            continue;
        }
        const reported = entry.summary.counts.tests;
        accounted += reported;
        if (reported !== entry.seen) {
            problems.push(`${rel} reported ${reported} tests but the runner saw ${entry.seen}`);
        }
    }

    if (total !== null && problems.length === 0 && accounted !== total.counts.tests) {
        problems.push(`the files that reported account for ${accounted} tests but the runner counted ${total.counts.tests}`);
    }

    return { problems, files: files.size, total: total ? total.counts.tests : null };
}

function fileEntry(files, file) {
    const key = fileKey(file);
    let entry = files.get(key);
    if (!entry) {
        entry = { seen: 0, childEvents: 0, summary: null, lastEvent: 'none' };
        files.set(key, entry);
    }
    return entry;
}

// The reporter node --test loads: silent on a whole run, otherwise one line
// per problem to its destination and a failing exit code for the run.
async function* completeRunReporter(source) {
    const { problems } = await audit(source);
    if (problems.length === 0) return;
    process.exitCode = 1;
    yield 'test run incomplete, refusing to grade it green:\n';
    for (const problem of problems) {
        yield `  ${problem}\n`;
    }
}

module.exports = completeRunReporter;
module.exports.audit = audit;
