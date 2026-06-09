<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Explorer — Configuration

## Configuration Sources

The explorer resolves configuration from multiple sources in priority order:

1. **Environment variables** — loaded from `.env` via dotenv
2. **xchain-hub** — fetched via JSON-RPC on startup and refreshed every 60 seconds
3. **Local config.json** — fallback file at `src/config.json`
4. **NODE_CONFIG** — JSON string environment variable (alternative to config.json file)

Hub-sourced configuration takes precedence for database connection details, allowing centralized management across all explorer instances. Environment variables control server-level settings (ports, SSL, debug mode).

## Environment Variables

### Server Settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPLORER_API_PORT_HTTP` | No | — | HTTP server port |
| `EXPLORER_API_PORT_HTTPS` | No | — | HTTPS server port |
| `DEBUG` | No | — | Enable debug output when set to any truthy value |

### WebSocket

| Variable | Required | Default | Description |
|---|---|---|---|
| `WS_ENABLED` | No | `true` | Enable/disable WebSocket server |
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
| `HUB_API_HOST` | No | — | xchain-hub hostname for config discovery |
| `HUB_PORT` | No | — | xchain-hub port |

### Indexer API (native-coin fee pre-flight)

The public `/{COIN}/api/feequote` and `/{COIN}/api/feeschedule` endpoints proxy to the colocated
xchain-indexer JSON-RPC API (which is not internet-facing) so the authoritative fee + oracle-price
logic stays single-sourced. Configure the per-coin indexer API URL to enable them; when unset, those
two endpoints return `503` (clients then fall back to paying the protocol fee in XCHAIN).

| Variable | Required | Default | Description |
|---|---|---|---|
| `INDEXER_API_URL_<COIN>_<NETWORK>` | No | — | Indexer JSON-RPC URL for a specific coin+network (e.g. `INDEXER_API_URL_BTC_REGTEST=http://localhost:3001`) |
| `INDEXER_API_URL` | No | — | Generic fallback indexer JSON-RPC URL used when no coin/network-specific var is set |
| `INDEXER_API_TIMEOUT_MS` | No | `5000` | Per-request timeout for the indexer proxy calls |

### SSL/TLS

| Variable | Required | Default | Description |
|---|---|---|---|
| `SSL_DIR` | No | `src/ssl/` | Directory containing SSL certificate files |

SSL certificates are loaded from:
- `{SSL_DIR}/cert.pem` — TLS certificate
- `{SSL_DIR}/private.pem` — TLS private key
- `{SSL_DIR}/ca.pem` — Certificate authority chain

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
| Max requests per window | 500 |
| Scope | Per IP address |
| Response on limit | HTTP 429 Too Many Requests |

Rate limiting applies to all endpoints (API, Explorer, and HTML).

## CORS

Cross-Origin Resource Sharing is configured via the `cors` middleware. Allowed origins can be specified in the configuration. When not explicitly configured, CORS defaults to allowing all origins.

## Security Headers

The explorer uses Helmet middleware to set security headers including:

- Content Security Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options
- Strict-Transport-Security (when HTTPS is active)
- X-XSS-Protection

## Database

The explorer reads from MariaDB databases following the naming convention:

```
XChain_{CHAIN}_{NETWORK}_Indexer    (primary — indexed state)
XChain_{CHAIN}_{NETWORK}_Decoder    (secondary — raw transaction data)
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
