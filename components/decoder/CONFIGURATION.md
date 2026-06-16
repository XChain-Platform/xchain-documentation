<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Decoder: Configuration Reference

## Environment Variables

Configuration is loaded from a `.env` file via `dotenv`. All variables are read in `src/api.js` at startup.

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `NETWORK` | Chain and network identifier | `bitcoin-mainnet`, `litecoin-testnet`, `dogecoin-regtest` |
| `NODE_URL` | Coin node JSON-RPC hostname | `127.0.0.1` |
| `NODE_PORT` | Coin node JSON-RPC port | `8332` (BTC), `9332` (LTC), `22555` (DOGE) |
| `NODE_USER` | Coin node RPC username | `rpc` |
| `NODE_PASSWORD` | Coin node RPC password | `rpc` |
| `DECODER_DB_HOST` | MariaDB hostname | `127.0.0.1` |
| `DECODER_DB_PORT` | MariaDB port | `3306` |
| `DECODER_DB_NAME` | Database name (auto-created if missing) | `XChain_BTC_Mainnet_Decoder` |
| `DECODER_DB_USER` | MariaDB username | `root` |
| `DECODER_DB_PASS` | MariaDB password | _(empty for local dev)_ |
| `DECODER_API_PORT` | JSON-RPC API listen port | `3002` |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `AUX_POW` | Enable AuxPoW header stripping (Dogecoin) | _(unset)_ |
| `DECODER_RATE_LIMIT_RPM` | API requests per minute per IP | `100` |

The `AUX_POW` variable should be set to any truthy value when running against Dogecoin nodes. It enables the `getBlockWithoutAuxPow()` code path that strips merge-mining headers before parsing.

## Network Identifier Format

The `NETWORK` variable follows the pattern `{coin}-{network}`:

| Value | Coin | Network |
|---|---|---|
| `bitcoin-mainnet` | Bitcoin | Mainnet |
| `bitcoin-testnet` | Bitcoin | Testnet |
| `bitcoin-regtest` | Bitcoin | Regtest |
| `litecoin-mainnet` | Litecoin | Mainnet |
| `litecoin-testnet` | Litecoin | Testnet |
| `litecoin-regtest` | Litecoin | Regtest |
| `dogecoin-mainnet` | Dogecoin | Mainnet |
| `dogecoin-testnet` | Dogecoin | Testnet |
| `dogecoin-regtest` | Dogecoin | Regtest |

## Database Name Convention

Database names follow the XChain Platform naming standard:

```
XChain_{CHAIN}_{NETWORK}_Decoder
```

| Chain | Example |
|---|---|
| Bitcoin mainnet | `XChain_BTC_Mainnet_Decoder` |
| Litecoin testnet | `XChain_LTC_Testnet_Decoder` |
| Dogecoin regtest | `XChain_DOGE_Regtest_Decoder` |

Database names are validated on startup; only alphanumeric characters and underscores are allowed. Names containing SQL injection characters, spaces, backticks, or unicode are rejected.

## Internal Constants

These values are defined in source code and not configurable via environment variables:

### Polling & Sync

| Constant | Value | Location | Description |
|---|---|---|---|
| `CHECK_BLOCK_DELAY_MS` | `1000` | XChainDecoder.js | Delay between polling iterations (1 second) |
| `MEMPOOL_INTERVAL` | `60000` | XChainDecoder.js | Mempool update interval when synced (60 seconds) |
| `MEMPOOL_BATCH_SIZE` | `1000` | XChainDecoder.js | Max transactions fetched per mempool batch |
| `SYNCED_THRESHOLD` | `3` | XChainDecoder.js | Max blocks behind tip to be considered synced |
| `MIN_VERIFICATION_PROGRESS_TO_PARSE` | `0.99` | XChainDecoder.js | Node sync progress required before parsing begins |

### Data Limits

| Constant | Value | Location | Description |
|---|---|---|---|
| `MAX_ACTION_DATA_LENGTH` | `8192` | XChainDecoder.js | Maximum **compiled** on-chain ACTION payload size in bytes (the script push measured before decompile strips the OP_PUSHDATA prefix; the decoded ACTION string is 1–3 bytes shorter). A tx is skipped when its compiled push exceeds 8192 bytes. |
| `SATOSHIS_DECIMALS` | `8` | db.js | Decimal places for satoshi-to-coin conversion |
| `DB_TRANSACTION_BLOCKS_QUANTITY` | `1` | XChainDecoder.js | Blocks per database transaction |

### Connection Tuning

| Constant | Value | Location | Description |
|---|---|---|---|
| DB connection pool size | `10` | db.js | Maximum concurrent MariaDB connections |
| `GET_CONNECTION_TIMEOUT_MS` | `30000` | db.js | Timeout for acquiring a DB connection (30 seconds) |
| RPC timeout (axios) | `5000` | BlockchainConnector.js | HTTP timeout for all JSON-RPC calls (5 seconds) |
| RPC max retries | `10` | BlockchainConnector.js | Maximum retry attempts for failed RPC calls |
| RPC retry delay | `500` | BlockchainConnector.js | Delay between retries (milliseconds) |
| RPC 429 backoff | `5000` | BlockchainConnector.js | Delay on HTTP 429 rate limiting (5 seconds) |

### API Security

| Constant | Value | Location | Description |
|---|---|---|---|
| Rate limit window | `60000` | api.js | Rate limit window (1 minute) |
| Rate limit max | `100` | api.js | Maximum requests per window per IP |
| Body size limit | `100kb` | api.js | Maximum JSON request body size |

## Start Block Heights

The decoder begins parsing from a preconfigured block height per network to skip blocks that predate the XChain protocol:

| Network | Start Block |
|---|---|
| `bitcoin-mainnet` | 900,000 |
| `bitcoin-testnet` | 100,000 |
| `bitcoin-regtest` | 0 |
| `litecoin-mainnet` | 3,000,000 |
| `litecoin-testnet` | 4,470,000 |
| `litecoin-regtest` | 0 |
| `dogecoin-mainnet` | 6,000,000 |
| `dogecoin-testnet` | 19,900,000 |
| `dogecoin-regtest` | 0 |

## Valid ACTION Names

The decoder accepts only these 33 ACTION names after deobfuscation. Transactions with unrecognized action names are logged and skipped:

```
ADDRESS, AIRDROP, ANCHOR, ATTEST,
BATCH, BROADCAST, CALLBACK, COINPAY, COLLECT,
DELEGATE, DEPLOY, DEPOSIT, DESTROY, DISPENSER,
DIVIDEND, EXECUTE, FILE, ISSUE, LINK, LIST, MESSAGE, MINT,
NODEPROOF, ORDER, PRICE, SEND, SLASH, SLEEP, STAKE, SWAP,
SWEEP, UNSTAKE, WITHDRAW
```

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
