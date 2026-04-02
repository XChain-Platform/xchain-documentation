<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Explorer — Architecture

## Position in the Data Pipeline

```
Coin Node (bitcoind / litecoind / dogecoind)
    ↓  JSON-RPC polling
xchain-decoder  →  Decoder DB (MariaDB)
    ↓  SQL reads
xchain-indexer  →  Indexer DB (MariaDB)
    ↓  SQL reads (read-only)
xchain-explorer  →  REST API / JSON-RPC / Web UI
    ↑
xchain-hub  (config discovery, 60s refresh)
```

The explorer sits at the end of the data pipeline. It reads indexed state from the Indexer database (read-only access) and presents it through three interfaces: a REST API, a JSON-RPC 2.0 endpoint, and a web block explorer. It also connects to the Decoder database for raw transaction data lookups. The explorer never writes to any database.

## Internal Components

```
┌──────────────────────────────────────────────────────────────┐
│                         api.js                               │
│               Express + JSON-RPC server                      │
│        HTTP + HTTPS listeners, Helmet, CORS, rate limit      │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    XChainExplorer                            │
│                 Main orchestrator class                      │
│           URL routing, request processing,                   │
│           response formatting, icon/relay handlers           │
├──────────────┬──────────────┬────────────────────────────────┤
│              │              │                                │
│  ┌───────────▼──┐  ┌───────▼────────┐  ┌───────────────────┐ │
│  │   Database   │  │    Config      │  │  Hub Connector    │ │
│  │ ~5,800 LOC   │  │  Local + Hub   │  │  JSON-RPC client  │ │
│  │ 50+ queries  │  │  60s auto-sync │  │  ping + getAll    │ │
│  │ Parameterized│  │  Coin configs  │  │  axios-based      │ │
│  └──────┬───────┘  └───────┬────────┘  └───────────────────┘ │
│         │                  │                                 │
│  ┌──────▼───────┐  ┌───────▼────────┐                        │
│  │   Utility    │  │  Coin Configs  │                        │
│  │  BigNumber   │  │  BTC.js        │                        │
│  │  Timers      │  │  LTC.js        │                        │
│  │  Sanitization│  │  DOGE.js       │                        │
│  └──────────────┘  └────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

## Source Files

| File | Class / Module | Role |
|---|---|---|
| `src/api.js` | — | Entry point: Express server, SSL, Helmet, CORS, rate limiting, JSON-RPC router |
| `src/XChainExplorer.js` | `XChainExplorer` | Main orchestrator: URL routing (130+ routes), request processing, response formatting, icon/relay handlers |
| `src/db.js` | `Database` | All SQL queries (~5,800 lines), connection pool management, pagination, caching |
| `src/config.js` | — | Configuration loading from hub or local config.json, 60-second auto-sync, coin/network discovery |
| `src/utility.js` | `Utility` | BigNumber math, timer functions, sanitization (escapeLike, sanitizeInt), type checking |
| `src/XChainHubConnector.js` | `XChainHubConnector` | JSON-RPC client for xchain-hub (ping, getAllConfig) |
| `src/configs/BTC.js` | — | Bitcoin-specific: chain info, network addresses (burn, gas, protocol, community) |
| `src/configs/LTC.js` | — | Litecoin-specific configuration |
| `src/configs/DOGE.js` | — | Dogecoin-specific configuration |
| `src/config.json` | — | Local database connection configuration (fallback when hub is unavailable) |

### Static Content (`src/content/`)

| Directory | Contents |
|---|---|
| `content/html/` | 40+ HTML template files for the web block explorer |
| `content/css/` | Bootstrap, Highcharts, DataTables, and custom stylesheets |
| `content/js/` | jQuery, Bootstrap JS, Highcharts, DataTables, QR code, custom scripts |
| `content/charts/` | Chart template files (candlestick, market-depth, line) |
| `content/images/` | 50+ PNG/ICO images for the web UI |
| `content/icons/` | Token icon files (served via the `/icon` endpoint) |
| `content/json/` | JSON data files |
| `content/fonts/` | Web fonts |

## Request Processing Pipeline

Every incoming request follows this sequence:

### 1. Middleware Stack

```
Request → Rate Limiter → Helmet → CORS → Express Router
```

- **Rate limiter**: 500 requests per 60-second window per IP (configurable)
- **Helmet**: Sets security headers including Content Security Policy
- **CORS**: Validates origin against configured allowed origins

### 2. Route Matching

The `XChainExplorer.setupUrls()` method defines three categories of routes:

| Category | URL Pattern | Response Format |
|---|---|---|
| **HTML** | `/{COIN}/tokens`, `/{COIN}/address/{QUERY}`, etc. | HTML template file |
| **API** | `/{COIN}/api/{method}/{query}/{type}` | JSON object |
| **Explorer** | `/{COIN}/explorer/{method}/{query}/{type}` | DataTables JSON |

Special routes handled separately:
- `/icon/*` — Token icon files with fallback
- `/relay?url=` — CORS proxy for external resources

### 3. Request Processing (`processRequest`)

1. **Load config** — Fetch current configuration (hub-sourced or local)
2. **Parse URL** — Extract coin prefix, route type (html/api/explorer), method, query, and type from the path
3. **Validate coin** — Check coin is in `COIN_SUPPORTED`; if not, return 503. Check coin is in `COIN_AVAILABLE`; if not, redirect to coin-unavailable page
4. **Match route** — Find the matching URL pattern in the route table
5. **Build config object** — Populate method, search query, type, pagination parameters, and offset data
6. **Execute query** — Call the corresponding database method (e.g., `db.getSends(config)`)
7. **Format response** — Apply `getPagingDataResults()` to format data for the response type

### 4. Response Formatting

**API responses** return full JSON objects with alphabetically-sorted keys:

```json
{
    "data": [ { "tick": "TOKEN", "amount": "100", ... }, ... ],
    "total": 42,
    "runtime": "15ms"
}
```

**Explorer responses** return DataTables-compatible arrays for the web UI:

```json
{
    "recordsTotal": 42,
    "recordsFiltered": 42,
    "data": [
        [1, "field1|field2|field3", 100],
        ...
    ],
    "runtime": "12ms"
}
```

Explorer data uses pipe-delimited strings for compact transmission to the frontend DataTables library.

### 5. Pagination

Two pagination modes are supported:

**API pagination** (SQL OFFSET/LIMIT):
- `page` — Page number (1-based)
- `limit` — Results per page (capped per method; default max 100, getBalances/getHolders max 500)
- `sortorder` — `ASC` or `DESC`
- `start` — Row offset (alternative to page)
- `length` — Row count (alternative to limit)

**Explorer pagination** (cursor-based):
- `action` — Paging direction: `first`, `last`, `next`, `prev`
- `offset` — Current cursor position (action_index or block_index)
- `length` — Records per page

## Database Layer

The `Database` class (`src/db.js`, ~5,800 lines) is the largest component. Key patterns:

### Query Building

All data methods follow a consistent pattern:

1. **Method dispatch** — `getData(config)` calls `getQuery(config)` which dispatches to the appropriate `get*` method
2. **WHERE clause** — `getQueryWhereSql(config)` builds parameterized WHERE conditions based on method and search type
3. **Offset handling** — `getQueryOffsetSql(config)` adds cursor-based pagination for Explorer queries
4. **Execution** — Queries execute against the connection pool and return `[data, args, count]`

### Caching

- **Address ID cache** — LRU cache for `index_addresses` lookups (avoids repeated joins)
- **Tick ID cache** — LRU cache for `index_tickers` lookups
- **Action data cache** — LRU cache for immutable action records (action data never changes once written)

### Connection Management

- Connection pooling via the `mariadb` npm package
- Automatic reconnection on connection loss
- Separate connections for Indexer and Decoder databases

## Coin Prefix Mapping

The explorer uses coin prefixes to route requests to the correct database:

| Network | Prefix | Database |
|---|---|---|
| Bitcoin mainnet | `BTC` | `XChain_BTC_Mainnet_Indexer` |
| Bitcoin testnet | `TBTC` | `XChain_BTC_Testnet_Indexer` |
| Bitcoin regtest | `RBTC` | `XChain_BTC_Regtest_Indexer` |
| Litecoin mainnet | `LTC` | `XChain_LTC_Mainnet_Indexer` |
| Litecoin testnet | `TLTC` | `XChain_LTC_Testnet_Indexer` |
| Litecoin regtest | `RLTC` | `XChain_LTC_Regtest_Indexer` |
| Dogecoin mainnet | `DOGE` | `XChain_DOGE_Mainnet_Indexer` |
| Dogecoin testnet | `TDOGE` | `XChain_DOGE_Testnet_Indexer` |
| Dogecoin regtest | `RDOGE` | `XChain_DOGE_Regtest_Indexer` |

A single explorer instance can serve multiple coins and networks simultaneously, routing each request to the appropriate database based on the coin prefix in the URL path.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
