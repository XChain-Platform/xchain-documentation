<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# E2E Test Suite: Architecture

## Source Files

| File | Role |
|---|---|
| `src/BlockchainConnector.js` | JSON-RPC client for coin node (axios, Basic Auth). Methods: `getNetworkInfo`, `broadcastTx`, `waitForTx`, `getTransactionHex`, `getFeePerKilobyte`, plus reorg primitives (`invalidateBlock`, `reconsiderBlock`, `generateBlock`, etc.) |
| `src/XChainUtxoTrackerConnector.js` | JSON-RPC client for UTXO tracker (axios). Methods: `ping`, `getSyncStatus`, `getQuiescentStatus`, `quiesce`, `getUtxosFromAddress`, `waitForUtxos` |
| `src/XChainEncoderConnector.js` | JSON-RPC client for encoder (axios). Methods: `ping`, `createTx` (13 parameters) |
| `src/XChainDecoderConnector.js` | JSON-RPC client for decoder (axios). Methods: `ping`, `health` |
| `src/XChainIndexerConnector.js` | JSON-RPC client for indexer (axios). Methods: `ping`, `health`, `call`, `getCapabilityValidators`, `getStakeSourceByPubkey`, `waitForIndexedBlock` |
| `src/XChainExplorerConnector.js` | JSON-RPC client for explorer (axios). Methods: `ping` |
| `src/XChainHubConnector.js` | Multi-endpoint failover hub client (axios). Methods: `ping`, `getAllConfig`, `_call`. Static: `parseEndpoints` |
| `src/RegtestMinerConnector.js` | JSON-RPC client for regtest miner (axios). Methods: `ping`, `sendFunds`, `setMiningTime`, `setDefaultMiningTime`, `pauseMining`, `resumeMining`, `generateBlocks` |
| `src/db.js` | MariaDB client with connection pooling and 44 `waitFor*`/`check*` polling methods |
| `src/CryptoNetworks.js` | Static network config provider. Returns `bitcoinjs-lib` network objects for all 9 coin/network combinations |
| `test/cryptoHelper.js` | BIP39/BIP32 wallet generation, address derivation, funded address creation |
| `test/transactionHelper.js` | PSBT construction, signing, broadcast, P2SH two-step handling, UTXO verification cache |
| `test/initialCheck.test.js` | Mocha root hooks (`beforeAll`/`afterAll`): bootstrap sequence, teardown, gas token creation |
| `test/perf/perfCollector.js` | Global singleton for bootstrap phase timing and poll metric collection |
| `test/reporters/performance-reporter.js` | Custom Mocha reporter capturing per-test timing, memory usage, and poll metrics |

## Bootstrap Sequence

The `initialCheck.test.js` `beforeAll` hook executes five named phases, each instrumented via `perfCollector.phase()`:

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: env-resolution                                        │
│  - Read .env via dotenv                                         │
│  - If direct env vars missing → query Hub for service config    │
│  - Set global COIN, NETWORK, COIN_CODE, NETWORK_OBJECT          │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: connector-init                                        │
│  - Instantiate 8 connectors as globals                          │
│  - Create MariaDB connection pool (limit 10)                    │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: service-pings                                         │
│  - Ping all 8 services (node, tracker, encoder, decoder,        │
│    indexer, explorer, DB, miner); throw on failure              │
│  - Configure mining: setMiningTime(1000, 1000)                  │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4: native-fee-price-seed                                 │
│  - Seed XCHAIN/USD and {COIN}/USD prices via nativeFeeHelper    │
│  - Ensures oracle prices are fresh before any action test runs  │
├─────────────────────────────────────────────────────────────────┤
│  Phase 5: gas-token-check                                       │
│  - checkIssue({ tick: 'XCHAIN', status: 'valid' })             │
│  - If not found: fund address, ISSUE XCHAIN token               │
│  - If found: skip (idempotent)                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Transaction Flow

### Standard OP_RETURN Path

```
cryptoHelper.getNewFundedAddress()
    │
    ├── getNewAddress() → BIP39 mnemonic → BIP32 derivation → P2PKH address
    ├── regtestMinerConnector.sendFunds(address, amount)
    ├── nodeConnector.waitForTx(txid) → poll until confirmed
    └── utxoTrackerConnector.waitForUtxos(address) → poll until indexed
            │
            ▼
transactionHelper.createAndSendTransaction(addressInfo, message)
    │
    ├── encoderConnector.createTx(utxos, pubkey, ..., data, ..., changeAddress)
    │       → returns { encoding: 'opreturn', psbt: hex }
    ├── Psbt.fromHex() → signInput() → finalizeAllInputs() → extractTransaction()
    ├── nodeConnector.broadcastTx(txHex)
    ├── nodeConnector.waitForTx(txHash, 60000)
    └── utxoTrackerConnector.getUtxosFromAddress() → filter confirmed → cache
            │
            ▼
indexerDatabase.waitForIssue({ source, tick, txHash, status: 'valid' })
    │
    └── polls every 1s for up to 30s → returns row or null
```

### P2SH Two-Step Path

When the encoder returns `encoding: "P2SH"`, `transactionHelper` automatically handles the two-transaction flow:

1. **First PSBT**: creates the P2SH output (fund transaction)
2. Sign with standard `finalizeAllInputs()`
3. Broadcast first transaction
4. **Second PSBT**: calls `encoderConnector.createTx()` again with `p2shHash` and `p2shHex` from the first transaction
5. Sign with `xchainP2shFinalizer` (custom finalizer applying witness/redeem scripts)
6. Broadcast second transaction
7. Wait for both transactions to confirm
8. Return the second transaction's hash (the one the indexer processes)

