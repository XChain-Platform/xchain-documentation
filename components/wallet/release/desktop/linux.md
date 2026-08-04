<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Desktop: Linux

The Linux desktop build ships two artifacts we host ourselves, from the same source tree, for both `x64` and `arm64`. A third Linux package, the Snap Store one, is built from the same tree but is a separate channel with its own signing, updates and integrity story; everything on this page describes the two hosted artifacts unless it says otherwise. See [Snap Store](snap-store.md).

## Artifacts

| Artifact | What it is |
|---|---|
| `.AppImage` | A self-contained, portable binary; run it directly, no install step. |
| `.deb` | A Debian package, for `apt`/`dpkg`-based distributions. |
| `.snap` | Not covered here. Installed from the Snap Store, signed by the Store rather than by us, and updated by `snapd`. See [Snap Store](snap-store.md). |

**If you install both a hosted artifact and the snap, they hold separate wallets.** Strict confinement redirects a snap's writes into its own directory under your home folder, so the snap and the `.AppImage` or `.deb` described on this page do not share a wallet, and neither one can see the other's. Nothing detects this or warns you about it, and that is not planned. If you want the same wallet in both, move it deliberately: export an encrypted backup from one and import it into the other.

## How it's built

Both artifacts come from `electron-builder`, packaged with an `xz`-compressed archive for the `.deb`. Neither artifact carries an operating-system code signature: Linux has no equivalent of Windows Authenticode or Apple notarization for a generic binary, so integrity here rests on the published hashes and signature described below rather than OS-level signing.

## Updates

Both artifacts are update-capable, but the mechanics differ:

- **`.AppImage`**: `electron-updater` downloads the new AppImage and swaps it in place.
- **`.deb`**: `electron-updater` downloads the new package and installs it with `dpkg`, which requires a privilege-escalation prompt. The update still happens through the in-app updater; it just needs the user to authorize the install the way any `.deb` install does.

Update checks run against the wallet's `stable` release channel, pulled from the maintainer-controlled update feed. See [Build & Release](../../build-release.md) for how the update flow works across every shell.

## Verifying a download

Linux is the platform with the strongest integrity story, for two reasons:

1. **It's reproducible.** The packaged `.AppImage` and `.deb`, for both architectures, are Level-2 reproducible: an independent verifier can rebuild from the tagged source and get byte-identical artifacts. See [Reproducible Builds](../../reproducible-builds.md) for what that covers and [Verify a release](../verify-release.md) for the rebuild-and-diff recipe.
2. **Because there's no OS code signature, update authenticity rests entirely on a signed release manifest.** Before installing any update, on every platform, the wallet verifies a GPG-signed hash manifest against a copy of the release key compiled into the app itself, and refuses to install anything the manifest doesn't cover. On Linux this pinned-key check is the *only* authenticity check in the update path, since there's no OS signature backing it up, which is exactly why Linux is also the platform where independent, bit-for-bit reproduction matters most.

See [Verify a release](../verify-release.md) for the full manual verification recipe: importing the release key, checking the published SHA-256 manifest, verifying the GPG signature, and reproducing the build yourself.
