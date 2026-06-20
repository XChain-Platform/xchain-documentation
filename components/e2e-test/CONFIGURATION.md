<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# E2E Test Suite: Configuration

## Environment Variables

The test suite reads configuration from a `.env` file (loaded via `dotenv`) or falls back to xchain-hub discovery. All variables are optional if hub discovery is available.

### Core Settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `COIN` | Yes | None | Blockchain coin: `bitcoin`, `litecoin`, or `dogecoin` |
| `NETWORK` | Yes | None | Network mode: `regtest`, `testnet`, or `mainnet` |
| `ALLOW_MAINNET` | No | `false` | Must be `true` to run tests against mainnet (safety guard) |

### Coin Node

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_URL` | Hub fallback | None | Coin node RPC hostname |
| `NODE_PORT` | Hub fallback | None | Coin node RPC port (e.g., `18444` for BTC regtest) |
| `NODE_USER` | Hub fallback | None | RPC username |
| `NODE_PASSWORD` | Hub fallback | None | RPC password |

### UTXO Tracker

| Variable | Required | Default | Description |
|---|---|---|---|
| `UTXO_TRACKER_URL` | Hub fallback | None | UTXO tracker hostname |
| `UTXO_TRACKER_API_PORT` | Hub fallback | None | UTXO tracker API port |

### Encoder

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENCODER_URL` | Hub fallback | None | Encoder service hostname |
| `ENCODER_API_PORT` | Hub fallback | None | Encoder API port |

### Decoder

| Variable | Required | Default | Description |
|---|---|---|---|
| `DECODER_URL` | Hub fallback | None | Decoder service hostname |
| `DECODER_API_PORT` | Hub fallback | None | Decoder API port |

### Indexer

| Variable | Required | Default | Description |
|---|---|---|---|
| `INDEXER_URL` | Hub fallback | None | Indexer service hostname |
| `INDEXER_API_PORT` | Hub fallback | None | Indexer API port |
| `INDEXER_DB_NAME` | Hub fallback | None | Indexer MariaDB database name |
| `INDEXER_DB_USER` | Hub fallback | None | Indexer MariaDB username |
| `INDEXER_DB_PASS` | Hub fallback | None | Indexer MariaDB password |

### Explorer

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPLORER_URL` | Yes (not hub-discoverable) | None | Explorer service hostname |
| `EXPLORER_API_PORT` | Yes (not hub-discoverable) | None | Explorer API port |

### Regtest Miner

| Variable | Required | Default | Description |
|---|---|---|---|
| `REGTEST_MINER_URL` | Hub fallback | None | Regtest miner hostname |
| `REGTEST_MINER_API_PORT` | Hub fallback | None | Regtest miner API port |

### Hub Discovery

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_VALIDATORS` | No | None | Comma-separated list of hub endpoints (e.g., `hub1:10000,http://hub2:10000`) |
| `HUB_URL` | No | `localhost` | Single hub hostname (used if `HUB_VALIDATORS` is not set) |
| `HUB_PORT` | No | `10000` | Single hub port |
| `HUB_API_HOST` | No | None | Alternative to `HUB_URL` (backward compatibility) |

## Hub Discovery Fallback

When direct environment variables are not set, the bootstrap sequence discovers configuration from xchain-hub:

```
checkAllEnvironmentalVariables()
    │
    ├── All 21 vars set? → Use direct config
    │
    └── Any missing? → Hub fallback:
        ├── Parse endpoints: HUB_VALIDATORS > HUB_URL+HUB_PORT > localhost:10000
        ├── new XChainHubConnector(endpoints)
        ├── hubConnector.ping()
        ├── hubConnector.getAllConfig() → config[coin][network][service][param]
        └── Extract host/port for: node, database, utxo-tracker, encoder, decoder, indexer, regtest-miner
            Note: explorer is NOT hub-discoverable; EXPLORER_URL/EXPLORER_API_PORT must be set directly
```

**Docker convention:** When using hub discovery, all service hostnames are overridden to `"localhost"` (Docker Compose services are accessed via port mapping, not container hostnames). Database host defaults to `"mariadb"`.

## Internal Constants

| Constant | Value | Location | Description |
|---|---|---|---|
| `GAS_TICK` | `"XCHAIN"` | `initialCheck.test.js` | Gas token ticker, auto-created if missing |
| `connectionLimit` | `10` | `db.js` | MariaDB connection pool size |
| `insertIdAsNumber` | `true` | `db.js` | Return insert IDs as numbers, not BigInt |
| `timeMax` (default) | `60000` | `db.js` | Default polling timeout for all `waitFor*` methods (ms) |
| `sleep interval` | `1000` | `db.js` | Polling interval between `check*` calls (ms) |
| `waitForTx timeout` | `10000` | `BlockchainConnector.js` | Default timeout for `waitForTx` polling (ms) |
| `waitForUtxos timeout` | `60000` | `XChainUtxoTrackerConnector.js` | Default timeout for `waitForUtxos` polling (ms) |
| `tracker poll timeout` | `20000` | `transactionHelper.js` | Timeout for UTXO verification cache polling after broadcast (ms) |
| `tracker poll interval` | `500` | `transactionHelper.js` | Interval for UTXO verification polling (ms) |
| `_call timeout` | `5000` | `XChainHubConnector.js` | HTTP timeout for hub JSON-RPC calls (ms) |
| `mining time` | `1000, 1000` | `initialCheck.test.js` | Mining max_time and tx_added_time set during bootstrap (ms) |

## Docker

### Dockerfile

The suite provides a Dockerfile for containerized execution:

```dockerfile
# Node 22 exactly (bookworm, not alpine): node:latest = Node 24+ can't build
# isolated-vm, and alpine's musl breaks native addon builds.
FROM node:22-bookworm

RUN mkdir /XChainE2ETest/
# xchain-hub and xchain-sdk are staged into the build context by xchain-node's
# install path (LIBRARY_BUNDLES); both must precede the package.json COPY so
# `npm ci` can resolve their file: deps inside the image.
COPY ./xchain-hub /XChainE2ETest/xchain-hub
COPY ./xchain-sdk /XChainE2ETest/xchain-sdk
COPY ./package.json /XChainE2ETest/package.json
COPY ./package-lock.json /XChainE2ETest/package-lock.json
WORKDIR /XChainE2ETest
RUN npm ci

COPY ./src /XChainE2ETest/src
COPY ./test /XChainE2ETest/test

# .env is NOT copied in. Pass credentials via `docker run --env-file` at runtime.
CMD ["npm", "test"]
```

### Docker Compose

Run with an env file:

```bash
docker build -t xchain-e2e-test .
docker run --env-file .env --network host xchain-e2e-test
```

Or as part of a Docker Compose stack where all services are orchestrated together:

```bash
docker-compose up --exit-code-from xchain-e2e-test
```

## Supported Coin/Network Combinations

| Coin | Network | BIP32 Derivation | Address Type | Dust Threshold |
|---|---|---|---|---|
| Bitcoin | regtest | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 546 sats |
| Bitcoin | testnet | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 546 sats |
| Bitcoin | mainnet | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 546 sats |
| Litecoin | regtest | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 5460 sats |
| Litecoin | testnet | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 5460 sats |
| Litecoin | mainnet | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 5460 sats |
| Dogecoin | regtest | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 100000 sats |
| Dogecoin | testnet | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 100000 sats |
| Dogecoin | mainnet | `m/44'/0'/0'/0/{index}` | P2PKH (legacy) | 100000 sats |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
