<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Regtest Miner: Operations

## Prerequisites

- **Node.js** >= 22
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

- **Image**: Alpine Node 22 with non-root user
- **Healthcheck**: JSON-RPC `ping` call
- **Security headers**: Helmet (CSP, X-Frame-Options, etc.)
- **CORS**: Enabled for cross-origin access

The container is only created for regtest networks; it is automatically excluded from mainnet and testnet installations.

## Stopping

The miner handles `SIGTERM` gracefully; it allows the current mining loop iteration to complete before exiting. No data corruption occurs on shutdown.

## JSON-RPC API

The miner exposes a JSON-RPC 2.0 API via Express for test orchestration. All methods are called via HTTP POST.

### Authentication

By default the API is open (no auth), matching the encoder/hub opt-in pattern. Setting the `MINER_API_KEY` environment variable requires a matching `X-API-Key` header on every request; a missing or wrong key returns HTTP 401. The read-only health methods `ping` and `status` always bypass the key gate, so Docker healthchecks and uptime monitors keep working on keyed deployments.

Note that the miner refuses to start when `NETWORK` is `mainnet` (only `regtest` and `testnet` are accepted): `send_funds` would otherwise expose a default-unauthenticated way to spend the node wallet.

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
    "result": { "status": "success", "ready": true },
    "id": 1
}
```

The `ready` field reflects wallet preparation (mine-readiness), not just that the port is listening. Callers that depend on mining should gate on `ready: true`.

### `status`

Return the current mining loop state for operator diagnostics and CI health checks.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "status",
    "id": 2
}
```

**Response:**

```json
{
    "jsonrpc": "2.0",
    "result": {
        "wallet_ready": true,
        "mempool_size": 0,
        "blocks_mined": 42,
        "last_mine_at": 1718900000000,
        "consecutive_errors": 0,
        "mining_paused": false
    },
    "id": 2
}
```

| Field | Type | Description |
|---|---|---|
| `wallet_ready` | boolean | `true` once `prepareWallet` has completed; gates on mine-readiness, not just server availability |
| `mining_paused` | boolean | `true` while the auto-mine loop is paused (`pause_mining`, or a `fill_mempool`/`invalidate_block` that never resumed). If mining seems stalled, check this first. |
| `mempool_size` | number | Number of transactions currently in the mempool as of the last polling cycle |
| `blocks_mined` | number | Cumulative count of blocks mined by this miner instance since startup |
| `last_mine_at` | number or null | Unix timestamp in milliseconds (`Date.now()`) of the most recent successful block mine; `null` if no block has been mined yet in this session |
| `consecutive_errors` | number | Running count of consecutive RPC failures (either `getrawmempool` or `generatetoaddress`). Resets to 0 on the next successful RPC call. Useful for alerting: a non-zero value means the miner is retrying with exponential backoff. |

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
    "id": 3
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
    "id": 4
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tx_quantity` | number | Yes | Number of transactions to create (1–50,000) |

This method pauses auto-mining during execution and restores it automatically when done. A mutex prevents concurrent calls.

### `pause_mining`

Pause the auto-mine loop. Any block already in flight at the time of the call completes normally. Use `continue_mining` to resume.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "pause_mining",
    "id": 5
}
```

### `continue_mining`

Resume auto-mining after a pause.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "continue_mining",
    "id": 6
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
    "id": 7
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
    "id": 8
}
```

### `set_idle_mine_interval`

Turn the mine-empty heartbeat on or off at runtime. The mining loop is mempool-driven: with no transactions arriving it mines nothing, so an idle chain never gains height and anything gated on height (stake activation delays, confirmation depth, time-locked expiries) waits forever. With an interval set, the loop mines one empty block each time the mempool has been empty that long.

Use `generate_blocks` to JUMP a height window; use this to WAIT one out on a quiet chain.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "set_idle_mine_interval",
    "params": {
        "interval_ms": 5000
    },
    "id": 9
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `interval_ms` | number | Yes | Milliseconds of empty mempool before mining one empty block. `0` disables. Otherwise 1,000 to 3,600,000. |

The boot-time equivalent is the `IDLE_MINE_INTERVAL_MS` environment variable. The current value is reported as `idle_mine_interval_ms` by `status`.

### `generate_blocks`

Mine a specific number of empty blocks immediately, regardless of mempool state. Used by e2e tests to advance block height past time-locked states (such as `STAKE` activation delays).

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "generate_blocks",
    "params": {
        "count": 10
    },
    "id": 9
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `count` | number | Yes | Number of blocks to mine (must be a positive integer) |

**Response:**

```json
{
    "jsonrpc": "2.0",
    "result": { "count": 10, "hashes": ["..."] },
    "id": 9
}
```

### `invalidate_block`

Mark a block as invalid so the node rolls back to the fork point. Auto-mining is paused; call `continue_mining` when the reorg is complete. Together with `reconsider_block`, this enables deterministic reorg tests without dropping to raw node RPC.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "invalidate_block",
    "params": { "block_hash": "..." },
    "id": 10
}
```

### `reconsider_block`

Remove a block from the invalid set so the node can re-evaluate chain selection. Call after mining the competing branch, before `continue_mining`.

**Request:**

```json
{
    "jsonrpc": "2.0",
    "method": "reconsider_block",
    "params": { "block_hash": "..." },
    "id": 11
}
```

## Resilience

### Exponential Backoff

When the coin node is unreachable (ECONNREFUSED, timeout, DNS failure), the miner retries with capped exponential backoff from 1 second to 30 seconds. The attempt counter resets on the first successful call.

### Pinned Wallet Fee Rate

On a matured regtest chain, the node's `estimatesmartfee` can inflate to absurd rates, pushing funding-send fees above `-maxtxfee` and failing `send_funds`/`fill_mempool` with RPC error -6 (easily misread as UTXO exhaustion). `prepareWallet` therefore pins a fixed wallet fee rate via `settxfee` (best-effort; a daemon that rejects `settxfee` falls back to the estimate path, and startup logs say which happened).

### Error Sanitization

RPC credentials (`NODE_USER`, `NODE_PASSWORD`) are never included in error messages or console output. Error responses include sanitized messages only.

### Concurrent Call Protection

The `fillMempool` method uses a mutex to prevent overlapping stress test runs. If called while another `fillMempool` is in progress, the second call is rejected. The `keepMining` flag is automatically restored in a `finally` block even if an error occurs.

## Troubleshooting

### Miner exits on startup with "Missing environment variable"

All 6 environment variables are required. Check your `.env` file or Docker container environment. See [Configuration](configuration.md) for the full list.

### Miner cannot connect to coin node

```
Error: connect ECONNREFUSED 127.0.0.1:18444
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
- If a previous `fillMempool` crashed, the mutex may be locked, restart the miner

### Port already in use

```
Error: listen EADDRINUSE :::3001
```

Another process is using `REGTEST_MINER_API_PORT`. Change the port in `.env` or stop the conflicting process.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
