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
| `EXPLORER_TOTALS_CACHE_MS` | No | `60000` | TTL (ms) of the platform-totals query cache. |
| `MEMPOOL_COUNT_CACHE_MS` | No | `15000` | TTL (ms) of the mempool-count cache. |
| `PRICE_CACHE_MS` | No | `60000` | TTL (ms) of the oracle-price cache. |
| `FEE_CACHE_MS` | No | `60000` | TTL (ms) of the fee-schedule cache. |
| `EXPLORER_WALLET_URL` | No | `https://wallet.xchain.io` | Wallet handoff target for the contract page's Write Contract card. Set it to an **empty string** to disable the card entirely; the default applies only when the variable is unset, never when it is set to `''`. |
| `ENCODER_URL` | No | None | Encoder base URL used for the UI's fee estimate. Unset returns a conservative `{low:1, medium:2, high:3}` fallback rather than an error. |
| `UTXO_TRACKER_URL_<COIN>` | No | None | Per-coin UTXO-tracker base URL, used to fill the address page's balance and UTXO panel from the tracker's `GET /info/<address>`. `COIN` is the route code (`BTC`, `TBTC`, `RDOGE`, …). |
| `UTXO_TRACKER_URL` | No | None | Fallback tracker base URL when no coin-specific variable is set. With neither configured the address page shows an honest "Unavailable" rather than fabricated zeroes. |
| `HUB_URL` | No | None | Hub base URL used to fetch the coin's USD price for the UI. Unset leaves the `$0.00` placeholder, which is also what testnet and regtest route codes get, since the oracle only prices mainnet assets. |
| `EXPLORER_TIP_MAX_AGE_S` | No | `21600` | Age (seconds) past which a coin's newest indexed block counts as stale. A stale coin is reported `stale: true` by `/{COIN}/api/status` and dropped from that response's `available` map, so consumers stop treating this instance as current for it. The gate fails closed: a missing or unreadable `block_time` also reads stale. Set to `0` to disable the gate for every coin. |
| `EXPLORER_TIP_MAX_AGE_S_<COIN>` | No | value of `EXPLORER_TIP_MAX_AGE_S` | Per-coin override of the tip-age threshold, where `COIN` is the route code (`BTC`, `TBTC`, `RDOGE`, …). Use it where one chain's block interval makes the shared default wrong. Set to `0` to disable the gate for that coin only. |
| `EXPLORER_TIP_MAX_FUTURE_SKEW_S` | No | `7200` | How far *ahead* of this host's clock a coin's newest indexed block may be dated before it counts as stale. A future-dated tip has a negative raw age, so without this bound it would clear the age gate by a margin that grows with the skew and a frozen chain could hide behind it indefinitely. The default matches the BTC-family consensus limit on future block times. Set to `0` to disable the check for every coin. |
| `EXPLORER_TIP_MAX_FUTURE_SKEW_S_<COIN>` | No | value of `EXPLORER_TIP_MAX_FUTURE_SKEW_S` | Per-coin override of the future-skew tolerance, where `COIN` is the route code. Useful for testnets, whose relaxed timestamp rules let blocks land further ahead of real time than mainnet allows. Set to `0` to disable the check for that coin only. |

