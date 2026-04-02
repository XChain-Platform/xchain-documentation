<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Indexer — Operations

## Prerequisites

- Node.js >= 18
- MariaDB server (for both Decoder and Indexer databases)
- A running xchain-decoder instance (populating the Decoder database)

## Running the Indexer

```bash
npm run api
# or directly:
node ./src/api.js
```

On startup, the indexer:
1. Validates all required environment variables
2. Starts the Express JSON-RPC API server
3. Creates the Indexer database if it doesn't exist
4. Creates all required tables if they don't exist
5. Begins the block polling loop

## Docker

The indexer is designed to run inside Docker. The Dockerfile copies source to `/XChainIndexer/`. The coin config path is resolved relative to the source directory, so the indexer must either run inside the Docker container or have the source mounted at that path.

## Stopping

The indexer can be stopped gracefully by calling the `stop()` method on the XChainIndexer instance, which sets a flag that causes the main loop to exit after the current iteration completes. In Docker, send SIGTERM to allow the process to shut down cleanly.

## API

The indexer exposes a minimal JSON-RPC API on the configured `INDEXER_API_PORT`:

### `ping`

Health check endpoint.

**Request:**
```json
{
    "jsonrpc": "2.0",
    "method": "ping",
    "id": 1
}
```

**Response:**
```json
{
    "jsonrpc": "2.0",
    "result": { "status": "success" },
    "id": 1
}
```

The `reparse` and `rollback` methods are defined in the codebase but currently commented out (reserved for future use).

## Resilience and Recovery

### Database Connection Recovery

The `Database` class includes a circuit breaker pattern for connection management:

- **Closed** (normal): Connections proceed normally
- **Open** (failing): After 10 consecutive failures, the circuit opens and rejects connections for 30 seconds
- **Half-open** (testing): After the cooldown period, a single connection attempt is allowed; success closes the circuit, failure re-opens it

### Database Verification on Startup

On startup, the indexer retries database connections indefinitely with a 5-second delay between attempts. This allows the indexer to start before the database is fully available (common in Docker orchestration).

### Atomic Block Processing

Every block is processed within a single database transaction. If any error occurs during processing — validation failure, SQL error, timeout — the entire block is rolled back. The indexer then retries the block on the next polling cycle.

### Reorg Recovery

When a blockchain reorganization is detected:
1. The reorg block number is recorded in the events table
2. All data at or after the reorg block is deleted within a single transaction
3. Balances and token state are recalculated from the remaining ledger data
4. The sanity check verifies consistency after the rollback
5. Normal block processing resumes from the reorg point

## Troubleshooting

### Indexer won't start

**"Missing required environment variable: X"**
All variables listed in the [Configuration](CONFIGURATION.md) reference must be set. Check your `.env` file exists and contains all required keys.

**"Database XChain_..._Decoder doesn't exist!"**
The Decoder database must exist before the indexer can read from it. Ensure xchain-decoder has been started and has created its database.

**"Database XChain_..._Indexer tables don't exist!"**
The indexer creates tables automatically on first startup. If this error occurs, check that the database user has CREATE TABLE permissions.

### Indexer stalls or stops processing

**"Error while parsing block data"**
Check the error details in the console output. The block will be retried on the next polling cycle. Persistent failures on the same block indicate a bug in an action handler.

**Block processing timeout**
If a block consistently takes longer than `BLOCK_PROCESS_TIMEOUT` (default 5 minutes), it may contain an unusually large number of transactions. The timeout can be increased via the config, but investigate the root cause first.

### Data inconsistency

**Sanity check failures**
A sanity check failure means token supply does not match the sum of credits minus debits. This indicates a bug in the indexer's ledger logic. The affected block is rolled back automatically. Report the block number and error details.

### Connection issues

**"Database connection error"**
The indexer retries database connections automatically. If the error persists, verify the database server is running and the connection credentials are correct. The circuit breaker will pause connection attempts for 30 seconds after 10 consecutive failures.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
