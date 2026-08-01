<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Taproot Envelope

The Taproot envelope is XChain's carrier for large payloads on chains that have Taproot. It writes a whole file into a single tapscript witness through a commit/reveal pair, instead of splitting it across hundreds of script outputs. Against the P2WSH chunk lane it costs roughly **half the weight per byte** and replaces about 820 outputs per 390 KB with one input and one output.

It is available on **Bitcoin and Litecoin**. Dogecoin has no SegWit and therefore no Taproot, so the envelope does not exist there; DOGE keeps the chunk lanes and gets its footprint saving from [payload compression](./actions/file.md#compression) instead.

## Shape

Two transactions, mirroring the fund/reveal pattern the chunk lanes already use:

1. **Commit.** One P2TR output whose script tree contains a single data leaf (the envelope), with an internal key owned by the sender. Any native fee-destination outputs ride this transaction.
2. **Reveal.** Spends that output through the script path, exposing the envelope in the witness. **The reveal is the transaction the action belongs to**: its block and txid are the action's identity, exactly as a chunk-lane action is identified by its reveal.

An unrevealed commit is not an action. It is an ordinary P2TR output, indistinguishable from any other until it is spent.

### Grammar

```
OP_FALSE OP_IF
  <"XCHN">            // 4-byte magic, cleartext
  <format byte>       // 0x00 = this version, cleartext
  <payload push 1..n> // the payload, in 520-byte elements, in order
OP_ENDIF
<internal pubkey> OP_CHECKSIG
```

The `OP_FALSE OP_IF` branch never executes, so the payload is invisible to script evaluation while still being committed to by the transaction.

The magic and format byte are **cleartext by design**. Recognition has to be free pattern-matching: if identifying an envelope required deobfuscation, every unrelated `OP_FALSE OP_IF` inscription on the chain would cost an indexer an RPC round trip and a cipher attempt.

The payload is **raw** (not obfuscated), matching the shipped P2WSH lane, where redeem scripts also carry raw payload bytes. The reassembled payload is byte-identical to the compiled data stream the other lanes carry: the action-string push followed by the rawData push.

An envelope whose format byte is not `0x00` is **not recognized at all** - invisible rather than invalid. A future format activates through its own coordinated flag height.

## Rules that decide whether an envelope is an action

These are consensus-relevant: every implementation must agree, or the fleet forks. All of them activate at the network's recognition height, and below that height a transaction parses exactly as it always did.

- The witness is read **from the end** of the stack (control block last, script second-to-last), per BIP341.
- A reveal carrying a **BIP341 annex is never an envelope.** Policy rejects annexes today but consensus does not, so a miner-included annexed reveal must not be able to split implementations.
- The envelope input must be **input 0**. Anywhere else, it is not an action.
- **Two or more envelope inputs** in one transaction: not an action.
- An envelope **mixed with any other carrier** (an `XCHN` OP_RETURN, a chunk marker, MULTISIGN outputs): not an action. Deterministic refusal, not a preference between carriers.
- The reassembled payload has its own ceiling, `ENVELOPE_MAX_PAYLOAD` (400,000 bytes), measured **before** parse and **excluding** the envelope's own push framing. Note this measures a different quantity from `MAX_ACTION_DATA_LENGTH`, which is framing-inclusive and still governs every legacy lane.

## Source attribution

The reveal's input 0 is the commit output: a one-time, payload-dependent address that nothing else references. Attributing an action to it would break ownership, token gating and fee attribution.

So the action's source is **the address that funded the commit** - the prevout of the *commit* transaction's input 0. That is the same walk-back the decoder already performs for P2SH/P2WSH reveals, and it means an envelope action is attributed to the same address the sender would have used on any other lane.

Commit inputs are signed `SIGHASH_ALL`, and the commit's input 0 is preserved across any replacement, because attribution hangs off it.

## Fees and the cancel path

The commit output prefunds the reveal's fee. If rates move between the two, the reveal is re-signed under RBF; CPFP from the reveal's change output remains possible externally.

Fee sufficiency is evaluated against **the requirement in force at the reveal's block height**, using the outputs recorded on the commit. A commit that sits unrevealed while oracle-priced rates rise can therefore go stale; the recovery is to cancel and recommit.

**Cancel requires persisted state.** The key-path spend that recovers an unrevealed commit needs the internal key *and* the tapleaf hash to reconstruct the BIP341 tweak. Lose the leaf and the funds sit in an address the wallet cannot re-derive. Before broadcasting a commit, a wallet MUST durably persist:

```
{ commit outpoint, internal key derivation path, tapleaf hash }
```

and the cancel MUST be reconstructible from that record alone, surviving a crash between commit and reveal. A cancel conflicts with the reveal by construction (same outpoint), so a wallet treats it as a replacement and never has both outstanding.

## Reorgs

- **Commit confirmed, reveal not:** no action exists. The commit is just a UTXO, and the key-path cancel recovers it.
- **Reveal reorged out:** identical to any reorged action. It can re-enter from the mempool like any transaction.
- **Commit and reveal in the same block** is legal and expected (it is the fee-optimal shape). No implementation may assume a confirmation gap between them.

## Choosing it

Callers can ask the encoder to choose: `encoding: "AUTO"` selects the smallest-footprint carrier the network and signer support - one output where the payload fits it, otherwise the envelope where it is available, otherwise P2WSH, otherwise P2SH.

`AUTO` is an **opt-in**, for a concrete reason: resolving to the envelope changes the response from one PSBT to a commit/reveal pair, which existing callers are not written to handle. Omitting `encoding` keeps the long-standing behaviour unchanged.

Auto-selection also consults the **signer**. An account whose signer cannot produce a tapscript script-path signature never gets the envelope, and this fails closed - a signer capability must be affirmed, not assumed. The reason is not tidiness: the reveal has to be signable before the commit is broadcast, so choosing the envelope for a signer that cannot spend it does not produce an error message, it produces stranded funds.

A payload that still exceeds the envelope ceiling after compression is refused with an error naming the cap. It is never silently split across multiple envelopes, and never falls back to a spray of chunk outputs.

## Relay

Filtering relay policies target exactly this transaction shape, and the cleartext magic makes an XChain envelope maximally matchable. Reveal propagation may therefore be degraded on some relay paths. The mitigations are direct pool submission and patience; an encoder never silently falls back to the roughly 2x-cost chunk lane without the caller's consent.

## See also

- [FILE](./actions/file.md) - the action that carries file payloads, and the `COMPRESSION` field
- [Token-Gated Content](./token-gated-content.md) - compress-then-encrypt ordering for gated files
- `protocol/test-vectors/taproot_envelope.json` - golden grammar bytes, attribution and fee-placement pins, and the adversarial corpus
