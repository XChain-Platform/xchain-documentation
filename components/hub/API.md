<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Hub — API Reference

All methods are called via HTTP POST with JSON-RPC 2.0 format:

```bash
curl -X POST http://localhost:10000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ping","id":1}'
```

## Config Management

### `ping`

Health check.

**Request:**
```json
{"jsonrpc":"2.0","method":"ping","id":1}
```

**Response:**
```json
{"status":"success"}
```

### `getallconfigs`

Returns all service configs as a nested object: `{ coin: { network: { module: { param: value } } } }`.

**Request:**
```json
{"jsonrpc":"2.0","method":"getallconfigs","id":1}
```

**Response:**
```json
{
  "bitcoin": {
    "mainnet": {
      "xchain-decoder": {
        "host": "192.168.1.10",
        "port": "8332",
        "db_host": "mariadb",
        "db_port": "3306",
        "name": "XChain_BTC_Mainnet_Decoder",
        "user": "xchain_decoder",
        "pass": "password"
      },
      "xchain-indexer": { ... },
      "xchain-explorer": { ... }
    },
    "testnet": { ... }
  },
  "litecoin": { ... },
  "dogecoin": { ... }
}
```

### `updateconfig`

Upserts service configs from a nested JSON object. In validator mode, the write goes through PBFT consensus. In standalone mode, it writes directly to MariaDB.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"updateconfig",
  "params":{
    "config":{
      "BTC":{
        "mainnet":{
          "xchain-decoder":{
            "host":"192.168.1.10",
            "port":"8332"
          }
        }
      }
    }
  },
  "id":1
}
```

**Response:**
```json
{"status":"success"}
```

Config parameters stored per `coin/network/module`: `host`, `port`, `service_port`, `db_host`, `db_port`, `name`, `user`, `pass`.

## Validator Management

### `registervalidator`

Bootstrap-register a validator. The signing public key must be a 64-character hex string (Ed25519 public key).

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"registervalidator",
  "params":{
    "signing_pubkey":"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "addr":"validator1.example.com"
  },
  "id":1
}
```

**Response:**
```json
{"status":"success"}
```

### `syncvalidators`

Bulk sync the validator set from external staking data (e.g., from the indexer). Replaces the current set and reloads all subsystem validator sets.

Each validator object carries `signing_pubkey`, `addr`, `status`, and an optional comma-separated `chains` list (used for cross-chain quorum filtering; omit or leave empty to support all chains). Validator **capabilities** (`price`, `cross_chain`, `oracle_publish`, `attestation`) are **not** part of this object — a pubkey auto-qualifies for each capability whose governance-configured minimum stake its aggregate active stake meets. There is no `tier` field.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"syncvalidators",
  "params":{
    "validators":[
      {"signing_pubkey":"a1b2c3...","addr":"validator1.example.com","status":"active","chains":"BTC,LTC"},
      {"signing_pubkey":"d4e5f6...","addr":"validator2.example.com","status":"active","chains":"BTC,LTC,DOGE"}
    ]
  },
  "id":1
}
```

**Response:**
```json
{"status":"success","count":2}
```

### `getvalidators`

List all active validators.

**Request:**
```json
{"jsonrpc":"2.0","method":"getvalidators","id":1}
```

**Response:**
```json
[
  {"signing_pubkey":"a1b2c3...","addr":"validator1.example.com","status":"active","chains":"BTC,LTC"},
  {"signing_pubkey":"d4e5f6...","addr":"validator2.example.com","status":"active","chains":"BTC,LTC,DOGE"}
]
```

### `getvalidatorstatus`

Detailed status for a specific validator: info, unclaimed rewards, recent rewards, and slash proposals.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getvalidatorstatus",
  "params":{"signing_pubkey":"a1b2c3..."},
  "id":1
}
```

**Response:**
```json
{
  "validator": {"signing_pubkey":"a1b2c3...","addr":"validator1.example.com","status":"active"},
  "unclaimed_rewards": "150.00000000",
  "recent_rewards": [...],
  "slash_proposals": [...]
}
```

## Oracle / Price Data

### `getoraclesubmissions`

Diagnostic method returning current round submissions per validator.

**Request:**
```json
{"jsonrpc":"2.0","method":"getoraclesubmissions","id":1}
```

**Response:**
```json
[
  {"round_number":42,"coin_pair":"BTC/USD","signing_pubkey":"a1b2c3...","price":"67500.00"},
  {"round_number":42,"coin_pair":"LTC/USD","signing_pubkey":"a1b2c3...","price":"85.50"}
]
```

### `getpricesnapshots`

Returns recent finalized price snapshots.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getpricesnapshots",
  "params":{"limit":10},
  "id":1
}
```

**Response:**
```json
[
  {"round_number":42,"coin_pair":"BTC/USD","price":"67500.00","status":"finalized","created_at":"2026-04-06T12:00:00.000Z"},
  {"round_number":42,"coin_pair":"LTC/USD","price":"85.50","status":"finalized","created_at":"2026-04-06T12:00:00.000Z"},
  {"round_number":42,"coin_pair":"DOGE/USD","price":"0.0825","status":"finalized","created_at":"2026-04-06T12:00:00.000Z"}
]
```

### `getprice`

Returns the latest finalized price for a specific coin pair.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getprice",
  "params":{"coin_pair":"BTC/USD"},
  "id":1
}
```

