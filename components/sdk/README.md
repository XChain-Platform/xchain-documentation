<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK

## What is xchain-sdk

xchain-sdk is the developer-facing Software Development Kit for the XChain Platform. It lets you generate XChain ACTION commands (SEND, ISSUE, MINT, ORDER, and more), encode them into unsigned Bitcoin, Dogecoin, or Litecoin transactions (as PSBTs), and query live blockchain data (balances, token information, transaction history, market orders) from the XChain Explorer API. The SDK runs both as a Node.js library you import directly into your own code and as a standalone JSON-RPC microservice.

## Features

- Generate all 31 XChain ACTION command strings (SEND, ISSUE, MINT, DESTROY, ORDER, DISPENSER, DIVIDEND, SWEEP, SWAP, CALLBACK, SLEEP, AIRDROP, MESSAGE, LIST, LINK, FILE, BROADCAST, ADDRESS, BATCH, DEPLOY, EXECUTE, DEPOSIT, WITHDRAW, COINPAY, STAKE, UNSTAKE, DELEGATE, COLLECT, PRICE, VOTE, BET)
- **Transaction Lifecycle Manager** (`submitAction`): full encode → sign → broadcast → wait pipeline in a single call, with automatic P2SH two-phase handling and progress callbacks
- **Wallet Sessions** (`sdk.session(wif)`): bound wallet object that bundles address/key/UTXO state with action convenience methods: "I am this address, do things"
- **Fee Estimation** (`estimateFees`): dry-run fee calculation via encoder, returns fee in satoshis plus reusable PSBT
- **UTXO-aware transaction chaining**: in-memory UTXO cache with speculative change outputs prevents double-spend on rapid sequential transactions
- **Workflow Recipes**: multi-step helpers: `issueAndDistribute`, `issueAndMint`, `stakeAndDelegate`, `deployAndFund`, `createDispenser`, `createOrder`, `cancelOrder`, `distributeDividend`
- **Policy-bounded Agent Sessions** (`sdk.agentSession(wif, policy)`): wrap a WIF key in a declarative spending policy, action allowlist, per-action and per-window amount caps, destination allowlist, confirmation hook, enforced at the submit chokepoint; fail-closed; window usage persisted across restarts; `SDKX402Error` and `SDKPolicyError` thrown on violations
- **Cross-Chain Helper**: coordinate actions across BTC, LTC, DOGE SDK instances: `createSwap`, `link`, `parallel`, `waitForAll`, `getAllBalances`
- **Light client (SPV)** (`sdk.light`): verify a balance or action against a quorum-signed checkpoint's committed roots without trusting the server, pinned launch trust roots, automatic validator-rotation following, DOGE-anchor cold start
- **Event-driven confirmation** (`waitForAction`): WebSocket + polling hybrid that resolves when the indexer processes a transaction
- **Interactive REPL** (`npm run repl`): live session with pre-configured SDK, custom `.actions`, `.status`, `.fields` commands
- **Staking actions**: capability staking (STAKE v1/v2, UNSTAKE v0, DELEGATE v0/v2, COLLECT) is BTC-only for the platform validator set; contract staking (STAKE v3, UNSTAKE v1, DELEGATE v1/v3) works on any chain as a developer primitive
- Smart contract support: deploy contracts, execute methods, deposit/withdraw tokens via the xchain-vm integration
- Contract authoring utilities: syntax validation, float detection, base64 encoding, gas estimation
- Bound ContractClient for repeated interactions with a specific deployed contract
- Encode actions into unsigned PSBTs via the xchain-encoder service
- Support for all encoding formats: OP_RETURN, P2SH, P2WSH, MULTISIGN, TAPROOT, plus AUTO for smallest-footprint selection
- Fluent BatchBuilder for constructing multi-action BATCH transactions
- Full Explorer API client: balances, tokens, transactions, history, markets, orderbook, contracts
- Automatic retry with exponential backoff and jitter (respects Retry-After headers)
- Connection pooling via configurable HTTP keep-alive agent
- Hub-based service discovery: auto-resolve explorer and encoder endpoints from xchain-hub
- Live config polling: re-resolve endpoints when hub config changes
- Real-time event streaming via WebSocket: subscribe to blocks, addresses, tokens, markets, dispensers with type/status filters, catch-up on reconnect, snapshot-on-subscribe
- Convenience methods for common real-time patterns: `onBlock()`, `onAddress()`, `onCoinpayRequired()`, `onOrderMatch()`, `onToken()`, `onMarket()`, `onDispenser()`
- Request/response/error/retry lifecycle hooks for logging and instrumentation
- JSON-RPC microservice mode (server)
- Browser bundle (minified and development builds)
- Wallet key management: generate key pairs, import WIF keys, derive P2PKH/P2WPKH/P2SH-P2WPKH addresses
- Address validation against all supported networks (Bitcoin, Litecoin, Dogecoin)
- PSBT signing: sign unsigned PSBTs from the encoder with a WIF private key, finalize, and extract raw transaction hex
- Transaction broadcasting: broadcast signed transactions to the coin node via the encoder
- UTXO queries: fetch address UTXOs via the encoder (proxied from xchain-utxo-tracker)
- Challenge-response wallet ownership verification: generate challenges, sign messages, verify signatures
- Custom message signing: `signMessage` and `verifyMessage` work with any arbitrary string. No SDK lock-in on the verification side.
- Encrypted messaging: ECIES (default, multi-device), ECDH (session-based), and AES (pre-shared key) encryption for MESSAGE actions
- Public key resolution: automatic lookup of recipient public keys from on-chain transaction data
- High-level messaging API: `sendMessage()` handles pubkey lookup, encryption, PSBT signing, and broadcasting in one call
- TypeScript type definitions included (`index.d.ts`)
- Supports Bitcoin, Dogecoin, and Litecoin on mainnet, testnet, and regtest

