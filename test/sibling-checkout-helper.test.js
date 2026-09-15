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
 * The sibling-resolution helper every cross-repo suite skips through, driven
 * against a throwaway platform root so each state it must tell apart (real,
 * hollow, absent, present but missing a file) is built on disk rather than
 * assumed from this checkout. The switch is passed explicitly so the throw
 * path runs in every environment, not only where XCHAIN_REQUIRE_SIBLINGS is
 * set.
 */
'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const helper = require('./helpers/sibling_checkout.js');

let platformRoot;
before(() => {
    platformRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xchain-docs-sibling-'));
    fs.mkdirSync(path.join(platformRoot, 'xchain-real', 'src'), { recursive: true });
    fs.writeFileSync(path.join(platformRoot, 'xchain-real', 'package.json'), '{}\n');
    fs.writeFileSync(path.join(platformRoot, 'xchain-real', 'src', 'present.js'), '');
    fs.mkdirSync(path.join(platformRoot, 'xchain-hollow'));
});
after(() => {
    fs.rmSync(platformRoot, { recursive: true, force: true });
});

describe('sibling checkout resolution', () => {
    test('the roots are this checkout and its parent', () => {
        assert.equal(helper.DOC_ROOT, path.resolve(__dirname, '..'));
        assert.equal(helper.PLATFORM_ROOT, path.resolve(__dirname, '..', '..'));
        assert.equal(helper.siblingRoot('xchain-indexer'), path.join(helper.PLATFORM_ROOT, 'xchain-indexer'));
    });

    test('a checkout with a package.json is real', () => {
        const state = helper.checkoutState('xchain-real', platformRoot);
        assert.deepEqual(state, { root: path.join(platformRoot, 'xchain-real'), exists: true, hollow: false, real: true });
        const r = helper.sibling('xchain-real', ['src/present.js'], { required: true, platformRoot });
        assert.equal(r.have, true);
        assert.equal(r.skip, false);
        assert.deepEqual(r.missing, []);
    });

    test('a directory without package.json is hollow, and hollow reads as absent', () => {
        const state = helper.checkoutState('xchain-hollow', platformRoot);
        assert.equal(state.exists, true);
        assert.equal(state.hollow, true);
        assert.equal(state.real, false);
        const r = helper.sibling('xchain-hollow', [], { required: false, platformRoot });
        assert.equal(r.have, false);
        assert.match(r.skip, /xchain-hollow/);
        assert.match(r.skip, /hollow/);
        assert.match(r.skip, /package\.json/);
    });

    test('an absent sibling skips by name without the switch', () => {
        const r = helper.sibling('xchain-absent', ['src/anything.js'], { required: false, platformRoot });
        assert.equal(r.have, false);
        assert.match(r.skip, /xchain-absent is not checked out at /);
        // The root first, then every path tried under it, so the message says where it looked.
        assert.deepEqual(r.missing, [path.join(platformRoot, 'xchain-absent'),
                                     path.join(platformRoot, 'xchain-absent', 'src', 'anything.js')]);
    });

    test('a real sibling missing a wanted file skips naming that file', () => {
        const r = helper.sibling('xchain-real', ['src/present.js', 'src/gone.js'], { required: false, platformRoot });
        assert.equal(r.have, false);
        assert.deepEqual(r.missing, [path.join(platformRoot, 'xchain-real', 'src', 'gone.js')]);
        assert.match(r.skip, /is missing .*src\/gone\.js/);
    });

    test('alternative spellings pass when any one exists and name every one tried when none does', () => {
        const ok = helper.sibling('xchain-real', [['src/moved.js', 'src/present.js']], { required: false, platformRoot });
        assert.equal(ok.have, true);
        const bad = helper.sibling('xchain-real', [['src/a.js', 'src/b.js']], { required: false, platformRoot });
        assert.equal(bad.have, false);
        assert.match(bad.missing[0], /src\/a\.js or .*src\/b\.js$/);
    });

    test('absolute wants are taken as given', () => {
        const abs = path.join(platformRoot, 'xchain-real', 'src', 'present.js');
        assert.equal(helper.sibling('xchain-real', [abs], { required: false, platformRoot }).have, true);
    });

    test('with the switch set, absent, hollow and incomplete siblings throw naming the repo and the path', () => {
        assert.throws(() => helper.sibling('xchain-absent', [], { required: true, platformRoot }),
            /XCHAIN_REQUIRE_SIBLINGS=1 but sibling xchain-absent is not checked out/);
        assert.throws(() => helper.sibling('xchain-hollow', [], { required: true, platformRoot }),
            /XCHAIN_REQUIRE_SIBLINGS=1 but sibling xchain-hollow .* hollow/);
        assert.throws(() => helper.sibling('xchain-real', ['src/gone.js'], { required: true, platformRoot }),
            /XCHAIN_REQUIRE_SIBLINGS=1 but sibling xchain-real is missing .*src\/gone\.js/);
    });

    test('the switch defaults to the environment', () => {
        assert.equal(helper.REQUIRED, process.env.XCHAIN_REQUIRE_SIBLINGS === '1');
    });
});
