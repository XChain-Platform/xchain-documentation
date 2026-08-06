<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Indexer: Configuration Reference

## Environment Variables

Configuration is loaded from a `.env` file and environment variables. Copy the `.env.example` file and configure before running.

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `DECODER_DB_HOST` | Decoder database hostname | `127.0.0.1` |
| `DECODER_DB_PORT` | Decoder database port | `3306` |
| `DECODER_DB_NAME` | Decoder database name | `XChain_BTC_Mainnet_Decoder` |
| `DECODER_DB_USER` | Decoder database username | `xchain` |
| `DECODER_DB_PASS` | Decoder database password | `secretpassword` |
| `INDEXER_DB_HOST` | Indexer database hostname | `127.0.0.1` |
| `INDEXER_DB_PORT` | Indexer database port | `3306` |
| `INDEXER_DB_NAME` | Indexer database name | `XChain_BTC_Mainnet_Indexer` |
| `INDEXER_DB_USER` | Indexer database username | `xchain` |
| `INDEXER_DB_PASS` | Indexer database password | `secretpassword` |
| `INDEXER_COIN` | Blockchain to index | `BTC`, `LTC`, or `DOGE` |
| `INDEXER_NETWORK` | Network to index | `mainnet`, `testnet`, or `regtest` |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `INDEXER_API_PORT` | API server listening port | `3004` |
| `CORS_ORIGIN` | Allowed CORS origin for API requests | `http://localhost` |
| `INDEXER_RATE_LIMIT_RPM` | API requests per minute per IP | `600` |
| `HUB_API_URL` | Hub JSON-RPC base URL used by the indexer's hub client. Falls back to the URL passed in code when unset. | _(unset)_ |
| `HUB_API_KEY` | API key sent with hub calls. Required whenever the hub runs keyed, which is always in validator mode. Treat as a credential. | _(unset)_ |
| `HUB_REORG_API_KEY` | Separate key for the hub's retraction rails (`pushpricereorg`, `pushxcallreorg`, `pushdexreorg`) when the hub gates them independently. Unset falls back to `HUB_API_KEY`, which is the legacy single-key behaviour. Treat as a credential. | _(falls back to `HUB_API_KEY`)_ |
| `INDEXER_ALLOW_UNAUTHENTICATED` | Set to `true` to restore keyless pass-through on the gated methods (validator-reward writes, federation reads, gated exec). With no API key configured those methods otherwise fail closed. This is the explicit escape hatch for single-host and regtest nodes; do not set it on a node reachable beyond its own host. | _(unset, fails closed)_ |
| `UTXO_TRACKER_URL` | UTXO-tracker hostname. Optional overall, but required for the DISPENSER fresh-address check. | _(unset)_ |
| `UTXO_TRACKER_API_PORT` | UTXO-tracker port, paired with `UTXO_TRACKER_URL`. | _(unset)_ |
| `BTC_INDEXER_DB_NAME` | Name of the BTC indexer database, read by `recovery.js` when rebuilding state from an anchored checkpoint on a non-BTC chain that needs to resolve BTC-anchored data. | _(unset)_ |
| `DB_CONNECT_TIMEOUT` | MariaDB connection timeout in milliseconds | `10000` |
| `DB_ACQUIRE_TIMEOUT` | Time to wait for a free pooled connection, in milliseconds | `10000` |
| `DB_QUERY_TIMEOUT` | MariaDB query execution timeout in milliseconds | `30000` |
| `MIGRATION_STRICT_CHECKSUM` | Set to `1` to make a schema-checksum mismatch fail closed at startup instead of logging and continuing. Off by default so a diverged schema does not cause a surprise fleet-wide boot failure; the operator path (`node src/migrate.js`) fails closed regardless. | _(unset, non-fatal)_ |

### Migration compatibility harness

`bin/check-migration-old-code-compat.js` is a standalone maintenance harness (run through `bin/check-migration-old-code-compat.sh`) that checks an older code ref against a migrated database schema. It reads its own environment, separate from the service configuration above:

