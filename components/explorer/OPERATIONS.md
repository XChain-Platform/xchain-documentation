<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Explorer — Operations

## Prerequisites

- **Node.js** ≥ 18
- **MariaDB** server with an existing Indexer database (populated by xchain-indexer)
- **xchain-hub** (optional) — for centralized config discovery
- **SSL certificates** (optional) — for HTTPS

## Running

### Direct

```bash
cd xchain-explorer
npm install
npm run api
```

Or equivalently:

```bash
node ./src/api.js
```

The explorer starts both HTTP and HTTPS servers (if SSL certificates are available). Server ports are configured via environment variables:

```env
EXPLORER_API_PORT_HTTP=8080
EXPLORER_API_PORT_HTTPS=8443
```

### Docker

The Dockerfile copies the source into `/XChainExplorer/` inside the container:

```dockerfile
FROM node:18-alpine
WORKDIR /XChainExplorer
COPY . .
RUN npm install --production
CMD ["npm", "run", "api"]
```

Environment variables can be passed at runtime:

```bash
docker run -d \
    -p 8080:8080 \
    -p 8443:8443 \
    -e HUB_API_HOST=hub.example.com \
    -e HUB_PORT=1984 \
    -e EXPLORER_API_PORT_HTTP=8080 \
    -e EXPLORER_API_PORT_HTTPS=8443 \
    xchain-explorer
```

### Stopping

The process can be stopped with `SIGTERM` (graceful) or `SIGINT` (Ctrl+C). In Docker, `docker stop` sends `SIGTERM`.

## SSL/TLS Setup

The explorer serves HTTPS when SSL certificate files are present. Place the following files in the SSL directory (default `src/ssl/`, configurable via `SSL_DIR` environment variable):

| File | Description |
|---|---|
| `cert.pem` | TLS certificate |
| `private.pem` | TLS private key |
| `ca.pem` | Certificate authority chain |

If any of these files are missing, the HTTPS server is not started and only HTTP is served.

For production deployments, use certificates from a trusted CA. For development and regtest environments, self-signed certificates work.

## Security Features

### Rate Limiting

The explorer applies rate limiting to all endpoints:

- **Window:** 60 seconds  
- **Max requests:** 500 per window per IP  
- **Response on limit:** HTTP 429 Too Many Requests

Rate limiting is applied via `express-rate-limit` middleware before any route handling.

### Security Headers (Helmet)

The explorer uses Helmet to set security headers on all responses:

- **Content Security Policy (CSP)** — restricts script sources, style sources, and other resource loading
- **X-Content-Type-Options: nosniff** — prevents MIME type sniffing
- **X-Frame-Options** — clickjacking protection
- **Strict-Transport-Security** — enforces HTTPS when available
- **X-XSS-Protection** — legacy XSS filter

### CORS

Cross-Origin Resource Sharing is configured via the `cors` middleware. This allows browser-based applications on different domains to query the explorer API.

### SQL Injection Prevention

All database queries use parameterized SQL with `?` placeholders. User input is never concatenated into SQL strings. The `escapeLike()` utility function additionally escapes LIKE pattern characters (`%`, `_`) when used in search queries. The `sanitizeInt()` function validates integer inputs.

### SSRF Protection (Relay Endpoint)

The `/relay` endpoint proxies external resources for the web UI but includes comprehensive SSRF protections:

- **Protocol validation** — only `http:` and `https:` protocols allowed
- **Private IP blocking** — blocks requests to:
  - `127.0.0.0/8` (loopback)
  - `10.0.0.0/8` (private)
  - `172.16.0.0/12` (private)
  - `192.168.0.0/16` (private)
  - `169.254.0.0/16` (link-local / cloud metadata)
  - `0.0.0.0` (unspecified)
- **Content limits** — 5MB maximum response size
- **Timeout** — 5-second request timeout
- **Content types** — only serves JSON and PNG responses

### Directory Traversal Protection

The `/icon` endpoint validates file paths to prevent directory traversal attacks. Requests containing `..` or attempting to access files outside the icons directory return a 403 error or redirect to the default icon.

## Icon Service

The explorer serves token icons via the `/icon` endpoint:

```
GET /icon/{filename}
```

- Icons are stored in `src/content/icons/`
- If the requested icon file doesn't exist, the response redirects to `default.png`
- Supports PNG format

## Relay Proxy

The relay endpoint provides a CORS proxy for the web UI to fetch external resources:

```
GET /relay?url={encoded_url}
```

This is used by the frontend to load external JSON data and images that would otherwise be blocked by browser CORS policies. The relay includes all SSRF protections described above.

**Supported content types:**
- JSON files — proxied as `application/json`
- PNG images — proxied as `image/png`

## Web UI

The explorer serves a Bootstrap-based web block explorer from the same process as the API. The web UI provides:

- **Home page** — platform overview and recent activity
- **Token pages** — token listing, search, and individual token detail
- **Address pages** — address balances, transaction history, and all associated actions
- **Block pages** — block listing and individual block detail with all actions
- **Market pages** — DEX trading pairs, order books, trade history, and Highcharts price charts
- **Action pages** — individual action detail with full ledger breakdown
- **Transaction pages** — decoded transaction detail with all contained actions
- **Search** — cross-entity search by address, token, transaction hash, or broadcast

The web UI uses jQuery DataTables for paginated data tables, communicating with the Explorer (DataTables) endpoints. Charts use Highcharts for candlestick, market depth, and line visualizations.

### HTML Templates

All HTML templates are located in `src/content/html/`. Key pages:

