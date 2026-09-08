# Releases

Every XChain Platform release is a **train**: one platform version that names an
exact, reproducible set of software across every component. The canonical notes
for each train live on its GitHub Release in `xchain-node`; this page mirrors
them so the history is readable in one place.

Each train tag is GPG-signed with the platform release key. See
[Release Signing](./release-signing.md) to verify a download, and
[Release Process](./release-process.md) for how a train is cut.

## v0.15.3

Released 2026-09-08. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.15.3)

A patch train. `xchain-node`, `xchain-indexer`, `xchain-sync`, `xchain-sdk` and
`xchain-explorer` move to 0.15.3; `xchain-hub` stays at 0.15.2 and the other seven
components keep the tags they shipped under in v0.15.0.

| Component | Version |
|---|---|
| xchain-node | 0.15.3 |
| xchain-indexer | 0.15.3 |
| xchain-sync | 0.15.3 |
| xchain-sdk | 0.15.3 |
| xchain-explorer | 0.15.3 |
| xchain-hub | 0.15.2 |
| xchain-decoder | 0.15.0 |
| xchain-encoder | 0.15.0 |
| xchain-utxo-tracker | 0.15.0 |
| xchain-vm | 0.15.0 |
| xchain-contracts | 0.15.0 |
| xchain-e2e-test | 0.15.0 |
| xchain-regtest-miner | 0.15.0 |

A contract whose source does not fit one transaction is deployed as chunk
carriers plus an assembling DEPLOY, and the indexer assembled it only at the
assembler's position from carriers already confirmed below it, so a group whose
pieces confirmed out of order, including a correctly sequenced one that a reorg
re-packed, failed permanently and burned its fee. A chunk group now deploys
exactly once, in the block where its last piece confirms, whatever order the
pieces arrived in: an assembling DEPLOY that lands early is held pending with
its base fee paid, and the contract takes the index and address of the piece
that completed it. The explorer's DEPLOY detail reports which action deployed
the contract and whether the assembly is still pending, the SDK's deploy
workflow resolves the contract through that field, and the sync follower's
schema version moves with the two new execution columns. The rule is active from
genesis on mainnet and regtest, and on testnet from 2026-09-10 00:00 UTC; every
testnet indexer must run this release before that instant.

A hub deciding whether it still owed the chain a price batch could only guess,
so windows the chain already carried were re-proposed every hour. The indexer
now answers which oracle rounds in a range already ride a valid PRICE batch, so
a hub can skip re-publishing them.

## v0.15.2

Released 2026-09-07. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.15.2)

A patch train. `xchain-node`, `xchain-hub`, `xchain-explorer` and `xchain-sync` move to
0.15.2; `xchain-sdk` stays at 0.15.1 and the other eight components keep the tags
they shipped under in v0.15.0.

| Component | Version |
|---|---|
| xchain-node | 0.15.2 |
| xchain-hub | 0.15.2 |
| xchain-explorer | 0.15.2 |
| xchain-sync | 0.15.2 |
| xchain-sdk | 0.15.1 |
| xchain-indexer | 0.15.0 |
| xchain-decoder | 0.15.0 |
| xchain-encoder | 0.15.0 |
| xchain-utxo-tracker | 0.15.0 |
| xchain-vm | 0.15.0 |
| xchain-contracts | 0.15.0 |
| xchain-e2e-test | 0.15.0 |
| xchain-regtest-miner | 0.15.0 |

The hub that publishes each hour of finalized attestation responses as one
signed batch on Dogecoin sized its signer set at a BTC height it read only from
the chain-tip row a Bitcoin indexer pushes to it, so a validator with no indexer
pushing to it deferred every window and refused every co-signature, and a
federation sharing one Bitcoin indexer could never reach the batch quorum. The
batch publisher now anchors on the pushed chain tip where one exists and on the
tip the attestation round already observes on every request poll otherwise; a
follower bounds a proposed anchor against whichever it holds, and the hub
reports which source its last anchor came from.

