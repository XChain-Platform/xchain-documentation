<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Troubleshooting

This document covers common problems, their symptoms, and how to diagnose and resolve them.

---

## Decoder Issues

### Decoder Not Finding Blocks

**Symptom:** Decoder logs show it is waiting for the coin node to sync, or no block processing activity for an extended period.

**Diagnosis:**
1. Check if the coin node is still syncing:
   ```bash
   docker exec xchain-node-bitcoin-mainnet-node bitcoin-cli -mainnet getblockchaininfo | grep verificationprogress
   ```
   The decoder waits until `verificationprogress >= 0.99` before processing. For a new mainnet node, this can take days.

2. Check the coin node RPC is reachable from the decoder container:
   ```bash
   xchain-node shell xchain-decoder bitcoin mainnet
   curl -u rpc:rpc http://xchain-node-bitcoin-mainnet-node:8332 \
     -d '{"method":"getblockchaininfo","params":[]}'
   ```

3. Verify the `NODE_URL`, `NODE_PORT`, `NODE_USER`, `NODE_PASSWORD` environment variables are correct.

**Fix:** Wait for the coin node to finish syncing. If the RPC connection is broken, check that the coin node container is running and the Docker network is intact.

### Decoder Stuck at a Block

**Symptom:** Decoder block height stops incrementing. Logs may show repeated error messages or silence.

**Diagnosis:**
1. Check decoder logs for errors:
   ```bash
   xchain-node tail xchain-decoder bitcoin mainnet
   ```
2. Look for parse errors, RPC timeouts, or database connection errors.
3. Check if MariaDB is accessible from the decoder container.

**Litecoin-specific:** The decoder includes special handling for Litecoin HogEx transactions (stripping the `0x08` flag). If a new type of malformed block appears, the decoder may fail to parse it. Check logs for `bitcoinjs-lib` parse exceptions.

**Dogecoin-specific:** AuxPoW stripping must be enabled (`AUX_POW=1`). If this variable is missing, block parsing will fail on every Dogecoin block.

**Fix:** For transient failures, restarting the decoder usually resolves the issue. If the error recurs on the same block, file a bug report with the block hash and error message.

### Mempool Tracking Issues

**Symptom:** Mempool transactions are not appearing or are stale.

**Note:** Mempool is only refreshed when the decoder is fully synced with the coin node. Mempool data is best-effort and may lag by up to 60 seconds. This is expected behavior, not a bug.

---

## Indexer Issues

### Indexer Not Processing Blocks

**Symptom:** Indexer block height is not advancing even though the decoder is progressing.

**Diagnosis:**
1. Check that the decoder DB is accessible from the indexer:
   ```bash
   xchain-node shell xchain-indexer bitcoin mainnet
   mysql -h $DECODER_DB_HOST -u $DECODER_DB_USER -p$DECODER_DB_PASS $DECODER_DB_NAME \
     -e "SELECT MAX(block_index) FROM blocks;"
   ```
2. Check indexer logs for errors:
   ```bash
   xchain-node tail xchain-indexer bitcoin mainnet
   ```
3. Look for connection errors, authentication failures, or database name mismatches.

**Fix:** Verify `DECODER_DB_*` environment variables point to the correct host and database. Ensure the MariaDB container is running.

### Sanity Check Failure

**Symptom:** Log line containing `SANITY CHECK FAILED`. The indexer halts processing.

**What it means:** The indexer's internal balance validation detected an inconsistency after processing a block. This indicates a bug in the indexer code, not a configuration problem.

**Immediate actions:**
1. Record the block number where the failure occurred (it will be in the log message).
2. File a bug report with the block number, chain, network, and the full log output around the failure.
3. Do not attempt to continue processing, doing so risks propagating corrupt state.

**Temporary workaround (use with caution):** If you must continue processing while a fix is being developed, you may need to re-index from a known-good block. This involves stopping the indexer, clearing the Indexer DB, and letting it rebuild from the decoder DB. Contact the XChain development team before attempting this.

### Watchdog Timeout

