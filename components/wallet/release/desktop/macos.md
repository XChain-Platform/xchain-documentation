<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Desktop: macOS

The macOS desktop build ships two artifacts from the same source tree, for both `x64` (Intel) and `arm64` (Apple Silicon).

## Artifacts

| Artifact | What it is |
|---|---|
| `.dmg` | The disk-image installer most users download. |
| `.zip` | A zipped `.app` bundle. |

## How it's built

Both artifacts come from `electron-builder`. The build runs with Apple's hardened runtime enabled and app-specific entitlements attached, which is what notarization requires. When Apple credentials are present at build time, the build is notarized; without them it produces an unsigned `.app`, which is fine for local development but will be rejected by a Gatekeeper-strict configuration on a user's machine.

## Signing

macOS artifacts are signed with a Developer ID certificate and notarized by Apple. Notarization is what lets a downloaded app open without a Gatekeeper warning.

## Updates

**Auto-update uses the zip, not the dmg.** `electron-updater`'s macOS updater selects the zip artifact when checking for and installing an update; the dmg is the initial-download installer, not something the running app swaps itself out for. Both artifacts are still listed in the release's channel metadata, but only the zip is actually fetched by the in-app updater.

Update checks run against the wallet's `stable` release channel, pulled from the maintainer-controlled update feed. See [Build & Release](../../build-release.md) for how the update flow works across every shell.

## Verifying a download

See [Verify a release](../verify-release.md) for the full recipe: importing the release key, checking the published SHA-256 manifest, and verifying the GPG signature over it. macOS artifacts are not part of the reproducible-build coverage (see [Reproducible Builds](../../reproducible-builds.md)); hash and signature verification is the available integrity guarantee for this platform.

## Other macOS distribution

A Mac App Store build is a separate distribution channel, signed and sandboxed differently from the direct-download build described here, and updated by the App Store instead of the in-app updater. See [Mac App Store](mac-app-store.md).
