<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Reproducible Builds

XChain Wallet aims for **Level-2 reproducibility of the pre-signing artifact** per §51 of the wallet specification. Independent verifiers can rebuild the desktop bundle from source and produce the exact same unsigned `.app` / `.exe` / `.AppImage` content the maintainer signs for an official release. Combined with the published `RELEASE_HASHES.txt` for each tag, that closes a real verification loop without the operational overhead of multi-party signing (Level 3).

## What's reproducible

- **The pre-signing Linux app bundle** produced by `dist:unpacked` (electron-builder's `--dir` mode). This is the `linux-unpacked/` directory inside `packages/desktop/dist/`, containing the asar archive + the Electron binary + supporting resources.
- **The SHA-256 of every file in that directory**, captured in `RELEASE_HASHES.txt` (emitted by `scripts/build.sh` at the end of each run).

## What's not reproducible

- **Signed artifacts (`.dmg`, signed `.app`, signed `.exe`, notarized builds).** Code signatures embed a certificate-specific signature plus, for macOS, Apple's notarization ticket. These outputs are inherently maintainer-specific. The pre-signing artifact hashes let verifiers prove the *content* going into signing matches what was built from source; the signature is a separate, by-design maintainer-only operation.
- **macOS and Windows builds.** The reproducible-build container targets Linux only. Cross-compiling macOS (requires `lipo` + Apple's signing toolchain) and Windows (requires a Windows runner for Authenticode signing) bit-for-bit is a significantly larger undertaking. macOS and Windows releases publish pre-signing SHAs produced on a Mac runner / Windows runner the maintainer operates; a later phase may add VM-based reproduction.
- **The web SPA and the extension** ship from a different pipeline. Reproducibility there is the next item on the roadmap; the desktop pre-signing artifact is the first beachhead.

## Two-halves of the property

Reproducibility breaks down into two enforceable halves:

1. **Scaffolding audit**: every ingredient required for reproducibility is present in the repo. CI fails if a digest pin is dropped, the lockfile is un-frozen, or a non-deterministic step sneaks into the build config.
2. **Run-twice verification**; the actual byte-for-byte property: rebuild from source twice on a clean dev machine and verify the two `RELEASE_HASHES.txt` match.

The audit catches regressions automatically on every commit. The verification catches subtler drift (build-tool version bumps that quietly lose determinism) but requires a clean Docker host. Splitting the work makes both halves enforceable.

## Scaffolding audit

`packages/core/scripts/repro-build-audit.js` runs 18 static rules:

### Dockerfile

- Digest-pinned base image (`FROM node@sha256:...`)
- `NODE_VERSION` pinned in the image
- Locale and timezone pinned together (`LC_ALL=C.UTF-8`, `LANG=C.UTF-8`, `TZ=UTC`). The audit rule `dockerfile-pins-locale` checks all three in a single assertion; all three must be present.

### `scripts/build.sh`

- Asserts `SOURCE_DATE_EPOCH` is set
- Uses `pnpm install --frozen-lockfile`
- Emits a `RELEASE_HASHES.txt` SHA-256 manifest at the end of the build

### `scripts/reproduce.sh`

- Derives `SOURCE_DATE_EPOCH` from `git log -1 --pretty=%ct`
- Builds from a fresh worktree (`git worktree add --detach` into a `mktemp -d` directory) rather than using the maintainer's working tree. The worktree is removed on exit via a `trap`.

### `electron-builder.config.cjs`

- `asar: true` (deterministic asar archive)
- References `SOURCE_DATE_EPOCH`
- Pins AppImage compression to xz

### `Reproducible_Builds.md` (in the desktop package)

- Mentions Level-2 + RELEASE_HASHES, proof the docs match the implementation

`test/smoke/audits/repro-build-audit.smoke.js` imports `runReproBuildAudit()` and asserts every rule returns `ok: true`. CI fails on any regression. Future PRs that drop a digest pin / un-freeze the lockfile / introduce non-determinism in the build config fail this smoke before they merge.

## Run-twice verification protocol

The byte-for-byte verification has to happen on a clean dev machine. The `reproduce.sh` script (invoked via `pnpm --filter @xchain-wallet/desktop reproduce`) uses `git worktree add --detach` rather than a fresh clone, so each run checks out the target ref into a temporary directory without touching the working tree:

```bash
# 1. Clone the repo at a specific tag (only needed once per verifier machine)
git clone --depth 1 --branch v1.0.0 https://github.com/XChain-Platform/xchain-wallet.git
cd xchain-wallet

# 2. First build: reproduce.sh checks out v1.0.0 into a temp worktree,
#    builds in Docker, and writes RELEASE_HASHES.txt into the output dir.
pnpm --filter @xchain-wallet/desktop reproduce v1.0.0 /tmp/repro-run-1

# 3. Second build: same script, fresh worktree, different output dir.
pnpm --filter @xchain-wallet/desktop reproduce v1.0.0 /tmp/repro-run-2

# 4. Compare
diff /tmp/repro-run-1/RELEASE_HASHES.txt /tmp/repro-run-2/RELEASE_HASHES.txt
```

Because `reproduce.sh` isolates each run in its own `mktemp` worktree, back-to-back runs on the same clone are equivalent to two independent clones for reproducibility purposes. If you prefer the original two-clone approach, that also works; the git-worktree approach is simply faster for local verification.

A successful verification produces a zero-line `diff`. Any difference means something non-deterministic crept in; report it via `security@dankest.llc`.

The recommendation at GA: run the verification on at least two **independent** dev machines (different OS host + different CPU architecture if practical). A single-machine run rules out repo-side non-determinism; multi-machine runs rule out machine-specific compiler / linker / library quirks.

## Comparing against a maintainer release

Maintainer publishes:

- The signed installers
- The pre-signing Linux bundle
- `RELEASE_HASHES.txt` over the pre-signing bundle
- The git tag

Independent verifier runs the protocol above against the same git tag, then diffs their `RELEASE_HASHES.txt` against the maintainer's. A clean diff means the verifier has independently confirmed the maintainer's bundle came from the published source.

The verifier doesn't need the maintainer's signing identity, they're verifying the **input to signing**, not the signature itself. This is the core security property: a maintainer who quietly slipped malicious code into a release would have to ship a bundle whose SHA-256 doesn't match what a verifier would produce from public source, and verifiers would notice.

## Common drift sources

- **Lockfile drift.** Always run with `--frozen-lockfile`. The audit asserts this in `scripts/build.sh`.
- **Build-tool version drift.** The Docker base image is digest-pinned; NODE_VERSION is pinned in the image. Tooling outside the container (host's pnpm, host's Node) does not affect the build.
- **Locale / timezone.** Some toolchains embed locale-dependent strings into output. Both are pinned in the Dockerfile.
- **Timestamp drift.** `SOURCE_DATE_EPOCH` is sourced from `git log -1 --pretty=%ct`, same input across runs.
- **PnP / hoist drift.** pnpm's hoist mode can produce different `node_modules/` layouts; the lockfile + frozen install + container isolation rule this out.
- **electron-builder asar drift.** `asar: true` produces a deterministic archive; the audit asserts the config flag is set.
- **AppImage compression drift.** Pinned to xz with deterministic flags.

If a reproducer fails, the most-common cause is a dep drifting *outside* the repo; a published npm version retroactively republished, a base image's tag pointing to a different digest. The pinned digest + frozen lockfile rule out both.

## Roadmap

- **Web SPA reproducibility.** Same protocol applied to the static SPA bundle.
- **Chrome extension reproducibility.** Reproduce the unpacked extension bytes; the CWS-signed package signature is an independent maintainer-only step.
- **macOS / Windows reproducibility.** Requires VM-based per-OS runners. Larger undertaking; tracked but unscheduled.
- **Level-3 multi-party signing.** Currently out of scope. Level-2 covers what's verifiable without operational overhead; Level-3 (multi-party signing) trades simplicity for stronger custody of the signing identity itself.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