**Symptom:** Log line `WATCHDOG TIMEOUT`. Docker restarts the container automatically.

**What it means:** A single block took longer than 5 minutes to process. Docker will restart the indexer, which will resume from the next unprocessed block.

**Causes:**
- The block contained an unusually large number of XChain transactions.
- The host is under-resourced (high CPU load, memory pressure causing swap).
- A slow MariaDB query is blocking block processing.

**Fix:** Occasional watchdog timeouts are acceptable. If they occur frequently, check host resource utilization. Increasing host RAM or CPU capacity usually resolves persistent watchdog timeouts.

### Block Processing Errors

**Symptom:** An ACTION in a specific block is causing an exception rather than being recorded as invalid.

**Note:** The indexer is designed so that invalid ACTION data is silently ignored rather than crashing. If the indexer throws an uncaught exception, this is a bug. Record the block number and transaction ID from the log and file a bug report.

---

## Explorer Issues

### Explorer Returning Empty Data

**Symptom:** API responses return empty arrays or zero record counts even though the chain has data.

**Diagnosis:**
1. Check that the indexer is synced. The explorer reads from the Indexer DB, if the indexer is behind, the explorer will reflect that.
2. Verify the explorer is connected to the correct Indexer DB.
3. Check explorer logs for database connection errors.

**Fix:** Wait for the indexer to catch up, or correct the database configuration if the explorer is pointed at the wrong database.

### Explorer Returns 503 `COIN_DATA_STALE`

**Symptom:** every read for one coin fails with `503` and `{"code": "COIN_DATA_STALE"}`, WebSocket subscribes answer with the same code, and `/{COIN}/api/status` reports `stale: true` for it and leaves it out of `available`.

**Cause:** the newest indexed block for that coin is older than `EXPLORER_TIP_MAX_AGE_S` (default `21600`, six hours), so the explorer refuses to serve data it cannot vouch for as current. On production that means the chain, the decoder, or the indexer has stopped, or this replica has stopped replicating.

**Fix:** find what stopped and restart it. Verify with `/{COIN}/api/status`, which is exempt from the gate and reports `tip_age_seconds`.

