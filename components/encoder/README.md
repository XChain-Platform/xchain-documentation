<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Encoder

## What is xchain-encoder

xchain-encoder is the PSBT encoding service of the XChain Platform. It takes an ACTION string, a set of UTXOs, and a public key, and returns an unsigned Partially Signed Bitcoin Transaction (PSBT) ready for the caller to sign and broadcast. The encoder is fully stateless; it holds no database and no persistent state between calls.

The encoder's sole responsibility is to embed XChain protocol data into a transaction correctly and efficiently. The caller is responsible for signing and broadcasting.

## Features

- **Stateless**: no database, no persistent connections; every call is independent
- **Four encoding formats**: OP_RETURN (80B total, 76B user data), P2SH (476B chunks up to 8,192B), P2WSH (the same 476B chunks up to 8,192B), and multisig (~61B/key); auto-selected by payload size
- **Two-transaction orchestration**: automatic tx1 (fund) → tx2 (spend/reveal) pattern for P2SH and P2WSH with OP_RETURN marker
- **AES-128-CTR obfuscation**: derives key and IV from the first input's txid; `XCHN` magic prefix on all payloads
- **UTXO selection**: largest-first selection, duplicate removal, optional unconfirmed filtering, automatic change output
- **Fee estimation**: byte-accurate transaction size estimation per format via `TxSizeEstimator`; dust floor enforcement
- **Fee rate cap**: configurable maximum fee rate prevents runaway estimates (e.g., regtest feedback loops)
- **Input validation**: centralized parameter validation with typed errors (TypeError/RangeError) for all 16 `createTransaction` parameters
- **Multi-chain support**: Bitcoin, Litecoin, and Dogecoin on mainnet, testnet, and regtest (9 network configs with chain-specific dust thresholds; Litecoin uses 5,460 litoshis on all three networks, 10× Bitcoin's 546 satoshis)
- **Replace-By-Fee**: optional RBF signaling via UTXO sequence number
- **Custom outputs**: arbitrary address/value outputs for COINPay native coin payments and other use cases
- **JSON-RPC API**: Express server with Helmet security headers, optional API key authentication, configurable rate limiting, and CORS
- **Browser bundle**: Browserify build for client-side PSBT generation without routing private keys through a server

## Documentation

| Document | Description |
|---|---|
| [API Reference](api.md) | Complete JSON-RPC reference: all six methods with parameters, request/response examples, and error codes |
| [Format Selection](format-selection.md) | Decision guide and size limits for the four encoding formats |

## Encoding Process

Every encode call follows this sequence. Some steps are format-specific and are noted inline:

1. **Prepend magic prefix**: `XCHN` (4 bytes) is prepended to the ACTION string
2. **Obfuscate** (OP_RETURN and MULTISIGN only); the prefixed payload is encrypted with AES-128-CTR using the first input's txid. P2SH and P2WSH embed the payload directly in the redeem/witness script without this step.
   - Key: first 16 hex characters of the txid (16 bytes when treated as ASCII)
   - IV: next 16 hex characters of the txid (16 bytes when treated as ASCII)
3. **Select format**; the encoder picks the most efficient encoding format based on the obfuscated payload length (see [Format Selection](format-selection.md))
4. **Build transaction**: inputs are selected from the provided UTXOs, outputs are constructed per the chosen format, fees are calculated, and a change output is added if needed
5. **Return PSBT**; the unsigned PSBT is returned to the caller in hex format

## Encoding Formats

### OP_RETURN

Maximum payload: **76 bytes of user data** (80 bytes total per output, including the 4-byte XCHN prefix)

The obfuscated payload is embedded in an `OP_RETURN` output. This is a single transaction; the encoder constructs it, the caller signs and broadcasts once. OP_RETURN outputs are provably unspendable and are the cheapest encoding method. Best for most SEND, ISSUE, and MINT actions.

### P2SH

Maximum payload: **8,192 bytes** (decoder-enforced ceiling), packed in 476-byte chunks across as many outputs as needed

The payload is embedded in a redeem script, which is hashed and locked to a P2SH output in a funding transaction. Payloads larger than a single 476-byte chunk are split across multiple P2SH outputs (one fund-then-spend pair per chunk), up to the shared 8,192-byte compiled-ACTION ceiling. A second spending transaction then reveals the full redeem script in the scriptSig, making the payload visible on-chain. Two transactions must be signed and broadcast in order:

1. **Fund**: locks coin to the P2SH output containing the hashed script
2. **Spend**: spends from the P2SH output, revealing the full script (and therefore the payload) in the scriptSig

The decoder reads the spend transaction's scriptSig to extract the payload.

### P2WSH

Maximum payload: **8,192 bytes** (decoder-enforced ceiling)

Functionally identical to P2SH but uses SegWit. The payload is embedded in a witness script locked to a P2WSH output. The two-transaction pattern is the same:

1. **Fund**: locks coin to the P2WSH output
2. **Spend**: spends from the P2WSH output, revealing the witness script

Because SegWit witness data is discounted when calculating transaction weight, P2WSH is more fee-efficient than P2SH for large payloads. Capacity is the same as P2SH (476-byte chunks up to the 8,192-byte ceiling); the advantage is the fee discount, not a larger payload. Use this for FILE actions, large BROADCAST payloads, or any large payload where that discount matters.

### Multisig

Payload capacity: **approximately 61 bytes per key**

The payload is split across the public key positions of a bare multisig output (`OP_m ... OP_n OP_CHECKMULTISIG`). This is a single-transaction format. The decoder reads the fake public keys from the output to extract the payload.

Multisig encoding is an alternative for payloads that exceed OP_RETURN's 76-byte user-data limit but where the caller prefers a single-transaction flow. The encoder handles splitting and padding automatically.

## Format Auto-Selection

The encoder selects the most efficient format automatically based on obfuscated payload length. See [Format Selection](format-selection.md) for the full decision logic and size limits.

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
| `ping` | Health check: returns `{ status: "success" }` |
| `health` | Probes hard dependencies (UTXO tracker) and reports their reachability and sync state |

A machine-readable OpenRPC 1.3.2 spec for all JSON-RPC methods is served at `GET /openrpc.json`.

See the **[API Reference](api.md)** for full per-method parameters, request and response examples, the UTXO object shape, and the JSON-RPC error codes.

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
| `NETWORK` | Yes | None | Coin and network (`bitcoin-mainnet`, `dogecoin-testnet`, `litecoin-regtest`, etc.) |
| `NODE_URL` | Yes | None | Coin node RPC host |
| `NODE_PORT` | Yes | None | Coin node RPC port |
| `NODE_USER` | Yes | None | RPC username |
| `NODE_PASSWORD` | Yes | None | RPC password |
| `ENCODER_API_PORT` | No | `3003` | JSON-RPC API port |
| `DUST_AMOUNT` | No | Network default | Minimum output value in satoshis |
| `UTXO_TRACKER_URL` | No | None | xchain-utxo-tracker service host |
| `UTXO_TRACKER_API_PORT` | No | None | xchain-utxo-tracker service port |
| `MAX_FEE_RATE_KB` | No | Uncapped | Absolute maximum fee rate in sat/kB |
| `MAX_FEE_RATE_MULTIPLIER` | No | `100` | Caps caller-supplied fee/feePerKb at this multiple of the node's fee estimate (`0` disables) |
| `API_KEY` | No | Disabled | API key for `x-api-key` header authentication |
| `XCHAIN_COMPRESSION_DEFAULT` | No | On | Set to `0`/`false`/`off` to stop compressing FILE payloads by default. A deploy-time lever, not a feature switch: compressed FILEs are unreadable to a reader that predates compression support, so this exists to let the code release and the behaviour change land separately (readers everywhere first, then the encoder). Callers can always override per request with the `compress` parameter |
| `ENCODER_RATE_LIMIT_RPM` | No | `60` | Maximum requests per minute per IP |
| `ENCODER_MAX_RPC_BATCH` | No | `20` | Maximum calls permitted in one inbound JSON-RPC batch. The router runs `Promise.all` over a batch while the rate limiter counts the batch as a single request, so without this bound one ~1MB array fans out into thousands of concurrent `estimate_fee` / `create_tx` handlers |
| `ENCODER_TRUST_PROXY` | No | `loopback, uniquelocal` | Express `trust proxy` setting. The default recovers the real client IP behind a host proxy (loopback) or a Docker bridge (uniquelocal), and ignores a forged `X-Forwarded-For` when the encoder is exposed directly. Override with `false`, a hop count (e.g. `1`), or an address/CIDR list. Mirrors the hub's `HUB_TRUST_PROXY` |
| `UTXO_TRACKER_MAX_LAG_BLOCKS` | No | `2` | Maximum blocks the utxo-tracker may report as lag (its per-response `sync` field) before `create_tx` refuses to select UTXOs from it and fails with `UTXO_TRACKER_STALE` |
| `NODE_RPC_TIMEOUT` | No | `30000` | HTTP timeout in milliseconds for JSON-RPC calls to the coin node |
| `ENCODER_MAX_CONCURRENT_PROBES` | No | `16` | Concurrency cap for cheap probe requests (`GET /status`, `GET /openrpc.json`), which get their own gate so a monitoring flood cannot consume the budget real work needs. Over the cap a probe is refused immediately with `429` and `Retry-After: 1` rather than queued; `0` disables the cap |
| `ENCODER_MAX_CONCURRENT_REQUESTS` | No | `50` | Concurrency cap for everything that is not a probe. Same immediate-`429` behaviour, and `0` likewise disables it |
| `CORS_ORIGIN` | No | Disabled | CORS origin (`*` to allow all) |

## Testing

The encoder maintains a comprehensive test suite spanning 11 testing disciplines with 1,342 tests total (measured 2026-07-27). All tests except the root-level regtest integration suite run offline with mocked connectors. No live coin node required.

### Test Scripts

```bash
npm run smoke-test        # Operational health checks (52 tests, <1s)
npm run test:unit         # Isolated method tests (472 tests)
npm run test:integration  # Multi-component pipeline tests (112 tests)
npm run test:boundary     # Edge-case and limit tests (100 tests)
npm run test:chaos        # Failure injection tests (62 tests)
npm run test:regression   # Curated critical-path regression suite (263 tests)
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
| `reg-01-encoding-types` | 15+ | All 4 encoding types (OP_RETURN, P2SH, P2WSH, MULTISIGN) |
| `reg-02-obfuscation` | 10+ | AES-128-CTR round-trip, key derivation, TXID sensitivity |
| `reg-03-fee-utxo` | 15+ | UTXO selection, fee calculation, dust floor, change output |
| `reg-04-validator` | 85+ | All input validation functions (validator.js) |
| `reg-05-multi-chain` | 20+ | Bitcoin, Litecoin, Dogecoin configs and dust thresholds |
| `reg-06-p2sh-p2wsh-sequence` | 17+ | Two-transaction tx1->tx2 chaining integrity |
| `reg-07-action-pipeline` | 12+ | Key ACTION types through full encode/decode pipeline |
| `reg-08-api-contract` | 12+ | JSON-RPC parameter flow and PSBT serialization |

### Test Helpers

Shared test utilities in `test/integration/helpers/`:

- **utxoFactory.js**: Encoder, UTXO, and address fixture factories with deterministic TXIDs
- **actionFactory.js**: ACTION payload builders for all supported action types
- **deobfuscate.js**: Payload extraction and AES-128-CTR decryption utilities

## Related

- [Format Selection](format-selection.md): decision guide for choosing an encoding format
- [UTXO Tracker](../utxo-tracker/); the service that supplies UTXOs to the encoder
- [Data Pipeline](../../architecture/data-pipeline.md): full platform ingestion flow
- [Testing](../../developer-guide/testing.md): platform-wide testing philosophy and coverage

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