The explorer custom-content frame on a token page reported a height that could
never be below its own viewport and the page applied it plus a margin, so the
two echoed each other for as long as the page stayed open. The report is now
applied exactly, an echo is ignored, the frame has a ceiling and a per-load
resize cap, and `media-src` is declared so external video and audio load.

A sync replica asked the origin only for lookup rows above the highest id it
already held, so a row missing below that mark was never fetched again, and the
completeness sweep raw-counted an append-only log whose ids both sides assign
independently. A lookup table the sweep finds short is now re-paged from zero,
and the log is left out of the comparison while every index table stays strict.

## v0.15.1

Released 2026-09-07. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.15.1)

A patch train. `xchain-node`, `xchain-explorer` and `xchain-sdk` move to 0.15.1;
the other ten components keep the tags they shipped under in v0.15.0.

| Component | Version |
|---|---|
| xchain-node | 0.15.1 |
| xchain-explorer | 0.15.1 |
| xchain-sdk | 0.15.1 |
| xchain-hub | 0.15.0 |
| xchain-indexer | 0.15.0 |
| xchain-decoder | 0.15.0 |
| xchain-encoder | 0.15.0 |
| xchain-sync | 0.15.0 |
| xchain-utxo-tracker | 0.15.0 |
| xchain-vm | 0.15.0 |
| xchain-contracts | 0.15.0 |
| xchain-e2e-test | 0.15.0 |
| xchain-regtest-miner | 0.15.0 |

An explorer whose indexed tip had aged past its freshness threshold refused
every data route for that chain, dropped the chain from the status endpoint's
available set, and answered an error frame on the WebSocket replay and snapshot
paths. An indexer running behind a healthy chain therefore made the whole
network look down: pages went blank and wallets lost the chain, while the
history sat readable in a database that was working.

A chain that is behind is now served and said to be behind. Every data response
carries freshness headers, and a stale one carries a freshness object in its
body; the status endpoint keeps the chain listed and reports the verdict beside
the last indexed block, its age and why indexing trails; the WebSocket frames
carry a stale marker; and the pages render their tables under a banner naming
the last confirmed block, how old it is, and whether indexing is catching up,
waiting on a block dated ahead of the server's clock, or paused for repair.
`EXPLORER_STALE_FAIL_CLOSED=1` restores the previous refusal for an operator who
prefers it.

The SDK reads the same marker: `sdk.freshness()` reports it, `sdk.assertFresh()`
raises on a stale tip, and `submitAction({ strictFreshness: true })` refuses
before anything is signed. Reads never refuse, so a wallet keeps working through
an indexer stall and shows the delay instead of an outage.

## v0.15.0

Released 2026-09-07. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.15.0)

A full train: every one of the thirteen components moves to 0.15.0, the first
time since v0.12.0 that the whole set has moved together. The train carries two
new consensus mechanisms, both armed on Bitcoin testnet: ATTEST
responses delivered over the hub mirror, and ROLLCALL, a validator liveness
action published on Dogecoin. Both are armed on Bitcoin testnet at heights the
chain has already passed, so both are live there as soon as a node updates, and
both remain unratified on mainnet.

| Component | Version |
|---|---|
| xchain-node | 0.15.0 |
| xchain-hub | 0.15.0 |
| xchain-indexer | 0.15.0 |
| xchain-explorer | 0.15.0 |
| xchain-decoder | 0.15.0 |
| xchain-encoder | 0.15.0 |
| xchain-sync | 0.15.0 |
| xchain-utxo-tracker | 0.15.0 |
| xchain-vm | 0.15.0 |
| xchain-sdk | 0.15.0 |
| xchain-contracts | 0.15.0 |
| xchain-e2e-test | 0.15.0 |
| xchain-regtest-miner | 0.15.0 |

An ATTEST response used to be a Bitcoin transaction each responding validator
paid for. On this train a response is written to a hub mirror table, gossiped to
every hub, verified before it is stored, and applied by the indexer at the block
its signed effective time predicts, with a per-block cap. Each hour the
finalized responses are published as one signed ATTEST batch on Dogecoin, and
the indexer reassembles chunked batches per author. The response body is capped
before anyone signs it, the effective time is inside the signed canonical, and
`getattestationresponsibleset` answers which validators a request drew. A
federated hub sizes quorum from the federation rather than from its own
validator set.

