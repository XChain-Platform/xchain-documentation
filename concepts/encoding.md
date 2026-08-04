<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Transaction Encoding

XChain embeds ACTION data in standard blockchain transactions. Two layers are involved: **obfuscation** (making the data harder to scan for) and **embedding** (choosing how to store the data in the transaction). Together they let an ACTION of virtually any size ride in a coin transaction that standard nodes handle without modification.

## Layer 1: Obfuscation

Obfuscation applies to the payload carried in **OP_RETURN** and **multisig** outputs. For the script-reveal formats (**P2SH** and **P2WSH**) the ACTION data chunk is embedded raw in the redeem/witness script; only a separate marker `OP_RETURN` output (`XCHN` magic plus a `p2sh`/`p2wsh` tag) is obfuscated. See the per-format notes in Layer 2 below.

Where obfuscation applies, an ACTION string is processed as follows before it is embedded:

1. The `XCHN` magic prefix (4 ASCII bytes) is prepended to the ACTION string.
2. The resulting payload is encrypted using **AES-128-CTR** with:
   - **Key**: the first 16 hex characters of the first input's txid, used directly as the 16-byte key (the ASCII bytes of those hex characters, not their hex-decoded 8-byte value)
   - **IV**: the next 16 hex characters (characters 17-32 of the txid), used the same way as the 16-byte IV

   AES-128-CTR requires a 16-byte key and a 16-byte IV; the 16 hex characters supply exactly 16 ASCII bytes for each. A third-party encoder must pass these hex-character substrings verbatim (do not hex-decode them to 8 bytes), or its keystream will not match the canonical decoder and every payload it produces will fail the `XCHN` magic check.

The output is a byte sequence that looks like random data to any observer who does not know the algorithm.

**This is obfuscation, not encryption.** The txid used as the key is fully public, anyone can look it up in any block explorer. Anyone who knows the XChain algorithm can decrypt any payload. The purpose is to prevent naive keyword scanning and accidental interpretation of unrelated data, not to provide confidentiality.

When the decoder scans a transaction, it applies the reverse: attempt decryption using the first input's txid, then check whether the first 4 bytes of the result are `XCHN`. If they are, the payload is a valid XChain ACTION. If not, the transaction is not an XChain transaction and is skipped.

Note: the key/IV are derived from the *spending* transaction's first input txid, not from the transaction being spent. This means the key is not known until the ACTION transaction is constructed.

## Layer 2: Embedding Formats

The obfuscated payload needs to be stored somewhere in the transaction that a standard node will accept and propagate. XChain supports four embedding formats, each with different capacity and transaction structure tradeoffs.

### OP_RETURN

**Capacity**: up to 80 bytes per output (76 bytes of user data; the remaining 4 bytes are the XCHN magic prefix)  
**Transactions**: 1 (single broadcast)  
**Mechanism**: Data is stored in an `OP_RETURN` output; a standard Bitcoin output type explicitly designed for arbitrary data. The output is unspendable by design, so it adds no UTXO bloat to the UTXO set. Miners include it normally.

OP_RETURN is the preferred format for short ACTIONs (simple sends, mints, basic issues). It is the most efficient and leaves the smallest footprint.

### Multisig

**Capacity**: 60 bytes of data per multisig output (two 32-byte key slots carry the payload), scalable across multiple outputs  
**Transactions**: 1 (single broadcast)  
**Mechanism**: Data is encoded into the public key positions of a standard multisig output. The "keys" are not real signing keys; they are data payloads formatted to look like public keys. The multisig output is spendable (unlike OP_RETURN), but the "keys" are not associated with any private key, making the funds effectively unrecoverable. This format is discouraged for large payloads due to UTXO set pollution.

### P2SH (Pay-to-Script-Hash)

**Capacity**: up to 476 bytes per chunk; multiple chunks are supported, giving a total capacity up to the 8,192-byte decoder ceiling (see below)  
**Transactions**: 2 per chunk (fund then spend), so large payloads require multiple fund/spend pairs  
**Mechanism**: The ACTION data is embedded **raw** (no Layer-1 obfuscation) in a redeem script. A first transaction creates an output locked to the hash of that script (the "fund" transaction). A second transaction spends that output by revealing the full script (the "spend" transaction), and also carries a single obfuscated marker `OP_RETURN` output (`XCHN` magic plus a `p2sh` tag) so the decoder can recognize the transaction. The decoder reads the revealed script from the spending transaction input.

The two-transaction pattern means the ACTION is not visible until the spend transaction is mined. The fund transaction just looks like a payment to a script hash.

### P2WSH (Pay-to-Witness-Script-Hash)

**Capacity**: up to 8,192 bytes of data  
**Transactions**: 2 (fund then spend)  
**Mechanism**: Identical in concept to P2SH but uses SegWit witness data for the reveal; the data chunk in the witness script is likewise embedded **raw**, with a single obfuscated marker `OP_RETURN` output (`XCHN` magic plus a `p2wsh` tag). The larger capacity comes from the witness discount applied to SegWit data, witness bytes cost one quarter of the weight of non-witness bytes for fee purposes. This makes P2WSH the preferred format for large payloads (file uploads, long broadcast messages, dense batch operations).

