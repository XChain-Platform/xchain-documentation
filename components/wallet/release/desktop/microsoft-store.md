<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Desktop: Microsoft Store

The wallet is offered two ways on Windows: installed from the Microsoft Store, and downloaded as a signed executable we host ourselves ([Windows](windows.md)). Both channels ship. This page covers the Store one.

This page carries both halves of the lane: the submission runbook an operator follows, and the listing collateral they paste into the console.

**The lane is built and is waiting on an identity.** The packaging, the store tiles and the store-specific behaviour exist and are held in place by tests. What does not exist yet is the publisher account and the identity values it assigns, so nothing can be submitted today.

## How this channel differs from the direct download

| | Direct download ([Windows](windows.md)) | Microsoft Store (this page) |
|---|---|---|
| Artifact | `.exe` installer, `.zip` | `.appx`, which is an MSIX package |
| Signing | Ours, with our own certificate identity | Microsoft re-signs the package when it is ingested |
| Identity | The certificate's subject name | A publisher and identity name assigned by the store account |
| Isolation | None | An MSIX container: file and registry writes are virtualized, but the app runs at **full trust** |
| Gate | None | Store certification |
| Updates | The wallet's own feed, through the in-app updater | **The Store, and the app must never update itself** |
| Warning on install | Possible on a new signing identity, see below | None, by definition |

## What the Store does and does not fix

A Store install shows no "Windows protected your PC" warning at all, so for users who install that way the problem is simply gone from day one.

**It buys nothing for the executable we host.** That warning comes from a reputation system keyed to the signing identity and the file itself, not to whether the publisher also has a Store listing. A brand-new signing identity starts with no reputation regardless of how many stores it is in.

So the honest summary is two independent facts: the Store path is warning-free the day the listing is live, and the hosted path still has to build reputation on its own. What the Store gives is a warning-free path to point people at while that happens, which is worth saying on the download page rather than leaving people to find the alarming path first.

## Separate installs hold separate wallets

A Microsoft Store install and a direct-download install **do not share a wallet**. An MSIX package's file writes are virtualized into its own per-package storage, so a wallet created in one is not visible in the other.

There is no cross-install detection and none is planned. The supported way to carry a wallet from one install to the other is the wallet's own encrypted backup: export from the first, import into the second. The same is true on macOS between the [Mac App Store](mac-app-store.md) and direct builds, and on Linux between the [Snap Store](snap-store.md) and direct builds.

Both Windows channels are shipping, so unlike on macOS this is not hypothetical: users will have both available to them on the same machine.

## Submission runbook

### Ground rules

Work through the phases in order. Several steps are permanent, and the later ones assume the earlier ones happened.

Three things on this lane cannot be undone by re-running anything:

- **The reserved name and the assigned identity values are the listing's identity.** They are account-specific, they are assigned once, and the package must be built with the real values or it is rejected when it is ingested.
- **A published submission reaches users through the Store's own update pipeline.** Pulling a listing stops new installs; it does not reach the ones already out there.
- **Certification is a gate with a queue.** Every setting in Phase 2 fails at ingestion or in certification rather than at build time, which is the expensive place to learn about them.

### Phase 0: the blocking gate

⬜ A Partner Center publisher account exists, is organization-owned, and its identity verification is complete.  
⬜ Two-factor authentication on the account is a hardware security key or a passkey, and weaker fallbacks are removed.  
⬜ The app name is reserved in the account.  
⬜ **The two identity values the package must be built with are recorded** where the build can read them: the identity name and the publisher string, both assigned by the account. Neither can be guessed and neither has a usable default (see Phase 2).  
⬜ The privacy policy is live at a fetchable public URL and serves the **current** text, checked immediately before submission rather than remembered.  
⬜ The release being submitted is a tagged release that already passed its own build and verification.

### Phase 1: build the store package

The store target is opt-in, so an ordinary release does not build it. **It can only be produced on a Windows host.**

```
set XCHAIN_BUILD_APPX=1
set APPX_IDENTITY_NAME=<the value assigned by the store account>
set APPX_PUBLISHER=<the publisher string assigned by the store account>
pnpm --filter @xchain-wallet/desktop run dist
```

