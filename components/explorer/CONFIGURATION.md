<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Explorer: Configuration

## Configuration Sources

The explorer resolves configuration from multiple sources in priority order:

1. **Environment variables**: loaded from `.env` via dotenv
2. **xchain-hub**: fetched via JSON-RPC on startup and refreshed every 60 seconds
3. **Local config.json**: fallback file at `src/config.json`
4. **NODE_CONFIG**: JSON string environment variable (alternative to config.json file)

Hub-sourced configuration takes precedence for database connection details, allowing centralized management across all explorer instances. Environment variables control server-level settings (ports, SSL, debug mode).

## Environment Variables

### Server Settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPLORER_API_PORT_HTTP` | No | `8080` | HTTP server port |
| `EXPLORER_API_PORT_HTTPS` | No | `8081` | HTTPS server port |
| `API_HOST` | No | `127.0.0.1` | Bind address for the API server |
| `DEBUG` | No | None | Enable debug output when set to any truthy value |
| `EXPLORER_FORCE_HTTPS` | No | None | Explicitly enable (`1`) or disable (`0`) the HTTPS-hardening headers (HSTS and `upgrade-insecure-requests`). By default they are active only when `NODE_ENV=production`, so plain-HTTP dev/regtest deploys are not broken. Set to `1` when running behind a TLS-terminating proxy without `NODE_ENV=production`. |
| `EXPLORER_HOLDERS_CACHE_MS` | No | `15000` | TTL (ms) of the per-tick holders-query result cache. `getHolders` requires an unindexable full-table filesort, so results are cached briefly to bound repeated-query cost. |
| `EXPLORER_HOLDERS_CACHE_MAX` | No | `500` | Maximum number of distinct holders-query results kept in the cache. |

### WebSocket

| Variable | Required | Default | Description |
|---|---|---|---|
| `WS_ENABLED` | No | `true` | Enable/disable WebSocket server. The WebSocket server is disabled ONLY when this variable is set to the exact string `false`. Any other value (including `0`, empty string, or unset) leaves it enabled. |
| `WS_POLL_INTERVAL` | No | `5000` | Change detection poll interval in milliseconds |
| `WS_PING_INTERVAL` | No | `30000` | Server-to-client ping interval in milliseconds |
| `WS_IDLE_TIMEOUT` | No | `300000` | Idle timeout for zero-subscription clients (ms) |
| `WS_MAX_CONNECTIONS_PER_IP` | No | `5` | Max concurrent WebSocket connections per IP |
| `WS_MAX_SUBSCRIPTIONS` | No | `25` | Max subscriptions per WebSocket connection |
| `WS_MAX_BACKPRESSURE` | No | `65536` | Max buffered bytes before skipping messages for a slow client |

See [WEBSOCKET.md](WEBSOCKET.md) for the full WebSocket API reference.

### Hub Connection

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_API_HOST` | No | `localhost` | xchain-hub hostname for config discovery (single-instance; ignored when `HUB_VALIDATORS` is set) |
| `HUB_PORT` | No | `10000` | xchain-hub port (single-instance; ignored when `HUB_VALIDATORS` is set) |
| `HUB_VALIDATORS` | No | None | Comma-separated list of hub URLs for high-availability config discovery (e.g. `http://hub1:10000,http://hub2:10000`). When set, takes precedence over `HUB_API_HOST`/`HUB_PORT` and the explorer tries each URL in order, falling back to the next on failure. |
| `UPDATE_CONFIG_INTERVAL` | No | `60000` | Interval in milliseconds between hub config refresh polls |
| `CONFIG_CACHE_FILE` | No | `<appdir>/tmp/config-cache.json` | Path to the on-disk last-known-good hub config cache. The explorer writes here after each successful hub fetch and reads it on startup when the hub is unreachable, so it comes up serving the last known coin set rather than zero coins. Override to a mounted volume path to survive container recreation. |
| `NO_HUB` | No | None | Set to `1` (or `true`/`yes`) to enable standalone mode: the hub is not contacted and all coin/network + database config is read from `src/config.json` (or `NODE_CONFIG`). Use on single-server deployments where the hub publishes docker-internal DB hosts that are not reachable from the explorer process. |

