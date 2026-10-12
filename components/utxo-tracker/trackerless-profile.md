<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Remote Tracker Profile

The encoder can use an xchain-utxo-tracker on another host instead of running the tracker beside the encoder. Set `UTXO_TRACKER_PROFILE=remote` to make that tracker a required dependency. The encoder then fails closed before selecting tracker-supplied inputs unless the tracker is reachable and positively reports a fresh, spendable view.

"Trackerless" describes the encoder host, not the whole deployment. The remote tracker still owns the LevelDB UTXO index, mempool view, chain cursor, and reorg recovery state. This split is useful when a Pi-class application host should serve the encoder and wallet-facing API without also carrying the tracker's storage and scan load. It does not eliminate serving state, a coin node, or an operator responsible for the remote tracker.

## Configuration

Configure the encoder with all three remote-profile settings:

```env
UTXO_TRACKER_PROFILE=remote
UTXO_TRACKER_URL=<remote-tracker-host>
UTXO_TRACKER_API_PORT=3001
```

`UTXO_TRACKER_URL` is the tracker host, without a scheme or path. The encoder constructs `http://<host>:<port>` and uses a 15-second tracker timeout. Put authentication, TLS, and network access control in the deployment layer if the connection crosses a trusted private network.

`UTXO_TRACKER_MAX_LAG_BLOCKS` is optional and defaults to `2`. It is the encoder's spending-safety ceiling, which is deliberately tighter than the tracker's general `SYNCED_THRESHOLD` default of 3 blocks. The tracker can therefore report `synced: true` while the encoder still refuses a lag of 3 blocks. `GET /status` publishes the effective ceiling as `tracker_max_lag_blocks`.

The default profile remains available for rolling upgrades:

| `UTXO_TRACKER_PROFILE` | Tracker requirement | Missing freshness fields |
|---|---|---|
| unset or `default` | Historical behavior | Older tracker responses can fail open |
| `remote` | `UTXO_TRACKER_URL` and `UTXO_TRACKER_API_PORT` are mandatory | Missing sync evidence fails closed |

Any value other than `default` or `remote` is a configuration error. Profile names are case-insensitive and surrounding whitespace is ignored.

## Endpoint Contract

All tracker JSON-RPC requests are HTTP POST requests to `/` with a JSON-RPC 2.0 body.

| Surface | Role in the remote profile |
|---|---|
| Tracker `get_sync_status` | Preflight before `get_utxos` and `get_tx_block`. It must return an object with a numeric `lag` and a positive `synced` assertion. |
| Tracker `get_utxos` | Returns `{ utxos, sync, nextCursor? }`. The encoder checks the response's `sync` sibling again before selecting any returned input. |
| Encoder JSON-RPC `create_tx` | Uses the remote tracker when `utxos` is omitted or empty. Typed tracker refusals are returned here. |
| Encoder JSON-RPC `get_utxos` | Proxies a tracker lookup, including its `sync` sibling, but maps upstream failures to the generic JSON-RPC code `-32603`. |
| Encoder JSON-RPC `health` | Reports `tracker_reachable`, `tracker_synced`, `tracker_lag`, `tracker_halted`, and `tracker_mempool_ready`. |
| Encoder `GET /status` | Uses the same readiness verdict as `health`; returns HTTP 200 when serveable and HTTP 503 otherwise. It also reports `tracker_max_lag_blocks`. |

`ping` only proves that the encoder process can answer. It does not probe the tracker and is not a readiness check. Use `health` or `GET /status` for traffic admission.

### UTXO response

