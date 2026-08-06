<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/mobile/docs/APP_STORE_SUBMISSION_RUNBOOK.md @ 34639117 (worktree dirty) -->
<!-- ported 2026-08-02 from xchain-wallet/packages/mobile/docs/APP_STORE_LISTING.md @ 34639117 (worktree dirty) -->

# App Store submission (iOS)

This page covers submitting the XChain Wallet iOS app to the Apple App Store: the operational sequence, and the listing collateral that goes into App Store Connect's forms.

## Submission runbook

### Ground rules

1. The release pipeline exports a signed app package and stops there; a human uploads it and a human presses submit. Automated upload from CI is deliberately not supported: a tag-triggered pipeline that both holds signing credentials and uploads would be a single point of compromise with too much reach.
2. Every console field has an answer drawn from this documentation and the listing collateral below. A field with no documented answer is a gap to fill in deliberately, not to improvise at the console.
3. The bundle identifier and the first upload's build number are permanent. App Store Connect refuses a spent build number, so a burned upload is always a new build number on the same release, never a hand-edited one.
4. The App Store has no rollback. A bad build can only be paused and superseded through another review cycle, so anything shipped must be forward-compatible or reversible from within the app itself.
5. No review-only configuration and no review-detection logic, ever. An app that behaves differently for a reviewer than for a real user is a policy-termination pattern, and termination affects every other distribution surface the same organization uses, not just this one app.

### Before opening a console form

Tick these in order. Every one of them is cheaper to discover here than at a form that will not let you go back.

⬜ Apple Developer Program organization enrollment is complete and the entity is verified.  
⬜ An Account Holder is named, with hardware-key two-factor authentication on that Apple ID.  
⬜ Release-signing credentials exist and are installed for the release pipeline: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` and `APPLE_TEAM_ID`. Signing is cloud-managed, so those four are the whole set; no certificate or provisioning profile is installed by hand.  
⬜ The privacy policy URL resolves and serves the current text. Run the check rather than loading the page and glancing at it:  

```bash
node tools/release/verify-privacy-url.mjs
```

Exit 0 means live, direct, and carrying the current policy word for word. It is the deployed text that matters, not just that the URL responds: [the wallet's privacy policy](../../privacy/privacy-policy.md) is the source it compares against, and re-running this immediately before every submission is the point, because a URL that was right last month is not evidence about today.

⬜ Privacy answers are settled and consistent with the Android listing's data safety answers; see [the wallet's privacy nutrition labels](../../privacy/privacy-nutrition-labels.md).  
⬜ Territories (storefront availability) are decided (see Territories below).  
⬜ The demo path a reviewer's scripted walkthrough depends on is reachable from a plain client on an outside network, not just an allowlisted internal one.  
⬜ The support URL is live and reachable: `https://xchain.io/wallet/support/`.  
⬜ The release is built from a committed tree, not a local working copy: a submission built from an uncommitted tree has no durable record of what was actually submitted.  
⬜ The TestFlight posture is settled: an internal group for the first release, no external group yet (see Phase 5). What is NOT optional is that the app has been run on a real device, because the release pipeline's own build cannot demonstrate that.  

The store build compiles out in-development surfaces that are not ready for review (for example, an in-app exchange) entirely, rather than feature-flagging them off, so a reviewer sees a build with no code path to the excluded surface, not a flag that could be flipped back on remotely.

### Phase 1: the developer portal

As the Account Holder:

⬜ Register the App ID and enable the Associated Domains capability on it, needed for Universal Links. An App ID missing this capability makes the corresponding entitlement unsignable, and the build fails with a provisioning error that does not name the real cause.  
⬜ Create the Apple Distribution certificate and an App Store provisioning profile for that App ID.  
⬜ Create an App Store Connect API key scoped to the minimum role that cloud signing accepts, never a broader admin role, since the key is capable of minting new certificates.  
⬜ Route Apple's certificate-issuance notification emails to a monitored inbox: an unexpected certificate-issuance notice is the signal that the API key has leaked.  
⬜ Record the Team ID; it is needed later for the domain-association file.  

### Phase 2: release-signing secrets

Install the API key and its identifiers into the release pipeline's secret store. These same values are typically reused by a desktop-notarization lane where one exists, so changing them can affect more than one release lane.