**Dev and regtest instances need the tip-age gate turned off.** Regtest blocks are mined on demand, so an idle dev chain crosses the 6 hour default and the explorer starts refusing reads for it with `503 COIN_DATA_STALE`, dropping it from the `available` map of `/{COIN}/api/status`. Set `EXPLORER_TIP_MAX_AGE_S_<COIN>=0` for the regtest coin (`EXPLORER_TIP_MAX_AGE_S_RBTC=0`, `_RLTC`, `_RDOGE`), or `EXPLORER_TIP_MAX_AGE_S=0` to disable it for every coin the instance serves. There is no built-in regtest exemption, and deliberately so: the gate fails closed, and a rule keyed on a network name would let any instance claiming that name re-open the hole with no operator signal. The step-by-step version is in [Regtest Development](../../developer-guide/regtest-development.md#keeping-an-idle-chain-available).

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

See [WEBSOCKET.md](websocket.md) for the full WebSocket API reference.

### Hub Connection

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_API_HOST` | No | `localhost` | xchain-hub hostname for config discovery (single-instance; ignored when `HUB_VALIDATORS` is set) |
| `HUB_PORT` | No | `10000` | xchain-hub port (single-instance; ignored when `HUB_VALIDATORS` is set) |
| `HUB_VALIDATORS` | No | None | Comma-separated list of hub URLs for high-availability config discovery (e.g. `http://hub1:10000,http://hub2:10000`). When set, takes precedence over `HUB_API_HOST`/`HUB_PORT` and the explorer tries each URL in order, falling back to the next on failure. |
| `EXPLORER_MAX_CONCURRENT_REQUESTS` | No | `200` | Concurrency cap for API requests. Past the cap a request is refused immediately with `429` and `Retry-After: 1` rather than queued, so a burst degrades into fast rejections instead of a growing backlog. Static assets are exempt. Set to `0` to disable the cap |
| `UPDATE_CONFIG_INTERVAL` | No | `60000` | Interval in milliseconds between hub config refresh polls |
| `HUB_RETRY_ATTEMPTS` | No | `4` | Attempts per hub config fetch, with exponential backoff. After a power cycle the hub and its MariaDB can take several seconds to come up; a single-pass fetch loses that race and leaves the explorer with no config. `ping()` opts out so liveness checks stay fast. |
| `HUB_RETRY_DELAY_MS` | No | `2000` | Base backoff between hub config retry attempts. Tests set `0`. |
| `HUB_DB_SYNC_POLL_INTERVAL` | No | `30000` | Interval in milliseconds between hub-mirror table sync polls. |
| `HUB_SYNC_WATERMARK_INTERVAL_MS` | No | `10000` | Interval in milliseconds at which the hub-mirror sync persists its progress watermark. |
| `MIRROR_DB_PASS` | No | None | Password for the hub-mirror schema migration tool, read only by `bin/migrate-hub-mirror.js` and never by the running explorer. Passed in the environment specifically so it stays off the command line: `MIRROR_DB_PASS=… node bin/migrate-hub-mirror.js --host … --user … --schema …`. Treat as a credential. |
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

The explorer polls each coin's decoder health endpoint to populate `chain_tip`, `chain_lag_blocks`, and `decoder_health` in `/api/status`. This is the only place the chain-to-decoder gap is visible: the explorer reads databases only, so a decoder stalled behind its coin node still reports `decoder_lag_blocks: 0` once the indexer catches up to it.

The endpoint is resolved per coin+network, in this order:

1. `DECODER_API_URL_<COIN>_<NETWORK>` (explicit operator override)
2. The decoder endpoint in the explorer's own configuration (below)
3. `DECODER_API_URL` (generic fallback)

Step 2 outranks the generic variable on purpose: `DECODER_API_URL` names one decoder and is applied to every coin, so on a multi-chain deployment it is correct for at most one of them.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DECODER_API_URL_<COIN>_<NETWORK>` | No | None | Decoder JSON-RPC URL for a specific coin+network (e.g. `DECODER_API_URL_BTC_MAINNET=http://localhost:4001`). `COIN` and `NETWORK` are uppercase. |
| `DECODER_API_URL` | No | None | Generic fallback used when no coin/network-specific variable is set and the configuration carries no endpoint for the coin |

**Endpoint from the configuration (step 2).** On a hub-driven deployment nothing needs to be set: xchain-node's config push already sends each decoder's API host and port (`host` / `port` on the `xchain-decoder` module entry, alongside `db_host` / `db_port` for its database), and the explorer uses that pair directly.

On a `config.json` deployment there is no such pair, because there `host` and `port` are the decoder **database** and the explorer will not poll a database with JSON-RPC. Name the API endpoint explicitly on the same `decoder` entry instead, with either form:

```json
"decoder": {
    "host": "127.0.0.1", "port": "3306",
    "name": "XChain_BTC_Mainnet_Decoder", "user": "xchain", "pass": "",
    "api_host": "10.0.0.7", "api_port": "3002"
}
```

`api_url` (a full URL, e.g. `"api_url": "http://10.0.0.7:3002"`) is accepted in place of the host/port pair and takes precedence over it. A host written without a scheme is reached over `http`.

When no endpoint resolves for a coin, `decoder_health` is `"unconfigured"` and `chain_tip`/`chain_lag_blocks` are `null` for that coin. A coin whose endpoint is configured but unresponsive reports `"unreachable"` instead, so a missing endpoint and a broken one are distinguishable.

### Indexer API (native-coin fee pre-flight)

The public `/{COIN}/api/feequote` and `/{COIN}/api/feeschedule` endpoints proxy to the colocated
xchain-indexer JSON-RPC API (which is not internet-facing) so the authoritative fee + oracle-price
logic stays single-sourced. Configure the per-coin indexer API URL to enable them; when unset, those
two endpoints return `503` (clients then fall back to paying the protocol fee in XCHAIN).

| Variable | Required | Default | Description |
|---|---|---|---|
| `INDEXER_API_URL_<COIN>_<NETWORK>` | No | None | Indexer JSON-RPC URL for a specific coin+network (e.g. `INDEXER_API_URL_BTC_REGTEST=http://localhost:3004`) |
| `INDEXER_API_URL` | No | None | Generic fallback indexer JSON-RPC URL used when no coin/network-specific var is set |
| `INDEXER_API_TIMEOUT_MS` | No | `5000` | Per-request timeout for the indexer proxy calls |
| `EXPLORER_FEEQUOTE_BUSY_RETRY_MS` | No | `6000` | Wall-clock budget for re-asking `/{COIN}/api/feequote` while the indexer answers `busy: true, retryable: true` (it is processing a block). This hop absorbs the overlap because the wallet reads the endpoint on every fee-bearing compose and has no retry of its own. Only a retryable busy answer is re-asked; a verdict never is. |
| `EXPLORER_INDEXER_API_KEY` | No | None | API key presented to the indexer's fail-closed federation-read gate. When the peer indexer sets `INDEXER_API_KEY`, gated methods such as `getstakeweightsbycapability` return `401` without this, which is what a hardened indexer needs in order to still serve the explorer's validator-set proof. |
| `DECODER_API_TIMEOUT_MS` | No | `2500` | Per-request timeout for decoder health calls. Tighter than the indexer timeout on purpose: health aggregation runs on the `/api/status` hot path, so a stalled decoder must not hold the whole status response. |

### Contract simulation (Read Contract card)

The explorer can run a read-only contract call in the VM to power the contract page's Read Contract card. It is **off by default**: the endpoint exists only when explicitly enabled.

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPLORER_VM_QUERY_ENABLED` | No | `false` | Set to `true` to enable `POST /{COIN}/api/contract/{idx}/call` and advertise the Read Contract card. Any other value leaves the route disabled. |
| `EXPLORER_VM_QUERY_RATE_LIMIT_RPM` | No | `20` | Simulation requests per minute per IP |
| `EXPLORER_VM_MAX_CONCURRENT` | No | `4` | Global ceiling on concurrent simulations |
| `EXPLORER_VM_MAX_CONCURRENT_PER_IP` | No | half the global pool, minimum 1 | Per-IP share of the simulation slot pool, so a small set of clients cannot monopolize every slot |
| `EXPLORER_VM_MAX_STATE_BYTES` | No | `4194304` (4 MiB) | Byte cap on the initial contract-state load. The VM's own limits bound only *new* state writes, so without this cap a caller can aim simulations at a contract with huge accumulated state and burn SQL, `JSON.parse`, and IPC on every call. |

#### Enabling it requires a canonical vendored VM

Setting `EXPLORER_VM_QUERY_ENABLED=true` is not sufficient on its own. Before it serves a simulation the explorer checks the vendored `xchain-vm` it loaded, and refuses when that VM is not the consensus epoch this explorer expects or is missing the contract-era gate exports. A refusing endpoint answers `503` with code `VM_QUERY_VM_DRIFT` and names the reason, and the same reason is logged once at boot whenever the flag is on.

The check exists because a deployed explorer's bundled VM can go stale silently: the vendored copy is staged by the rollout, not by the git checkout, and its version string moves by a patch while its bytes move by a hundred kilobytes. Simulating in a stale VM would answer contract calls with results the indexers do not agree with, on the same service that serves contract-state proofs, so the endpoint fails closed instead.

The in-process check is coarser than a byte comparison, because a running process has no canonical copy to compare against. The full comparison is `bin/check-explorer-vm-drift.sh <host>` in the platform checkout: read-only over SSH, it hashes the deployed VM tree against canonical and reads the flag out of the running process. Run it before enabling the flag on a public explorer, and enable only once it reports `OK`.

### SSL/TLS

| Variable | Required | Default | Description |
|---|---|---|---|
| `SSL_DIR` | No | `src/ssl/` | Directory containing SSL certificate files |

SSL certificates are loaded from:
- `{SSL_DIR}/cert.pem`: TLS certificate
- `{SSL_DIR}/private.pem`: TLS private key
- `{SSL_DIR}/ca.pem`: Certificate authority chain

If SSL files are not found, only the HTTP server starts.

### Font Awesome kit

The web UI loads its generic glyphs from a Font Awesome kit. The kit token is an
account credential and the `pro` license flag is an entitlement claim, so both
are supplied per deployment instead of being shipped in the source tree. The
explorer assembles `/js/fontawesome-kit.js` at request time from the vendored
kit loader plus these values.

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPLORER_FONTAWESOME_KIT_TOKEN` | No | None | Kit token. Unset means no kit is loaded. |
| `EXPLORER_FONTAWESOME_KIT_ID` | No | None | Numeric kit id. |
| `EXPLORER_FONTAWESOME_KIT_LICENSE` | No | `free` | Entitlement this deployment holds: `free` or `pro`. |
| `EXPLORER_FONTAWESOME_KIT_VERSION` | No | `6.4.0` | Font Awesome version the kit serves. |
| `EXPLORER_FONTAWESOME_KIT_CUSTOM_ICONS_PATH` | No | None | Path of the kit's uploaded-icons stylesheet, if it has one. |

With no token set, `/js/fontawesome-kit.js` returns an inert stub and the
explorer makes no requests to `fontawesome.com`. The UI still renders: the
coin/network glyphs in the navigation bar are local images served from the
explorer itself, so only the generic Font Awesome glyphs are absent.

A value that does not match its expected shape (a non-numeric kit id, a
license other than `free`/`pro`) is ignored with a warning rather than passed
through to the browser.

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

In self-sync mode the affected endpoints return HTTP 503 with code `MIRROR_NOT_BOOTSTRAPPED` until the first snapshot download completes, and afterwards include `mirror_bootstrapped` and `mirror_lag_seconds` fields so clients can judge freshness. `GET /{COIN}/api/hub-mirror/status` reports the mirror's state. One detail to know: the `anchor_txid` audit field on cross-chain matches is filled in by the hub after anchor publication; the hub re-broadcasts the stamped row on the mirror feed, so a self-synced mirror picks it up shortly after the anchor lands (a mirror that was offline at that moment catches up on its next bootstrap). The legacy `batch_root` field only exists on rows stamped by a retired publisher and arrives with the snapshot. All trade-relevant fields arrive immediately.

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
| `EXPLORER_ACTION_PROOF_RATE_LIMIT_RPM` | No | `60` | Separate, tighter limit for `/{COIN}/api/proof/action/{idx}` |
| `EXPLORER_VALIDATOR_SET_PROOF_RATE_LIMIT_RPM` | No | `30` | Separate, tighter limit for `/BTC/api/proof/validator-set` |
| `EXPLORER_PREFLIGHT_POST_RATE_LIMIT_RPM` | No | `60` | Separate limit for `POST /{COIN}/api/preflight`, the only unauthenticated route that accepts a large body. The limiter runs before the body parser, so a limited caller is refused without the server reading the payload. |
| `EXPLORER_FEE_QUOTE_RATE_LIMIT_RPM` | No | `120` | Separate limit for the fee lookups `/{COIN}/api/feequote`, `/{COIN}/api/oraclefeequote` and `/{COIN}/api/feeschedule`. One tier looser than the proof routes because a quote is a lookup rather than a cryptographic recompute. |
| `EXPLORER_CHECKPOINT_LIST_RATE_LIMIT_RPM` | No | `120` | Separate limit for `/{COIN}/api/checkpoints`, which lists stored checkpoints. |
| `EXPLORER_CHECKPOINT_VERIFY_RATE_LIMIT_RPM` | No | `60` | Separate, tighter limit for `/{COIN}/api/checkpoint/{blockIndex}/verify`, which recomputes a checkpoint rather than reading one. |
| `WS_TRUST_PROXY_HOPS` | No | `1` | Proxy hop count used to resolve the real client address for the WebSocket per-IP cap. The upgrade is handled on the raw HTTP server, where Express's `trust proxy` does not apply, so the hop count must be passed explicitly or the cap keys on a spoofable `X-Forwarded-For`. Keep it aligned with the HTTP side. |

Rate limiting applies to all non-image endpoints (API, Explorer, and HTML).

## CORS

Cross-Origin Resource Sharing is configured via the `cors` middleware. The explorer serves a public read API, so with nothing configured every origin is allowed: cross-origin `GET` requests are the normal case for documentation examples, wallets and third-party dashboards. A deployment that needs to fence the API sets an allowlist instead.

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPLORER_CORS_ORIGIN` | No | None (all origins allowed) | Comma-separated allowlist of exact origins permitted to make cross-origin requests, for example `https://xchain.io,https://wallet.xchain.io`. Each entry is matched in full, including scheme and port, so `https://xchain.io` does not admit `https://xchain.io.example.com`. When unset (or set to `*`) every origin is allowed. Requests carrying no `Origin` header, such as `curl` or same-origin page loads, are always allowed. |

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
