<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Encoder Format Selection

XChain supports five encoding formats for embedding ACTION payloads in blockchain transactions: four script-output lanes (`OP_RETURN`, `MULTISIGN`, `P2SH`, `P2WSH`) and the Taproot envelope, which carries the payload in a tapscript witness instead. The encoder auto-selects between `OP_RETURN` (payload <= 76 bytes) and `P2SH` (larger payloads); `P2WSH`, `MULTISIGN` and `TAPROOT` must be requested explicitly via the `encoding` parameter, or reached by passing `encoding: AUTO` for the cheapest carrier the network and signer support. This document explains each format's characteristics, limits, and trade-offs to help you choose when overriding the default.

## Format Summary

| Format | Max Payload | Transactions | Relative Cost | Best For |
|---|---|---|---|---|
| OP_RETURN | 76 bytes user data (80 bytes total) | 1 | Lowest | Most actions |
| Multisig | ~60 bytes/output | 1 | Low–Medium | Single-tx medium payloads |
| P2SH | 8,192 bytes (476-byte chunks) | 2 | Medium | Medium–large payloads |
| P2WSH | 8,192 bytes (476-byte chunks) | 2 | Medium–High | Large payloads (SegWit-discounted) |
| TAPROOT (envelope) | 390,000 bytes (520-byte pushes in one witness) | 2 | About half the weight per byte of P2WSH | Very large payloads on Bitcoin and Litecoin |

## Format Details

### OP_RETURN: 80 bytes total (76 bytes user data + 4-byte XCHN prefix)

The obfuscated payload is stored in an `OP_RETURN` output. OP_RETURN outputs are provably unspendable, so they do not grow the UTXO set. This is the cheapest format because it minimizes byte count and carries no future spending cost.

Most common XChain actions fit within 76 bytes of user data: SEND (single recipient), MINT, simple ISSUE, ADDRESS update, MESSAGE, and most DISPENSER and ORDER operations.

Creating a betting market is a notable exception: a BET format 0 payload carries a label of up to 250
characters plus 2 to 16 outcome labels, so it routinely exceeds OP_RETURN and lands in the chunked
lane. Placing, resolving and cancelling a bet are small by comparison, since they reference the
market by action index rather than repeating its definition.

**Unconditional across chains:** All supported chains (Bitcoin, Litecoin, Dogecoin) enforce a single-OP_RETURN-per-transaction rule (`singleOpReturnPolicy: true`). The encoder rejects any OP_RETURN payload above 76 bytes of user data at construction time, on every chain, to prevent the creation of non-standard multi-OP_RETURN transactions that would be dropped by the network. There is no chain-dependent exception; the 76-byte limit is a hard ceiling regardless of which chain the transaction targets.

### Multisig: approximately 60 bytes per output, two fixed key slots

