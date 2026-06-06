<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Hub — Operations

## Prerequisites

- Node.js >= 18
- MariaDB server
- For validator mode: seed node addresses, Ed25519 private key, price API keys

## Running the Hub

```bash
npm run api
# or directly:
node ./src/api.js
```

On startup, the hub:
1. Loads environment variables from `.env`
2. Creates the MariaDB database if it doesn't exist
3. Creates all tables if they don't exist
4. Starts the `PriceAggregator` (always available — receives PRICE actions pushed by indexers)
5. Starts the `HubDbBroadcaster` and wires it to PriceAggregator's `row:inserted` events
6. Starts the Express JSON-RPC API server with HTTP + WebSocket upgrade handler
7. If `P2P_VALIDATOR_ADDR` is set, activates the full validator stack:
   - P2P gossip layer (WebSocket mesh)
   - PBFT consensus engine
   - Oracle round system (price fetching + aggregation, signs canonical PRICE v0 payload)
   - `OraclePublisher` (`oracle_publish` capability publisher: leader rotation, persistent JSONL queue, DOGE broadcast)
   - Cross-chain attestation engine
   - Reorg handler
   - Governance engine
   - Reward tracker (pushes rewards to BTC indexer) and slash detector

## Operating Modes

### Standalone Mode

Without `P2P_VALIDATOR_ADDR`, the hub runs as a simple config oracle. Config reads and writes go directly to the database without consensus. This mode is suitable for development, testing, or single-instance deployments.

### Validator Mode

With `P2P_VALIDATOR_ADDR` set, the hub joins the P2P validator network. All config writes go through PBFT consensus, price data is aggregated from multiple validators, and cross-chain actions are attested by a quorum. This mode requires:
- `SIGNING_PRIVKEY_HEX` — Ed25519 private key for signing messages
- `SEED_NODES` — comma-separated list of peer addresses to bootstrap the mesh
- `ORACLE_EPOCH_START` — oracle round-numbering anchor (Unix ms), **identical across the federation**
- `HUB_CAPABILITY_CONFIG` — path to the capability config JSON: `MIN_STAKE` thresholds + per-capability self-test config blocks (see CONFIGURATION.md)
- At least one price API key (`COINGECKO_API_KEY` or `COINMARKETCAP_API_KEY`)

#### Recommended: set up a validator with xchain-node

`xchain-node` automates the validator setup so you don't hand-assemble env vars or keys:

```bash
# 1. Generate a signing key + starter capability config (offline, no stack needed)
xchain-node validator init \
  --seed-nodes seed1.example:10001,seed2.example:10001 \
  --p2p-addr <your-public-host>:10001 \
  --oracle-epoch-start <shared-federation-unix-ms> \
  --capabilities price,cross_chain,oracle_publish,attestation

# It prints your PUBKEY. Stake XCHAIN to that pubkey (STAKE v1) to meet each
# capability's MIN_STAKE threshold.

# 2. Edit the generated config/validator/capabilities.json — set real
#    cross_chain RPC endpoints and oracle_publish DOGE address/wallet.

# 3. Install/start the hub — it now boots in validator mode with your key +
#    capability config mounted automatically.
xchain-node install master xchain-hub

# Check what you configured at any time:
xchain-node validator status
```

A validator only *qualifies* for a capability once its on-chain stake to the
pubkey meets that capability's `MIN_STAKE`, **and** the local self-test for that
capability passes (which needs the config block in `capabilities.json`). A
qualified-but-not-ready validator is still counted in quorum `N`, so a
misconfigured node that skips rounds will accrue non-participation slashing —
keep `capabilities.json` correct, or list capabilities you don't serve under
`DISABLED_CAPABILITIES`.

## Docker

The hub is designed to run inside Docker. The Dockerfile copies source to `/XChainHub/`:

```dockerfile
FROM node:latest
COPY ./src /XChainHub/src
COPY package.json /XChainHub/
WORKDIR /XChainHub
RUN npm install
CMD ["npm", "run", "api"]
```

In production, the hub is typically managed by `xchain-node`, which handles container lifecycle, environment variable injection, and network configuration.

## Multi-Instance Deployment

Multiple hub instances can run against the same MariaDB database for high availability. In validator mode, instances also form a P2P mesh for consensus.

Consumer services specify multiple hub endpoints via `HUB_VALIDATORS`:

```env
HUB_VALIDATORS=hub1.local:10000,hub2.local:10000,hub3.local:10000
```

Consumers try each endpoint in order and fall back to the next if one is unreachable. If `HUB_VALIDATORS` is not set, consumers use the legacy `HUB_API_HOST:HUB_PORT` variables.

## API

The hub exposes a JSON-RPC 2.0 API on the configured `HUB_PORT`. See [API Reference](API.md) for full method documentation.

### Health Check

