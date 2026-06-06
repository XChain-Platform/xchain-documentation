<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Build & Release

This document covers the wallet's release process: synchronized versioning, per-shell build pipelines, signing, packaging, and distribution channels.

## Synchronized versioning

All packages in the repository ship at the **same version number**:

- `package.json` (root) — single source of truth
- `packages/core/package.json`
- `packages/web/package.json`
- `packages/extension/package.json`
- `packages/desktop/package.json`
- `packages/bridge-spec/package.json`
- `packages/test-dapp/package.json`
- `e2e/package.json`

Rationale: users running the web app, the extension, and the desktop app need an obvious way to confirm they're on the same build. Every shell's About screen surfaces its own `package.json.version`, so synchronized versions let users diff `1.0.0-rc.6-extension` vs `1.0.0-rc.6-web` vs `1.0.0-rc.6-desktop` and immediately know they're on the same codebase.

`CHANGELOG.md` at the repo root is authoritative; sub-packages don't maintain their own changelogs.

### Release bump procedure

1. Bump every `package.json` together
2. Update `CHANGELOG.md` — move `[Unreleased]` entries to the new version section with a date
3. Re-derive `packages/extension/manifest.json`'s `version` from the new wallet semver via `packages/core/scripts/derive-extension-version.js`; mirror the human-readable wallet semver into `version_name`
4. Run the smoke suite — `pnpm --filter @xchain-wallet/core test` — and verify the extension-manifest-audit smoke passes
5. Tag the commit `v<version>` and push

### Extension version derivation

Chrome's `version` field rejects semver prerelease tags like `1.0.0-rc.6`. The wallet derives a Chrome-valid 1–4-tuple of integers 0–65535:

| Wallet semver | Chrome `version` | Chrome `version_name` |
|---|---|---|
| `1.0.0` | `1.0.0` | `1.0.0` |
| `1.0.0-rc.1` | `0.1.0.1` | `1.0.0-rc.1` |
| `1.0.0-rc.6` | `0.1.0.6` | `1.0.0-rc.6` |
| `1.2.3` | `1.2.3` | `1.2.3` |

The leading `0` on prereleases pins them strictly below every stable tuple with M ≥ 1, so the CWS upgrade ordering stays monotonic across the RC → GA cut. Stable bumps are unchanged (`1.2.3` → `1.2.3`).

## Per-shell build

| Shell | Command | Output |
|---|---|---|
| Web | `pnpm --filter @xchain-wallet/web build` | `packages/web/dist/` — static SPA |
| Extension | `pnpm --filter @xchain-wallet/extension build` | `packages/extension/dist/` — unpacked Chrome extension |
| Desktop renderer | `pnpm --filter @xchain-wallet/desktop build:renderer` | `packages/desktop/build/` — bundled into the asar |
| Desktop installers | `pnpm --filter @xchain-wallet/desktop dist` | `packages/desktop/dist/` — `.dmg` / `.exe` / `.AppImage` |
| Desktop pre-signing (reproducible) | `pnpm --filter @xchain-wallet/desktop dist:unpacked` | `packages/desktop/dist/linux-unpacked/` + `RELEASE_HASHES.txt` |

All builds run with the workspace's `pnpm install --frozen-lockfile` to lock dep versions to the shipped lockfile. Drift in transitive deps is the most common source of reproducibility failures; the frozen lockfile is the first line of defense.

## Signing

| Shell | Signing |
|---|---|
| Web | None — the web app is served from a static origin; users verify via the URL bar |
| Extension | CWS signs the published artifact; no maintainer-side signing |
| Desktop macOS | Apple Developer cert via `electron-builder`; Apple-notarized `.dmg` |
| Desktop Windows | Authenticode cert via `electron-builder`; signed `.exe` |
| Desktop Linux | xz-compressed `.AppImage`; no built-in OS-level code signing — users verify via published SHA-256 |

Signing identities live with the publisher (Dankest, LLC). Independent verifiers reproduce the **pre-signing** Linux artifact and verify it matches the maintainer's published `RELEASE_HASHES.txt` — see [Reproducible Builds](Reproducible_Builds.md).

## Distribution

