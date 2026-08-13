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
⬜ The demo path a reviewer's scripted walkthrough depends on is reachable from an outside network, and **readable by the app itself**. Run the check rather than curling the hosts:

```bash
node tools/release/verify-demo-endpoints.mjs
```

Exit 0 means every service the demo touches is healthy AND answers the browser origin the store build sends. Those are two different questions and only the first is visible from a terminal: the shipped app is a web view with no way around cross-origin rules, so a service can answer `curl` perfectly and still be unreachable to the wallet. On 2026-08-07 this check reported everything green while the transaction-composing service permitted no browser origin at all, which means a reviewer could open the wallet, see the funded balance, and get a failure the moment they tried to send. Anything reported as `UNREACHABLE FROM THE APP` is that condition, and it is not a warning. Pass `--origin` to check another shell: the iOS and Android builds do not send the same origin.

⬜ The support URL is live and reachable: `https://xchain.io/wallet/support/`.  
⬜ The release is built from a committed tree, not a local working copy: a submission built from an uncommitted tree has no durable record of what was actually submitted.  
⬜ The TestFlight posture is settled: an internal group for the first release, no external group yet (see Phase 5). What is NOT optional is that the app has been run on a real device, because the release pipeline's own build cannot demonstrate that.  

The store build compiles out in-development surfaces that are not ready for review (for example, an in-app exchange) entirely, rather than feature-flagging them off, so a reviewer sees a build with no code path to the excluded surface, not a flag that could be flipped back on remotely.

### Phase 1: the developer portal

As the Account Holder:

⬜ Register the App ID and enable the Associated Domains capability on it, needed for Universal Links. An App ID missing this capability makes the corresponding entitlement unsignable, and the build fails with a provisioning error that does not name the real cause.  
⬜ Register at least one real device before expecting any archive to succeed. This reads like a testing detail and is a hard build requirement: with cloud-managed signing the archive step is signed with a *development* identity and only re-signed for distribution at export, and a development profile cannot be generated for a team with no registered devices. The archive fails with "your team has no devices from which to generate a provisioning profile", which does not sound like a build error. One device of the right platform is enough, and a tablet counts for a universal app.  
⬜ Create the Apple Distribution certificate and an App Store provisioning profile for that App ID.  
⬜ Create an App Store Connect API key for the release pipeline. **Choose the role by what the pipeline must actually do, and read the paragraph below before choosing the narrowest one.**  
⬜ Route Apple's certificate-issuance notification emails to a monitored inbox: an unexpected certificate-issuance notice is the signal that the API key has leaked.  
⬜ Record the Team ID; it is needed later for the domain-association file.  

**The two bullets above pull in opposite directions, and which one you follow
decides whether the release pipeline works.** Measured on this project's first
signed run:

- An API key at the **App Manager** role authenticates correctly, is accepted
  for provisioning, and can create *development* certificates. The archive step
  therefore succeeds and nothing warns you.
- The same key **cannot create the distribution certificate**, because Apple
  restricts that to the Admin and Account Holder roles. The failure surfaces
  only at the export step, after a full archive has been built, as a cloud
  signing permission error together with "no signing certificate found" and "no
  profiles were found".

So "the minimum role that cloud signing accepts" is not App Manager if the
pipeline is expected to mint its own certificate. Pick one of two postures
deliberately:

1. **Cloud signing owns the certificate.** The key needs Admin. That is a
   broader key than a release pipeline would otherwise hold, and its blast
   radius is the reason to route certificate-issuance mail to a monitored
   inbox.
2. **A person owns the certificate.** Create the Apple Distribution certificate
   and the App Store provisioning profile by hand once (the bullet above), keep
   the key narrow, and switch the pipeline to manual signing. The certificate's
   private key then becomes a custody item with an owner and a backup, which is
   real ongoing work rather than a one-off.

Neither is wrong. What does not work is holding the first posture with a key
provisioned for the second, which is a failure that hides until the last step of
a release.

**This project chose posture 1**, and the pipeline is built around it: the key
holds the Admin role, cloud-managed signing creates and renews the certificate,
and the certificate-issuance email alarm above is what keeps that honest. Two
practical notes for whoever repeats it. A key's role **cannot be changed after
it is created**, which the console states plainly, so raising a role means
generating a second key, reinstalling the secrets and revoking the first.
And the certificates and profiles created this way are **Xcode-managed**, so
they do not appear in the portal's ordinary certificate and profile lists -
an empty list there is not evidence that signing is broken.

**One non-Apple trap that stops the export dead.** The packaging step shells out
to `rsync` and expects the system one. If a newer `rsync` from a package manager
comes first on `PATH`, the export fails with `error: exportArchive Copy failed`,
which names neither `rsync` nor `PATH`; the real message is buried in the
distribution logs. The release script pins the system copy itself, so this bites
only someone running the export by hand.

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
⬜ **Validate the package before uploading it.** Validation runs the same checks the upload runs, against Apple's own service, but it creates no build record, adds nothing to TestFlight, and does not spend the build number. It takes about a minute, and it is the only check that answers for the party that can reject you:

```bash
xcrun altool --validate-app -t ios \
  -f packages/mobile/ios/build/xchain-wallet-ios-vX.Y.Z.ipa \
  --apiKey <key id> --apiIssuer <issuer id>
```

The key id and issuer id are the same App Store Connect API credentials the release secrets already hold; the private key file itself must be readable at `~/.appstoreconnect/private_keys/`, which is where the tool looks for it. A pass prints `VERIFY SUCCEEDED with no errors` and exits 0. Do this every time, not only on a first release. Reading the built package's own metadata is NOT a substitute for it: on 2026-08-06 an apparently missing icon key in that metadata looked exactly like a rejection class, and validation showed the package was fine.

⬜ Upload the signed package by hand, never from CI. It is the same command with `--upload-app` in place of `--validate-app`. This is the step that spends the build number, which is why the validation above comes first.  
⬜ Answer the export-compliance questionnaire. If the app is not exempt from encryption export rules, this carries recurring annual reporting obligations; if it is exempt, which is the common case for a wallet using only standard cryptographic algorithms, record that exemption's basis before submitting.  
⬜ Wait for the upload to finish processing. A build that fails processing is burned and needs a fresh build number; App Store Connect accepts each build number exactly once. This is the cost the validation step above exists to avoid paying.  

### Phase 5: TestFlight

**Run an internal group for the first release. Do not open an external group yet**; that was decided deliberately on 2026-08-03 and is revisited once the first submission's outcome is known.

Internal testers get a build immediately with no review, and that is what makes this phase mandatory rather than optional: the release pipeline builds the app unsigned, and an unsigned build has no keychain access group, so every secure-storage call in anything the pipeline produces fails with a missing-entitlement error. A green pipeline proves the app COMPILES. It cannot prove the app RUNS. This phase is the only place that question gets answered, so rehearse the full review demo here, on real devices, because the reviewer will use a device too.

An external group adds testers outside the team and builds review history ahead of the first submission. It also starts two recurring clocks, which is why it is not on by default: external testers draw a Beta App Review on the first build of each version, usually within hours but occasionally longer, and every uploaded build hard-expires 90 days after upload, so a standing beta channel needs a re-upload cadence or a deliberate decision to let it lapse. No other distribution channel has that expiry.

⬜ The build is installed on a real device from the internal group, and the wallet unlocks. A vault call failing with a keychain error here means the build reaching you is unsigned, not that the app is broken.  
⬜ The demo wallet is prepared and funded, per the demo-account steps below. The rehearsal cannot be done without it, and it is the step most likely to be left until the console is open.  
⬜ The full review demo below has been rehearsed end to end on that device, including the network switch in step 2 and the airplane-mode signing step in step 4 **in the order written** (compose first, then Airplane Mode, then confirm). Rehearsing that step is what confirms the "Signed. Not broadcast yet." screen actually appears on a device; until it has been seen there, the wording in the review notes is a claim about the code.  
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
⬜ **App Review contact information first, before anything else on the version page.** The first name, last name, phone number and email under App Review Information are required, and they gate the whole page rather than only themselves: with any of them empty the console refuses to save the version page at all, naming those four and discarding every other edit made in the same pass. It reads like the last box to tick on the way out and it is the first thing that has to go in. Whose details these are is a decision, not a transcription: they are a direct line Apple uses during review.  
⬜ Review notes and demo wallet filled in, with a seed generated fresh for this submission. Paste the notes from this page rather than editing what is already in the console, so a correction made here reaches the submission; the demo wallet has to be prepared and funded first, per Demo account below.  
⬜ Screenshot sets uploaded for iPhone and iPad. This is the one item on this list that is **not** a console act, and doing it by hand is a mistake rather than a shortcut: upload both sets with `node tools/release/upload-listing-assets.mjs`, then confirm from Apple's own side with `verify-appstore-version.mjs`, whose `screenshots-pinned` check compares what the console holds against the pin. The tool takes the pin as its input, so it can only ever upload images that were verified to depict the build being submitted, and it sets the order explicitly afterwards. Dragging several files into the console lands them in completion order rather than capture order, which has already happened on this listing once and matters because Apple serves the first three images on install sheets.  

The iPad screenshot set is mandatory for a universal app; a missing iPad set blocks submission outright rather than degrading the listing. The app icon is the one listing asset compiled into the binary itself: unlike every other field here, fixing it after upload needs a new build, not a console edit, so confirm it is correct before archiving.

### Phase 7: submit

⬜ Ask App Store Connect whether it would accept a submission, instead of reading the console and concluding it looks complete:  

