# XChain SDK — Configuration Reference

## Constructor Options

All options are passed as a plain object to the `XChainSDK` constructor. Every field is optional; the SDK will fall back to environment variables and built-in defaults for any field not provided.

```javascript
const sdk = new XChainSDK(options);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `network` | string | `NETWORK` env var | Target blockchain and network. See [Network Strings](#network-strings) for valid values. |
| `explorerUrl` | string | `EXPLORER_URL` env var or `'localhost'` | Hostname or IP of the xchain-explorer API server. |
| `explorerPort` | number | `EXPLORER_PORT` env var or `8080` | Port of the xchain-explorer API server. |
| `encoderUrl` | string | `ENCODER_URL` env var or `'localhost'` | Hostname or IP of the xchain-encoder JSON-RPC server. |
| `encoderPort` | number | `ENCODER_PORT` env var or `3000` | Port of the xchain-encoder JSON-RPC server. |
| `hubUrl` | string | `HUB_API_HOST` env var or `'localhost'` | Hostname or IP of the xchain-hub config oracle. Required for hub discovery. |
| `hubPort` | number | `HUB_PORT` env var or `8001` | Port of the xchain-hub config oracle. |
| `hubPollInterval` | number | `60000` | How often (ms) to re-fetch config from hub after `init()`. |
| `timeout` | number | `30000` | Request timeout in milliseconds applied to all HTTP requests. |
| `retry` | RetryConfig or `false` | See [Retry Configuration](#retry-configuration) | Retry policy for transient errors. Pass `false` to disable retries entirely. |
| `hooks` | SDKHooks object | `{}` | Lifecycle callbacks for requests, responses, errors, and retries. See [Request Hooks](#request-hooks). |
| `pool` | PoolConfig object | See [Connection Pooling](#connection-pooling) | HTTP keep-alive agent settings for the explorer and encoder clients. |

### RetryConfig fields

| Field | Type | Default | Description |
|---|---|---|---|
| `maxRetries` | number | `3` | Maximum number of retry attempts after the initial request fails. |
| `baseDelay` | number | `1000` | Base delay in milliseconds for the first retry. |
| `maxDelay` | number | `30000` | Upper bound on retry delay in milliseconds (after backoff). |
| `backoffFactor` | number | `2` | Multiplier applied to the delay on each successive retry. |

### SDKHooks fields

| Field | Type | Description |
|---|---|---|
| `onRequest` | function | Called before every HTTP request. Signature: `(config) => void` where `config` is the axios request config. |
| `onResponse` | function | Called after every successful HTTP response. Signature: `(response) => void`. |
| `onError` | function | Called when a request fails (after all retries are exhausted). Signature: `(error) => void`. |
| `onRetry` | function | Called before each retry attempt. Signature: `(attempt, delay, error) => void`. |

### PoolConfig fields

| Field | Type | Default | Description |
|---|---|---|---|
| `keepAlive` | boolean | `true` | Enable HTTP keep-alive connections. |
| `keepAliveMsecs` | number | `1000` | Initial delay (ms) between keep-alive packets. |
| `maxSockets` | number | `10` | Maximum concurrent sockets per host. |
| `maxFreeSockets` | number | `5` | Maximum idle sockets to keep open per host. |

## Config Resolution Priority

When the same setting can be specified in multiple places, the SDK resolves it in this order (highest priority first):

1. **Constructor options** — values passed directly to `new XChainSDK(options)`.
2. **Hub-discovered endpoints** — endpoint URLs and ports fetched from xchain-hub during `init()`. Only applies to `explorerUrl`, `explorerPort`, `encoderUrl`, and `encoderPort`.
3. **Environment variables** — values read from process environment or a `.env` file.
4. **Built-in defaults** — hardcoded fallback values within each client class.

Constructor options always win. Hub discovery fills gaps that explicit options did not cover. Environment variables fill gaps that hub discovery did not cover. Built-in defaults are the last resort.

## Environment Variables

The SDK reads these environment variables at construction time. A `.env` file in the working directory is loaded automatically via `dotenv`.

| Variable | Description | Used by |
|---|---|---|
| `NETWORK` | Network string (e.g. `bitcoin-mainnet`). See [Network Strings](#network-strings). | Explorer client, Hub connector |
| `SDK_API_PORT` | Port for the JSON-RPC microservice API server. Default: `3100`. | API server (`npm run api`) |
| `EXPLORER_URL` | Hostname or IP of the xchain-explorer server. | Explorer client |
| `EXPLORER_PORT` | Port of the xchain-explorer server. | Explorer client |
| `ENCODER_URL` | Hostname or IP of the xchain-encoder server. | Encoder client |
| `ENCODER_PORT` | Port of the xchain-encoder server. | Encoder client |
| `HUB_API_HOST` | Hostname or IP of the xchain-hub server. | Hub connector |
| `HUB_PORT` | Port of the xchain-hub server. | Hub connector |

## Hub Discovery

The SDK can auto-discover explorer and encoder endpoints by querying an xchain-hub instance. This is useful in dynamic or multi-chain deployments where service locations may change.

**How it works:**

1. Pass `hubUrl` (and optionally `hubPort`) to the constructor.
2. Call `await sdk.init()` after construction.
3. `init()` calls `getAllConfig()` on the hub via JSON-RPC, retrieves the full platform config, and extracts the explorer and encoder endpoints for your configured `network`.
4. The SDK re-initializes the explorer and encoder clients with the hub-discovered endpoints, respecting any explicit options you already provided (explicit options always take precedence).
5. After the initial fetch, `init()` starts a polling timer (default: every 60 seconds) that re-fetches hub config and re-initializes clients if endpoints change.

**When `init()` is required:** Only when you rely on hub discovery to resolve service endpoints. If you provide explicit `explorerUrl`/`encoderUrl` in the constructor, `init()` is optional.

**Graceful fallback:** If `init()` fails to reach the hub but both `explorerUrl` and `encoderUrl` were already provided explicitly, the SDK logs a warning and continues with the explicit config. If the hub is unavailable and no explicit URLs were provided, `init()` throws an error.

**Stopping polling:** Call `sdk.stop()` to halt hub polling and clean up the timer. This is important in server-mode applications during graceful shutdown.

```javascript
// Hub discovery is safe to call multiple times — each call re-fetches config
await sdk.init();
await sdk.init(); // re-fetches and re-resolves (safe)
```

## Network Strings

The `network` option identifies both the blockchain and the network tier. It determines which coin prefix the explorer client uses when building API paths.

| Network String | Coin Prefix | Blockchain | Network |
|---|---|---|---|
| `bitcoin-mainnet` | `BTC` | Bitcoin | Mainnet |
| `bitcoin-testnet` | `TBTC` | Bitcoin | Testnet |
| `bitcoin-regtest` | `RBTC` | Bitcoin | Regtest |
| `litecoin-mainnet` | `LTC` | Litecoin | Mainnet |
| `litecoin-testnet` | `TLTC` | Litecoin | Testnet |
| `litecoin-regtest` | `RLTC` | Litecoin | Regtest |
| `dogecoin-mainnet` | `DOGE` | Dogecoin | Mainnet |
| `dogecoin-testnet` | `TDOGE` | Dogecoin | Testnet |
| `dogecoin-regtest` | `RDOGE` | Dogecoin | Regtest |

## Retry Configuration

The SDK automatically retries requests that fail due to transient errors. By default, up to 3 retries are attempted with exponential backoff and ±25% random jitter.

**Retryable conditions:**

- HTTP 429 (Too Many Requests)
- HTTP 502 (Bad Gateway)
- HTTP 503 (Service Unavailable)
- HTTP 504 (Gateway Timeout)
- Network errors: `ECONNRESET`, `ECONNREFUSED`, `EPIPE`
- Timeouts: `ECONNABORTED`

**Retry-After header support:** When the server returns a `Retry-After` header (on 429 responses), the SDK parses it — supporting both integer seconds (`120`) and HTTP-date format (`Wed, 21 Oct 2015 07:28:00 GMT`) — and waits exactly that long instead of the computed backoff. The delay is still capped at `maxDelay`.

**Backoff formula:** `delay = baseDelay * backoffFactor^attempt`, capped at `maxDelay`, with ±25% jitter applied.

### Custom retry settings

```javascript
const sdk = new XChainSDK({
    network:     'bitcoin-mainnet',
    explorerUrl: 'localhost',
    retry: {
        maxRetries:    5,
        baseDelay:     500,    // start at 500ms
        maxDelay:      60000,  // cap at 60 seconds
        backoffFactor: 3       // triple each time
    }
});
```

### Disabling retry

Pass `false` to disable all retry logic. Requests will fail immediately on any error.

```javascript
const sdk = new XChainSDK({
    network:     'bitcoin-mainnet',
    explorerUrl: 'localhost',
    retry: false
});
```

### Observing retries via hooks

Use the `onRetry` hook to log retry attempts:

```javascript
const sdk = new XChainSDK({
    network:     'bitcoin-mainnet',
    explorerUrl: 'localhost',
    hooks: {
        onRetry: (attempt, delay, error) => {
            console.warn(`Retry #${attempt} in ${delay}ms after: ${error.message}`);
        }
    }
});
```

## Connection Pooling

The explorer and encoder clients share an HTTP keep-alive agent. Keeping connections open reduces latency for repeated requests to the same host. The default settings suit most applications; tune them for high-throughput workloads.

**Default pool settings:** keepAlive `true`, keepAliveMsecs `1000`, maxSockets `10`, maxFreeSockets `5`.

### High-throughput example

```javascript
const sdk = new XChainSDK({
    network:     'bitcoin-mainnet',
    explorerUrl: 'explorer.example.com',
    pool: {
        keepAlive:      true,
        keepAliveMsecs: 500,
        maxSockets:     50,
        maxFreeSockets: 20
    }
});
```

### Disabling keep-alive

```javascript
const sdk = new XChainSDK({
    network:     'bitcoin-mainnet',
    explorerUrl: 'explorer.example.com',
    pool: {
        keepAlive: false
    }
});
```

## Request Hooks

Hooks are lifecycle callbacks that fire at key points in the request pipeline. They receive read-only context and are intended for logging, metrics, and debugging — not for modifying requests.

| Hook | When it fires | Signature |
|---|---|---|
| `onRequest` | Before every HTTP request is sent | `(config) => void` — `config` is the axios request config object |
| `onResponse` | After every successful HTTP response | `(response) => void` — `response` is the full axios response object |
| `onError` | After all retries fail | `(error) => void` — `error` is the final axios error |
| `onRetry` | Before each retry delay | `(attempt, delay, error) => void` |

### Example: logging all requests and responses

```javascript
const sdk = new XChainSDK({
    network:     'bitcoin-mainnet',
    explorerUrl: 'explorer.example.com',
    hooks: {
        onRequest: (config) => {
            console.log(`[SDK] --> ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
        },
        onResponse: (response) => {
            console.log(`[SDK] <-- ${response.status} ${response.config.url}`);
        },
        onError: (error) => {
            console.error(`[SDK] ERR ${error.message}`);
        },
        onRetry: (attempt, delay, error) => {
            console.warn(`[SDK] Retry #${attempt} in ${delay}ms: ${error.message}`);
        }
    }
});
```

## Code Examples

### Explicit config (no hub)

Provide all service URLs directly. No async initialization needed.

```javascript
const XChainSDK = require('./index.js');

const sdk = new XChainSDK({
    network:      'bitcoin-mainnet',
    explorerUrl:  'explorer.example.com',
    explorerPort: 8080,
    encoderUrl:   'encoder.example.com',
    encoderPort:  3000,
    timeout:      15000
});

// Use immediately — no init() required
const balances = await sdk.getBalances('bc1qmyaddress');
```

### Hub discovery

Let the hub resolve all service endpoints automatically.

```javascript
const XChainSDK = require('./index.js');

const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    hubUrl:  'hub.example.com',
    hubPort: 8001
});

