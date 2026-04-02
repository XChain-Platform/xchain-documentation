<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform SDK

## What is xchain-sdk

xchain-sdk is the developer-facing Software Development Kit for the XChain Platform. It lets you generate XChain ACTION commands (SEND, ISSUE, MINT, ORDER, and more), encode them into unsigned Bitcoin, Dogecoin, or Litecoin transactions (as PSBTs), and query live blockchain data — balances, token information, transaction history, market orders — from the XChain Explorer API. The SDK runs both as a Node.js library you import directly into your own code and as a standalone JSON-RPC microservice.

## Features

- Generate all 19 XChain ACTION command strings (SEND, ISSUE, MINT, DESTROY, ORDER, DISPENSER, DIVIDEND, SWEEP, SWAP, CALLBACK, SLEEP, AIRDROP, MESSAGE, LIST, LINK, FILE, BROADCAST, ADDRESS, BATCH)
- Encode actions into unsigned PSBTs via the xchain-encoder service
- Support for all encoding formats: OP_RETURN, P2SH, P2WSH, multisign
- Fluent BatchBuilder for constructing multi-action BATCH transactions
- Full Explorer API client: balances, tokens, transactions, history, markets, orderbook
- Automatic retry with exponential backoff and jitter (respects Retry-After headers)
- Connection pooling via configurable HTTP keep-alive agent
- Hub-based service discovery: auto-resolve explorer and encoder endpoints from xchain-hub
- Live config polling: re-resolve endpoints when hub config changes
- Request/response/error/retry lifecycle hooks for logging and instrumentation
- JSON-RPC microservice mode (server)
- Browser bundle (minified and development builds)
- TypeScript type definitions included (`index.d.ts`)
- Supports Bitcoin, Dogecoin, and Litecoin on mainnet, testnet, and regtest

## Installation

Clone the repository and install dependencies from within the `xchain-sdk` directory:

```bash
git clone https://github.com/XChain-platform/xchain-sdk.git
cd xchain-sdk
npm install
```

## Quick Start

### Library mode — generate an action and query balances

```javascript
const XChainSDK = require('./index.js');

const sdk = new XChainSDK({
    network:     'bitcoin-mainnet',
    explorerUrl: 'explorer.example.com',
    explorerPort: 8080
});

// Build a SEND action string
const result = await sdk.send({
    tick:        'MYTOKEN',
    amount:      '100',
    destination: 'bc1qrecipientaddress'
});
console.log(result.actionString);
// → "SEND|0|MYTOKEN|100|bc1qrecipientaddress"

// Query token balances for an address
const balances = await sdk.getBalances('bc1qmyaddress');
console.log(balances);
```

### Library mode — generate a PSBT via the encoder

```javascript
const XChainSDK = require('./index.js');

const sdk = new XChainSDK({
    network:      'bitcoin-mainnet',
    explorerUrl:  'explorer.example.com',
    explorerPort: 8080,
    encoderUrl:   'encoder.example.com',
    encoderPort:  3000
});

// Build a SEND action and encode it into a PSBT in one call
const result = await sdk.send(
    {
        tick:        'MYTOKEN',
        amount:      '100',
        destination: 'bc1qrecipientaddress'
    },
    {
        pubkey: '02abc123...',       // sender's compressed public key
        change: 'bc1qmyaddress',    // change address
        utxos:  [                   // UTXOs to fund the transaction
            {
                txid:  'aabbcc...',
                vout:  0,
                value: 100000
            }
        ],
        encoding: 'opreturn'        // encoding format (default: opreturn)
    }
);

console.log(result.actionString);   // the raw action string
console.log(result.psbt);          // base64-encoded unsigned PSBT
console.log(result.encoding);      // encoding format used
```

### Library mode — hub discovery

When using xchain-hub for service discovery, call `init()` after construction. The SDK fetches endpoint config from the hub and automatically re-resolves clients if config changes.

```javascript
const XChainSDK = require('./index.js');

const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    hubUrl:  'hub.example.com',
    hubPort: 8001
});

// init() fetches config from hub and starts polling for updates
await sdk.init();

// Explorer and encoder are now configured automatically
const balances = await sdk.getBalances('bc1qmyaddress');
```

### Server mode

Run the SDK as a JSON-RPC microservice:

```bash
npm run api
```

The server listens on `SDK_API_PORT` (default `3100`) and exposes all SDK methods as JSON-RPC 2.0 endpoints over HTTP POST.

## Usage Modes

### Library import (Node.js)

Require the SDK directly in your application. All action and explorer methods are available as async functions on the SDK instance. Suitable for backend services, scripts, and testing.

```javascript
const XChainSDK = require('xchain-sdk');
const sdk = new XChainSDK({ network: 'dogecoin-mainnet', explorerUrl: 'localhost' });
```

### JSON-RPC microservice

Run `npm run api` to start a standalone HTTP server. Other services can call SDK methods via JSON-RPC 2.0 POST requests without importing the library directly. Suitable for polyglot environments or when you want to isolate the SDK as a service.

### Browser bundle

Build a minified browser bundle for use in web applications:

```bash
npm run build       # production bundle → dist/xchain_sdk.min.js
npm run build:dev   # development bundle → dist/xchain_sdk.js
```

Load the bundle in a `<script>` tag; the SDK is exposed as the global `XChainSDK`.

```html
<script src="dist/xchain_sdk.min.js"></script>
<script>
    const sdk = new XChainSDK({ network: 'bitcoin-mainnet', explorerUrl: 'localhost' });
</script>
```

## Documentation Index

| Document | Description |
|---|---|
| [Configuration](CONFIGURATION.md) | Constructor options, environment variables, hub discovery, retry and pooling config |
| [Actions](ACTIONS.md) | All supported ACTION types, parameters, and version formats |
| [Explorer](EXPLORER.md) | Explorer API client methods: balances, tokens, transactions, markets |
| [Encoder](ENCODER.md) | Encoding actions into PSBTs, encoding formats, P2SH two-phase flow |
| [Batch Builder](BATCH.md) | Fluent API for constructing multi-action BATCH transactions |
| [Format Selection](FORMAT_SELECTION.md) | Choosing between OP_RETURN, P2SH, P2WSH, and multisign encoding |
| [Errors](ERRORS.md) | Error types, codes, and handling patterns |
| [Examples](EXAMPLES.md) | Complete worked examples for common use cases |

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the SDK as a JSON-RPC microservice |
| `npm test` | Run the Mocha test suite |
| `npm run build` | Build a production minified browser bundle to `dist/xchain_sdk.min.js` |
| `npm run build:dev` | Build a development (unminified) browser bundle to `dist/xchain_sdk.js` |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `axios` | HTTP client for Explorer, Encoder, and Hub requests |
| `express` | HTTP server for JSON-RPC microservice mode |
| `express-json-rpc-router` | JSON-RPC 2.0 routing for the API server |
| `helmet` | HTTP security headers for the API server |
| `cors` | Cross-origin resource sharing for the API server |
| `mathjs` | Arbitrary-precision big-number arithmetic for token amounts |
| `dotenv` | `.env` file loading for environment-based configuration |

### Development

| Package | Purpose |
|---|---|
| `mocha` | Test runner |
| `chai` | Assertion library |
| `nock` | HTTP request mocking for tests |
| `sinon` | Spies, stubs, and mocks for tests |
| `browserify` | Bundles Node.js code for browser use |
| `babelify` / `@babel/core` / `@babel/preset-env` | Transpiles modern JS for browser compatibility |
| `uglify-js` | Minifies the production browser bundle |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
