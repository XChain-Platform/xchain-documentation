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
 * The one place a documentation suite resolves a sibling xchain-* checkout.
 *
 * WHY. Every cross-repo guard in this suite reads a sibling repo beside this
 * one and skips when it is not there, which is right for a bare clone and
 * wrong for a venue that declared the sibling supplied. Before this helper
 * each suite carried its own existsSync and its own skip string, and only the
 * six claims suites honoured XCHAIN_REQUIRE_SIBLINGS: measured 2026-09-14,
 * with the switch set and xchain-vm removed from the checkout, npm test still
 * exited 0 with nine fresh skips nobody saw. A gate that reads green having
 * exercised less than yesterday is the failure this file exists to remove.
 *
 * WHAT. sibling(repo, wants) answers "is this sibling here, with the files I
 * read?" once, the same way for every suite. With XCHAIN_REQUIRE_SIBLINGS=1
 * (bin/ci-all.sh and the venue set it, with the roster in .ci-siblings) an
 * absent, hollow or incomplete sibling THROWS, naming the repo and every path
 * tried, so the file fails instead of skipping. Without the switch it returns
 * a skip reason the suite passes straight to node:test, so a bare clone still
 * skips by name and never silently.
 *
 * Hollow: a directory with no package.json is not a checkout (an empty mount
 * point, a half-finished clone, a stale symlink target). The decoder's gate
 * learned this the hard way (a bare `[ -d ]` test let every guard behind it
 * skip), so hollow reads as absent here.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.resolve(__dirname, '..', '..');
const PLATFORM_ROOT = path.resolve(DOC_ROOT, '..');
const REQUIRED = process.env.XCHAIN_REQUIRE_SIBLINGS === '1';

/** Absolute path of a sibling repo beside this checkout. */
function siblingRoot(repo, platformRoot = PLATFORM_ROOT) {
    return path.join(platformRoot, repo);
}

/**
 * What is on disk at the sibling's expected location.
 *
 * @param {string} repo e.g. 'xchain-indexer'
 * @param {string} [platformRoot] directory holding the xchain-* repos
 * @returns {{root: string, exists: boolean, hollow: boolean, real: boolean}}
 */
function checkoutState(repo, platformRoot = PLATFORM_ROOT) {
    const root = siblingRoot(repo, platformRoot);
    let exists = false;
    try { exists = fs.statSync(root).isDirectory(); } catch { exists = false; }
    const hollow = exists && !fs.existsSync(path.join(root, 'package.json'));
    return { root, exists, hollow, real: exists && !hollow };
}

/**
 * Resolve a sibling and the paths a suite reads from it.
 *
 * `wants` lists what the caller is about to read: each entry is a path
 * (absolute, or relative to the sibling root) or an array of alternative
 * spellings of which one must exist (a module that moved and left a re-export,
 * a file the layout pass renamed). Every alternative tried is named when none
 * is found, so a failure says exactly where the suite looked.
 *
 * @param {string} repo
 * @param {Array<string|string[]>} [wants]
 * @param {{required?: boolean, platformRoot?: string}} [opts] test seams;
 *   production callers leave both to the environment
 * @returns {{root: string, have: boolean, skip: false|string, missing: string[]}}
 * @throws when the switch is set and the sibling is absent, hollow or incomplete
 */
function sibling(repo, wants = [], opts = {}) {
    const required = opts.required === undefined ? REQUIRED : opts.required;
    const state = checkoutState(repo, opts.platformRoot);
    const missing = [];
    let reason = null;
    if (!state.exists) {
        reason = `sibling ${repo} is not checked out at ${state.root}`;
        missing.push(state.root);
    } else if (state.hollow) {
        reason = `sibling ${repo} at ${state.root} is a hollow directory (no package.json)`;
        missing.push(path.join(state.root, 'package.json'));
    }
    for (const want of wants) {
        const alternatives = (Array.isArray(want) ? want : [want])
            .map((p) => (path.isAbsolute(p) ? p : path.join(state.root, p)));
        if (!alternatives.some((p) => fs.existsSync(p))) missing.push(alternatives.join(' or '));
    }
    if (reason === null && missing.length) {
        reason = `sibling ${repo} is missing ${missing.join(', ')}`;
    }
    const have = reason === null;
    if (!have && required) {
        throw new Error(`XCHAIN_REQUIRE_SIBLINGS=1 but ${reason}. Check ${repo} out beside this `
            + 'repo rather than letting this suite skip.');
    }
    return { root: state.root, have, skip: have ? false : reason, missing };
}

module.exports = { DOC_ROOT, PLATFORM_ROOT, REQUIRED, siblingRoot, checkoutState, sibling };
