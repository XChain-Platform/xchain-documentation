<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - ROLLCALL
This action lands a set of validator presence proofs for one epoch on **Dogecoin**. Each proof is an Ed25519 signature over a canonical bound to the **Bitcoin** epoch block's `ledger_hash`, so it cannot be produced before that block exists. The BTC indexer, the only place the capability-membership predicate runs, closes each epoch by proving the DOGE action, recording who was absent, and evicting a source that has been absent for `ROLLCALL_EVICT_MISSES` consecutive rolled epochs.

Eviction is a **deactivation, not a burn**. An absent validator committed no offense; its stake refunds after the ordinary cooldown and it may re-enter with a fresh `STAKE v1`.

## PARAMS
| Name           | Type    | Description                                                                                  |
| -------------- | ------- | -------------------------------------------------------------------------------------------- |
| `VERSION`      | String  | Format Version                                                                                 |
| `EPOCH_HEIGHT` | Integer | **BTC** height of the roll-call epoch; a multiple of `ROLLCALL_INTERVAL_BLOCKS`, at or above `ROLLCALL_ACTIVATION` |
| `LEDGER_HASH`  | String  | 64-hex `ledger_hash` of the BTC block at `EPOCH_HEIGHT`, carried so a DOGE indexer (which has no BTC view) can rebuild the canonical and verify signatures |
| `PUBLISHER`    | String  | 64-hex Ed25519 signing key the publish reward attaches to                                      |
| `SIG_COUNT`    | Integer | Exact number of `PUBKEY`/`SIG` pairs that follow                                               |
| `PUBKEY_i`     | String  | 64-hex Ed25519 signing key of a present validator                                              |
| `SIG_i`        | String  | 128-hex Ed25519 signature by `PUBKEY_i` over the canonical                                     |

## Formats

### Version `0` - Roll call (validator-broadcast, DOGE only)
- `VERSION|EPOCH_HEIGHT|LEDGER_HASH|PUBLISHER|SIG_COUNT|PUBKEY_1|SIG_1|...|PUBKEY_n|SIG_n`

Every fixed field precedes the variable block, so the format string is a single prefix.

## Examples
A three-signer roll call for regtest epoch 30:

```
ROLLCALL|0|30|<ledger_hash>|<publisher_pk>|3|<pk_1>|<sig_1>|<pk_2>|<sig_2>|<pk_3>|<sig_3>
```

A validator that a publisher left out may land its own one-signature roll call:

```
ROLLCALL|0|30|<ledger_hash>|<own_pk>|1|<own_pk>|<own_sig>
```

## Canonical signed message
The signed preimage is EQUIV-wrapped with `TAG = XROLLCALL`, `ROUND_ID = EPOCH_HEIGHT` in decimal and `VIEW = 0`. Every ROLLCALL that can exist is at or above `EQUIV_HEADER_ACTIVATION`, so the bare headerless form is never built:

```
EQUIV|XROLLCALL|<EPOCH_HEIGHT>|0||<network>|<EPOCH_HEIGHT>|<ledger_hash(EPOCH_HEIGHT)>
```

- `<network>` is the bare lowercase network name (`mainnet` | `testnet` | `regtest`).
- Heights are decimal and unpadded. Epoch `0` is a real epoch on regtest, not a falsy skip.
- `ledger_hash` is the BTC indexer's stored per-block hash at `EPOCH_HEIGHT`, read exactly as NODEPROOF reads its own epoch hash.

Binding the message to that hash is what makes it a **liveness** proof rather than a token: it cannot be signed before the epoch block is mined, so a valid signature shows the key was operating, with a synced view of the BTC chain, inside the epoch's accept window. A pre-signed stack of future heartbeats, the trivial defeat of an unbound canonical, is impossible.

`XROLLCALL` joins `ENGINE_TAGS` for **namespacing only**. It is deliberately absent from SLASH's `ENGINE_CAPABILITY` map, so a roll call is never a slashable family: several valid ROLLCALLs per epoch are expected, and each carries signatures over the same canonical, so two of them are never conflicting content for one key.

## Rules (DOGE indexer)
The DOGE indexer has no BTC view: no stake rows, no BTC ledger hashes, no responsible set. It decides **structure only**. Validation, in order, each failure recorded as `invalid: <reason>`:

