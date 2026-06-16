<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Hub: Configuration

## Environment Variables

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
| `HUB_DB_PASS` | Yes | None | MariaDB password |

### P2P Gossip Layer

Validator mode is activated when `P2P_VALIDATOR_ADDR` is set. All P2P-dependent subsystems (consensus, oracle, cross-chain, reorg, governance) are no-ops without it.

| Variable | Required | Default | Description |
|---|---|---|---|
| `P2P_VALIDATOR_ADDR` | No | None | This validator's public address. Setting this activates validator mode. |
| `P2P_PORT` | No | `10001` | WebSocket P2P listen port |
| `P2P_HOST` | No | `0.0.0.0` | P2P bind address |
| `SEED_NODES` | No | None | Comma-separated list of peer addresses (e.g., `peer1.example.com:10001,peer2.example.com:10001`) |
| `SIGNING_PRIVKEY_HEX` | No | None | 64-hex-char Ed25519 private key seed for message signing |
| `REQUIRE_SIGNATURES` | No | `false` | When `true`, reject unsigned P2P messages |
| `P2P_HEARTBEAT_INTERVAL` | No | `15000` | Milliseconds between heartbeat broadcasts |
| `P2P_RECONNECT_BASE` | No | `2000` | Base delay for reconnect backoff (ms) |
| `P2P_RECONNECT_MAX` | No | `60000` | Maximum delay for reconnect backoff (ms) |
| `P2P_MSG_DEDUP_TTL` | No | `60000` | Message deduplication cache TTL (ms) |
| `P2P_MAX_PAYLOAD` | No | `1048576` | Maximum WebSocket message size in bytes (1 MB) |
| `HUB_CAPABILITY_CONFIG` | No | None | Path to the capability config JSON (see below). Required for capability qualification + self-tests. |

### Capability Configuration

Capability staking decides which of the four capabilities (`price`, `cross_chain`,
`oracle_publish`, `attestation`) a validator is qualified and ready to serve. The
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

### Oracle

| Variable | Required | Default | Description |
|---|---|---|---|
| `ORACLE_ROUND_INTERVAL` | No | `600000` | Milliseconds between oracle rounds (default: 10 minutes) |
| `ORACLE_SUBMISSION_WINDOW` | No | `180000` | Milliseconds to collect validator price submissions (default: 3 minutes) |
| `ORACLE_FINALIZATION_TIMEOUT` | No | `120000` | Timeout for oracle PBFT finalization round (default: 2 minutes) |
| `COINGECKO_API_KEY` | No | None | CoinGecko API key (optional, improves rate limits) |
| `COINMARKETCAP_API_KEY` | No | None | CoinMarketCap API key (enables second price source) |
| `PRICE_FETCH_TIMEOUT` | No | `10000` | HTTP timeout for external price API calls (ms) |

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

> **Cost note.** Each on-chain checkpoint anchor spends real DOGE on three transactions (BTC + LTC + DOGE checkpoints all broadcast on the DOGE chain). State recovery (`recovery.js`) only needs the **latest** anchored checkpoint per chain, so anchoring every intermediate `checkpoint_seq` is optional. With daily checkpoints (`CHECKPOINT_INTERVAL_BLOCKS=144`), `ANCHOR_CHECKPOINT_EVERY_N=2` halves anchor spend (on-chain recovery point then trails the tip by up to ~2 checkpoint intervals). `checkpoint_seq` is consensus data, so the gate is deterministic across every hub.

### Operator Signer

| Variable | Required | Default | Description |
|---|---|---|---|
| `HUB_SIGNER_MODULE` | No | None | Path to a CommonJS module exporting `walletSign(psbtHex) → Promise<txHex>`. Used by `OraclePublisher` and `AttestationPublisher` to sign DOGE transactions; `StateAnchorPublisher` borrows the same hooks via `_resolveSigner()`. Optional: without it the publishers stay idle. Set-but-unloadable throws at startup (fail loudly). Falls back to `setWalletSignHook` / `setBroadcastHook` if the module is not provided. |

### Cross-Chain

| Variable | Required | Default | Description |
|---|---|---|---|
| `ATTESTATION_TIMEOUT` | No | `60000` | Cross-chain attestation consensus timeout (ms) |

### Reorg

| Variable | Required | Default | Description |
|---|---|---|---|
| `REORG_TIMEOUT` | No | `60000` | Reorg consensus timeout (ms) |

### Governance

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOV_VOTING_PERIOD` | No | `604800000` | Governance voting period in milliseconds (default: 7 days) |

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
| `oracle_submissions` | Raw per-validator price submissions per round: `(round_number, coin_pair, signing_pubkey, price)` |
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
| `connectTimeout` | `10000` | Connection timeout (ms) |
| `idleTimeout` | `60000` | Idle connection timeout (ms) |

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

- **Private key**: 32-byte seed from `SIGNING_PRIVKEY_HEX` (64 hex chars), wrapped in PKCS8 DER for Node.js crypto.
- **Public key**: extracted as raw 32-byte SPKI, stored as 64 hex chars.
- **Signing**: canonical payload is JSON with sorted fields (`id`, `type`, `sender`, `timestamp`, `data`).
- **Generation**: `ValidatorIdentity.generate()` produces a random keypair.

```javascript
const { ValidatorIdentity } = require('./src/ValidatorIdentity');
const { privkey, pubkey } = ValidatorIdentity.generate();
// privkey: 64-char hex string for SIGNING_PRIVKEY_HEX
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
