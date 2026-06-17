<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->

# API Reference

The XChain Platform exposes three public HTTP APIs. Together they cover the full
read/write lifecycle: read chain state from the explorer, build and broadcast
transactions with the encoder, and discover configuration or fee quotes from the hub.

| Service | Protocol | Use it to | Reference |
|---|---|---|---|
| **Explorer** | REST (read-only) | Query tokens, balances, actions, markets, dispensers, contracts, prices, and more | [Explorer API](../components/explorer/API.md), [WebSocket API](../components/explorer/WEBSOCKET.md) |
| **Encoder** | JSON-RPC 2.0 | Build unsigned PSBTs that embed ACTION payloads, then broadcast the signed result | [Encoder API](../components/encoder/API.md) |
| **Hub** | JSON-RPC 2.0 | Service discovery, fee quotes, price snapshots, validator and cross-chain coordination | [Hub API](../components/hub/API.md) |

Most application developers only need the **explorer** (to read state) and the
**encoder** (to build transactions). The high-level [xchain-sdk](../components/sdk/) wraps
both of these with typed helpers, so reach for the raw APIs when you need a surface the SDK
does not cover or you are working outside JavaScript.

## Base URLs and networks

The public services are reachable at:

| Service | Public base URL |
|---|---|
| Explorer | `https://explorer.xchain.io/{COIN}/api/` |
| Encoder | `https://encoder.xchain.io/{COIN}/` |
| Hub | `https://hub.xchain.io/{COIN}/` |

Every request is scoped to a chain and network by a `{COIN}` prefix in the path:

| Network | Prefix | | Network | Prefix | | Network | Prefix |
|---|---|---|---|---|---|---|---|
| Bitcoin mainnet | `BTC` | | Litecoin mainnet | `LTC` | | Dogecoin mainnet | `DOGE` |
| Bitcoin testnet | `TBTC` | | Litecoin testnet | `TLTC` | | Dogecoin testnet | `TDOGE` |
| Bitcoin regtest | `RBTC` | | Litecoin regtest | `RLTC` | | Dogecoin regtest | `RDOGE` |

Self-hosted instances bind a single network and are reached directly at
`http://{host}:{port}/`. The regtest prefixes apply to local development stacks (see
[Regtest Development](./Regtest_Development.md)).

## Machine-readable specs

Each service serves its own spec, suitable for code generation, client tooling, or loading
into an LLM:

| Service | Spec format | Endpoint |
|---|---|---|
| Explorer | OpenAPI 3.1 | `GET https://explorer.xchain.io/openapi.json` |
| Encoder | OpenRPC 1.3.2 | `GET https://encoder.xchain.io/{COIN}/openrpc.json` |
| Hub | OpenRPC 1.3.2 | `GET https://hub.xchain.io/{COIN}/openrpc.json` |

Load the OpenAPI document into Swagger UI, Redoc, or an OpenAPI client generator; load the
OpenRPC documents into an OpenRPC playground or generator. An LLM-friendly digest of the full
docs is published at `https://docs.xchain.io/llms.txt`.

## Calling the APIs

The explorer is a plain REST service. URLs follow
`GET /{COIN}/api/{method}/{query}/{type}` and return JSON:

```bash
# Token metadata on Bitcoin mainnet
curl https://explorer.xchain.io/BTC/api/token/MYTOKEN

# Balances for an address
curl https://explorer.xchain.io/BTC/api/balances/bc1qexampleaddress
```

The encoder and hub are JSON-RPC 2.0 services. Send an HTTP POST to the service root with the
standard envelope:

```bash
curl -X POST https://encoder.xchain.io/BTC/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"estimate_fee","id":1}'
```

## Authentication and limits

| Service | Auth | Rate limit |
|---|---|---|
| Explorer | None; all endpoints are read-only | `429` after 500 requests per 60s window |
| Encoder | Optional `x-api-key` (public instances run open) | Per-instance, configurable |
| Hub | `x-api-key` required for write and admin methods; read methods are open | Per-instance, configurable |

JSON-RPC errors follow the 2.0 convention with a numeric `code`: `-32602` invalid params,
`-32603` internal error, `-32001` unauthorized, `-32029` rate limited. The full registry is
documented at [Error Codes](../protocol/Error_Codes.md).

## See also

- [Query the Explorer](./Query_The_Explorer.md): a task-oriented tutorial for the REST and JSON-RPC read APIs
- [Developer Quickstart](../getting-started/Quickstart_Developer.md): end-to-end token issuance and transfer
- [Integration Patterns](./Integration_Patterns.md): recommended patterns for wallets and applications
- [SDK](../components/sdk/): the typed client that wraps the explorer and encoder APIs

---

**Copyright &copy; 2025-2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
