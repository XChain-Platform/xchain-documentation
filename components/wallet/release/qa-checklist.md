<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/QA_Checklist.md @ 34639117 (worktree dirty) -->

# Manual QA checklist

Pre-release sanity check. Automated suites (smokes, unit tests, Playwright, reproducible-build checks) cover code correctness; this checklist covers feature correctness: does the wallet actually behave the way a user expects when they hold it.

Run this against every shell (web, extension, desktop) before tagging a release. Skip a section only with a written note in the release changelog explaining why (for example, "extension only, no desktop changes this cycle").

**Status icons:**

- ✅ Passed
- ⬜ Not yet checked
- ❌ Failed (open issue and reference it here)
- ⏸ Skipped (note why)

---

## Pre-flight

- ⬜ A clean install succeeds against a fresh checkout.
- ⬜ The smoke suite reports the documented baseline; update this checklist if the baseline shifts.
- ⬜ Typecheck is clean.
- ⬜ `git status` is clean against the tagged commit (no stray edits, no dependency drift).
- ⬜ `CHANGELOG.md` has an entry for the release with a meaningful summary.
- ⬜ The wallet version matches across every package.
- ⬜ The Security page link in the About panel resolves.

---

## Onboarding

Run on a clean profile (extension: fresh install / cleared storage; web: incognito; desktop: clean user data directory).

- ⬜ License agreement gate appears on first launch.
- ⬜ License-accept checkbox is disabled until the panel is scrolled to the end.
- ⬜ Once accepted, the license gate does not reappear on subsequent launches.
- ⬜ Create wallet, 12-word selection: recovery phrase displayed, copy works, verify-quiz mismatch surfaces the offending word.
- ⬜ Create wallet, 24-word selection: same as above; verify-quiz scales position count.
- ⬜ BIP39 passphrase advanced toggle: matched-pair input, permanent-loss warning visible, threaded into vault.
- ⬜ Import recovery phrase: typed input, drag-drop `.txt`, scan QR (where a camera is available).
- ⬜ Import encrypted backup: file picker and paste both work; backup password unlocks the file.
- ⬜ Try-before-commit demo mode: entry button works; demo banner mounts; "Exit demo & wipe" clears the wallet.
- ⬜ Donation-consent screen surfaces during create, on every shell where it applies.

---

## Send

- ⬜ Send native coin (BTC / DOGE / LTC): address paste, amount entry, fee selector.
- ⬜ Send token: picker shows pinned and visible tokens; hidden ones stay hidden until expanded.
- ⬜ Recipient autocomplete from contacts and history.
- ⬜ Address paste runs through a paste-integrity check (clipboard hijack rejected).
- ⬜ Lookalike-address banner fires when an address closely resembles a recent recipient with one differing character.
- ⬜ Test-send protection prompts on a never-used recipient.
- ⬜ Fiat / token amount toggle works; the "Max" button populates the form.
- ⬜ Custom fee mode shows a DOGE per-kB unit-aware input.
- ⬜ Replace-by-fee toggle defaults from settings; enabling it surfaces the speed-up affordance in History.
- ⬜ Broadcast success: pending card with the transaction id, copy works, explorer link opens.
- ⬜ Broadcast cancel from a hardware signer: "Transaction cancelled." toast, return to form, no half-state.

## Receive

- ⬜ Address QR renders, copy works.
- ⬜ "Request payment" sub-form generates a BIP21 URI; the share button posts to the OS share sheet where supported.

---

## History

- ⬜ Activity feed loads; skeleton rows show during the initial fetch, replaced when data lands.
- ⬜ Empty-state nudge with a Receive call-to-action renders for an unused address.
- ⬜ Filter chips (action type, status, date) work alone and combined.
- ⬜ Search box filters by tick, address, or transaction id substring.
- ⬜ Grouped mode collapses related action pairs (issue/mint, dispenser create/dispense, order/fills).
- ⬜ Transaction detail expands; status timeline shows broadcast, mempool, confirmed.
- ⬜ Export to CSV / JSON respects active filters; the downloaded file opens correctly.

---

## Token detail

- ⬜ Clicking a balance row from Home opens the token detail view.
- ⬜ "View activity" lands History pre-filtered to the token.
- ⬜ Star toggle moves the token to the pinned section on Home.
- ⬜ Hide toggle moves it under "Show N hidden tokens".

---

## Sign screens

