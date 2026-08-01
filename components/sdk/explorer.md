<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK: Explorer Reference

## Overview

The SDK's explorer client wraps the xchain-explorer REST API, providing typed methods for every query endpoint. All methods return parsed JSON and raise typed `SDKExplorerError` exceptions on failure.

The explorer client is instantiated automatically when `network` is provided in the SDK options. The correct coin prefix for all URL paths is derived from the `network` string, you never construct paths manually.

```js
const sdk = new XChainSDK({
    network:      'bitcoin-mainnet',
    explorerUrl:  'localhost',
    explorerPort: 8080
});

// Access explorer methods directly on the SDK instance
let balances = await sdk.explorer.getBalances('bc1q...');
```

---

## Coin Prefix Mapping

The `network` option controls which coin prefix is prepended to every API path (`/{PREFIX}/api/...`).

| Network string | Prefix |
|---|---|
| `bitcoin-mainnet` | `BTC` |
| `bitcoin-testnet` | `TBTC` |
| `bitcoin-regtest` | `RBTC` |
| `litecoin-mainnet` | `LTC` |
| `litecoin-testnet` | `TLTC` |
| `litecoin-regtest` | `RLTC` |
| `dogecoin-mainnet` | `DOGE` |
| `dogecoin-testnet` | `TDOGE` |
| `dogecoin-regtest` | `RDOGE` |

Passing an unrecognised network string throws `SDKExplorerError` with code `INVALID_NETWORK` at construction time.

---

## Pagination Options

Methods marked with `opts?` accept an optional query-options object for pagination and ordering. All fields are optional.

| Field | Type | Description |
|---|---|---|
| `page` | number | Page number (1-based) |
| `limit` | number | Results per page |
| `sortorder` | string | `'ASC'` or `'DESC'` |
| `start` | number | Row offset (alternative to `page`) |
| `length` | number | Row count (alternative to `limit`) |

```js
let sends = await sdk.explorer.getSends('bc1q...', 'address', {
    page: 2,
    limit: 25,
    sortorder: 'DESC'
});
```

---

## Methods

### Balance & Address

#### `getBalances(address, opts?)`
Returns all token balances held by an address.

- **Endpoint:** `GET /{COIN}/api/balances/{address}`  
- **`opts`:** pagination supported

#### `getAddress(address, opts?)`
Returns address summary information (total activity, first/last seen, etc.).

- **Endpoint:** `GET /{COIN}/api/address/{address}`
- **`opts`:** pagination supported

#### `getHolders(tick, opts?)`
Returns a ranked list of holders for the given token ticker.

- **Endpoint:** `GET /{COIN}/api/holders/{tick}`  
- **`opts`:** pagination supported

#### `getCredits(query, type, opts?)`
Returns credit records (incoming transfers, mints, airdrops, etc.) filtered by the given query and type.

- **Endpoint:** `GET /{COIN}/api/credits/{query}/{type}`  
- **`type` values:** `block`, `address`  
- **`opts`:** pagination supported

#### `getDebits(query, type, opts?)`
Returns debit records (outgoing transfers, destroys, fees, etc.).

- **Endpoint:** `GET /{COIN}/api/debits/{query}/{type}`  
- **`type` values:** `block`, `address`  
- **`opts`:** pagination supported

#### `getEscrows(query, type, opts?)`
Returns escrow records (tokens locked in dispensers or orders).

- **Endpoint:** `GET /{COIN}/api/escrows/{query}/{type}`  
- **`type` values:** `block`, `address`  
- **`opts`:** pagination supported

---

### Token

#### `getToken(tick)`
Returns full token information for the given ticker: supply, divisibility, owner, description, and metadata.

- **Endpoint:** `GET /{COIN}/api/token/{tick}`

#### `getProject(tick)`
Returns the current official-token roster of a project tick; the owner-attested LIST that carries the green-banner designation (see [Project Registry](../../protocol/project-registry.md)). Returns HTTP 400 (throws `SDKExplorerError` with code `EXPLORER_HTTP_400`) when the tick has no owner-attested roster.

- **Endpoint:** `GET /{COIN}/api/project/{tick}`

#### `getTokens(query, type, opts?)`
Returns a list of tokens filtered by block, issuing address, parent token, or subtoken relationship.