```bash
node tools/release/verify-appstore-version.mjs
```

Exit 0 means the record Apple holds carries everything a submission needs. It reads and changes nothing.

This check exists because a console can look finished while it is not. A build that has been uploaded, has passed processing, and is visible to your testers is **not thereby attached to the store version**: those are two separate links, and only the second one decides whether submitting does anything. A version with no build attached fails at submit, after the metadata form has gone green and after the submit control has become available. The check also re-reads the review notes as Apple holds them rather than as this page writes them, because a document can be corrected while the console keeps quoting the text it replaced.

Read every `NOTE` line before pressing anything. Those are standing decisions rather than defects: nothing is asserted to Apple while the version is a draft, and the form and the binary are asserted together the moment you submit, which makes this the point to re-read them and not before.

One failure is expected right up until the last moment. The demo seed is a placeholder between submissions on purpose, so fill it in the step above and re-run. If it is the only failure, the check says so instead of telling you not to submit.

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
| **Messaging and chat** | **Yes.** The wallet sends encrypted messages from one address to another, so users can communicate directly through the app. |
| Gambling, contests | No, and see the warning below before submitting. |
| Simulated gambling | No, and see the warning below before submitting. |
| Horror, violence, mature themes | No |
| Medical, drug references | No |
| Frequent or intense profanity | No |

Calculated rating: 4+, measured after answering rather than predicted. The
messaging answer was the one worth checking, because declaring a capability
honestly is only cheap if it does not cost the rating: it did not, and the
rating held at 4+ across all 172 countries.

**Answer this questionnaire from the app, not from this table.** Two of the
answers above were once wrong in the same direction, and both were found by
re-deriving the answer from what the build actually ships rather than by
checking that the form was complete. The wizard has more steps than it appears
to: walk every one, and read the calculated rating on the final step before
saving.

**Before you submit, re-read the gambling answers.** The build currently
includes a peer-to-peer betting surface, and the answers above say it does not.
That is a decision the project has taken deliberately and not an oversight, but
it is only a draft answer until the moment a version is submitted, because
submitting asserts the questionnaire and the binary together. Gambling is
governed by a different review guideline from the wallet's other functions, and
one that generally expects per-storefront licensing. An age rating that
understates what an app does is grounds for rejection before approval and for
removal afterwards, so this is a deliberate re-read at submission time, not a
box already ticked.

**Two Apple defaults to check on every form, not only this one.** Every
untouched control on an App Store form has so far turned out to be set to the
permissive answer rather than to no answer: store availability on other Apple
platforms, automatic release on approval, and "sign-in required" were all
switched on by default on an app where each was wrong. Treat an untouched
control as an unanswered question.

### Screenshots

Generated from the simulator at the store build profile, never a build carrying compiled-out surfaces, covering the same four scenes on both iPhone and iPad: balances, receive with a QR code, send confirmation, and the biometric-unlock setting. iPad is mandatory since the app ships as a universal app.

The images come from the app's own demo mode, which uses fixed example balances and example addresses. It holds no keys and touches no network, so no screenshot can show a real recovery phrase or an address holding real funds. Demo mode is put on the main networks before the first capture, because the listing must show the app as a normal user sees it and the test networks are behind a developer setting the store build hides.

**The screenshots are release collateral, not build output.** They are kept in the repository alongside the app, and each capture writes a pin recording the exact commit and version the images depict. Apple's accurate-metadata rule makes a listing that shows an older build than the binary a rejection, and dates on files cannot answer that question: a listing set shot before a round of interface changes looks no different from a current one.

So the last step before uploading is to ask:

```
node tools/release/verify-listing-assets.mjs --set ios --since <the tag you are submitting>
```

It compares the pin against the images on disk and against every commit that has touched the screens they show. Exit 0 means the set depicts the build being submitted; exit 1 means re-shoot before uploading; exit 2 means there is no pin to check, which is the same answer as exit 1 for practical purposes. Re-shoot with `packages/mobile/scripts/screenshots.sh`, which runs both idioms and writes the new pin itself at the end of a successful run. Do not write a pin by hand: a pin that was not written by a capture is a claim about a capture nobody watched.

Then upload the verified set, which needs no browser:

```
node tools/release/upload-listing-assets.mjs --dry-run   # reads Apple, changes nothing
node tools/release/upload-listing-assets.mjs
```

It uploads exactly the images the pin names, replaces whatever the version's localization currently holds, waits for Apple to report each one complete **and** to publish its checksum, and then sets the order. The checksum wait is not caution for its own sake: Apple reports an image complete before that image's digest is readable, so a tool that stops at "complete" reports a success the verifying gate cannot yet confirm. It refuses to run against any version that is not in preparation, because changing listing images on a version already in review is a different act.

