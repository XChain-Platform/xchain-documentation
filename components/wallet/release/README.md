<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Release engineering

The wallet ships from a single source tree to every shell (web, extension, desktop, mobile) at one release version, built and signed in one signing ceremony. This section covers how each artifact is built, how it receives updates, and how to verify what you downloaded.

Start with [Verify a release](verify-release.md) if you just want to check a download. Start with [Build & Release](../build-release.md) if you want the platform-wide picture: synchronized versioning, per-shell build commands, and the full release-artifact list.

## Lanes

| Lane | Page | Covers |
|---|---|---|
| Verification | [Verify a release](verify-release.md) | The recipe anyone can run to verify a downloaded artifact: hash, signature, release identity, and reproducibility |
| QA | [QA checklist](qa-checklist.md) | The manual pre-release checklist run against every shell before a release is tagged |
| Release CI | [Release CI setup](ci-setup.md) | How the signing lane in continuous integration is protected: the signed-tag requirement, the restricted signing environment, the artifact signature check, and what is deliberately not automated |
| Desktop: Windows | [desktop/windows.md](desktop/windows.md) | NSIS installer and portable zip, Authenticode signing, update channel |
| Desktop: macOS | [desktop/macos.md](desktop/macos.md) | `.dmg` and `.zip`, notarization, update channel |
| Desktop: Linux | [desktop/linux.md](desktop/linux.md) | AppImage and `.deb`, reproducible builds, update channel |
| Desktop: Mac App Store | [desktop/mac-app-store.md](desktop/mac-app-store.md) | App Store submission and the sandbox lane, pending store enrollment |
| Desktop: Microsoft Store | [desktop/microsoft-store.md](desktop/microsoft-store.md) | Microsoft Store submission and the MSIX lane, pending publisher identity |
| Desktop: Snap Store | [desktop/snap-store.md](desktop/snap-store.md) | Snap submission and the `snapd` update lane, pending store registration |
| Extension: Chrome Web Store | [extension/chrome-web-store.md](extension/chrome-web-store.md) | Chrome Web Store submission and update lane |
| Extension: test dApp runbook | [extension/test-dapp-runbook.md](extension/test-dapp-runbook.md) | Exercising the `window.xchain` bridge against the reference test dApp |
| Mobile: Google Play | [mobile/android-play.md](mobile/android-play.md) | Android build and Play Store distribution |
| Mobile: App Store | [mobile/ios-app-store.md](mobile/ios-app-store.md) | iOS build and App Store distribution |

## Shared references

- [Build & Release](../build-release.md): synchronized versioning, per-shell build commands, signing overview, distribution channels
- [Reproducible Builds](../reproducible-builds.md): what "Level-2 reproducible" means, what's covered, and how to run the comparison yourself