| Shell | Channel |
|---|---|
| Web | Static-hosted at the canonical XChain Wallet URL |
| Extension | Chrome Web Store (and per-vendor stores for Edge / Brave once added) |
| Desktop | GitHub Releases + a maintainer-controlled update feed consumed by `electron-updater` |

Auto-update for desktop:

- `electron-updater` checks the feed at launch + on user-initiated "check for updates"
- New artifacts are downloaded in the background
- Signature verification runs **before** swap — the updater refuses to install an artifact whose signature doesn't match the publisher key
- The user is prompted to install + restart; auto-apply is opt-in

Auto-update for the extension is handled entirely by the CWS — the wallet publishes a new build and the CWS pushes it to installed instances within ~24 hours. The wallet does not implement its own auto-update channel.

## Chrome Web Store submission

The CWS submission packet lives in the platform repo (gitignored) at `claude/reports/specs/2026-04-24_cws-submission.md`. It covers:

- Build artifact + zip procedure
- Listing copy with verbatim strings
- Screenshot dimensions + capture procedure for the five required surfaces (Home, Send, Sign-screen, Multisig Receive, Settings → Security)
- Promo tile spec
- Privacy practices form answers
- Common rejection reasons + dry-run greps
- Single-purpose statement to paste
- Pre-submission smoke + audit run
- Post-approval automation roadmap
- Edge / Firefox variants

CWS submission is one of the three remaining user-driven items before v1.0.0 GA. The submitter (Dankest, LLC) hosts the privacy policy at a public URL — `packages/extension/PRIVACY_POLICY.md` is authored to be hosted as-is on either GitHub Pages or `https://dankest.llc/xchain-wallet/privacy`.

## Release artifact list

A v1.0.0 GA release publishes:

| Artifact | Source |
|---|---|
| `xchain-wallet-1.0.0.dmg` | macOS desktop installer |
| `xchain-wallet-1.0.0.exe` | Windows desktop installer |
| `xchain-wallet-1.0.0.AppImage` | Linux desktop bundle |
| `xchain-wallet-1.0.0-linux-unpacked.tar.gz` | Pre-signing Linux bundle (reproducible target) |
| `RELEASE_HASHES.txt` | SHA-256 manifest of the pre-signing Linux bundle contents |
| `xchain-wallet-extension-1.0.0.zip` | Unpacked Chrome extension (informational; CWS hosts the canonical) |
| `xchain-wallet-web-1.0.0.tar.gz` | Static SPA bundle (informational) |
| `RELEASE.md` | Release notes — pulled from the `[1.0.0]` section of `CHANGELOG.md` |

Independent verifiers download the source tarball + the pre-signing Linux bundle + `RELEASE_HASHES.txt`, run the reproduce script in a Docker container, and verify the output bundle matches the manifest.

## Pre-launch readiness gates

Before tagging `v1.0.0` GA:

| Gate | Status |
|---|---|
| All 4 implementation phases closed | ✅ Done at v0.95.0 |
| Static a11y audit passes (5 rules over 64 routes + 9 primitives) | ✅ Done at v0.100.0 |
| Reproducible-build scaffolding audit passes (18 rules) | ✅ Done at v0.101.0 |
| §56.3 pre-launch autonomous track closed | ✅ Done at v1.0.0-rc.1 |
| §56.3 pre-launch user-initiated track autonomous portion closed | ✅ Done at v1.0.0-rc.6 |
| External security audit complete | ⬜ Pending — readiness packet shipped |
| External accessibility audit complete | ⬜ Pending — readiness packet shipped |
| Chrome Web Store submission approved | ⬜ Pending — submission playbook shipped |
| Byte-for-byte reproducible-build verification on a clean dev machine | ⬜ Pending — protocol documented |

The first three pending items are user-driven and require external coordination; the fourth is a one-shot procedure run by the maintainer on a clean Docker host.

## Release notes

Every release ships a CHANGELOG entry describing:

- The phase + step the release closes (e.g. "§56.3 Pre-launch — Step 5 of 7")
- Added / Changed / Decided / Notes sections
- Why each decision was made — short, specific, audit-friendly

The "Decided" sections capture the reason a particular trade was made so a future reader (audit vendor, maintainer reviewing legacy decisions, downstream packager) can re-evaluate without rediscovering the alternatives.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
