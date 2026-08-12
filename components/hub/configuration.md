<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-hub/CONFIGURATION.md (worktree) -->

# XChain Platform Hub: Configuration

## Environment Variables

### Silent-failure variables (read this first)

Two variables degrade security when left empty. The hub starts and appears
healthy either way, so the misconfiguration is easy to miss.

**`HUB_API_KEY`: empty disables API authentication.** When `HUB_API_KEY` is
set, authentication fails closed: mutating methods (`updateconfig`,
`registervalidator`, `propose`, `vote`, `requestattestation`, `reportreorg`,
`initiateswap`, the oracle/price push methods) and the hub-DB WebSocket
upgrade return 401 unless the caller presents the configured key.

When it is unset or empty, those paths are open, so the hub refuses to boot
unless keyless operation is declared with `HUB_ALLOW_UNAUTHENTICATED=true`.
Keyless remains supported (single-host regtest, a hub reachable only on a
private network or behind an authenticating proxy), but it has to be a stated
choice rather than the result of a forgotten variable. `xchain-node` sets the
declaration automatically when it deploys a hub with no key in the host
environment, except on mainnet, where the refusal stands.

Always set a strong, random `HUB_API_KEY` in production. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Clients then send it on each request (the indexer reads the same value as
`HUB_API_KEY`, the encoder-facing services as their own `*_ENCODER_API_KEY`,
and so on).

**`SIGNING_PRIVKEY_SECRET`: empty means unsigned P2P messages and no
federation identity.** `SIGNING_PRIVKEY_SECRET` is the Ed25519 private key (a
32-byte seed, encoded as 64 hex characters) that authenticates this hub's P2P
messages to the rest of the validator federation. When the P2P cluster is
enabled (see `P2P_VALIDATOR_ADDR`) but this key is empty, the hub loads no
validator identity: outbound messages go out unsigned, and this hub has no
verifiable identity among its peers. Nothing fails loudly; the hub simply
never participates as an authenticated validator, and depending on peers'
`REQUIRE_SIGNATURES` its messages may be silently dropped.

Generate a key pair (the private seed is what you set; keep it secret):

