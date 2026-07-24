<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->

Copyright &copy; 2025-2026 Dankest, LLC

# XChain SDK: WebSocket Client

The SDK includes a built-in WebSocket client for real-time event streaming from the xchain-explorer. It wraps the explorer's [WebSocket API](../explorer/WEBSOCKET.md) with a developer-friendly interface including convenience methods, automatic reconnection with catch-up, and lifecycle hooks.

## Quick Start

```javascript
const { XChainSDK } = require('xchain-sdk');

const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    explorerPort: 8080
});

// Connect the WebSocket
await sdk.connectWs();

// Listen for new blocks
const unsub = sdk.onBlock((event) => {
    console.log('New block:', event.data.block_index);
});

// Stop listening
unsub();
```

## Configuration

The WebSocket client is auto-created when `explorerUrl` or `websocketUrl` is configured. No separate initialization needed; it shares the explorer's host and port by default.

### Constructor Options

| Option | Type | Default | Description |
|---|---|---|---|
| `websocketUrl` | string | `explorerUrl` | WebSocket server hostname (falls back to explorer URL) |
| `websocketPort` | number | `explorerPort` | WebSocket server port (falls back to explorer port) |

### Environment Variables

| Variable | Description |
|---|---|
| `WEBSOCKET_URL` | WebSocket server hostname |
| `WEBSOCKET_PORT` | WebSocket server port |

### Resolution Priority

1. Constructor `websocketUrl` / `websocketPort`
2. Constructor `explorerUrl` / `explorerPort`
3. Hub-discovered endpoints (via `init()`)
4. Environment variables `WEBSOCKET_URL` / `WEBSOCKET_PORT`
5. Environment variables `EXPLORER_URL` / `EXPLORER_PORT`

## Connection Management

```javascript
// Connect (returns Promise, resolved on WELCOME)
const serverInfo = await sdk.connectWs();
console.log('Server version:', serverInfo.version);

// Check connection state
sdk.ws.isConnected(); // true

// Disconnect
sdk.disconnectWs();
```

`sdk.stop()` automatically disconnects the WebSocket.

## Convenience Methods

Every convenience method returns an **unsubscribe function**. Call it to remove the handler and unsubscribe from the channel.

### sdk.onBlock(callback)

Listen for new blocks.

```javascript
const unsub = sdk.onBlock((event) => {
    console.log('Block', event.data.block_index, 'with', event.data.action_count, 'actions');
});
```

### sdk.onAction(callback, opts?)

Listen for new actions with optional filters.

```javascript
// All actions
sdk.onAction((event) => {
    console.log(event.data.action, event.data.action_index);
});

// Only specific types
sdk.onAction((event) => {
    console.log('Order event:', event.data.action_index);
}, { types: ['ORDER', 'ORDER_MATCH', 'ORDER_EXPIRE'] });
```

**Options:** `{ types?: string[], statuses?: string[], ticks?: string[] }` (**`statuses` is not supported**: accepted for backward compatibility but never honored by the server, so it silently matches every event; do not rely on it)

### sdk.onAddress(address, callback, opts?)

Watch an address for all relevant events (actions, balance changes, order matches, COINPay obligations).

```javascript
const unsub = sdk.onAddress('1abc...', (event) => {
    console.log(event.type, ':', event.data);
}, { snapshot: true });
```

Events delivered: `NEW_ACTION`, `ADDRESS_UPDATE`, `ORDER_MATCH`, `COINPAY_REQUIRED`, `COINPAY_FULFILLED`, `COINPAY_EXPIRED`, `SWAP_MATCH`, `DISPENSE`

**Options:** `{ types?: string[], statuses?: string[], snapshot?: boolean }` (**`statuses` is not supported**: never honored by the server; do not rely on it)

### sdk.onToken(tick, callback)

Watch a token for supply/holder changes. Sends a snapshot on subscribe.

```javascript
sdk.onToken('PEPE', (event) => {
    console.log('PEPE supply:', event.data.supply, 'holders:', event.data.holders);
});
```

### sdk.onMarket(tick1, tick2, callback)

Watch a market pair for price/volume changes. Sends a snapshot on subscribe.

```javascript
sdk.onMarket('PEPE', 'BTC', (event) => {
    console.log('PEPE/BTC price:', event.data.last_price);
});
```

### sdk.onDispenser(actionIndex, callback)

Watch a dispenser for triggers, status changes, and expiration. Sends a snapshot on subscribe.

```javascript
sdk.onDispenser(12345, (event) => {
    console.log(event.type, 'remaining:', event.data.give_remaining);
});
```

Events delivered: `DISPENSER_UPDATE`, `DISPENSE`, `DISPENSER_CLOSED`, `DISPENSER_EXPIRED`

### sdk.onCoinpayRequired(address, callback)

