<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Encoder Format Selection

XChain supports four encoding formats for embedding ACTION payloads in blockchain transactions. The encoder selects the most efficient format automatically based on payload size. This document explains each format's characteristics, limits, and trade-offs. It is informational — you do not need to specify a format when calling the encoder.

## Format Summary

| Format | Max Payload | Transactions | Relative Cost | Best For |
|---|---|---|---|---|
| OP_RETURN | 76 bytes | 1 | Lowest | Most actions |
| Multisig | ~61 bytes/key | 1 | Low–Medium | Single-tx medium payloads |
| P2SH | 476 bytes | 2 | Medium | Medium payloads |
| P2WSH | 8,192 bytes | 2 | Medium–High | Large payloads |

## Format Details

### OP_RETURN — up to 76 bytes

The obfuscated payload is stored in an `OP_RETURN` output. OP_RETURN outputs are provably unspendable, so they do not grow the UTXO set. This is the cheapest format because it minimizes byte count and carries no future spending cost.

Most common XChain actions fit within 76 bytes: SEND (single recipient), MINT, simple ISSUE, ADDRESS update, MESSAGE, and most DISPENSER and ORDER operations.

### Multisig — approximately 61 bytes per public key slot

The payload is split across fake public key positions in a bare multisig output. This is a single-transaction format, which avoids the two-step broadcast required by P2SH and P2WSH. Capacity scales with the number of key slots used, at roughly 61 bytes each.

Multisig is appropriate when the payload is slightly too large for OP_RETURN and the caller needs a single-broadcast flow. It is less common than P2SH or P2WSH for large payloads because the capacity ceiling is relatively low.

### P2SH — up to 476 bytes

The payload is embedded in a redeem script. Two transactions are required:

- **Fund tx** — locks funds to the P2SH output (hash of the redeem script)
- **Spend tx** — spends from the P2SH output, revealing the full redeem script in the scriptSig

Both transactions must be broadcast in order. The decoder reads the spend transaction's scriptSig to extract the payload.

P2SH is suitable for larger ISSUE operations, BATCH commands that combine multiple actions, or any action with additional fields that push past the OP_RETURN limit.

### P2WSH — up to 8,192 bytes

Functionally identical to P2SH but uses SegWit. The payload is embedded in a witness script locked to a P2WSH output. The same two-transaction pattern applies:

- **Fund tx** — locks funds to the P2WSH output
- **Spend tx** — reveals the witness script

SegWit's witness discount makes P2WSH more fee-efficient than P2SH for large payloads. Use this for FILE actions, large BROADCAST messages, or any payload over 476 bytes.

The 8,192-byte figure is the effective protocol ceiling: it is the maximum decoded ACTION data length the decoder will accept, not the raw P2WSH script-level capacity (which is higher, ~9,956 bytes). Payloads above 8,192 bytes are rejected at encode time and would be dropped by the decoder if broadcast, so this ceiling applies to every format — it is not specific to P2WSH.

## Decision Flowchart

```
Obfuscated payload length?
         |
    <= 76 bytes
         |
    OP_RETURN  (single tx, cheapest)
         |
    > 76 bytes
         |
    <= 476 bytes
         |
    P2SH  (two tx, medium cost)
         |
    > 476 bytes
         |
    <= 8,192 bytes
         |
    P2WSH  (two tx, SegWit-discounted)
         |
    > 8,192 bytes
         |
    Rejected  (exceeds the 8,192-byte protocol ceiling enforced by the decoder)
```

Multisig is a single-transaction format chosen for medium payloads slightly larger than OP_RETURN, not an overflow path for payloads above the P2WSH range. The 8,192-byte decoder ceiling applies to every format, so no format can carry a payload above it.

## Practical Guidelines

**Use OP_RETURN** for the vast majority of actions. SEND, MINT, simple ISSUE, ORDER, DISPENSER, and most others fit comfortably within 76 bytes.

**Use P2SH** when constructing BATCH commands combining several actions, or ISSUE actions with long token names, descriptions, or callback URLs.

**Use P2WSH** when embedding FILE content or BROADCAST payloads that approach or exceed the P2SH limit. The SegWit discount partially offsets the higher byte count.

**Use Multisig** rarely — primarily when a single-transaction flow is required and the payload is too large for OP_RETURN.

## Automatic Selection

The encoder measures the obfuscated payload length and selects the appropriate format without any input from the caller. Pass the ACTION string and UTXOs; the encoder handles the rest. If you need to inspect which format was chosen, the encode response includes a `format` field.

## Related

- [Encoder](README.md) — encoding service overview and API reference
- [Data Pipeline](../../architecture/Data_Pipeline.md) — how encoded transactions move through the platform

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