| Variable | Description | Default |
|---|---|---|
| `OLD_REF` | Git ref of the older indexer code to check the migrated schema against | _(required)_ |
| `DB_NAME` | Database the compatibility checks run against | _(required)_ |
| `DB_HOST` | MariaDB host for that database | _(required)_ |
| `DB_PORT` | MariaDB port | _(unset)_ |
| `DB_USER` | MariaDB user | _(unset)_ |
| `DB_PASS` | MariaDB password. Treat as a credential; pass it through the environment, never on a command line. | _(unset)_ |
| `REPO` | Path to the indexer checkout whose git history holds `OLD_REF` | _(the repo containing the script)_ |

### Block-processing barriers and health

| Variable | Description | Default |
|---|---|---|
| `HUB_PRICE_SYNC_TIMEOUT_MS` | Price-sync barrier timeout. Before processing a block the indexer waits for its local price mirror to reach that block height, so native-coin fee validation is deterministic across operators. On timeout the block is deferred and retried rather than validated against a stale price copy. | `60000` |
| `INDEXER_HEALTH_STALL_GRACE_MS` | How long with no committed block before the container reports unhealthy (`503`). Defaults to comfortably more than one barrier cycle so a single legitimate defer never flaps the healthcheck. Operational only, **not** a consensus parameter. | `max(2 × HUB_PRICE_SYNC_TIMEOUT_MS, 120000)` |
| `XCALL_DIRECT_PRESENCE_TIMEOUT_MS` | Call-presence barrier timeout in direct-hub-DB mode. With no HubDbSync mirror the cross-chain-call sync barrier is skipped, but reading the hub's MariaDB directly does not guarantee an in-flight relay row has landed, so the indexer waits this long for it before the cross-chain-call pass. | `10000` |
| `CHAIN_TIP_PUSH_MAX_LAG` | Skip pushing the chain tip to the hub while the indexer is more than this many blocks behind the decoder tip. During a bulk re-index, pushing a tip per historical block floods the hub's rate limiter with `429`s for no value: the hub only cares about the live tip. | `100` |

### Hub push queue and mirror

| Variable | Description | Default |
|---|---|---|
| `HUB_CONFIG_POLL_INTERVAL_MS` | Interval between hub config refresh polls | `60000` |
| `HUB_DB_SYNC_POLL_INTERVAL` | Interval between hub-mirror table sync polls (used when `HUB_DB_SYNC_ENABLED=true`) | `30000` |
| `HUB_SYNC_WATERMARK_INTERVAL_MS` | Interval at which the hub-mirror sync persists its progress watermark | `10000` |
| `HUB_PUSH_RETRY_INTERVAL_MS` | How often the push-queue poller wakes to drain due rows | `30000` |
| `HUB_PUSH_RETRY_BASE_MS` | Base backoff for a failed push. The wait grows as `base × 2^(attempts-1)`, capped at `HUB_PUSH_RETRY_MAX_MS`. | `30000` |
| `HUB_PUSH_RETRY_MAX_MS` | Backoff ceiling for push retries | `600000` (10 min) |
| `HUB_PUSH_MAX_ATTEMPTS` | Attempts before a push row is abandoned (about 30 minutes at the default backoff) | `10` |
| `HUB_PUSH_FAILED_RETENTION_SECONDS` | How long an abandoned push row is kept before the sweep drops it. Without the sweep a long hub outage grows the queue table with no ceiling. Set to `0` to keep terminal rows forever. | `604800` (7 days) |
| `HUB_PUSH_PRUNE_INTERVAL_MS` | How often the queue prunes abandoned rows older than the retention window | `3600000` (1 hour) |

### Fee quote and pre-flight

| Variable | Description | Default |
|---|---|---|
| `INDEXER_FEEQUOTE_MAX_PENDING` | Maximum concurrent in-flight `feequote` evaluations before new ones are rejected | `8` |
| `INDEXER_FEEQUOTE_TIMEOUT_MS` | Per-request timeout for a `feequote` evaluation | `10000` |
| `INDEXER_PREFLIGHT_MEMO_MAX` | Maximum memo length accepted by the read-only `preflight` endpoint | `256` |

