# Configuration

This document describes how configuration works across XChain services, what parameters are available, and how to set them.

---

## Configuration Hierarchy

Services resolve configuration in the following priority order (highest to lowest):

1. **Environment variables** — Set at container startup by xchain-node. Takes precedence over everything.
2. **`config.json`** — A static JSON file in the service directory. Used when hub discovery is not configured.
3. **Hub discovery (`getAllConfig()`)** — The explorer and SDK fetch live config from xchain-hub on startup and refresh it every 60 seconds. Useful for dynamic configuration without container restarts.

For most deployments managed by xchain-node, environment variables are the primary mechanism. Hub-based config is primarily used by the explorer to avoid hardcoded database credentials in its config file.

---

## Hub-Based Configuration

The explorer and SDK can fetch all their configuration from xchain-hub using the `getAllConfig()` JSON-RPC method. The hub stores config in LevelDB using the key format:

```
P:{coin}-{network}-{module}:{paramName}
```

Examples:
- `P:bitcoin-mainnet-decoder:host`
- `P:litecoin-mainnet-indexer:db_host`

Valid parameter names: `host`, `port`, `service_port`, `db_host`, `db_port`, `name`, `user`, `pass`.

To update a config value in the hub:
```bash
# Via JSON-RPC call to the hub
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{"method":"updateconfig","params":{"coin":"bitcoin","network":"mainnet","module":"decoder","paramName":"host","paramValue":"xchain-node-bitcoin-mainnet-xchain-decoder"}}'
```

The explorer polls the hub every 60 seconds and applies config changes without a restart.

---

## Common Parameters

### Coin Node Connection

All services that communicate with a coin node (decoder, encoder, UTXO tracker) need:

| Variable | Description | Example |
|---|---|---|
| `NETWORK` | Chain + network identifier | `bitcoin-mainnet`, `litecoin-regtest`, `dogecoin-testnet` |
| `NODE_URL` | Coin node RPC hostname | `xchain-node-bitcoin-mainnet-node` |
| `NODE_PORT` | Coin node RPC port | `8332` (BTC mainnet) |
| `NODE_USER` | RPC username | `rpc` |
| `NODE_PASSWORD` | RPC password | (set per deployment) |

For Dogecoin, also set:
```
AUX_POW=1
```
This enables AuxPoW header stripping in the block parser.

### MariaDB Connection

Decoder and indexer both connect to MariaDB. The decoder writes to the Decoder DB; the indexer reads from it and writes to the Indexer DB.

| Variable | Description |
|---|---|
| `DECODER_DB_HOST` | Hostname of the MariaDB container |
| `DECODER_DB_PORT` | MariaDB port (default `3306`) |
| `DECODER_DB_NAME` | Decoder database name, e.g. `XChain_BTC_Mainnet_Decoder` |
| `DECODER_DB_USER` | Database username |
| `DECODER_DB_PASS` | Database password |
| `INDEXER_DB_HOST` | (Indexer only) Hostname of the MariaDB container |
| `INDEXER_DB_PORT` | (Indexer only) MariaDB port |
| `INDEXER_DB_NAME` | (Indexer only) Indexer database name, e.g. `XChain_BTC_Mainnet_Indexer` |
| `INDEXER_DB_USER` | (Indexer only) Database username |
| `INDEXER_DB_PASS` | (Indexer only) Database password |

Databases are named following the convention `XChain_{CHAIN}_{NETWORK}_{COMPONENT}`:
- Chains: `BTC`, `LTC`, `DOGE`
- Networks: `Mainnet`, `Testnet`, `Regtest`
- Components: `Decoder`, `Indexer`

### Service Ports

| Service | Default port variable | Default value |
|---|---|---|
| xchain-hub | `HUB_PORT` | `10000` |
| xchain-explorer (HTTP) | `EXPLORER_API_PORT_HTTP` | `18080` |
| xchain-explorer (HTTPS) | `EXPLORER_API_PORT_HTTPS` | `18081` |
| xchain-decoder | `DECODER_API_PORT` | `3000` |
| xchain-indexer | `INDEXER_API_PORT` | `3000` |
| xchain-encoder | `ENCODER_API_PORT` | `3000` |
| xchain-utxo-tracker | `UTXO_TRACKER_API_PORT` | `3000` |

Since each service runs in its own container with its own network namespace, multiple services can use port 3000 internally without conflict.

---

## Service-Specific Configuration

### Decoder

