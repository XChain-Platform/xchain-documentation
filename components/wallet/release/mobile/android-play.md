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
⬜ **The cryptocurrency licensing declaration is complete for every jurisdiction Google lists** (see Cryptocurrency licensing documentation below). Until it is, Google accepts nothing for review: not a release, not a listing edit, not a country change. This is the one item on this list that is a legal statement rather than a configuration, and it cannot be delegated to whoever is running the submission.  
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
| `xchain-wallet-vX.Y.Z-full.apk` | the direct-distribution key | the direct-download channel, **only when asked for** (see below) |
| `records/PROVENANCE.txt` | - | beside the bytes, every run |
| `records/DO-NOT-PUBLISH.txt` | - | only on `--rehearsal` |

The `.apk` is derived from **that same bundle** with `bundletool
--mode=universal`, never a second build, so it and the `.aab` are provably the
same code.

### The second, full-feature APK

The store build deliberately leaves features out, because store review posture
requires it. Everyone who installs from the store gets that smaller app, and
until recently so did everyone who downloaded the file directly, since the
direct APK was derived from the very bundle the store receives.

The second APK closes that gap for people who avoid the store on purpose. It
carries the full feature set, and because the full build is genuinely different
code, it is a **second build** rather than something derived from the bundle
above. Ask for it with an environment variable:

```bash
export XCHAIN_BUILD_ANDROID_FULL=1
bash tools/release/android-ceremony.sh --tag vX.Y.Z --output release-artifacts/X.Y.Z
```

It runs after the store artifacts are signed and checked, so a failure in the
extra build cannot cost you the ones the store is waiting for. Leaving the
variable unset makes the ceremony behave exactly as it did before this section
existed.

Both APKs are signed by the same direct-distribution key. That is deliberate:
Android refuses an update signed by a different key, so a person moving between
the two files must not be forced to uninstall and lose their wallet data.

**The `-full` ending is part of how the release is checked, not a description.**
The release tooling decides which feature set a file carries by matching its
name, and the two patterns are written so they cannot both match the same file.
A differently-named APK matches neither and is refused outright, which is the
intended outcome: an unexpected name is exactly the case that must not be
quietly given a meaning.

The full APK is not part of any release yet. The release tooling records it as a
channel that has not shipped, so nothing demands the file; the release that first
publishes it flips that record in the same commit.

The two notes go in a `records/` subdirectory rather than beside the artifacts,
and that is not tidiness. The output directory is the signing input, and the
signing step below hard-fails any file in it that the release list does not
declare, which is what stops a stray build output being signed into the
release. A record written next to the bytes blocked the signing step itself.

### Signing this lane on its own

```bash
XCHAIN_RELEASE_GPG_KEY=<the release key fingerprint, from the security page> \
  bash tools/release/sign.sh --tag vX.Y.Z --lane android \
    --input <output directory>
```

`--lane android` is required here and is not a shortcut. A release manifest
normally has to cover a whole release: the artifact-set gate demands the web
tarball, the extension package and both architectures of every desktop
artifact, because a manifest missing a lane verifies perfectly while describing
a release nobody built. This ceremony builds none of those, so without the flag
the signing step refuses.

What the flag does is narrow the gate to the lanes named in
`tools/release/shipped-lanes.txt`, and **inside that scope the gate is stricter
than the full list, not weaker**:

- both halves of the Android pair become required, even though the release list
  calls them optional. The pair is one build, so half of it is an interrupted
  ceremony rather than a smaller release;
- an artifact belonging to any other lane is undeclared and hard-fails, so a
  per-lane manifest is not a place a stray file can be laundered into the
  release;
- a lane name that is not declared is refused, rather than quietly resolving to
  a scope that demands nothing.

The manifest records its own coverage in the signed header:

```
# coverage: partial
# lanes: android
```

so `verify.sh`, a reader following the verify-release page, and the desktop
updater are all told what it does not attest. The desktop updater refuses a
partial manifest outright: it is a legitimate record, but it never covered the
artifact that updater is installing.

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
now. **Read Google's app-signing certificates.** Play App Signing is mandatory
for new apps, so Google generates its own signing key on first upload and
re-signs everything it distributes. In the console, go to Test and release,
then Setup, then App signing, and copy the **SHA-256 certificate fingerprint of
the app signing key**, not the upload key.

**Copy every certificate on that page, not just the one at the top, and read
the page again before every release.** There is usually more than one, and the
set changes without warning:

- the current app signing key has a **classical** certificate and, where
  quantum-ready signing is switched on, a **post-quantum** one as well. Take
  both. It is not documented which one a device matches against, and guessing
  wrong here fails silently.
- if the page shows a **Previous app signing keys** table, take those too.
  Google can rotate this key, and installs signed by the old certificate keep
  working only while it stays listed.

This matters more than it looks. A rotation changes no file in this project, so
nothing in a code review, a test run or a diff can notice that a fingerprint
recorded weeks ago now describes a certificate Google has stopped using. The
only way to catch it is to re-read this page. It has already happened once, and
it left the published asset-links file naming a retired certificate.

**Do not use the ready-made snippet at the bottom of that page.** The App
signing page ends with a block headed **Digital Asset Links JSON**, captioned
"copy and paste this snippet into your Digital Asset Links JSON file". It is
the most tempting shortcut on the page and it is the one thing here that has
been measured wrong: on 2026-08-07 that snippet offered a single fingerprint,
and it was the key Google had already rotated away from. Pasting it would have
dropped both certificates Google actually signs with, and dropped the
direct-download key as well, which is not on Google's page at all.

Read the fingerprints from the key panels above the snippet instead, and add
them to the pin file rather than replacing what is already there. The asset-links
file is a list on purpose: an extra superseded certificate costs nothing,
because it only widens what Android will accept, while a missing live one
breaks every install of that lane silently. The generator now refuses any build
that would publish fewer certificates than the current file does, and names the
ones that would disappear, so this particular paste stops rather than ships.

Those fingerprints are the missing half of the asset-links file. Phase 6 is what
they unblock.

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

1. Pin the Google app-signing fingerprints from Phase 3 into the website
   repository's `xchain.io/build/play-app-signing-sha256.txt`, replacing the
   `UNPINNED` sentinel. **One fingerprint per line, and put all of them in:**
   the current certificate, its post-quantum twin where there is one, and any
   previous key still listed in the console. Every line is published. Listing a
   certificate Google no longer uses costs nothing, because it only widens what
   Android will accept; leaving out one it does use costs the entire store lane,
   silently. The direct-distribution key's fingerprint is not in this file: it
   is already known and the generator adds it itself, and will refuse the build
   if you paste it here. All of them go under the one application ID.
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
bash tools/release/publish.sh \
  --input  <signed-staging-dir>/ \
  --tag    vX.Y.Z \
  --target <release-feed-alias>:wallet \
  --public-base https://downloads.xchain.io/wallet
```

Four things about that command are load-bearing, and each one cost a failed run
to learn:

- **The target is an `ssh` config alias, not a hostname typed here.** The feed
  key is pinned to a forced `rrsync` command, so the client's path is
  *relative* to the directory that key may write - `<alias>:wallet`, never an
  absolute path, which `rrsync` rejects as an escape attempt. The alias, its
  identity file and the directory it opens are recorded with the release keys,
  not on this page.
- **Add `--dry-run` first.** It walks every gate, verifies the signed manifest,
  prints the upload plan and changes nothing.
- **The release record must be readable.** The publisher refuses to upload
  without the release record for this tag, and the records live outside this
  repository; point `XCHAIN_WALLET_RELEASE_RECORDS` at them if they are not
  where it looks by default. That relocates the records, it does not waive
  them.
- **GNU `rsync`, not Apple's.** macOS ships `openrsync`, which sends an option
  the forced-command feed rejects, and the error names neither `rsync` nor
  `PATH`. The publisher refuses `openrsync` outright rather than letting the
  upload fail obscurely.

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

Then make the download page's Android entry live. It is a data change: the
platform grid renders a tile as "coming soon" until its link is filled in.

**Which link, and the trap in that sentence.** The grid's model treats the
store page as a platform's link and the direct file as an escape hatch beneath
it, so filling in only the direct file used to leave the tile reading "coming
soon" over a published, verifiable download. A platform can now go live on its
direct file alone, and when it does the tile carries the reason there is no
store link beside it.

**The lane-switching warning goes wherever both lanes are reachable.** With
both live, it belongs above the grid, because a Play button and a direct
`.apk` two clicks apart on one tile let a user switch lanes without meaning to,
and switching lanes means an uninstall. With only the direct file live, it
belongs on that tile: the visitor is being offered a sideload, and the cost of
changing their mind later is the wallet.

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
android   SHIPPED   xchain-wallet-android-v*.aab xchain-wallet-v*[0-9].apk
```

