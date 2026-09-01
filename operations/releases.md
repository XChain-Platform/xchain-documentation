# Releases

Every XChain Platform release is a **train**: one platform version that names an
exact, reproducible set of software across every component. The canonical notes
for each train live on its GitHub Release in `xchain-node`; this page mirrors
them so the history is readable in one place.

Each train tag is GPG-signed with the platform release key. See
[Release Signing](./release-signing.md) to verify a download, and
[Release Process](./release-process.md) for how a train is cut.

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
xchain-node install v0.12.1
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