ROLLCALL lets the network measure validator liveness on chain: validators
answer a per-epoch roll call on Dogecoin, and a validator absent from enough
consecutive rolled epochs is deactivated, with no governance action and no
penalty: its stake refunds after the ordinary cooldown and it may re-enter. The
wire format, canonical bytes and consensus constants are documented on this
site.

Elsewhere on the train: a reorg no longer aborts on the roll-call tables; a
mirror hold that outlasts its ceiling forces a resync and is reported on the
indexer health endpoint; a hub rate-limit reply holds the push queue instead of
burning attempts; a price window that closed while the hub was down is
published on restart; SWEEP and CALLBACK are priced on the unified fee
schedule; the SDK completes the XCALL surface and hardens its MuSig2 session
guards, and its MCP tool surface ships as a second package on the same version;
the explorer sizes its serving limits to the measured wallet profile; the
rollback path in the sync layer restores contract stake correctly and scopes an
orphaned archive chunk to its own publisher; the VM moves to a prebuilt
isolated-vm so an install no longer needs a compiler; and the node CLI stops a
chain daemon gracefully on update, forces a bootstrap republish after a
reindex, and no longer mints a fresh hub API key on a repeated
`validator init`.

**This train changes state derived from existing bytes on testnet.** The response mirror
and ROLLCALL are armed on Bitcoin testnet, at blocks 151324 and 151200, both of
which the chain has already passed, so each is live as soon as a node updates.
Mainnet is unratified for both, and its behaviour is byte for byte unchanged.
On testnet, a node on this train and one still on v0.14.0 will judge a mirrored
response differently once one lands, so update every hub and the indexers that
follow it together rather than one at a time.

## v0.14.0

Released 2026-09-02. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.14.0)

A consensus train. `xchain-node`, `xchain-hub` and `xchain-indexer` move to
0.14.0; the other ten components keep the tags they already carry. There is no
v0.13.0: that number was skipped deliberately, and nothing in the platform
resolves a train by counting upward, so a gap in the sequence is not a missing
release.

| Component | Version |
|---|---|
| xchain-node | 0.14.0 |
| xchain-hub | 0.14.0 |
| xchain-indexer | 0.14.0 |
| xchain-explorer | 0.12.0 |
| xchain-decoder | 0.12.0 |
| xchain-encoder | 0.12.0 |
| xchain-sync | 0.12.0 |
| xchain-utxo-tracker | 0.12.0 |
| xchain-vm | 0.12.0 |
| xchain-sdk | 0.12.0 |
| xchain-contracts | 0.12.0 |
| xchain-e2e-test | 0.12.0 |
| xchain-regtest-miner | 0.12.0 |

An attestation request drew its responsible set from on-chain stake alone, with
nothing in the calculation about whether a validator was answering. A validator
that was staked and served nothing kept its slot forever, and a set holding one
such member could never gather the signatures finalization needs. Every
attestation request on Bitcoin testnet was expiring with zero responses. A
stalled request now widens its responsible set as its own window elapses, the
hub signs from the widened set and the indexer accepts from it, and the fee
split for a fulfilled request follows the same set. The widening ladder is fixed
by consensus rather than configured per hub, because it decides who is allowed
to sign.

Alongside it: validators gossip a digest of the consensus rules they are
applying on the heartbeat and warn when a peer, or the node itself, is on
different flag-day heights, and the indexer publishes the same digest on its
health endpoint so it can be compared against the federation it follows.
`install <ref> xchain-hub` no longer fails with HTTP 401 on a host the runbook
provisioned, because the CLI now sends the hub API key that `validator init`
generated. The checkpoint config block ships `hub_url` beside `self_sync`, so a
fresh install resolves its checkpoint peer and every installed coin gets a
checkpoint block. `xchain-node rollback` prints the recovery path and exits
instead of hanging in its precheck.

