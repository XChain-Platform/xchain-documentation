<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Desktop: Snap Store

The Snap Store is the store Ubuntu's App Center browses by default, so a Snap listing is what makes `snap install xchain-wallet` and a one-click install from App Center work. It sits alongside the hosted AppImage and `.deb` described in [Linux](linux.md); it does not replace either.

This page carries both halves of the lane: the submission runbook an operator follows, and the listing collateral they paste into the console.

## How this channel differs from the direct download

| | Direct download ([Linux](linux.md)) | Snap Store (this page) |
|---|---|---|
| Artifact | `.AppImage`, `.deb` | `.snap`, which is a squashfs image |
| Signing | None at the operating-system level; trust rests on the published hashes and their signature | Store assertions: `snapd` installs only what the Store has signed |
| Identity | Filename plus the published manifest | The registered store name, which is first-come |
| Isolation | None | Strict confinement: an AppArmor and seccomp sandbox, with access gated per interface |
| Review | None | Automated. Strict confinement passes automatically; `classic` confinement needs a human reviewer |
| Updates | The wallet's own update feed, through the in-app updater | `snapd` auto-refresh, several times a day, and **the app must never update itself** |
| Where it installs from | The download page | Ubuntu App Center, or `snap install` |

## Separate installs hold separate wallets

A Snap install keeps its data under the Snap's own home directory rather than the usual one, because strict confinement redirects the app's writes. That means **a Snap install and a direct install do not share a wallet**, exactly as a Microsoft Store install and a direct Windows install do not, and a Mac App Store install and a direct macOS install do not.

There is no cross-install detection and there is deliberately none planned: a confined build largely cannot see the other install anyway. The supported way to carry a wallet from one install to the other is the wallet's own encrypted backup: export from the first install, import into the second. This sentence belongs on the listing before it is public, not after a user discovers it.

## Submission runbook

### Ground rules

Work through the phases in order. The phases are ordered because several steps are permanent, and the later ones assume the earlier ones happened.

Three things on this lane cannot be undone by re-running anything:

- **The registered name is first-come and it is the listing's identity.** Registering it is free, and losing it to somebody else is not recoverable by any support path worth planning around. Register before building, not after.
- **A revision published to `stable` reaches every existing install within hours**, because auto-refresh is on by default and users do not choose when it happens. There is no recall. The only remedies are publishing a further revision or closing the channel, and both leave some users on the bad one for a while.
- **Confinement is part of the review contract.** A listing that ships `strict` and later needs `classic` goes back to a human reviewer and loses automatic review for good.

### Phase 0: the blocking gate

Nothing below this line is worth starting until every one of these is true.

⬜ An Ubuntu One account exists for the publisher, and it is the account the team intends to keep. It is free and needs no entity verification, which makes this the cheapest of the store enrollments, and also the easiest one to create casually under the wrong identity.  
⬜ Two-factor authentication is enabled on that account, and the recovery codes are stored where the rest of the release credentials live.  
⬜ The store name is registered and held (Phase 1).  
⬜ The store login credential has been exported and placed in the release-secrets store, the same way every other publishing credential is held. It is what publishes, so it is custody like any signing key.  
⬜ The privacy policy is live at a fetchable public URL and serves the **current** text, checked immediately before this submission rather than remembered from the last one.  
⬜ The release being submitted is a tagged release that already passed its own build and verification, not an ad-hoc local build.

### Phase 1: register the name

Registration is separate from publishing and should happen as early as possible, because the name is first-come.

```
snapcraft login
snapcraft register xchain-wallet
snapcraft list-registered
```

⬜ `snapcraft list-registered` lists the name against the publisher account.  
⬜ The publisher display name shown on the listing is the legal entity, not an individual's account name.

Then export the credential the automated lane will use. Run this on the release machine and put the output straight into the release-secrets store; do not paste it into a terminal that logs, a chat, or a file in the repository.

```
snapcraft export-login --acls package_upload,package_release -
```

⬜ The exported credential is stored at `0600` alongside the other release credentials, and its expiry date is recorded so it is renewed before it lapses rather than after a release fails.

### Phase 2: build the snap

The Snap target is opt-in, so an ordinary release does not build it. It needs a Linux host with the `snapcraft` command and its build backend available.

```
command -v snapcraft
XCHAIN_BUILD_SNAP=1 pnpm --filter @xchain-wallet/desktop run dist
```

⬜ Both architectures are produced, `amd64` and `arm64`. The Store serves per-architecture, so shipping one silently halves the audience.  
⬜ The filenames carry no slash and no space. The default naming derives from the package name and would contain a slash, which is the same defect that once wrote a `.deb` into a directory nothing enumerated.  
⬜ The build ran on a real `snapcraft` toolchain rather than being skipped. An opt-in target that quietly produced nothing is indistinguishable from a target that was never wired up, so check for the artifacts rather than for a zero exit code.

### Phase 3: prove the browser sandbox is still on

**This is the most important check on the page and the reason it is a phase of its own.** The packaging declares an explicit list of the system interfaces the app is allowed to use. Supplying any such list turns off the build tool's automatic injection of the browser sandbox permission, and the failure is not a crash: the launcher quietly appends a flag that runs the wallet with the Chromium sandbox **off**. A wallet with its renderer sandbox disabled looks completely normal.