- **Endpoint:** `GET /{COIN}/api/tokens/{query}/{type}`  
- **`type` values:** `block`, `address`, `token`, `subtoken`  
- **`opts`:** pagination supported

#### `getIssues(query, type, opts?)`
Returns ISSUE action records (token creation and additional issuance events).

- **Endpoint:** `GET /{COIN}/api/issues/{query}/{type}`  
- **`type` values:** `block`, `address`, `token`  
- **`opts`:** pagination supported

---

### Transaction & History

#### `getTransaction(query, type)`
Returns a decoded XChain transaction.

- **Endpoint:** `GET /{COIN}/api/transaction/{query}/{type}`  
- **`type` values:** `tx_hash`, `tx_index`

#### `getAction(actionIndex)`
Returns a single XChain action by its cross-chain action index.

- **Endpoint:** `GET /{COIN}/api/action/{actionIndex}`

#### `getBlock(blockIndex)`
Returns block-level summary and the list of XChain actions in that block.

- **Endpoint:** `GET /{COIN}/api/block/{blockIndex}`

#### `getHistory(query, type, opts?)`
Returns a unified history of all XChain activity matching the query.

- **Endpoint:** `GET /{COIN}/api/history/{query}/{type}`  
- **`type` values:** `block`, `address`, `token`, `recent`  
- **`opts`:** pagination supported

---

### ACTION-Specific Query Methods

The 20 primary action-specific methods share the same signature:

```
get<Action>(query, type, opts?) → GET /{COIN}/api/<action>s/{query}/{type}
```

Each returns records of the corresponding ACTION type. Pagination is supported via `opts`.

| Method | Endpoint path segment | Notes |
|---|---|---|
| `getAddresses(query, type, opts?)` | `/addresses/` | ADDRESS action records |
| `getAirdrops(query, type, opts?)` | `/airdrops/` | AIRDROP action records |
| `getBatches(query, type, opts?)` | `/batches/` | BATCH action records |
| `getBetFeeds(query, type, opts?)` | `/bet_feeds/` | BET markets (`type`: `block`, `address`, `source`, `token`, `status`) |
| `getBetFeed(index, opts?)` | `/bet_feed/` | One market by `FEED_ACTION_INDEX`: feed row, per-outcome pools, counts, status timeline |
| `getBets(query, type, opts?)` | `/bets/` | Bet records (`type`: `block`, `address`, `feed`, `token`, `status`) |
| `getOracleStats(address, opts?)` | `/oracle/` | An oracle's track record, fees earned, and active markets. Per-address and resettable, so an empty record means unknown, not safe |
| `getBroadcasts(query, type, opts?)` | `/broadcasts/` | BROADCAST action records |
| `getCallbacks(query, type, opts?)` | `/callbacks/` | CALLBACK action records |
| `getDestroys(query, type, opts?)` | `/destroys/` | DESTROY action records |
| `getDispensers(query, type, opts?)` | `/dispensers/` | DISPENSER action records |
| `getDispenses(query, type, opts?)` | `/dispenses/` | DISPENSE event records |
| `getDividends(query, type, opts?)` | `/dividends/` | DIVIDEND action records |
| `getFees(query, type, opts?)` | `/fees/` | FEE records |
| `getFiles(query, type, opts?)` | `/files/` | FILE action records |
| `getLinks(query, type, opts?)` | `/links/` | LINK action records |
| `getLists(query, type, opts?)` | `/lists/` | LIST action records |
| `getMessages(query, type, opts?)` | `/messages/` | MESSAGE action records |
| `getMints(query, type, opts?)` | `/mints/` | MINT action records |
| `getOrders(query, type, opts?)` | `/orders/` | ORDER action records |
| `getSends(query, type, opts?)` | `/sends/` | SEND action records |
| `getSleeps(query, type, opts?)` | `/sleeps/` | SLEEP action records |
| `getSwaps(query, type, opts?)` | `/swaps/` | SWAP action records |
| `getSweeps(query, type, opts?)` | `/sweeps/` | SWEEP action records |

**Common `type` values for action queries:** `block`, `address`, `token` (not every action supports every type, refer to the xchain-explorer API for per-action valid types).

#### Lifecycle event methods

These methods follow the same `(query, type, opts?)` signature and return event records for terminal state transitions. `type` is `block` or `address` unless noted.

