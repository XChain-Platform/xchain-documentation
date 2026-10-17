<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

Copyright &copy; 2025 Dankest, LLC

# XChain Explorer WebSocket API Reference

The xchain-explorer provides a WebSocket API for real-time streaming of blockchain events. Clients connect to a coin-scoped endpoint and subscribe to channels with optional filters. The server pushes events as they are indexed. No polling required.

## Connection

### URL Pattern

For the public XChain Platform (mainnet or testnet):

```
wss://explorer.xchain.io/{COIN}/api/websocket
```

For a self-hosted or local explorer instance:

```
ws://host:8080/{COIN}/api/websocket
wss://host:8081/{COIN}/api/websocket
```

The `{COIN}` segment determines the chain and network for the connection:

| Coin Prefix | Chain | Network |
|---|---|---|
| `BTC` | Bitcoin | mainnet |
| `TBTC` | Bitcoin | testnet |
| `RBTC` | Bitcoin | regtest |
| `LTC` | Litecoin | mainnet |
| `TLTC` | Litecoin | testnet |
| `RLTC` | Litecoin | regtest |
| `DOGE` | Dogecoin | mainnet |
| `TDOGE` | Dogecoin | testnet |
| `RDOGE` | Dogecoin | regtest |

### Example

```bash
# Connect with wscat, against the public platform
wscat -c wss://explorer.xchain.io/BTC/api/websocket

# Or against a self-hosted / local explorer instance
wscat -c ws://localhost:8080/BTC/api/websocket
```

### WELCOME Message

Sent automatically on connection. Provides server info, current state, limits, and supported features.

```json
{
  "type": "WELCOME",
  "chain": "BTC",
  "network": "mainnet",
  "timestamp": 1743638400000,
  "data": {
    "version": "1.11.0",
    "server_time": 1743638400000,
    "latest_block_index": "890122",
    "latest_action_index": "45677",
    "limits": {
      "max_subscriptions": 25,
      "max_message_rate": 10,
      "max_message_burst": 27,
      "max_message_size": 1024,
      "max_connections_per_ip": 5
    },
    "channels": ["blocks", "actions", "mempool", "network", "attestation", "address", "token", "market", "dispenser", "bet_feed", "xcall"],
    "types": ["ORDER", "ORDER_MATCH", "ORDER_EXPIRE", "COINPAY", "..."],
    "features": ["snapshot", "once", "fields", "batch", "catch_up"]
  }
}
```

