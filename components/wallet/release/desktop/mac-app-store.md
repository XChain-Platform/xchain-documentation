<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Desktop: Mac App Store

The Mac App Store is the way many macOS users expect to install an app, so a listing there sits alongside the direct download described in [macOS](macos.md). It does not replace it. Both channels ship.

This page carries both halves of the lane: the submission runbook an operator follows, and the listing collateral they paste into the console.

**The lane is built and is waiting on credentials.** The packaging, entitlements and store-specific behaviour exist and are held in place by tests. What does not exist yet is the Apple Developer Program enrollment and the certificates it issues, so nothing can be submitted today.

## How this channel differs from the direct download

| | Direct download ([macOS](macos.md)) | Mac App Store (this page) |
|---|---|---|
| Signing identity | Developer ID Application | Apple Distribution |
| Installer signing | Not applicable | Third-party Mac Developer Installer |
| Isolation | Hardened runtime | **The App Sandbox**, which is a real restriction |
| Apple's gate | Notarization, which is automated | **App Review**, which is a person |
| Provisioning profile | None | Required |
| Updates | The wallet's own feed, through the in-app updater | **The App Store, and the app must never update itself** |
| Artifact | `.dmg`, `.zip` | `.pkg` |

## Separate installs hold separate wallets

A Mac App Store install and a direct-download install **do not share a wallet**. A store build runs in Apple's app sandbox, which gives it its own storage, so a wallet created in one is not visible in the other.

There is no cross-install detection and none is planned: a sandboxed build largely cannot see the other install anyway. The supported way to carry a wallet from one install to the other is the wallet's own encrypted backup: export from the first, import into the second. The same is true on Windows between the [Microsoft Store](microsoft-store.md) and direct builds, and on Linux between the [Snap Store](snap-store.md) and direct builds.

## Submission runbook

### Ground rules

Work through the phases in order. Several steps are permanent, and the later ones assume the earlier ones happened.

Three things on this lane cannot be undone by re-running anything:

- **The bundle identifier is fixed at first upload.** Changing it afterwards does not move an app, it creates a second one, and every existing install is orphaned on the old identifier with no upgrade path.
- **App Review is a human gate with a queue.** A rejection costs days, not minutes, which is why Phase 1 exists: the two settings that fail this lane do not fail the build, they fail at upload or in review.
- **A build that reaches users cannot be pulled back into their hands.** Removing a listing stops new installs; it does not touch the ones already out there.

### Phase 0: the blocking gate

⬜ The Apple Developer Program enrollment is complete and organization-owned. This is the single longest-lead item on the whole lane and it gates everything below.  
⬜ Two-factor authentication on the account is a hardware security key or a passkey, and weaker fallbacks are removed.  
⬜ The Apple Distribution certificate exists on the release machine.  
⬜ The third-party Mac Developer Installer certificate exists on the release machine. This is a **separate** certificate from the one above, and it signs the installer package rather than the app.  
⬜ A provisioning profile exists for the app identifier.  
⬜ Every certificate and key is backed up somewhere off the release machine, in the place the other release credentials live.  
⬜ The privacy policy is live at a fetchable public URL and serves the **current** text, checked immediately before submission rather than remembered.  
⬜ **The hardware-signer question in Phase 1 has been answered**, because it decides whether this listing should exist at all.

### Phase 1: prove hardware wallets work under the sandbox, before anything else

**This is the phase that decides whether the channel ships, and it is deliberately first because it is answerable before the full certificate set exists.** It needs only a Mac Developer certificate, which is enough to make a local sandboxed development build.

Hardware wallets reach the app through a browser device interface. The sandbox entitlements request USB device access, which is the correct permission to ask for, but whether a sandboxed build actually reaches a Ledger or Trezor through it **has never been tested by anyone here**. It is not safe to assume either answer.

```
XCHAIN_BUILD_MAS=1 pnpm --filter @xchain-wallet/desktop run dist
```

⬜ A sandboxed development build is installed on a real Mac, with a real hardware wallet physically connected.  
⬜ The device is detected, and a transaction is signed with it end to end.  
⬜ If it does not work, the outcome is recorded and a decision is taken **before** any submission: either ship the listing with the limitation stated plainly on it, or do not ship this channel. Quietly shipping a wallet that cannot use a hardware wallet is not one of the options.

### Phase 2: build the store package

The store target is opt-in, so an ordinary release does not build it. The store build is **not** a variant of the direct-download build, and its settings do not carry across from one to the other.

⬜ The build produces a `.pkg`, named so it cannot be confused with a hosted download.  
⬜ **The sandbox is actually on.** The store configuration inherits every macOS setting unless it is explicitly overridden, and the direct-download entitlements carry no sandbox key at all. Inheriting them produces an unsandboxed store build that builds cleanly and is rejected later.  
⬜ **The hardened runtime is off for this build.** It belongs to the direct-download channel and is honoured on store builds too if it is left set, which is the same inherited-setting problem in its second form.  
⬜ The build contains no updater. Auto-update is removed on this channel rather than switched off, because a store build that shipped one would be rejected and could not replace its own bundle under the sandbox anyway.  
⬜ No staging or rehearsal variant was produced. This channel has no update feed to rehearse against, so such a build would exercise nothing.

### Phase 3: the console forms