### State-tree metrics

| Variable | Description | Default |
|---|---|---|
| `STATE_TREE_METRIC_INTERVAL_MS` | Interval for the state-tree orphan-statistics sweep. Set `0` to disable. | `14400000` (4 h) |
| `STATE_TREE_METRIC_MAX_NODES` | Node ceiling for a single metric pass, bounding the sweep's cost on a large tree | `2000000` |
| `INDEXER_SMT_TOUCH_AUDIT` | Set to `1` to audit, per block, the set of keys the state-commitment pass actually touched against the set the ledger rows say it should have, reporting the difference in both directions with the exact keys. That evidence cannot be recovered once the block is committed, which is why it is a flag rather than a post-hoc probe. Diagnostic only; off in normal operation. | _(unset, audit off)_ |
| `INDEXER_TOUCH_GUARD` | Behaviour when the balances touched-set guard fails, meaning the ledger moved keys the commitment did not apply and `balances_root` would be committed incomplete . The default throws and stops the block. Set to `warn` to log and commit anyway; the node then **diverges from any node that full-rebuilds**, so this is a deliberate, temporary escape hatch rather than an operational setting. | _(unset, fails closed)_ |

### Genesis

Genesis is pinned per network in the coin registry and the bundled dumps ship inside the Docker image, so a stock install needs none of these. They exist for regenerating or relocating the genesis inputs, and for drilling the genesis path on regtest. See [XCHAIN Genesis](../../operations/xchain-genesis.md).

| Variable | Description | Default |
|---|---|---|
| `GENESIS_LEDGER_PATH` | Path to the canonical genesis ledger CSV | `data/genesis/<coin>-ledger.csv` |
| `GENESIS_DUMP_PATH` | Path to the pre-derived genesis state dump. When present, the dump-import path runs and is verified against `XCHAIN_GENESIS_DUMP_HASH` (sha256 of the *uncompressed* content) plus a recheck of the genesis block hashes; absent, the canonical CSV derivation runs instead. | `data/genesis/<coin>-<network>-genesis-dump.ndjson.gz` |
| `GENESIS_BLOCK_TIMEOUT_MS` | Watchdog for the genesis block on the CSV-derivation path, which is the slow one | `14400000` (4 h) |
| `GENESIS_DUMP_TIMEOUT_MS` | Watchdog for the genesis block on the dump-import path. Kept tight (BTC measures around 15 s) so a wedged import is caught fast. | `600000` (10 min) |
| `GENESIS_AIRDROP_PATHS` | Comma-separated airdrop snapshot files to replay at genesis | _(none)_ |
| `GENESIS_AIRDROP_HASHES` | Comma-separated sha256 digests pinning each `GENESIS_AIRDROP_PATHS` entry | _(none)_ |
| `GENESIS_AIRDROP_AMOUNTS` | Comma-separated per-file airdrop amounts | _(none)_ |
| `GENESIS_AIRDROP_SNAPSHOT_BLOCK` | Block height the airdrop snapshot was taken at | _(none)_ |
| `CROSS_CHAIN_ROYALTY_REGTEST_TIME` | **Regtest only.** Override the cross-chain royalty activation time so the OFF/deny path stays drillable on a single-node stack. Deliberately regtest-scoped: two nodes with different values would disagree on consensus. | `0` (activate at genesis) |

## Hub DB Price Source

Native-coin fee validation and FIAT settlement read the oracle tables (`price_snapshots`,
`oracle_prices`) from the hub. There are two valid topologies:

- **Distributed (production default):** the indexer runs on a different host from the hub. Set
  `HUB_DB_HOST` / `HUB_DB_NAME` (plus `HUB_DB_PORT` / `HUB_DB_USER` / `HUB_DB_PASS`) so price reads
  hit the hub's data, optionally mirrored locally via `HUB_DB_SYNC_ENABLED=true`.
- **Single-host:** the indexer's own database already holds the synced hub copy, so no separate hub DB
  connection is needed and the oracle tables are read locally.

