# Docker

All XChain services run as Docker containers managed by the xchain-node CLI. This document covers container naming, networking, volume management, and common Docker operations.

---

## Container Naming Convention

Containers follow a predictable naming scheme based on the service, coin, and network:

**Coin-specific services:**
```
xchain-node-<coin>-<network>-<service>
```
Examples:
- `xchain-node-bitcoin-mainnet-xchain-decoder`
- `xchain-node-litecoin-regtest-xchain-indexer`
- `xchain-node-dogecoin-mainnet-xchain-utxo-tracker`

**Shared services (no coin/network scope):**
```
xchain-node-<service>
```
Examples:
- `xchain-node-xchain-hub`
- `xchain-node-xchain-explorer`
- `xchain-node-database`

This naming is consistent across `docker ps`, `docker logs`, and the xchain-node CLI.

---

## Docker Networks

Each coin+network stack gets its own Docker network for service isolation:

```
xchain-node-<coin>-<network>
```

Examples:
- `xchain-node-bitcoin-mainnet`
- `xchain-node-litecoin-regtest`

A base network named `xchain-node` connects the shared services (hub, explorer, MariaDB).

Containers on the same Docker network can reach each other by container name. For example, the decoder container can reach the MariaDB container at the hostname `xchain-node-database`.

**Creating the network manually (if needed):**
```bash
docker network create xchain_network
```

xchain-node creates networks automatically during install, but this may be needed when running explorer via Docker Compose directly.

---

## Environment Variables

Configuration is passed to each container as environment variables. These are set by xchain-node during `install` based on:

1. Hardcoded defaults in `xchain-node/src/index.js`
2. Per-chain overrides in `xchain-node/config/<coin>-<network>` files

Key variables passed to most services:

| Variable | Description |
|---|---|
| `NETWORK` | Network identifier, e.g. `bitcoin-mainnet` |
| `NODE_URL` | Coin node RPC host (container name for DNS resolution) |
| `NODE_PORT` | Coin node RPC port |
| `NODE_USER` / `NODE_PASSWORD` | Coin node RPC credentials |
| `DECODER_DB_HOST` / `INDEXER_DB_HOST` | MariaDB container hostname |
| `DECODER_DB_PORT` / `INDEXER_DB_PORT` | MariaDB port (default 3306) |
| `DECODER_DB_NAME` / `INDEXER_DB_NAME` | Database name, e.g. `XChain_BTC_Mainnet_Decoder` |
| `DECODER_DB_USER` / `INDEXER_DB_USER` | Database username |
| `DECODER_DB_PASS` / `INDEXER_DB_PASS` | Database password |
| `HUB_API_HOST` / `HUB_PORT` | Hub container hostname and port |

See [Configuration](./CONFIGURATION.md) for the full per-service variable reference.

---

## Volume Management

### Blockchain Data

Coin nodes store blockchain data in Docker volumes. Volume names follow the container naming convention. Data persists across container restarts and updates.

To list all Docker volumes used by XChain services:
```bash
docker volume ls | grep xchain
```

### LevelDB Data

The UTXO tracker and hub use LevelDB stored in Docker volumes:
- UTXO tracker: `/data/xchain-utxo-tracker/` inside the container
- Hub: `/data/xchain-hub` inside the container

### MariaDB Data

MariaDB data is stored in its own Docker volume. All decoder and indexer databases for all chains share the single MariaDB container.

### Bootstrap Archives

The UTXO tracker supports bootstrap snapshots stored at `/bootstrap/xchain-utxo-tracker/` inside the container. xchain-node manages downloading and restoring these via:
```bash
xchain-node bootstrap restore xchain-utxo-tracker bitcoin mainnet
xchain-node bootstrap create xchain-utxo-tracker bitcoin mainnet
```

---

## Viewing Container Logs

Using xchain-node (recommended):
```bash
xchain-node logs xchain-decoder bitcoin mainnet
xchain-node tail xchain-decoder bitcoin mainnet
```

Using Docker directly:
```bash
docker logs xchain-node-bitcoin-mainnet-xchain-decoder
docker logs -f xchain-node-bitcoin-mainnet-xchain-decoder
docker logs --tail 100 xchain-node-bitcoin-mainnet-xchain-decoder
```

For all services at once via the interactive monitor:
```bash
xchain-node monitor
xchain-node -i     # full interactive TUI mode
```

---

## Entering Containers for Debugging

Open a shell inside a running container:
```bash
xchain-node shell xchain-decoder bitcoin mainnet
# or directly:
docker exec -it xchain-node-bitcoin-mainnet-xchain-decoder /bin/bash
```

Run a one-off command:
```bash
xchain-node exec xchain-decoder bitcoin mainnet "node --version"
docker exec xchain-node-bitcoin-mainnet-xchain-decoder node --version
```

---

## Restarting Containers

Via xchain-node:
```bash
xchain-node restart xchain-decoder bitcoin mainnet
xchain-node restart all bitcoin mainnet
```

Via Docker directly:
```bash
docker restart xchain-node-bitcoin-mainnet-xchain-decoder
```

A restart does not wipe data. Services resume from their last processed state.

---

## Updating Containers

xchain-node handles updates by pulling the latest source for the specified branch, rebuilding the Docker image, and replacing the running container:

```bash
xchain-node update xchain-decoder bitcoin mainnet
xchain-node update all bitcoin mainnet
```

The hub is updated automatically as part of every `preCheck()` call. For explicit hub updates:
```bash
xchain-node update xchain-hub
```

See [Upgrading](./UPGRADING.md) for safe upgrade procedures including database migrations.

---

## Docker Resource Recommendations

| Deployment | RAM | CPU |
|---|---|---|
| Single-chain regtest | 2 GB | 2 cores |
| Single-chain mainnet | 8 GB | 4 cores |
| Three-chain mainnet | 32 GB | 8 cores |

MariaDB benefits significantly from RAM (buffer pool size). If the MariaDB container is consuming excessive RAM, tune `innodb_buffer_pool_size` in the MariaDB configuration.

---

## Backup Strategies

### MariaDB

Dump all XChain databases with `mysqldump`:
```bash
docker exec xchain-node-database mysqldump -u root \
  --databases XChain_BTC_Mainnet_Decoder XChain_BTC_Mainnet_Indexer \
  > xchain-backup-$(date +%Y%m%d).sql
```

### LevelDB Volumes

Use the built-in bootstrap mechanism to create compressed snapshots:
```bash
xchain-node bootstrap create xchain-utxo-tracker bitcoin mainnet
```

For the hub, stop the hub container and copy the volume data directly:
```bash
xchain-node stop xchain-hub
docker run --rm -v xchain-node-xchain-hub_data:/data \
  -v $(pwd):/backup busybox tar czf /backup/hub-backup.tar.gz /data
xchain-node start xchain-hub
```

### Blockchain Data

Coin node blockchain data can be backed up by stopping the node and copying its Docker volume. However, for mainnet Bitcoin this is rarely practical — it is faster to resync from scratch than to copy hundreds of gigabytes.