| Method | Endpoint path segment | Notes |
|---|---|---|
| `getCoinpays(query, type, opts?)` | `/coinpays/` | COINPAY action records (on-chain order-match settlement) |
| `getCoinpayExpires(query, type, opts?)` | `/coinpay_expires/` | Expired COINPAY records |
| `getCoinpayObligations(query, type, opts?)` | `/coinpay_obligations/` | Unfulfilled COINPAY obligation records |
| `getDispenserCancels(query, type, opts?)` | `/dispenser_cancels/` | DISPENSER cancellation records |
| `getDispenserCloses(query, type, opts?)` | `/dispenser_closes/` | DISPENSER close records |
| `getDispenserExpires(query, type, opts?)` | `/dispenser_expires/` | Expired DISPENSER records |
| `getDispenserEdits(query, type, opts?)` | `/dispenser_edits/` | DISPENSER edit (v2) records |
| `getOrderCancels(query, type, opts?)` | `/order_cancels/` | ORDER cancellation records |
| `getOrderEdits(query, type, opts?)` | `/order_edits/` | ORDER edit (v2) records |
| `getOrderExpires(query, type, opts?)` | `/order_expires/` | Expired ORDER records |
| `getOrderMatches(query?, type?, opts?)` | `/order_matches/` | Completed auto-matched order pairs; `type` defaults to `block` |
| `getSwapCancels(query, type, opts?)` | `/swap_cancels/` | SWAP cancellation records |
| `getSwapEdits(query, type, opts?)` | `/swap_edits/` | SWAP edit (v2) records |
| `getSwapExpires(query, type, opts?)` | `/swap_expires/` | Expired SWAP records |
| `getSwapMatches(query?, type?, opts?)` | `/swap_matches/` | Completed auto-matched swap pairs; `type` defaults to `block` |

#### Paginated action list

#### `getActions(params?)`
Returns a paginated list of recent XChain actions across all types. Accepts standard pagination params.

- **Endpoint:** `GET /{COIN}/api/actions`

---

### Price

#### `getPrices(query?, type?, opts?)`
Returns PRICE action records. v0 rows are validator COIN/FIAT snapshots; v1 rows are user-submitted TOKEN/FIAT oracle prices.

- **Endpoint (all):** `GET /{COIN}/api/prices`
- **Endpoint (filtered):** `GET /{COIN}/api/prices/{query}/{type}`
- **`type` values:** `block`, `address`, `source`, `token`
- **`opts`:** pagination supported

---

### Staking & Validator

#### `getStakes(query?, type?, opts?)`
Returns STAKE action records. Omit `query` to list all stakes.

- **Endpoint (all):** `GET /{COIN}/api/stakes`
- **Endpoint (filtered):** `GET /{COIN}/api/stakes/{query}/{type}`
- **`type` values:** `block`, `address`
- **`opts`:** pagination supported

#### `getDelegations(query, type, opts?)`
Returns DELEGATE action records (signing key delegation).

- **Endpoint:** `GET /{COIN}/api/delegations/{query}/{type}`
- **`type` values:** `block`, `address`
- **`opts`:** pagination supported

#### `getValidators(opts?)`
Returns the current active validator set.

- **Endpoint:** `GET /{COIN}/api/validators`
- **`opts`:** pagination supported

#### `getValidatorRewards(query, type, opts?)`
Returns validator reward records.

- **Endpoint:** `GET /{COIN}/api/rewards/{query}/{type}`
- **`type` values:** `block`, `address`
- **`opts`:** pagination supported

#### `getContractStakes(query?, type?, opts?)`
Returns STAKE v3 records that target a specific contract (contract-targeted stakes).

- **Endpoint (all):** `GET /{COIN}/api/contract_stakes`
- **Endpoint (filtered):** `GET /{COIN}/api/contract_stakes/{query}/{type}`
- **`type` values:** `address`, `block`, `contract`
- **`opts`:** pagination supported

#### `getContractUnstakes(query?, type?, opts?)`
Returns UNSTAKE v1 records that target a specific contract.

- **Endpoint (all):** `GET /{COIN}/api/contract_unstakes`
- **Endpoint (filtered):** `GET /{COIN}/api/contract_unstakes/{query}/{type}`
- **`type` values:** `address`, `block`, `contract`
- **`opts`:** pagination supported

#### `getContractDelegations(query?, type?, opts?)`
Returns DELEGATE v1 records that target a specific contract.