## UTXO Verification Cache

`transactionHelper` maintains a per-address cache of confirmed UTXOs:

```
_verifiedUtxos:        array of confirmed UTXOs from the last transaction
_verifiedUtxosAddress: address the cache belongs to
```

**Cache lifecycle:**
1. After broadcasting, poll `getUtxosFromAddress()` and filter to `confirmations > 0`
2. If any UTXO matches the broadcast `txHash`, save the confirmed set to cache
3. On the next `createAndSendTransaction()` for the same address, pass cached UTXOs directly to the encoder (bypassing the tracker fetch)
4. Cache is consumed (cleared) after use

This prevents the encoder from selecting stale mempool entries that may persist for up to 60 seconds in the UTXO tracker's cleanup cycle.

## Polling Architecture

### Database Class (`db.js`)

The `Database` class maintains a MariaDB connection pool and provides two methods for each ACTION type:

| Method Pattern | Behavior |
|---|---|
| `checkIssue(filterObj)` | Single query. Builds parameterized `WHERE` clause from non-null filter fields. Returns first row or `null`. Releases connection. |
| `waitForIssue(filterObj, timeMax)` | Polls `checkIssue()` every 1 second until a row is found or `timeMax` (default 30s) is exceeded. Records performance metrics. |

**WHERE clause construction:**
- Each non-null field in the filter object adds a `column = ?` clause
- Values are passed as parameterized query parameters (SQL injection safe)
- `isNullOrNullString(value)` uses loose equality (`== null || == ""`) to skip null-like fields

**44 polling methods** cover: issues, sends, credits, debits, mints, broadcasts, lists, airdrops, dispensers, dispenser statuses, dispenses, address options, destroys, messages, prices, files, sleeps, sweeps, dividends, callbacks, orders, order matches, swaps, swap matches, batches, links, coinpays, coinpay obligations, contracts, executions, deposits, withdrawals, stakes, unstakes, delegations, stake-key revocations, contract-stakes, contract-unstakes, contract-delegations, slash events, attestation requests, attestation responses, reward claims.

## Hub Discovery

When direct environment variables are not set, the bootstrap sequence discovers service endpoints from xchain-hub:

1. Parse hub endpoints from `HUB_VALIDATORS` (comma-separated) or `HUB_URL`/`HUB_PORT`
2. Instantiate `XChainHubConnector` with the endpoint array
3. Call `getAllConfig()` → returns `config[coin][network][service][param]`
4. Extract host/port for each service from the hub config
5. Override all URLs to `"localhost"` (Docker Compose convention, services are accessed via Docker network, not hub-reported hostnames)

The `XChainHubConnector._call()` method implements multi-endpoint failover: it tries each URL in order, moving to the next on connection failure.

## Wallet Management

`cryptoHelper.js` manages test wallets through a global cache (`global.wallets`):

| Operation | Behavior |
|---|---|
| `getWallet(label)` | Returns cached wallet or creates a new skeleton (`{ mnemonic: null, seed: null, coin: null, network: null, addresses: [] }`) |
| `getNewAddress(label, coin, network, mnemonic, addressType, addressIndex)` | Generates BIP39 mnemonic (if not cached), derives BIP32 path `m/44'/0'/0'/0/{index}`, returns `{ mnemonic, privateKey, publicKey, address }` |
| `getNewFundedAddress(...)` | Calls `getNewAddress`, then funds via regtest miner, waits for transaction confirmation and UTXO indexing |

**Memory cleanup:** During `afterAll`, all wallet seeds and private keys are zeroed via `Buffer.fill(0)`, then `global.wallets` is set to `{}`.

## Test File Organization

```
xchain-e2e-test/
├── src/                          # Service connector classes (10 files)
├── test/
│   ├── initialCheck.test.js      # Mocha root hooks (beforeAll/afterAll)
│   ├── cryptoHelper.js           # BIP39/BIP32 wallet management
│   ├── transactionHelper.js      # PSBT construction, signing, broadcast
│   ├── actions/                  # 59 action test files (live, ordered)
│   ├── helpers/                  # 36 modules (action helpers + federation/fee/utility helpers)
│   ├── unit/                     # 360 unit tests (stubbed, no services)
│   ├── integration/              # 72 integration tests (stubbed I/O)
│   │   ├── fixtures/             # mockMariadb, services, dbRows, hub
│   │   ├── setup/                # Bootstrap, teardown tests
│   │   ├── pipeline/             # Funding flow, tx flow tests
│   │   ├── helpers/              # Action helper pipeline tests
│   │   ├── database/             # Connection pool, polling tests
│   │   ├── errors/               # Error handling tests
│   │   └── state/                # UTXO cache, wallet cache tests
│   ├── e2e/                      # 37 E2E tests (live services)
│   ├── smoke/                    # 16 smoke tests (quick checks)
│   ├── boundary/                 # 144 boundary tests
│   ├── chaos/                    # 77 chaos tests
│   ├── fuzz/                     # 53 fuzz tests (fast-check)
│   ├── regression/               # 114 regression tests (P0/P1/P2 tagged)
│   ├── perf/                     # Performance collector singleton
│   └── reporters/                # Custom Mocha reporter
├── scripts/                      # Mutation report, perf gate
├── stryker.config.mjs            # Phase 1: mutation testing (unit)
└── stryker.phase2.config.mjs     # Phase 2: mutation testing (unit + integration)
```

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
