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
| `GATES`        | String  | Comma-joined, sorted list of `<module>.<EXPORT>` consensus-gate keys the publisher's build knows; v1 only, at or above `ROLLCALL_GATES_ACTIVATION` |
| `SIG_COUNT`    | Integer | Exact number of `PUBKEY`/`SIG` pairs that follow                                               |
| `PUBKEY_i`     | String  | 64-hex Ed25519 signing key of a present validator                                              |
| `SIG_i`        | String  | 128-hex Ed25519 signature by `PUBKEY_i` over the canonical                                     |

## Formats

### Version `0` - Roll call (validator-broadcast, DOGE only)
- `VERSION|EPOCH_HEIGHT|LEDGER_HASH|PUBLISHER|SIG_COUNT|PUBKEY_1|SIG_1|...|PUBKEY_n|SIG_n`

Every fixed field precedes the variable block, so the format string is a single prefix.

### Version `1` - Roll call with known gates (validator-broadcast, DOGE only)
- `1|EPOCH_HEIGHT|LEDGER_HASH|PUBLISHER|GATES|SIG_COUNT|PUBKEY_1|SIG_1|...|PUBKEY_n|SIG_n`

Published for epochs at or above `ROLLCALL_GATES_ACTIVATION`, carried on the `EPOCH_HEIGHT` this action's fields already key everything else on. `GATES` inserts one field ahead of `SIG_COUNT`, otherwise identical in shape to v0. Every signer signs over the PUBLISHER's own `GATES` list (see Canonical signed message, below), so a signer whose build knows a different list verifies against nothing and is recorded absent for that epoch; two consecutive absent epochs evict a source the same as any other absence (see Rules (BTC indexer): epoch close, below). A fleet mid-roll across an epoch therefore fails to roll that epoch cleanly: roll between epochs, never across one.

## Examples
A three-signer roll call for regtest epoch 30:

```
ROLLCALL|0|30|<ledger_hash>|<publisher_pk>|3|<pk_1>|<sig_1>|<pk_2>|<sig_2>|<pk_3>|<sig_3>
```

A validator that a publisher left out may land its own one-signature roll call:

```
ROLLCALL|0|30|<ledger_hash>|<own_pk>|1|<own_pk>|<own_sig>
```

The same three-signer call, above `ROLLCALL_GATES_ACTIVATION`, naming two gates the publisher's build knows:

```
ROLLCALL|1|30|<ledger_hash>|<publisher_pk>|attest_zero_conf_activation.ATTEST_ZERO_CONF_ACTIVATION,rollcall_gates_activation.ROLLCALL_GATES_ACTIVATION|3|<pk_1>|<sig_1>|<pk_2>|<sig_2>|<pk_3>|<sig_3>
```

## Canonical signed message
The signed preimage is EQUIV-wrapped with `TAG = XROLLCALL`, `ROUND_ID = EPOCH_HEIGHT` in decimal and `VIEW = 0`. Every ROLLCALL that can exist is at or above `EQUIV_HEADER_ACTIVATION`, so the bare headerless form is never built:

```
EQUIV|XROLLCALL|<EPOCH_HEIGHT>|0||<network>|<EPOCH_HEIGHT>|<ledger_hash(EPOCH_HEIGHT)>
```

- `<network>` is the bare lowercase network name (`mainnet` | `testnet` | `regtest`).
- Heights are decimal and unpadded. Epoch `0` is a real epoch wherever a network is armed from genesis, not a falsy skip.
- `ledger_hash` is the BTC indexer's stored per-block hash at `EPOCH_HEIGHT`, read exactly as NODEPROOF reads its own epoch hash.

Binding the message to that hash is what makes it a **liveness** proof rather than a token: it cannot be signed before the epoch block is mined, so a valid signature shows the key was operating, with a synced view of the BTC chain, inside the epoch's accept window. A pre-signed stack of future heartbeats, the trivial defeat of an unbound canonical, is impossible.

`XROLLCALL` joins `ENGINE_TAGS` for **namespacing only**. It is deliberately absent from SLASH's `ENGINE_CAPABILITY` map, so a roll call is never a slashable family: several valid ROLLCALLs per epoch are expected, and each carries signatures over the same canonical, so two of them are never conflicting content for one key.

### Canonical signed message (v1, gates-aware)
At or above `ROLLCALL_GATES_ACTIVATION` the canonical carries one more field, inside the same EQUIV envelope, `TAG` and `ROUND_ID` as v0:

```
EQUIV|XROLLCALL|<EPOCH_HEIGHT>|0||<network>|<EPOCH_HEIGHT>|<ledger_hash(EPOCH_HEIGHT)>|<gates_hash>
```

`<gates_hash>` is the lowercase hex `sha256` of the wire `GATES` field, the comma-joined, sorted list exactly as published, never re-derived from a signer's own build. Below `ROLLCALL_GATES_ACTIVATION` the signed message is the v0 form above, unchanged: no separator and no gates hash. Because the two messages are built differently, a v0 signature can never verify as a v1 one or vice versa, so an epoch cannot be rolled with one signer set read under one era's canonical and another under the other's.