| Variable | Description | Default |
|---|---|---|
| `NETWORK` | Chain + network string | Required |
| `NODE_URL` / `NODE_PORT` / `NODE_USER` / `NODE_PASSWORD` | Coin node connection | Required |
| `DECODER_DB_*` | MariaDB connection | Required |
| `DECODER_API_PORT` | JSON-RPC API port | `3000` |
| `AUX_POW` | Set truthy for Dogecoin AuxPoW | unset |

The decoder polls for new blocks every ~5 seconds. It waits for the coin node to report `verificationprogress >= 0.99` before processing. Mempool is refreshed every 60 seconds once synced.

### Indexer

| Variable | Description |
|---|---|
| `DECODER_DB_*` | Source (read-only) Decoder DB |
| `INDEXER_DB_*` | Target (write) Indexer DB |
| `INDEXER_API_PORT` | JSON-RPC API port |
| `INDEXER_COIN` | `BTC`, `LTC`, or `DOGE` |
| `INDEXER_NETWORK` | `mainnet`, `testnet`, or `regtest` |

The indexer has a watchdog timeout (default 5 minutes). If a single block takes longer than this to process, the process exits and Docker restarts it. The watchdog is a safety net for stuck processing — not expected under normal operation.

Coin-specific configuration (gas fees, GAS address, protocol activation blocks) lives in `/XChainIndexer/src/configs/<COIN>.js` inside the container. These values are baked into the image and cannot be changed via environment variables.

### Explorer

| Variable | Description |
|---|---|
| `HUB_API_HOST` / `HUB_PORT` | Hub connection for config discovery |
| `EXPLORER_API_PORT_HTTP` | HTTP port |
| `EXPLORER_API_PORT_HTTPS` | HTTPS port |
| `INDEXER_DB_*` | Direct DB credentials (fallback if no hub) |

SSL/TLS certificates are loaded from `src/ssl/` inside the container. To use HTTPS, place `cert.pem` and `key.pem` in that directory before building the image, or mount them as a Docker volume.

CORS origins and other advanced settings may be configured through the hub or a local `config.json`.

### Hub

| Variable | Description | Default |
|---|---|---|
| `HUB_HOST` | Host to bind the Express server | `0.0.0.0` |
| `HUB_PORT` | JSON-RPC API port | `10000` |

The hub's LevelDB database is stored at `/data/xchain-hub` inside the container. Mount a Docker volume at `/data/` to persist data across container restarts.

### UTXO Tracker

| Variable | Description |
|---|---|
| `NETWORK` | Chain + network string |
| `NODE_URL` / `NODE_PORT` / `NODE_USER` / `NODE_PASSWORD` | Coin node connection |
| `UTXO_TRACKER_API_PORT` | API port |
| `AUX_POW` | Set truthy for Dogecoin |

The tracker processes blocks in batches of 100. LevelDB data is stored at `/data/xchain-utxo-tracker/`. Bootstrap archives are stored at `/bootstrap/xchain-utxo-tracker/`.

### Encoder

| Variable | Description |
|---|---|
| `NETWORK` | Chain + network string |
| `NODE_URL` / `NODE_PORT` / `NODE_USER` / `NODE_PASSWORD` | Coin node connection |
| `DUST_AMOUNT` | Minimum output value in satoshis |
| `UTXO_TRACKER_URL` / `UTXO_TRACKER_API_PORT` | Optional external UTXO service |
| `ENCODER_API_PORT` | JSON-RPC API port |

---

## Regtest vs. Testnet vs. Mainnet

The `NETWORK` variable controls coin-specific parsing (address prefixes, network magic bytes). Valid values follow the pattern `{chain}-{network}`:

- `bitcoin-mainnet`, `bitcoin-testnet`, `bitcoin-regtest`
- `litecoin-mainnet`, `litecoin-testnet`, `litecoin-regtest`
- `dogecoin-mainnet`, `dogecoin-testnet`, `dogecoin-regtest`

The indexer's `INDEXER_COIN` and `INDEXER_NETWORK` variables are separate: `INDEXER_COIN=BTC` and `INDEXER_NETWORK=mainnet` (not combined).

Coin nodes listen on different RPC ports per network. Standard defaults:

| Chain | Mainnet RPC port | Testnet RPC port | Regtest RPC port |
|---|---|---|---|
| Bitcoin | 8332 | 18332 | 18443 |
| Litecoin | 9332 | 19332 | 19443 |
| Dogecoin | 22555 | 44555 | 18443 |