The payload is split across two fixed data-carrying public key positions in a 1-of-3 bare multisig output (the third slot is the real signer's key). This is a single-transaction format, which avoids the two-step broadcast required by P2SH and P2WSH. Capacity does not scale with additional key slots; each output carries a fixed ~60 bytes, so larger payloads require additional outputs.

Multisig is appropriate when the payload is slightly too large for OP_RETURN and the caller needs a single-broadcast flow. It is less common than P2SH or P2WSH for large payloads because the capacity ceiling is relatively low.

### P2SH: up to 8,192 bytes (476-byte chunks)

The payload is embedded in one or more redeem scripts. Payloads larger than a single 476-byte chunk are split across multiple P2SH outputs (fund-then-spend pairs), up to the shared 8,192-byte compiled-ACTION ceiling. Two transactions are required:

- **Fund tx**: locks funds to the P2SH output(s) (hash of each redeem script)
- **Spend tx**: spends from the P2SH output(s), revealing each full redeem script in the scriptSig

Both transactions must be broadcast in order. The decoder reads the spend transaction's scriptSig(s) to reassemble the payload. See [Encoding](../../concepts/encoding.md) for the canonical chunking model.

P2SH is the auto-selected format for any payload above the 76-byte OP_RETURN limit: larger ISSUE operations, BATCH commands that combine multiple actions, or any action with additional fields.

### P2WSH: up to 8,192 bytes

Functionally identical to P2SH but uses SegWit. The payload is embedded in a witness script locked to a P2WSH output. The same two-transaction pattern applies:

- **Fund tx**: locks funds to the P2WSH output
- **Spend tx**: reveals the witness script

SegWit's witness discount makes P2WSH more fee-efficient than P2SH for large payloads. P2SH and P2WSH share the same 476-byte chunking and 8,192-byte ceiling; choose P2WSH (explicitly) for FILE actions, large BROADCAST messages, or any large payload where the SegWit fee discount matters. P2WSH is never auto-selected.

The 8,192-byte figure is the effective protocol ceiling: it is the maximum **compiled** ACTION payload size the decoder will accept; the on-chain script push measured before decompile strips the OP_PUSHDATA prefix, not the decoded ACTION string (which is 1–3 bytes shorter) and not the raw P2WSH script-level capacity (which is higher, ~9,956 bytes). Payloads above 8,192 bytes are rejected at encode time and would be dropped by the decoder if broadcast, so this ceiling applies to every script-output format; it is not specific to P2WSH. The Taproot envelope is the one lane it does not govern: it carries its own ceiling, described below.

### TAPROOT: the envelope, up to 390,000 bytes in one witness

Available on **Bitcoin and Litecoin only**. Dogecoin has no SegWit, therefore no Taproot and no envelope; DOGE keeps the chunk lanes.

The whole payload is pushed raw inside a single tapscript, in an `OP_FALSE OP_IF` branch that never executes. Two transactions carry it:

- **Commit tx**: creates one P2TR output whose script tree holds that data leaf, under a sender-owned internal key
- **Reveal tx**: spends the output through the script path, exposing the envelope in the witness. The reveal is the transaction the action belongs to

Unlike the chunk lanes there is no marker `OP_RETURN` output: the leaf carries a cleartext `XCHN` magic, so recognition is a pattern match with no extra output to pay for. One `create_tx` call returns both PSBTs together; the envelope never uses the `p2shHash` two-call reveal flow, and `compressedPubKey` is required because it becomes the envelope's internal key.

The envelope replaces the 8,192-byte ceiling with its own, `ENVELOPE_MAX_PAYLOAD` = 390,000 bytes, sized against Bitcoin's standard transaction weight rather than picked as a round number. At roughly half the weight per byte of the P2WSH lane, one input and one output replace about 820 chunk outputs per 390 KB.

Two gates guard it, both fail-closed:

- The encoder refuses to build an envelope below the chain's recognition height. Every decoder would ignore the reveal, so the caller would pay a real fee for an action that never exists, and nothing downstream could detect the loss.
- `AUTO` resolves to the envelope only when the caller affirms `options.signerSupportsTapscript`, which defaults to false. The reveal has to be signable before the commit is broadcast, so choosing the envelope for a signer that cannot spend the leaf does not raise an error, it strands the committed funds.

Full specification: [Taproot Envelope](../../protocol/taproot-envelope.md).

## Decision Flowchart

```mermaid
flowchart TD
    START{"Obfuscated payload length?"}
    START -->|"<= 76 bytes (user data; 80 bytes total per output including 4-byte XCHN prefix)"| OPRETURN["OP_RETURN<br>(single tx, cheapest)<br>auto-selected"]
    START -->|"> 76 bytes (user data), <= 8,192 bytes"| P2SH["P2SH<br>(two tx, medium cost; 476-byte chunks)<br>auto-selected"]
    P2SH -.->|"alternative, explicit only"| P2WSH["P2WSH<br>same 476-byte chunking + 8,192 ceiling, SegWit-discounted,<br>must be requested explicitly via encoding=P2WSH,<br>never auto-selected"]
    START -->|"> 8,192 bytes"| TAPROOT["TAPROOT envelope<br>up to 390,000 bytes in one witness; BTC and LTC only,<br>must be requested explicitly via encoding=TAPROOT or AUTO,<br>never chosen by the size fallback"]
    TAPROOT -.->|"chain has no Taproot, or payload > 390,000 bytes"| REJECTED["Rejected<br>(above the chosen lane's ceiling:<br>8,192 bytes on the script-output lanes,<br>390,000 in the envelope)"]
```

The auto-selection path only produces `OP_RETURN` or `P2SH`. The `P2WSH`, `MULTISIGN` and `TAPROOT` rows represent recommended explicit encoding choices; they are never chosen by the size fallback. To use any of them, pass the `encoding` parameter explicitly in your `create_tx` call, or pass `encoding: AUTO` to have the encoder price the payload and pick the cheapest lane the network and signer support.

Multisig is a single-transaction format chosen for medium payloads slightly larger than OP_RETURN, not an overflow path for payloads above the P2WSH range. The 8,192-byte decoder ceiling applies to every script-output format, so none of the four can carry a payload above it; only the Taproot envelope reaches further, and only where Taproot exists.

## Practical Guidelines

**Use OP_RETURN** for the vast majority of actions. SEND, MINT, simple ISSUE, ORDER, DISPENSER, and most others fit comfortably within 76 bytes of user data (80 bytes total per output).

**Use P2SH** when constructing BATCH commands combining several actions, or ISSUE actions with long token names, descriptions, or callback URLs.

**Use P2WSH** (explicitly) when embedding large FILE content or BROADCAST payloads where the SegWit fee discount matters; it shares P2SH's 476-byte chunking and 8,192-byte ceiling but is not auto-selected.

**Use Multisig** rarely, primarily when a single-transaction flow is required and the payload is too large for OP_RETURN.

**Use TAPROOT** (explicitly, on Bitcoin or Litecoin) for payloads that outgrow the 8,192-byte script-output ceiling, or for any large FILE where the weight saving over P2WSH is worth the commit/reveal pair. Confirm the signer can produce a BIP341 script-path signature first.

## Automatic Selection

The encoder's built-in size fallback chooses between two formats: `OP_RETURN` for payloads of 76 bytes or fewer (80 bytes including the XCHN prefix), and `P2SH` for everything larger. It stays exactly as shipped, because resolving to the envelope would change the response from one PSBT to a commit/reveal pair and no existing caller expects that. To use `P2WSH`, `MULTISIGN` or `TAPROOT`, pass the `encoding` parameter explicitly.

Passing `encoding: AUTO` opts into smallest-footprint selection instead: the encoder measures the payload after compression and picks the cheapest lane the network and the caller's signer can actually use, resolving to the envelope only when the chain has Taproot and `options.signerSupportsTapscript` is affirmed. If you need to inspect which format was actually used, the response includes an `encoding` field.

## Related

- [Encoder](README.md): encoding service overview and API reference
- [Taproot Envelope](../../protocol/taproot-envelope.md): the envelope's grammar, consensus rules, and activation heights
- [Data Pipeline](../../architecture/data-pipeline.md): how encoded transactions move through the platform

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