```bash
# Private seed (set this as SIGNING_PRIVKEY_SECRET):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The corresponding public key is derived automatically at startup from the
seed (the hub logs the first 16 hex characters of the pubkey when the
identity loads). Each validator's pubkey must be registered in the cluster so
peers can verify its signatures.

The key format is validated: it must be exactly 64 hex characters. An invalid
non-empty value throws at startup; only the empty case is silent.

### Secret variable naming

Automatic secret redaction, in terminals, CI logs and assistant transcripts,
keys on the variable name and matches `_SECRET`, `_KEY`, or `_TOKEN`. A name
like `HUB_DB_PASS` matches nothing, so the value prints in full every time
someone reads the env file.

Three hub secrets accept a `_SECRET` name, with the historical name kept as a
deprecated fallback so no running deployment breaks:

| Preferred | Deprecated |
|---|---|
| `HUB_DB_SECRET` | `HUB_DB_PASS` |
| `XCHAIN_PRICE_INDEXER_DB_SECRET` | `XCHAIN_PRICE_INDEXER_DB_PASS` |
| `SIGNING_PRIVKEY_SECRET` | `SIGNING_PRIVKEY_HEX` |

The hub logs a warning at startup for each secret still supplied under the
deprecated name. Setting both names to different values is a startup error,
not a precedence rule: that shape is a half-finished rename, and picking a
winner is how a hub keeps authenticating with the credential it was supposed
to rotate away from. Renaming does not un-leak anything by itself: a
credential that has already been read out loud still has to be rotated.

### Core (Required)

These variables are required regardless of operating mode.

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_HOST` | No | `0.0.0.0` | Host to bind the API server |
| `HUB_PORT` | Yes | None | Port for the JSON-RPC API |
| `HUB_DB_HOST` | Yes | None | MariaDB host |
| `HUB_DB_PORT` | Yes | None | MariaDB port |
| `HUB_DB_NAME` | Yes | None | MariaDB database name (e.g., `XChain_Hub`) |
| `HUB_DB_USER` | Yes | None | MariaDB username |
| `HUB_DB_SECRET` | Yes | None | MariaDB password. Deprecated name `HUB_DB_PASS` is still read; see Secret variable naming above. |
| `HUB_DB_KEEPALIVE_INTERVAL` | No | `30000` | Interval (ms) between no-op keepalive queries sent to the MariaDB pool to prevent idle-connection drops |
| `HUB_RATE_LIMIT_RPM` | No | `100` | Requests allowed per IP per 60-second window across the whole API. Over the limit the request returns HTTP 429. Behind a reverse proxy the limiter keys on `X-Forwarded-For`, which is what `HUB_TRUST_PROXY` below governs. |
| `HUB_TRUST_PROXY` | No | `loopback, uniquelocal` | Express `trust proxy` setting. A containerized hub behind a local reverse proxy works with the default. Set to `false` to disable, a hop count (e.g. `1`), or a CIDR list for other topologies. See [Express docs](https://expressjs.com/en/guide/behind-proxies.html). |
| `HUB_ALLOW_UNAUTHENTICATED` | No | `false` | A hub in validator mode (`P2P_VALIDATOR_ADDR` set) with no `HUB_API_KEY` refuses to boot, because its write methods would let anyone drive consensus-affecting writes. Set to `true` to explicitly acknowledge running keyless (regtest/dev only). See OPERATIONS.md → Authentication. |

### Telemetry Collector

The hub is the single collector for anonymous node-operator telemetry (the
`telemetry_pings` table; see Database Schema below). The raw client IP is
never stored: at ingest the hub derives a coarse country/region and a keyed
one-way hash, then discards the IP.

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEMETRY_ENABLED` | No | `true` | Accept telemetry pings. Set `false` on a private/local hub. |
| `TELEMETRY_RETENTION_DAYS` | No | `90` | Prune telemetry rows older than N days. |
| `TELEMETRY_IP_SALT` | No | None | Secret salt for the one-way IP hash. Without it, `ip_hash` is left null (an unsalted hash would be trivially reversible). |
| `TELEMETRY_ADMIN_KEY` | No | None | `x-api-key` gate for the telemetry admin/query surface (empty leaves it fail-closed). Must match the value the dashboard service is configured with. |

### Metrics and Log Shipping

The shared observability module adds a Prometheus scrape endpoint and a
structured log shim. Both are off unless set here: with no variables the hub
registers no extra route, starts no timer, and opens no socket.

| Variable | Required | Default | Description |
|---|---|---|---|
| `METRICS_ENABLED` | No | off | Serve the Prometheus scrape endpoint. |
| `METRICS_PATH` | No | `/metrics` | Scrape path. |
| `METRICS_TOKEN` | No | None | Require `Authorization: Bearer <token>` on the scrape. Set this (or keep the path behind the fronting proxy) on any internet-reachable box. |
| `METRICS_HTTP` | No | `true` when metrics are on | Per-request counters and a latency histogram. Set `0` for endpoint-only. |
| `LOG_FORMAT` | No | `text` | `json` emits one NDJSON record per log line. |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error`. |
| `LOG_SHIP_ENABLED` | No | off | POST batched NDJSON to a collector. Needs `LOG_SHIP_URL` too; either alone stays off. |
| `LOG_SHIP_URL` | No | None | Collector endpoint (http/https). |
| `LOG_SHIP_TOKEN` | No | None | Bearer token for the collector. Never logged or echoed. |
| `LOG_SHIP_BATCH_SIZE` | No | `100` | Lines per POST. |
| `LOG_SHIP_INTERVAL_MS` | No | `5000` | Flush interval. |
| `LOG_SHIP_MAX_BUFFER` | No | `5000` | Bounded buffer; the oldest lines are dropped and counted, never grown without limit. |
| `LOG_SHIP_TIMEOUT_MS` | No | `5000` | Per-batch POST timeout. |

### P2P Gossip Layer

Validator mode is activated when `P2P_VALIDATOR_ADDR` is set. All P2P-dependent subsystems (consensus, oracle, cross-chain, reorg, governance) are no-ops without it.

| Variable | Required | Default | Description |
|---|---|---|---|
| `P2P_VALIDATOR_ADDR` | No | None | This validator's public address. Setting this activates validator mode. |
| `P2P_PORT` | No | `10001` | WebSocket P2P listen port |
| `P2P_HOST` | No | `0.0.0.0` | P2P bind address |
| `SEED_NODES` | No | None | Comma-separated list of peer addresses (e.g., `peer1.example.com:10001,peer2.example.com:10001`) |
| `SIGNING_PRIVKEY_SECRET` | No | None | 64-hex-char Ed25519 private key seed for message signing. Deprecated name `SIGNING_PRIVKEY_HEX` is still read; see Secret variable naming above and Silent-failure variables for what an empty value does. |
| `HUB_NETWORK` | Yes (validator mode) | None | Deployment network: `mainnet`, `testnet`, or `regtest`. Required when `P2P_VALIDATOR_ADDR` is set; `process.exit(1)` if absent or invalid. Must match the `INDEXER_NETWORK` of the chains this hub federates. Controls consensus activation gating (e.g. `STAKE_WEIGHTED_QUORUM` activation height is per-network). |
| `REQUIRE_SIGNATURES` | No | `true` | When `true`, reject unsigned P2P messages. Defaults to `true` in validator mode; pass `false` to bootstrap a new federation before all nodes have keys. |
| `P2P_HEARTBEAT_INTERVAL` | No | `15000` | Milliseconds between heartbeat broadcasts |
| `P2P_RECONNECT_BASE` | No | `2000` | Base delay for reconnect backoff (ms) |
| `P2P_RECONNECT_MAX` | No | `60000` | Maximum delay for reconnect backoff (ms) |
| `P2P_MSG_DEDUP_TTL` | No | `60000` | Message deduplication cache TTL (ms) |
| `P2P_MAX_PAYLOAD` | No | `1048576` | Maximum WebSocket message size in bytes (1 MB) |
| `P2P_DEDUP_PRUNE_INTERVAL` | No | `30000` | Interval (ms) at which the seen-message deduplication cache is pruned |
| `P2P_WS_PING_INTERVAL` | No | `30000` | Interval (ms) for WebSocket ping/pong keepalive (dead-connection detection) |
| `P2P_MAX_CONNECTIONS_PER_IP` | No | `3` | Maximum simultaneous inbound connections from a single IP (anti-DoS). Increase for co-located federations where multiple validators share one IP. |
| `HUB_CAPABILITY_CONFIG` | No | None | Path to the capability config JSON (see below). Required for capability qualification + self-tests. |

### Capability Configuration

Capability staking decides which of the five capabilities (`price`, `cross_chain`,
`oracle_publish`, `attestation`, `full_node`) a validator is qualified and ready to serve. The
hub loads this from the JSON file at `HUB_CAPABILITY_CONFIG`, applies it on startup,
and **hot-reloads** on file change. It supplies two things:

- `CAPABILITIES.<cap>.MIN_STAKE`: the stake threshold a pubkey must meet (queried
  from the indexer) to qualify. **If a capability has no configured `MIN_STAKE`, the
  hub treats it as not qualified (fail-closed)**; it does not default to `0`.
- Per-capability self-test config blocks, checked locally so the hub only
  participates when it can actually serve:
  - `price`: `{ "sources": [...], "fiats": [...] }`
  - `cross_chain`: `{ "chains": { "BTC": { "rpc": "..." }, ... } }`
  - `oracle_publish`: `{ "doge_address": "...", "doge_wallet": "..." }`
  - `attestation`: `{ "providers": { "<id>": false } }` (omit a key to enable it)
- `DISABLED_CAPABILITIES`: array of capabilities to opt out of even when qualified.

```json
{
  "CAPABILITIES": {
    "price":          { "MIN_STAKE": "1000.00000000" },
    "oracle_publish": { "MIN_STAKE": "500.00000000" }
  },
  "DISABLED_CAPABILITIES": ["cross_chain", "attestation"],
  "price": { "sources": ["coingecko"], "fiats": ["USD"] },
  "oracle_publish": { "doge_address": "D...", "doge_wallet": "/data/.dogecoin/wallet.dat" }
}
```

`xchain-node validator init` generates a starter file and `xchain-node install`
mounts it into the hub container automatically. See OPERATIONS.md → Validator Mode.

### PBFT Consensus

| Variable | Required | Default | Description |
|---|---|---|---|
| `PBFT_TIMEOUT` | No | `30000` | Consensus round timeout in milliseconds. Triggers view change on expiry. |
| `MIN_VALIDATORS` | No | `1` | Minimum validators required before a consensus round may run. |
| `HUB_CONSENSUS_INPUT_ALERT_AFTER` | No | _(built-in default)_ | Consecutive consensus-input failures before the alarm fires. A non-integer or non-positive value logs an error and falls back to the default rather than disabling the alarm, so a typo cannot silently restore fail-closed-and-silent behaviour. |
| `HUB_SNAPSHOT_REORG_BUFFER` | No | `6` | Blocks of reorg buffer applied when building a capability snapshot. **Consensus-critical: it must match across the federation.** A malformed value logs an error and falls back to `6` rather than forking the federation on a typo. |
| `XCHAIN_HUB_SKIP_REORG_BUFFER_ASSERT` | No | _(unset)_ | Set to `1` to bypass the assertion that `HUB_SNAPSHOT_REORG_BUFFER` equals the canonical federation value. Only for a venue where **every** hub runs the same override: each hub subtracts this buffer before resolving a snapshot, so hubs disagreeing on it lock different blocks for the same round and produce divergent validator sets and quorum N. On `mainnet` and `testnet` a mismatch otherwise refuses to start (`REORG_BUFFER_MISMATCH`); standalone and regtest warn instead. The bypass logs a warning every time it is taken. |
| `XCHAIN_HUB_SKIP_MIN_STAKE_ASSERT` | No | _(unset)_ | Set to `1` to skip the minimum-stake assertion at startup. Test and bring-up seam; leaving it set on a real deployment disables a safety check. |

### Hub-DB WebSocket (`GET /hub-db/subscribe`)

Caps on the live-update channel indexers subscribe to. See [API](api.md#get-hub-dbsubscribe-websocket-upgrade-requires-authorization-bearer-hub_api_key).

| Variable | Required | Default | Description |
|---|---|---|---|
| `WS_MAX_SUBSCRIBERS` | No | `1000` | Maximum simultaneous subscribers across all IPs |
| `WS_MAX_PER_IP` | No | `100` | Maximum simultaneous subscribers from a single IP |
| `WS_BACKPRESSURE_LIMIT` | No | `50` | Buffered messages a slow subscriber may accumulate before its connection is dropped |
| `WS_WATERMARK_INTERVAL_MS` | No | `10000` | Interval between `watermark` heartbeats, which let a subscriber tell "the mirror is behind" apart from "no rows are being produced" |
| `WS_WATERMARK_LATE_FACTOR` | No | `2` | Multiple of `WS_WATERMARK_INTERVAL_MS` after which a heartbeat gap counts as late and is logged; `getWatermarkStats()` exposes the tally on `/health`. A value below `1` would mark an exactly-on-time tick late, so anything under `1` falls back to the default rather than raising permanent false alarms |

### Indexer tip freshness

The hub reads the BTC chain tip to anchor consensus rounds. These gates stop a stale tip from locking an out-of-date validator set into a round.

| Variable | Required | Default | Description |
|---|---|---|---|
| `BTC_INDEXER_URL` | No | _(from config table)_ | BTC indexer JSON-RPC URL used by the full-node challenge round. |
| `BTC_INDEXER_API_KEY` | No | _(from config table)_ | API key presented to that indexer's fail-closed federation-read gate. Treat as a credential. |
| `BTC_INDEXER_API_URL` | No | None | BTC indexer JSON-RPC URL for the validator-mode price oracle's block-height anchor (`getlatestblock`). Set it when the hub is **not** co-located with a BTC indexer, e.g. a master hub box whose BTC stack lives elsewhere. Empty falls back to local resolution. `xchain-node` forwards this from the host environment. |
| `MAX_INDEXER_LAG_BLOCKS` | No | `200` | Maximum blocks the BTC indexer may lag before its tip is treated as untrustworthy and ignored, degrading gracefully instead of locking in a stale validator set. |
| `MAX_TIP_AGE_S` | No | `2 × ORACLE_ROUND_INTERVAL` (seconds) | Maximum age of the indexer-pushed BTC tip before it is considered stale. |
| `INDEXER_COIN_CHECK` | No | enabled | Set to `0` to disable the per-coin indexer reachability check. |

### Oracle

| Variable | Required | Default | Description |
|---|---|---|---|
| `ORACLE_ROUND_INTERVAL` | No | `600000` | Milliseconds between oracle rounds (default: 10 minutes) |
| `ORACLE_SUBMISSION_WINDOW` | No | `180000` | Milliseconds to collect validator price submissions (default: 3 minutes) |
| `ORACLE_FINALIZATION_TIMEOUT` | No | `120000` | Timeout for oracle PBFT finalization round (default: 2 minutes) |
| `ORACLE_MIN_SUBMISSIONS` | No | `2` | Minimum distinct-validator price submissions required before a round can be finalized. Consensus-critical: a single-hub or regtest deployment stalls every oracle round unless this is set to `1`, because the default of `2` requires a second submitter that will never arrive. |
| `ORACLE_MAX_SUBMISSIONS_PER_ROUND` | No | `200` | Cap on the number of price submissions accepted per round. Submissions beyond this limit are discarded to bound memory and consensus payload size. |
| `ORACLE_STALENESS_THRESHOLD_S` | No | `2 x ORACLE_ROUND_INTERVAL` | Seconds since the last finalized price snapshot before the `GET /health` endpoint reports `oracle_stale: true` (and returns HTTP 503). Defaults to twice the round interval; override for slow-start or custom round cadences. |
| `ORACLE_EARLY_MSG_MAX_ROUNDS` | No | `256` | Cap on the number of distinct future consensus rounds the oracle buffers early messages for. Bounds memory against a peer flooding fabricated round numbers; messages for rounds beyond the cap are dropped. |
| `COINGECKO_API_KEY` | No | None | CoinGecko API key (optional, improves rate limits) |
| `COINMARKETCAP_API_KEY` | No | None | CoinMarketCap API key (enables a third price source; CoinGecko and Kraken are both keyless and always active) |
| `PRICE_FETCH_TIMEOUT` | No | `10000` | HTTP timeout for external price API calls (ms) |
| `ORACLE_LEADER_TIMEOUT_MS` | No | `30000` | How long a round waits on its leader before failover. Kept below the finalization window. |
| `ORACLE_FINALIZED_MAX` | No | `10000` | Cap on retained finalized-round records held in memory. |
| `ORACLE_SUBMISSIONS_RETENTION_ROUNDS` | No | _(unset)_ | Number of past rounds of raw price submissions to retain. Unset keeps the built-in retention. |
| `ORACLE_ALLOW_UNVERIFIED_PAIRS` | No | `false` | Set to `true` to accept price pairs that have not been verified. Loosens a fail-closed check; intended for bring-up, not production. |
| `ORACLE_MAX_PRICE_AGE_SECONDS` | No | _(coin registry, per pair)_ | Maximum age of an oracle price before it is treated as stale. Resolution order is `p2pConfig` → this variable → the per-pair value pinned in the coin registry. The registry value is never a hardcoded literal, so a coordinated release that changes the pin cannot silently diverge the hub's advisory from the indexer's gate. Setting this per-host overrides that pin: do it deliberately, and match it across the federation. |

### Oracle Publishing

Controls `OraclePublisher`, which broadcasts finalized price rounds on-chain as DOGE `PRICE` actions.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ORACLE_PUBLISH_ENABLED` | No | `true` | Set to `false` to stop this hub publishing oracle rounds on-chain. Consensus participation is unaffected. |
| `PUBLISHER_QUEUE_PATH` | No | `./data/publisher-queue.jsonl` | Durable queue file for pending publishes. Point at persistent storage so a restart does not lose queued rows. |
| `PUBLISHER_MAX_ATTEMPTS` | No | `5` | Attempts before a queued publish is abandoned. |
| `DOGE_PUBKEY_HEX` | No | _(from config table)_ | Public key, hex, of the DOGE publishing wallet. |
| `DOGE_ENCODER_URL` | No | _(from config table)_ | Encoder URL used to build DOGE publish transactions. |
| `DOGE_ENCODER_API_KEY` | No | _(from config table)_ | API key presented to that encoder when it runs keyed. Treat as a credential. |
| `DOGE_LOW_BALANCE_THRESHOLD` | No | `10` | DOGE balance below which the publisher warns that it is running out of funds. |

### Rewards and Slashing

| Variable | Required | Default | Description |
|---|---|---|---|
| `ORACLE_REWARD_PER_ROUND` | No | `"10.00000000"` | XCHAIN distributed per finalized oracle round |
| `SLASH_DEVIATION_THRESHOLD` | No | `"0.05"` | Price deviation threshold (5%) for slash detection |
| `SLASH_MISSED_ROUNDS_THRESHOLD` | No | `"30"` | Consecutive missed rounds before non-participation slash |

### ANCHOR Publishing

Controls `StateAnchorPublisher` (commits checkpoints and the cross-chain match archive on-chain via the DOGE ANCHOR action) and `RewardTracker` (anchor-publish reward amount).

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANCHOR_INTERVAL_MS` | No | `86400000` | Milliseconds between ANCHOR publish cycles (default: 24 hours) |
| `ANCHOR_MATCH_BATCH_SIZE` | No | `200` | Maximum `cross_chain_matches` rows to include per ANCHOR archive chunk |
| `ANCHOR_CHUNK_RETRY_MS` | No | `2500` | Delay before retrying a failed archive chunk upload (ms) |
| `ANCHOR_ELECTION_TOLERANCE_BLOCKS` | No | `36` | BTC blocks a non-leader hub waits before the next eligible rank may take over |
| `ANCHOR_REWARD_PER_PUBLISH` | No | `"10.00000000"` | XCHAIN distributed to the elected ANCHOR publisher per successful publish cycle |
| `ANCHOR_CHECKPOINT_EVERY_N` | No | `1` | Anchor only every Nth `checkpoint_seq` on-chain (per chain). Decouples on-chain ANCHOR spend from checkpoint production cadence: skipped (off-multiple) seqs remain in the off-chain hub-DB mirror and are still verifiable via the explorer. `1` anchors every checkpoint (original behaviour). |
| `ANCHOR_ENABLED` | No | `true` | Set to `false` to stop this hub publishing ANCHORs. |
| `ANCHOR_MAX_BATCH` | No | `1000` | Maximum `cross_chain_matches` rows drained into one publish cycle. |
| `ANCHOR_CHUNK_MAX_BYTES` | No | `6000` | Maximum payload bytes per ANCHOR archive chunk. |
| `ANCHOR_ROUND_TIMEOUT_MS` | No | `120000` | Timeout for one ANCHOR signing round. |
| `ANCHOR_AMBIGUOUS_POLL_ATTEMPTS` | No | `3` | Re-polls before an ambiguous publish result (broadcast may or may not have landed) is resolved. |
| `ANCHOR_AMBIGUOUS_POLL_MS` | No | `5000` | Delay between those re-polls. |
| `ANCHOR_ANNOUNCE_RETRY_MS` | No | `300000` | Delay between retries of the anchor announcement (5 minutes). |
| `ANCHOR_ANNOUNCE_RETRY_TTL_MS` | No | `21600000` | How long announcement retries continue before the entry is dropped (6 hours, roughly six times the 60-confirmation DOGE window). |
| `ANCHOR_ANNOUNCE_QUEUE_MAX` | No | `500` | Maximum queued anchor announcements, bounding memory. |

#### Why those magnitudes (before you retune them)

None of the ANCHOR knobs is consensus data: hubs on different values still
produce mutually verifiable anchors. Three of them do encode a real bound, and
the full derivation is in
[ANCHOR.md](../../protocol/actions/anchor.md#where-the-publisher-constants-come-from):

- **`ANCHOR_CHUNK_MAX_BYTES` = 6000** reserves head room under the protocol's
  8192-byte `MAX_ACTION_DATA_LENGTH` ceiling, because chunk 0 shares its action
  with the checkpoint prefix (~322 bytes) and the signature lists (194 bytes per
  `(PUBKEY, SIG)` pair, doubled on a v6). What is left is about nine signature
  pairs on a v1, or 4+4 on a v6, so **lower this as the federation grows**: a
  5+5 v6 quorum needs ~5860 or less, a 7+7 quorum ~5080. Exceeding the ceiling
  is silent, since the decoder simply drops the action.
- **`ANCHOR_MATCH_BATCH_SIZE` = 200** is an early-flush latency trigger and
  **`ANCHOR_MAX_BATCH` = 1000** is the per-cycle DOGE spend bound. Archive rows
  are signature-dominated and barely compress (~0.55 KB of gzip+base64 per
  settled match), so 1000 rows is ~550 KB, ~93 chunks, ~93 DOGE transactions in
  a cycle; 200 rows is ~19.
- **`ANCHOR_ELECTION_TOLERANCE_BLOCKS` = 36** is ~6 hours of BTC blocks per
  failover rank, counted in blocks rather than wall clock so every hub agrees on
  the unlock without clock sync. The ordering carries the meaning: signing round
  (120s) + DOGE burial (60 confs, ~1h) << 36 blocks (~6h) <<
  `ANCHOR_INTERVAL_MS` (24h). Roughly 6 to 144 blocks keeps both bounds; a wrong
  value costs duplicate DOGE spend or delayed anchoring, never a divergence.

### Attestation Publishing

Controls `AttestationPublisher`, which writes the validator network's answers to contract attestation requests back on-chain.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATTEST_ENABLED` | No | `true` | Set to `false` to stop this hub publishing attestation results. |
| `ATTESTATION_QUEUE_PATH` | No | `./data/attestation-queue.jsonl` | Durable queue file for pending attestation publishes. Point at persistent storage. |
| `ATTESTATION_FAILOVER_WINDOW_BLOCKS` | No | `2` | Blocks of leader silence before the rank-1 hub steps in. |
| `ATTESTATION_FAILOVER_POLL_MS` | No | `30000` | Failover sweep cadence. |
| `ATTESTATION_LEADER_RETRY_MS` | No | `60000` | Grace period before the sweep retries a leader's entry. |
| `ATTESTATION_BLOCK_MS` | No | `600000` | Nominal block interval used to translate the failover window from blocks into time. Defaults to the BTC ~10 minute interval. |
| `ATTESTATION_AMBIGUOUS_COOLDOWN_MS` | No | `ATTESTATION_FAILOVER_WINDOW_BLOCKS × ATTESTATION_BLOCK_MS` | Cooldown after an ambiguous publish result before another hub may retry. |
| `BTC_ADDRESS` | No | _(from config table)_ | BTC address of this hub's publishing wallet. |

### Attestation Relay

Controls `AttestationRelay`, the driver that carries attestation requests to the validator network and the response leg back. Attestation staking lives on Bitcoin, so an ATTEST request made on an origin chain (LTC, DOGE) is relayed to BTC as a v3 request, and the finalized answer is relayed back to the origin chain as a v4 response. The relay therefore needs a broadcast rail on every origin chain it serves, not just on the home chain.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATTEST_RELAY_ENABLED` | No | `0` | Set to `1` to run the relay. Opt-in rather than a kill switch, deliberately: a fleet that has merely deployed this code must run nothing until an operator turns it on. |
| `ATTEST_RELAY_POLL_MS` | No | `15000` | How often the relay sweeps for work. |
| `ATTEST_RELAY_FAILOVER_MS` | No | `1200000` | Leader silence tolerated before another hub takes the relay over. Twenty minutes. |
| `ATTEST_RELAY_QUEUE_PATH` | No | `./data/attest-relay-queue.jsonl` | Durable at-most-once record of v3 broadcasts. Point it at persistent storage: replaying a v3 is rejected on-chain but still burns a real BTC fee, and this file is what stops a restart from doing that. |
| `BTC_PUBKEY_HEX` | No | _(from config table)_ | Public key, hex, of that wallet. |
| `BTC_ENCODER_URL` | No | _(from config table)_ | Encoder URL used to build BTC publish transactions. |
| `BTC_ENCODER_API_KEY` | No | _(from config table)_ | API key presented to that encoder when it runs keyed. Treat as a credential. |
| `ATTESTATION_HTTP_GET_ALLOW_PRIVATE` | No | _(unset, fails closed)_ | Set to `1` to let the `http_get` attestation provider reach private and loopback addresses. **Off by default and security-relevant:** the provider normally resolves the hostname once and pins the request to that public address, which is what stops a contract-supplied URL being used for SSRF against the validator's own network. Enable only on an isolated test venue. |

#### Per-origin-chain broadcast rail

The variables below are read dynamically (`process.env[coin + '_ENCODER_URL']` and friends) for each origin chain, so a static scan of the source will not list them; `<COIN>` is any allowed coin other than BTC, so today `LTC` and `DOGE`. Each also resolves from the hub's `p2pConfig`; the env var wins.

Leaving an origin chain's rail unconfigured does not fail loudly. The v4 response is still consensus-finalized and then held forever, behind one startup warning (`no <COIN> broadcast rail`). Responses are held rather than dropped, so the recovery is to configure the rail and restart, but nothing re-warns in the meantime. Check `attest_relay` on `/health` to see the hold: a rising `awaiting_broadcast` with a flat `responses_relayed` is this misconfiguration.

| Variable | Required | Default | Description |
|---|---|---|---|
| `<COIN>_ENCODER_URL` | If relaying to `<COIN>` | None | xchain-encoder endpoint used to build the v4 response transaction on origin chain `<COIN>` (e.g. `LTC_ENCODER_URL`). Empty means no rail; see the hold warning above. |
| `<COIN>_ENCODER_API_KEY` | No | None | API key for that origin chain's encoder. |
| `<COIN>_ADDRESS` | If relaying to `<COIN>` | None | Wallet address on `<COIN>` that pays for and publishes v4 responses (e.g. `LTC_ADDRESS`). |
| `<COIN>_PUBKEY_HEX` | If relaying to `<COIN>` | None | Public key (hex) for that address. |
| `<COIN>_INDEXER_API_URL` | If relaying to `<COIN>` | None | Indexer endpoint the relay reads `<COIN>`-origin ATTEST requests from. Also accepted as `<COIN>_INDEXER_URL`, or pushed via `xchain-node updateconfig`. A chain with no indexer URL is skipped every tick, with a startup warning. |
| `<COIN>_INDEXER_API_KEY` | No | None | API key for that indexer. |

The home (BTC) rail reuses the BTC attestation publisher variables above (`BTC_ENCODER_URL`, `BTC_ADDRESS`, `BTC_PUBKEY_HEX`, `BTC_INDEXER_API_URL`). Origin rails are deliberately kept separate from it: an operator broadcast hook configured for one chain would put an LTC payload on BTC, where it is rejected outright after burning a real BTC fee. Spend limits come from the shared spend guard under the `ATTEST` prefix (see Effector Spend Policy below), and confirmation depths from `XCHAIN_CONFIRMATIONS_<COIN>`.

### Effector Spend Policy

Every hub effector that spends real coin on-chain runs behind a shared spend guard: a balance floor, a rolling per-window spend ceiling (hard-clamped at a $2000 admission ceiling), and a per-capability runtime pause. The knobs below take a per-effector `<PREFIX>`; the four prefixes are `ORACLE_PUBLISH`, `ATTEST`, `ANCHOR`, and `FULLNODE`. Each variable also resolves from `p2pConfig`; the env var wins. The spend ceiling is default-enabled: unset config yields the $2000 clamp, never "off".

| Variable | Required | Default | Description |
|---|---|---|---|
| `<PREFIX>_MAX_SPEND_USD_CENTS_PER_WINDOW` | No | `200000` ($2000) | Rolling per-window spend budget in USD cents. Clamped to `<= 200000`; an operator can only lower it. |
| `<PREFIX>_EST_SPEND_USD_CENTS` | No | `100` ($1) | Per-broadcast cost estimate charged against the window budget when the caller does not supply a real fee. |
| `<PREFIX>_MAX_PUBLISHES_PER_WINDOW` | No | `0` (off) | Optional per-window broadcast count cap, defense in depth alongside the USD budget. `<=0` disables the count cap. |
| `<PREFIX>_SPEND_WINDOW_MS` | No | `3600000` (1h) | Rolling window length (ms) for both the count and USD ceilings. |
| `<PREFIX>_MIN_BALANCE` | No | `0` | Wallet floor (native coin). A balance below the floor, or an unreadable (null) balance, skips the spend fail-closed. |

Runtime pause is operator-driven via JSON-RPC (auth-gated): `pauseeffectorspend` / `resumeeffectorspend` take `{ label }` (the effector's guard label, e.g. `OraclePublisher`), and `geteffectorspendstatus` lists every effector's live state. A pause halts the effector's primary/leader spend path immediately, with no restart.

### State Checkpoints

Controls `StateCheckpointEngine`, which produces the quorum-signed per-block state-hash checkpoints that light clients and `xchain-sync` replicas verify against.

| Variable | Required | Default | Description |
|---|---|---|---|
| `CHECKPOINT_ENABLED` | No | `true` | Set to `false` to stop this hub participating in checkpoint rounds. |
| `CHECKPOINT_CHAINS` | No | all supported coins | Comma-separated list of chains to checkpoint. Entries outside the supported set are dropped. |
| `CHECKPOINT_INTERVAL_BLOCKS` | No | `6` | Blocks between checkpoints. Raising it cuts checkpoint and anchor spend at the cost of a coarser recovery point; `144` is roughly daily on BTC. |
| `CHECKPOINT_CONFIRMATIONS` | No | `6` | Confirmations required before a block is eligible for checkpointing. |
| `CHECKPOINT_POLL_MS` | No | `60000` | Interval between checkpoint eligibility polls. |
| `CHECKPOINT_ROUND_TIMEOUT_MS` | No | `60000` | Timeout for one checkpoint signing round. |
| `CHECKPOINT_COSIGN_TOLERANCE_BLOCKS` | No | `144` | Fail-closed co-sign gate: a `SIGN_REQ` whose `snapshot_block` deviates from this hub's own BTC tip by more than this many blocks is declined. The default is roughly a day of BTC blocks. |
| `CHECKPOINT_STALL_LOG_MS` | No | `3600000` (1 h) | Throttle for the "cadence stalled" log line. The eligibility poll runs far more often than the checkpoint cadence, so the reason is logged at most this often and the counter carries the true rate. |

### Full-Node Challenge

Controls `FullNodeChallengeRound`, the periodic possession challenge proving a validator runs a real coin full node rather than mirroring the decoder and indexer databases. Feeds the full-node verified reward tier and the on-chain `NODEPROOF` action.

| Variable | Required | Default | Description |
|---|---|---|---|
| `FULLNODE_ENABLED` | No | `true` | Set to `false` to stop this hub running full-node challenges. |
| `FULLNODE_BTC_RPC` | No | _(from coin config)_ | BTC node JSON-RPC URL used to pose the challenge. |
| `FULLNODE_CHALLENGE_INTERVAL_BLOCKS` | No | `144` | Blocks between challenge rounds (about daily on BTC). |
| `FULLNODE_SPEND_LOG_PATH` | No | `./data/fullnode-verdict.spend.jsonl` | JSONL record written and fsynced BEFORE a verdict fee is committed, so a crash mid-flight leaves a durable trace instead of only stdout. |
| `FULLNODE_CONFIRM_DEPTH` | No | `100` | Depth behind the tip from which challenge material is drawn. |
| `FULLNODE_VERDICT_ACCEPT_WINDOW_BLOCKS` | No | `24` | Blocks during which a verdict remains acceptable. |
| `FULLNODE_POLL_MS` | No | `30000` | Poll cadence for challenge progress. |
| `FULLNODE_COLLECT_MS` | No | `20000` | Window for collecting challenge answers. |
| `FULLNODE_COLLECT_DEPTH_BLOCKS` | No | `3` | Blocks past the collection point before the round closes. |
| `FULLNODE_PROOF_WINDOW_BLOCKS` | No | per-coin | Blocks a challenged node has to submit a proof. |
| `FULLNODE_REWARD_PASS_WINDOW_BLOCKS` | No | per-coin | Blocks in the reward-pass window. |
| `FULLNODE_MIN_PASS_RATE_BPS` | No | per-coin | Minimum pass rate, in basis points, for a node to be treated as passing. |
| `FULLNODE_REWARD_SHARE` | No | per-coin | Reward share for passing full nodes. |
| `FULLNODE_GENESIS_VERIFIERS` | No | per-coin | Comma-separated genesis verifier pubkeys (lowercased). |
| `XCHAIN_HUB_SKIP_FULLNODE_ASSERT` | No | _(unset, assertion active)_ | Set to `1` to skip the canonical-FULLNODE assertion at startup and warn instead. Intended as a loud one-off bypass for a venue running its own challenge cadence and verifier set: divergent `NODEPROOF` knobs fork the challenge schedule, so this is not a setting to leave on. |

### Retraction Consensus

| Variable | Required | Default | Description |
|---|---|---|---|
| `RETRACT_ROUND_TIMEOUT_MS` | No | `180000` | Timeout for one retraction round. |
| `RETRACT_SIGN_RETRY_MS` | No | `15000` | Delay before re-sending a retraction `SIGN_REQ`. |
| `RETRACT_INTENT_TTL_MS` | No | `3600000` | How long a retraction intent stays live before expiring (1 hour). |

### XCHAIN Price Derivation

The XCHAIN/USD price is derived from platform-realized fills rather than an external feed. These read the indexer database holding those fills.

| Variable | Required | Default | Description |
|---|---|---|---|
| `XCHAIN_PRICE_INDEXER_DB_HOST` | No | None | Host of the indexer DB the fills are read from |
| `XCHAIN_PRICE_INDEXER_DB_PORT` | No | None | Port of that database |
| `XCHAIN_PRICE_INDEXER_DB_NAME` | No | None | Database name |
| `XCHAIN_PRICE_INDEXER_DB_USER` | No | None | Database user |
| `XCHAIN_PRICE_INDEXER_DB_SECRET` | No | None | Database password. Deprecated name `XCHAIN_PRICE_INDEXER_DB_PASS` is still read; see Secret variable naming above. Treat as a credential: supply it from the deployment environment, never a checked-in file. |
| `XCHAIN_PRICE_INDEXER_DB_COIN` | No | `BTC` | Chain whose fills the price is derived from |
| `XCHAIN_PRICE_WINDOW_BLOCKS` | No | _(built-in)_ | Rolling window, in blocks, over which fills are aggregated |
| `XCHAIN_PRICE_MIN_BTC_VOLUME` | No | _(built-in)_ | Minimum BTC-notional volume in the window before a derived price is considered valid |
| `XCHAIN_PRICE_CONFIRMATION_BUFFER` | No | _(built-in)_ | Confirmations a fill needs before it counts toward the derived price |
| `XCHAIN_PRICE_BOOTSTRAP_SATS` | No | `1000` | Bootstrap XCHAIN price in SATOSHIS, used before enough on-platform volume exists to derive one. Converted to USD at round time with the consensus BTC/USD, so it is never a USD pin. Consensus-critical: a per-operator value forks fee acceptance |

### LLM Attestation Provider

Backs the `ATTEST` path where a contract asks an approved model a question. See [Attestation](../../protocol/providers/llm.md).

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER_ENABLED` | No | `true` | Set to `false` to disable the LLM attestation provider on this hub. |
| `LLM_MAX_BUDGET_USD` | No | _(built-in cap)_ | Spend ceiling in USD for LLM attestation calls. A kill-switch against runaway cost. |
| `CLAUDE_BIN` | No | `claude` | Path to the Claude CLI binary the provider spawns. Override when it is not on `PATH`. |

> **Cost note.** Each on-chain checkpoint anchor spends real DOGE on three transactions (BTC + LTC + DOGE checkpoints all broadcast on the DOGE chain). State recovery (`recovery.js`) only needs the **latest** anchored checkpoint per chain, so anchoring every intermediate `checkpoint_seq` is optional. With daily checkpoints (`CHECKPOINT_INTERVAL_BLOCKS=144`), `ANCHOR_CHECKPOINT_EVERY_N=2` halves anchor spend (on-chain recovery point then trails the tip by up to ~2 checkpoint intervals). `checkpoint_seq` is consensus data, so the gate is deterministic across every hub.

### Operator Signer

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_SIGNER_MODULE` | No | None | Path to a CommonJS module exporting `walletSign(psbtHex) → Promise<txHex>`. Used by `OraclePublisher` and `AttestationPublisher` to sign DOGE transactions; `StateAnchorPublisher` borrows the same hooks via `_resolveSigner()`. Optional: without it the publishers stay idle. Set-but-unloadable throws at startup (fail loudly). Falls back to `setWalletSignHook` / `setBroadcastHook` if the module is not provided. |

### Cross-Chain

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATTESTATION_TIMEOUT` | No | `60000` | Cross-chain attestation consensus timeout (ms) |
| `CROSS_CHAIN_INDEXER_TIMEOUT` | No | `15000` | HTTP timeout (ms) for the hub's federation-read calls to indexers during cross-chain verification |
| `XCALL_POLL_MS` | No | `15000` | Poll cadence of the cross-chain call relay |
| `XCALL_RELAY_MARGIN_BLOCKS` | No | `4` | Margin, in blocks of the gating chain, stamped onto every relayed row's `effective_time`. Sized by that chain's nominal block interval. |
| `XDEX_POLL_MS` | No | `15000` | Poll cadence of the cross-chain DEX settlement engine |
| `XDEX_MIN_CONFIRMATIONS` | No | _(per-coin config)_ | Flat confirmation floor for cross-chain DEX settlement, overriding the per-coin values |
| `XDEX_MIN_CONFIRMATIONS_<COIN>` | No | per-coin (BTC `6`, LTC `12`, DOGE `60`) | Per-coin confirmation depth override (e.g. `XDEX_MIN_CONFIRMATIONS_DOGE`). Takes precedence over the flat `XDEX_MIN_CONFIRMATIONS` variable. Consensus-affecting. |
| `XCHAIN_CONFIRMATIONS_<COIN>` | No | per-coin | Cross-chain attestation/swap confirmation depth for `<COIN>` (e.g. `XCHAIN_CONFIRMATIONS_BTC`), read by the cross-chain and cross-chain-call engines. Also resolves from `p2pConfig` and falls back to per-coin defaults; the env var is the highest-precedence override. Consensus-affecting. |
| `XCHAIN_ATTEST_FINALIZED_MAX` | No | `10000` | Cap on retained finalized cross-chain attestation records held in memory |

**Regtest-only seams.** Both engines honour these only when the hub's network is `regtest`, and read them as `NaN`/false everywhere else, so a stray environment variable or config row can never reach the signed snapshot anchor or seed a validator on mainnet or testnet. They deliberately share names between the DEX and XCALL engines so a no-BTC regtest stack is configured once.

| Variable | Required | Default | Description |
|---|---|---|---|
| `XDEX_SNAPSHOT_BLOCK` | No | None | Pin the snapshot anchor block on a regtest stack that has no BTC chain |
| `XDEX_SEED_LOCAL_VALIDATOR` | No | None | Set to `1` to seed the local hub as a validator on a single-node regtest stack |

### Genesis and Regtest Binding

Regtest-only genesis overrides, ignored on mainnet and testnet, which always use the frozen bundled values. Consensus-relevant: they bind the local chain's genesis anchor.

| Variable | Required | Default | Description |
|---|---|---|---|
| `XCHAIN_GENESIS_BLOCK` | Regtest only | per-coin | Genesis block height for a regtest chain. |
| `XCHAIN_GENESIS_LEDGER_HASH` | Regtest only | per-coin | Genesis ledger-hash pin for a regtest chain. |
| `XCHAIN_GENESIS_DUMP_HASH` | Regtest only | per-coin | Genesis dump-hash pin for a regtest chain. |

### Fee Destination Override

| Variable | Required | Default | Description |
|---|---|---|---|
| `XCHAIN_FEE_DESTINATION_<COIN>_<NETWORK>` | Regtest only | bundled | Overrides the native-fee destination address for `<COIN>` on `<NETWORK>`. Honored on regtest only: on mainnet and testnet it is ignored (and logged), because the fee destination is consensus-pinned and an env override would escape the freeze and fork the block-hashed ledger. |

### Reorg

| Variable | Required | Default | Description |
|---|---|---|---|
| `REORG_TIMEOUT` | No | `60000` | Reorg consensus timeout (ms) |
| `REORG_MAX_LOOKBACK_MS` | No | `86400000` | How far back (24 hours) a reorg may be considered |
| `REORG_MAX_DEPTH` | No | `2000` | Height-dimension blast-radius bound: the hub abstains from a reorg whose height sits more than this many blocks below its own indexer's tip |
| `REORG_MAX_PENDING` | No | `64` | Maximum concurrently pending reorg records, bounding memory |
| `REORG_TIMESTAMP_SKEW_MS` | No | `10800000` | Tolerated clock skew (3 hours) when comparing reorg block timestamps |
| `REORG_ALLOW_UNRECORDED_OLDHASH` | No | _(unset, abstain)_ | Set to `1` to co-sign a reorg whose recorded orphaned block hash is null (unrecorded), so its claimed old hash cannot be verified against local history. Off by default: the hub abstains from such rounds rather than co-sign a claim it cannot check. An escape hatch for operators knowingly running against history with unrecorded orphan hashes, at the cost of co-signing unverified claims. |

### Governance

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOV_VOTING_PERIOD` | No | `604800000` | Governance voting period in milliseconds (default: 7 days) |
| `GOVERNANCE_TALLY_INTERVAL` | No | `60000` | Interval between governance tally sweeps |

## Database Schema

The hub uses 20 MariaDB tables, auto-created on startup from `src/sql/`:

### Config Storage

| Table | Purpose |
|---|---|
| `configs` | Service config parameters: `(coin, network, module, param_name, param_value)` |

Unique constraint on `(coin, network, module, param_name)` for upsert behavior.

### Validator Management

| Table | Purpose |
|---|---|
| `validators` | Active validators: `(signing_pubkey, addr, status, chains)`: capabilities are derived from each pubkey's aggregate stake, not stored here (the `tier` column was dropped in the capability-staking refactor) |
| `consensus_state` | PBFT sequence number persistence |
| `p2p_peers` | Known P2P peers and last-seen timestamps |

### Oracle

| Table | Purpose |
|---|---|
| `oracle_submissions` | Raw per-validator price submissions per round: `(round_number, coin_pair, validator_pubkey, price)` |
| `price_snapshots` | Finalized/skipped/disputed price snapshots: `(round_number, coin_pair, price, status, consensus_proof)` |
| `oracle_prices` | User-published PRICE v1 oracle prices: `(source_address, coin, tick, fiat, value, effective_at)` with 24-hour delay on updates |

### Cross-Chain

| Table | Purpose |
|---|---|
| `attestations` | Cross-chain attestation records: `(attestation_id, source_chain, source_action_index, dest_chain, status, consensus_proof)`: status: pending, attested, rejected, expired |
| `swap_records` | SWAP lifecycle tracking: `(source_chain, source_action_index, dest_chain, dest_action_index, status)` |
| `reorg_attestations` | Confirmed blockchain reorg events: `(chain, reorg_height, timestamp, consensus_proof)` |
| `cross_chain_matches` | Cross-chain DEX match records mirrored across the federation and to indexers via hub DB sync |
| `cross_chain_calls` | Cross-chain contract call relay rows (XCALL dispatch + result) mirrored to indexers via hub DB sync |

### State Checkpoints and Capability Snapshots

| Table | Purpose |
|---|---|
| `state_checkpoints` | Quorum-signed per-chain ledger/actions/contract hash checkpoints produced by `StateCheckpointEngine`; streamed to indexers via hub DB sync and committed on-chain via ANCHOR |
| `capability_snapshots` | Block-boundary per-capability validator-set snapshots locked by `CapabilitySnapshot` for deterministic quorum; mirrored to indexers |

### Governance

| Table | Purpose |
|---|---|
| `governance_proposals` | Parameter change proposals: `(parameter, current_value, proposed_value, rationale, proposer, status)` |
| `governance_votes` | Validator votes: `(proposal_id, signing_pubkey, vote, signature)` |

### Rewards and Slashing

| Table | Purpose |
|---|---|
| `validator_rewards` | Per-round validator rewards: `(validator_pubkey, round_number, reward_type, amount, block_index, batch_seq, claimed)`: `reward_type` distinguishes `oracle_round`, `attest_fee`, `anchor_<chain>` etc.; `batch_seq` links anchor-publish batch rows; `block_index` pins the earn block |
| `slash_proposals` | Detected validator offenses: `(signing_pubkey, offense_type, evidence, round_number)` |

### Telemetry

| Table | Purpose |
|---|---|
| `telemetry_pings` | Anonymous node-operator usage pings: `(install_id, hub_version, services, os_info, country, region, ip_hash)`: raw IP is never stored |

### Capability Registry

| Table | Purpose |
|---|---|
| `validator_capabilities` | Per-pubkey capability activation/deactivation records written by `CapabilityRegistry` |

## Config Table Detail

| Column | Type | Description |
|---|---|---|
| `coin` | VARCHAR(16) | Coin identifier (BTC, LTC, DOGE) |
| `network` | VARCHAR(16) | Network (mainnet, testnet, regtest) |
| `module` | VARCHAR(64) | Service name (xchain-decoder, xchain-indexer, etc.) |
| `param_name` | VARCHAR(32) | Parameter name (host, port, db_host, db_port, name, user, pass, service_port) |
| `param_value` | TEXT | Parameter value |
| `updated_at` | TIMESTAMP | Last update timestamp |

Config is served as a nested object: `{ coin: { network: { module: { param: value } } } }`.

## Connection Pool

| Parameter | Value | Description |
|---|---|---|
| `connectionLimit` | `10` | Maximum simultaneous connections |
| `connectTimeout` | `10000` | Connection timeout (ms); override with `DB_CONNECT_TIMEOUT` |
| `acquireTimeout` | `10000` | Time to wait for a free pooled connection (ms); override with `DB_ACQUIRE_TIMEOUT` |
| `queryTimeout` | `30000` | Query execution timeout (ms); override with `DB_QUERY_TIMEOUT` |
| `idleTimeout` | `60000` | Idle connection timeout (ms) |

`DB_CONNECT_TIMEOUT`, `DB_ACQUIRE_TIMEOUT`, and `DB_QUERY_TIMEOUT` are read by the indexer's pool with the same names and the same defaults.

## Circuit Breaker

| Parameter | Value | Description |
|---|---|---|
| Threshold | `10` | Consecutive failures before opening the circuit |
| Cooldown | `30000` | Milliseconds before attempting a half-open retry |
| Max retries | `30` | Maximum retry attempts with backoff |
| Backoff range | 500ms–15s | Delay range with jitter |

When the circuit opens, all database queries fail fast until the cooldown period expires. Retries use exponential backoff with jitter to prevent thundering herd.

## Validator Identity

Ed25519 keys are used for P2P message signing and verification:

- **Private key**: 32-byte seed from `SIGNING_PRIVKEY_SECRET` (64 hex chars), wrapped in PKCS8 DER for Node.js crypto.
- **Public key**: extracted as raw 32-byte SPKI, stored as 64 hex chars.
- **Signing**: canonical payload is JSON with sorted fields (`id`, `type`, `sender`, `timestamp`, `data`).
- **Generation**: `ValidatorIdentity.generate()` produces a random keypair.

```javascript
const { ValidatorIdentity } = require('./src/ValidatorIdentity');
const { privkey, pubkey } = ValidatorIdentity.generate();
// privkey: 64-char hex string for SIGNING_PRIVKEY_SECRET
// pubkey:  64-char hex string for registervalidator
```

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
