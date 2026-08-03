<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Desktop: Windows

The Windows desktop build ships two artifacts from the same source tree, one installable and one portable, for both `x64` and `arm64`.

## Artifacts

| Artifact | What it is |
|---|---|
| NSIS installer (`.exe`) | A guided installer. Not one-click: the user can change the install directory. Installs per-user, not per-machine, and does not delete app data on uninstall. |
| Portable zip (`.zip`) | A zip archive of the app, for running without installing. |

Windows ships **two separate installers, one per architecture**, rather than a single combined installer covering both. Each artifact's filename carries its architecture, so a download always states which one it is.

## How it's built

Both artifacts come from `electron-builder`, driven by the desktop package's build configuration. The installer and the zip are built from the same packaged app; the installer wraps it in an NSIS setup wizard, the zip does not.

## Signing

Windows artifacts are Authenticode-signed under the publisher identity **Dankest, LLC**. `electron-updater` refuses to install an update whose signed publisher doesn't match the currently installed app's publisher, so the publisher name is effectively part of the update contract, not just a display string.

## Updates

The NSIS installer is the update-capable artifact: `electron-updater` can download a new installer and swap it in for an existing install. **The portable zip has no update path.** If you run the wallet from the zip, check for new releases manually rather than expecting an in-app update prompt.

Update checks run against the wallet's `stable` release channel, pulled from the maintainer-controlled update feed. See [Build & Release](../../build-release.md) for how the update flow works across every shell.

## Verifying a download

See [Verify a release](../verify-release.md) for the full recipe: importing the release key, checking the published SHA-256 manifest, and verifying the GPG signature over it. Windows artifacts are not part of the reproducible-build coverage (see [Reproducible Builds](../../reproducible-builds.md)); hash and signature verification is the available integrity guarantee for this platform.

## Other Windows distribution

A Microsoft Store package is a separate distribution channel from the direct-download installer described here. See [Microsoft Store](microsoft-store.md).
