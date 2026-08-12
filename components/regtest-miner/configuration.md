<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Regtest Miner: Configuration

## Environment Variables

All configuration is via environment variables (loaded from `.env` by dotenv). The miner validates all 6 variables on startup and exits with a clear error message if any are missing or invalid.

### Required

| Variable | Description |
|---|---|
| `NETWORK` | Must be `regtest` or `testnet`. `mainnet` is refused at startup: the miner's `send_funds` method spends the node wallet and is unauthenticated by default. |
| `NODE_URL` | Coin node JSON-RPC hostname (non-localhost triggers credential warning) |
| `NODE_PORT` | Coin node JSON-RPC port (1–65535) |
| `NODE_USER` | RPC username |
| `NODE_PASSWORD` | RPC password |
| `REGTEST_MINER_API_PORT` | Miner JSON-RPC API listening port (1–65535) |

### Optional

| Variable | Description |
|---|---|
| `MINER_API_KEY` | When set, every JSON-RPC request must carry a matching `X-API-Key` header (401 otherwise). `ping` and `status` are exempt so healthchecks keep working. Unset by default (no auth), mirroring the encoder/hub opt-in pattern. |
| `MINER_STALL_ERROR_THRESHOLD` | Consecutive failed mining cycles before the `health` probe reports the miner stalled. Defaults to `5`. A deliberate pause is never counted as a stall. |
| `MINER_WALLET_GRACE_MS` | Cold-start grace period before a wallet that never became ready is reported as a stall by the `health` probe. Defaults to `60000` (60 seconds). |
| `NODE_RPC_TIMEOUT` | HTTP timeout in milliseconds for all JSON-RPC calls to the coin node (sets `axios.defaults.timeout` at startup). Defaults to `60000`, which is **not** the decoder's default for the same variable name (`30000`); if you export it globally for a whole stack, both services pick up your value. |
| `IDLE_MINE_INTERVAL_MS` | Mine one empty block whenever the mempool has been empty this long. Unset or `0` (the default) keeps the mining loop purely mempool-driven, which means an idle chain never advances a block and anything gated on HEIGHT stalls: stake activation delays, confirmation depth, time-locked expiries. Set it on venues whose tests wait out a height window with no transactions in flight. Same bounds as the mining timers (1,000 to 3,600,000 ms); changeable at runtime with `set_idle_mine_interval`. |

### Validation Rules

- `NETWORK` must be `regtest` or `testnet`
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

- **Max timer** (`DEFAULT_MAX_TIME_TO_MINE_TXS`), starts when the first unconfirmed transaction is detected. If it expires, mining triggers regardless of the extension timer.
- **Extension timer** (`DEFAULT_ADDED_TIME_TO_MINE_TXS`), resets each time a new transaction appears in the mempool. If it expires (no new transactions for 5 seconds), mining triggers.

Both timers can be reconfigured at runtime via the `set_mining_time` JSON-RPC method. Values must be between `MIN_MINING_TIME` and `MAX_MINING_TIME`. The `set_default_mining_time` method restores the defaults.

### Exponential Backoff

When the coin node is unreachable, the miner retries with exponential backoff:

```
delay = min(1000 * 2^attempts, MAX_BACKOFF_MS)
```

The attempt counter resets to zero on the first successful RPC call.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