- ⬜ Send sign approval: plain-English summary shows the recipient, amount, and coin/token as the user typed them.
- ⬜ Balance-change preview is accurate for a send.
- ⬜ Raw PSBT viewer expands; bytes match the hex copy.
- ⬜ User-initiated Sign Message: text to signature to verify with the same address succeeds.
- ⬜ User-initiated Verify Signature: paste signature, address, and message; ok / not-ok renders correctly.
- ⬜ User-initiated PSBT paste-in form: paste hex, preview, sign, signed PSBT hex output.

---

## Lock, unlock, panic

- ⬜ Auto-lock fires after the configured timeout (default 15 minutes); the session key is cleared.
- ⬜ Auto-lock still fires when the wallet is left on a screen other than Home: set the timeout to 1 minute, open Send and half-fill it, idle 90 seconds, confirm it locks. Repeat on Receive, History, and Settings.
- ⬜ Auto-lock set to "Never" does not lock, however long the wallet idles.
- ⬜ Manual lock action returns to the Locked screen.
- ⬜ Failed-attempts escalating delay kicks in after 3 failed unlocks; a banner counts down.
- ⬜ Caps-lock warning appears when caps is active in the password field.
- ⬜ Privacy blur engages on window blur (extension and desktop).
- ⬜ Biometric unlock works on supported devices (WebAuthn PRF).
- ⬜ Panic mode arms: sign attempts reject and a 24-hour countdown is visible in Settings.
- ⬜ Duress passphrase silently arms panic mode and shows a decoy wallet.

---

## Backup and recovery

- ⬜ Encrypted backup export: file downloads with the wallet's backup extension; size is greater than zero.
- ⬜ Reveal seed phrase: password gate, tap-to-reveal, words match what was created.
- ⬜ Dry-run restore: paste mnemonic, preview accounts/addresses without writing.
- ⬜ Publish labels now (software wallets only).
- ⬜ Backup-reminder card surfaces on Home for an unverified wallet; "Back up now" routes to the right place.

---

## Hardware signers

Run with a real Trezor and Ledger device. Skip the row and add a note if a device isn't available.

- ⬜ Trezor pair flow opens Trezor Connect; address derived correctly.
- ⬜ Ledger pair flow opens the WebHID picker; address derived correctly.
- ⬜ Signer-select form appears when adding accounts/addresses; the hardware path skips the wallet password.
- ⬜ Send via a hardware signer: full sign and broadcast round-trip.
- ⬜ The private-key export surface is unavailable for hardware-signer addresses (gating enforced).

---

## Multisig

- ⬜ Create an n-of-m config from Settings → Multisig.
- ⬜ PSBT-QR cosigner round-trip (animated frames and manual stepping under reduced motion).
- ⬜ Paste-inbox accepts partial PSBT hex; the combiner finalizes once the threshold is reached.

---

## dApp bridge

Use the reference test dApp against the extension under test.

- ⬜ `connect()` opens the approval popup; the user can narrow chains.
- ⬜ The approval popup is OS-rendered, not in-page DOM.
- ⬜ `getAccounts` / `getBalances` return after connect.
- ⬜ `signMessage` round-trip produces a verifiable signature.
- ⬜ `signAction({ action: 'SEND' })`: approval, sign, broadcast.
- ⬜ `signIn` round-trip: challenge parses, signature verifies.
- ⬜ `disconnect` fires the `disconnect` event back to the provider; `accountsChanged` fires when the user revokes from Settings.
- ⬜ The "Connected Sites" settings panel shows the test dApp; revoking removes it; revoke fires `disconnect`.

---

## Offline / degraded mode

- ⬜ Disable the network: the reachability banner appears within 30 seconds.
- ⬜ Attempt a send while offline: broadcast fails, the banner remains, queued-broadcast UI shows the entry where wired.
- ⬜ Re-enable the network: the banner clears; the queue prompt appears where wired.
- ⬜ Staleness labels update correctly across surfaces that mount them.

---

## Accessibility

- ⬜ Tab from the unlocked Home reveals the skip-to-main-content link as the first focusable element.
- ⬜ Every form has a visible focus ring on inputs, buttons, and clickable primitives.
- ⬜ Status / error / success messages announce via `aria-live`.
- ⬜ `prefers-reduced-motion` clears entrance animations on Onboarding.
- ⬜ `prefers-contrast: more` palette is readable end-to-end.
- ⬜ Forced-colors mode (Windows high contrast) renders without obvious layout breakage.

---

## URI schemes