```bash
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","id":1}'
```

### Authentication

Write methods (`updateconfig`, `registervalidator`, `syncvalidators`, `requestattestation`, `initiateswap`, `reportreorg`, `propose`, `vote`) require an `X-API-Key` header if `HUB_API_KEY` is set. If no API key is configured, all methods are open.

### Rate Limiting

The API is rate-limited to 100 requests per minute per IP (configurable via `HUB_RATE_LIMIT_RPM`). Exceeding the limit returns HTTP 429.

## Resilience and Recovery

### Database Connection Recovery

The `Database` class includes a circuit breaker pattern for connection management:

- **Closed** (normal): Connections proceed normally
- **Open** (failing): After consecutive failures, the circuit opens and rejects connections for a cooldown period
- **Half-open** (testing): After the cooldown, a single connection attempt is allowed; success closes the circuit, failure re-opens it

Connection retries use exponential backoff.

### Database Verification on Startup

On startup, the hub retries database connections with a delay between attempts. This allows the hub to start before the database is fully available (common in Docker orchestration).

### P2P Reconnection

The P2P gossip layer automatically reconnects to peers with exponential backoff:
- Base delay: 2 seconds (configurable via `P2P_RECONNECT_BASE`)
- Maximum delay: 60 seconds (configurable via `P2P_RECONNECT_MAX`)
- Dead connection detection via heartbeat/ping-pong (interval: 15 seconds)

### Single-Node Fallback

When no peers are connected, all consensus-dependent operations (config writes, oracle finalization, attestation, governance) fall back to direct execution. This ensures the hub remains functional even when temporarily isolated from the network.

### Message Deduplication

The P2P layer deduplicates messages using a TTL cache (default: 60 seconds). This prevents message storms from looping through the gossip mesh.

## Troubleshooting

### Hub won't start

- Verify all required environment variables are set (`HUB_PORT`, `HUB_DB_HOST`, `HUB_DB_PORT`, `HUB_DB_NAME`, `HUB_DB_USER`, `HUB_DB_PASS`)
- Confirm MariaDB is reachable at the configured host and port
- Check that the database user has CREATE DATABASE and CREATE TABLE privileges. On first run the hub creates its own database; if the user lacks that privilege the hub now **exits immediately** with a `Fatal DB error … cannot create the database` message (rather than retrying forever). Either grant the privilege or pre-create the database and grant `ALL` on it.

### Validator mode not activating

- Ensure `P2P_VALIDATOR_ADDR` is set — this is the single switch that activates validator mode
- Verify `SIGNING_PRIVKEY_HEX` is a valid 64-character hex string (Ed25519 seed)
- Check that `SEED_NODES` contains reachable peer addresses
- Set `ORACLE_EPOCH_START` (Unix ms) — the hub refuses to start validator mode without it

### Validator qualifies but never participates (and gets slashed)

- This means the capability **self-test** is failing. Provide `HUB_CAPABILITY_CONFIG` with the per-capability config blocks (`price.sources`, `cross_chain.chains[*].rpc`, `oracle_publish.doge_address`/`doge_wallet`). Startup logs each failing self-test with the reason.
- Confirm `CAPABILITIES.<cap>.MIN_STAKE` is set for every capability you intend to serve — without a configured threshold the hub treats the capability as **not qualified** (fail-closed; it no longer defaults to a 0 threshold).
- For capabilities you deliberately don't serve, add them to `DISABLED_CAPABILITIES` so the federation doesn't expect participation.

### Oracle rounds not producing prices

- Verify at least one price API key is configured (`COINGECKO_API_KEY` or `COINMARKETCAP_API_KEY`)
- Check `ORACLE_MIN_SUBMISSIONS` — if set higher than the number of connected validators, rounds will not finalize
- Verify peers are connected via `getvalidators` API call
- Check `PRICE_FETCH_TIMEOUT` — external API calls timeout after 10 seconds by default

### Cross-chain attestations stuck at pending

- Verify enough validators support both chains in the chain pair (quorum requires 2f+1)
- Check confirmation thresholds: BTC/LTC require 3 confirmations, DOGE requires 6
- Ensure `PBFT_TIMEOUT` is sufficient for consensus rounds to complete

### Governance proposals not passing

- Proposals require 2/3+ validator approval
- Voting period defaults to 7 days (`GOV_VOTING_PERIOD`)
- Parameter changes are bounded: normal params ±50% increase / -33% decrease; slashing params ±25% increase / -20% decrease
- Rejected parameters have a 14-day cooldown before re-proposal

### Consumers not discovering hub

- Ensure `HUB_VALIDATORS` is set on the consumer side (comma-separated endpoints)
- Verify the hub's `HUB_PORT` matches the port in consumer config
- Check that `CORS_ORIGIN` is configured if consumers are browser-based

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