- **Endpoint (all):** `GET /{COIN}/api/contract_delegations`
- **Endpoint (filtered):** `GET /{COIN}/api/contract_delegations/{query}/{type}`
- **`type` values:** `block`, `address`, `contract`
- **`opts`:** pagination supported

---

### Governance

Two distinct governance surfaces live here. `getPolls`/`getPoll`/`getPollResults`/`getVotes` read the on-chain token-weighted VOTE polls; `getValidatorCapabilities`/`getGovernanceProposals`/`getGovernanceVotes` read the hub federation's parameter-change governance (hub-only tables with no on-chain action).

#### `getPolls(query?, type?, opts?)`
Returns token-weighted governance polls (VOTE v0). `tick` is the electorate/weight token; `status` is the poll lifecycle (`open`/`finalized`/`failed_quorum`); `source` is the poll creator.

- **Endpoint (all):** `GET /{COIN}/api/polls`
- **Endpoint (filtered):** `GET /{COIN}/api/polls/{query}/{type}`
- **`type` values:** `block`, `tick`, `status`, `source`
- **`opts`:** pagination supported

#### `getPoll(pollIndex, opts?)`
Returns a single poll by its id (the creating action_index): the full poll definition plus finalization summary, with `options`/`callback_params` JSON-parsed.

- **Endpoint:** `GET /{COIN}/api/poll/{pollIndex}`

#### `getPollResults(pollIndex, opts?)`
Returns the frozen per-option tally for one poll (written by the system VOTE v2 finalize). Empty until the poll is finalized; ordered by option index.

- **Endpoint:** `GET /{COIN}/api/poll/{pollIndex}/results`

#### `getVotes(query?, type?, opts?)`
Returns VOTE ballots (v1), one row per poll + voter + chosen option. The voter is the ballot's source address.

- **Endpoint (all):** `GET /{COIN}/api/votes`
- **Endpoint (filtered):** `GET /{COIN}/api/votes/{query}/{type}`
- **`type` values:** `address`, `poll`, `block`
- **`opts`:** pagination supported

#### `getValidatorCapabilities(query?, type?, opts?)`
Returns per-pubkey capability activation records from the hub federation.

- **Endpoint (all):** `GET /{COIN}/api/validator_capabilities`
- **Endpoint (filtered):** `GET /{COIN}/api/validator_capabilities/{query}/{type}`
- **`type` values:** `capability`, `pubkey`
- **`opts`:** pagination supported

#### `getGovernanceProposals(query?, type?, opts?)`
Returns hub parameter-change proposals.

- **Endpoint (all):** `GET /{COIN}/api/governance_proposals`
- **Endpoint (filtered):** `GET /{COIN}/api/governance_proposals/{query}/{type}`
- **`type` values:** `status`, `parameter`, `proposal`
- **`opts`:** pagination supported

#### `getGovernanceVotes(query?, type?, opts?)`
Returns validator votes on hub parameter-change proposals.

- **Endpoint (all):** `GET /{COIN}/api/governance_votes`
- **Endpoint (filtered):** `GET /{COIN}/api/governance_votes/{query}/{type}`
- **`type` values:** `proposal`, `voter`
- **`opts`:** pagination supported

---

### Attestation & Consensus

#### `getAttestations(query?, type?, opts?)`
Returns attestation rows from the External Attestation Framework (ATTEST v0 requests and v1/v2 responses).

- **Endpoint (all):** `GET /{COIN}/api/attestations`
- **Endpoint (filtered):** `GET /{COIN}/api/attestations/{query}/{type}`
- **`type` values:** `address`, `block`, `contract`
- **`opts`:** pagination supported

#### `getSlashEvents(query?, type?, opts?)`
Returns slash events emitted by contracts via `xchain.contract.slash`.

- **Endpoint (all):** `GET /{COIN}/api/slash_events`
- **Endpoint (filtered):** `GET /{COIN}/api/slash_events/{query}/{type}`
- **`type` values:** `address`, `block`, `contract`
- **`opts`:** pagination supported

#### `getXcalls(query?, type?, opts?)`
Returns XCALL cross-chain call rows (VM-emitted via `xchain.emit.crossExecute`). Lists source-chain request rows.