⬜ The app record is created. **The bundle identifier is permanent from the first upload**, and it must not collide with the iOS app's own identifier.  
⬜ The listing text, screenshots and icon are in place, from [Screenshots](#screenshots) below. Screenshots use the same demonstration data as the other store listings.  
⬜ The screenshots were captured from the build being submitted, not from an older one. Capture them at the tag, which re-pins them in the same run, then ask the verifier whether anything they depict has moved since:

```
pnpm --filter @xchain-wallet/desktop run build:renderer
node packages/desktop/scripts/capture-listing-screenshots.mjs
node tools/release/verify-listing-assets.mjs --set mas --since vX.Y.Z
```

⬜ It reports `CLEAN`. `STALE` prints the commits that touched what each screenshot shows, and the two honest ways out are the same as on the other store pages: recapture at the tag, or record in the release record why none of those commits can change these pixels. `INCONCLUSIVE` means it could not tell at all, which is not a pass.  
⬜ **Read which DIRECTION it reports.** A `STALE:` line means the screenshots are older than the tag; an `AHEAD:` line means they are newer, so they show a build the upload does not contain. The second is the likelier one at submission, because the tag you may cut is the last commit with a green CI run while captures get taken on the tip. A `NOTE:` line is a pass: the capture is ahead but nothing it depicts moved in between. Until 2026-08-07 the tool could not see the ahead direction at all and printed `CLEAN` for it, so a run from before that date proves less than it appears to.  
⬜ The privacy answers are filled in, consistent with the wallet's published privacy policy and with the answers given on the other stores.  
⬜ The export-compliance answer is given, consistent with the other listings.  
⬜ If Phase 1 found that hardware wallets do not work under the sandbox, the listing says so.

### Phase 4: upload and review

⬜ The package uploads and passes ingestion. An identity or entitlement mismatch is caught here rather than in review, and it is cheaper here.  
⬜ The build is submitted to App Review, with reviewer notes explaining that the app is a self-custody wallet and how to exercise it without funds.  
⬜ Review passed. If it did not, the reason is recorded on this page so the next submission does not rediscover it.

### Phase 5: release

⬜ The listing is public, and the download page links the App Store install alongside the direct download.  
⬜ The separate-wallets sentence above is on the listing and on the download page **before** the listing goes public, not after.

### What this runbook does not cover

- Updates. The Store owns delivery on this channel, and the wallet's own update feed is irrelevant to it.
- Whether to submit one universal build or one per architecture. The direct download ships per-architecture; the Store prefers a single universal upload, and this should be settled when the first submission is actually assembled rather than guessed at now.

## Listing collateral

### Title

XChain Wallet

### Subtitle

Self-custody wallet for XChain

### Description

XChain Wallet is a self-custody wallet for the XChain platform and the coins it
runs on: Bitcoin, Litecoin and Dogecoin.

Your keys stay on your Mac. The wallet encrypts them with a passphrase you
choose, and nothing leaves the device unless you sign and send it.

What you can do with it:

- Hold, send and receive coins and tokens across every supported chain
- Trade on the decentralized exchange, and use dispensers
- Issue and manage your own tokens
- Stake, and take part in governance
- Back up and restore an encrypted copy of your wallet

This build is installed and updated by the App Store. It keeps its own wallet
storage, separate from a wallet installed from our download page. To move a
wallet between the two, use the wallet's encrypted backup export and import.

The wallet is free and open source, licensed under the AGPL.

### Screenshots

Apple takes no listing without at least one screenshot, and it accepts four
canvas sizes and nothing else: 1280x800, 1440x900, 2560x1600 and 2880x1800. An
image at any other size is refused at upload, days into a submission.

The three uploaded files live in `packages/desktop/docs/listing-assets/`,
generated by `packages/desktop/scripts/capture-listing-screenshots.mjs` so the
next person can regenerate them against a changed interface instead of retaking
them by hand. The script launches the real desktop application, drives it
through the wallet's own demo mode, resizes the window to the chosen canvas and
captures each view. Every one shows the demo wallet: synthetic balances, a
freshly generated address that is never funded, in a throwaway profile the
script deletes when it exits.

✅ Screenshot 1440x900: Home. Demo wallet, Mainnet, Coins tab, with the
synthetic Bitcoin, Litecoin and Dogecoin balances and the full desktop
navigation.  
✅ Screenshot 1440x900: Tokens. The same wallet's Tokens tab, showing the demo
dataset's tokens.  
✅ Screenshot 1440x900: Settings, which is where a reviewer looks for the
privacy and network controls the listing describes.  
✅ Each image's size is re-read from its PNG header and checked against Apple's
four accepted canvases before submission, rather than by the upload form.  
✅ **Which build each image depicts is recorded, because its dimensions cannot
say.** A successful capture writes `capture-pin.json` beside the images: the
commit and version it drove, and each image's sha256. The Mac App Store lane's
own check holds the images to that note, so one replaced or re-cropped without
a capture run fails; Phase 3's step asks the other half, whether anything an
image shows has moved since it was captured.

### Categorization

Category: Finance  
Licence: `AGPL-3.0-or-later`  
Contact: the public support address on the project website  
Website: the project website  
Source: the public wallet repository

## Related pages

- [macOS](macos.md): the direct download this channel sits alongside
- [Verify a release](../verify-release.md): the verification recipe for the direct downloads
- [Microsoft Store](microsoft-store.md) and [Snap Store](snap-store.md): the other two store lanes