## Rules (DOGE indexer)
The DOGE indexer has no BTC view: no stake rows, no BTC ledger hashes, no responsible set. It decides **structure only**. Validation, in order, each failure recorded as `invalid: <reason>`:

1. The indexer's own coin must be `DOGE`, else `invalid: ROLLCALL only valid on DOGE`.
2. `ROLLCALL_ACTIVATION[network]` must be finite and `EPOCH_HEIGHT >=` it, else `invalid: VERSION (unknown)`. A non-finite gate means inert; mainnet reads `0` (armed at genesis under the 2026-09-09 ruling) and an un-opted-in regtest venue is the `null` case. The value compared is the carried **BTC** `EPOCH_HEIGHT`, the same number the BTC close gates on, so a pre-activation roll call is inert on both chains and no DOGE-height flag day exists.
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

## Gates: what a v1 roll teaches the attestation capability set
For a ROLLED epoch at or above `ROLLCALL_GATES_ACTIVATION`, the close additionally records every verified v1 signer's `GATES` list, keyed by pubkey (19 `<module>.<EXPORT>` keys at this revision, the same shared consensus-gate set the hub and indexer's own rules digest hashes). An unrolled epoch, or a v0-only rolled epoch, records nothing here.

The `attestation` capability set then drops a validator whose most recently recorded list is not a superset of the gates active at the request's own block: a validator that has never rolled a v1, or whose recorded list has fallen behind a gate armed since it last rolled, is still served, since it has simply never proven what it knows; only a validator that positively named a list missing a gate now active is dropped. A pubkey with no recorded list at all is never dropped by this rule, since liveness eviction (above) already owns the never-rolled case.

Because every signer signs over the PUBLISHER's own list, this is also why a fleet must roll between epochs, never across one: a validator that upgrades ahead of the publisher and expects a wider list recorded is instead recorded absent for that epoch, at risk of eviction, which is the opposite of what upgrading first was meant to buy it.

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
| `ROLLCALL_ACTIVATION` | 0 (armed at genesis) | 151200 | `null` (inert), arms at `0` on opt-in | BTC height |
| `ROLLCALL_INTERVAL_BLOCKS` | 1008 | 1008 | 30 | BTC blocks |
| `ROLLCALL_ACCEPT_WINDOW_BLOCKS` | 144 | 144 | 12 | BTC blocks |
| `ROLLCALL_PROOF_DELAY_BLOCKS` | 36 | 36 | 2 | BTC blocks |
| `ROLLCALL_DOGE_MATURITY` | 60 | 60 | 2 | DOGE blocks |
| `ROLLCALL_EVICT_MISSES` (K) | 2 | 2 | 2 | rolled epochs |
| `ROLLCALL_STREAK_LOOKBACK` | 4 | 4 | 4 | rolled epochs |
| `ROLLCALL_REWARD_AMOUNT` | `10.00000000` | `10.00000000` | `10.00000000` | XCHAIN |

Every gate keys on the carried BTC `EPOCH_HEIGHT`, never on either chain's local height. Mainnet is armed at genesis (`0`) under the 2026-09-09 ruling: the indexed mainnet history holds zero validators and zero roll calls, so arming from block 0 reinterprets nothing.

**Regtest is the one network whose height a venue pins for itself.** Every other value here is fixed in source and unreadable from the environment, because on a shared ledger a tunable consensus input is a fork waiting to happen. A regtest chain is private, so no two venues validate the same blocks and nothing a venue pins can fork anybody. It still ships inert, because arming a network commits every BTC indexer on it to a wired DOGE peer, and a single-coin BTC venue would defer forever at its first close. A two-chain venue opts in by setting `XC_ROLLCALL_REGTEST_ACTIVATION=armed` on every BTC indexer and hub it runs, which arms the network at height `0`; the same variable also takes a bare height for a venue whose epochs should begin above an already-indexed prefix. Anything unrecognised leaves the venue inert. Because `ROLLCALL_ACTIVATION` is one of the shared gates in the consensus-rules digest, a venue that arms its hubs and forgets its indexer reports a rules mismatch rather than disagreeing silently about which epochs exist.

## Size and broadcast
`MAX_DATA_BYTES` is 8189 and chain-agnostic. At a 7-digit epoch height the header costs 152 bytes and each signer pair 194, giving **41 pairs per action**; a federation larger than 41 is rolled in several actions per epoch, which the union rule makes free. A one-signature self-publish is 344 bytes. Those figures are measured, not derived: `protocol/test-vectors/rollcall_canonical.json` carries the exact byte counts alongside real signatures.

Above `ROLLCALL_GATES_ACTIVATION` the `GATES` field grows the header by the size of the publisher's own gate list, so the pair cap shrinks to fit: `floor((8189 - header_bytes - GATES_bytes - 1) / 194)`, where `header_bytes` is the same fixed-field cost the v0 figure above measures, `GATES_bytes` is the length of the comma-joined list on the wire, and the trailing `- 1` is the separator ahead of the variable pair block. The exact byte length of `GATES` grows with every consensus gate this train and later ones add, so the resulting pair-per-action count is measured and pinned by the implementation, not carried here as a fixed number. A federation larger than that per-action count still rolls in several actions per epoch, exactly as v0 does.

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