- **Endpoint (all):** `GET /{COIN}/api/xcalls`
- **Endpoint (filtered):** `GET /{COIN}/api/xcalls/{query}/{type}`
- **`type` values:** `block`, `contract`, `status`
- **`opts`:** pagination supported

#### `getXcall(callId)`
Returns the full lifecycle for one cross-chain call by `call_id`: the source request, the target-chain execution outcome, and the callback delivery. Each leg is `null` until that stage completes.

- **Endpoint:** `GET /{COIN}/api/xcall/{callId}`

#### `getControllers(opts?)`
Returns controller-bound token policy rows (programmable policy layer). No query parameter.

- **Endpoint:** `GET /{COIN}/api/controllers`
- **`opts`:** pagination supported

#### `getDeployChunks(opts?)`
Returns DEPLOY v4 chunk carrier records used to reassemble chunked contract deployments.

- **Endpoint:** `GET /{COIN}/api/deploy_chunks`
- **`opts`:** pagination supported

#### `getFullNodeVerifications(query?, type?, opts?)`
Returns full-node possession-proof verdicts (NODEPROOF v0).

- **Endpoint (all):** `GET /{COIN}/api/full_node_verifications`
- **Endpoint (filtered):** `GET /{COIN}/api/full_node_verifications/{query}/{type}`
- **`type` values:** `block`, `epoch`, `pubkey`, `address`
- **`opts`:** pagination supported

#### `getCrossChainMatches(query?, type?, opts?)`
Returns cross-chain settlement match rows.

- **Endpoint (all):** `GET /{COIN}/api/cross_chain_matches`
- **Endpoint (filtered):** `GET /{COIN}/api/cross_chain_matches/{query}/{type}`
- **`type` values:** `match`, `block`, `status`
- **`opts`:** pagination supported

#### `getCrossChainSettlements(query?, type?, opts?)`
Returns cross-chain settlement rows (the settle leg of a matched cross-chain order).

- **Endpoint (all):** `GET /{COIN}/api/cross_chain_settlements`
- **Endpoint (filtered):** `GET /{COIN}/api/cross_chain_settlements/{query}/{type}`
- **`type` values:** `match`, `block`
- **`opts`:** pagination supported

#### `getAnchors(query?, type?, opts?)`
Returns ANCHOR checkpoint-anchor rows.

- **Endpoint (all):** `GET /{COIN}/api/anchors`
- **Endpoint (filtered):** `GET /{COIN}/api/anchors/{query}/{type}`
- **`type` values:** `block`, `chain`, `network`, `status`
- **`opts`:** pagination supported

---

### SPV Checkpoints & Proofs

#### `getCheckpoints(opts?)`
Returns the latest quorum-signed state checkpoints for this chain. Use `opts.limit` to cap the result count.

- **Endpoint:** `GET /{COIN}/api/checkpoints`

#### `getCheckpointRange(from, to, opts?)`
Returns the forward-following checkpoint range between block heights `from` and `to`.

- **Endpoint:** `GET /{COIN}/api/checkpoints/range?from=...&to=...`

#### `getCheckpointVerify(blockIndex)`
Re-fetches the checkpoint at `blockIndex` together with its validator set for local re-verification.

- **Endpoint:** `GET /{COIN}/api/checkpoint/{blockIndex}/verify`

#### `getBalanceProof(address, tick, opts?)`
Returns a Merkle inclusion proof for an address/tick balance against the stakes/ledger root. Pass `opts.height` to pin the checkpoint snapshot height.

- **Endpoint:** `GET /{COIN}/api/proof/balance/{address}/{tick}`

#### `getActionProof(actionIndex)`
Returns a Merkle inclusion proof for an action by its index.

- **Endpoint:** `GET /{COIN}/api/proof/action/{actionIndex}`

#### `getValidatorSetProof(opts?)`
Returns a validator-set (stakes root) proof. Pass `opts.height` to pin the snapshot height. BTC only.

- **Endpoint:** `GET /{COIN}/api/proof/validator-set`

#### `getContractStateProof(contractIndex, key)`
Returns a contract-state inclusion proof for the given `(contractIndex, key)` pair.

- **Endpoint:** `GET /{COIN}/api/proof/contract-state/{contractIndex}/{key}`

---

### Token-Gated Content

