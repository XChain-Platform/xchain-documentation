/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Copyright © 2025–2026 Dankest, LLC */

'use strict';

// Rebuild the Taproot envelope chunking vectors from the spec's own rule.
// Pins the vector file against protocol/taproot-envelope.md, not against a shipped encoder.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const VECTORS = require('../protocol/test-vectors/taproot_envelope.json');
const SPEC = fs.readFileSync(path.resolve(__dirname, '../protocol/taproot-envelope.md'), 'utf8');
const CHUNK = 520;
const CHUNKING_RECIPE = 'action "FILE|0|chunks.bin|application/octet-stream|||||||" '
    + '+ 1200 rawData bytes where byte[i] = (i*7+13) & 0xff';

const REBALANCE_RECIPE = 'action "FILE|0|rebalance.bin|application/octet-stream|||||||" '
    + '+ 985 rawData bytes where byte[i] = (i*7+13) & 0xff for i < 984 and byte[984] = 0x07';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const clone = (v) => JSON.parse(JSON.stringify(v));

// Encode one element the way a minimal script compiler does (a lone 0x01-0x10 or 0x81 byte becomes an opcode).
function pushData(buf) {
    const n = buf.length;
    if (n === 0) return Buffer.from([0x00]);
    if (n === 1 && buf[0] >= 0x01 && buf[0] <= 0x10) return Buffer.from([0x50 + buf[0]]);
    if (n === 1 && buf[0] === 0x81) return Buffer.from([0x4f]);
    if (n <= 75) return Buffer.concat([Buffer.from([n]), buf]);
    if (n <= 255) return Buffer.concat([Buffer.from([0x4c, n]), buf]);
    const head = Buffer.alloc(3);
    head[0] = 0x4d;
    head.writeUInt16LE(n, 1);
    return Buffer.concat([head, buf]);
}

const compilePayload = (action, raw) => Buffer.concat([pushData(Buffer.from(action, 'utf8')), pushData(raw)]);

// Split into 520-byte elements, rebalancing a lone minimal-opcode final byte to (n-1, 2).
function sliceEnvelope(payload) {
    const out = [];
    for (let i = 0; i < payload.length; i += CHUNK) out.push(payload.subarray(i, i + CHUNK));
    const last = out[out.length - 1];
    if (out.length >= 2 && last.length === 1 && ((last[0] >= 0x01 && last[0] <= 0x10) || last[0] === 0x81)) {
        out[out.length - 2] = payload.subarray(payload.length - 1 - out[out.length - 2].length, payload.length - 2);
        out[out.length - 1] = payload.subarray(payload.length - 2);
    }
    return out;
}

function envelopeScript(payload, xonlyHex) {
    return Buffer.concat([
        Buffer.from([0x00, 0x63]), pushData(Buffer.from('XCHN')), Buffer.from([0x01, 0x00]),
        ...sliceEnvelope(payload).map(pushData),
        Buffer.from([0x68]), pushData(Buffer.from(xonlyHex, 'hex')), Buffer.from([0xac]),
    ]);
}

function tapleafHash(script) {
    const tag = crypto.createHash('sha256').update('TapLeaf').digest();
    assert.ok(script.length < 0xfd + 0xffff, 'script too long for a 3-byte compact size');
    const size = script.length < 0xfd ? Buffer.from([script.length]) : Buffer.from([0xfd, script.length & 0xff, script.length >> 8]);
    return sha256(Buffer.concat([tag, tag, Buffer.from([0xc0]), size, script]));
}

function chunkingPayload() {
    const raw = Buffer.alloc(1200);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + 13) & 0xff;
    return compilePayload('FILE|0|chunks.bin|application/octet-stream|||||||', raw);
}

function assertChunkingVector(vectors) {
    const v = vectors.envelope_chunking;
    assert.equal(v.payload_generation, CHUNKING_RECIPE, 'envelope_chunking recipe changed; update the rebuild');
    const payload = chunkingPayload();
    const script = envelopeScript(payload, vectors.envelope_grammar.internal_pubkey_xonly);
    assert.equal(payload.length, v.compiled_payload_length);
    assert.equal(sha256(payload), v.compiled_payload_sha256);
    assert.deepEqual(sliceEnvelope(payload).map((p) => p.length), v.push_lengths);
    assert.equal(script.length, v.envelope_script_length);
    assert.equal(sha256(script), v.envelope_script_sha256);
    assert.equal(tapleafHash(script), v.tapleaf_hash);
}

