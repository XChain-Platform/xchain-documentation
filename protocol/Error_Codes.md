<!--
Copyright © 2025–2026 Dankest, LLC
SPDX-License-Identifier: AGPL-3.0-or-later
Licensed under the GNU Affero GPL v3.0 or later; see LICENSE.md.
A commercial license is available, contact legal@dankest.llc.
-->

# Error Codes

Machine-readable error codes across the XChain Platform HTTP APIs. Stable: codes are append-only; a published code never changes meaning or disappears, so clients (including AI agents) can branch on them safely. Human-readable `error` / `message` text may be reworded at any time; never parse it.

## Explorer REST API

Errors are JSON objects:

```json
{ "error": "human-readable message", "code": "STABLE_CODE" }
```

| Code | HTTP status | Meaning | Retry? |
|---|---|---|---|
| `BAD_REQUEST` | 400 | The request could not be processed (malformed query, unknown lookup) | No: fix the request |
| `MISSING_PARAMETER` | 400 | A required query parameter is absent | No: add the parameter |
| `INVALID_ACTION_INDEX` | 400 | The action index is not a non-negative integer | No |
| `INVALID_BLOCK_INDEX` | 400 | The block index is not a non-negative integer | No |
| `RELAY_INVALID_PROTOCOL` | 400 | `/relay` only accepts http/https URLs | No |
| `RELAY_FETCH_FAILED` | 400 | `/relay` could not fetch the URL | Maybe; the upstream may be transient |
| `PATH_DENIED` | 403 | Path traversal outside the served directory | No |
| `RELAY_DENIED` | 403 | `/relay` refuses private/loopback/metadata destinations (SSRF guard) | No |
| `UNKNOWN_COIN` | 404 | The `{COIN}` prefix is not served by this explorer | No: check `/{COIN}/api/status` |
| `NOT_FOUND` | 404 | No row for that lookup | No |
| `CHECKPOINT_NOT_FOUND` | 404 | No quorum-signed checkpoint at that height | Maybe: checkpoints lag the tip |
| `RATE_LIMITED` | 429 | Per-IP request budget exhausted (default 500/min) | Yes: back off; honor `RateLimit-*` headers |
| `SERVER_ERROR` | 500 | Unexpected internal failure | Yes: with backoff |
| `UPSTREAM_ERROR` | 502 | The colocated indexer fee service failed | Yes: with backoff |
| `COIN_NOT_AVAILABLE` | 503 | Coin supported but not configured for data requests here | No: use another instance |
| `INDEXER_NOT_CONFIGURED` | 503 | Fee quote/schedule needs an indexer API this instance lacks | No: use another instance |
| `SERVICE_UNAVAILABLE` | 503 | The endpoint cannot serve this request | No |

## JSON-RPC services (encoder, hub, SDK API)

JSON-RPC 2.0 error objects:

```json
{ "jsonrpc": "2.0", "id": 1, "error": { "code": -32602, "message": "..." } }
```

| Code | Meaning | Used by | Retry? |
|---|---|---|---|
| `-32700` | Parse error: invalid JSON | all | No |
| `-32600` | Invalid request envelope | all | No |
| `-32601` | Method not found | all | No |
| `-32602` | Invalid params (validation failure) | all | No: fix params |
| `-32603` | Internal error (node RPC failure, encoder failure) | all | Yes: with backoff |
| `-32000` | Server error | all | Yes: with backoff |
| `-32001` | Unauthorized: missing/invalid API key (`x-api-key` for encoder/hub, `Authorization: Bearer` for SDK API) | all | No: fix credentials |
| `-32029` | Too many requests (rate limit) | encoder | Yes: back off |

## Where the specs live

- Explorer OpenAPI: `https://explorer.xchain.io/openapi.json`
- Encoder OpenRPC: `https://encoder.xchain.io/openrpc.json`
- Hub OpenRPC: `https://hub.xchain.io/openrpc.json`
- SDK API OpenRPC: served at `/openrpc.json` by `npm run api` (self-hosted)

The SDK library (as opposed to its API server) throws typed error classes instead (see [components/sdk/ERRORS.md](../components/sdk/ERRORS.md).