Shortcut for watching an address for `COINPAY_REQUIRED` events only. Ideal for trading bots that need to auto-fulfill COINPay obligations.

```javascript
sdk.onCoinpayRequired('1BotAddr...', (event) => {
    const { payer_address, payee_address, coin_amount, expiration } = event.data;
    console.log('COINPay needed:', coin_amount, 'BTC to', payee_address);
    console.log('Deadline:', new Date(expiration * 1000));
    // Construct and broadcast COINPAY transaction...
});
```

### sdk.onOrderMatch(address, callback, opts?)

Shortcut for watching an address for `ORDER_MATCH` events. To react only to coinpay-required matches, check `event.data.status` inside the callback: `statuses` filtering is **not supported** by the server.

```javascript
// All order matches
sdk.onOrderMatch('1abc...', (event) => {
    console.log('Order matched:', event.data.action_index);
});

// Only coinpay-required matches (filter client-side; the server does not honor a statuses option)
sdk.onOrderMatch('1abc...', (event) => {
    if (event.data.status !== 'pending_coinpay') return;
    console.log('Needs COINPay:', event.data.action_index);
});
```

### sdk.onNetworkStats(callback)

Listen for network statistics updates (emitted with each new block).

```javascript
sdk.onNetworkStats((event) => {
    console.log('Block height:', event.data.block_height);
});
```

## Low-Level API

For advanced use cases, access the WebSocket client directly via `sdk.ws`.

```javascript
const ws = sdk.ws;

// Subscribe with full control (statuses is not a supported filter; the server ignores it)
await ws.subscribe(['address'], {
    address: '1abc...',
    types: ['ORDER_MATCH', 'COINPAY_REQUIRED'],
    snapshot: true,
    since_action_index: 45000
});

// Register event handlers
ws.on('ORDER_MATCH', (msg) => { /* ... */ });
ws.once('COINPAY_REQUIRED', (msg) => { /* fires once then auto-removes */ });

// List active subscriptions
const list = await ws.listSubscriptions();
console.log(list.data.subscriptions);

// Unsubscribe
ws.unsubscribe(['address'], { address: '1abc...' });
```

## Reconnection and Catch-Up

The client automatically reconnects on disconnect with exponential backoff. On reconnect, it replays all subscriptions with `since_action_index` set to the last received action index, so no events are missed.

Catch-up events have `catch_up: true` in the envelope. After replay, a `CATCH_UP_COMPLETE` event is emitted.

```javascript
ws.on('CATCH_UP_COMPLETE', (msg) => {
    console.log('Caught up:', msg.data.events_replayed, 'events replayed');
});
```

Reconnection uses the same retry configuration as the explorer/encoder clients:

| Setting | Default |
|---|---|
| Max attempts | 10 |
| Base delay | 1,000 ms |
| Max delay | 30,000 ms |
| Backoff factor | 2x |

Configure via the `retry` constructor option:

```javascript
new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    retry: { maxRetries: 20, baseDelay: 500, maxDelay: 60000 }
});
```

## Lifecycle Hooks

The WebSocket client supports four hooks, configured via the `hooks` constructor option:

| Hook | Fires When |
|---|---|
| `onWsConnect` | WebSocket connection established |
| `onWsDisconnect` | WebSocket connection closed |
| `onWsMessage` | Any message received from server |
| `onWsReconnect` | Before a reconnection attempt |

```javascript
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    hooks: {
        onWsConnect:    (info) => console.log('WS connected:', info.url),
        onWsDisconnect: (info) => console.log('WS disconnected:', info.code),
        onWsMessage:    (msg)  => console.log('WS event:', msg.type),
        onWsReconnect:  (info) => console.log('WS reconnecting, attempt', info.attempt)
    }
});
```

## Error Handling

WebSocket errors throw `SDKExplorerError` (same class as REST API errors):

```javascript
const { SDKExplorerError } = require('xchain-sdk');

try {
    await sdk.connectWs();
} catch (e) {
    if (e instanceof SDKExplorerError) {
        console.log('WS error:', e.code, e.message);
    }
}
```

| Error Code | Cause |
|---|---|
| `WS_CONNECTION_FAILED` | Could not connect to WebSocket server |
| `WS_CONNECTION_CLOSED` | Connection closed before response received |
| `WS_TIMEOUT` | No response for a request within timeout |
| `WEBSOCKET_NOT_CONFIGURED` | Called a WS method without configuring WebSocket URL |

Server-side errors (e.g., `SUBSCRIPTION_LIMIT`, `RATE_LIMITED`) are returned as rejected Promises from `subscribe()`.

## Related

- [Explorer WebSocket API Reference](../explorer/WEBSOCKET.md): full protocol spec
- [Explorer REST API Reference](../explorer/API.md): query endpoints
- [SDK Configuration](CONFIGURATION.md): all constructor options
- [SDK Examples](EXAMPLES.md): complete code examples
