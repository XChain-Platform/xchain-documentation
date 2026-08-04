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

### Phase 0: the blocking gate

Do not open a store form until every line here is true. Each one has cost a
release somewhere, and the last two are the ones a schedule quietly eats.

⬜ The Play developer account exists, is organization-owned, and is identity-verified.  
⬜ Two-factor authentication on the console account is a hardware security key or a passkey, and **the SMS and authenticator-app fallbacks are removed**. While a text-message fallback is live, a SIM swap bypasses the hardware key entirely. An attacker inside this console can reset the upload key and ship a malicious update to every install, which makes it the worst single compromise on the lane.  
⬜ Both release-signing keys exist on the release machine: the Play upload key and the direct-distribution key.  
⬜ **A sealed offline copy of the direct-distribution key exists, off this machine.** The direct-distribution key can never be rotated: Android refuses an update signed by a different key, so every existing direct install is stranded if it is lost. The upload key is merely painful to replace, because Google can reset it.  
⬜ The privacy policy is live at a fetchable public URL and serves the **current** text, re-checked immediately before this submission rather than remembered from the last one.  
⬜ Country availability is decided (see Country availability below).  
⬜ Data safety answers are settled; see [the wallet's data-safety answers](../../privacy/data-safety.md).  
⬜ The build-time dependency verification metadata is committed to the repository, not just present on one machine.  
⬜ The demo path a reviewer's walkthrough depends on is reachable **from outside**, with a plain non-browser client.

The privacy-policy check is one command, and it is the only thing standing
between a correct set of answers and a reviewer reading a stale page:

```bash
node tools/release/verify-privacy-url.mjs
```

The outside-reachability check is the other one. It is not an iOS-only gate,
and it was treated as one once: a Play reviewer walks the same scripted
demo against the same public test-network endpoints, from a network we have
never seen, with a client that does not look like a browser. Every suite in
the repository either stubs the network or runs against a local chain, and CI
runs from allow-listed hosts, so the only way to ask this question is to ask it
from outside:

```bash
node tools/release/verify-demo-endpoints.mjs
```

The failure this catches is a functionality rejection: an edge that answers
anything non-browser with a 403 leaves a reviewer looking at a wallet that
cannot load a balance.

### Phase 1: build and sign

Run on the release machine, at a keyboard, with the tree clean and HEAD on the
release tag. The script refuses otherwise, and refuses to run in CI at all.

**Set up the machine before you start, because a release worktree is normally a
fresh one.** The clean tree this phase demands is usually a detached worktree
checked out at the tag, and a fresh worktree has no installed dependencies and
inherits nothing from your usual shell. Four things have to be true, and each
one has stopped a real ceremony:

⬜ A **JDK 21** is on the path, which is where `java` and `jarsigner` come from.  
⬜ The Android SDK's **build-tools** directory is on the path, which is where
`apksigner` comes from. It is not on the path by default on any platform, and
without it the ceremony stops before it builds anything.  
⬜ **bundletool** is available, and its location is passed in. The universal APK
is derived from the bundle with it, so it is not optional.  
⬜ The **workspace is installed** in the worktree you are about to build in.
Without this the build fails minutes later, inside the package manager, with a
missing-command error that names a build tool rather than the real cause.

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/android-sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/build-tools/<version>:$PATH"
export BUNDLETOOL=/path/to/bundletool.jar

pnpm install --frozen-lockfile
```

The ceremony checks all four before it does any work and names the one that is
missing, so a wrong machine costs a line of output rather than a build. Then:

```bash
export XCHAIN_K9_KEYSTORE=...   XCHAIN_K9_ALIAS=...
export XCHAIN_K10_KEYSTORE=...  XCHAIN_K10_ALIAS=...
bash tools/release/android-ceremony.sh --tag vX.Y.Z --output release-artifacts/X.Y.Z
```

No password is passed on a command line or read from the environment. The
signing tools prompt for them, or read them from a locally-restricted file **by
path**. That is what makes it a ceremony rather than a script.

Add `--rehearsal` to produce the same artifacts without them counting as a
release. Rehearse before the real run whenever the code has moved much since
the last one: it costs minutes and it is the only way to find out that the
machinery still works without spending the tag to do it.

It produces, into the output directory:

| File | Signed by | Where it goes |
|---|---|---|
| `xchain-wallet-android-vX.Y.Z.aab` | the upload key | Play only. **Never hosted publicly.** |
| `xchain-wallet-vX.Y.Z.apk` | the direct-distribution key | the direct-download channel |
| `PROVENANCE.txt` | - | beside the bytes, every run |
| `DO-NOT-PUBLISH.txt` | - | only on `--rehearsal` |

The APK is derived from **that same bundle** with `bundletool --mode=universal`,
never a second build, so the two files are provably the same code.

Then run `tools/release/sign.sh` over the output directory, so both artifacts
land in the release hash list and the signed manifest. Both names are declared
in `tools/release/expected-artifacts.txt`; an artifact whose name matches no
declared line is a hard failure there, not a cosmetic mismatch.

**Before you upload, confirm the bundle is what you think it is:**

```bash
bundletool dump manifest --bundle xchain-wallet-android-vX.Y.Z.aab
```

Expect `package="io.xchain.wallet.android"`, the `versionCode` that
`node packages/mobile/scripts/version.js vX.Y.Z` derives, `allowBackup="false"`,
`usesCleartextTraffic="false"`, exactly one exported component, and exactly this
set of permissions:

```
android.permission.CAMERA
android.permission.INTERNET
android.permission.USE_BIOMETRIC
android.permission.USE_FINGERPRINT
io.xchain.wallet.android.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
```

**It is the set that matters, not how many there are.** Every permission is
Play review surface, so a swap is as significant as an addition: trading the
camera permission for a location permission keeps the count identical and
changes the review surface completely. The last entry is not one the app asks
for; it is the Android support library's own signature-level permission,
listed because it is genuinely merged in. A vendor permission appearing here
that is not on this list is the signal to stop: push messaging and Play
Services announce themselves exactly that way, and this app deliberately
carries neither.

### Phase 2: the console forms

#### 2a: create the app record, and two of its answers are permanent

Nothing exists in the console until this step, and the record is what every
later phase writes into.

Go to `https://play.google.com/console`, then All apps, then **Create app**.

| Field | Value | Reversible? |
|---|---|---|
| App name | `XChain Wallet` | yes, editable later |
| Default language | English (United States) | yes |
| App or game | App | yes |
| Free or paid | **Free** | **NO.** A free app can never be switched to paid |
| Package name, if the console asks for it here | **`io.xchain.wallet.android`** | **NO.** Immutable once published |

**The package name is not something to compose at the keyboard.** It is already
compiled into the artifact you are about to upload, in six places that a test
holds to each other: the Capacitor config, the Gradle application ID and
namespace, two values in `strings.xml`, the main activity's package and its
directory, and the asset-links template. Confirm it against the artifact rather
than against this sentence:

```bash
bundletool dump manifest --bundle xchain-wallet-android-vX.Y.Z.aab | grep -o 'package="[^"]*"'
```

If what you type differs from what the bundle carries, Play rejects the upload.
If it differs from the published asset-links file, deep links fail silently
instead, which is the worse of the two.

Historically the console derived the package name from the first uploaded
bundle rather than asking at creation time. If your console asks for it up
front, the value above is the answer either way; if it does not ask, the first
upload in Phase 3 sets it, and it is equally permanent then.

#### 2b: the listing and policy forms

Every answer is written down. Copy, do not compose.

| Console field | Source |
|---|---|
| Store name, short and full description | Listing collateral, below |
| Categorization, contact details | Listing collateral, below |
| Trader declaration (EU DSA) | Listing collateral, below. It appears publicly on the listing |
| Financial features declaration | Listing collateral, below |
| Reviewer instructions and app access | Listing collateral, below |
| Data safety form | [the wallet's data-safety answers](../../privacy/data-safety.md) |
| Privacy policy URL | the URL checked in Phase 0 |
| Country availability | Listing collateral, below |
| Icon, feature graphic, screenshots | the store assets directory, and its README for provenance |

Two answers in the data-safety form are easy to get wrong under form pressure
and are written down there for that reason: the **issuer-chosen token metadata
host**, which is a third-party contact that is on by default, and the **update
feed**, which is declared even though a Play-installed build never requests it.

### Phase 3: internal testing track

Upload the bundle to **internal testing** first. It is the cheapest place to
discover that the console rejects something about the bundle itself.

Immediately after the first upload, do the thing that only becomes possible
now. **Read Google's app-signing certificate.** Play App Signing is mandatory
for new apps, so Google generates its own signing key on first upload and
re-signs everything it distributes. In the console, go to Test and release,
then Setup, then App signing, and copy the **SHA-256 certificate fingerprint of
the app signing key**, not the upload key.

That fingerprint is the missing half of the asset-links file. Phase 6 is what
it unblocks.

Then install from the internal track on a **real physical device** and walk the
flows end to end. A physical device is a release gate for three checks an
emulator structurally cannot settle: biometric optics, real-camera QR scanning,
and that remote web debugging is genuinely off. Every emulator image with Google
APIs runs as a debuggable build, which starts a debugging server for every app
regardless of the flag, so an emulator always looks like a failure on the third
one and can never confirm it.

#### 3a: decide when an approved change goes live, before you submit one

Managed publishing is a single switch on the Publishing overview, and it is
**off** unless someone turns it on. Off means an approved change publishes at
the moment Google approves it, which is whatever hour Google happens to finish.
On means approval parks the change and you press Publish yourself.

Set it before the first submission rather than after, because it decides the
character of every go-live that follows. For a wallet's first public release
the argument for turning it on is that the direct-download channel is published
by hand (Phase 7): if Play goes live while nobody is awake, the two channels
disagree about what the current release is for as long as it takes someone to
notice.

It does not affect internal testing. An internal release reaches its testers
immediately either way, so turning it on costs nothing in the phase you are
standing in.

⬜ Managed publishing is set deliberately, either on or off, rather than left at
its default without a reading.

#### 3b: send the app content and listing for review

**This is a separate action from promoting between tracks, and it is easy to
miss because nothing prompts you.** Uploading a bundle does not submit anything
for review, and neither does promoting one track to the next. The review is
requested from the Publishing overview, where a button reads **Submit N changes
for review** and stays greyed until a bundle exists on some track. That is why
the step sits here and not in Phase 2 with the forms it submits.

Until this review passes, three things read as though something is broken and
none of them is:

- the app carries a **temporary name**, its package id with `(unreviewed)`
  beside it, in place of the store name
- the track summary reads **Inactive**
- the release reads **Not reviewed**

Read the staged list before submitting it. The overview names every change it is
about to send, and a change you do not recognise is one you did not intend to
make. Below that list sits a separate block of declarations that are not
published but are taken into account during review; those need no action here.

⬜ The staged change list has been read line by line and every entry is intended.  
⬜ The submission is sent, and the expectation is set with whoever is waiting:
a first-time review runs longer than an update review and can draw a manual
review for a wallet.

### Phase 4: closed testing (beta)

Promote the same bundle to a closed testing track for a beta cohort before
production. The review clock starts at Phase 3b's submission rather than here,
so by the time you promote, that clock is usually already running.

### Phase 5: production, staged

Promote to production at a staged rollout percentage rather than at 100%, and
**know where the halt lever is before you start**: halting a staged rollout is
the only Play-side incident control that exists once a release is live.

### Phase 6: close the deep-linking loop

This can only happen now, and it is the last open item in the verification
list.

1. Pin Google's app-signing SHA-256 from Phase 3 into the website repository's
   `xchain.io/build/play-app-signing-sha256.txt`, replacing the `UNPINNED`
   sentinel. The direct-distribution key's fingerprint is already there and
   already real; both fingerprints go under the one application ID.
2. Generate and publish the file:

   ```bash
   npm run build:assetlinks
   ```

   It writes `.well-known/assetlinks.json`. **It is deliberately fail-closed and
   is not part of the aggregate site build:** while the sentinel is in place it
   refuses and writes nothing, exiting non-zero. That is the safer failure. An
   asset-links file with a wrong fingerprint is worse than no file at all,
   because Android verifies App Links at install time and **caches the verdict**,
   so a bad fingerprint means links open in the browser forever with nothing
   raised anywhere, and a 404 at least tells the truth.
3. Deploy it, and confirm the edge serves it to an unauthenticated client.
   Android's verifier fetches this file with its own client through Google's
   infrastructure, never through the user's browser, so anything gating it on a
   browser-shaped request breaks verification silently.
4. Verify on a signed install:

   ```bash
   adb shell pm get-app-links io.xchain.wallet.android
   ```

   Expect `verified`. The failure mode is silent: links simply open in the
   browser with nothing anywhere saying why.

### Phase 7: the direct-download channel

Publish the signed APK and its signed manifest under `wallet/android/` on the
downloads host, **after** the staged rollout reaches 100% or on an explicit
release decision. That ordering exists only so the direct channel never
receives a release the Play rollout could still halt; it orders steps within
one release and never drops or delays one. **Whenever Play stalls, rejects, or
suspends a release, promoting the direct channel is the normal path**, not an
exception.

```bash
bash tools/release/publish.sh --version X.Y.Z
```

The publisher routes the `.apk` to `wallet/android/` and **refuses the `.aab`
by name**. Play re-signs every bundle before serving it, so a hosted `.aab` is
a file nobody can install and nobody can check against anything Google handed
them.

Publish beside it:

- The direct-distribution certificate's SHA-256 and the one-liner a user
  actually runs:

  ```bash
  apksigner verify --print-certs xchain-wallet-vX.Y.Z.apk
  ```

  The copy in the repository's `SECURITY.md` is canonical; the download-page
  copy is convenience, because a fingerprint served by the same origin as the
  file it describes proves nothing if that origin is compromised.
- **The version-check feed, and only after the APK is in place.** It is the
  direct channel's only update mechanism. A feed naming a version nobody can
  download is an alarm with no exit.

Then make the download page's Android entry live. It is a one-line change: the
platform grid renders a tile as "coming soon" until its link is filled in.
**Move the lane-switching warning above the grid at the same time.** Once the
Play button and the direct `.apk` link sit two clicks apart on one tile, a user
can switch lanes without meaning to, and switching lanes means an uninstall.

**There is no halt, no rollback and no downgrade on this channel.** Android
refuses a version-code regression without an uninstall, and an uninstall wipes
the wallet's local vault. The remedy for a bad direct release is a signed
advisory, a fixed build with a higher version code, and a feed update. Nothing
else exists.

### Phase 8: arm release parity, in this release's own commit

The moment Phase 3 uploads and Phase 7 publishes, Android has users. Neither
action changes what the release gate demands, so **the next release could omit
the Android pair entirely and still produce a manifest that is internally
perfect**: every hash correct, every signature good, verification green, while
every direct install sits on a version nothing will ever update. A gate cannot
fail on an artifact nobody told it to want.

Flip one word in `tools/release/shipped-lanes.txt`:

```
android   SHIPPED   xchain-wallet-android-v*.aab xchain-wallet-v*.apk
```

and record in its comment which tag shipped first. From then on the signing
step refuses any release staging neither artifact, by name, and refuses one
staging the bundle without the APK, which is the asymmetry that matters: the
direct channel is both the contingency lane and the one whose users chose to
opt out of the store.

**Do this in the same commit that records the release.** It is one word, and it
is the only step in this runbook whose omission is invisible until the release
*after* the one that omitted it.

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
| Contact email | `info@dankest.llc`, which is the trader email below and the address every other store listing publishes. It is the one proven to receive mail; do not swap in a different address for this field alone. |
| Website (app listing) | `https://xchain.io`. The account-level website is `https://dankest.llc`, and the two are different fields. |
| Privacy policy | The URL [the wallet's privacy policy](../../privacy/privacy-policy.md) publishes, with its trailing slash, taken from there rather than retyped here so there is only ever one copy of it. Phase 0 already checked it is live and serving the current text. |

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
| Email | `info@dankest.llc` (identical to what the Chrome and App Store listings publish, and proven to receive) |
| Phone | `+1 949-510-5364` |

**Do not silently substitute a different phone number at the console.** If the published number is ever swapped for a forwarding line (a VOIP number that rings the same handset satisfies the EU Digital Services Act identically, since the rule is a working means of contact, not a carrier line), that change lands on all three store listings in the same pass. One legal entity showing different public contacts on different listings is exactly what a reviewer or a regulator notices.

⬜ Trader declaration submitted, matching the identity above: entity, address, email and phone.  

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
under the 500-character cap, so measure it rather than eyeball it. The text
below is 485 characters, which leaves very little room:

```bash
printf %s "<the walkthrough text>" | wc -c
```

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
