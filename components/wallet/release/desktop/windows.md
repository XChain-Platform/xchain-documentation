<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Desktop: Windows

**Status: not shipped.** No Windows build has been published yet. Any file offered as a Windows release of XChain Wallet is not ours; see [Verify a release](../verify-release.md). This page describes the lane planned for its first release.

The Windows desktop build is designed to ship two artifacts from the same source tree, one installable and one portable, for both `x64` and `arm64`.

## Artifacts

| Artifact | What it is |
|---|---|
| NSIS installer (`.exe`) | A guided installer. Not one-click: the user can change the install directory. Installs per-user, not per-machine, and does not delete app data on uninstall. |
| Portable zip (`.zip`) | A zip archive of the app, for running without installing. |

Windows will ship **two separate installers, one per architecture**, rather than a single combined installer covering both. Each artifact's filename carries its architecture, so a download will state which one it is.

## How it's built

Both artifacts come from `electron-builder`, driven by the desktop package's build configuration. The installer and the zip are built from the same packaged app; the installer wraps it in an NSIS setup wizard, the zip does not.

## Signing

Windows artifacts will be Authenticode-signed under the publisher identity **Dankest, LLC**. `electron-updater` refuses to install an update whose signed publisher doesn't match the currently installed app's publisher, so the publisher name is effectively part of the update contract, not just a display string.

## Updates

The NSIS installer is the update-capable artifact: `electron-updater` can download a new installer and swap it in for an existing install. **The portable zip has no update path.** If you run the wallet from the zip, check for new releases manually rather than expecting an in-app update prompt.

Once the lane ships, update checks will run against the wallet's `stable` release channel, pulled from the maintainer-controlled update feed. See [Build & Release](../../build-release.md) for how the update flow works across every shell.

## Verifying a download

There is no genuine Windows download to verify yet. Once the lane ships, [Verify a release](../verify-release.md) will give the full recipe for checking its published SHA-256 manifest and signature. Windows artifacts are outside the reproducible-build coverage (see [Reproducible Builds](../../reproducible-builds.md)), so hash and signature verification will be the integrity guarantee for this platform.

## Other Windows distribution

A Microsoft Store package is a separate distribution channel from the direct-download installer described here. See [Microsoft Store](microsoft-store.md).

**If you install both, they hold separate wallets.** Windows keeps a Store app's files in its own per-package storage, so the Store install and the installer described on this page do not share a wallet, and neither one can see the other's. Nothing detects this or warns you about it, and that is not planned. If you want the same wallet in both, move it deliberately: export an encrypted backup from one and import it into the other.
