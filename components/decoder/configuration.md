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
| `DECODER_API_PORT` | JSON-RPC API listen port. Validated at startup: the process exits immediately when missing or not a valid port (1 to 65535), rather than binding to a random port while appearing healthy. | `3002` |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `AUX_POW` | Enable AuxPoW header stripping (Dogecoin) | _(unset)_ |
| `DECODER_RATE_LIMIT_RPM` | API requests per minute per IP | `100` |
| `FEE_DESTINATION` | Native-coin protocol fee destination override for this coin+network. The decoder persists outputs paying the resolved address to `transaction_outputs` so the indexer can validate native-coin fee payments. By default the address comes from the bundled coin registry (`src/coins`, pinned per coin/network), so capture is on for a stock install. This variable overrides the default on testnet/regtest only; on mainnet it is ignored with a warning, because fee acceptance is consensus and must not depend on operator environment. | _(coin registry)_ |
| `DB_QUERY_TIMEOUT` | MariaDB query timeout in milliseconds (passed to the connection pool `queryTimeout` option) | `30000` |
| `NODE_RPC_TIMEOUT` | HTTP timeout in milliseconds for all JSON-RPC calls to the coin node (sets `axios.defaults.timeout` at startup) | `30000` |
| `NODE_URL_FALLBACK` | Comma-separated list of additional coin-node endpoints. The connector rotates round-robin to the next endpoint after `NODE_FAILOVER_THRESHOLD` consecutive connection-level failures, so a recovered primary is retried again if the fallback also dies. Each fallback reuses `NODE_PORT`. | _(unset, single endpoint)_ |
| `NODE_FAILOVER_THRESHOLD` | Consecutive connection-level failures before rotating to the next endpoint in `NODE_URL_FALLBACK`. Floored at 1. | `3` |
| `RPC_TIMEOUT_RETRY_DELAY_MS` | Backoff in milliseconds between timeout (`ECONNABORTED`) retries in the block-path RPC methods. Each attempt has already burned the full RPC timeout before aborting, so an instant re-fire stacks retries onto a node that is timing out because it is overloaded. Set to `0` to disable (tests do). | `500` |
| `DECODER_RPC_CONCURRENCY` | Maximum concurrent outbound JSON-RPC calls to the coin node. Floored at 1. | `50` |
| `DECODER_RPC_MAX_BATCH` | Maximum number of calls permitted in one inbound JSON-RPC batch. The router runs `Promise.all` over a batch while the rate limiter counts the batch as a single request, so this bound is what stops one array from fanning out into thousands of concurrent handlers. | `20` |
| `MIGRATION_STRICT_CHECKSUM` | Set to `1` to make a schema-checksum mismatch fail closed at startup instead of logging and continuing. Off by default so a diverged schema does not cause a surprise fleet-wide boot failure; CI and operators running `node src/migrate.js` get the strict path anyway. | _(unset, non-fatal)_ |
| `COIN` | Cosmetic label only, reported in the `/status` response. The decoder takes its chain identity from the node it is pointed at, so it has no coin setting of its own; the label stays empty unless a deploy sets one. | _(unset, empty label)_ |

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

These values are defined in source code. Most are fixed; the rows that name an environment variable can be overridden by it:

### Polling & Sync

| Constant | Value | Location | Description |
|---|---|---|---|
| `CHECK_BLOCK_DELAY_MS` | `1000` | XChainDecoder.js | Delay between polling iterations (1 second) |
| `BLOCKCHAIN_INFO_REFRESH_MS` | `30000` | XChainDecoder.js | During catch-up, the node tip (`getblockchaininfo`) is re-polled at least this often (30 seconds) so reported lag stays accurate |
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
| `queryTimeout` default | `30000` | db.js | MariaDB query execution timeout in milliseconds (30 seconds); overridable via `DB_QUERY_TIMEOUT` env var |
| RPC timeout (axios) | `30000` | BlockchainConnector.js | HTTP timeout for all JSON-RPC calls (30 seconds); overridable via `NODE_RPC_TIMEOUT` env var |
| RPC max retries | `10` | BlockchainConnector.js | Maximum retry attempts for failed RPC calls |
| RPC retry delay | `500` | BlockchainConnector.js | Delay between retries in `getRawTransaction`, and (via `backoffOnTimeout()`) between timeout retries in the block-path RPC methods. Overridable via `RPC_TIMEOUT_RETRY_DELAY_MS`. Non-timeout failures in the block-path methods still retry without a sleep. |
| RPC concurrency | `50` | BlockchainConnector.js | Maximum concurrent outbound RPC calls; overridable via `DECODER_RPC_CONCURRENCY` |
| Failover threshold | `3` | BlockchainConnector.js | Consecutive connection failures before rotating to the next `NODE_URL_FALLBACK` endpoint |
| RPC 429 backoff | `5000` | BlockchainConnector.js | Delay on HTTP 429 rate limiting (5 seconds) |

### API Security

| Constant | Value | Location | Description |
|---|---|---|---|
| Rate limit window | `60000` | api.js | Rate limit window (1 minute) |
| Rate limit max | `100` | api.js | Maximum requests per window per IP; overridable via `DECODER_RATE_LIMIT_RPM` |
| JSON-RPC batch cap | `20` | api.js | Maximum calls in one inbound JSON-RPC batch; overridable via `DECODER_RPC_MAX_BATCH` |
| Body size limit | `100kb` | api.js | Maximum JSON request body size |

## Start Block Heights

The decoder begins parsing from a preconfigured block height per network to skip blocks that predate the XChain protocol:

| Network | Start Block |
|---|---|
| `bitcoin-mainnet` | 950,000 |
| `bitcoin-testnet` | 138,000 |
| `bitcoin-regtest` | 0 |
| `litecoin-mainnet` | 3,120,000 |
| `litecoin-testnet` | 4,765,000 |
| `litecoin-regtest` | 0 |
| `dogecoin-mainnet` | 6,240,000 |
| `dogecoin-testnet` | 64,800,000 |
| `dogecoin-regtest` | 0 |

> **DOGE testnet note:** the DOGE testnet mines min-difficulty blocks roughly every 20 seconds, so the chain runs tens of millions of blocks ahead of the other networks. The start block was re-pinned near the chain tip on 2026-06-19 to avoid indexing millions of pre-launch blocks. See `src/CryptoNetworks.js` for the comment.

## Valid ACTION Names

The decoder accepts only these 35 ACTION names after deobfuscation. Transactions with unrecognized action names are logged and skipped:

```
ADDRESS, AIRDROP, ANCHOR, ATTEST,
BATCH, BET, BROADCAST, CALLBACK, COINPAY, COLLECT,
DELEGATE, DEPLOY, DEPOSIT, DESTROY, DISPENSER,
DIVIDEND, EXECUTE, FILE, ISSUE, LINK, LIST, MESSAGE, MINT,
NODEPROOF, ORDER, PRICE, SEND, SLASH, SLEEP, STAKE, SWAP,
SWEEP, UNSTAKE, VOTE, WITHDRAW
```

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