#### `getContractManifest(contractActionIndex)`
Returns the contract's declared permissions manifest from the programmable policy layer, normalized to camelCase. Returns `{ permissions: string[]|null, maxTakeBps: number|null }`. `permissions: null` means no declared allowlist (unrestricted).

- **Endpoint:** `GET /{COIN}/api/contract/{contractActionIndex}` (derived from the contract record)

#### `getGatedFileRaw(actionIndex, coin?)`
Downloads the raw encrypted ciphertext bytes for a token-gated FILE action by `ACTION_INDEX`. Returns a `Buffer` ready for decryption with the symmetric key from the corresponding MESSAGE handoff. Pass `coin` (base ticker such as `BTC`, `LTC`, `DOGE`) for a cross-chain file reference.

- **Endpoint:** `GET /{COIN}/api/file/{actionIndex}/raw`

#### `getPublicKey(address)`
Returns the on-chain public key registered for an address (used by the messaging layer for ECIES encryption). Returns `null` if the address has not yet sent any XChain transactions.

- **Endpoint:** `GET /{COIN}/api/pubkey/{address}`

---

### Network

#### `getNetwork(opts?)`
Returns a network-wide summary including chain heights, indexer status, peer counts, and a `finality` map (`{ BTC, LTC, DOGE }`) with the recommended confirmation counts for each chain.

- **Endpoint:** `GET /{COIN}/api/network`

---

### Market

#### `getMarkets(tick?)`
Returns all active markets, or all markets for a specific token if `tick` is provided.

- **Endpoint (all markets):** `GET /{COIN}/api/markets`  
- **Endpoint (by token):** `GET /{COIN}/api/markets/{tick}`

#### `getMarket(tick1, tick2)`
Returns summary information for the trading pair `tick1`/`tick2`.

- **Endpoint:** `GET /{COIN}/api/market/{tick1}/{tick2}`

#### `getMarketHistory(tick1, tick2, address?, opts?)`
Returns trade history for a market pair. Optionally filter to a single address.

- **Endpoint (all):** `GET /{COIN}/api/market/{tick1}/{tick2}/history`  
- **Endpoint (by address):** `GET /{COIN}/api/market/{tick1}/{tick2}/history/{address}`  
- **`opts`:** pagination supported

#### `getMarketOrders(tick1, tick2, address?, opts?)`
Returns open orders for a market pair. Optionally filter to a single address.

- **Endpoint (all):** `GET /{COIN}/api/market/{tick1}/{tick2}/orders`  
- **Endpoint (by address):** `GET /{COIN}/api/market/{tick1}/{tick2}/orders/{address}`  
- **`opts`:** pagination supported

#### `getOrderbook(tick1, tick2)`
Returns the aggregated order book (bids and asks) for a market pair.

- **Endpoint:** `GET /{COIN}/api/market/{tick1}/{tick2}/orderbook`

---

### Contract / VM

#### `getContract(contractActionIndex)`
Get contract metadata by its deploy ACTION_INDEX.

- **Endpoint:** `GET /{COIN}/api/contract/{contractActionIndex}`

#### `getContracts(query?, type?, opts?)`
Get a list of contracts, optionally filtered by owner address.

- **Endpoint:** `GET /{COIN}/api/contracts` or `GET /{COIN}/api/contracts/{query}/{type}`

#### `getContractState(contractActionIndex, key?)`
Get contract state entries (all keys or a specific key).

- **Endpoint:** `GET /{COIN}/api/contract/{contractActionIndex}/state` or `GET /{COIN}/api/contract/{contractActionIndex}/state/{key}`

#### `getContractBalance(contractActionIndex, tick?)`
Get contract token balances (all ticks or a specific tick).

- **Endpoint:** `GET /{COIN}/api/contract/{contractActionIndex}/balance` or `GET /{COIN}/api/contract/{contractActionIndex}/balance/{tick}`

#### `getExecution(executionActionIndex)`
Get a single execution result by its ACTION_INDEX.

- **Endpoint:** `GET /{COIN}/api/execution/{executionActionIndex}`

#### `getExecutions(contractActionIndex?, opts?)`
Get execution history for a contract.

- **Endpoint:** `GET /{COIN}/api/executions` or `GET /{COIN}/api/executions/{contractActionIndex}`

#### `getDeposits(query, type, opts?)`
Get deposit records filtered by query and type.

- **Endpoint:** `GET /{COIN}/api/deposits/{query}/{type}`

