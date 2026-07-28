# Cross-Chain Contract Calls

A smart contract on one chain (BTC/LTC/DOGE) asynchronously invokes a method on
a contract deployed on another chain and receives the outcome via a callback.
Built from the platform's existing primitives: the emission pipeline
(same-chain `emit.execute`), the ATTEST request/callback lifecycle, the
federation's confirmation-gated PBFT, the quorum-signed hub-DB mirror with
deterministic injection (the cross-chain DEX settlement transport), and ANCHOR
recoverability.

## Architecture

```
Chain X (source)                 Hub federation                  Chain Y (target)
────────────────                 ──────────────                  ────────────────
contract calls                   polls getpendingcrosschaincalls;
xchain.emit.crossExecute   ──►   waits CONF[X] confirmations;
→ XCALL v0 action row            every peer re-verifies the
  (derived from the user's       request against its OWN X
  tx; no extra on-chain tx)      indexer, then signs (2f+1)
                                       │
                                       ▼
                                 cross_chain_calls row     ──►   indexers verify sigs vs the
                                 (phase='dispatch'),             cross_chain capability snapshot,
                                 mirrored to every indexer       inject XEXEC at the first block
                                                                 ≥ effective_time (ordered by
                                                                 (snapshot_block, call_id),
                                                                 ≤25/block): depth-0 EXECUTE,
                                                                 gasCeiling = gas_limit,
                                                                 crossCallable allowlist
                                       ┌─────────────────────────────┘
                                       ▼
X indexers verify sigs,    ◄──   polls getcrosschaincallresult;
inject the callback              waits CONF[Y] depth; peers
EXECUTE into the                 re-verify the outcome against
requesting contract              their OWN Y indexer, sign the
                                 phase='result' row, mirror it
```

**Zero per-call on-chain transactions.** The only chain footprint is the
user's original transaction on X (the XCALL request is an emitted action row
derived from it) plus the periodic ANCHOR archive on DOGE, amortized across
many calls.

## Trust model

The 2f+1 `cross_chain` capability quorum is the authority that tells chain Y
"this call happened on X"; Y cannot read X's chain. This is the same trust
that releases cross-chain DEX escrow, but with a larger potential blast radius
(invoking contract methods vs releasing escrowed funds). It is bounded by:

1. **`crossCallable` opt-in**; a contract must export a `crossCallable`
   array naming the methods reachable cross-chain. A forged dispatch can only
   reach methods the target consciously exposed.
2. **Params-only v1**. No token value rides the call.
3. **Local signature verification everywhere**. No indexer ever acts on a
   mirror row without verifying its 2f+1 Ed25519 signatures against the
   mirrored, BTC-anchored capability snapshot. Mirror equivocation degrades to
   censorship, which the deadline bounds.
4. **Independent peer re-verification**; a hub follower only co-signs a
   dispatch/result after re-fetching it from its OWN indexer for that chain;
   a Byzantine leader cannot collect a quorum for a call no chain made.

**Liveness vs safety:** a dead or censoring federation can only delay or expire
calls (the `expired` callback is derived from block height alone, hub-free); it cannot forge them.

## Finality and irreversibility

The federation relays a request only after it is buried `CONF[source]` deep
(BTC 6 / LTC 12 / DOGE 60, the cross-chain swap thresholds), and relays a
result only after the injected execution is `CONF[target]` deep. **A
target-chain execution cannot be retracted from the source chain.** A source
reorg deeper than the confirmation gate after the target executed is outside
the security model; the same posture cross-chain DEX settlement takes on a
confirmed give-side. (Defense-in-depth retraction exists for the sub-depth
window: relay rows are marked retracted and broadcast as mirror deletions, and
indexers that have not yet injected skip them.)

## Latency

Inherent, not incidental: `CONF[X] + hub round + mirror grace + Y block +
execution + CONF[Y] + hub round + mirror grace + X block`, minutes to tens of
minutes depending on the chain pair. Contracts must be designed fully async:
emit the call, return, and handle the outcome in the callback.

## Determinism rules (consensus-critical)

- Every indexer applies relay rows at the same block: the `cross_chain_calls`
  mirror has its own sync barrier (`waitForCallSync`, with the stream-watermark
  quiet-table escape) plus snapshot-presence gating, mirroring the match
  barriers.
- Injection order is `(snapshot_block, call_id)`, quorum-agreed row content,
  identical in every hub DB, so the order does not depend on which hub an
  indexer mirrors (the per-hub AUTO_INCREMENT `id` is provenance only, though
  ANCHOR still archives it); the per-block cap carries overflow forward;
never drops.
- Result delivery and deadline expiry share an exactly-once interlock on the
  request's status; both are block-height-driven.
- The injected execution's synthetic TX_HASH is chain/network-namespaced
  (`sha256('XCALL:'+network+':'+chain+':'+call_id)`) so anything it emits
  derives collision-free identifiers.
- Reorg: target-side injections and source-side callbacks are anchored to
  rollback-able action rows; the request's terminal flip is reset by the
  rollback pass via `resolved_block`, so replays re-deliver identically.

## Client integration boundary (wallets, composers, SDK)

No wallet, batch composer, or SDK call site ever submits an XCALL, and the
absence of an XCALL entry in a client's action menu is the correct behaviour,
not a coverage gap:

- XCALL v0 exists only as an emission from inside contract code
  (`xchain.emit.crossExecute(...)`), and XCALL v2 is synthesized by every
  indexer from block height. Neither has a user-broadcast path, so the SDK
  ships no XCALL encoder and `action-manifest.json` gives XCALL a category
  outside `wire-user`, with neither `userEncodable` nor `walletForm` set (both
  of which DEPLOY and EXECUTE do carry).
- A client's entire request-side involvement is generic contract tooling:
  DEPLOY a contract whose CODE calls `crossExecute`, then EXECUTE one of that
  contract's methods. Those two forms are the client surface worth testing.
  The XCALL is a consequence of the deployed contract, not of the client.

### Exercising the request side

Producing a real XCALL on chain is a two-contract engineering exercise rather
than a UI flow:

1. Deploy the TARGET contract on chain Y, exporting a `crossCallable` array
   naming the method to be reached cross-chain.
2. Deploy the SOURCE contract on chain X, whose method calls
   `xchain.emit.crossExecute({ targetChain, contractIndex, method, gasLimit,
   callbackMethod, ... })` against the target's DEPLOY action index on Y.
3. Mine both deploys, then EXECUTE the source method from any wallet.

The verifiable request-side half ends there: the EXECUTE indexes valid on X
and X's indexer records an emitted XCALL v0. Everything past that point
(dispatch, XEXEC injection on Y, the result callback) is federation work and
requires the XCALL relay wired across both chains' indexers plus a hub. A
single-chain wallet stack cannot settle a call no matter what the client
does, so client test plans should assert the request half and leave
settlement to a federation drill venue.

## Wire/spec details

Formats, canonical signing strings, statuses, gas buckets, and the lifecycle
state machine: [actions/XCALL.md](actions/XCALL.md). Constants:
[constants.js](constants.js). Developer-facing API:
`developer-guide/Smart_Contract_Development.md` (§ Calling contracts on other
chains).

## Deliberately out of scope (v1)

- Gas refunds for unused target-side gas (would require trusting/settling
  hub-reported usage).
- Token transfer riding the call (compose with cross-chain DEX settlement).
- Synchronous cross-chain reads or return values (callback pattern only).
- Calls from DEPLOY constructors.