and record in its comment which tag shipped first. From then on the signing
step refuses any release staging neither artifact, by name, and refuses one
staging the bundle without the APK, which is the asymmetry that matters: the
direct channel is both the contingency lane and the one whose users chose to
opt out of the store.

Copy that line exactly as the file already spells it. The pattern ends the way
it does so that it cannot also match the full-feature APK, which is a different
feature set and has a channel of its own (`android-full`, listed just below it
and not yet shipped). Changing the spelling here would either silently label one
file as the other or make the two files disagree, and the tooling refuses a
disagreement outright.

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

**What the selector actually offers, and how the list above maps onto it.** The
production track's Countries / regions tab lists **177 rows: 176 countries plus
a final `Rest of World` catch-all**. Three of the exclusions above are not
individually selectable, because Google does not list them: North Korea, Syria,
and the Crimea, Donetsk and Luhansk regions. They are reachable only through
`Rest of World`, so **`Rest of World` is left off** - that is what makes those
three exclusions real rather than merely written down. Ukraine is targeted as a
country; Play cannot express a sub-country exclusion, so the occupied regions
rest on Google's own sanctions handling.

Selecting every row and then removing the exclusions leaves **163 targeted**.
The tab's own filter chip reading `Targeted (163)` after a page reload is the
check that it saved; the track summary line shows the same number.

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

**The obvious way to make the licensing requirement go away is to untick
`Cryptocurrency wallet`, and it works, and it is a misdeclaration.** Step 2
below appears *because* that box is ticked; clearing it takes the eleven
jurisdiction rows off the page and lets the submission through. Nothing in the
console warns you. What it actually does is tell Google that an app called
XChain Wallet, whose listing and entire function are a cryptocurrency wallet, is
not one. Play enforces its cryptocurrency policy against what an app does rather
than what the form says, so this trades a blocked submission for a removable
app. **If the licensing rows cannot be answered, the supported remedy is
Google's own: narrow the country list until the jurisdictions that demand a
licence are no longer targeted.** Do not solve it on the checklist.

The feature checklist is step 1 of two. **Step 2 is Documentation, and it is
what actually holds up a submission.** An earlier version of this page said
ticking "Cryptocurrency wallet" did not trigger a request for regulatory
documentation. That is no longer true, and the note that it would need
re-checking at each submission was the right instinct.

### Cryptocurrency licensing documentation

Ticking "Cryptocurrency wallet" puts eleven rows on step 2, each reading
`Not started`, under the heading *"You need to submit location-specific
licensing documentation to prove your app can provide cryptocurrency
features"*:

| Row | What it asks for |
|---|---|
| Bahrain, Canada, Israel, Japan, Philippines, South Africa, South Korea, United Arab Emirates | Local licensing details, or one of the two confirmations below |
| European Union | MiCA: authorized entity legal name, MiCA licence number, and an uploaded licence document (JPEG/PDF/PNG, up to 10MB), or one of the two confirmations below |
| United States | FinCEN money-service-business registration plus state money-transmitter registration, or a federal/state chartered bank licence, or one of the two confirmations below |
| All countries / regions | A terms-of-service acknowledgement covering holding the appropriate licences, compliance in every targeted country, and telling Google when regulatory status changes |

Each of the ten country rows offers the same two alternatives to uploading a
licence:

- *"I confirm that my app does not offer the purchase, holding, or exchange of
  cryptocurrencies in this country/region and I have applied the necessary
  geo-restriction measures"*
- *"I confirm that my app is a non-custodial software wallet"*

**These are legal attestations made by the developer entity, not build
configuration.** They are the operator's to make and nobody else's, and the
console states the consequence of getting them wrong plainly: *"Apps that
provide cryptocurrency features in the United States without uploading valid
license documents will be removed from Google Play"*, with the same sentence
for the European Union.

**Nothing can be sent to Google while any row reads `Not started`.** Publishing
overview refuses with *"1 issue found ... You must address these issues before
you can send your changes for review"*, and the Submit button stays disabled.
This gates every change, not just the release: a store-listing edit is held up
by it too.

The country list in step 2 is fixed by Google and does not shrink when a
country is dropped from a track. Removing a jurisdiction from targeting is
Google's own suggested remedy where a licence cannot be produced ("remove the
United States from your targeting list across all tracks"), so a decision to
narrow the D8 list is a live alternative to attesting, not a separate topic.

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