**This train changes state derived from existing bytes.** Responsible-set
widening activates on Bitcoin testnet at block 150780, and from genesis on
regtest. Mainnet has not ratified it and the rule is inert there. Below the
height, and on an unratified network, behaviour is byte for byte unchanged, but
once a widened response lands, an indexer or hub on the old rules judges it
differently: update every indexer and hub.

## v0.12.3

Released 2026-09-01. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.12.3)

A patch train for the validator onboarding path. `xchain-node` goes to 0.12.3
and `xchain-hub` to 0.12.3; every other component keeps the tag it already
carries.

| Component | Version |
|---|---|
| xchain-node | 0.12.3 |
| xchain-hub | 0.12.3 |
| xchain-indexer | 0.12.1 |
| xchain-explorer | 0.12.0 |
| xchain-decoder | 0.12.0 |
| xchain-encoder | 0.12.0 |
| xchain-sync | 0.12.0 |
| xchain-utxo-tracker | 0.12.0 |
| xchain-vm | 0.12.0 |
| xchain-sdk | 0.12.0 |
| xchain-contracts | 0.12.0 |
| xchain-e2e-test | 0.12.0 |
| xchain-regtest-miner | 0.12.0 |

Both fixes address the same window: the time between broadcasting a STAKE and
that stake activating, which is when a new validator is most likely to conclude
something is broken.

A hub rejected a peer that was not in the effective signer set by reporting an
invalid signature, because the membership check shared its return path with the
signature check. An operator whose stake had not activated yet was told their
signature was bad, which sends them hunting a key problem that does not exist. A
membership miss now says so, and a hub running in validator mode reports whether
its own key is in the set rather than leaving the only evidence in the logs of
the peers dropping it.

`validator unstake` said the escrowed XCHAIN became spendable when the stake
left the active set. Leaving the set takes 6 blocks on Bitcoin; the coins are
released by the staking cooldown, 1000 blocks, about a week later. Both clocks
are now printed, by `stake` as well as `unstake`, and both are read per chain
from the coin registry rather than assumed to be Bitcoin.

## v0.12.2

Released 2026-09-01. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.12.2)

A patch train that moves the carrier alone. `xchain-node` goes to 0.12.2; every
other component keeps the tag it already carries.

| Component | Version |
|---|---|
| xchain-node | 0.12.2 |
| xchain-hub | 0.12.0 |
| xchain-indexer | 0.12.1 |
| xchain-explorer | 0.12.0 |
| xchain-decoder | 0.12.0 |
| xchain-encoder | 0.12.0 |
| xchain-sync | 0.12.0 |
| xchain-utxo-tracker | 0.12.0 |
| xchain-vm | 0.12.0 |
| xchain-sdk | 0.12.0 |
| xchain-contracts | 0.12.0 |
| xchain-e2e-test | 0.12.0 |
| xchain-regtest-miner | 0.12.0 |

It exists because v0.12.1 shipped without the validator commands this
documentation describes. Someone following the validator quickstart installed the
release, ran `validator stake`, and was told there was no such command. The
documentation was accurate; the release was missing the feature.

`validator init`, `stake` and `unstake` now generate the identity and both
funding wallets, then mint, stake and withdraw against the public network, so an
operator can join before installing any stack. Alongside them: an unrecognised
service name is refused with the list of valid ones rather than silently
expanding to every service on every coin and network; a coin image builds from a
context that holds its Dockerfile and no longer writes live credentials into the
tracked config template; and a mutating command waits out a busy lock instead of
losing the run.

Everything in this train is state-neutral. Nothing changes what state is derived
from existing bytes, so it ships without an activation point.

## v0.12.1

Released 2026-08-31. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.12.1)

The platform's first patch train, cut the same day as v0.12.0. It moves one
component, `xchain-indexer`; the other eleven stay at the v0.12.0 tags they
already carry. A component's version is the platform version at which it last
changed, so a gap in the table below means that component did not change in this
release, not that it was skipped.