The two are indistinguishable from config alone: a node with no hub DB looks the same whether that is
intentional (single-host) or an operator forgot `HUB_DB_HOST` / `HUB_DB_NAME` on a distributed node. In
the latter case the indexer would silently value native-coin fees against stale or empty local price
data, which on mainnet can diverge from the canonical fleet and fork the ledger.

To make the intent explicit, a **mainnet** indexer fails closed at startup when no hub DB is configured,
unless `INDEXER_ALLOW_LOCAL_PRICE_SOURCE=true` is set to confirm an intentional single-host node. On
testnet and regtest, single-host is the norm and there is no canonical fleet to diverge from, so the
missing hub DB only logs a warning.

| Variable | Description | Default |
|---|---|---|
| `INDEXER_ALLOW_LOCAL_PRICE_SOURCE` | Acknowledge an intentional single-host setup (read oracle tables from the local indexer DB). Required to boot a **mainnet** node that has no `HUB_DB_HOST` / `HUB_DB_NAME`; ignored on testnet/regtest. | unset (mainnet fails closed) |

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
| `ADDRESS.FEE_DESTINATION` | Native-coin fee collection address (per network), pinned in the bundled coin registry. Overridable at runtime via the `XCHAIN_FEE_DESTINATION_<COIN>_<NETWORK>` env var (e.g. `XCHAIN_FEE_DESTINATION_BTC_REGTEST`) on testnet/regtest only; a mainnet override is ignored with a warning, because fee acceptance is consensus and must not depend on operator environment. | _(coin registry)_ |
| `ADDRESS.REWARD` | Validator reward pool: pre-funded, manually topped up, drained by `COLLECT` (**BTC only**; XCHAIN/COLLECT do not exist on LTC/DOGE, where the slot is unused) | _(set pre-launch)_ |

## Unified Gas Fee Schedule

After the activation block, fees for VM and staking actions are calculated using a gas-based schedule rather than the legacy flat fee constants. The following parameters are defined in each coin config file (`src/configs/<COIN>.js`) and are only applied to blocks at or after the activation height:

| Parameter | Description | Example (BTC) |
|---|---|---|
| `GAS_PRICE` | Base XCHAIN cost per unit of gas | `0.00001` |
| `GAS_SCHEDULE` | Object mapping action types to their gas cost in gas units | `{ DEPLOY: 100000, EXECUTE: 10000, STAKE: 5000, ... }` |
| `UNIFIED_EXPIRATION_FEE_FREE_DAYS` | Free listing duration under the unified schedule (replaces `EXPIRATION_FEE_FREE_DAYS` post-activation) | `365` |
| `FEE_PAYMENT_MODE` | Reserved key indicating intended fee denomination per chain (`'xchain'` on BTC, `'native'` on LTC/DOGE). **Not currently read at runtime**: see note below. | `'xchain'` (BTC) |

> **Note on `FEE_PAYMENT_MODE`:** This key is currently informational only and is **not** read by the fee-processing code. Fee payment mode is detected implicitly at runtime by `detectFeePaymentMode()` in `src/utility.js`, which derives the mode from the transaction itself: if a native-coin fee output to the configured fee destination is present it returns `'native'`; if absent it returns `'xchain'` on BTC (XCHAIN balance deduction is allowed as a fallback) and `'rejected'` on LTC/DOGE (native coin is the only accepted fee on those chains). The `FEE_PAYMENT_MODE` config value is reserved for a future change that makes this detection explicit/config-driven; until then its value must mirror the implicit per-chain behavior to avoid surprising a later refactor.

The legacy flat fee constants (`ISSUANCE_FEE_TOKEN`, `ISSUANCE_FEE_SUBTOKEN`, `EXPIRATION_FEE_PER_DAY`, `EXPIRATION_FEE_FREE_DAYS`) remain in the coin config files and continue to apply for blocks **before** the activation height.

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
| `MESSAGE_ENCRYPTION_METHODS` | `[1, 2, 3]` | 1 = ECIES, 2 = ECDH, 3 = AES |
| `SLEEP_IMMEDIATE_METHODS` | `[-1, 0]` | -1 = sleep indefinitely, 0 = resume immediately |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
