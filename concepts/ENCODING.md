# Transaction Encoding

XChain embeds ACTION data in standard blockchain transactions. Two layers are involved: **obfuscation** (making the data harder to scan for) and **embedding** (choosing how to store the data in the transaction). Together they let an ACTION of virtually any size ride in a coin transaction that standard nodes handle without modification.

## Layer 1: Obfuscation

Before an ACTION string is embedded in a transaction, it is processed as follows:

1. The `XCHN` magic prefix (4 ASCII bytes) is prepended to the ACTION string.
2. The resulting payload is encrypted using **AES-128-CTR** with:
   - **Key**: the first 16 hex characters of the first input's txid, decoded to 8 bytes
   - **IV**: the next 16 hex characters (bytes 9–16 of the txid), decoded to 8 bytes

The output is a byte sequence that looks like random data to any observer who does not know the algorithm.

**This is obfuscation, not encryption.** The txid used as the key is fully public — anyone can look it up in any block explorer. Anyone who knows the XChain algorithm can decrypt any payload. The purpose is to prevent naive keyword scanning and accidental interpretation of unrelated data, not to provide confidentiality.

When the decoder scans a transaction, it applies the reverse: attempt decryption using the first input's txid, then check whether the first 4 bytes of the result are `XCHN`. If they are, the payload is a valid XChain ACTION. If not, the transaction is not an XChain transaction and is skipped.

Note: the key/IV are derived from the *spending* transaction's first input txid, not from the transaction being spent. This means the key is not known until the ACTION transaction is constructed.

## Layer 2: Embedding Formats

The obfuscated payload needs to be stored somewhere in the transaction that a standard node will accept and propagate. XChain supports four embedding formats, each with different capacity and transaction structure tradeoffs.

### OP_RETURN

**Capacity**: up to 76 bytes of data  
**Transactions**: 1 (single broadcast)  
**Mechanism**: Data is stored in an `OP_RETURN` output — a standard Bitcoin output type explicitly designed for arbitrary data. The output is unspendable by design, so it adds no UTXO bloat to the UTXO set. Miners include it normally.

OP_RETURN is the preferred format for short ACTIONs (simple sends, mints, basic issues). It is the most efficient and leaves the smallest footprint.

### Multisig

**Capacity**: approximately 61 bytes per key, scalable across multiple keys  
**Transactions**: 1 (single broadcast)  
**Mechanism**: Data is encoded into the public key positions of a standard multisig output. The "keys" are not real signing keys — they are data payloads formatted to look like public keys. The multisig output is spendable (unlike OP_RETURN), but the "keys" are not associated with any private key, making the funds effectively unrecoverable. This format is discouraged for large payloads due to UTXO set pollution.

### P2SH (Pay-to-Script-Hash)

**Capacity**: up to 476 bytes of data  
**Transactions**: 2 (fund then spend)  
**Mechanism**: The ACTION data is embedded in a redeem script. A first transaction creates an output locked to the hash of that script (the "fund" transaction). A second transaction spends that output by revealing the full script (the "spend" transaction). The decoder reads the revealed script from the spending transaction input.

The two-transaction pattern means the ACTION is not visible until the spend transaction is mined. The fund transaction just looks like a payment to a script hash.

### P2WSH (Pay-to-Witness-Script-Hash)

**Capacity**: up to 9,956 bytes of data  
**Transactions**: 2 (fund then spend)  
**Mechanism**: Identical in concept to P2SH but uses SegWit witness data for the reveal. The larger capacity comes from the witness discount applied to SegWit data — witness bytes cost one quarter of the weight of non-witness bytes for fee purposes. This makes P2WSH the preferred format for large payloads (file uploads, long broadcast messages, dense batch operations).

## Format Auto-Selection

The encoder automatically selects the optimal format based on the payload size:

| Payload size | Selected format |
|---|---|
| ≤ 76 bytes | OP_RETURN |
| 77 – 476 bytes | P2SH |
| 477 – 9,956 bytes | P2WSH |
| Structured multi-key | Multisig (manual selection) |

The caller does not need to specify a format. The encoder calculates the encoded payload size and picks the smallest format that fits. In practice, most common ACTIONs (SEND, MINT, ORDER, DISPENSER) fit in OP_RETURN. Larger ACTIONs (FILE, long BATCH, rich BROADCAST) use P2SH or P2WSH.

A format selection guide with size calculation details is available at [`../components/encoder/FORMAT_SELECTION.md`](../components/encoder/FORMAT_SELECTION.md).

## The PSBT Workflow

The encoder produces an **unsigned PSBT** (Partially Signed Bitcoin Transaction) — a standard format for transactions that need to be signed before broadcasting.

The workflow:

1. **Encode**: The encoder receives an ACTION string (or constructs one from parameters), selects a format, builds the transaction structure, and returns a PSBT.
2. **Sign**: The caller signs the PSBT using their wallet software. The encoder never receives or handles private keys.
3. **Broadcast**: The signed transaction is submitted to the coin node's mempool. From this point it is a standard coin transaction.

For P2SH and P2WSH, the encoder produces two PSBTs — one for the fund transaction and one for the spend transaction. The fund must be broadcast and confirmed (or at least in the mempool) before the spend is valid.

The separation between encoding and signing is a deliberate security boundary. The encoder is a stateless service that transforms ACTION data into transaction structure. Key management is entirely the caller's responsibility.

---

*See also: [Actions](./ACTIONS.md) | [Security Model](./SECURITY_MODEL.md) | [Format Selection Guide](../components/encoder/FORMAT_SELECTION.md)*
