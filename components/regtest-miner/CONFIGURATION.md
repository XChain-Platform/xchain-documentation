<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Regtest Miner — Configuration

## Environment Variables

All configuration is via environment variables (loaded from `.env` by dotenv). The miner validates all 6 variables on startup and exits with a clear error message if any are missing or invalid.

### Required

| Variable | Description |
|---|---|
| `NETWORK` | Must be `regtest`, `testnet`, or `mainnet` |
| `NODE_URL` | Coin node JSON-RPC hostname (non-localhost triggers credential warning) |
| `NODE_PORT` | Coin node JSON-RPC port (1–65535) |
| `NODE_USER` | RPC username |
| `NODE_PASSWORD` | RPC password |
| `REGTEST_MINER_API_PORT` | Miner JSON-RPC API listening port (1–65535) |

### Validation Rules

- `NETWORK` must be one of the three recognized strings
- `NODE_PORT` and `REGTEST_MINER_API_PORT` must be integers 1–65535
- `NODE_URL` cannot be empty
- `NODE_USER` and `NODE_PASSWORD` cannot be empty
- If `NODE_URL` is not `localhost` or `127.0.0.1`, a warning is logged (possible non-regtest node)

## Internal Constants

| Constant | Value | Description |
|---|---|---|
| `CHECK_BLOCK_DELAY_MS` | 1000 | Mempool polling interval (1 second) |
| `DEFAULT_MAX_TIME_TO_MINE_TXS` | 30000 | Max time before mining after first tx (30 seconds) |
| `DEFAULT_ADDED_TIME_TO_MINE_TXS` | 5000 | Extension time on each new tx (5 seconds) |
| `MIN_MINING_TIME` | 1000 | Minimum allowed timer value via API (1 second) |
| `MAX_MINING_TIME` | 3600000 | Maximum allowed timer value via API (1 hour) |
| `MAX_FILL_MEMPOOL_QUANTITY` | 50000 | Maximum transactions for `fill_mempool` |
| `MAX_SEND_RETRIES` | 50 | Maximum retry attempts for funding in fillMempool |
| `OUTPUTS_QUANTITY_PER_TX` | 2500 | Maximum outputs per PSBT in fillMempool |
| `MAX_BACKOFF_MS` | 30000 | Maximum exponential backoff delay (30 seconds) |

### Timer Behavior

The dual-timer system uses two independent timers that run simultaneously:

- **Max timer** (`DEFAULT_MAX_TIME_TO_MINE_TXS`) — starts when the first unconfirmed transaction is detected. If it expires, mining triggers regardless of the extension timer.
- **Extension timer** (`DEFAULT_ADDED_TIME_TO_MINE_TXS`) — resets each time a new transaction appears in the mempool. If it expires (no new transactions for 5 seconds), mining triggers.

Both timers can be reconfigured at runtime via the `set_mining_time` JSON-RPC method. Values must be between `MIN_MINING_TIME` and `MAX_MINING_TIME`. The `set_default_mining_time` method restores the defaults.

### Exponential Backoff

When the coin node is unreachable, the miner retries with exponential backoff:

```
delay = min(1000 * 2^attempts, MAX_BACKOFF_MS)
```

The attempt counter resets to zero on the first successful RPC call.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