⬜ `APPLE_API_KEY` (the `.p8` contents), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` and `APPLE_TEAM_ID` are set as repository secrets. `tools/release/ios-archive.sh` refuses to run without all four unless it is explicitly in unsigned mode, and the release workflow skips both signing steps when the key id is empty, so a missing secret shows up as a green run that produced nothing rather than as a failure.  
⬜ The key is stored nowhere else. It can mint certificates, which is why its blast radius is worth one deliberate sentence rather than a habit.  

### Phase 3: the first archive

On a tagged release, the release pipeline builds the store-profile app bundle, runs a pre-flight check confirming the shipped SDK is not a development mock, stages the bundle, and archives and exports a signed app package for App Store Connect. The two scripts it runs are the ones you can also run by hand:

```bash
XCHAIN_IOS_ARCHIVE_UNSIGNED=1 bash tools/release/ios-archive.sh   # proves the lane, no Apple account
bash tools/release/ios-archive.sh                                 # signed, needs the four secrets
XCHAIN_RELEASE_TAG=vX.Y.Z bash tools/release/ios-export.sh        # produces the .ipa, uploads nothing
```

The pipeline archives **twice**, and knowing which one you are looking at matters here more than anywhere else in this document. The first archive is unsigned and runs on every tagged release, whether or not the Apple credentials are installed; it proves the build path works. The signed archive runs only when the credentials are present, and it is the only one that can produce something uploadable. **A green archive step therefore does not mean signing happened.** Confirm in this order, since each of the following masks the next:

⬜ The signed archive ran at all, rather than being skipped for missing credentials. On a first release this is the step most likely to have been silently passed over.  
⬜ The build-number fields are populated from the tag, not left empty; an empty build number uploads as one that can never be reused.  
⬜ Provisioning succeeds; a failure here is usually the missing Associated Domains capability from Phase 1, not a certificate problem.  
⬜ The exported package is named as expected. `tools/release/ios-export.sh` names it deliberately, because the artifact list matches on that name and an unexpected one hard-fails a later step.  
⬜ The artifact-upload step actually ran; check the pipeline's own output on a first release rather than assuming a green run means the artifact exists.  

### Phase 4: the app record and the upload

⬜ Create the app record in App Store Connect against the Phase 1 App ID. This is the step that pins the bundle identifier `io.xchain.wallet.ios` publicly, and it cannot be changed afterwards.  
⬜ **Opt OUT of "Designed for iPhone/iPad" Mac availability.** It is on by default, and the operator decided against it on 2026-08-03, so this is a step to perform rather than a question to weigh. Running a mobile web-shell wallet on macOS beside a separate desktop wallet build means two vaults and two update paths, on a surface no smoke or e2e run covers. Availability is editable in App Store Connect at any time, so revisiting it post-launch as a deliberate product decision costs nothing.  
⬜ Upload the signed package by hand, through Apple's own upload tools, never from CI.  
⬜ Answer the export-compliance questionnaire. If the app is not exempt from encryption export rules, this carries recurring annual reporting obligations; if it is exempt, which is the common case for a wallet using only standard cryptographic algorithms, record that exemption's basis before submitting.  
⬜ Wait for the upload to finish processing. A build that fails processing is burned and needs a fresh build number; App Store Connect accepts each build number exactly once.  

### Phase 5: TestFlight

**Run an internal group for the first release. Do not open an external group yet**; that was decided deliberately on 2026-08-03 and is revisited once the first submission's outcome is known.

Internal testers get a build immediately with no review, and that is what makes this phase mandatory rather than optional: the release pipeline builds the app unsigned, and an unsigned build has no keychain access group, so every secure-storage call in anything the pipeline produces fails with a missing-entitlement error. A green pipeline proves the app COMPILES. It cannot prove the app RUNS. This phase is the only place that question gets answered, so rehearse the full review demo here, on real devices, because the reviewer will use a device too.

An external group adds testers outside the team and builds review history ahead of the first submission. It also starts two recurring clocks, which is why it is not on by default: external testers draw a Beta App Review on the first build of each version, usually within hours but occasionally longer, and every uploaded build hard-expires 90 days after upload, so a standing beta channel needs a re-upload cadence or a deliberate decision to let it lapse. No other distribution channel has that expiry.

⬜ The build is installed on a real device from the internal group, and the wallet unlocks. A vault call failing with a keychain error here means the build reaching you is unsigned, not that the app is broken.  
⬜ The full review demo below has been rehearsed end to end on that device, including the airplane-mode signing step.  
⬜ Native logging was read at least once rather than guessed at, so a startup problem in review is diagnosable:  

```bash
bash packages/mobile/scripts/ios-console.sh
```

That script exists because the obvious `simctl launch --console` prints nothing at all: the app's stdout is block-buffered into a pipe that a wallet at rest never fills. Silence from it is not evidence of anything.

### Phase 6: the console forms

Every answer is written down. Copy, do not compose. Use the listing collateral below for the app name, subtitle, keywords, promotional text, description, category and contact details, the age-rating questionnaire, review notes, demo account details, screenshots, and the app icon. Use [the wallet's privacy nutrition labels](../../privacy/privacy-nutrition-labels.md) for the privacy section, and confirm territories against the decision below.

⬜ App name, subtitle and keywords entered exactly as written under Listing collateral, character counts unchanged.  
⬜ Promotional text and description pasted from below, not retyped.  
⬜ Category, support URL, marketing URL and privacy policy URL taken from Categorization and contact below.  
⬜ **Trader declaration submitted, transcribed from the block below: entity, address, email and phone.** This one is not editable in the sense that matters, so it is the field to slow down on: see Trader declaration (EU DSA) below.  
⬜ Age-rating questionnaire answered as tabulated below; the expected outcome is 4+.  
⬜ Review notes and demo wallet filled in, with a seed generated fresh for this submission.  
⬜ Screenshot sets uploaded for iPhone and iPad.  

The iPad screenshot set is mandatory for a universal app; a missing iPad set blocks submission outright rather than degrading the listing. The app icon is the one listing asset compiled into the binary itself: unlike every other field here, fixing it after upload needs a new build, not a console edit, so confirm it is correct before archiving.

### Phase 7: submit

⬜ Choose **manual release**, never automatic release on approval. Automatic release lands at Apple's own schedule and could ship a client ahead of the server-side changes it depends on.  
⬜ Turn phased release on for version updates. It only throttles automatic updates; manual updates and new installs get the new build immediately, so treat it as partial cover, not a full staged rollout.  
⬜ Press submit, and record the build number submitted. If rejected, a metadata or review-notes fix can sometimes resubmit the same build; any code change made to pass review needs a new build number, and should ship consistently across every distribution shell rather than only on iOS.  

### Phase 8: close the Universal Links loop

⬜ Publish the domain-association file naming the Team ID and bundle identifier.  
⬜ Serve it at the domain's `.well-known/apple-app-site-association` path, with no redirect, to an unauthenticated client: iOS fetches it directly through Apple's infrastructure, not through a user's browser. Check it the way Apple's fetcher will, unauthenticated and following nothing:  

```bash
curl -sS -D- -o /dev/null https://xchain.io/.well-known/apple-app-site-association
```

A `200` with a JSON content type is what you want. A `301` or a `403` here is the whole failure, and it is invisible from inside a browser session that is already authenticated or already redirected.

⬜ Claim only a narrow, versioned URL prefix for the app, so the rest of the domain (marketing pages, documentation) keeps opening in the browser as expected.  
⬜ Verify on a real signed install. The failure mode is silent: an unclaimed or misconfigured link just opens in the browser with nothing explaining why.  

### What this runbook does not cover

- Getting the developer account itself.
- Mac App Store distribution of a separate desktop build, which shares only the developer enrollment with this lane.
- App Store Connect's exact menu paths, since Apple changes them without notice.
- The Android lane; see [Google Play submission](android-play.md).

## Listing collateral

### App name, subtitle, keywords

    Name:     XChain Wallet
    Subtitle: Self-custody crypto wallet

The subtitle is settled, not a shortlist: enter it exactly as above. It is 26 characters against a 30-character limit.

Two things worth knowing before anyone improvises a replacement at the console. The limit is enforced at entry, so a longer line cannot be saved and there is no reason to arrive without one that fits. And the store indexes the app name, the subtitle and the keyword list as a single pool, so any word repeated between them is wasted search space rather than reinforcement: the keyword line already sits at 90 of its 100 characters, and a subtitle built around "keys" or "wallet" would burn a slot that is already spent. A considered alternative, "Your keys, on your phone", was set aside for exactly that reason.

**Keywords** (100-character limit, comma separated, no repeats of a word already in the name or subtitle):

    bitcoin,litecoin,dogecoin,seed,keys,token,send,receive,qr,offline,noncustodial,open,source

### Promotional text (170-character limit, changeable without a new build)

> Your recovery phrase never leaves your phone. Sign transactions offline, scan a QR to receive, and hold tokens issued on the XChain protocol.

### Description

> XChain Wallet is a self-custody wallet. Your recovery phrase and your keys are generated on your device, encrypted with your password, and never leave it. We cannot see your balance, we cannot move your coins, and we cannot help you recover a lost recovery phrase. That is what self-custody means, and it is worth understanding before you start.
>
> What you can do with it:
>
> - Hold and send Bitcoin, Litecoin and Dogecoin.
> - Hold and send tokens issued on the XChain protocol, and see their history.
> - Scan a QR code to receive, to send, or to sign a transaction from a wallet kept offline.
> - Unlock with Face ID or Touch ID instead of typing your password every time.
>
> How your wallet is stored on this iPhone:
>
> - The wallet file is encrypted with a key held in the device Keychain, marked so it never reaches iCloud and never leaves this device. The file itself is excluded from iCloud and Finder backups.
> - Moving to a new phone means importing your recovery phrase. Write it down when the app shows it to you. There is no other copy, and a device backup will not carry it.
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
| Primary category | Finance |
| Secondary category | Utilities |
| Support URL | `https://xchain.io/wallet/support/`. A page rather than a bare address on purpose: it carries the seed-phrase scam warnings and the bug-report route, and an email address on a wallet's public listing is scraped by phishers within days. |
| Marketing URL | `https://xchain.io` |
| Privacy policy URL | The URL [the wallet's privacy policy](../../privacy/privacy-policy.md) publishes, with its trailing slash, taken from there rather than retyped here so there is only ever one copy of it. It was checked before the console was opened, and the un-slashed form 301s, which is not what you want a store validator following. |
| Trader status (EU DSA) | Trader. The values go in exactly as written under Trader declaration below, and they are the same ones the Chrome and Google Play listings publish. |

### Trader declaration (EU DSA)

The trader declaration publishes the legal entity's name, business postal address, contact email, and phone number, permanently and publicly, on the listing. It is not reversible in the sense that matters: editing a field later does not unpublish what was already indexed. Type these exactly, transcribed from here rather than from memory. They are the same values every other store listing publishes; [Trader identity](../../privacy/trader-identity.md) is the declaration of record they come from.

```
Dankest, LLC
30 N Gould St Ste N
Sheridan, WY 82801
United States
info@dankest.llc
+1 949-510-5364
```

| Field | Value |
|---|---|
| Entity | `Dankest, LLC` |
| Postal address | `30 N Gould St Ste N, Sheridan, WY 82801, United States` (a registered agent's, so it exists to be public) |
| Email | `info@dankest.llc` (identical to what the Chrome and Google Play listings publish, and proven to receive) |
| Phone | `+1 949-510-5364` |

**Do not silently substitute a different phone number at the console.** If the published number is ever swapped for a forwarding line (a VOIP number that rings the same handset satisfies the EU Digital Services Act identically, since the rule is a working means of contact, not a carrier line), that change lands on all three store listings in the same pass. One legal entity showing different public contacts on different listings is exactly what a reviewer or a regulator notices.

### Territories

Mirrors the same worldwide-minus-exclusions policy described in the Android listing (see [Google Play submission](android-play.md)), mapped onto Apple's storefronts. Because Apple's guideline on cryptocurrency apps is judged per storefront the app is available in, this is a legal position rather than a reach setting. Storefront availability is editable at any time, unlike the bundle identifier and the first build number.

One difference from Android: there is no direct-download channel on iOS and no alternate marketplace, so the excluded storefronts are the whole story on this platform, not a fallback-covered gap the way Android's direct APK covers its own exclusion list.

**Some of the excluded places cannot be excluded here, because the App Store does not offer them.** Measured while entering the list: Cuba, Iran, North Korea and Syria have no App Store storefront at all, so the comprehensive-sanctions exclusion is already Apple's and there is nothing to switch off. **Bangladesh is the one worth writing down**, because it is easy to mistake for an oversight: it is not an App Store storefront either, while its neighbours (Pakistan, Sri Lanka, India, Maldives, Nepal) all are. So the Android list excludes one market the App Store never offered.

The practical effect is that "mirror the Android list" resolves to **165 of the 175 available storefronts**, not to an identical set of names. If a future check compares the two lists literally, expect that difference and confirm it against this paragraph before treating it as drift. Do not go hunting for a Bangladesh checkbox; there isn't one.

### Age rating questionnaire

| Question | Answer |
|---|---|
| Unrestricted web access | No. The app embeds no general-purpose browser; external links open in the system browser. |
| Gambling, contests | No |
| Simulated gambling | No |
| Horror, violence, mature themes | No |
| Medical, drug references | No |
| Frequent or intense profanity | No |

Expected rating: 4+.

### Screenshots

Generated from the simulator at the store build profile, never a build carrying compiled-out surfaces, covering the same four scenes on both iPhone and iPad: balances, receive with a QR code, send confirmation, and the biometric-unlock setting. iPad is mandatory since the app ships as a universal app. No screenshot shows a mainnet address holding real funds; every screenshot uses test-network demo data.

### Review notes

> XChain Wallet is a non-custodial cryptocurrency wallet from Dankest, LLC, an enrolled organization. Keys are generated on the device, encrypted with a user-chosen password, and stored in the iOS Keychain, marked so they never leave the device and never sync to iCloud. There is no account system, no server-side custody, no exchange, no mining, and nothing is sold in the app.
>
> This build is a wallet, not a wrapped website. Native integrations you can verify on device:
>
> - Keychain-backed vault with Face ID / Touch ID access control. Turning Face ID on in Settings, then backgrounding and reopening the app, raises the system biometric prompt before the wallet is readable.
> - Native camera QR scanning (Receive and Send both scan).
> - Offline transaction signing. See the airplane-mode demo below; it is the quickest way to confirm the private keys are on the device.
> - Universal Links into the wallet from the project's website.
> - App-switcher privacy: the window is covered when the app resigns active, so the recovery phrase cannot land in the snapshot cache.
>
> Demo steps (about three minutes):
>
> 1. Open the app and choose "Import wallet". Enter the recovery phrase below and any password. The wallet opens on the balances screen.
> 2. The wallet is already set to a public test network, so no real funds are involved. Balances are read from a public blockchain indexer; no account is involved.
> 3. Tap Receive. The app shows an address and a QR code. Tap the camera icon to scan one; this uses the device camera directly.
> 4. Turn on Airplane Mode. Tap Send, enter the address shown below and any small amount, and confirm. The app builds and signs the transaction on the device and shows you the signed result. It cannot broadcast it, and says so. Turn Airplane Mode off and the same signed transaction broadcasts. Nothing about the signing step needed a server.
> 5. Settings shows the network selector used in step 2, and the privacy toggles that turn off the only third-party requests the app makes.
>
> The app is open source under AGPL-3.0-or-later.

This text is written to keep two things true, and they must stay true on any future edit: it never mentions a private test environment or asks a reviewer to reach anything not publicly reachable, and there is no review-only configuration or review-detection logic anywhere in the build.

### Demo account

There is no sign-in, so the account fields stay empty and the demo wallet goes in the review notes instead: a funded test-network recovery phrase, password, and a send-to address, filled in fresh at submission time. Treat the seed as burned the moment it enters review notes: never reuse it across stores or releases, since a shared seed is a resource two concurrent reviewers could race into a false "does not work" rejection.

### Release control

- Always use manual release, never automatic release on approval.
- Phased release is on for updates, understood as partial cover: it throttles automatic updates only, not manual updates or new installs.
- The App Store has no rollback; a bad release can only be paused and superseded by another review cycle.

## TestFlight

- **Current posture: internal group only.** An external group is deferred until the first submission's outcome is known, and opening one later costs nothing.
- Internal testers get builds immediately, with no review.
- External testers need Beta App Review on the first build of each version: usually hours, occasionally a real review, a recurring clock rather than a one-time gate.
- Builds hard-expire 90 days after upload. No other channel has this clock, and it is the main reason a standing external channel is not free.
- This is the pre-submission venue for rehearsing the review demo above; rehearse on a device, not in the simulator, since the reviewer is on a device. It is also the only venue that can show the app running at all, for the unsigned-build reason given in Phase 5.