#### `getWithdrawals(query, type, opts?)`
Get withdrawal records filtered by query and type.

- **Endpoint:** `GET /{COIN}/api/withdrawals/{query}/{type}`

---

### Utility

#### `getStatus()`
Returns explorer health and sync status.

- **Endpoint:** `GET /{COIN}/api/status`

#### `getMempool(query, type, opts?)`
Returns unconfirmed mempool actions matching the query. These are pre-validation decoder rows; a sweeper promotes them to confirmed or revokes them.

- **Endpoint:** `GET /{COIN}/api/mempool/{query}/{type}`
- **`type` values:** `address`, `token`
- **`opts`:** pagination supported

#### `getFeeQuote({ action, params, source?, feeOutputSats? })`
Native-coin fee pre-flight for a single action, proxied through the indexer's read-only `feequote` endpoint. Use this to size a `FEE_DESTINATION` output before broadcasting when paying the protocol fee in BTC/LTC/DOGE.

- **Endpoint:** `GET /{COIN}/api/feequote?action=...&params=...`
- **`action`:** the ACTION name (e.g. `'SEND'`)
- **`params`:** the wire param array or a pre-joined pipe string (without the action name)
- **`source`:** optional sending address (for per-source fee rules)
- **`feeOutputSats`:** optional candidate fee-output size in satoshis
- **Returns:** `{ supported, valid, error?, requiredFeeNative, requiredFeeSats, feeDestination, expectedNative, minAcceptable, maxAcceptable, oracleRound, ... }`

Refuse to broadcast when `supported === false` or `valid === false`; a failed native-fee action forfeits the fee on-chain.

Higher-level callers should use `sdk.estimateFees(actionData, { payFeeInNativeCoin: true })` or `sdk.quoteNativeFee(actionData)` rather than calling this directly.

#### `getFeeSchedule()`
Returns the native-coin fee schedule and current oracle prices. Useful for display or rough estimates.

- **Endpoint:** `GET /{COIN}/api/feeschedule`

#### `getOracleFeeQuote({ oracleAddress, giveTick, fiatCode, giveEscrow, giveCoin?, getCoin?, blockTime? })`
Oracle usage-fee quote for a Mode B dispenser. A dispenser that names an `ORACLE_ADDRESS` pays that oracle operator up front, as a native-coin output sized from the escrow the action adds. Call this before composing a `DISPENSER` v0 create or a v2 refill, then pass the amount as a custom output to the oracle's address.

- **Endpoint:** `GET /{COIN}/api/oraclefeequote?oracleAddress=...&giveTick=...&fiatCode=...&giveEscrow=...`
- **Returns:** `{ valid, error?, oracleAddress, blockTime, requiredFeeNative, requiredFeeSats, belowDust, note? }`

```js
const q = await sdk.explorer.getOracleFeeQuote({ oracleAddress, giveTick, fiatCode, giveEscrow });
if (q.valid && !q.belowDust)
    customOutputs.push({ address: q.oracleAddress, value: q.requiredFeeSats });
```

The indexer computes the quote from the same code path it validates with, so an output sized from the quote is accepted on chain. A dispenser whose oracle has published no effective price yet is rejected both here and on chain: the oracle must have prices set, and PRICE v1 quotes only become effective 24 hours after publication.

#### `getPreflight({ action, params, source?, feeMode? }, opts?)`
Validity-first pre-flight for a single action, decoupled from native-fee support: "would the indexer accept this action?".

- **Endpoint:** `GET /{COIN}/api/preflight?action=...&params=...`
- **Returns:** `{ supported, valid, status, error?, guardInert, feeExempt, denied, xchainFee, feeMode, feeTick, feeTokenBalance, feeAffordable, blockIndex, blockTime }`
- `xchainFee` is the XCHAIN-denominated protocol fee the action would owe (decimal string, 8dp), echoed from the same dry-run as the verdict, so a confirm screen can show the fee without a second `getFeeQuote` call. It is `null` when the run staged no fee record and absent when no verdict was produced; pricing that fee as a native-coin output still needs `getFeeQuote`.
- `feeMode` (`'xchain'` or `'native'`) states how the transaction you are composing will settle that fee, and the dry-run settles it the same way: `xchain` debits the payer's balance, so an underfunded payer is told `invalid` before signing; `native` pays a coin output instead. Omit it for the chain default (`native` on LTC/DOGE, the XCHAIN debit on BTC). `feeTokenBalance` is the payer's balance of `feeTick` at the quoted height, and `feeAffordable` says whether it covers `xchainFee` (`null` in native mode, where that balance is not what pays).

