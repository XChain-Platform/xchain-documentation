# XChain Platform Encoder

## What is xchain-encoder

xchain-encoder is the PSBT encoding service of the XChain Platform. It takes an ACTION string, a set of UTXOs, and a public key, and returns an unsigned Partially Signed Bitcoin Transaction (PSBT) ready for the caller to sign and broadcast. The encoder is fully stateless — it holds no database and no persistent state between calls.

The encoder's sole responsibility is to embed XChain protocol data into a transaction correctly and efficiently. The caller is responsible for signing and broadcasting.

## Features

- **Stateless** — no database, no persistent connections; every call is independent
- **Four encoding formats** — OP_RETURN, P2SH, P2WSH, and multisig; auto-selected by payload size
- **AES-128-CTR obfuscation** — derives key and IV from the first input's txid
- **UTXO selection** — selects inputs, calculates fees, constructs change outputs
- **Fee estimation** — calculates byte-accurate transaction size per format before selecting inputs
- **Browser bundle** — webpack build available for client-side PSBT generation without a server
- **JSON-RPC API** — standard HTTP interface for all encoding operations

## Encoding Process

Every encode call follows the same sequence regardless of format:

1. **Prepend magic prefix** — `XCHN` (4 bytes) is prepended to the ACTION string
2. **Obfuscate** — the prefixed payload is encrypted with AES-128-CTR using the first input's txid:
   - Key: first 16 hex characters of the txid (8 bytes)
   - IV: next 16 hex characters of the txid (8 bytes)
3. **Select format** — the encoder picks the most efficient encoding format based on the obfuscated payload length (see [Format Selection](FORMAT_SELECTION.md))
4. **Build transaction** — inputs are selected from the provided UTXOs, outputs are constructed per the chosen format, fees are calculated, and a change output is added if needed
5. **Return PSBT** — the unsigned PSBT is returned to the caller in base64 format

## Encoding Formats

### OP_RETURN

Maximum payload: **76 bytes**

The obfuscated payload is embedded in an `OP_RETURN` output. This is a single transaction — the encoder constructs it, the caller signs and broadcasts once. OP_RETURN outputs are provably unspendable and are the cheapest encoding method. Best for most SEND, ISSUE, and MINT actions.

### P2SH

Maximum payload: **476 bytes**

The payload is embedded in a redeem script, which is hashed and locked to a P2SH output in a funding transaction. A second spending transaction then reveals the full redeem script in the scriptSig, making the payload visible on-chain. Two transactions must be signed and broadcast in order:

1. **Fund** — locks coin to the P2SH output containing the hashed script
2. **Spend** — spends from the P2SH output, revealing the full script (and therefore the payload) in the scriptSig

The decoder reads the spend transaction's scriptSig to extract the payload.

### P2WSH

Maximum payload: **9,956 bytes**

Functionally identical to P2SH but uses SegWit. The payload is embedded in a witness script locked to a P2WSH output. The two-transaction pattern is the same:

1. **Fund** — locks coin to the P2WSH output
2. **Spend** — spends from the P2WSH output, revealing the witness script

Because SegWit witness data is discounted when calculating transaction weight, P2WSH is more fee-efficient than P2SH for large payloads. Use this for FILE actions, large BROADCAST payloads, or any action requiring more than 476 bytes.

### Multisig

Payload capacity: **approximately 61 bytes per key**

The payload is split across the public key positions of a bare multisig output (`OP_m ... OP_n OP_CHECKMULTISIG`). This is a single-transaction format. The decoder reads the fake public keys from the output to extract the payload.

Multisig encoding is an alternative for payloads that exceed OP_RETURN's 76-byte limit but where the caller prefers a single-transaction flow. The encoder handles splitting and padding automatically.

## Format Auto-Selection

The encoder selects the most efficient format automatically based on obfuscated payload length. See [Format Selection](FORMAT_SELECTION.md) for the full decision logic and size limits.

## UTXO Management

The encoder accepts UTXOs from the caller (typically sourced from xchain-utxo-tracker). It selects the minimum set of inputs needed to cover the output value plus estimated fees, constructs a change output back to the source address if change exceeds the dust threshold, and includes all selected inputs in the PSBT.

Fee rates use the coin node's `estimatesmartfee` recommendation by default. The caller may pass an override fee rate.

## API

The encoder exposes a JSON-RPC API. Key methods:

| Method | Description |
|---|---|
| `encode` | Encode an ACTION string into a PSBT given UTXOs and a public key |
| `estimateFee` | Estimate the fee for a given ACTION string and format |
| `getFormats` | List available encoding formats and their size limits |

## Browser Bundle

A webpack build is available for client-side use. This allows web applications to construct PSBTs in the browser without routing the private key through a server. The bundle exposes the same encoding logic and returns a base64 PSBT ready for signing with any compatible wallet library.

## Installation

Clone the repository and install dependencies from within the `xchain-encoder` directory:

```bash
git clone https://github.com/XChain-platform/xchain-encoder.git
cd xchain-encoder
npm install
npm run api
```

## Configuration

The encoder requires minimal configuration:

| Parameter | Description |
|---|---|
| `port` | JSON-RPC API port |
| `feeRate` | Optional override fee rate (sat/vbyte) |

## Related

- [Format Selection](FORMAT_SELECTION.md) — decision guide for choosing an encoding format
- [UTXO Tracker](../utxo-tracker/) — the service that supplies UTXOs to the encoder
- [Data Pipeline](../../architecture/DATA_PIPELINE.md) — full platform ingestion flow