## Documentation

| Document | Description |
|---|---|
| [Configuration](configuration.md) | Constructor options, environment variables, hub discovery, retry and pooling config |
| [Actions](actions.md) | All 31 supported ACTION types, parameters, and version formats |
| [Transaction Lifecycle](lifecycle.md) | `submitAction`, fee estimation, UTXO chaining, P2SH two-phase handling |
| [Wallet Sessions](sessions.md) | Bound wallet sessions, convenience methods, UTXO cache |
| [Workflows](workflows.md) | High-level recipes: issueAndDistribute, deployAndFund, stakeAndDelegate |
| [Cross-Chain](crosschain.md) | Multi-chain coordination: parallel actions, swaps, links |
| [Explorer](explorer.md) | Explorer API client methods: balances, tokens, transactions, markets |
| [Light Client (SPV)](light-client.md) | `sdk.light`: verify a balance or action against a quorum-signed checkpoint, pinned trust roots, validator rotation, DOGE-anchor cold start |
| [Encoder](encoder.md) | Encoding actions into PSBTs, encoding formats, P2SH two-phase flow |
| [Batch Builder](batch.md) | Fluent API for constructing multi-action BATCH transactions |
| [Format Selection](format-selection.md) | How the SDK picks the optimal format version |
| [Contracts](contracts.md) | VM smart contract integration: deploy, execute, deposit, withdraw, ContractClient |
| [WebSocket](websocket.md) | Real-time event client: connection, convenience methods, filters, reconnection, hooks |
| [Wallet & Auth](wallet.md) | Key management, address validation, PSBT signing, message signing, challenge-response verification |
| [Messaging](messaging.md) | ECIES/ECDH/AES encryption, public key lookup, high-level send/receive for MESSAGE actions |
| [Errors](errors.md) | Error types, codes, and handling patterns |
| [Examples](examples.md) | Complete worked examples for common use cases |
| [NFT & Registry](nft-and-registry.md) | `sdk.nft.*` and `sdk.project.*` builder namespaces for NFTs, collections, TIS documents, and project rosters |
| [Agent Wallets](../../ai-agents/agent-wallets.md) | Policy-bounded agent sessions: allowlists, caps, confirmation hooks |
| [Charging Agents](../../ai-agents/charging-agents.md) | HTTP 402 payment flows; X402Gateway, X402Client, scheme reference |
| [MCP Quickstart](../../ai-agents/mcp-quickstart.md) | Running the xchain-mcp server for LLM tool use |

