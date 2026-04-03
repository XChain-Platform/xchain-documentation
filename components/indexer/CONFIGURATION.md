<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Indexer — Configuration Reference

## Environment Variables

Configuration is loaded from a `.env` file and environment variables. Copy the `.env.example` file and configure before running.

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `DECODER_DB_HOST` | Decoder database hostname | `localhost` |
| `DECODER_DB_PORT` | Decoder database port | `3306` |
| `DECODER_DB_NAME` | Decoder database name | `XChain_BTC_Mainnet_Decoder` |
| `DECODER_DB_USER` | Decoder database username | `xchain` |
| `DECODER_DB_PASS` | Decoder database password | `secretpassword` |
| `INDEXER_DB_HOST` | Indexer database hostname | `localhost` |
| `INDEXER_DB_PORT` | Indexer database port | `3306` |
| `INDEXER_DB_NAME` | Indexer database name | `XChain_BTC_Mainnet_Indexer` |
| `INDEXER_DB_USER` | Indexer database username | `xchain` |
| `INDEXER_DB_PASS` | Indexer database password | `secretpassword` |
| `INDEXER_API_PORT` | API server listening port | `3000` |
| `INDEXER_COIN` | Blockchain to index | `BTC`, `LTC`, or `DOGE` |
| `INDEXER_NETWORK` | Network to index | `mainnet`, `testnet`, or `regtest` |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `CORS_ORIGIN` | Allowed CORS origin for API requests | `http://localhost` |

## Coin-Specific Configuration

Each supported blockchain has a configuration file at `src/configs/<COIN>.js` (BTC.js, LTC.js, DOGE.js) that defines:

| Parameter | Description | Example (BTC) |
|---|---|---|
| `ISSUANCE_FEE_TOKEN` | XCHAIN fee for token issuance | `1.00000000` |
| `ISSUANCE_FEE_SUBTOKEN` | XCHAIN fee for sub-token issuance | `0.50000000` |
| `EXPIRATION_FEE_DEFAULT_DAYS` | Default listing duration | `90` (3 months) |
| `EXPIRATION_FEE_FREE_DAYS` | Free listing duration | `182` (6 months) |
| `EXPIRATION_FEE_PER_DAY` | XCHAIN fee per day beyond free period | `0.00547945` |
| `ADDRESS.BURN` | Burn address (per network) | `1Muhahahahhahahahahahhahahauxh9QX` |
| `ADDRESS.GAS` | Gas token issuer address (per network) | `1BTNSGASK5En7rFurDJ79LQ8CVYo2ecLC8` |
| `ADDRESS.DONATE1` | Protocol development donation address | `1BTNSGASK5En7rFurDJ79LQ8CVYo2ecLC8` |
| `ADDRESS.DONATE2` | Community development donation address | `1BTNSGASK5En7rFurDJ79LQ8CVYo2ecLC8` |

## Indexer Constants

These values are defined in `src/config.js` and apply to all chains:

### Token Rules

| Parameter | Value | Description |
|---|---|---|
| `GAS` | `XCHAIN` | Gas token ticker name |
| `NATIVE_TICK_DECIMALS` | `8` | Decimal places for native coin amounts |
| `MIN_TICK_LENGTH` | `1` | Minimum ticker name length |
| `MAX_TICK_LENGTH` | `250` | Maximum ticker name length |
| `TICK_CHARACTERS` | `a-zA-Z0-9~!@#$%^&*()_+-={}[]:<>.?` | Allowed characters in ticker names |
| `RESERVED_TICKS` | `['BTC','LTC','DOGE','XCHAIN']` | Ticker names reserved by the protocol |
| `MIN_TOKEN_DECIMALS` | `0` | Minimum token decimal places |
| `MAX_TOKEN_DECIMALS` | `18` | Maximum token decimal places |
| `MIN_TOKEN_SUPPLY` | `0.000000000000000001` | Minimum token supply (10^-18) |
| `MAX_TOKEN_SUPPLY` | `1000000000000000000000` | Maximum token supply (10^21) |

### COINPay

| Parameter | Value | Description |
|---|---|---|
| `COIN_DECIMALS` | `8` | Native coin decimal places (BTC/LTC/DOGE all use 8) |
| `COINPAY_EXPIRATION` | `7200` | COINPay obligation expiration in seconds (2 hours) |

### Field Limits

| Parameter | Value | Description |
|---|---|---|
| `MAX_TOKEN_DESCRIPTION` | `250` | Maximum description length in characters |
| `MAX_MEMO_LENGTH` | `250` | Maximum memo length in characters |
| `MAX_FILE_NAME_LENGTH` | `250` | Maximum file name length |
| `MAX_FILE_TYPE_LENGTH` | `255` | Maximum MIME type length (per RFC 4288) |
| `MAX_FILE_TITLE_LENGTH` | `250` | Maximum file title length |
| `MAX_BROADCAST_MESSAGE_LENGTH` | `250` | Maximum broadcast message length |
| `MAX_BROADCAST_VALUE_LENGTH` | `25` | Maximum broadcast value length |
| `MAX_MESSAGE_LENGTH` | `1048576` | Maximum message content (1 MB) |
| `MAX_MESSAGE_KEY_LENGTH` | `1048576` | Maximum encryption key length (1 MB) |
| `MAX_DISPENSES` | `1000` | Maximum dispenses per dispenser |

### Timing and Delays

| Parameter | Value | Description |
|---|---|---|
| `BLOCK_CHECK_INTERVAL` | `5000` | Milliseconds between block polling cycles |
| `BLOCK_PROCESS_TIMEOUT` | `300000` | Maximum milliseconds to process a single block |
| `DISPENSER_LIST_DELAY` | `3600` | Seconds before dispenser list updates take effect |
| `DISPENSER_CLOSE_DELAY` | `3600` | Seconds before dispenser close takes effect |

### Protocol Constants

| Parameter | Value | Description |
|---|---|---|
| `MESSAGE_ENCRYPTION_METHODS` | `[1, 2]` | 1 = ECDH, 2 = AES |
| `SLEEP_IMMEDIATE_METHODS` | `[-1, 0]` | -1 = sleep indefinitely, 0 = resume immediately |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
