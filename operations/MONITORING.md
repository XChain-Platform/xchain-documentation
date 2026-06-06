<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Monitoring

This document describes how to monitor a running XChain Platform node, what metrics to watch, and how to identify problems before they become outages.

---

## Real-Time Monitoring with xchain-node

The fastest way to get a live overview of all services is the xchain-node TUI:

```bash
xchain-node monitor                # multi-pane log monitor
xchain-node tailmonitor            # follow logs in one pane
xchain-node -i                     # full interactive TUI (blessed)
```

The interactive TUI shows live container output across all running services simultaneously, making it easy to spot errors or stalls.

---

## Key Metrics

### Pipeline Sync Lag

The most important health indicator is how far behind each service is.

| Check | What it means |
|---|---|
| Coin node block height vs. chain tip | How far behind the node is from the public chain |
| Decoder block height vs. coin node | How far behind decoding is from the node |
| Indexer block height vs. decoder | How far behind indexing is from decoding |

Under normal operation, the decoder and indexer should lag only seconds behind the coin node (they poll every 5 seconds). A gap of more than a few minutes is worth investigating.

**Check decoder block height:**
```bash
docker exec xchain-node-database mysql -u root \
  XChain_BTC_Mainnet_Decoder \
  -e "SELECT MAX(block_index) FROM blocks;"
```

**Check indexer block height:**
```bash
docker exec xchain-node-database mysql -u root \
  XChain_BTC_Mainnet_Indexer \
  -e "SELECT MAX(block_index) FROM sends LIMIT 1;"
```

### JSON-RPC Ping

Most services expose a `ping` method. A successful ping confirms the service is up and accepting requests.

```bash
# Decoder
curl -s -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"method":"ping","params":{}}' | jq

# Explorer
curl -s http://localhost:18080/btc/api/ping

# Hub
curl -s -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{"method":"ping","params":{}}'
```

### Docker Container Status

```bash
docker ps --filter name=xchain-node
xchain-node ps
```

All expected containers should show as `Up`. A container in `Restarting` or `Exited` state requires investigation.

---

## Common Warning Signs

### Decoder Falling Behind the Coin Node

**Symptom:** Decoder block height is significantly lower than the coin node's reported height.

**Likely causes:**
- Coin node is still syncing (expected on first run — the decoder deliberately waits for `verificationprogress >= 0.99`).
- Decoder is stuck processing a complex block or encountering a parse error.
- Coin node is overloaded and responding slowly to RPC requests.

**Action:** Check decoder logs for errors. Look for repeated retry messages or exception stack traces.

### Indexer Falling Behind the Decoder

**Symptom:** Indexer block height is significantly lower than decoder block height.

**Likely causes:**
- A block contains a large number of XChain transactions.
- Watchdog timeout is triggering and restarting the indexer.
- Database connection issues.
- A sanity check failure caused the indexer to halt.

**Action:** Check indexer logs for watchdog messages (`WATCHDOG TIMEOUT`) or sanity check failures (`SANITY CHECK FAILED`). A watchdog timeout is not necessarily a bug — it can occur on very full blocks. A sanity check failure is always a critical issue (see below).

### Sanity Check Failure

**Symptom:** Log line containing `SANITY CHECK FAILED` in the indexer.

**What it means:** After processing a block, the indexer verifies internal consistency of balances and state. A sanity check failure indicates a bug in the indexer's ACTION processing logic. The indexer halts processing to prevent corrupt state from spreading.

**Action:** This is a critical issue. File a bug report with the failing block number and transaction details. Do not attempt to skip or ignore sanity check failures. See [Troubleshooting](./TROUBLESHOOTING.md) for temporary workaround options.

### Database Connection Failures

**Symptom:** Services logging MariaDB connection errors or refusing to start.

**Action:** Verify the MariaDB container is running (`docker ps`), credentials are correct, and the service can resolve the database container hostname. The MariaDB connection layer includes retry logic with a circuit breaker — repeated failures will cause the service to back off.

### Watchdog Timeout

**Symptom:** Log line `WATCHDOG TIMEOUT` followed by process exit. Docker restarts the container automatically.

**What it means:** A single block took longer than 5 minutes to process. This is usually caused by a block with an unusual number of XChain transactions or a resource constraint on the host.

**Action:** Check host CPU and memory. If the host is under-resourced, the timeout may trigger regularly on busy blocks. Occasional timeouts are tolerable as Docker will restart the indexer and it will resume from the next unprocessed block.

---

## Log Monitoring

Patterns worth grepping for in logs:

| Pattern | Service | Meaning |
|---|---|---|
| `SANITY CHECK FAILED` | Indexer | Critical — processing halted |
| `WATCHDOG TIMEOUT` | Indexer | Block processing exceeded 5-minute limit |
| `reorg` (case-insensitive) | Decoder, Indexer, UTXO Tracker | Chain reorganization detected |
| `connection refused` | Any | Target service or database is down |
| `ECONNREFUSED` | Any | Network connectivity failure |
| `Error:` | Any | Application-level exception |

```bash
docker logs xchain-node-bitcoin-mainnet-xchain-indexer 2>&1 | grep -i "sanity\|watchdog\|reorg\|error"
```

---

## Reorg Events

Reorgs are typically automatic and self-healing. To check if a reorg occurred recently:

```bash
docker exec xchain-node-database mysql -u root \
  XChain_BTC_Mainnet_Decoder \
  -e "SELECT * FROM events ORDER BY id DESC LIMIT 5;"
```

The `events` table records each reorg with a JSON payload including the reorg block number. Occasional reorgs are expected. Frequent reorgs on the same chain (multiple per hour) may indicate a network partition or an issue with the coin node's peer connections.

---

## Disk Space

Blockchain data grows continuously. Monitor disk usage and set up alerts before the disk fills:

```bash
df -h /var/lib/docker
docker system df
```

The decoder and indexer MariaDB databases also grow over time as new transactions are indexed. Typical growth rate depends on on-chain activity for the given coin.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