The response to `get_utxos` has this shape:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "utxos": [],
    "sync": {
      "committed_height": 840000,
      "tracker_height": 840000,
      "node_height": 840001,
      "lag": 1,
      "synced": true,
      "mempool_ready": true,
      "reorg_count": 0
    }
  }
}
```

Paginated responses can also carry `nextCursor`. The encoder compares `tracker_height` and `reorg_count` across pages and refuses to merge pages read from different chain states.

## Freshness Fields

| Field | Meaning to the encoder |
|---|---|
| `committed_height` | Canonical last block committed to the tracker store. Every output through this height is queryable. |
| `tracker_height` | Compatibility alias of `committed_height`; also used to compare paginated snapshots. |
| `node_height` | Coin-node tip observed by the tracker. |
| `lag` | `node_height - tracker_height`. It must be numeric, at least 0, and no greater than `UTXO_TRACKER_MAX_LAG_BLOCKS`. A negative value means the tracker is ahead of a reset or reorged node, so its view can contain orphaned outputs. |
| `synced` | The tracker's own freshness verdict. The remote profile requires a positive assertion, even when `lag` is within the encoder ceiling. |
| `mempool_ready` | Whether block sync is complete and the mempool index has reconverged. Explicit `false` is refused because a confirmed output already spent in the mempool might otherwise be selected. An absent field is tolerated for compatibility with an older tracker. |
| `halted` | `true` after an unrecoverable reorg stops tracker polling. It always refuses service. |
| `halt_reason` | Sanitized operator-facing reason for a halt. It does not change the verdict. |
| `reorg_count` | Lifetime rollback counter used with `tracker_height` to keep multi-page reads on one snapshot. |

The refusal order is significant: halted, stale, then mempool not ready. A halted tracker whose lag is also excessive is reported as halted, while a lagging tracker whose `mempool_ready` has consequently fallen false is reported as stale.

The encoder readiness fields use the base classifier also used by `create_tx`. `tracker_synced` is true when the tracker asserts `synced` and there is no explicit halted, stale, over-bound, negative-lag, or not-ready verdict. An unreachable or empty response leaves readiness false.

There is one compatibility distinction at this boundary. `health` and `GET /status` treat an absent or non-numeric `lag` as unknown and do not apply a lag bound, while the remote `create_tx` path refuses the same status as `UTXO_TRACKER_SYNC_MISSING`. A conforming current tracker always publishes numeric `lag`; clients must still treat the typed `create_tx` result as the final authority rather than assuming a successful readiness probe guarantees that a later build will succeed.

## Typed Errors

On a running encoder, tracker-related `create_tx` failures are operational JSON-RPC errors with code `-32010`. The stable type is in `error.data.reason`; branch on that value rather than matching message text. Library callers receive the same string as `error.xchainCode`.

`UTXO_TRACKER_NOT_CONFIGURED` is the startup exception: encoder construction raises it before the API begins listening, so it is not returned by `create_tx`. The remaining five reasons are runtime refusals.

| `error.data.reason` | Condition | Usual response |
|---|---|---|
| `UTXO_TRACKER_NOT_CONFIGURED` | Remote profile starts without a tracker host or port. | Fix deployment configuration; the encoder cannot start correctly. |
| `UTXO_TRACKER_UNREACHABLE` | The sync or UTXO request fails at the transport layer. | Retry with backoff and alert on a sustained outage. |
| `UTXO_TRACKER_SYNC_MISSING` | The tracker omits the `sync` object, returns an empty status, or does not provide a numeric `lag`. | Upgrade or repair the tracker; do not spend from an unattested view. |
| `UTXO_TRACKER_HALTED` | `halted` is explicitly `true`. | Operator intervention is required, normally a tracker rebuild or bootstrap restore. |
| `UTXO_TRACKER_STALE` | `synced` is false or absent, lag exceeds the encoder ceiling, or lag is negative. | Wait for catch-up, or investigate a node reset or reorg. |
| `UTXO_TRACKER_NOT_READY` | `mempool_ready` is explicitly `false`. | Wait for the first post-sync mempool reconciliation. |

These errors describe the tracker-backed selection path. Other failures such as `NO_UTXOS`, `INSUFFICIENT_FUNDS`, malformed tracker rows, and node fee or broadcast failures keep their existing contracts.

## Developer and Wallet Scope

For a hosted application, the developer configures the encoder-to-tracker connection. A wallet calls the encoder and does not need the tracker hostname. Before enabling traffic, gate on encoder `GET /status` returning 200 or JSON-RPC `health` returning both `tracker_reachable: true` and `tracker_synced: true`.

Wallet code should treat all six tracker reasons as a refusal to compose or sign. It can retry `UTXO_TRACKER_UNREACHABLE`, `UTXO_TRACKER_SYNC_MISSING`, `UTXO_TRACKER_STALE`, and `UTXO_TRACKER_NOT_READY` after showing a temporary availability state. `UTXO_TRACKER_NOT_CONFIGURED` and `UTXO_TRACKER_HALTED` need operator action. The wallet must never replace a refusal with a cached UTXO set silently.

The profile has two intentional scope limits:

- A non-empty caller-supplied `utxos` array bypasses tracker fetching and this freshness gate. The caller then owns the provenance, snapshot consistency, and freshness of those inputs.
- A P2SH or P2WSH reveal supplied with `p2shHash` and `p2shHex` derives its inputs from the funding transaction and does not query the tracker. This prevents a tracker outage or a post-funding empty address from stranding the reveal.

Freshness is not authenticity. A remote tracker can still omit a valid UTXO or lie consistently about its state. Use a tracker operated inside the application's trust boundary, protect the connection, and keep the wallet's normal PSBT review and signing checks. The profile prevents spending from missing or explicitly unsafe freshness evidence; it does not turn a hosted tracker into a trustless proof service.

## Related

- [UTXO Tracker Operations](operations.md): complete tracker REST and JSON-RPC reference
- [UTXO Tracker Configuration](configuration.md): tracker-side sync thresholds and deployment settings
- [Encoder](../encoder/): encoder configuration and JSON-RPC overview