**Response:**
```json
{"coin_pair":"BTC/USD","price":"67500.00","round_number":42,"status":"finalized"}
```

### `pushchaintip` (write — requires API key)

Pushes a chain tip update from an indexer. The hub uses this to anchor oracle rounds to the BTC chain tip (replacing the hardcoded `reference_block=0` bug).

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"pushchaintip",
  "params":{"coin":"BTC","block_height":850010,"block_time":1712500000},
  "id":1
}
```

**Response:**
```json
{"status":"success"}
```

Stored in the `configs` table as `(coin, mainnet, chain_tips, block_height|block_time)`. Read by `OracleRound._executeRound()` at the start of each PBFT round.

### `pushpriceround` (write — requires API key)

Pushes a validated PRICE v0 round from an indexer for cross-chain aggregation. The hub deduplicates by `round_number` (first valid submission wins) and writes to `price_snapshots`.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"pushpriceround",
  "params":{
    "source_chain":"DOGE",
    "round":850010,
    "timestamp":1712500000,
    "pairs":[{"pair":"BTC/USD","price":"100000.12345678"},{"pair":"BTC/EUR","price":"92000.00000000"}],
    "sigs":[{"pubkey":"aabb...","sig":"ccdd..."}],
    "action_index":12345,
    "block_index":850010
  },
  "id":1
}
```

**Response:**
```json
{"accepted":true}
```

Or `{"accepted":false,"reason":"duplicate"}` if the round already exists. The indexer must validate PBFT signatures locally **before** pushing — the hub trusts indexer validation.

### `pushoracleprice` (write — requires API key)

Pushes a validated PRICE v1 user oracle price from an indexer. The hub applies the 24-hour lock window and writes to `oracle_prices`.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"pushoracleprice",
  "params":{
    "source_chain":"DOGE",
    "source_address":"D1xx...",
    "coin":"BTC",
    "tick":"PEPECASH",
    "fiat":"JPY",
    "value":"7.50000000",
    "fee":"0.01",
    "memo":"hourly update",
    "block_time":1712500000,
    "action_index":12345
  },
  "id":1
}
```

**Response:**
```json
{"accepted":true}
```

The hub looks up any prior price for `(source_address, coin, tick, fiat)`. First broadcast: `effective_at = block_time` (immediate). Subsequent updates: `effective_at = block_time + 86400` (24-hour delay).

## Hub DB Sync (REST + WebSocket)

The hub exposes a separate channel for replicating cross-chain infrastructure tables (`price_snapshots`, `oracle_prices`) to indexers' local hub DB copies. Used in geographically distributed deployments where indexers run on different hosts from the hub.

### `GET /hub-db/snapshot/price_snapshots`

Returns rows from the `price_snapshots` table after `since_id` (paginated for incremental bootstrap).

**Query parameters:**
- `since_id` (optional, default 0) — return rows where `id > since_id`
- `limit` (optional, default 10000, max 10000)

**Response:**
```json
{
  "table": "price_snapshots",
  "rows": [
    {"id":1,"round_number":850010,"coin_pair":"BTC/USD","price":"100000.12345678","reference_block":850010,"reference_chain":"BTC","block_timestamp":1712500000,"validator_count":5,"consensus_round":1,"consensus_proof":"[...]","status":"finalized","source_chain":"DOGE","source_action_index":12345,"created_at":"2026-04-06T12:00:00.000Z"}
  ],
  "count": 1
}
```

### `GET /hub-db/snapshot/oracle_prices`

Returns rows from the `oracle_prices` table after `since_id`. Same format as above.

### `GET /hub-db/subscribe` (WebSocket upgrade — requires `Authorization: Bearer <HUB_API_KEY>`)

WebSocket channel that pushes `row:inserted` events whenever the hub inserts new `price_snapshots` or `oracle_prices` rows. Each subscriber receives a JSON message per insertion:

**Message format:**
```json
{"type":"row:inserted","table":"price_snapshots","row":{...}}
```

Indexers use the bootstrap REST snapshots followed by this WebSocket subscription to maintain a complete local copy of the hub's cross-chain price tables. Backpressure handling drops connections that exceed `WS_BACKPRESSURE_LIMIT` buffered messages.

## Fee Quotes

### `getfeequote`

Calculates the native coin fee amount for a given action. Converts gas units → XCHAIN amount → native coin amount using the latest oracle price.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getfeequote",
  "params":{"action":"ISSUE","chain":"BTC"},
  "id":1
}
```

**Response:**
```json
{
  "action":"ISSUE",
  "chain":"BTC",
  "gas_units":1000,
  "xchain_amount":"10.00000000",
  "native_amount":"0.00014815"
}
```

