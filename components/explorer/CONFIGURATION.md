<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

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

### Hub Connection

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_API_HOST` | No | — | xchain-hub hostname for config discovery |
| `HUB_PORT` | No | — | xchain-hub port |

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

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