- ⬜ `xchain:<address>` opens the wallet (the web shell registers via `navigator.registerProtocolHandler`).
- ⬜ Extension popup deep-link opens with the URI as a routable intent, where wired.
- ⬜ Desktop `xchain:` URI from the OS opens the wallet on macOS / Windows / Linux.
- ⬜ The URI-parser fuzz harness is green. It is the standing guard for the deep-link audit below; a release that skips it has not checked the wallet's widest untrusted-string surface.

### Deep-link input audit

Run before a store submission that touches the URI parser, the Send route, or the contract-execute route. The extension popup's `?uri=` boot path survives the unlock cycle, and the camera scan route feeds the same parser, so whatever survives it lands in screen state.

The most recent audit combined the fuzz harness above with a hand-driven hostile corpus. Result: a crafted link opens a compose view and nothing more.

- ✅ Total function: no input throws, including non-strings; every result carries one of the documented kinds.
- ✅ A link cannot start a signing flow by itself: a prefill can only reach the compose form, never review or confirm.
- ✅ Routing values are gated: a hostile chain id is dropped rather than carried; numeric fields are digits-only; enumerated fields fall back to a default rather than accepting arbitrary values.
- ✅ Send-shaped fields never populate a contract-execute intent, so one link cannot arm both forms.
- ✅ No prototype pollution from any query key, including `__proto__` and `constructor`.
- ✅ BIP21 `req-` parameters reject the whole URI, including percent-encoded spellings.
- ✅ Oversized input stays bounded; gated fields are anchored and length-bounded, so there is no backtracking blowup.

Two findings are recorded rather than fixed, neither blocking a release:

- ⬜ **Deep-link fields skip the repo's own display hardening.** A memo, tick, address, or contract-method field carried through a deep link is not neutralized the way other attacker-supplied strings on signing screens are: unusual Unicode direction-control characters and control characters can survive into a field before the user sees it. Bounded by the fact that the user sees and can edit these fields in the compose form before confirming, which is why this is a hardening gap and not a blocker.
- ⬜ **An unrecognized action segment silently becomes a send.** By design, anything outside the receive / execute URI segments routes to the Send compose form rather than being rejected. Harmless while every shell routes on the parsed kind rather than the literal segment; re-check this invariant whenever a new deep-link route is added.

---

## Build and release artifacts

- ⬜ The web build produces a deployable static bundle.
- ⬜ The extension build produces an unpacked dist that loads as an MV3 extension.
- ⬜ The desktop `dist` command produces signed installers for the target platform.
- ⬜ The desktop `dist:unpacked` command produces the reproducible Linux bundle.
- ⬜ The desktop `reproduce` command runs and matches `RELEASE_HASHES.txt`.
- ⬜ The diagnostic dump (About → Copy diagnostics) produces JSON with the new version stamped.

### Remote-code audit of the built extension bundle

- ⬜ The extension's remote-code audit script exits clean against a fresh build. Run it before any submission that changes dependencies or the build.

Manifest V3 bans remotely-hosted code outright, and it is one of the first things a Chrome Web Store reviewer checks on a wallet. The audit scans every shipped JavaScript, HTML, CSS, and JSON file in the build output for `eval`, the `Function` string constructor, `importScripts`, dynamic `import()`, script-element `src` assignment to a remote URL, and streaming WebAssembly instantiation. It is a gate rather than a report: a small set of known-benign hits (a packaged local resource load, a dead code path from a bundled dependency, a React internals workaround) are allow-listed by code signature with their reasoning written out, and anything else exits non-zero. A new hit is either a real violation that blocks submission, or a new benign pattern that belongs in the allow-list with its reason recorded. Do not waive one by deleting the check.

The most recent audit confirmed the claim holds: nothing in the bundle fetches or evaluates code at runtime.

Watch the absolute-origin inventory the same scan produces. Every host that the shipped code can actually contact at runtime must appear in the Privacy Policy and must match what is disclosed in the store's data-disclosure tab; a mismatch there is a common rejection cause. As of the most recent audit the runtime set is: the configured blockchain RPC and XChain decoder / indexer / explorer endpoints; a native coin price data source (default on, toggleable in Settings → Privacy); token-metadata document hosts and the embedded media they reference, including IPFS and Arweave gateways (default on, toggleable in Settings → Privacy); and external block-explorer favicons rendered on History detail, which have no toggle. Everything else the scan reports is an inert documentation, license, or demo-fixture string.

### Chrome Web Store release provenance