Use `latest_action_index` to seed your catch-up cursor when you hold no cursor yet; on a reconnect it reports the current live position, so it must not move a cursor you already have (see [Reconnection and Catch-Up](#reconnection-and-catch-up)).

`latest_action_index` is the live feed's position for the coin: the highest `action_index` the live poll has already sent, at or above which every later row reaches a subscriber live. It is not the database tip, which can sit a poll ahead of it; a cursor seeded from the tip would skip the rows between the two if the connection dropped before the next poll. When the coin's first poll has not run yet (the server polls coins in turn), the server seeds that coin before it answers, so `WELCOME` can arrive a database read later than usual. A server running without a live detector for the coin reports the database tip. `latest_block_index` is the database's highest block.

---

## Client-to-Server Messages

All client messages are JSON with an `action` field. An optional `id` field enables request-response correlation; the server echoes it back in the corresponding response.

Each connection's messages are measured as a leaky bucket that holds `limits.max_message_burst` messages and drains at `limits.max_message_rate` per second (`WELCOME`). The burst is the larger of the rate and `max_subscriptions + 2` (27 with the defaults of 10 per second and 25 subscriptions), so a client can resubscribe every subscription it may hold, plus one catch-up and a ping, in one tick after a reconnect; past the burst, one more message is accepted per `1000 / max_message_rate` ms. A message over the bucket is dropped and answered with a `RATE_LIMITED` error that carries the dropped message's `id` (no `id` when the message had none or was not JSON). Send a dropped request again once the bucket has drained. Both bundled clients pace every send one slot under the advertised rate and retry a subscribe or catch-up dropped with `RATE_LIMITED`; a client written before the `id` was carried reads that refusal as final, which the burst keeps it from meeting on a reconnect.

### subscribe

```json
{
  "action": "subscribe",
  "id": "sub-1",
  "channels": ["blocks", "actions"],
  "params": {
    "types": ["SEND", "ORDER_MATCH"],
    "fields": ["action_index", "source", "amount"],
    "snapshot": true,
    "once": true,
    "since_action_index": "45677"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | yes | `"subscribe"` |
| `id` | string | no | Echoed back in `SUBSCRIBED` response |
| `channels` | string[] | yes | Channels to subscribe to |
| `params` | object | no | Filter and subscription options |

**Params:**

| Param | Type | Description |
|---|---|---|
| `types` | string[] | Only receive events matching these action types. Omit for all. |
| `statuses` | string[] | **Not supported. Do not use.** Accepted by the server for backward compatibility but never honored on any channel: no feed populates a per-event status (`getActionsSince` selects `NULL as status`), so the filter can never reject anything. It is absent from WELCOME `features` and from SUBSCRIBED `active_filters`. |
| `ticks` | string[] | **Not an event filter.** On the global `actions` channel it is accepted, silently ignored, and echoed back under SUBSCRIBED `ignored_filters`: action frames carry no tick column (`getActionsSince` selects none), so the filter can never reject anything. It is absent from WELCOME `features` and from SUBSCRIBED `active_filters`. Its one real use is as the batch (plural) form of the `token` channel's `tick` entity param, in the Entity params table below. |
| `fields` | string[] | Only include these keys in the `data` payload. Envelope fields always included. |
| `snapshot` | boolean | Send current entity state immediately on subscribe. |
| `once` | boolean | Auto-unsubscribe after the first matching event. |
| `since_action_index` | string | Replay the frames missed since this action_index (for catch-up on reconnect): each missed action's `NEW_ACTION` and the lifecycle events derived from it. See [CATCH_UP_COMPLETE](#catch_up_complete) for what a replay cannot rebuild. Send the decimal string the server gave you; a JSON number is still accepted but rounds above 2^53 and can skip an action. The server compares it exactly. |

**Entity params (required for entity channels):**

| Channel | Singular | Batch (plural) |
|---|---|---|
| `address` | `"address": "1abc..."` | `"addresses": ["1abc...", "1def..."]` |
| `token` | `"tick": "PEPE"` | (use `ticks` array) |
| `market` | `"tick1": "PEPE", "tick2": "BTC"` | `"pairs": [["PEPE","BTC"], ["XCHAIN","BTC"]]` |
| `dispenser` | `"action_index": "12345"` | `"action_indexes": [12345, 12346]` |
| `bet_feed` | `"action_index": "12345"` | `"action_indexes": [12345, 12346]` |
| `xcall` | `"call_id": "<64-hex>"` | `"call_ids": ["<64-hex>", ...]` |

An `xcall` call id must be 64 hex characters; it is lower-cased at subscribe time, and a missing or malformed id is refused with `INVALID_CHANNEL`.

An `address` (and every entry of `addresses`) must be a non-empty string; any other value is refused with `INVALID_CHANNEL` and nothing in the request is subscribed.

### unsubscribe

```json
{
  "action": "unsubscribe",
  "id": "unsub-1",
  "channels": ["address"],
  "params": { "address": "1abc..." }
}
```

The server confirms with one `UNSUBSCRIBED` frame (`reason: "client_request"`) per targeted entity; see [UNSUBSCRIBED](#unsubscribed).

A channel name the server does not know, or an entity channel whose params name no entity (or name one that is not a valid key, such as a non-string `address`), is answered with an `INVALID_CHANNEL` error echoing the request's `id`, one per such channel. The other channels in the same request are still unsubscribed and confirmed.

### list_subscriptions

```json
{
  "action": "list_subscriptions",
  "id": "debug-1"
}
```

Returns a `SUBSCRIPTION_LIST` event with all active subscriptions and their filters.

### ping

```json
{
  "action": "ping"
}
```

Returns a `pong` event. This is an application-level keepalive for aggressive proxies. The server also sends WebSocket-level ping frames every 30 seconds automatically.

---

## Server-to-Client Events

All events share a common envelope:

```json
{
  "type": "EVENT_TYPE",
  "chain": "BTC",
  "network": "mainnet",
  "timestamp": 1743638400000,
  "schema_version": 2,
  "data": { }
}
```

**`schema_version`** stamps every outbound frame (currently `2`). Gate your
parsing on it: the server bumps it whenever any event's `data` shape is
renamed, retyped, or restructured in a way an existing consumer could
mis-parse (additive optional fields do not bump it). The official SDK warns
when the server reports a newer schema than it was built against.

**`stale: true`** sits at the top level of the envelope on `WELCOME`,
replayed catch-up frames, `CATCH_UP_COMPLETE`, `SNAPSHOT` and live frames
while the coin's indexed tip is older than its maximum age. The rows are
still real, but they end at a tip that is behind the chain. `WELCOME` also
repeats it as `data.stale`, beside the tip indices it qualifies. The field
is absent, never `false`, while the tip is fresh, so one `if (msg.stale)`
check covers every frame.

**Wire types under schema v2:** BigInt-backed fields (`action_index`,
`block_index`, `block_time`, `latest_block_index`, `latest_action_index`,
the `NEW_BLOCK` counts `tx_count` and `action_count`, the `TOKEN_UPDATE`
holder count `holders`, and other chain-index/amount fields) serialize as
**decimal strings**, not
JSON numbers, matching the REST API. Compare them as strings or parse with
`BigInt(...)`; a numeric `===` against them will silently fail. `timestamp`
and rate-limit metadata remain JSON numbers. The payload examples below show
the real v2 wire types.

### Global Events

#### NEW_BLOCK

Channel: `blocks`

```json
{
  "type": "NEW_BLOCK",
  "data": {
    "block_index": "890123",
    "block_hash": "00000000...",
    "block_time": "1743638400",
    "tx_count": "2341",
    "action_count": "7"
  }
}
```

#### NEW_ACTION

Channel: `actions`

```json
{
  "type": "NEW_ACTION",
  "data": {
    "action_index": "45678",
    "action": "SEND",
    "tx_hash": "abc123...",
    "block_index": "890123",
    "source": "1abc...",
    "status": null
  }
}
```

**`status` is always `null` on every action-derived event.** `NEW_ACTION`, its
catch-up replay, and every order/swap/coinpay/dispenser lifecycle event below are
built from the same block-derived feed (`getActionsSince`), which selects
`NULL as status` because the generic `actions` table carries no status column.
Receiving one of these events is evidence an action was **indexed**, not that it
was **valid**; confirm validity through the REST API. Only entity-channel frames
that run their own query carry a real status (`DISPENSER_UPDATE`'s `status`,
`BET_CLOSED`'s `feed_status`). It is the same null that makes the `statuses`
subscribe param above a no-op on these events.

#### NETWORK_STATS

Channel: `network`

Emitted with each new block.

```json
{
  "type": "NETWORK_STATS",
  "data": {
    "block_height": "890123",
    "total_actions": "45678"
  }
}
```

### Entity Events

#### ADDRESS_UPDATE

Channel: `address`

```json
{
  "type": "ADDRESS_UPDATE",
  "data": {
    "address": "1abc...",
    "balances": [
      { "tick": "XCHAIN", "amount": "1000.00000000" },
      { "tick": "PEPE", "amount": "50000.00000000" }
    ],
    "last_action_index": "45680"
  }
}
```

#### TOKEN_UPDATE

Channel: `token`

```json
{
  "type": "TOKEN_UPDATE",
  "data": {
    "tick": "PEPE",
    "supply": "100000000.00000000",
    "holders": "1234",
    "last_action_index": "45680"
  }
}
```

#### MARKET_UPDATE

Channel: `market`

```json
{
  "type": "MARKET_UPDATE",
  "data": {
    "tick1": "PEPE",
    "tick2": "BTC",
    "last_price": "0.00000020",
    "volume_24h": "5000000.00000000",
    "bid": "0.00000019",
    "ask": "0.00000021"
  }
}
```

#### DISPENSER_UPDATE

Channel: `dispenser`

```json
{
  "type": "DISPENSER_UPDATE",
  "data": {
    "action_index": "12345",
    "source": "1abc...",
    "status": "open",
    "give_remaining": "49000.00000000",
    "give_tick": "PEPE"
  }
}
```

### Betting Events

Channel: `bet_feed`, keyed by a market's `action_index` exactly like `dispenser`. One subscription
follows one market through its whole life, so a market page or a wallet sees pools move live.

Filterable types are `BET` (one action name over all four formats: create, place, resolve, cancel)
and `BET_EXPIRE` (the system refund pass's minted action).

```json
{
  "type": "BET",
  "data": {
    "action_index": "45900",
    "tx_hash": "9f2c...",
    "block_index": "962400",
    "source": "1abc...",
    "status": "valid",
    "feed_action_index": "45800",
    "action_format": 2
  }
}
```

`feed_action_index` is the parent market's `action_index` (null if it cannot be resolved).
`action_format` is the discriminator the single `BET` type needs: 0 create, 1 cancel, 2 place a bet,
3 resolve. It is null only for `BET_EXPIRE`, which its own type already identifies.

One event on this channel has no action row behind it:

#### BET_CLOSED

Emitted when a market's betting deadline latches shut. The end-of-block pass writes the status
directly and mints no action, so this rides a second cursor over `bet_feeds.closed_block` rather than
over `actions`. Without it a subscribed market page learned that betting had closed only on its next
fetch.

```json
{
  "type": "BET_CLOSED",
  "data": {
    "action_index": "45800",
    "feed_status": "closed",
    "block_index": "962450",
    "tx_hash": null,
    "synthetic": true
  }
}
```

A coin whose indexer predates the BET tables answers "no bet_feeds table"; the explorer parks that
coin's latch cursor on a cooldown and retries, treating the gap as a deploy-order fact rather than a
permanent property of the chain.

### XCall Events

Channel: `xcall`, keyed by the call's 64-hex `call_id`, because that is the only name a cross-chain
call has on both chains: its `action_index` differs per chain and the target chain has no request row.
Both events also ride the `actions` channel and the `address` channel of the call's `source`.

The two terminal phases, `XCALL_COMPLETED` and `XCALL_EXPIRED`, ride a cursor over
`xcalls.resolved_block` rather than over `actions`: a completion is a direct status write with no
action row behind it, and an expiry rides the same cursor so a subscriber cannot see one outcome and
miss the other.

```json
{
  "type": "XCALL_COMPLETED",
  "data": {
    "call_id": "9f2c...e41a",
    "action_index": "45950",
    "block_index": "962470",
    "source": "1abc...",
    "target_chain": "LTC",
    "method": "transfer",
    "contract_index": "45000",
    "request_status": "completed",
    "result_status": "ok",
    "callback_action_index": "45990",
    "deadline_block": "962600",
    "tx_hash": null,
    "action_format": null,
    "synthetic": true
  }
}
```

`result_status` is the far chain's outcome and is `null` on `XCALL_EXPIRED`. `synthetic` is `true`
for a completion (no causing transaction) and `false` for an expiry, which has an XCALL v2 action
behind it. A coin whose indexer has no `xcalls` table is parked on a cooldown and retried, exactly as
the `BET_CLOSED` cursor is.

### Order Lifecycle Events

These fire on the `actions` channel and on the `address` channel of each address the frame's
`data` names: its `source`, or on `COINPAY_REQUIRED` its `payer_address` and `payee_address`.
A lifecycle frame does not carry the `destinations` a `NEW_ACTION` lists, and it is not sent to
their `address` channels.

#### ORDER_MATCH

```json
{
  "type": "ORDER_MATCH",
  "data": {
    "action_index": "45700",
    "settlement_type": "coinpay",
    "status": null,
    "source": "1abc...",
    "tx_hash": "def456..."
  }
}
```

#### COINPAY_REQUIRED

Emitted when an ORDER_MATCH has `settlement_type = coinpay`. Contains the obligation details needed to construct a COINPAY transaction.

```json
{
  "type": "COINPAY_REQUIRED",
  "data": {
    "obligation_action_index": "45700",
    "order_match_action_index": "45700",
    "payer_address": "1BotAddr...",
    "payee_address": "1SellerAddr...",
    "coin_amount": "0.01000000",
    "expiration": "1743642100"
  }
}
```

#### COINPAY_FULFILLED

```json
{
  "type": "COINPAY_FULFILLED",
  "data": {
    "action_index": "45720",
    "tx_hash": "abc123...",
    "source": "1BotAddr...",
    "status": null
  }
}
```

#### COINPAY_EXPIRED

```json
{
  "type": "COINPAY_EXPIRED",
  "data": {
    "action_index": "45730",
    "source": "1BotAddr...",
    "status": null
  }
}
```

#### ORDER_EXPIRED

```json
{
  "type": "ORDER_EXPIRED",
  "data": {
    "action_index": "45740",
    "source": "1abc...",
    "status": null
  }
}
```

### Swap Lifecycle Events

#### SWAP_MATCH

```json
{
  "type": "SWAP_MATCH",
  "data": {
    "action_index": "45850",
    "source": "1abc...",
    "status": null
  }
}
```

#### SWAP_EXPIRED

```json
{
  "type": "SWAP_EXPIRED",
  "data": {
    "action_index": "45860",
    "source": "1abc...",
    "status": null
  }
}
```

### Dispenser Lifecycle Events

Channel: `dispenser`. Every event here is keyed on the parent DISPENSER through
`data.dispenser_action_index`, not on the action that caused it, exactly as
`bet_feed` is keyed on `data.feed_action_index`. Read `data.action_index` with
care: on `DISPENSER_UPDATE` and the subscribe snapshot it IS the dispenser you
subscribed to, but on a `DISPENSE` frame it is that individual dispense's own
action index. A subscriber following more than one dispenser must correlate on
`dispenser_action_index`, or it will attribute fills to the wrong dispenser.

#### DISPENSE

```json
{
  "type": "DISPENSE",
  "data": {
    "action_index": "45800",
    "dispenser_action_index": "45700",
    "source": "1BuyerAddr...",
    "status": null
  }
}
```

#### DISPENSER_CLOSED / DISPENSER_EXPIRED

```json
{
  "type": "DISPENSER_CLOSED",
  "data": {
    "action_index": "45900",
    "dispenser_action_index": "45700",
    "source": "1OwnerAddr...",
    "status": null
  }
}
```

### Mempool Events

Channel: `mempool`

Emitted when the decoder detects a new unconfirmed XChain transaction in the mempool, or when one drops out (confirmed or evicted).

#### MEMPOOL_ACTION

```json
{
  "type": "MEMPOOL_ACTION",
  "data": {
    "tx_hash": "abc123...",
    "source": "1abc...",
    "action": "SEND",
    "data": "SEND|0|PEPE|100.00000000|1def...|"
  }
}
```

Also broadcast on the `address` channel for the transaction's source address.

#### MEMPOOL_REMOVED

```json
{
  "type": "MEMPOOL_REMOVED",
  "data": {
    "tx_hash": "abc123..."
  }
}
```

Emitted when the mempool row is promoted to a confirmed transaction or evicted.

---

### Attestation Events

Channel: `attestation`

Emitted when an ATTEST request, response or expiry lands in a confirmed block. Relay legs (ATTEST v3/v4) arrive as the request or response they record. Response-batch actions (ATTEST v5 head, v6 continuation) send no event on this channel; they still arrive as `NEW_ACTION` on `actions`.

#### ATTESTATION_REQUEST

Emitted for ATTEST v0 (request) rows.

```json
{
  "type": "ATTESTATION_REQUEST",
  "action": "ATTEST",
  "channel": "attestation",
  "data": { ... }
}
```

#### ATTESTATION_RESPONSE

Emitted for ATTEST v1 (response) rows and for ATTEST v2 (system expiry) actions.

```json
{
  "type": "ATTESTATION_RESPONSE",
  "action": "ATTEST",
  "channel": "attestation",
  "data": { ... }
}
```

An expiry writes no attestation row of its own; it marks its request expired. Its frame therefore names the expiry action:

- `action_index` is the expiry action, and `version` is `2`.
- `request_id`, `provider_id` and `contract_index` come from the request it retired.
- `request_status` is `expired` and `response_status` is `null`.

When the explorer cannot tell which request an expiry retired, it sends no frame for that expiry; the request's `expired` status is still readable over REST.

---

### System Events

#### SUBSCRIBED

Sent on every successful subscribe. Echoes the `id` if provided.

```json
{
  "type": "SUBSCRIBED",
  "id": "sub-1",
  "data": {
    "channel": "address",
    "address": "1abc...",
    "active_filters": {
      "types": ["ORDER_MATCH", "COINPAY_REQUIRED"],
      "fields": null,
      "once": false
    }
  }
}
```

#### SUBSCRIPTION_LIST

Response to `list_subscriptions`.

```json
{
  "type": "SUBSCRIPTION_LIST",
  "id": "debug-1",
  "data": {
    "count": 2,
    "limit": 25,
    "subscriptions": [
      { "channel": "blocks", "filters": { "types": null, "once": false } },
      { "channel": "address", "address": "1abc...", "filters": { "types": ["ORDER_MATCH"], "once": false } }
    ]
  }
}
```

#### SNAPSHOT

Sent when subscribing with `snapshot: true`. Contains current state of the subscribed entity.

```json
{
  "type": "SNAPSHOT",
  "data": {
    "channel": "address",
    "address": "1abc...",
    "balances": [{ "tick": "XCHAIN", "amount": "1000.00000000" }],
    "last_action_index": "45680"
  }
}
```

An `xcall` snapshot is `{ "channel": "xcall", "call_id": "...", ...the call's current lifecycle fields }`;
for a `call_id` this chain has no row for, it carries only the two identity fields.

#### REORG

Sent to every connection on the coin that holds at least one subscription when the live feed detects that the chain was rolled back below rows or blocks it already announced. It arrives before any replacement frame.

```json
{
  "type": "REORG",
  "chain": "BTC",
  "network": "mainnet",
  "timestamp": 1743638400000,
  "schema_version": 2,
  "data": {
    "fork_block_index": "890120",
    "first_invalid_action_index": "45601"
  }
}
```

| Field | Meaning |
|---|---|
| `fork_block_index` | The lowest height whose announced block is no longer on the chain. Every `NEW_BLOCK` you hold at or above it is void. |
| `first_invalid_action_index` | The lowest `action_index` whose announced row may be gone or replaced. Every `NEW_ACTION` (and frame derived from it) you hold at or above it is void. |

After the frame, the server sends the new chain's blocks from `fork_block_index` and its rows from `first_invalid_action_index` as ordinary live frames. The indexer reassigns `action_index` on a reorg, so a replacement row can carry the same index as the void row it replaces with different contents: drop what you hold at or above `first_invalid_action_index` first, then apply the frames that follow. A rollback whose replacement chain is shorter leaves the void indexes above its tip empty until new rows are committed there.

Move your catch-up cursor to `first_invalid_action_index - 1` when it is higher, so a reconnect before the replacements arrive replays them. Both bundled clients do this. `REORG` is an additive frame type under schema v2; a client that ignores unknown types keeps working but goes on holding the void rows. A connection too backed up to take the frame is closed with `4008` instead of skipping it, and its reconnect catch-up is refused with `CATCH_UP_REORGED` (see [Reconnection and Catch-Up](#reconnection-and-catch-up)).

A rollback is detected either by the database layer's tip check or by a poll whose fetch comes back short of the tip it read (rows were rolled back between the two reads); in the second case the next poll compares the blocks it announced against the chain and sends `REORG` only if one of them was replaced. Rows the server never announced need no `REORG`: the live cursor stops at the last row it fetched, so their replacements arrive as ordinary new rows.

#### CATCH_UP_COMPLETE

Sent after all catch-up events have been replayed.

```json
{
  "type": "CATCH_UP_COMPLETE",
  "data": {
    "events_replayed": 5,
    "latest_action_index": "45690",
    "truncated": false,
    "not_replayed": ["BET_CLOSED", "XCALL_COMPLETED", "XCALL_EXPIRED", "NEW_BLOCK"]
  }
}
```

`not_replayed` names `NEW_BLOCK` when the request names the `blocks` channel, as above; without `blocks` it lists only the three lifecycle types.

Catch-up events have `"catch_up": true` in the envelope to distinguish them from live events.
`events_replayed` counts every frame sent; `truncated` and `latest_action_index` count action rows.

The server freezes an inclusive replay ceiling separately for each resolved subscription key when
that key becomes live. This ceiling is the key's live-start mark. The live detector advances the
mark for a row immediately before emitting that row's `NEW_ACTION`, without yielding between those
two operations. A concurrent subscribe therefore lands on exactly one side of the boundary: it
either registers first and receives the row live above its frozen ceiling, or registers afterward
and replays the row at or below its ceiling. The catch-up query never reads rows above that ceiling,
even when they are committed before the query runs. As a result, a reconnecting client receives
each matching `NEW_ACTION` exactly once per subscription key rather than once from replay and again
from the live poll.

Every ceiling is also bounded by the coin's current live mark, the position `WELCOME` reports, so a
replay never reads a row the live poll has yet to send. A catch-up on a coin whose first poll has not
run yet seeds that coin first and replays up to the seed; when the coin cannot be seeded (its
database read fails), the catch-up is refused with the retryable `CATCH_UP_NOT_READY`.

The replay honours `WS_MAX_BACKPRESSURE` at each row boundary: before each replayed row the server
checks the connection's buffered bytes, and above the limit it waits for the socket to drain below
it before sending the row, so the server never buffers more than about one row past the limit and a
slow link still receives the whole replay. A connection that does not drain within 30 seconds is
closed with code `4008` (`backpressure`) at that row boundary, with no `CATCH_UP_COMPLETE`. Its
cursor still sits before the first row it did not receive, so its reconnect replays from there. While
a replay waits, the connection's catch-up latch stays held, so another `since_action_index`
subscribe on it is refused with `CATCH_UP_IN_PROGRESS`.

The boundary does not make the entire row atomic. Lifecycle frames are derived after `NEW_ACTION`
and that work can yield. A subscription that starts while the live detector is still deriving the
boundary row can receive one of that row's lifecycle frames both from replay and from the in-flight
live fan-out. Clients must tolerate and de-duplicate those residual lifecycle duplicates.

A replay rebuilds, for each missed action row and in live order, the `NEW_ACTION` and every
lifecycle event the live feed derives from that row (`ORDER_MATCH`, `COINPAY_REQUIRED`,
`COINPAY_FULFILLED`, `COINPAY_EXPIRED`, `ORDER_EXPIRED`, `SWAP_MATCH`, `SWAP_EXPIRED`, `DISPENSE`,
`DISPENSER_CLOSED`, `DISPENSER_EXPIRED`, `BET`, `BET_EXPIRED`, `ATTESTATION_REQUEST`,
`ATTESTATION_RESPONSE`), on each requested channel the live frame reached. It does not rebuild:

| Not replayed | Why | Recover with |
|---|---|---|
| The types in `not_replayed` | Emitted by a status cursor of their own, not derived from an action row | `GET /{COIN}/api/bet_feed/{action_index}` and `GET /{COIN}/api/xcall/{callId}` ([REST API](api.md)) |
| `NEW_BLOCK` | A replay is keyed on `action_index`, and a block has none; `not_replayed` names it when the request names `blocks` | The [REST blocks list](api.md) from your last seen `block_index` |
| `REORG` | A live notice; a catch-up across a logged rollback is refused with `CATCH_UP_REORGED` instead | Resync over REST from the refusal's `fork_block_index` |
| `ADDRESS_UPDATE` and the other entity-update frames | State, not events | Subscribe with `snapshot: true` |
| `MEMPOOL_ACTION` / `MEMPOOL_REMOVED` | Unconfirmed and transient | The [REST mempool read](api.md#mempool) |

#### UNSUBSCRIBED

The server sends two forms. Both carry the bare channel name with the entity id fields (`address`,
`tick`, `tick1` and `tick2`, `action_index`, or `call_id`) as siblings, matching `SUBSCRIBED`; a
coin- or entity-prefixed `channel` string such as `"address:1abc..."` is never sent.

`reason: "once"`: a `once: true` subscription was spent, by a live frame or a replayed one.

```json
{
  "type": "UNSUBSCRIBED",
  "data": {
    "channel": "address",
    "address": "1abc...",
    "reason": "once"
  }
}
```

`reason: "client_request"`: one frame per targeted entity in reply to an `unsubscribe`, echoing its
`id`. `was_subscribed: false` means the request arrived but nothing was registered under that key.

```json
{
  "type": "UNSUBSCRIBED",
  "id": "unsub-1",
  "data": {
    "channel": "address",
    "was_subscribed": true,
    "reason": "client_request",
    "address": "1abc..."
  }
}
```

#### pong

Response to client `ping`.

```json
{
  "type": "pong",
  "timestamp": 1743638410000,
  "data": {}
}
```

#### error

```json
{
  "type": "error",
  "id": "sub-1",
  "data": {
    "code": "INVALID_TYPE",
    "message": "Unknown action type: FOOBAR"
  }
}
```

---

## Error Codes

| Code | Meaning |
|---|---|
| `INVALID_ACTION` | Unrecognized client action or malformed JSON |
| `INVALID_CHANNEL` | Unknown channel name, missing entity params, or an invalid entity key (such as a non-string `address`), on `subscribe` and on `unsubscribe` |
| `INVALID_PARAMS` | A malformed param: `fields` is not an array of strings, or `since_action_index` is not a non-negative integer |
| `INVALID_TYPE` | Unknown action type in `types` filter |
| `SUBSCRIPTION_LIMIT` | Exceeded max 25 subscriptions per connection |
| `RATE_LIMITED` | Client sent more than `max_message_burst` messages at once (27 by default) or more than `max_message_rate` (10 by default) per second after it; the dropped message was not processed, and the frame echoes its `id` so the client can send it again |
| `CATCH_UP_TOO_OLD` | `since_action_index` is more than 1,000 actions behind current |
| `CATCH_UP_AHEAD_OF_TIP` | `since_action_index` is above the server's latest `action_index` (a reorg lowered the tip, or this server is behind the one that issued your cursor), so nothing can be replayed from it; resync over REST |
| `CATCH_UP_IN_PROGRESS` | A catch-up request is already running for this client |
| `CATCH_UP_REORGED` | A rollback this server logged replaced rows at or below `since_action_index`, so a replay from it would skip their replacements. The frame adds `fork_block_index` and `first_invalid_action_index`; resync over REST from the fork. See [Reconnection and Catch-Up](#reconnection-and-catch-up) |
| `CATCH_UP_NOT_READY` | The coin's live feed has not recorded its first position and could not be seeded now; retry the catch-up shortly |
| `COIN_DATA_STALE` | The coin's indexed tip is older than its maximum age and the server is set to fail closed, so the snapshot or catch-up is refused rather than served as current |
| `SNAPSHOT_QUEUE_FULL` | A snapshot fan-out is already running and this client's pending-snapshot queue (capped at its subscription limit) is full; retry the subscribe with `snapshot: true` once it completes |
| `INTERNAL_ERROR` | The server threw while handling the message; the request `id` is echoed |

An unsupported coin prefix in the connection URL never reaches this table: the upgrade itself is
refused with HTTP 400, so no WebSocket and no `error` frame exist.

---

## Supported Action Types for `types` Filter

A given server's authoritative list is the `types` array in its `WELCOME` frame. Any name outside it
fails the entire subscribe request with `INVALID_TYPE`, so no channel in that request is subscribed.

| Category | Values |
|---|---|
| Orders | `ORDER`, `ORDER_MATCH`, `ORDER_EXPIRE` |
| COINPay | `COINPAY`, `COINPAY_EXPIRE` |
| Swaps | `SWAP`, `SWAP_MATCH`, `SWAP_EXPIRE` |
| Dispensers | `DISPENSER`, `DISPENSE`, `DISPENSER_CLOSE`, `DISPENSER_EXPIRE` |
| Transfers | `SEND`, `SWEEP`, `AIRDROP`, `DIVIDEND` |
| Tokens | `ISSUE`, `MINT`, `DESTROY` |
| Other | `BROADCAST`, `CALLBACK`, `FILE`, `MESSAGE`, `LIST`, `LINK`, `SLEEP` |
| VM | `DEPLOY`, `EXECUTE`, `DEPOSIT`, `WITHDRAW` |
| Staking | `STAKE`, `UNSTAKE`, `DELEGATE`, `COLLECT` |
| Attestation | `ATTEST` |
| Betting | `BET`, `BET_EXPIRE` |
| Federation / oracle | `PRICE`, `ANCHOR`, `XCALL`, `NODEPROOF`, `ROLLCALL` |
| Address, batching, bridge, governance | `ADDRESS`, `BATCH`, `CROSS_SETTLE`, `XBRIDGE`, `XEXEC`, `VOTE`, `SLASH` |
| Settlement anchors | `XPOLICY`, `LIST_SHARE` |
| Order lifecycle | `ORDER_EXPIRED` |
| COINPay lifecycle | `COINPAY_REQUIRED`, `COINPAY_FULFILLED`, `COINPAY_EXPIRED` |
| Swap lifecycle | `SWAP_EXPIRED` |
| Dispenser lifecycle | `DISPENSER_CLOSED`, `DISPENSER_EXPIRED` |
| Bet lifecycle | `BET_EXPIRED`, `BET_CLOSED` |
| XCall lifecycle | `XCALL_COMPLETED`, `XCALL_EXPIRED` |
| Attestation lifecycle | `ATTESTATION_REQUEST`, `ATTESTATION_RESPONSE` |

Settlement anchors are rows the indexer mints to anchor a bridge-policy or shared-list settlement
record when the pass produced no action of its own. Their `NEW_ACTION` carries the ordinary `data`
with `tx_hash` and `source` null and `destinations: []`.

---

## Keepalive and Timeouts

| Behavior | Value |
|---|---|
| Server ping interval | 30 seconds (WebSocket-level, automatic) |
| Missed pong | Connection terminated immediately |
| Client with zero subscriptions | Disconnected after 5 minutes of inactivity |
| Client with active subscriptions | No timeout: stays alive indefinitely |
| Recommended client ping | Every 25 seconds (application-level `{"action":"ping"}`) |

---

## Reconnection and Catch-Up

1. Track the highest `action_index` you have processed. Seed it from `WELCOME`'s `latest_action_index` only when you hold no cursor yet: on a reconnect, `WELCOME` reports the current live position, which is past the actions you missed, so letting it move your cursor skips them. On a `REORG` frame, lower the cursor to `first_invalid_action_index - 1` when it is higher (see [REORG](#reorg)).
2. On disconnect, reconnect with exponential backoff. For action-derived frames, backpressure admission is decided once per action row, when the first frame that passes this client's subscriptions and filters is ready: at or below `WS_MAX_BACKPRESSURE` the server sends every wanted frame from that row, even if those sends take the buffer above the limit; above the limit it sends no frame from that row and closes with code `4008` (`backpressure`) after the row ends. Handle that close like any other disconnect: your cursor still sits before the rejected row, so catch-up replays the whole row rather than repairing a partial one. The replay itself checks the same limit at each row boundary and waits for the socket to drain rather than closing it (see [CATCH_UP_COMPLETE](#catch_up_complete)).
3. Resubscribe with `since_action_index` set to your last known value, on the `actions` and `address` subscriptions. Their replay carries each missed action's `NEW_ACTION` and its lifecycle events. A `since_action_index` subscribe on any other channel alone closes at once with nothing replayed: the `actions` channel already carries every lifecycle frame the `dispenser`, `bet_feed`, `xcall` and `attestation` channels do, and entity state comes back with `snapshot: true`. Backfill the `not_replayed` types over REST (see [CATCH_UP_COMPLETE](#catch_up_complete)). `NEW_BLOCK` is never replayed: send `since_action_index` on your `blocks` subscription too and its `CATCH_UP_COMPLETE` names `NEW_BLOCK` in `not_replayed`, then backfill blocks over REST. Send all of these subscribes under the message rate (see [Client-to-Server Messages](#client-to-server-messages)), and send again any that a `RATE_LIMITED` frame names by `id`.
4. Send one `since_action_index` subscribe at a time, each with its own `id`, and wait for the `CATCH_UP_COMPLETE` or `error` frame that echoes that `id` before sending the next. The server runs one catch-up per connection and refuses an overlapping one with `CATCH_UP_IN_PROGRESS`; the subscription is still registered, but its missed actions are not replayed.
5. Process events with `catch_up: true` as replayed frames. The server uses ordering option B: it
   does not gate live delivery while replay is running. Replay preserves action-index order within
   its own bounded result, but it can interleave with live frames whose action indexes are above the
   replay ceiling. A higher live frame can therefore arrive before a lower replay frame. Stage or
   reconcile those live frames by `action_index`, and do not advance the durable catch-up cursor
   from them until every catch-up has closed. Also de-duplicate lifecycle frames for the replay's
   boundary row as described under [CATCH_UP_COMPLETE](#catch_up_complete).
6. If `CATCH_UP_COMPLETE` has `truncated: true`, the replay stopped at its row cap: send the same subscribe again with `since_action_index` set to that frame's `latest_action_index`, and repeat until a frame arrives with `truncated: false`
7. If the catch-up is refused (`CATCH_UP_TOO_OLD`, `CATCH_UP_AHEAD_OF_TIP`, `CATCH_UP_REORGED`, or any other `error` carrying its `id` except `RATE_LIMITED` and `CATCH_UP_NOT_READY`, which you retry), use the REST API to backfill. `CATCH_UP_REORGED` means a rollback while you were away replaced rows at or below your cursor: drop what you hold at or above its `first_invalid_action_index` and reload from its `fork_block_index`.

The server keeps the last 64 rollbacks per coin, in memory, for the `CATCH_UP_REORGED` check. A rollback logs the range from its `first_invalid_action_index` to the highest index the live feed had sent before it; a cursor inside that range is refused, because a client that saw the old row and one that saw its replacement hold the same number. A cursor below the range, or above it (only the new chain reached it), replays normally. A client that applied the `REORG` live and then dropped with its cursor still inside the range is refused too, and reloads over REST. Rollbacks older than the last 64, or from before a server restart, are not in the log.

The SDK's WebSocket client and the explorer's bundled browser client both follow these steps, and each reports a refused or unanswered catch-up as a `resync_required` event; for `CATCH_UP_REORGED` the event carries `fork_block_index` and `first_invalid_action_index`. Each sends its `blocks` subscription through the same one-at-a-time catch-up queue, so it reports the `NEW_BLOCK` note as a `not_replayed` event.

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Explorer WebSocket Server

    C->>S: connect
    S-->>C: WELCOME
    C->>S: subscribe
    S-->>C: SUBSCRIBED
    S-->>C: live events

    Note over C,S: disconnect
    C->>S: reconnect
    S-->>C: WELCOME (live position, does not move the cursor)
    C->>S: subscribe actions, since_action_index, id c1
    S-->>C: replayed events
    S-->>C: higher live event may interleave
    S-->>C: remaining replayed events
    S-->>C: CATCH_UP_COMPLETE, id c1
    C->>S: subscribe address, since_action_index, id c2
    S-->>C: replayed events
    S-->>C: CATCH_UP_COMPLETE, id c2
    S-->>C: live events
```

---

## Configuration

See [CONFIGURATION.md](configuration.md) for the `WS_*` environment variables that control the WebSocket server.

| Variable | Default | Description |
|---|---|---|
| `WS_ENABLED` | `true` | Enable/disable WebSocket server |
| `WS_POLL_INTERVAL` | `5000` | Change detection poll interval (ms) |
| `WS_PING_INTERVAL` | `30000` | Server ping interval (ms) |
| `WS_IDLE_TIMEOUT` | `300000` | Idle timeout for zero-subscription clients (ms) |
| `WS_MAX_CONNECTIONS_PER_IP` | `5` | Max concurrent connections per IP |
| `WS_MAX_SUBSCRIPTIONS` | `25` | Max subscriptions per connection |
| `WS_MAX_BACKPRESSURE` | `65536` | Max buffered bytes per client. Backpressure admission is decided once per action row at its first wanted frame: at or below the limit the whole wanted row is sent, while above it no frame from that row is sent and the connection closes with code `4008` (`backpressure`) after the row ends. A catch-up replay checks the same limit before each replayed row and waits up to 30 seconds for the socket to drain below it before closing, and a `REORG` frame that finds a client above it closes that client instead of skipping the frame. Reconnect and catch up from the last processed action index. |