function rebalancePayload() {
    const raw = Buffer.alloc(985);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + 13) & 0xff;
    raw[984] = 0x07;
    return compilePayload('FILE|0|rebalance.bin|application/octet-stream|||||||', raw);
}

// Apply the rule to any payload of the vector's length and final byte (the split depends on nothing else).
function rebalanceLengths(length, finalByte) {
    const payload = Buffer.alloc(length, 0x41);
    payload[length - 1] = finalByte;
    return sliceEnvelope(payload).map((p) => p.length);
}

function assertRebalanceVector(vectors) {
    const v = vectors.chunk_rebalance;
    assert.equal(v.payload_generation, REBALANCE_RECIPE, 'chunk_rebalance recipe changed; update the rebuild');
    const payload = rebalancePayload();
    assert.equal(payload.length, v.compiled_payload_length);
    assert.equal('0x' + payload[payload.length - 1].toString(16).padStart(2, '0'), v.final_byte);
    assert.equal(sha256(payload), v.compiled_payload_sha256);
    assert.deepEqual(sliceEnvelope(payload).map((p) => p.length), v.push_lengths);
    assert.equal(sha256(envelopeScript(payload, vectors.envelope_grammar.internal_pubkey_xonly)), v.envelope_script_sha256);
    assert.equal(v.compiled_payload_length % CHUNK, 1, 'chunk_rebalance no longer exercises the length = 1 (mod 520) case');
    assert.deepEqual(rebalanceLengths(v.compiled_payload_length, Number(v.final_byte)), v.push_lengths);
    const quoted = SPEC.match(/pinned by the\s+`chunk_rebalance` vector[\s\S]*?`push_lengths`\s+`\[([\d, ]+)\]`/);
    assert.ok(quoted, 'taproot-envelope.md no longer cites the chunk_rebalance push_lengths');
    assert.deepEqual(quoted[1].split(',').map((s) => Number(s.trim())), v.push_lengths);
}

test('the helpers reproduce the frozen envelope_grammar bytes', () => {
    const g = VECTORS.envelope_grammar;
    const payload = compilePayload(g.action_string, Buffer.from(g.raw_data_utf8, 'utf8'));
    const script = envelopeScript(payload, g.internal_pubkey_xonly);
    assert.equal(payload.toString('hex'), g.compiled_payload_hex);
    assert.equal(script.toString('hex'), g.envelope_script_hex);
    assert.equal(tapleafHash(script), g.tapleaf_hash);
});

test('envelope_chunking rebuilds from its recipe and the envelope_grammar key', () => {
    assertChunkingVector(VECTORS);
});

test('chunk_rebalance push_lengths follow the spec rule, and the spec quotes them', () => {
    assertRebalanceVector(VECTORS);
});

test('the rebalance covers exactly 0x01-0x10 and 0x81', () => {
    for (const byte of [0x01, 0x07, 0x10, 0x81]) assert.deepEqual(rebalanceLengths(1041, byte), [520, 519, 2]);
    for (const byte of [0x00, 0x11, 0x80, 0x41]) assert.deepEqual(rebalanceLengths(1041, byte), [520, 520, 1]);
});

test('the vector guards fail on a drifted hash, length or split', () => {
    const tapleaf = clone(VECTORS);
    tapleaf.envelope_chunking.tapleaf_hash = tapleaf.envelope_chunking.tapleaf_hash.replace(/^./, (c) => (c === '0' ? '1' : '0'));
    assert.throws(() => assertChunkingVector(tapleaf));
    const payload = clone(VECTORS);
    payload.envelope_chunking.compiled_payload_sha256 = payload.envelope_chunking.compiled_payload_sha256.replace(/^./, (c) => (c === '0' ? '1' : '0'));
    assert.throws(() => assertChunkingVector(payload));
    const split = clone(VECTORS);
    split.chunk_rebalance.push_lengths = [520, 520, 1];
    assert.throws(() => assertRebalanceVector(split));
    const hash = clone(VECTORS);
    hash.chunk_rebalance.envelope_script_sha256 = hash.chunk_rebalance.envelope_script_sha256.replace(/^./, (c) => (c === '0' ? '1' : '0'));
    assert.throws(() => assertRebalanceVector(hash));
    const outside = clone(VECTORS);
    outside.chunk_rebalance.final_byte = '0x11';
    assert.throws(() => assertRebalanceVector(outside));
});