Run before every Chrome Web Store upload (first submission, a beta-lane soak build, or a public update). The manifest-freeze rules below run automatically in the smoke suite and gate the release build; the rows after them are steps a human does, not things a script can do.

- ⬜ **The Privacy Policy URL is live, before the store submission form is even opened.** The listing points reviewers at the wallet's hosted privacy policy, and the CWS submission form validates that the URL resolves; a submission against a down or stale URL fails at the form, not at review. The hosted page is generated from the source-of-record privacy policy, which has its own sync check; whenever the source file changes, regenerate and deploy the hosted page before the store publish step below.
- ⬜ The smoke suite passes, which includes the manifest-freeze rules: permissions, host permissions, content-script match lists, and web-accessible-resource match lists must not have drifted from the pinned allowlist, and the three match lists must not have drifted from each other.
- ⬜ **Human diff of `manifest.json`.** The freeze gate above lives in the same commit as the manifest, so it stops accidents, not a determined compromise. Before every submission, the release operator diffs the manifest against the previous release tag and reads every line. Any change is a deliberate, recorded decision, never a side effect nobody noticed. Permission changes silently trigger CWS re-review and can disable the extension for installed users until they re-accept.
- ⬜ **Pre-upload hash check.** The uploaded artifact is exclusively the CI-emitted release zip, never a locally built one. Before upload, the release verify script confirms the hash, header anchor, and signature all check out, and the signature check names the key: `verify.sh` prints `signer ok - <fingerprint>` and refuses a good signature from anything other than the release key. "Once available" was the hedge here while no release key existed; K1 has existed and been pinned since 2026-08-06, so an unsigned or unattributed manifest is now a stop rather than a caveat. Record the checked hash alongside the release record in the same step as the upload.
- ⬜ **Post-publish verify** (first publish, and after any account-security event; recommended every publish once routine). A post-publish verification script run against the store-installed build passes.
- ⬜ **Store-version monitor is live before the public flip.** A monitor compares the release record against the version the Chrome Web Store is actually serving for each configured listing; a live version with no matching release record is the signal of a rogue publish going out through the console without the logged, one-operator process, which is what a compromised or phished publisher account produces. This is one of the exit criteria that gates the flip from unlisted to public, alongside a two-machine store install and a 24-hour auto-update observation, not just "built". Do not compare against the latest release tag instead of the release record: the store lawfully lags the tag during review and after a rejection, and a tag-based check false-alarms on every normal release. **And confirm it is the CHROME job you are looking at.** The same script now carries a second lane for the Android listing, armed separately with `--no-chrome`, so a scheduled job running this monitor can be installed and firing while no Chrome listing is being watched at all. The entry that satisfies this box is the one carrying `CWS_MAIN_ITEM_ID`.

---

## Documentation parity check

Before sign-off, verify the docs that ship with this release still match what the code actually does. A doc that lies is worse than one that's silent.

- ⬜ Architecture documentation: the signal flow, signer abstraction, storage substrate, and reachability sections still match the current code. Look for renamed packages, deleted flows, or new bridge surfaces.
- ⬜ Bridge documentation: every method listed (connect, getAccounts, getSupportedChains, getActiveChains, signMessage, signAction, signPsbt, signIn, disconnect, event subscriptions) is registered in the bridge handlers. The error code table covers every code the handlers throw.
- ⬜ Reproducible-builds documentation: the per-target status table reflects the current build pipeline. The desktop reproduce script references the hash file the script actually produces.
- ⬜ [Verify a release](verify-release.md): the page still sends the reader to the two publication channels for the GPG key fingerprint (`SECURITY.md` in `xchain-wallet` and `https://xchain.io/security`), both channels resolve, and neither has gone stale against the key actually in use. The page must not grow a third copy of the fingerprint.
- ⬜ Glossary: newly added user-facing terms from this release are present, for example when a feature ships a new on-screen word the user might not know.
- ⬜ Threat model: the controls table and out-of-scope section still hold. Anything new in the threat surface (a new bridge method, a new signer kind, a new persistent surface) gets a row.
- ⬜ Maintainer and escalation contacts are current.
- ⬜ Security disclosure contact is still active; the supported-versions row reflects the current release window.
- ⬜ Contributor-facing process documentation is bumped if any contributor-facing process changed (test tiers, smoke baseline rule, version-bump rule, governance section).
- ⬜ Code of conduct reporting contact is still active.

---

## Sign-off

Release manager: ___________________________  
Date: ___________________________  
Version under test: ___________________________  
Shell(s) covered: ___________________________  
Notes / known waivers: ___________________________
