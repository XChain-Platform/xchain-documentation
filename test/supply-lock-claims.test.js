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
 * Supply-permanence claims in the token-creation guide.
 *
 * WHY. Two of the guide's promises were absolute where the handlers are
 * conditional, and both are the kind a token buyer prices in.
 *
 *   1. MAX_SUPPLY was described as a lifetime issuance ceiling ("how many
 *      tokens can ever exist ... like a gold mine"). The handler compares
 *      SUPPLY + AMOUNT against MAX_SUPPLY, where SUPPLY is the LEDGER total
 *      (credits - debits + escrows) and DESTROY pushes a debit. Burning
 *      therefore returns mint headroom, so the cap bounds what is OUTSTANDING
 *      at one time, never what has been issued over a token's life.
 *   2. LOCK_MINT was described as closing supply creation outright. It gates
 *      the MINT command alone. The issuer's own MINT_SUPPLY path is gated by
 *      the separate LOCK_MINT_SUPPLY flag, and LOCK_MINT is consulted nowhere
 *      in the ISSUE handler, so an owner can still create supply with
 *      LOCK_MINT set and LOCK_MINT_SUPPLY unset.
 *   3. MAX_SUPPLY = 0 was described as plain "unlimited supply". That reading
 *      is the UNCAPPED_MAX_SUPPLY_ZERO protocol change, whose MAINNET arm sits
 *      on the unarmed sentinel 9999999999 while testnet and regtest arm at
 *      genesis. Below the gate mint.js compares SUPPLY + AMOUNT against a zero
 *      ceiling, so every positive mint on a zero-cap mainnet token is refused
 *      and such a token can never issue anything.
 *   4. LOCK_CALLBACK was described as proving the recall terms cannot be
 *      altered. callback.js refuses the action outright when the flag is set,
 *      so the flag does not preserve a usable recall, it removes recall
 *      entirely. It was the only lock in the list not phrased as a
 *      prohibition, which is how the consequence went unstated.
 *
 * WHAT IT CHECKS. Both sides, because either one alone is a half guard:
 *
 *   - The SOURCE facts the corrected wording rests on still hold in the
 *     sibling indexer. If LOCK_MINT ever becomes a guard in issue.js, or the
 *     ceiling stops being compared against ledger supply, the doc sentence is
 *     no longer the accurate one and this guard says so.
 *   - The PROSE no longer states either permanence claim, and does state the
 *     condition that makes it conditional.
 *
 * The prose side runs unconditionally; only the source side skips when the
 * sibling checkout is absent, so the guard can never come back all-skip.
 *
 * XCHAIN_DOCS_ROOT overrides the docs root, matching
 * settlement-and-delivery-claims.test.js. It exists so the negative control is
 * runnable: point it at a checkout of an older commit and the prose assertions
 * below go red, which is how they were verified to be capable of failing.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = process.env.XCHAIN_DOCS_ROOT || path.join(__dirname, '..');
const INDEXER  = path.resolve(path.join(__dirname, '..'), '../xchain-indexer/src');
const GUIDE    = path.join(DOC_ROOT, 'user-guide', 'creating-tokens.md');
const USECASES = path.join(DOC_ROOT, 'user-guide', 'use-cases.md');

const haveIndexer = fs.existsSync(path.join(INDEXER, 'actions', 'mint.js'));
const readSrc = (rel) => fs.readFileSync(path.join(INDEXER, rel), 'utf8');
const guide = fs.readFileSync(GUIDE, 'utf8');
const useCases = fs.readFileSync(USECASES, 'utf8');

// Slice a markdown section by its heading, up to the next heading of any depth.
function section(md, heading){
    const lines = md.split('\n');
    const start = lines.findIndex((l) => l.trim() === heading);
    assert.notStrictEqual(start, -1, `creating-tokens.md no longer has the "${heading}" heading`);
    let end = lines.length;
    for(let i = start + 1; i < lines.length; i++){
        if(/^#{1,6}\s/.test(lines[i])){ end = i; break; }
    }
    return lines.slice(start, end).join('\n');
}

const supplySection = section(guide, '### Supply');
const lockSection   = section(guide, '## Building Trust: Locking Parameters');
const lockMintBullet = lockSection.split('\n').find((l) => l.startsWith('- **LOCK_MINT**:'));
const lockCallbackBullet = lockSection.split('\n').find((l) => l.includes('LOCK_CALLBACK'));

const skipNoIndexer = !haveIndexer && 'sibling xchain-indexer not present in this checkout';

test('the source facts the supply wording rests on still hold', { skip: skipNoIndexer }, () => {
    const mint = readSrc('actions/mint.js');
    const db = readSrc('db.js');
    const destroy = readSrc('actions/destroy.js');

    assert.match(mint, /bcadd\(data\['SUPPLY'\],data\['AMOUNT'\]/,
        'mint.js no longer compares SUPPLY + AMOUNT against the ceiling; the guide\'s '
        + '"outstanding at one time" wording may need to change back');
    assert.match(mint, /MAX_SUPPLY/, 'mint.js no longer names MAX_SUPPLY');
    assert.match(db, /bcadd\(this\.util\.bcsub\(credits, debits, exact\), escrows, decimals\)/,
        'db.js getTokenSupply no longer computes supply as credits - debits + escrows, '
        + 'so burning may no longer return mint headroom');
    assert.match(destroy, /debits\.push\(\[destroy\['TICK'\], destroy\['AMOUNT'\], destroy\['SOURCE'\]\]\)/,
        'destroy.js no longer debits the burned amount, so DESTROY may no longer lower supply');
});

test('the source facts the LOCK_MINT wording rests on still hold', { skip: skipNoIndexer }, () => {
    const mint = readSrc('actions/mint.js');
    const issue = readSrc('actions/issue.js');

    assert.match(mint, /tokenInfo\['LOCK_MINT'\]==1/,
        'mint.js no longer gates the MINT command on LOCK_MINT');
    assert.match(issue, /tokenInfo\['LOCK_MINT_SUPPLY'\]==1/,
        'issue.js no longer gates MINT_SUPPLY on LOCK_MINT_SUPPLY');
    assert.doesNotMatch(issue, /tokenInfo\['LOCK_MINT'\]/,
        'issue.js now consults LOCK_MINT; if it gates MINT_SUPPLY, the guide\'s '
        + '"LOCK_MINT_SUPPLY is also required" wording is no longer accurate');
});

test('the Supply section does not promise a lifetime issuance ceiling', () => {
    for(const phrase of ['can ever exist', 'no more can be created', 'gold mine']){
        assert.ok(!supplySection.includes(phrase),
            `creating-tokens.md "### Supply" states "${phrase}". MAX_SUPPLY bounds OUTSTANDING `
            + 'supply (mint.js compares SUPPLY + AMOUNT), and DESTROY returns headroom.');
    }
});

test('the Supply section says the cap is on outstanding supply and that burning frees headroom', () => {
    assert.match(supplySection, /outstanding/i,
        'creating-tokens.md "### Supply" no longer describes the cap as an outstanding-supply limit');
    assert.match(supplySection, /destroy|burn/i,
        'creating-tokens.md "### Supply" no longer says that destroying tokens frees headroom, '
        + 'which is the fact that makes the cap conditional');
});

test('the LOCK_MINT bullet scopes itself to the MINT command and names the companion lock', () => {
    assert.ok(lockMintBullet, 'creating-tokens.md no longer carries a "- **LOCK_MINT**:" bullet');
    assert.ok(!lockMintBullet.includes('no new supply can ever be created'),
        'the LOCK_MINT bullet still promises that no new supply can ever be created. LOCK_MINT '
        + 'gates the MINT command only; issue.js gates MINT_SUPPLY on LOCK_MINT_SUPPLY.');
    assert.match(lockMintBullet, /LOCK_MINT_SUPPLY/,
        'the LOCK_MINT bullet does not name LOCK_MINT_SUPPLY, so a reader is not told that '
        + 'the issuer path stays open');
});

test('use-cases.md does not promise permanently closed issuance', () => {
    for(const phrase of ['no one (including you) can ever create more',
                         'no more tokens can be created']){
        assert.ok(!useCases.includes(phrase),
            `user-guide/use-cases.md states "${phrase}". Locking the ceiling or closing the `
            + 'public mint window closes neither issuance path for good: DESTROY frees headroom '
            + 'under the cap and issue.js still credits MINT_SUPPLY unless LOCK_MINT_SUPPLY is '
            + 'set. Permanent closure needs LOCK_MINT and LOCK_MINT_SUPPLY together.');
    }
    assert.match(useCases, /LOCK_MINT_SUPPLY/,
        'user-guide/use-cases.md never names LOCK_MINT_SUPPLY, so its supply-permanence '
        + 'passages do not tell the reader what actually closes the issuer path');
});

test('the source facts the zero-max-supply wording rests on still hold', { skip: skipNoIndexer }, () => {
    const changes = readSrc('protocol_changes.js');
    const mint = readSrc('actions/mint.js');

    assert.match(changes, /UNCAPPED_MAX_SUPPLY_ZERO_MAINNET_TIME\s*=\s*9999999999/,
        'protocol_changes.js no longer parks UNCAPPED_MAX_SUPPLY_ZERO_MAINNET_TIME on the '
        + 'unarmed 9999999999 sentinel. If the operator has named the mainnet launch instant, '
        + 'the "### Supply" wording in user-guide/creating-tokens.md must be updated in the '
        + 'same commit and this assertion retired: zero max supply then means uncapped on '
        + 'mainnet too, and the guide must stop telling mainnet issuers to avoid it.');
    assert.match(mint, /isEnabled\('UNCAPPED_MAX_SUPPLY_ZERO'/,
        'mint.js no longer resolves the uncapped exemption through '
        + 'isEnabled(\'UNCAPPED_MAX_SUPPLY_ZERO\'), so the guide\'s gate-conditional wording '
        + 'no longer describes how a zero ceiling is treated');
});

test('the Supply section qualifies the zero-max-supply sentinel by network', () => {
    assert.match(supplySection, /mainnet/i,
        'creating-tokens.md "### Supply" describes a zero max supply without naming mainnet. '
        + 'The uncapped reading is live on testnet/regtest only; on mainnet the gate is '
        + 'unarmed and mint.js refuses every positive mint against a zero ceiling.');
    assert.match(supplySection, /protocol-activation\.md/,
        'creating-tokens.md "### Supply" no longer links protocol/protocol-activation.md, so a '
        + 'reader cannot look up when the uncapped reading turns on for mainnet');
    assert.ok(!/zero means the supply is unlimited/.test(supplySection),
        'creating-tokens.md "### Supply" states unconditionally that a max supply of zero means '
        + 'unlimited supply. That is true on testnet and regtest only while the mainnet arm of '
        + 'UNCAPPED_MAX_SUPPLY_ZERO sits on its sentinel.');
});

test('the source fact the LOCK_CALLBACK wording rests on still holds', { skip: skipNoIndexer }, () => {
    const callback = readSrc('actions/callback.js');

    assert.match(callback, /tokenInfo\['LOCK_CALLBACK'\]==1/,
        'callback.js no longer refuses the CALLBACK action when LOCK_CALLBACK is set, so the '
        + 'guide\'s "recall becomes impossible" wording may no longer be accurate');
    assert.match(callback, /invalid: LOCK_CALLBACK/,
        'callback.js no longer emits the invalid: LOCK_CALLBACK refusal');
});

test('the LOCK_CALLBACK bullet is phrased as a prohibition, not an assurance', () => {
    assert.ok(lockCallbackBullet, 'creating-tokens.md no longer carries a LOCK_CALLBACK bullet');
    assert.ok(!lockCallbackBullet.includes('proves the recall terms cannot be altered'),
        'the LOCK_CALLBACK bullet still frames the flag as proving the recall terms are fixed. '
        + 'callback.js refuses CALLBACK outright when the flag is set, so recall becomes '
        + 'impossible rather than fixed.');
    assert.match(lockCallbackBullet, /never|impossible/i,
        'the LOCK_CALLBACK bullet does not tell the issuer that recall becomes impossible, '
        + 'which is the irreversible consequence of setting it');
});
