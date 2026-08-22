# Releases

Every XChain Platform release is a **train**: one platform version that names an
exact, reproducible set of software across every component. The canonical notes
for each train live on its GitHub Release in `xchain-node`; this page mirrors
them so the history is readable in one place.

Each train tag is GPG-signed with the platform release key. See
[Release Signing](./release-signing.md) to verify a download, and
[Release Process](./release-process.md) for how a train is cut.

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
xchain-node install v0.10.0
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