**On dev and regtest stacks this is expected**, because blocks are mined on demand and an idle chain ages out. Mine a block to clear it, or disable the gate for that coin with `EXPLORER_TIP_MAX_AGE_S_<COIN>=0`. See [Regtest Development](../developer-guide/regtest-development.md#keeping-an-idle-chain-available).

### Slow API Responses

**Symptom:** Explorer API calls take multiple seconds to return.

**Likely causes:**
- The Indexer DB is large and queries are doing full table scans.
- MariaDB connection pool is exhausted.
- The host is under memory or I/O pressure.

**Fix:** Check MariaDB slow query logs. Ensure database indexes are present (the indexer creates them on startup via its SQL files). If connection pool exhaustion is the issue, reduce the number of concurrent requests or increase the pool size.

### SSL/TLS Configuration Issues

**Symptom:** HTTPS connections fail; browser reports certificate errors.

**Fix:** Ensure `cert.pem` and `key.pem` are present in `src/ssl/` inside the container, or mounted via a Docker volume. Check that the certificate covers the hostname being used. Note: the HTTP→HTTPS redirect in the explorer is disabled by default and must be enabled in the configuration if needed.

### CORS Errors

**Symptom:** Browser requests to the explorer API fail with CORS policy errors.

**Fix:** Configure allowed origins in the explorer's config (via hub or `config.json`). The explorer uses `helmet` and `cors` middleware, ensure the requesting origin is in the allowed list.

---

## Database Issues

### Connection Refused

**Symptom:** Services log `ECONNREFUSED` or `connect ECONNREFUSED` when trying to reach MariaDB.

**Diagnosis:**
1. Check the MariaDB container is running: `docker ps | grep database`
2. Check the container name and port match what the service expects.
3. Verify the service's `DB_HOST` env var resolves to the MariaDB container on the Docker network.

**Fix:** Start the MariaDB container if it is stopped. Verify Docker network membership; the service container and the database container must be on the same Docker network.

### Connection Pool Exhaustion

**Symptom:** Log messages about connection pool limits being reached; some requests start failing.

**Fix:** Check for runaway queries holding connections open. Restart the affected service to clear stale connections. If persistent, reduce the connection pool size or increase MariaDB's `max_connections`.

### Database Too Large

**Symptom:** Disk space warnings; MariaDB container becoming sluggish.

**Note:** XChain databases grow as the chain grows. The decoder's `mempool_transactions` table is cleaned periodically. The indexer tables grow proportionally to on-chain activity.

**Options:**
- Archive and delete old data from the decoder DB (only records prior to a safe cutoff that the indexer has fully processed).
- Extend disk capacity and mount a new volume.
- For the decoder DB, old `mempool_transactions` records can be safely pruned as they are no longer needed once confirmed.

---

## Docker Issues

### Container Won't Start

**Symptom:** Container exits immediately after starting, or fails to start at all.

**Diagnosis:**
```bash
docker logs xchain-node-bitcoin-mainnet-xchain-decoder
```

**Common causes:**  
- **Port conflict:** Another process is using the same port. Use `netstat -tlnp | grep <port>` to identify the conflict.  
- **Volume permission issues:** The container process cannot write to its data volume. Check volume ownership.  
- **Missing environment variables:** Required variables not set. Check startup logs for `undefined` or missing config values.

### Container Crashes (OOM)

**Symptom:** Container is killed and restarted repeatedly. Docker logs show `Killed` or OOM messages.

**Fix:** Increase Docker memory limits for the affected container, or reduce memory pressure on the host by stopping other services.

### Network Issues Between Containers

**Symptom:** Services cannot reach each other by container name.

**Diagnosis:**
```bash
docker network inspect xchain-node-bitcoin-mainnet
```
Verify both containers are listed as connected to the expected network.

**Fix:** If a container is not on the expected network, re-create it via `xchain-node restart`. If the Docker network itself is missing, run `xchain-node install` again; it will recreate the network.

---

## General

### Service Discovery Failures (Hub Connectivity)

**Symptom:** Explorer fails to load config from hub; logs show connection errors to `HUB_API_HOST`.

**Fix:** Ensure the hub container is running. Verify `HUB_API_HOST` and `HUB_PORT` are correct. The explorer falls back to `config.json` if the hub is unreachable.

### Out of Disk Space

**Symptom:** Services start failing with `ENOSPC` errors; Docker may fail to write logs.

**Immediate action:**
1. Stop non-essential services to free some disk I/O pressure.
2. Identify the largest consumers: `docker system df` and `du -sh /var/lib/docker/volumes/*`.
3. Remove unused Docker images: `docker image prune`.
4. If blockchain data is the culprit, extend the volume or mount additional storage.

**Prevention:** Set up disk usage alerts before reaching 80% capacity. Blockchain data growth is predictable, plan ahead.

### Resetting and Re-Indexing from Scratch

If a database becomes severely corrupted or you need a clean start:

1. Stop all affected services:
   ```bash
   xchain-node stop all bitcoin mainnet
   ```

2. Drop and recreate the affected databases:
   ```bash
   docker exec xchain-node-database mysql -u root \
     -e "DROP DATABASE XChain_BTC_Mainnet_Indexer; CREATE DATABASE XChain_BTC_Mainnet_Indexer;"
   ```

3. Start the services. The decoder and indexer will recreate their tables automatically from `src/sql/*.sql` and re-process all blocks from the decoder DB.

4. If the decoder DB also needs to be reset, drop the decoder database as well. The decoder will re-scan the entire blockchain from the coin node; a full re-sync.

For the UTXO tracker, delete its LevelDB volume and restart:
```bash
xchain-node stop xchain-utxo-tracker bitcoin mainnet
docker volume rm <utxo-tracker-volume-name>
xchain-node start xchain-utxo-tracker bitcoin mainnet
```

A full re-index from block 0 on mainnet Bitcoin can take several days. Use a bootstrap archive restore to shortcut this where possible.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
