<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Regtest Miner — Operations

## Prerequisites

- **Node.js** >= 18
- A running regtest coin node (bitcoind, litecoind, or dogecoind) with JSON-RPC enabled
- The coin node must be in regtest mode with wallet support enabled

## Running the Miner

```bash
npm run api
```

On startup, the miner:

1. Validates all 6 required environment variables (exits on failure)
2. Connects to the coin node via JSON-RPC
3. Creates or loads the `xchain_regtest_wallet` wallet
4. Mines 101 bootstrap blocks if the chain is fresh (coinbase maturity)
5. Begins the 1-second mempool polling loop
6. Starts the Express JSON-RPC API server on `REGTEST_MINER_API_PORT`

## Docker

When managed by xchain-node, the regtest miner runs as a Docker container:

- **Image**: Alpine Node 20 with non-root user
- **Healthcheck**: JSON-RPC `ping` call
- **Security headers**: Helmet (CSP, X-Frame-Options, etc.)
- **CORS**: Enabled for cross-origin access

The container is only created for regtest networks — it is automatically excluded from mainnet and testnet installations.

## Stopping

The miner handles `SIGTERM` gracefully — it allows the current mining loop iteration to complete before exiting. No data corruption occurs on shutdown.

## JSON-RPC API

The miner exposes a JSON-RPC 2.0 API via Express for test orchestration. All methods are called via HTTP POST.

### `ping`

Health check endpoint.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "ping",
    "id": 1
}
```

**Response:**

```json
{
    "jsonrpc": "2.0",
    "result": { "status": "success" },
    "id": 1
}
```

### `send_funds`

Send regtest coins to a specified address.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "send_funds",
    "params": {
        "address": "bcrt1q...",
        "amount": 1.0
    },
    "id": 2
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `address` | string | Yes | Recipient address |
| `amount` | number | Yes | Amount in coin units (must be > 0) |

### `fill_mempool`

Broadcast multiple transactions to stress-test the mempool.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "fill_mempool",
    "params": {
        "tx_quantity": 100
    },
    "id": 3
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tx_quantity` | number | Yes | Number of transactions to create (1–50,000) |

This method pauses auto-mining during execution and restores it automatically when done. A mutex prevents concurrent calls.

### `continue_mining`

Resume auto-mining after a pause.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "continue_mining",
    "id": 4
}
```

### `set_mining_time`

Override timer durations at runtime.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "set_mining_time",
    "params": {
        "max_time": 60000,
        "tx_added_time": 10000
    },
    "id": 5
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `max_time` | number | Yes | Max timer in milliseconds (1,000–3,600,000) |
| `tx_added_time` | number | Yes | Extension timer in milliseconds (1,000–3,600,000) |

### `set_default_mining_time`

Reset timers to defaults (30,000 / 5,000 ms).

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "set_default_mining_time",
    "id": 6
}
```

## Resilience

### Exponential Backoff

When the coin node is unreachable (ECONNREFUSED, timeout, DNS failure), the miner retries with capped exponential backoff from 1 second to 30 seconds. The attempt counter resets on the first successful call.

### Error Sanitization

RPC credentials (`NODE_USER`, `NODE_PASSWORD`) are never included in error messages or console output. Error responses include sanitized messages only.

### Concurrent Call Protection

The `fillMempool` method uses a mutex to prevent overlapping stress test runs. If called while another `fillMempool` is in progress, the second call is rejected. The `keepMining` flag is automatically restored in a `finally` block even if an error occurs.

## Troubleshooting

### Miner exits on startup with "Missing environment variable"

All 6 environment variables are required. Check your `.env` file or Docker container environment. See [Configuration](CONFIGURATION.md) for the full list.

### Miner cannot connect to coin node

```
Error: connect ECONNREFUSED 127.0.0.1:18443
```

The coin node is not running or not listening on the expected port. Verify:

```bash
bitcoin-cli -regtest getblockchaininfo
```

### No blocks being mined

If the miner is running but not mining, check:

1. Is `keepMining` set to `false`? Call `continue_mining` to resume.
2. Is the mempool empty? The miner only mines when transactions are present.
3. Are the timers set to very large values? Call `set_default_mining_time` to reset.

### fillMempool fails or hangs

- Check that the wallet has sufficient balance for the requested transaction count
- Ensure `tx_quantity` is between 1 and 50,000
- Check coin node logs for RPC errors
- If a previous `fillMempool` crashed, the mutex may be locked — restart the miner

### Port already in use

```
Error: listen EADDRINUSE :::3001
```

Another process is using `REGTEST_MINER_API_PORT`. Change the port in `.env` or stop the conflicting process.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