#### `getPriceSnapshots(query?, type?, opts?)`
Returns oracle price-snapshot rounds for the price oracle.

- **Endpoint (all):** `GET /{COIN}/api/price_snapshots`
- **Endpoint (filtered):** `GET /{COIN}/api/price_snapshots/{query}/{type}`
- **`type` values:** `pair`, `round`, `status`
- **`opts`:** pagination supported

#### `fileRawUrl(actionIndex, coin?)`
Returns the absolute URL of a FILE action's raw bytes on the configured explorer. This is a pure string builder. No network call is made. It is the resolution target for TIS `data_ref` entries and on-chain TIS documents where `DESCRIPTION = action:<index>` or `action:<COIN>:<index>`.

```js
// Same-chain FILE reference
const url = sdk.explorer.fileRawUrl(12345);
// → 'http://explorer.example.com:8080/BTC/api/file/12345/raw'

// Cross-chain FILE reference: imageCoin is the base ticker; network tier is implied
const url = sdk.explorer.fileRawUrl(12345, 'DOGE');
// → 'http://explorer.example.com:8080/DOGE/api/file/12345/raw'
//   (on a mainnet client; RDOGE on a regtest client, etc.)
```

Pass `coin` (base ticker such as `BTC`, `LTC`, `DOGE`) for a sibling-chain reference. The method derives the full prefixed coin (e.g. `RDOGE` on a regtest client) so you do not need to account for the network tier.

#### `search(query, type)`
Performs a cross-entity search. Note: this method uses the `/explorer/search/` path, not `/api/`.

- **Endpoint:** `GET /{COIN}/explorer/search/{query}/{type}`  
- **`type` values:** `address`, `broadcast`, `token`, `transaction`

```js
let result = await sdk.explorer.search('MYTOKEN', 'token');
```

---

## Error Handling

All explorer methods throw `SDKExplorerError` on failure. The error object has a `code` property for programmatic handling.

| Code | Cause |
|---|---|
| `EXPLORER_HTTP_404` | Resource not found (endpoint returned HTTP 404) |
| `EXPLORER_HTTP_503` | Explorer is unavailable or overloaded |
| `EXPLORER_HTTP_<N>` | Any other non-2xx HTTP response (code includes the status number) |
| `EXPLORER_TIMEOUT` | Request exceeded the configured timeout |
| `EXPLORER_NETWORK` | Connection refused, DNS failure, or other network-level error |
| `INVALID_NETWORK` | The `network` string passed to the SDK is not a recognised value |

```js
const { SDKExplorerError } = require('@dankest-llc/xchain-sdk');

try {
    let token = await sdk.explorer.getToken('UNKNOWNTICK');
} catch (err) {
    if (err instanceof SDKExplorerError) {
        if (err.code === 'EXPLORER_HTTP_404') {
            console.log('Token not found');
        } else {
            console.error('Explorer error:', err.code, err.message);
        }
    }
}
```

---

## Code Examples

### Query token balances for an address

```js
let balances = await sdk.explorer.getBalances('bc1qexampleaddress...');
// Returns array of { tick, balance, available, escrowed } objects
```

### Get full token information

```js
let token = await sdk.explorer.getToken('MYTOKEN');
console.log(token.supply, token.owner, token.divisible);
```

### Search for a token by ticker

```js
let result = await sdk.explorer.search('MYTOKEN', 'token');
```

### Paginated sends for an address

```js
let page1 = await sdk.explorer.getSends('bc1q...', 'address', {
    page: 1,
    limit: 50,
    sortorder: 'DESC'
});

// Fetch the next page
let page2 = await sdk.explorer.getSends('bc1q...', 'address', {
    page: 2,
    limit: 50,
    sortorder: 'DESC'
});
```

### Recent history across all actions

```js
let recent = await sdk.explorer.getHistory('recent', 'recent', { limit: 20 });
```

### Market order book

```js
let orderbook = await sdk.explorer.getOrderbook('MYTOKEN', 'OTHERTOKEN');
console.log(orderbook.bids, orderbook.asks);
```

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