| Template | URL Pattern | Description |
|---|---|---|
| `home.html` | `/` | Platform home page |
| `coin_home.html` | `/{COIN}` | Chain-specific home page |
| `tokens.html` | `/{COIN}/tokens` | Token listing |
| `token.html` | `/{COIN}/token/{tick}` | Token detail |
| `address.html` | `/{COIN}/address/{addr}` | Address detail |
| `blocks.html` | `/{COIN}/blocks` | Block listing |
| `block.html` | `/{COIN}/block/{index}` | Block detail |
| `transaction.html` | `/{COIN}/transaction/{hash}` | Transaction detail |
| `action.html` | `/{COIN}/action/{index}` | Action detail |
| `markets.html` | `/{COIN}/markets` | Market listing |
| `market.html` | `/{COIN}/market/{pair}` | Market detail with charts |
| `search.html` | `/{COIN}/search` | Search page |
| `api.html` | `/api` | API documentation page |

Action-specific listing pages:

| Template | URL Pattern | Description |
|---|---|---|
| `sends.html` | `/{COIN}/sends` | Token transfer listing |
| `issues.html` | `/{COIN}/issues` | Token creation and update listing |
| `mints.html` | `/{COIN}/mints` | Token minting listing |
| `destroys.html` | `/{COIN}/destroys` | Token burn/destroy listing |
| `orders.html` | `/{COIN}/orders` | DEX order listing |
| `order_matches.html` | `/{COIN}/order_matches` | Filled DEX order listing |
| `dispensers.html` | `/{COIN}/dispensers` | Dispenser listing |
| `dispenses.html` | `/{COIN}/dispenses` | Dispenser purchase listing |
| `dividends.html` | `/{COIN}/dividends` | Dividend distribution listing |
| `airdrops.html` | `/{COIN}/airdrops` | Airdrop distribution listing |
| `broadcasts.html` | `/{COIN}/broadcasts` | On-chain broadcast listing |
| `messages.html` | `/{COIN}/messages` | On-chain message listing |
| `files.html` | `/{COIN}/files` | On-chain file listing |
| `callbacks.html` | `/{COIN}/callbacks` | Token callback listing |
| `sleeps.html` | `/{COIN}/sleeps` | Address/token pause listing |
| `swaps.html` | `/{COIN}/swaps` | Cross-chain swap listing |
| `swap_matches.html` | `/{COIN}/swap_matches` | Filled swap listing |
| `sweeps.html` | `/{COIN}/sweeps` | Asset sweep listing |
| `addresses.html` | `/{COIN}/addresses` | Address preference listing |
| `batches.html` | `/{COIN}/batches` | Multi-action batch listing |
| `links.html` | `/{COIN}/links` | Cross-chain link listing |
| `lists.html` | `/{COIN}/lists` | Address/tick list listing |
| `fees.html` | `/{COIN}/fees` | Gas fee listing |
| `history.html` | `/{COIN}/history` | Unified action history |

Additional static pages:

| Template | URL Pattern | Description |
|---|---|---|
| `about.html` | `/about` | About the platform |
| `privacy.html` | `/privacy` | Privacy policy |
| `terms.html` | `/{COIN}/terms` | Terms of service |
| `mempool.html` | `/{COIN}/mempool` | Pending transactions |
| `404.html` | `/404` | Not found page |
| `coin_unavailable.html` | `/coin-unavailable` | Coin not available page |

## Hub Integration

When configured with a hub URL, the explorer:

1. Sends a `ping` JSON-RPC request to verify hub connectivity
2. Calls `getallconfigs` to fetch all database connection details
3. Builds the list of supported and available coins
4. Starts a 60-second sync interval to refresh configuration

This allows adding new coins or changing database credentials without restarting the explorer.

If the hub becomes unreachable during operation, the explorer continues using the last known good configuration.

## Troubleshooting

### Explorer won't start

**Missing environment variables:** The explorer requires either hub connection details or a local `config.json`. Check that `HUB_API_HOST`/`HUB_PORT` are set, or that `src/config.json` exists with valid database credentials.

**Port already in use:** Another process may be using the configured HTTP or HTTPS port. Check with `lsof -i :{port}` or change the port in `.env`.

### "Explorer not configured" (503)

The coin prefix in the URL is not in the `COIN_SUPPORTED` list. This means the configuration doesn't include database connection details for that coin/network combination. Verify the hub config or local config.json includes the coin.

### "Coin unavailable" page

The coin is configured (supported) but the database is not reachable. Check:
- MariaDB is running and accepting connections
- Database credentials in the config are correct
- The Indexer database exists and has been populated by xchain-indexer
- Network connectivity between the explorer and database server

### Slow queries

- Check MariaDB slow query log for specific bottlenecks
- Verify the Indexer database has all expected indexes (these are created by xchain-indexer)
- Consider the result limit — some endpoints default to returning up to 100 or 500 records

### Rate limiting issues

If legitimate traffic is being rate limited (429 responses), the default limit is 500 requests per 60-second window per IP. For high-traffic deployments, consider running multiple explorer instances behind a load balancer, each with its own rate limit pool.

### SSL certificate errors

- Verify all three certificate files exist in the SSL directory: `cert.pem`, `private.pem`, `ca.pem`
- Check file permissions — the Node.js process needs read access
- Verify the certificate chain is complete and valid
- For development, generate self-signed certificates:

```bash
openssl req -x509 -newkey rsa:4096 -keyout private.pem -out cert.pem -days 365 -nodes
cp cert.pem ca.pem
```

### Database connection issues

- Verify MariaDB is running: `systemctl status mariadb`
- Test connectivity: `mysql -h {host} -P {port} -u {user} -p {database}`
- Check that the database name follows the convention: `XChain_{CHAIN}_{NETWORK}_Indexer`
- The explorer uses connection pooling — transient connection failures should recover automatically

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