| Component | Version |
|---|---|
| xchain-node | 0.12.1 |
| xchain-hub | 0.12.0 |
| xchain-indexer | 0.12.1 |
| xchain-explorer | 0.12.0 |
| xchain-decoder | 0.12.0 |
| xchain-encoder | 0.12.0 |
| xchain-sync | 0.12.0 |
| xchain-utxo-tracker | 0.12.0 |
| xchain-vm | 0.12.0 |
| xchain-sdk | 0.12.0 |
| xchain-contracts | 0.12.0 |
| xchain-e2e-test | 0.12.0 |
| xchain-regtest-miner | 0.12.0 |

A reward whose anchor was attested before a version restart is now judged on the
anchor bytes as written. Proof admission had dropped the legacy wire versions, so
such a reward could never be proven: it read as an eternal unknown and the chain
halted, correctly refusing to commit on absent evidence but with no way forward,
because nothing re-admits those bytes once the fleet is uniform. Admission now
carries the legacy versions and binds each to the reward family it was renumbered
from.

**This is also the replay fix.** The v0.12.0 build cannot replay a chain carrying
such a reward from genesis, because it halts at the first one before reaching the
tip.

Forgeries on legacy bytes stay excluded: at or above the anchor activation height
a legacy byte parses deterministically invalid, and every node drops it as
evidence identically. The change ships ungated, because the previous build does
not derive different state here, it derives none. The halt rolls back the whole
block transaction, so a node on the older code cannot commit a conflicting
verdict, only stop.

## v0.12.0

Released 2026-08-31. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.12.0)

Fourth release train. Every component changed in this train, and every component
carries `0.12.0` in its own `package.json` at its tag.

| Component | Version |
|---|---|
| xchain-node | 0.12.0 |
| xchain-hub | 0.12.0 |
| xchain-indexer | 0.12.0 |
| xchain-explorer | 0.12.0 |
| xchain-decoder | 0.12.0 |
| xchain-encoder | 0.12.0 |
| xchain-sync | 0.12.0 |
| xchain-utxo-tracker | 0.12.0 |
| xchain-vm | 0.12.0 |
| xchain-sdk | 0.12.0 |
| xchain-contracts | 0.12.0 |
| xchain-e2e-test | 0.12.0 |
| xchain-regtest-miner | 0.12.0 |

Notable in this train: hubs sign each ROLLCALL epoch, gossip the signatures, and
an elected publisher lands the roll call on chain, with a source that is absent
across consecutive rolled epochs deactivated by a synthetic unstake and a rolled
back close restoring what it changed; anchors publish one bundle per network per
cycle instead of one anchor per chain, and a bundle the attestation round could
not attest is deferred rather than published unattested; refused cross-chain
calls and refused anchors are recorded as events rather than dropped silently,
and a stalled checkpoint cadence is recorded rather than passing as one tick in
sixty; the database connector moves to 3.5.3, closing three high-severity
advisories against the pinned 3.5.2, including one that reached a service through
a stale bundled copy while the top-level dependency already read clean; and token
balances with decimal places display at their true scale in the wallet.

**ROLLCALL is inert on regtest.** Arming a network commits every Bitcoin indexer
on it to a wired Dogecoin peer, because an epoch close cannot decide a non-empty
responsible set without one and correctly halts rather than read silence as
absence. A single-coin regtest venue has no such peer and can never have one.

## v0.11.0

Released 2026-08-26. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.11.0)

Third release train. Every component changed in this train, and every component
carries `0.11.0` in its own `package.json` at its tag, so this train needs none
of the legacy-stream caveat that applies to v0.10.0 below.

| Component | Version |
|---|---|
| xchain-node | 0.11.0 |
| xchain-hub | 0.11.0 |
| xchain-indexer | 0.11.0 |
| xchain-explorer | 0.11.0 |
| xchain-decoder | 0.11.0 |
| xchain-encoder | 0.11.0 |
| xchain-sync | 0.11.0 |
| xchain-utxo-tracker | 0.11.0 |
| xchain-vm | 0.11.0 |
| xchain-sdk | 0.11.0 |
| xchain-contracts | 0.11.0 |
| xchain-e2e-test | 0.11.0 |
| xchain-regtest-miner | 0.11.0 |