1. The indexer's own coin must be `DOGE`, else `invalid: ROLLCALL only valid on DOGE`.
2. `ROLLCALL_ACTIVATION[network]` must be finite and `EPOCH_HEIGHT >=` it, else `invalid: VERSION (unknown)`. A non-finite gate (mainnet's `null`) means inert. The value compared is the carried **BTC** `EPOCH_HEIGHT`, the same number the BTC close gates on, so a pre-activation roll call is inert on both chains and no DOGE-height flag day exists.
3. `EPOCH_HEIGHT % ROLLCALL_INTERVAL_BLOCKS[network] == 0`, else `invalid: EPOCH_HEIGHT`. No staleness or accept-window check here: those compare BTC heights and belong to the BTC close.
4. `LEDGER_HASH` and `PUBLISHER` must be 64 hex (lowercased before use), else `invalid: LEDGER_HASH` / `invalid: PUBLISHER`.
5. Every `SIG_i` must verify over the canonical rebuilt from `(network, EPOCH_HEIGHT, LEDGER_HASH)`, with no duplicate pubkey. Dedupe in wire order, and mark a key seen only **after** its signature verifies, so a garbage pair before a valid one cannot suppress the valid one. A roll call with zero valid pairs is `invalid: SIG_COUNT`.
6. `SIG_COUNT` must equal the pair count exactly, else `invalid: SIG_COUNT`.
7. A nested execution context (inside a BATCH) is `invalid: ROLLCALL (not batchable)`.
8. **No quorum, no membership.** A roll call is a set of individually verified signatures; everything about who those signers are is decided BTC-side.

A DOGE indexer cannot check `LEDGER_HASH` against anything. Forged rows over made-up hashes are fee-priced and inert: the BTC side discards any row whose hash differs from its own.

### Union semantics
**Any number of ROLLCALL actions may land for one epoch, from anyone.** The present set for an epoch is the **union** of every valid signature landed inside the window. A publisher can add signers but never remove them, so nobody holds the absence list: a validator left out of the leader's action is placed by any sweeper that saw its gossip, or publishes its own one-signature roll call. The only collusion left is refusing to roll at all, which evicts nobody.

## Rules (BTC indexer): epoch close
The close for epoch `E` runs at `C = E + ROLLCALL_ACCEPT_WINDOW_BLOCKS + ROLLCALL_PROOF_DELAY_BLOCKS`, inside the block transaction, before the block's hashes are computed.

1. **Responsible set.** `R(E)` is the source-keyed `oracle_publish` weight set at the buried snapshot `S`, which applies that capability's `MIN_STAKE` floor inside the capped query. Every capability member is in it; dust sources under the floor are in no capability set and are not counted. A truncated read makes the epoch unrollable.
2. **Ask.** The BTC indexer asks its DOGE indexer for the signers of `R(E)` plus the elected leader, bounded by those key lists so no attacker-inflated action set can exhaust a page walk. The answer is **`unknown`**, and the block **defers**, when the client is unconfigured or unreachable, the reply is malformed, no window cut exists yet, the cut is not yet buried by `ROLLCALL_DOGE_MATURITY`, or the DOGE indexer's action-manifest hash differs from the BTC indexer's own. A behind indexer makes its BTC node wait rather than judge.
3. **Verify.** For each returned signer row the `ledger_hash` must equal this indexer's own `ledger_hash(E)`, the signature must verify over the canonical this indexer builds, and the pubkey must be an effective key of a source in `R(E)`. Nothing the DOGE side decided is trusted; the BTC side judges raw signed material.
4. **Quorum gate.** The epoch is **rolled** only if the present sources meet the whole-federation stake-weighted threshold over `R(E)`. An **unrolled** epoch counts for nobody: a partition, a fee spike, a dead federation or a truncated read can never evict anyone. A consequence stated plainly: a source holding a third or more of `R(E)`'s stake is never evicted, because its absence closes every epoch unrolled.
5. **Record.** Write the epoch's `rollcalls` row, and for a rolled epoch one absence row per source in `R(E)` that is not present. Absence is **pinned at close** and never re-derived, because stake amounts are rewritten in place by SLASH and a later re-derivation could differ.
6. **Reward.** For a rolled epoch whose answer shows a valid roll call published by the **elected leader**, mint `ROLLCALL_REWARD_AMOUNT` to that leader. Only the elected leader is ever paid, so the reward cannot be raced by publishing first, and it never depends on enumerating the action set.
7. **Eviction.** A source is evicted at `C` if it was absent at `E` and at each of the `K - 1` most recent earlier **rolled** epochs at which it was in `R`, with all `K` of those epochs among the last `ROLLCALL_STREAK_LOOKBACK` rolled epochs ending at `E`. Unrolled epochs and epochs where the source was not in `R` are **skipped**: not counted and not streak-ending, so a source cannot reset its streak by dipping under the floor for one epoch. Presence at any epoch ends the streak, and the lookback bounds how far back an old absence can reach, so a source that leaves for months and returns starts clean.
8. **Effect.** Exactly what an `UNSTAKE v0` from that source would do, minus the actor: the source's active **and pending** stake rows are swept (pending too, else a small top-up just before the epoch walks the source back in), a synthetic `UNSTAKE` action with `FORMAT = 3` is minted at `C` with an ordinary `unstakes` row under it, and `deactivation_block` is stamped on those stake rows and on every delegation of the source. Because the refund is an ordinary `unstakes` row, the cooldown sweep, the credit-and-escrow pairing, the reorg reversal, the state-hash coverage and the explorer rendering are all untouched code.

The membership predicate itself does not change. The stamp is the whole effect: the source leaves through the predicate's existing terms, and the validator set shrinks exactly the way it shrinks for any UNSTAKE.

## The accept window and its cut
The window is a **height cut**, not a per-block time filter, so every honest node computes the same one from replicated chain data:

- `X = btc.block_time(E + ROLLCALL_ACCEPT_WINDOW_BLOCKS)`, the raw BTC header stamp at the window endpoint.
- `hcut = max { h : doge.block_time(h) <= X }`, the last DOGE block inside the window.
- Signatures in DOGE blocks at or below `hcut` count; the answer is admissible only once the DOGE tip is at least `hcut + ROLLCALL_DOGE_MATURITY`.

`ROLLCALL_PROOF_DELAY_BLOCKS` must be at least 1: a block's `block_time` is written after that block's own processing, so the window endpoint has to be a strictly earlier block than the close.

Miner timestamp slack (~2 hours either way, on either chain) moves the edge. It cuts both ways and a wider window can only *reduce* evictions, so the residual is bounded and named: a signature landed in the last couple of hours of the window on a back-dated DOGE block may fall outside the cut. Publishers stay clear of the edge by self-publishing well before it.

## Activation and constants
All eight values are **consensus** and frozen in `protocol/constants.js`, with byte-identical copies in `xchain-{indexer,hub}/src/rollcall_activation.js`. None may be read from the coin registry or from env.

| Constant | mainnet | testnet | regtest | Unit |
|---|---|---|---|---|
| `ROLLCALL_ACTIVATION` | `null` (inert) | 151200 | 0 | BTC height |
| `ROLLCALL_INTERVAL_BLOCKS` | 1008 | 1008 | 30 | BTC blocks |
| `ROLLCALL_ACCEPT_WINDOW_BLOCKS` | 144 | 144 | 12 | BTC blocks |
| `ROLLCALL_PROOF_DELAY_BLOCKS` | 36 | 36 | 2 | BTC blocks |
| `ROLLCALL_DOGE_MATURITY` | 60 | 60 | 2 | DOGE blocks |
| `ROLLCALL_EVICT_MISSES` (K) | 2 | 2 | 2 | rolled epochs |
| `ROLLCALL_STREAK_LOOKBACK` | 4 | 4 | 4 | rolled epochs |
| `ROLLCALL_REWARD_AMOUNT` | `10.00000000` | `10.00000000` | `10.00000000` | XCHAIN |

Every gate keys on the carried BTC `EPOCH_HEIGHT`, never on either chain's local height. Mainnet ships inert: the operator pins that height with the mainnet federation.

## Size and broadcast
`MAX_DATA_BYTES` is 8189 and chain-agnostic. At a 7-digit epoch height the header costs 152 bytes and each signer pair 194, giving **41 pairs per action**; a federation larger than 41 is rolled in several actions per epoch, which the union rule makes free. A one-signature self-publish is 344 bytes. Those figures are measured, not derived: `protocol/test-vectors/rollcall_canonical.json` carries the exact byte counts alongside real signatures.

Every roll call exceeds the 76-byte `OP_RETURN` cap, and Dogecoin does not support SegWit, so P2SH is the only multi-chunk lane there: broadcast rides the chunked **two-phase** P2SH path. A signer module must therefore export `broadcast(payload)`; the built-in pipeline completes only phase 1 and fails closed on P2SH. A hand-built module exporting only `walletSign` can sign roll calls but never publish one.

Cost is about 0.006 DOGE per one-chunk roll call (two transactions). ROLLCALL charges no protocol fee, like other validator actions.

## Reorg Safety
The two chains roll back independently. On DOGE the signer index deletes with its action. On BTC the epoch and absence rows delete with their close block, the synthetic UNSTAKE actions and their `unstakes` rows delete with the block, the stake stamps re-NULL through the ordinary unstake join, the reward row deletes on its derive block, and a matured refund reverses through the existing maturity reversal. Delegation stamps are re-NULLed by a clause keyed on the evicting rows.

A DOGE reorg deeper than `ROLLCALL_DOGE_MATURITY` that removes a counted signature after the BTC close has recorded its epoch cannot be undone from BTC: nothing there observes it, and there is no un-evict rail. The maturity is what bounds that exposure, and the anchor rail accepts the same class of exposure at the same depth.

## Bootstrap and Degradation
An **inert federation** (nobody eligible can publish, or every publisher wallet is under its floor) publishes nothing: every epoch closes unrolled, nobody is evicted, and consecutive unrolled epochs are the monitored signal. A **new** source is safe by construction: a stake activates at `block + 6`, the first epoch whose buried snapshot sees it is the first it is responsible for, so it has at least `K` full epochs from activation before it can ever be evicted.

Every BTC indexer must be wired to a DOGE indexer from `ROLLCALL_ACTIVATION` onward, or its blocks defer at the first close. DOGE indexers must carry the decoder's `ROLLCALL` allowlist entry before that height, or they drop every roll call silently; the manifest-hash check turns that silence into a loud deferral.

## Notes
- Membership stays **chain-derived**. Liveness becomes a chain fact before it may change membership, which is what keeps every hub computing the same `N` under a partition. A liveness-derived `N` would let two partitions each believe they hold quorum, trading a recoverable stall for an unrecoverable fork.
- Nothing a hub decides is consensus: the hub engine decides only when and by whom an action is published.
- A validator does **not** need to hold Bitcoin. Roll calls land on Dogecoin, where every validator already publishes.