Confirm from Apple's side rather than from the tool's output:

```
node tools/release/verify-appstore-version.mjs
```

Its `screenshots-pinned` check asks whether the images the console holds are the pinned ones, per idiom, using Apple's own digest. That question is the reason this whole sequence exists: the listing carried images from a build eighteen interface commits older than the binary Apple held, and every other check was green at the time.

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
> 2. Open Settings and set Network to "Testnet". The app reloads onto a public test network, so no real funds are involved at any point in this demo. Balances are read from a public blockchain indexer; no account is involved.
> 3. Tap Receive. The app shows an address and a QR code. Tap the camera icon to scan one; this uses the device camera directly.
> 4. Tap Send, enter the address shown below and any small amount, and continue to the confirmation screen. **Now turn on Airplane Mode**, and confirm. With no network at all, the app signs the transaction on the device and shows "Signed. Not broadcast yet." Turn Airplane Mode off and the app prompts you about the queued transaction; tap "Broadcast now" in the queued-transactions banner and that same signed transaction goes out. Signing needed no server, no account and no connection.
> 5. Settings also holds the privacy toggles that turn off the only third-party requests the app makes.
>
> The app is open source under AGPL-3.0-or-later.

This text is written to keep two things true, and they must stay true on any future edit: it never mentions a private test environment or asks a reviewer to reach anything not publicly reachable, and there is no review-only configuration or review-detection logic anywhere in the build.

### Demo account

There is no sign-in, so the account fields stay empty and the demo wallet goes in the review notes instead: a funded test-network recovery phrase, password, and a send-to address, filled in fresh at submission time. Treat the seed as burned the moment it enters review notes: never reuse it across stores or releases, since a shared seed is a resource two concurrent reviewers could race into a false "does not work" rejection.

**Step 2 of the demo is load-bearing and must not be dropped as a formality.** An imported wallet does not open on a test network. Both the create and the import paths start a wallet on the three main networks, so without that step a reviewer is looking at an empty mainnet wallet, the funded demo balance is nowhere on screen, and the airplane-mode signing step in step 4 has nothing to spend: the wallet would read as broken at exactly the moment the demo exists to prove it works. Switching the network in Settings derives the addresses for the network being switched to, so one step is genuinely all it takes. If the app ever starts a new wallet on a test network by default, this step becomes redundant and can go; while it does not, the walkthrough has to carry it.

**Step 4's ORDER is load-bearing for the same reason, and it used to be written the other way round.** Airplane Mode has to go on *after* the confirmation screen is up, not before the send is started. Building a transaction is not the same operation as signing one: choosing which coins to spend and sizing the fee is a network call to a public service, and only signing happens on the device. The step used to say "Turn on Airplane Mode. Tap Send ... The app builds and signs the transaction on the device", which asked the reviewer to do the one thing that cannot work offline, and then claimed the result proved the app needs no server. It would have failed before any signing happened, in front of the reviewer, at the one moment the demo exists to prove the app works. Composing first and then cutting the network keeps the demonstration honest and makes it stronger, not weaker: the reviewer watches the device produce a signature with the radio off, which is exactly the guideline 4.2 claim. The app has a screen for precisely this state - "Signed. Not broadcast yet." - so the reviewer sees a positive result rather than an error. That screen promises a reminder rather than an automatic retry, and the walkthrough has to match it: the queue is sent by the reviewer tapping "Broadcast now", because nothing in the wallet re-broadcasts on its own .

Preparing the wallet is four steps, and none of them can be left until the console is open:

⬜ Install the build being submitted, create or import a throwaway wallet, and set Network to "Testnet" in Settings.  
⬜ Fund it on **BTC testnet (TBTC)**, from a public faucet or the project's own test-network funding wallet. A few thousand of the smallest unit is enough; the demo spends almost nothing, and a large test balance on a phrase published to a reviewer is a balance somebody else will move. **Fund that chain and no other, and this is not a preference.** The wallet reaches three test networks and they are not equally usable: a balance only appears once the chain's indexer has processed the block the funding transaction landed in, and on 2026-08-06 the DOGE test network's indexer was 32 days and 756,703 blocks behind, while the LTC test network's newest indexed block was 38 hours old. Money sent to either would have been real, confirmed, visible on a block explorer, and absent from the app. The endpoint check named in the pre-submission gate now measures this and prints `NOT FUNDABLE` beside any test network that cannot show a fresh balance, so run it first and fund whichever chain it reports as the current one rather than trusting this paragraph's date.  
⬜ Confirm the balance is visible **in the app**, not only on a block explorer. This is the whole point of the check: it exercises the same indexer path the reviewer's device will use, from a network that is on no allowlist.  
⬜ Walk the demo steps above end to end on a device, including the airplane-mode step in the order written, and only then paste the phrase, the password and the send-to address into the review notes.

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