Supported action names: `ISSUE`, `ISSUE_SUBTOKEN`, `VM_EXECUTE_BASE`, `VM_DEPLOY_BASE`, `AIRDROP_PER_RECIPIENT`, and others matching the platform's gas fee schedule.

## Cross-Chain Attestations

### `requestattestation`

Initiates a PBFT attestation consensus round for a cross-chain action.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"requestattestation",
  "params":{
    "source_chain":"bitcoin",
    "source_action_index":12345,
    "dest_chain":"litecoin"
  },
  "id":1
}
```

**Response:**
```json
{"status":"success","attestation_id":"bitcoin:12345:litecoin"}
```

### `getattestation`

Get a specific attestation record by source chain and action index.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getattestation",
  "params":{
    "source_chain":"bitcoin",
    "source_action_index":12345
  },
  "id":1
}
```

**Response:**
```json
{
  "attestation_id":"bitcoin:12345:litecoin",
  "source_chain":"bitcoin",
  "source_action_index":12345,
  "dest_chain":"litecoin",
  "status":"attested",
  "consensus_proof":{...}
}
```

### `getattestations`

Query attestation records by status.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getattestations",
  "params":{"status":"attested","limit":50},
  "id":1
}
```

**Response:**
```json
[
  {"attestation_id":"bitcoin:12345:litecoin","status":"attested",...},
  {"attestation_id":"bitcoin:12340:dogecoin","status":"attested",...}
]
```

## Swap Tracking

### `initiateswap`

Record a cross-chain swap initiation. The swap auto-progresses to "attested" when the corresponding attestation finalizes.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"initiateswap",
  "params":{
    "source_chain":"bitcoin",
    "source_action_index":12345,
    "dest_chain":"litecoin",
    "dest_action_index":67890
  },
  "id":1
}
```

**Response:**
```json
{"status":"success"}
```

### `getswap`

Get a specific swap record.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getswap",
  "params":{
    "source_chain":"bitcoin",
    "source_action_index":12345
  },
  "id":1
}
```

**Response:**
```json
{
  "source_chain":"bitcoin",
  "source_action_index":12345,
  "dest_chain":"litecoin",
  "dest_action_index":67890,
  "status":"attested"
}
```

### `getswaps`

Query swap records by status.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getswaps",
  "params":{"status":"initiated","limit":50},
  "id":1
}
```

Swap statuses: `initiated`, `attested`, `executed`, `settled`, `failed`.

## Reorg Handling

### `reportreorg`

Report a detected blockchain reorg. Triggers PBFT consensus and hub state rollback if confirmed.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"reportreorg",
  "params":{
    "chain":"bitcoin",
    "reorg_height":893000,
    "timestamp":1743690000
  },
  "id":1
}
```

**Response:**
```json
{"status":"success"}
```

### `getreorghistory`

Query confirmed reorg attestation history.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getreorghistory",
  "params":{"limit":20},
  "id":1
}
```

**Response:**
```json
[
  {"chain":"bitcoin","reorg_height":893000,"timestamp":1743690000,"confirmed_at":"2026-04-06T12:00:00.000Z"}
]
```

## Governance

### `propose`

Submit a governance proposal for a parameter change. Must be an active validator.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"propose",
  "params":{
    "parameter":"ORACLE_ROUND_INTERVAL",
    "current_value":"600000",
    "proposed_value":"300000",
    "rationale":"Faster oracle updates for improved price freshness"
  },
  "id":1
}
```

**Response:**
```json
{"status":"success","proposal_id":1}
```

### `vote`

Cast a vote on an active governance proposal. Must be an active validator.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"vote",
  "params":{
    "proposal_id":1,
    "vote":"approve"
  },
  "id":1
}
```

Vote values: `approve`, `reject`.

**Response:**
```json
{"status":"success"}
```

### `getproposals`

List governance proposals, optionally filtered by status.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getproposals",
  "params":{"status":"voting"},
  "id":1
}
```

**Response:**
```json
[
  {
    "proposal_id":1,
    "parameter":"ORACLE_ROUND_INTERVAL",
    "current_value":"600000",
    "proposed_value":"300000",
    "rationale":"Faster oracle updates for improved price freshness",
    "proposer":"a1b2c3...",
    "status":"voting",
    "created_at":"2026-04-06T12:00:00.000Z"
  }
]
```

Proposal statuses: `voting`, `passed`, `failed`.

### `getproposal`

Get a specific proposal with all associated votes.

**Request:**
```json
{
  "jsonrpc":"2.0",
  "method":"getproposal",
  "params":{"proposal_id":1},
  "id":1
}
```

**Response:**
```json
{
  "proposal": {
    "proposal_id":1,
    "parameter":"ORACLE_ROUND_INTERVAL",
    "current_value":"600000",
    "proposed_value":"300000",
    "status":"voting"
  },
  "votes": [
    {"signing_pubkey":"a1b2c3...","vote":"approve"},
    {"signing_pubkey":"d4e5f6...","vote":"reject"}
  ]
}
```

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
