<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Release Process

How an XChain Platform release is cut, signed and published, and how an urgent
fix reaches users without waiting for the next one.

This is the runbook. It assumes you are the person driving the release.

## The shape of it

XChain Platform ships as a **release train**: nine components that move together
under one version number, so that "XChain 0.9.0" names an exact, reproducible set
of software rather than a rough era.

| | |
|---|---|
| **Train members** | `xchain-vm`, `xchain-decoder`, `xchain-indexer`, `xchain-hub`, `xchain-sync`, `xchain-node`, `xchain-encoder`, `xchain-utxo-tracker`, `xchain-explorer` |
| **Version scheme** | one stream, `MAJOR.MINOR.PATCH`, shared by every member |
| **Where work lands** | the `develop` branch of each repo |
| **Where releases live** | the `master` branch, which only ever receives release merges |

### Sparse lockstep

A component is tagged only for the trains it actually changes in. A gap in a
component's tags means "unchanged that release", not "missed a release".

**Resolving a version:** XChain X.Y.Z means each component at its highest tag
less than or equal to X.Y.Z. You never have to work that out by hand, because
every release records the resolved set explicitly (see the manifest below).

`xchain-node` is the exception: it ships in **every** train, because it carries
the manifest, so its content genuinely changes each time.

### What a release publishes

Every train release publishes, on the `xchain-node` GitHub Release:

| Asset | What it is |
|---|---|
| `release-manifest.json` | every component's exact tag and commit for this release |
| one source tarball per changed component | the release content itself |
| `SHA256SUMS` | digests of everything above |
| `SHA256SUMS.asc` | signature over `SHA256SUMS` |

Signing uses the XChain Platform release key. Its fingerprint and the commands
to check it are on [Release Signing](./release-signing.md).

Train releases are **never** marked as GitHub pre-releases, including the 0.9.x
testnet series. The "latest release" endpoint skips pre-releases, so flagging
them would break `xchain-node install` for everyone. Testnet status is
communicated by the version number and the release notes.

---

## Cutting a release

Order matters here, and one part of it is easy to get backwards: **the other
components merge and tag first, and `xchain-node` is cut last.** The manifest
records the commit each tag points at, and those commits do not exist until the
merges have happened.

### 1. Freeze

Decide what is in the train. In each repo that changed, create a release branch
from the current `develop`:

```sh
git checkout develop && git pull
git checkout -b release/v0.9.0
git push -u origin release/v0.9.0
```

Cutting a branch, rather than releasing from `develop` directly, is what stops
ongoing work from changing the release underneath you after you have reviewed it.

Before going further, confirm on those exact commits:

- CI is green in every repo in the train.
- An end-to-end run against the frozen code is green. Use the **E2E (regtest)**
  workflow in `xchain-node` and give it the ref you are releasing.

**Do not open a release PR while anything is red.**

> If you cut release branches only in the changed repos, the end-to-end run
> cannot install the whole stack from one ref. Either create the release branch
> in every train member for the duration of the freeze, or run the end-to-end
> check against the finished release afterwards and treat the pre-merge run as
> covering the changed components only.

### 2. Choose the version number

| Bump | When |
|---|---|
| **MAJOR** | anything that changes what the chain considers valid. Requires a coordinated network upgrade with an activation point. |
| **MINOR** | new features, behaviour changes that are not consensus-breaking. |
| **PATCH** | fixes. |

**The one judgement call that matters.** A fix that changes what state is derived
from data already on the chain is a consensus change, even when it is obviously a
bug fix and even when it is small. Two nodes running different versions of it
compute different state. Such a change ships behind an activation point, never
directly. If you are unsure whether a fix qualifies, treat it as though it does.

### 3. Prepare each changed component

On its release branch:

- bump `package.json` to the train version
- add a `CHANGELOG.md` entry headed `## v0.9.0 (YYYY-MM-DD)`
- in `xchain-indexer`, set the minimum hub version to the hub's release tag

### 4. Open the release PRs

One PR per changed repo, `release/v0.9.0` into `master`, titled `Release v0.9.0`.
The PR diff **is** the release.

Then check cross-component consistency. Some files are required to be
byte-identical across repos, and no single repo's CI can see its sibling, so this
check only happens here.

> **Wait for all of them.** Merge nothing until every PR in the set is green and
> reviewed at the same time. There is no transaction across repositories: merges
> are individual clicks, and the all-green checkpoint is the only thing that
> makes a half-merged train an anomaly rather than a routine occurrence.

### 5. Merge, wait for master to go green, then tag

Merge each PR (a **merge commit**, never squash, never rebase).

**Wait for `master`'s CI to finish green on each merge commit before tagging it.**
The checkpoint in step 4 measured the release branches. A merge commit is a
commit no CI has ever run on, and it is the one the tag names, the manifest
pins, and anyone verifying the release resolves. This is also the last point
where a problem is cheap: an untagged bad merge is a revert, while a tagged one
means burning the train (see below), because a pushed tag is the start of the
verification chain and moving it means deleting and re-pushing it.