### Hub Mirror and Operational Reads

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_API_URL` | No | None | Hub base URL(s), comma-separated. Used by two features: the self-synced checkpoint mirror (`database.checkpoint.self_sync`) and the JSON-RPC reads that back the validator-capabilities and governance pages. Works in `NO_HUB` mode too, so a standalone node can still point these reads at a hub. |
| `HUB_API_KEY` | No | None | API key for the hub's `/hub-db` mirror feed, when the hub operator has configured one. |
| `EXPLORER_HUB_CACHE_MS` | No | `15000` | How long (ms) validator-capabilities and governance rows fetched from the hub are cached before re-fetching. |
| `EXPLORER_HUB_CACHE_STALE_MAX_MS` | No | `600000` | How long (ms) previously-fetched rows may still be served while the hub is unreachable. Past this, the pages fail rather than serve very old data. |
| `MIRROR_MAX_LAG_S` | No | None | For self-synced mirrors: log a warning when the mirror lags the hub by more than this many seconds. Responses always carry `mirror_lag_seconds` so clients can judge freshness themselves. |
| `MIRROR_LAG_FAIL_CLOSED` | No | None | Set to `1` to return HTTP 503 (`MIRROR_STALE`) instead of only warning when `MIRROR_MAX_LAG_S` is exceeded. |
| `SPV_CHECKPOINT_MAX_LAG_BLOCKS` | No | `100` | Advisory freshness threshold for the SPV proof endpoints: when the serving checkpoint trails the chain tip by more than this many blocks, responses set `stale: true` (alongside `chain_tip` and `lag`). Advisory only; nothing is refused. |
| `ALLOW_NO_COLOCATED_HUB_DB` | No | None | Set to `1` to let the explorer start without a checkpoint schema configured for every serving coin. The checkpoint, cross-chain match, and proof endpoints then fail per request instead. |

### Decoder Health (for `/api/status` chain lag fields)

The explorer polls each coin's decoder health endpoint to populate `chain_tip`, `chain_lag_blocks`, and `decoder_health` in `/api/status`. Configure the URL of each decoder's JSON-RPC API:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DECODER_API_URL_<COIN>_<NETWORK>` | No | None | Decoder JSON-RPC URL for a specific coin+network (e.g. `DECODER_API_URL_BTC_MAINNET=http://localhost:4001`). `COIN` and `NETWORK` are uppercase. |
| `DECODER_API_URL` | No | None | Generic fallback used when no coin/network-specific variable is set |

When no decoder URL is configured for a coin, `decoder_health` is `"unconfigured"` and `chain_tip`/`chain_lag_blocks` are `null` for that coin.

### Indexer API (native-coin fee pre-flight)

The public `/{COIN}/api/feequote` and `/{COIN}/api/feeschedule` endpoints proxy to the colocated
xchain-indexer JSON-RPC API (which is not internet-facing) so the authoritative fee + oracle-price
logic stays single-sourced. Configure the per-coin indexer API URL to enable them; when unset, those
two endpoints return `503` (clients then fall back to paying the protocol fee in XCHAIN).

| Variable | Required | Default | Description |
|---|---|---|---|
| `INDEXER_API_URL_<COIN>_<NETWORK>` | No | None | Indexer JSON-RPC URL for a specific coin+network (e.g. `INDEXER_API_URL_BTC_REGTEST=http://localhost:3001`) |
| `INDEXER_API_URL` | No | None | Generic fallback indexer JSON-RPC URL used when no coin/network-specific var is set |
| `INDEXER_API_TIMEOUT_MS` | No | `5000` | Per-request timeout for the indexer proxy calls |

### SSL/TLS

| Variable | Required | Default | Description |
|---|---|---|---|
| `SSL_DIR` | No | `src/ssl/` | Directory containing SSL certificate files |

SSL certificates are loaded from:
- `{SSL_DIR}/cert.pem`: TLS certificate
- `{SSL_DIR}/private.pem`: TLS private key
- `{SSL_DIR}/ca.pem`: Certificate authority chain

If SSL files are not found, only the HTTP server starts.

## Local Configuration File

The `src/config.json` file provides database connection details when xchain-hub is not available. Structure:

```json
{
    "databases": {
        "BTC": {
            "mainnet": {
                "host": "localhost",
                "port": 3306,
                "user": "xchain_reader",
                "password": "your_password",
                "indexer": "XChain_BTC_Mainnet_Indexer",
                "decoder": "XChain_BTC_Mainnet_Decoder"
            },
            "testnet": { ... },
            "regtest": { ... }
        },
        "LTC": { ... },
        "DOGE": { ... }
    }
}
```

Each coin/network entry specifies both the Indexer database (primary data source) and the Decoder database (for raw transaction lookups).

An example template is provided at `src/config.json.example`.

## Checkpoint Schema (Hub-Mirror Tables)

A few tables the explorer serves (state checkpoints, capability snapshots, cross-chain matches) are produced by the hub federation rather than the indexer, and xchain-sync never replicates them. Every serving coin/network therefore needs a `checkpoint` block in its database config, naming a schema on the same server and credentials as the indexer database:

```json
"checkpoint": {
    "host": "localhost",
    "port": 3306,
    "user": "xchain_reader",
    "pass": "your_password",
    "name": "XChain_Hub_Mirror",
    "self_sync": true
}
```

There are two ways to provision that schema:

- **Self-synced (recommended):** set `"self_sync": true` and configure `HUB_API_URL`. The explorer creates the schema and its tables itself, downloads a snapshot from the hub, and then follows the hub's live feed. No hub database needs to exist on the explorer's server.
- **Externally maintained:** omit `self_sync` and point `name` at a real hub database on the same server (single-server deployments where the hub already runs locally).

