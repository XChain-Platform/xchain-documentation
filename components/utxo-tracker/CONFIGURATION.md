<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform UTXO Tracker — Configuration Reference

## Environment Variables

Configuration is loaded from a `.env` file via `dotenv`. All variables are read in `src/api.js` at startup.

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `NETWORK` | Blockchain network identifier | `bitcoin-mainnet`, `dogecoin-testnet`, `litecoin-regtest` |
| `NODE_URL` | Coin node JSON-RPC hostname | `127.0.0.1` |
| `NODE_PORT` | Coin node JSON-RPC port | `8332` |
| `NODE_USER` | Coin node RPC username | `rpc` |
| `NODE_PASSWORD` | Coin node RPC password | `rpc` |
| `UTXO_TRACKER_API_PORT` | API server listening port | `3000` |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `AUX_POW` | Enable AuxPoW block header stripping (required for Dogecoin and Litecoin HogEx blocks) | `undefined` (falsy) |

### Supported Network Values

| Network | Value |
|---|---|
| Bitcoin mainnet | `bitcoin-mainnet` |
| Bitcoin testnet | `bitcoin-testnet` |
| Bitcoin regtest | `bitcoin-regtest` |
| Dogecoin mainnet | `dogecoin-mainnet` |
| Dogecoin testnet | `dogecoin-testnet` |
| Dogecoin regtest | `dogecoin-regtest` |
| Litecoin mainnet | `litecoin-mainnet` |
| Litecoin testnet | `litecoin-testnet` |
| Litecoin regtest | `litecoin-regtest` |

## Internal Constants

These values are defined in `src/XChainUtxoTracker.js` and are not configurable via environment variables.

### Polling and Sync

| Constant | Value | Description |
|---|---|---|
| `CHECK_BLOCK_DELAY_MS` | `1000` | Milliseconds between block polling cycles |
| `MIN_VERIFICATION_PROGRESS_TO_PARSE` | `0.99` | Minimum node sync progress before tracker starts indexing |
| `SYNCED_THRESHOLD` | `3` | Number of blocks behind tip to consider "synced" |
| `MEMPOOL_INTERVAL` | `60000` | Milliseconds between mempool updates (60 seconds) |
| `MEMPOOL_BATCH_SIZE` | `1000` | Maximum transactions fetched per mempool batch |

### Block Processing

| Constant | Value | Description |
|---|---|---|
| `DB_TRANSACTION_BLOCKS_QUANTITY` | `100` | Number of blocks per LevelDB batch commit |
| `PREFETCH_SIZE` | `10` | Number of blocks pre-fetched concurrently |
| `ETA_WINDOW_BLOCKS` | `1000` | Rolling window size for sync ETA calculation |
| `UNDO_BLOCKS` | `10` | Number of blocks to retain K/M archive records for reorg recovery |

### Storage

| Constant | Value | Description |
|---|---|---|
| `REMOVE_SPENT` | `true` | When enabled, spent outputs are removed from O/H and archived in K/M |
| `SATOSHI_BIGINT` | `100000000n` | Satoshi-to-coin conversion factor (BigInt) |
| `SATOSHI_UNIT` | `100000000.0` | Satoshi-to-coin conversion factor (float, used only for display) |

### Database Paths

| Path | Description |
|---|---|
| `/data/xchain-utxo-tracker` | Main LevelDB database (persistent, disk-backed via `leveldown`) |
| In-memory only | Mempool database (volatile, `memdown`-backed, recreated on startup) |
| `/bootstrap/xchain-utxo-tracker/` | Bootstrap backup archive storage |

### RPC Connection

| Constant | Value | Description |
|---|---|---|
| HTTP Keep-Alive | Enabled | Persistent connections to coin node |
| Max sockets | `25` | Maximum concurrent HTTP connections to coin node |
| Timeout | `30000` | Axios request timeout in milliseconds |
| `getRawTransaction` retries | `10` | Retry count with 500ms backoff |
| `getBlockHeader` retries | `10` | Retry count with 3-second backoff |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