```sh
git checkout master && git pull
git tag -s v0.9.0 -m "XChain Platform v0.9.0"
git push origin v0.9.0
```

`-s` signs the tag. An unsigned train tag is a defect, not a style preference:
the tag signature is what someone verifying the release starts from.

**Then level `develop` with `master` in every repo you merged**, before moving
on:

```sh
git fetch origin
git checkout develop && git merge --ff-only origin/master && git push
```

The release branch carries at least the version bump and the changelog entry,
and after the merge those commits exist only on `master`. Skip this and the
next release diff reopens work that already shipped. A fast-forward is the
normal case because the freeze window is short; if `develop` has moved, make it
a real merge.

### 6. Cut `xchain-node` last

On its release branch, write `release-manifest.json` from the tags you just
created, recording each component's tag **and** the commit that tag points at.
Bump, changelog, PR, gate, merge, tag, push, exactly as above.

Then publish:

- the GitHub Release on `xchain-node`, never flagged as a pre-release
- the release notes: resolved component set, aggregated changelog, and for a
  MAJOR train the activation point
- the assets: manifest, source tarballs, `SHA256SUMS`, `SHA256SUMS.asc`
- **a GitHub Release in every other repo that carries the train tag**, each a
  short pointer at node's Release rather than a copy of it
- the mirrored release page in the documentation

That per-repo bullet is not a formality. A repository page presents Releases as
the newest published version, so a component whose tag never got one tells every
visitor that the project last shipped whatever version did. Tags do not correct
that impression, because most people never open the tag list. Publish one per
repo and confirm it per repo: node's Release is the one everyone checks, so
checking it and assuming the rest followed is how a train ships with thirteen
component repos still advertising an old version.

Build the tarballs during the ceremony rather than relying on GitHub's
auto-generated archives. Those are produced on demand and are not guaranteed to
stay byte-identical, so a checksum recorded today can stop matching later with
nothing having changed. Uploaded release assets are immutable.

### 7. Deploy

Follow dependency order: coin nodes (external), then `xchain-utxo-tracker` and
`xchain-encoder`, `xchain-decoder`, `xchain-indexer`, `xchain-sync`,
`xchain-hub`, `xchain-node`, `xchain-explorer`. See
[Deployment](./deployment.md) and [Upgrading](./upgrading.md).

### If it goes wrong mid-train

If something turns red after you have already merged some PRs:

1. **Stop.** Merge nothing further.
2. Cut no tags for this train.
3. Revert the merged PRs to restore each `master`.
4. **Burn the number.** The next attempt uses the next patch version. Do not
   reuse the number, and never publish release notes for the burned one.
5. Record the burn in the next release's notes.

`master` cannot be force-pushed, so revert commits are the only way back. The
changelog noise is the cost of an honest history.

---

## Hotfixes

For "the network is broken now and `develop` is not shippable".

### Classify before anything else

**State-neutral** (a crash, an RPC error, a display bug, anything that does not
change what the chain derives): ship it as a patch train, no activation point
needed.

**State-affecting** (it changes what is derived from data already on chain): this
is a consensus change no matter how urgent it is or how small the diff looks. It
ships behind an activation point, using the same machinery as a MAJOR train. A
consensus fix rolled out without one re-creates, during the upgrade window, the
exact split it was written to fix.

Numbering it as a patch is fine. Numbering does not decide gating; classification
does.

### Then

1. Branch `hotfix/v0.9.1` from the `v0.9.0` tag in each affected repo.
2. Fix it, with tests.
3. PR into `master`. Same gate as any release: CI green, reviewed, merged by a
   human.
4. Tag the patch train. Only the repos you touched get tags.
5. Cut `xchain-node`'s manifest release for the patch train, publish, deploy.
6. **Merge `master` back into `develop` immediately**, in every repo you touched,
   so the fix is not missing from the next release.

Step 6 is the one people forget, and forgetting it silently reverts the hotfix at
the next train.

### Rolling back

`xchain-node update` can move backward **within** a major version.

Crossing a major boundary backward is **not supported** and must not be
attempted. The rules changed at that boundary; going back beneath it means a node
that disagrees with the network about history. If you need this, stop and treat
it as an incident rather than an upgrade.

---

## Quick reference

| Task | Command |
|---|---|
| Install the latest release | `xchain-node install` |
| Install an exact release | `xchain-node install v0.12.2` |
| Track a branch (unreleased) | `xchain-node install develop` |
| Verify a tag | `git tag -v v0.12.2` |
| Verify the assets | `gpg --verify SHA256SUMS.asc SHA256SUMS && sha256sum -c SHA256SUMS` |

`install` with no ref resolves the latest published release and installs every
component at the exact commit the manifest pins, verifying each one after it is
fetched. A version number always means the released code; anything else is read
as a branch name and installs an unreleased, tracking checkout.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.