Install the built snap locally and check both the declaration and the running process.

```
sudo snap install --dangerous ./dist/xchain-wallet_*_amd64.snap
snap connections xchain-wallet
```

⬜ `browser-support` appears in the interface list, and the packaging grants it with sandboxing allowed.  
⬜ The launcher does **not** pass a no-sandbox flag. Start the app and check the process arguments; if that flag is present, the declaration is wrong and the build must not be published.  
⬜ `raw-usb` and the security-key interface are declared, for the hardware-signer check in Phase 5.

### Phase 4: publish to a test channel first

Never publish straight to `stable`. Auto-refresh means `stable` reaches every install on its own schedule.

```
snapcraft upload ./dist/xchain-wallet_*_amd64.snap --release=edge
snapcraft upload ./dist/xchain-wallet_*_arm64.snap --release=edge
snapcraft status xchain-wallet
```

⬜ Automated review passed for both architectures. Strict confinement passes automatically; if review stalls, the confinement or an interface is the reason.  
⬜ The `edge` channel shows both architectures at the expected revision.  
⬜ A clean machine installs from `edge` and the wallet starts, creates a wallet, unlocks it, and signs, all from the confined install.

### Phase 5: prove hardware signers work under confinement

**This decides whether the channel ships at all, and it needs real hardware.** Strict confinement is a genuine sandbox, and hardware wallets reach the app through a browser device interface. The relevant interface does not connect automatically, so a fresh install may see no device at all until it is connected.

```
snap connect xchain-wallet:raw-usb
snap connections xchain-wallet
```

⬜ With the interface connected by hand, a hardware signer is detected and can sign.  
⬜ A decision is recorded on auto-connection: requesting it from the Store is a review conversation, and leaving it manual means the listing must tell users to run the connect command.  
⬜ If hardware signers cannot be made to work under strict confinement, the channel is reconsidered rather than switched to `classic`. Classic confinement forfeits automatic review and the isolation story that is the reason to be in this store.

### Phase 6: promote to stable

```
snapcraft release xchain-wallet <revision> stable
snapcraft status xchain-wallet
```

⬜ Both architectures are promoted, at the same version.  
⬜ The listing text, icon and screenshots are in place **before** promotion, not after. The Store shows the listing to users the moment the channel is live.  
⬜ The download page links the Snap install alongside the AppImage and the `.deb`.

### What this runbook does not cover

- The wallet does not update itself on this channel. `snapd` owns updates here, and the in-app updater is switched off for Snap installs on purpose. Nothing in this ceremony arms an update feed.
- Reproducibility. The AppImage and `.deb` are byte-for-byte reproducible; the Snap's squashfs is assembled by `snapcraft` rather than by the wallet's own packaging step, so the reproducibility claim made for the other Linux artifacts is not yet claimed for this one. See [Reproducible builds](../../reproducible-builds.md) for what is claimed and where.
- Building `arm64` on an `amd64` machine. Whether this works directly or needs a remote build service is unproven and should be settled on the first credential-armed run rather than assumed.

## Listing collateral

### Store name

`xchain-wallet`

### Title

XChain Wallet

### Summary (79-character limit)

Self-custody wallet for XChain, Bitcoin, Litecoin and Dogecoin

### Description

XChain Wallet is a self-custody wallet for the XChain platform and the coins it
runs on: Bitcoin, Litecoin and Dogecoin.

Your keys stay on your machine. The wallet encrypts them with a passphrase you
choose, and nothing leaves the device unless you sign and send it.

What you can do with it:

- Hold, send and receive coins and tokens across every supported chain
- Trade on the decentralized exchange, and use dispensers
- Issue and manage your own tokens
- Stake, and take part in governance
- Sign with a hardware wallet, or with a watch-only address
- Back up and restore an encrypted copy of your wallet

This build is installed and updated by the Snap Store. A Snap install keeps its
own wallet storage, separate from a wallet installed from our download page. To
move a wallet between the two, use the wallet's encrypted backup export and
import.

The wallet is free and open source, licensed under the AGPL.

### Categorization

Category: Finance  
Licence: `AGPL-3.0-or-later`  
Contact: the public support address on the project website  
Website: the project website  
Source: the public wallet repository

### Confinement and interfaces

Confinement: `strict`  
Grade: `stable`  
Base: `core24`

Interfaces the listing must explain, because a user may have to connect one by hand:

| Interface | Why it is needed |
|---|---|
| `browser-support` | The rendering engine the wallet's interface runs on, with its own sandbox left switched on |
| `raw-usb` | Talking to a hardware wallet over USB |
| `u2f-devices` | Security-key class hardware signers |
| `network`, `network-bind` | Reaching the network to read balances and broadcast transactions |

### Graphics

⬜ The icon is generated from the brand master at the sizes the Store asks for, and is **not** a placeholder. Unlike the Windows and macOS store lanes, nothing substitutes artwork silently here, so a missing icon is visible rather than shipped, but it still has to be made.  
⬜ Screenshots show the real wallet, using the same demonstration data as the other store listings, so the listings stay consistent with each other.

## Related pages

- [Linux](linux.md): the AppImage and `.deb` this channel sits alongside
- [Verify a release](../verify-release.md): the verification recipe for the direct downloads
- [Reproducible builds](../../reproducible-builds.md): what is and is not reproducible