⬜ Both architectures are produced, `x64` and `arm64`. The Store serves an architecture-specific package, so shipping one silently halves the audience.  
⬜ No staging or rehearsal variant was produced. This channel has no update feed to rehearse against.

### Phase 2: check the three settings that fail silently

**Each of these builds successfully and fails later, which is why they are checked here rather than trusted.**

⬜ **The publisher string is the one the store account assigned.** This is the dangerous one: leaving it unset does **not** fail the build. With no signing certificate present the packaging substitutes a placeholder value and logs that the package is unsigned; with a certificate present it silently uses that certificate's identity, which is the direct-download identity and not the Store one. Either way the package builds and is rejected at ingestion for an identity mismatch.  
⬜ **The identity name is the assigned value**, not the default. The default is derived from the internal package name, which contains characters the format does not allow, so this one at least fails loudly while the setting stays pinned.  
⬜ **The package is not named with the direct-download naming convention.** The store configuration inherits the Windows settings unless overridden, and inheriting the artifact name would produce a store package named like a file we host, which is the one artifact that must never be mistaken for one.  
⬜ **The four store tile images are the real ones.** If any tile image is missing, the packaging substitutes its own sample artwork with no warning, and the listing ships vendor placeholder images. This has now been caught three times across the wallet's shells, in three different forms, so check the images rather than checking that the directory exists.  
⬜ The build contains no updater. An MSIX install is immutable and is updated only through the Store pipeline, so a self-updating store build is a certification failure that could not have worked anyway.

### Phase 3: check hardware wallets still work

Unlike the Mac App Store, this container is **not** a sandbox: a packaged build runs at full trust and reaches USB devices the way an ordinary Windows install does. That is the expectation, so this phase confirms it rather than discovering it.

⬜ The packaged build is installed on a real Windows machine with a hardware wallet connected, and a transaction is signed with it end to end.  
⬜ Both architectures are checked, or the untested one is recorded as untested.

### Phase 4: the console forms and certification

⬜ The listing text, screenshots and tile images are in place. Screenshots use the same demonstration data as the other store listings.  
⬜ The privacy and data-collection answers are filled in, consistent with the wallet's published privacy policy and with the answers given on the other stores.  
⬜ The export-compliance answer is given, consistent with the other listings.  
⬜ Both architecture packages are uploaded to the same submission.  
⬜ Certification passed. If it did not, the reason is recorded on this page so the next submission does not rediscover it.

### Phase 5: release

⬜ The listing is public, and the download page links the Store install alongside the hosted installer.  
⬜ The separate-wallets sentence above is on the listing and on the download page **before** the listing goes public.  
⬜ The download page points users at the Store path as the warning-free one while the hosted installer's reputation builds.

## Listing collateral

### Title

XChain Wallet

### Short description

Self-custody wallet for XChain, Bitcoin, Litecoin and Dogecoin

### Description

XChain Wallet is a self-custody wallet for the XChain platform and the coins it
runs on: Bitcoin, Litecoin and Dogecoin.

Your keys stay on your PC. The wallet encrypts them with a passphrase you
choose, and nothing leaves the device unless you sign and send it.

What you can do with it:

- Hold, send and receive coins and tokens across every supported chain
- Trade on the decentralized exchange, and use dispensers
- Issue and manage your own tokens
- Stake, and take part in governance
- Sign with a hardware wallet, or with a watch-only address
- Back up and restore an encrypted copy of your wallet

This build is installed and updated by the Microsoft Store. It keeps its own
wallet storage, separate from a wallet installed from our download page. To move
a wallet between the two, use the wallet's encrypted backup export and import.

The wallet is free and open source, licensed under the AGPL.

### Categorization

Category: Finance  
Licence: `AGPL-3.0-or-later`  
Contact: the public support address on the project website  
Website: the project website  
Source: the public wallet repository

## Related pages

- [Windows](windows.md): the hosted installer this channel sits alongside
- [Verify a release](../verify-release.md): the verification recipe for the direct downloads
- [Mac App Store](mac-app-store.md) and [Snap Store](snap-store.md): the other two store lanes