await sdk.init(); // fetches endpoints from hub, starts polling

const balances = await sdk.getBalances('bc1qmyaddress');

// Graceful shutdown
sdk.stop();
```

### Mixed: explicit options + hub fills gaps

Provide some endpoints explicitly; let hub fill in the rest.

```javascript
const XChainSDK = require('./index.js');

const sdk = new XChainSDK({
    network:     'bitcoin-mainnet',
    explorerUrl: 'my-explorer.example.com',  // explicit — hub cannot override this
    hubUrl:      'hub.example.com'           // hub will provide encoder endpoints
});

await sdk.init(); // hub provides encoderUrl/encoderPort; explorerUrl stays as given

const result = await sdk.send(
    { tick: 'MYTOKEN', amount: '10', destination: 'bc1qrecipient' },
    { pubkey: '02abc...', change: 'bc1qchange', utxos: [...] }
);
```

### Custom retry

Aggressive retry for an unreliable network.

```javascript
const XChainSDK = require('./index.js');

const sdk = new XChainSDK({
    network:     'dogecoin-mainnet',
    explorerUrl: 'explorer.example.com',
    timeout:     60000,
    retry: {
        maxRetries:    10,
        baseDelay:     2000,
        maxDelay:      120000,
        backoffFactor: 2
    }
});
```

### Hooks logging

Log all SDK network activity to a file or monitoring system.

```javascript
const XChainSDK = require('./index.js');
const fs = require('fs');

function log(msg) {
    fs.appendFileSync('sdk.log', new Date().toISOString() + ' ' + msg + '\n');
}

const sdk = new XChainSDK({
    network:     'litecoin-mainnet',
    explorerUrl: 'explorer.example.com',
    hooks: {
        onRequest:  (cfg)             => log(`--> ${cfg.method.toUpperCase()} ${cfg.url}`),
        onResponse: (res)             => log(`<-- ${res.status} ${res.config.url}`),
        onError:    (err)             => log(`ERR ${err.message}`),
        onRetry:    (n, delay, err)   => log(`RETRY #${n} in ${delay}ms: ${err.message}`)
    }
});
```

### Environment variable config

Set variables in `.env` and construct the SDK with no options at all.

```bash
# .env
NETWORK=bitcoin-mainnet
EXPLORER_URL=explorer.example.com
EXPLORER_PORT=8080
ENCODER_URL=encoder.example.com
ENCODER_PORT=3000
```

```javascript
const XChainSDK = require('./index.js');

// All config read from .env / process.env
const sdk = new XChainSDK();

const balances = await sdk.getBalances('bc1qmyaddress');
```