Notable in this train: protocol time on testnet is read from median-time-past
rather than the raw block timestamp, which removes an admission stall where a
confirmed transaction could take up to about two hours to appear; the explorer
status endpoint reports why the indexer trails and when the wait clears, so a
deliberate pause for a block stamped in the future is distinguishable from a
stuck indexer; mempool data is read live from each coin's decoder API, so
explorers serving from synced replicas can show pending transactions; the
bundled consensus pin is verified at API boot, so a host carrying a drifted coin
registry halts instead of serving from it; and installs verify downloaded
artifacts, recover from a failed mirror, and end with a bootstrap restore
summary.

**The median-time-past change is armed for testnet only.** Mainnet and regtest
continue to read the raw block timestamp. Because the change alters how protocol
time is derived, a testnet indexer must be rebuilt from chain after the v0.11.0
build reaches it; a reindex under the previous build re-derives the old state and
only looks like the step was taken.

**Deploy the hubs together.** The oracle clamp convergence in this train leaves a
straddle window of up to one re-seed interval, and a mixed-version hub set can
disagree on the clamp reference and on whether a deviation accusation is raised.

## v0.10.0

Released 2026-08-22. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.10.0)

Second release train. Every component changed in this train.

| Component | Version |
|---|---|
| xchain-node | 0.10.0 |
| xchain-hub | 0.10.0 |
| xchain-indexer | 0.10.0 |
| xchain-explorer | 0.10.0 |
| xchain-decoder | 0.10.0 |
| xchain-encoder | 0.10.0 |
| xchain-sync | 0.10.0 |
| xchain-utxo-tracker | 0.10.0 |
| xchain-vm | 0.10.0 |
| xchain-sdk | 0.10.0 |
| xchain-contracts | 0.10.0 |
| xchain-e2e-test | 0.10.0 |
| xchain-regtest-miner | 0.10.0 |

`xchain-contracts`, `xchain-e2e-test` and `xchain-regtest-miner` were tagged for
this train while still on their own legacy version streams, and adopted the
platform stream immediately afterwards. Their `v0.10.0` tag therefore points at a
commit whose `package.json` still reads the legacy number (`0.1.0`, `0.3.9` and
`0.1.21` respectively); the version above is what the component carries from this
train onward. The tag and the manifest pin by commit, and the commit is what a
pinned install resolves, so nothing about reproducibility changes either way.

Notable in this train: the ledger amount precision flag day is pinned on mainnet
above each chain's tip; the contract state sub-root is armed from genesis on
every testnet; free-form user-text columns accept any legal UTF-8, closing a
defect where one legal broadcast could halt every indexer at the same block; the
hub reserves spend budget around awaited sends; and the explorer gains detail
pages for validators, XCALLs, attestations, polls and anchors.

**Manifest coverage changed.** v0.10.0 pins all twelve modules the installer
clones. The v0.9.0 manifest listed eight, so a pinned install of that train still
resolved `xchain-sdk`, `xchain-e2e-test`, `xchain-contracts` and
`xchain-regtest-miner` at their default branch. Anyone reproducing v0.9.0 should
know that; every train from v0.10.0 pins the full set.

## v0.9.0

Released 2026-08-14. [Release notes and artifacts](https://github.com/XChain-Platform/xchain-node/releases/tag/v0.9.0)

First release train, and the adoption jump: every component moved from its own
legacy version onto the shared platform stream. **The numbers went down while the
release got newer** (the hub, for instance, moved from `2.2.18` to `0.9.0`),
because the platform stream starts at 0.9.0 for the testnet series and 1.0.0 is
reserved for mainnet. Legacy versions are preserved in each component's
changelog below a marker line and are not comparable to platform versions.

## Installing a specific train

```
xchain-node install v0.14.0
```

A pinned install resolves every component to the exact commit recorded in that
train's manifest and verifies the artifacts after clone. `install develop` and
`install master` are tracking installs with no pins, intended for development.

---

**Copyright &copy; 2025&ndash;2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