## Installation

From npm (published as [`@dankest-llc/xchain-sdk`](https://www.npmjs.com/package/@dankest-llc/xchain-sdk)):

```bash
npm install @dankest-llc/xchain-sdk
```

Or, for development against the source, clone the repository and install dependencies from within the `xchain-sdk` directory:

```bash
git clone https://github.com/XChain-Platform/xchain-sdk.git
cd xchain-sdk
npm install
```

## Quick Start

### Library mode: generate an action and query balances

```javascript
const XChainSDK = require('./index.js');

// Zero-config: for a mainnet or testnet network string, the SDK resolves
// explorer/encoder/hub endpoints to the public XChain Platform hosts
// (https://explorer.xchain.io, etc.) automatically. See configuration.md.
const sdk = new XChainSDK({ network: 'bitcoin-mainnet' });

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

### Library mode: generate a PSBT via the encoder

```javascript
const XChainSDK = require('./index.js');

// Zero-config again: explorer and encoder both resolve to the public hosts
// for a mainnet/testnet network. Pass explorerUrl/encoderUrl explicitly only
// when pointing at a self-hosted or regtest stack.
const sdk = new XChainSDK({ network: 'bitcoin-mainnet' });

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

### Library mode: hub discovery

When using xchain-hub for service discovery, call `init()` after construction. The SDK fetches endpoint config from the hub and automatically re-resolves clients if config changes.

For a mainnet or testnet network, `hubUrl` already defaults to `https://hub.xchain.io`, so `init()` works with zero config too. Pass `hubUrl` explicitly (as below) only when pointing at a self-hosted hub instance.

```javascript
const XChainSDK = require('./index.js');

const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    hubUrl:  'https://my-hub.example.com',
    hubPort: 10000
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

The server listens on `SDK_API_PORT` (default `3005`) and exposes all SDK methods as JSON-RPC 2.0 endpoints over HTTP POST.

## Usage Modes

### Library import (Node.js)

Require the SDK directly in your application. All action and explorer methods are available as async functions on the SDK instance. Suitable for backend services, scripts, and testing.

```javascript
const XChainSDK = require('@dankest-llc/xchain-sdk');
// Zero-config: resolves to the public https://explorer.xchain.io/DOGE, etc.
const sdk = new XChainSDK({ network: 'dogecoin-mainnet' });
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
    // Zero-config: resolves to the public https://explorer.xchain.io, etc.
    const sdk = new XChainSDK({ network: 'bitcoin-mainnet' });
</script>
```

## Scripts

| Command | Description |
|---|---|
| `npm run api` | Start the SDK as a JSON-RPC microservice |
| `npm test` | Run the Mocha test suite |
| `npm run repl` | Start interactive REPL with a pre-configured SDK instance |
| `npm run build` | Build a production minified browser bundle to `dist/xchain_sdk.min.js` |
| `npm run build:dev` | Build a development (unminified) browser bundle to `dist/xchain_sdk.js` |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `axios` | HTTP client for Explorer, Encoder, and Hub requests |
| `bitcoinjs-lib` | Bitcoin transaction parsing, PSBT signing, address derivation and validation |
| `bitcoinjs-message` | Bitcoin message signing and verification (challenge-response auth) |
| `ecpair` | EC key pair creation and WIF import/export |
| `@bitcoinerlab/secp256k1` | Pure-JS secp256k1 elliptic curve operations (no WASM) |
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

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