Without a checkpoint block for a serving coin, the explorer refuses to start (see `ALLOW_NO_COLOCATED_HUB_DB`).

In self-sync mode the affected endpoints return HTTP 503 with code `MIRROR_NOT_BOOTSTRAPPED` until the first snapshot download completes, and afterwards include `mirror_bootstrapped` and `mirror_lag_seconds` fields so clients can judge freshness. `GET /{COIN}/api/hub-mirror/status` reports the mirror's state. One detail to know: the `batch_root` and `anchor_txid` audit fields on cross-chain matches are filled in by the hub after anchor publication and may show as null on a self-synced mirror; all trade-relevant fields arrive immediately.

## Hub Discovery

When `HUB_API_HOST` and `HUB_PORT` are set, the explorer:

1. Connects to xchain-hub via JSON-RPC (`ping` to verify, then `getallconfigs` to fetch)
2. Receives database connection details for all configured coins and networks
3. Determines which coins are **supported** (defined in config) vs **available** (database reachable)
4. Starts a 60-second sync interval to refresh configuration

If the hub is unreachable, the explorer falls back to `src/config.json` or the `NODE_CONFIG` environment variable.

### Config Change Events

The config module provides an event system for live updates:

```javascript
const config = require('./config.js');
config.onConfigChanged(() => {
    // React to configuration changes (e.g., new coins available)
});
```

## Coin-Specific Configuration

Each supported blockchain has a configuration file in `src/configs/`:

| File | Chain |
|---|---|
| `src/configs/BTC.js` | Bitcoin |
| `src/configs/LTC.js` | Litecoin |
| `src/configs/DOGE.js` | Dogecoin |

These files export a `getConfig(network)` function returning:

```javascript
{
    chain: {
        name: "Bitcoin",
        tick: "BTC",
        site: "https://bitcoin.org"
    },
    address: {
        burn:      "...",   // Token burn address
        gas:       "...",   // XCHAIN gas token issuer
        protocol:  "...",   // Protocol development fund
        community: "...",   // Community development fund
        explorer:  "..."    // Explorer service address
    }
}
```

Addresses vary per network (mainnet, testnet, regtest).

## Supported Coins and Prefixes

The config module builds a mapping of supported coins from the configuration:

| Coin | Mainnet Prefix | Testnet Prefix | Regtest Prefix |
|---|---|---|---|
| Bitcoin | `BTC` | `TBTC` | `RBTC` |
| Litecoin | `LTC` | `TLTC` | `RLTC` |
| Dogecoin | `DOGE` | `TDOGE` | `RDOGE` |

These prefixes form the first segment of all API URLs (e.g., `/BTC/api/token/MYTOKEN`).

## Rate Limiting

The explorer uses `express-rate-limit` middleware:

| Setting | Value |
|---|---|
| Window | 60 seconds |
| Max requests per window | 500 (override via `EXPLORER_RATE_LIMIT_RPM`) |
| Scope | Per IP address |
| Response on limit | HTTP 429 Too Many Requests |

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPLORER_RATE_LIMIT_RPM` | No | `500` | Maximum requests per IP per 60-second window. Image requests (`.png`, `.jpg`, `.jpeg`, `.gif`, `.ico`, `.svg`, `.webp`), `/icon/` paths, and `/images` paths are excluded from the limit. |

Rate limiting applies to all non-image endpoints (API, Explorer, and HTML).

## CORS

Cross-Origin Resource Sharing is configured via the `cors` middleware. Allowed origins can be specified in the configuration. When not explicitly configured, CORS defaults to allowing all origins.

## Security Headers

The explorer uses Helmet middleware to set security headers including:

- Content Security Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options
- Strict-Transport-Security (when HTTPS is active)
- X-XSS-Protection

## Finality / Confirmation Depths

The explorer uses per-chain confirmation depths to determine when a receipt is considered final. These values are surfaced in the `finality` field of the `/api/network` response and mirror the hub's cross-chain thresholds. They can be overridden per chain:

| Variable | Required | Default | Description |
|---|---|---|---|
| `XCHAIN_CONFIRMATIONS_BTC` | No | `6` | Required confirmation depth for Bitcoin |
| `XCHAIN_CONFIRMATIONS_LTC` | No | `12` | Required confirmation depth for Litecoin |
| `XCHAIN_CONFIRMATIONS_DOGE` | No | `60` | Required confirmation depth for Dogecoin |

---

## Database

The explorer reads from MariaDB databases following the naming convention:

```
XChain_{CHAIN}_{NETWORK}_Indexer    (primary: indexed state)
XChain_{CHAIN}_{NETWORK}_Decoder    (secondary: raw transaction data)
```

Connection pooling is managed by the `mariadb` npm package. The explorer maintains separate pool connections for Indexer and Decoder databases.

All queries use parameterized SQL (`?` placeholders) to prevent SQL injection. No ORM is used.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
