<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/mobile/docs/PLAY_SUBMISSION_RUNBOOK.md @ 34639117 (worktree dirty) -->
<!-- ported 2026-08-02 from xchain-wallet/packages/mobile/docs/PLAY_LISTING.md @ 34639117 (worktree dirty) -->

# Google Play submission (Android)

This page covers submitting the XChain Wallet Android app to Google Play: the operational sequence, and the listing collateral that goes into the store's console forms.

## Submission runbook

### Ground rules

1. Nothing launch-critical depends on the Play review clock alone. A direct-download channel outside the store exists as a fallback and is never gated on Play's review.
2. The uploaded app bundle is built and signed in a dedicated, offline release-signing step, never by CI. CI builds an unsigned artifact only, as a health check, and nothing CI produces is ever published.
3. Every console field has an answer drawn from this documentation and the listing collateral below. A field with no documented answer is a gap to fill in deliberately, not to improvise at the console.
4. The application ID and the first upload's version code are permanent. Play refuses a duplicate version code even on the internal testing track, so a replaced upload is always a new version, never a hand-edited number.

### Before opening a store form

Confirm, in order:

- The developer account exists, is organization-owned, and is identity-verified.
- Hardware-key two-factor authentication is enrolled on the console account, with no SMS or authenticator fallback.
- The release-signing keys exist, and a sealed offline backup of the upload key exists.
- The privacy policy is live at a fetchable public URL and serves the current text. Re-check this immediately before every submission: see [the wallet's privacy policy](../../privacy/privacy-policy.md).
- Country availability is decided (see Country availability below).
- Data safety answers are settled; see [the wallet's data-safety answers](../../privacy/data-safety.md).
- Any build-time supply-chain verification metadata is committed and current.
- The demo path a reviewer's scripted walkthrough depends on is reachable from a plain, non-browser client, on an outside network rather than an allowlisted internal one.

### Phase 1: build and sign

Build and sign on a dedicated release machine, at a keyboard, with a clean tree checked out at the release tag. Signing passwords are never passed on a command line or read from an environment variable; the signing tools prompt for them, or read them from a locally-restricted file by path. That is what makes it a ceremony rather than a script.

The signing step produces, alongside a provenance record:

| Artifact | Signed by | Distribution |
|---|---|---|
| Android App Bundle (`.aab`) | the upload key | Play only, never hosted publicly |
| Universal APK (`.apk`) | the direct-distribution key | the direct-download channel |

The APK is derived from the same bundle as the AAB, never a second build, so both artifacts are provably the same code.

Before uploading, dump the bundle's manifest and confirm the package name, the version code, the backup and cleartext-traffic flags, and the permission count all match what is expected.

### Phase 2: the console forms

**Create the app record.** Set the app name, default language, app type, and free-or-paid status. Free-or-paid is permanent: a free app can never be switched to paid. If the console asks for the package name at this step, confirm it against the built bundle rather than typing it from memory. If it differs from the bundle, Play rejects the upload; if it differs from the domain-verification file, deep linking fails silently instead, which is the worse of the two failures.

**Fill the listing and policy forms.** Use the listing collateral below for the store name, descriptions, categorization, contact details, the trader declaration, the financial-features declaration, review notes, and demo credentials. Use [the wallet's data-safety answers](../../privacy/data-safety.md) for the data safety form, and the privacy policy URL and country-availability decision from the steps above.

### Phase 3: internal testing track

Upload the bundle to internal testing first. It is the cheapest place to discover a problem with the bundle itself.

Immediately after the first upload, record Google's own app-signing certificate fingerprint. Play App Signing is mandatory for new apps, so Google generates its own signing key on first upload and re-signs everything it distributes. That fingerprint, alongside the direct-distribution key's fingerprint, is what a deep-linking verification file needs (see Phase 6).

Install from the internal track on a real physical device and confirm the flows work end to end. An emulator cannot reliably validate biometric unlock, camera-based QR scanning, or that remote debugging is genuinely disabled, so a physical device is a release gate for those specifically.

### Phase 4: closed testing (beta)

Promote the same bundle to a closed testing track for a beta cohort before production.

### Phase 5: production, staged

Promote to production at a staged rollout percentage rather than 100% immediately. Know how to halt a staged rollout before starting one; it is the only Play-side incident control available once a release is live.

### Phase 6: close the deep-linking loop

1. Add Google's app-signing certificate fingerprint (from Phase 3) alongside the direct-distribution key's fingerprint in the domain's asset-links file, both under the one application ID.
2. Publish the asset-links file at the domain's `.well-known/assetlinks.json` path, served without authentication: Android's verifier fetches it directly with its own client, not through a user's browser.
3. Verify on a signed install that the operating system reports the links as verified. The failure mode is silent: an unverified link simply opens in the browser with nothing explaining why.

### Phase 7: the direct-download channel

Publish the signed APK, alongside its certificate fingerprint and a version-check feed, on the project's own download page once the staged Play rollout reaches 100%, or on an explicit release decision. This ordering exists so the direct channel never carries a release the Play rollout could still halt. Whenever Play stalls, rejects, or suspends a release, promoting the direct channel is the normal fallback path.

There is no halt, rollback, or downgrade on the direct channel: Android refuses a version-code regression without an uninstall, and an uninstall wipes the wallet's local vault. The remedy for a bad direct release is a signed advisory, a fixed higher-version-code build, and an update to the version-check feed.

### What this runbook does not cover

- Getting the developer account itself.
- The Play Console's exact menu paths and field labels, since Google changes them without notice; treat this document as the sequencing and content, not a click-by-click transcript.
- The iOS lane; see [App Store submission](ios-app-store.md).

## Listing collateral

### Store name

XChain Wallet

### Short description (80-character limit)

> Self-custody wallet for Bitcoin, Litecoin and Dogecoin. Keys stay on your phone.

### Full description

> XChain Wallet is a self-custody wallet. Your recovery phrase and your keys are generated on your device, encrypted with your password, and never leave it. We cannot see your balance, we cannot move your coins, and we cannot help you recover a lost recovery phrase. That is what self-custody means, and it is worth understanding before you start.
>
> What you can do with it:
>
> - Hold and send Bitcoin, Litecoin and Dogecoin.
> - Hold and send tokens issued on the XChain protocol, and see their history.
> - Scan a QR code to receive, to send, or to sign a transaction from a wallet kept offline.
> - Unlock with your fingerprint instead of typing your password every time.
>
> How your wallet is stored on this phone:
>
> - The wallet file is encrypted with a key held in your device's hardware keystore. It never goes into cloud backup, and it does not transfer to a new phone (a copy would be unreadable there anyway, because the key cannot leave this device).
> - Moving to a new phone means importing your recovery phrase. Write it down when the app shows it to you. There is no other copy.
>
> What this app does not do:
>
> - It does not hold your coins for you, and there is no account to sign into.
> - It does not collect analytics, and there is no advertising.
> - It is not an exchange, and it does not mine anything.
>
> Open source, AGPL-3.0-or-later. Built by Dankest, LLC.

### Categorization and contact

| Field | Value |
|---|---|
| Category | Finance |
| Form factors | Phone only. Tablet, Wear, TV, Auto, and ChromeOS are not claimed: a tablet-optimized layout is an explicit non-goal, and claiming the tablet form factor would obligate tablet-sized screenshots the listing does not carry. The app still runs on a tablet; claiming the form factor is a separate promise from tolerating the screen. |
| Contact email | The organization's published support address, kept identical across every store listing. |
| Website | The project's main website. |
| Privacy policy | See [the wallet's privacy policy](../../privacy/privacy-policy.md). |

### Trader declaration (EU DSA)

The trader declaration publishes the legal entity's name, business postal address, contact email, and phone number, permanently and publicly, on the listing. Use the same contact details published on the Chrome and App Store listings; one legal entity showing different public contacts on different listings is exactly what a reviewer or a regulator notices.

### Country availability

Available worldwide, minus jurisdictions excluded for regulatory reasons:

- The United Kingdom is excluded: its financial-promotions regime is the reason crypto apps have been delisted there.
- Countries under comprehensive sanctions (Cuba, Iran, North Korea, Syria, the Crimea, Donetsk and Luhansk regions, Russia, and Belarus) are excluded explicitly.
- Mainland China is excluded; Play is not available there.
- A further set of jurisdictions with a history of shifting crypto regulation (Bangladesh, Nepal, Algeria, Egypt, Qatar, Bolivia, and Morocco) are excluded at launch as a conservative starting position, not a permanent one. Country availability is editable at any time, so opening a market later costs a few clicks rather than a resubmission.

This exclusion list binds the Play listing only. The direct-download channel is not geo-restricted, by design: it exists precisely so the wallet remains reachable where a store's own distribution rules do not apply.

### Financial features declaration

The console does not ask this as a set of yes/no questions. It presents a
checklist of financial features, grouped, and you tick the ones the app has.
Answering it as though it were four questions would tick nothing at all, and
declare a cryptocurrency wallet as having no financial features.

What is ticked, and nothing else:

| Group | Box | Ticked |
|---|---|---|
| Trading and funds | Cryptocurrency wallet | Yes. This is what the app is. |
| Trading and funds | Cryptocurrency exchange | No. No order book, no matching, no fiat on-ramp. |
| Trading and funds | NFT trading | No. Compiled out of the store build. |
| Trading and funds | Prediction markets | No. Compiled out of the store build. |

The three No answers are true of the uploaded artifact rather than true by
policy: the store build compiles the exchange and trading surfaces out
entirely, so the shipped app has no code behind them. The direct-download
build is the same artifact in this respect, and the download page says so.

Ticking "Cryptocurrency wallet" did not trigger a request for regulatory
documentation. Expect that to be re-assessed at each submission rather than
assumed, since the policy text behind this form changes.

### Reviewer instructions and app access

Play has no free-text "review notes" field. Do not write one expecting a place
to paste it. The only field of that kind is under **App access**, in the
**Sign in details** section: *"Any other information required to access your
app"*, and it is capped at **500 characters**. The form explicitly invites
things like instructions for bypassing a biometric login, which is the sort of
content it expects.

There are no credentials to give. The wallet has no accounts and no server, so
the username and password fields are left empty, and no demo recovery phrase is
needed to review it: a reviewer creates a wallet in the app in a few seconds.
Biometric unlock is off until a user turns it on after a password unlock, so on
a fresh install there is no biometric gate to bypass either.

The instructions field holds a walkthrough of this shape. Any edit has to stay
under the character cap, so count it before saving:

> XChain Wallet is a non-custodial cryptocurrency wallet. There are no accounts,
> so nothing needs signing in to and no credentials are required. Open the app
> and choose "Create a wallet"; any password works. The app shows a recovery
> phrase and asks you to confirm it, which is the standard self-custody backup
> step. The wallet then opens on the balances screen. "Receive" shows an address
> and a QR code. "Send" builds a transaction and asks for confirmation before
> broadcasting anything.

If a future review does need funded balances, use a wallet on a public test
network and never a funded mainnet wallet, and rotate it after the review
cycle. Nothing in the current submission needs one.

### Graphics

- App icon, 512x512, matching the shipped launcher icon's own composition.
- Feature graphic, 1024x500.
- At least two phone screenshots (this listing ships four: balances, receive, send confirmation, and biometric unlock).
- Tablet screenshots are not provided, since tablet support is not claimed.
- No screenshot shows a real mainnet address or real funds; every screenshot comes from a build on a test network with the exchange and trading surface compiled out entirely.

### Data safety form

See [the wallet's data-safety answers](../../privacy/data-safety.md).
