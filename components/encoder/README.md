<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Encoder

## What is xchain-encoder

xchain-encoder is the PSBT encoding service of the XChain Platform. It takes an ACTION string, a set of UTXOs, and a public key, and returns an unsigned Partially Signed Bitcoin Transaction (PSBT) ready for the caller to sign and broadcast. The encoder is fully stateless — it holds no database and no persistent state between calls.

The encoder's sole responsibility is to embed XChain protocol data into a transaction correctly and efficiently. The caller is responsible for signing and broadcasting.

## Features

- **Stateless** — no database, no persistent connections; every call is independent
- **Four encoding formats** — OP_RETURN (80B total, 76B user data), P2SH (476B), P2WSH (8,192B), and multisig (~61B/key); auto-selected by payload size
- **Two-transaction orchestration** — automatic tx1 (fund) → tx2 (spend/reveal) pattern for P2SH and P2WSH with OP_RETURN marker
- **AES-128-CTR obfuscation** — derives key and IV from the first input's txid; `XCHN` magic prefix on all payloads
- **UTXO selection** — largest-first selection, duplicate removal, optional unconfirmed filtering, automatic change output
- **Fee estimation** — byte-accurate transaction size estimation per format via `TxSizeEstimator`; dust floor enforcement
- **Fee rate cap** — configurable maximum fee rate prevents runaway estimates (e.g., regtest feedback loops)
- **Input validation** — centralized parameter validation with typed errors (TypeError/RangeError) for all 15 `createTransaction` parameters
- **Multi-chain support** — Bitcoin, Litecoin, and Dogecoin on mainnet, testnet, and regtest (9 network configs with chain-specific dust thresholds; Litecoin uses 5,460 litoshis on all three networks — 10× Bitcoin's 546 satoshis)
- **Replace-By-Fee** — optional RBF signaling via UTXO sequence number
- **Custom outputs** — arbitrary address/value outputs for COINPay native coin payments and other use cases
- **JSON-RPC API** — Express server with Helmet security headers, optional API key authentication, configurable rate limiting, and CORS
- **Browser bundle** — Browserify build for client-side PSBT generation without routing private keys through a server

## Encoding Process

Every encode call follows the same sequence regardless of format:

1. **Prepend magic prefix** — `XCHN` (4 bytes) is prepended to the ACTION string
2. **Obfuscate** — the prefixed payload is encrypted with AES-128-CTR using the first input's txid:
   - Key: first 16 hex characters of the txid (8 bytes)
   - IV: next 16 hex characters of the txid (8 bytes)
3. **Select format** — the encoder picks the most efficient encoding format based on the obfuscated payload length (see [Format Selection](Format_Selection.md))
4. **Build transaction** — inputs are selected from the provided UTXOs, outputs are constructed per the chosen format, fees are calculated, and a change output is added if needed
5. **Return PSBT** — the unsigned PSBT is returned to the caller in hex format

## Encoding Formats

### OP_RETURN

Maximum payload: **76 bytes of user data** (80 bytes total per output, including the 4-byte XCHN prefix)

The obfuscated payload is embedded in an `OP_RETURN` output. This is a single transaction — the encoder constructs it, the caller signs and broadcasts once. OP_RETURN outputs are provably unspendable and are the cheapest encoding method. Best for most SEND, ISSUE, and MINT actions.

### P2SH

Maximum payload: **476 bytes**

The payload is embedded in a redeem script, which is hashed and locked to a P2SH output in a funding transaction. A second spending transaction then reveals the full redeem script in the scriptSig, making the payload visible on-chain. Two transactions must be signed and broadcast in order:

1. **Fund** — locks coin to the P2SH output containing the hashed script
2. **Spend** — spends from the P2SH output, revealing the full script (and therefore the payload) in the scriptSig

The decoder reads the spend transaction's scriptSig to extract the payload.

### P2WSH

Maximum payload: **8,192 bytes** (decoder-enforced ceiling)

Functionally identical to P2SH but uses SegWit. The payload is embedded in a witness script locked to a P2WSH output. The two-transaction pattern is the same:

1. **Fund** — locks coin to the P2WSH output
2. **Spend** — spends from the P2WSH output, revealing the witness script

Because SegWit witness data is discounted when calculating transaction weight, P2WSH is more fee-efficient than P2SH for large payloads. Use this for FILE actions, large BROADCAST payloads, or any action requiring more than 476 bytes.

### Multisig

Payload capacity: **approximately 61 bytes per key**

The payload is split across the public key positions of a bare multisig output (`OP_m ... OP_n OP_CHECKMULTISIG`). This is a single-transaction format. The decoder reads the fake public keys from the output to extract the payload.

Multisig encoding is an alternative for payloads that exceed OP_RETURN's 76-byte user-data limit but where the caller prefers a single-transaction flow. The encoder handles splitting and padding automatically.

## Format Auto-Selection

The encoder selects the most efficient format automatically based on obfuscated payload length. See [Format Selection](Format_Selection.md) for the full decision logic and size limits.

## UTXO Management

The encoder accepts UTXOs from the caller (typically sourced from xchain-utxo-tracker). It selects the minimum set of inputs needed to cover the output value plus estimated fees, constructs a change output back to the source address if change exceeds the dust threshold, and includes all selected inputs in the PSBT.

Fee rates use the coin node's `estimatesmartfee` recommendation by default. The caller may pass an override fee rate.

## API

The encoder exposes a JSON-RPC API via Express with `express-json-rpc-router`.

### Methods

| Method | Description |
|---|---|
| `create_tx` | Encode an ACTION string into a PSBT given UTXOs and a public key |
| `broadcast_tx` | Submit a signed raw transaction hex to the coin node for broadcast |
| `get_utxos` | Fetch the UTXO set for a given address from xchain-utxo-tracker |
| `estimate_fee` | Return low / medium / high fee-rate tiers in base-units/vByte, sourced from the node's `estimatesmartfee` (targets: 6 / 3 / 1 blocks) |
| `ping` | Health check — returns `{ status: "success" }` |

A machine-readable OpenRPC 1.3.2 spec for all JSON-RPC methods is available at `GET /openrpc.json`.

### `create_tx` Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `data` | `string` | Yes | ACTION string to encode (e.g., `SEND\|0\|JDOG\|100\|addr`) |
| `pubkey` | `string` | Yes | Sender's public address |
| `utxos` | `Array<UTXO>` | No | UTXOs to spend; if omitted, fetched from UTXO Tracker |
| `customOutputs` | `Array<{address, value}>` | No | Additional outputs (e.g., COINPay payments) |
| `rawData` | `string` | No | Additional data ignored by decoder |
| `fee` | `number` | No | Fixed fee in satoshis (auto-calculated if omitted) |
| `feePerKb` | `number` | No | Fee rate in BTC/kB (bypasses node's `estimatesmartfee`) |
| `rbf` | `boolean` | No | Enable Replace-By-Fee signaling |
| `encoding` | `string` | No | Force encoding type: `OP_RETURN`, `P2SH`, `P2WSH`, or `MULTISIGN` |
| `change` | `string` | No | Change address |
| `p2shHash` | `string` | No | Previous tx ID for P2SH/P2WSH tx2 (paired with `p2shHex`) |
| `p2shHex` | `string` | No | Previous tx hex for P2SH/P2WSH tx2 (paired with `p2shHash`) |
| `compressedPubKey` | `string` | No | Compressed public key for MULTISIGN encoding |
| `unconfirmed` | `boolean` | No | Allow unconfirmed UTXOs (default: `true`) |
| `dust` | `number` | No | Override dust amount for outputs |

### UTXO Structure

```json
{
  "txid": "64-char hex string",
  "vout": 0,
  "value": 100000,
  "scriptPubKey": "hex"
}
```

### Response

```json
{
  "psbt": "hex-encoded PSBT (BIP 174)",
  "encoding": "OP_RETURN | P2SH | P2WSH | MULTISIGN"
}
```

### `broadcast_tx` Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tx_hex` | `string` | Yes | Signed raw transaction hex to broadcast |

### `broadcast_tx` Response

```json
{ "txid": "64-char hex string" }
```

### `get_utxos` Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `address` | `string` | Yes | Address whose UTXOs to retrieve |

### `get_utxos` Response

Returns an array of UTXO objects matching the UTXO Structure documented in the `create_tx` section:

```json
[
  {
    "txid": "64-char hex string",
    "vout": 0,
    "value": 100000,
    "scriptPubKey": "hex"
  }
]
```

### Error Codes

| Code | Meaning |
|---|---|
| `-32602` | Invalid params — validation error (TypeError or RangeError from `validator.js`) |
| `-32603` | Internal error — encoder failure (e.g., insufficient UTXOs, unsupported network) |
| `-32001` | Unauthorized — missing or incorrect `x-api-key` header |
| `-32029` | Rate limited — too many requests |

## Browser Bundle

A Browserify build is available for client-side use. This allows web applications to construct PSBTs in the browser without routing the private key through a server. The bundle exposes `window.XChainEncoder` with the same encoding logic.

```bash
npm run build       # Production (minified) → dist/xchain_encoder.min.js
npm run build:dev   # Development (unminified) → dist/xchain_encoder.min.js
```

## Installation

```bash
git clone https://github.com/XChain-Platform/xchain-encoder.git
cd xchain-encoder
npm install
npm run api
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `NETWORK` | Yes | — | Coin and network (`bitcoin-mainnet`, `dogecoin-testnet`, `litecoin-regtest`, etc.) |
| `NODE_URL` | Yes | — | Coin node RPC host |
| `NODE_PORT` | Yes | — | Coin node RPC port |
| `NODE_USER` | Yes | — | RPC username |
| `NODE_PASSWORD` | Yes | — | RPC password |
| `ENCODER_API_PORT` | No | `3003` | JSON-RPC API port |
| `DUST_AMOUNT` | No | Network default | Minimum output value in satoshis |
| `UTXO_TRACKER_URL` | No | — | xchain-utxo-tracker service host |
| `UTXO_TRACKER_API_PORT` | No | — | xchain-utxo-tracker service port |
| `MAX_FEE_RATE_KB` | No | Uncapped | Absolute maximum fee rate in sat/kB |
| `MAX_FEE_RATE_MULTIPLIER` | No | `100` | Caps caller-supplied fee/feePerKb at this multiple of the node's fee estimate (`0` disables) |
| `API_KEY` | No | Disabled | API key for `x-api-key` header authentication |
| `ENCODER_RATE_LIMIT_RPM` | No | `60` | Maximum requests per minute per IP |
| `CORS_ORIGIN` | No | Disabled | CORS origin (`*` to allow all) |

## Testing

The encoder maintains a comprehensive test suite spanning 10 testing disciplines with approximately 769 tests total. All tests except the root-level regtest integration suite run offline with mocked connectors — no live coin node required.

### Test Scripts

```bash
npm run smoke-test        # Operational health checks (~10 tests, <1s)
npm run test:unit         # Isolated method tests (114 tests)
npm run test:integration  # Multi-component pipeline tests (108 tests)
npm run test:boundary     # Edge-case and limit tests (~120 tests)
npm run test:chaos        # Failure injection tests (61 tests)
npm run test:regression   # Curated critical-path regression suite (196 tests)
npm run mutate            # Full mutation testing via StrykerJS
npm run mutate:quick      # Incremental mutation check (XChainEncoder.js only)
npm run bench             # Performance benchmarks
npm run bench:full        # Extended benchmarks with JSON output
npm test                  # Regtest integration tests (requires local bitcoind)
```

### Regression Test Suite

The regression suite (`test/regression/`) provides a curated safety net covering all critical encoder paths. It runs entirely offline in under 100ms and is designed to catch regressions after any code change.

| File | Tests | Coverage Area |
|---|---|---|
| `reg-01-encoding-types` | 16 | All 4 encoding types (OP_RETURN, P2SH, P2WSH, MULTISIGN) |
| `reg-02-obfuscation` | 13 | AES-128-CTR round-trip, key derivation, TXID sensitivity |
| `reg-03-fee-utxo` | 17 | UTXO selection, fee calculation, dust floor, change output |
| `reg-04-validator` | 56 | All input validation functions (validator.js) |
| `reg-05-multi-chain` | 20 | Bitcoin, Litecoin, Dogecoin configs and dust thresholds |
| `reg-06-p2sh-p2wsh-sequence` | 14 | Two-transaction tx1→tx2 chaining integrity |
| `reg-07-action-pipeline` | 14 | Key ACTION types through full encode/decode pipeline |
| `reg-08-api-contract` | 12 | JSON-RPC parameter flow and PSBT serialization |

### Test Helpers

Shared test utilities in `test/integration/helpers/`:

- **utxoFactory.js** — Encoder, UTXO, and address fixture factories with deterministic TXIDs
- **actionFactory.js** — ACTION payload builders for all supported action types
- **deobfuscate.js** — Payload extraction and AES-128-CTR decryption utilities

## Related

- [Format Selection](Format_Selection.md) — decision guide for choosing an encoding format
- [UTXO Tracker](../utxo-tracker/) — the service that supplies UTXOs to the encoder
- [Data Pipeline](../../architecture/Data_Pipeline.md) — full platform ingestion flow
- [Testing](../../developer-guide/TESTING.md) — platform-wide testing philosophy and coverage

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