**The 8,192-byte ceiling is a decoder-wide limit, not a P2WSH-specific one.** `MAX_ACTION_DATA_LENGTH` in `xchain-decoder/src/XChainDecoder.js` applies to every embedding format: OP_RETURN, multisig, P2SH (across all its chunks), and P2WSH alike. The cap is measured on the **compiled** on-chain push (the OP_PUSHDATA-prefixed buffer as it appears on chain, before `bitcoin.script.decompile` strips the push prefix), not on the decoded payload: the decoded ACTION string is 1-3 bytes shorter than the compiled push it came from. A decoded payload as small as ~8,190 bytes can still compile to more than 8,192 bytes and be silently dropped; encoders must budget for the push-prefix overhead, not just the decoded byte count.

### TAPROOT (envelope)

**Capacity**: up to 390,000 bytes of data  
**Transactions**: 2 (commit then reveal)  
**Availability**: Bitcoin and Litecoin. Dogecoin has no SegWit, so it has no Taproot and no envelope.  
**Mechanism**: the whole payload is pushed **raw** inside a single tapscript, in an `OP_FALSE OP_IF` branch that never executes. A commit transaction creates a P2TR output whose script tree holds that leaf; a reveal transaction spends it through the script path, exposing the payload in the witness. Unlike the chunk lanes there is no marker `OP_RETURN`: the leaf carries a cleartext `XCHN` magic so recognition is a pattern match with no extra output to pay for.

Tapscript has no 3,600-byte witness-script policy cap and no 10,000-byte script cap, so a single reveal carries a payload bounded only by standardness weight. That is what collapses ~820 chunk outputs into one input and one output per 390 KB, at roughly **half the weight per byte of P2WSH**.

The envelope has its own ceiling, `ENVELOPE_MAX_PAYLOAD` (390,000 bytes), which replaces the 8,192-byte limit for this format only; every legacy lane keeps that limit. The two measure different things: the envelope ceiling is the reassembled payload before parse, excluding its own push framing. The number is derived from standardness weight rather than picked: the larger cap this constant carried before 2026-07-31 produced a 402,789 WU reveal, over `MAX_STANDARD_TX_WEIGHT`, which no node relays.

Full specification: [Taproot Envelope](../protocol/taproot-envelope.md).

## Format Auto-Selection

The encoder automatically selects the optimal format based on the payload size:

There are two selection behaviours, and which one a caller gets depends on what it asks for.

**Legacy (no `encoding` supplied).** Unchanged, and deliberately so:

| Payload size | Selected format |
|---|---|
| ≤ 76 bytes user data (≤ 80 bytes total) | OP_RETURN |
| > 76 bytes user data | P2SH |
| Any size (manual selection) | P2WSH, Multisig or TAPROOT |

P2SH splits larger payloads across multiple 476-byte chunk outputs (fund then spend pairs) up to the 8,192-byte ceiling. In practice, most common ACTIONs (SEND, MINT, ORDER, DISPENSER) fit in OP_RETURN. Larger ACTIONs (FILE, long BATCH, rich BROADCAST) use P2SH or P2WSH.

**Smallest-footprint (`encoding: "AUTO"`).** An explicit opt-in that picks the cheapest carrier the network and the caller's signer actually support:

| Condition | Selected format |
|---|---|
| Payload fits one OP_RETURN output | OP_RETURN |
| Larger, chain has Taproot, signer can sign a tapscript spend | TAPROOT |
| Larger, chain has SegWit | P2WSH |
| Larger, no SegWit (Dogecoin) | P2SH |

Multisig is never auto-selected: it is the worst-density carrier (60 bytes per output against P2SH's 476) and remains an explicit request only.

Two properties of `AUTO` are worth knowing before using it. It can resolve to TAPROOT, which returns a **commit/reveal pair** instead of a single PSBT, which is exactly why it is opt-in rather than the default. And it will not select TAPROOT unless the caller affirms its signer can produce a tapscript script-path signature: the reveal has to be signable before the commit is broadcast, so guessing wrong there strands funds rather than returning an error.

A format selection guide with size calculation details is available at [`../components/encoder/Format_Selection.md`](../components/encoder/format-selection.md).

## The PSBT Workflow

The encoder produces an **unsigned PSBT** (Partially Signed Bitcoin Transaction); a standard format for transactions that need to be signed before broadcasting.

The workflow:

1. **Encode**: The encoder receives an ACTION string (or constructs one from parameters), selects a format, builds the transaction structure, and returns a PSBT.
2. **Sign**: The caller signs the PSBT using their wallet software. The encoder never receives or handles private keys.
3. **Broadcast**: The signed transaction is submitted to the coin node's mempool. From this point it is a standard coin transaction.

For P2SH and P2WSH, the encoder produces two PSBTs; one for the fund transaction and one for the spend transaction. The fund must be broadcast and confirmed (or at least in the mempool) before the spend is valid.

TAPROOT also produces two PSBTs, but in **one call**: the commit and the pre-built reveal come back together, because a commit with segwit-only inputs has a stable txid before it is signed. The caller signs both, broadcasts the commit, then the reveal. It also returns a recovery record that the wallet must persist **before** broadcasting the commit; without the tapleaf hash in it, an unrevealed commit cannot be cancelled and the funds are stranded.

The separation between encoding and signing is a deliberate security boundary. The encoder is a stateless service that transforms ACTION data into transaction structure. Key management is entirely the caller's responsibility.

---

*See also: [Actions](./actions.md) | [Security Model](./security-model.md) | [Format Selection Guide](../components/encoder/format-selection.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
