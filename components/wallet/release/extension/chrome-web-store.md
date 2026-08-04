<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/extension/docs/SUBMISSION-RUNBOOK.md @ 34639117 (worktree dirty) -->
<!-- ported 2026-08-02 from xchain-wallet/packages/extension/docs/STORE_LISTING_PACK.md @ 34639117 (worktree dirty) -->
<!-- 2026-08-03: the full operational ceremony was folded back in from those two -->
<!-- sources, by operator ruling: ceremonies are documentation, and documentation -->
<!-- has one home. The checkable steps, the commands and the published identity -->
<!-- values live here, not in the code repository. -->

# Chrome Web Store submission (browser extension)

This page is the operational ceremony for submitting the XChain Wallet browser extension to the Chrome Web Store: the ordered sequence for a first submission, from account registration through the unlisted-to-public flip, plus the listing collateral that goes into the console's forms.

**Audience:** the release operator, sitting at the Chrome Web Store developer console, doing this for the first time. Read the whole page before opening the console. Several steps below are irreversible or ordering-sensitive, and doing them out of order is not recoverable by redoing them in the right order afterwards.

**Scope:** the first submission of the main `io.xchain.wallet.extension` item. A later beta or soak lane, and any upload automation, are separate ceremonies and are not covered here.

## Submission runbook

### Ground rules

These apply to every phase below.

- **Two-factor authentication is hardware security keys or passkeys only. Never SMS, never a time-based code as a fallback.** Phished publisher accounts pushing malicious updates is the dominant real-world extension-compromise pattern (the December 2024 Cyberhaven wave was OAuth phishing of a publisher account, not a code vulnerability). Set this up before anything else in Phase 1.
- **The publisher identity grants OAuth to no third-party tool, ever.** Not a CI service, not a browser extension, not a "connect your Google account" integration, no matter how convenient. This is the same compromise class as the bullet above: an OAuth grant is a standing credential that does not show up in a password check.
- **This page never contains a real secret, credential, or recovery code.** It says where each one lives and how it is handled, never its value. If you find yourself about to paste a password, recovery code, or API key into this document (or into any document), stop; that is not what it is for.
- **Credential custody:** the developer account is a row in the release credential inventory. Per that inventory's account-hygiene rule it uses hardware-key two-factor authentication with no SMS fallback, is organization-owned rather than a personal account, and its recovery codes go into the recovery-credential store alongside the other release credentials, never into a repository, never into a chat, never into a screenshot.
- **One operator, claimed before touching the console.** The pending draft in the console is a singleton, and two people editing it clobbers silently. Before you open the console, claim this release as the named operator in the project's own release tracking.
- **Nothing in this ceremony changes version-control state.** No commit, no push, no tag. Where a step names a `git` command it is read-only.

### Phase 0: Preconditions

Confirm all of these before Phase 1.

⬜ You have read this page in full, including the listing collateral below, not just the phase you are about to run.  
⬜ The security audits, hardening work and release tooling this ceremony depends on are built and verified. Check that against the project's own release tracking, not from memory.  
⬜ You have claimed this submission as the named release operator.  
⬜ You have console access to `xchain.io` DNS or Google Search Console (or you know who does), because Phase 2's domain verification needs it. Confirm it now rather than discovering the gap mid-ceremony.  

### Phase 1: Account registration and hygiene

⬜ **Register the developer account** at **https://chrome.google.com/webstore/devconsole** (URL confirmed against Google's own documentation on 2026-08-01), signed in as the organization's existing Google publisher identity, the same account that publishes the Android listing (operator decision 2026-08-01: reuse it rather than mint a second one). That account is already identity-verified with Google under `Dankest, LLC` with a D-U-N-S number, so the trader details this listing publishes will match what the Android listing already shows, and reviewers cross-check exactly that. Check the avatar before you click anything: a browser profile signed into a different account is the easy way to register the wrong identity, and the extension ID that follows is permanent. There is a one-time registration fee (historically $5; Google's current documentation does not state the amount, so read what the console asks for before paying).  
⬜ **If the console asks for a publisher display name during signup, use `Dankest, LLC`** to match the Android listing. That field is editable later, unlike the trader details, so it is not a permanent commitment; it just avoids two stores disagreeing in the meantime.  
⬜ **The blast-radius trade this decision accepts:** one phished account now reaches both stores. That is what the group-publisher conversion in Phase 2a exists to unwind, so do not skip it before first public release.  
⬜ **Set up two-factor authentication with a hardware security key or a passkey.** Do this at registration time, before anything else touches the account. Never enable SMS or a time-based code as a "backup" option; if the console offers one, decline it.  
⬜ **Grant no OAuth access to any third-party tool from this identity.** This includes automation you may be tempted to wire up early "to save time later". Upload automation is deliberately not decided yet, and when it is, the token it uses will be scoped narrowly and reviewed, not a blanket OAuth grant to the publisher account itself.  
⬜ **Record the recovery codes into the recovery-credential store**, in the same sitting you generate them. A generated credential with nowhere durable to live is a future outage, not a future convenience.  
⬜ **Set the account's contact email to a forwarding address that lands in a monitored shared inbox.** Do not point it at a personal inbox.  

#### Prove the inbox is actually live

Compliance clocks on this account run as short as 7 days (rejection responses, policy warnings, takedown notices). An unread inbox is how a listing dies quietly rather than loudly, so prove receipt before you submit anything, not after the first rejection arrives.

⬜ From an **external** account (not anything that already forwards into the same inbox), send a test email to the console's registered contact address.  

**Done 2026-08-01, at the SMTP layer, for both addresses.** Sent from outside Google Workspace, and Google accepted both `info@dankest.llc` and `privacy@dankest.llc`, each `status=sent (250 2.0.0 OK ... gsmtp)` via `aspmx.l.google.com`. That proves the aliases exist and the path works, since a nonexistent address is refused at RCPT. **It does not prove inbox placement:** neither domain publishes SPF, so an unauthenticated message can be accepted and then filed as spam. Confirm visually, spam folder included, and treat a send from an unrelated consumer mail provider as the stronger test, because our own infrastructure carries its own reputation.

⬜ Confirm it arrives in the monitored shared inbox, and confirm someone is actually watching that inbox on a cadence shorter than 7 days.  
⬜ **Correction, measured 2026-08-01:** this runbook previously said inbound mail to `@xchain.io` depends on the outbound mail-relay work, and that was wrong. That work is the OUTBOUND relay (so cron and alert mail can leave the host); inbound is unrelated. `dig MX` shows BOTH `dankest.llc` and `xchain.io` pointing at Google Workspace (`aspmx.l.google.com` and its siblings), so either domain can receive. What MX records do not prove is that a given address resolves to a mailbox or an alias, so confirm the specific address in the mail admin console (or mail it) before you put it in the store console. Note also that neither domain publishes SPF, which is a deliverability risk for anything you send FROM them, not a receiving problem. Test whatever mailbox you are actually using today.  

### Phase 2: Account-shape changes before first submission

**Why this is a separate, ordered block:** group-publisher conversion, domain verification, and the trader declaration all happen **before** first submission, so an account-shape change never races a pending review. Doing any one of them after a submission is pending risks the review clock resetting or the listing entering an inconsistent state mid-review. Do all three now, while there is nothing in flight to race.

#### 2a. Group publisher conversion

⬜ Convert the item to a group publisher, with the group holding at least two organization identities, each with independent recovery.  

Read this before clicking anything:

- **This conversion is irreversible.** There is no console flow to convert back to a solo publisher.
- **It moves the publish credential into the Google Group itself.** Once converted, whoever administers that group, including the workspace admin sitting above it, can add a publisher to the item. You are trading "one lost login kills the extension" for "the group's admin surface is now part of the trust boundary". That is the intended trade, since it removes a single point of failure, but go in knowing what you are accepting rather than discovering it later.
- **Both group-member identities go into the credential inventory** in the same step as the conversion. A group conversion with only one member recorded has recreated the single point of failure it exists to remove.

#### 2b. Domain verification

⬜ Complete domain verification against `xchain.io` so the listing carries the verified-publisher badge before first submission.  

This is the access you confirmed in Phase 0. If you do not have it now, stop and get it before proceeding. Do not submit unverified and plan to verify later: that is exactly the "account-shape change racing a pending review" pattern this phase exists to avoid.

#### 2c. Trader declaration

The trader declaration publishes name, postal address, email **and** phone number, permanently, on the public listing. This is not reversible in the sense that matters: even if you later edit the fields, the original values were public and indexed the moment they went live. Type these exactly, transcribed from here rather than from memory. They are the same values every other store listing publishes; see [Trader identity](../../privacy/trader-identity.md) for the declaration of record.

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
| Email | `info@dankest.llc` (identical to what the Android listing publishes, and proven to receive) |
| Phone | `+1 949-510-5364` |

**Do not silently substitute a different phone number at the console.** If the published number is ever swapped for a forwarding line (a VOIP number that rings the same handset satisfies the EU Digital Services Act requirement identically, since the rule is a working means of contact, not a carrier line), that change lands on all three store listings in the same pass. One legal entity showing two different public trader contacts is exactly the inconsistency this ceremony keeps warning about, and it would be one we created ourselves.

⬜ Trader declaration submitted, matching the reconciled identity above: entity, address, email and phone.  

### Phase 3: The privacy-policy URL must be live before you open the store form

On 2026-08-01 the hosted policy URL returned **404**: the page was built, correct and deployed, but only at a staging hostname, because the apex still served an old placeholder document root. The operator flipped the apex the same day and the URL now serves the current policy, confirmed through the edge in a browser and against the origin directly. Re-confirm it yourself before you submit anyway, with the two checks below. This is exactly the kind of thing that is true on the day it is written down and false on the day someone needs it.

The canonical URL, with its trailing slash, is the one [the wallet's privacy policy](../../privacy/privacy-policy.md) publishes. Take it from there rather than retyping it, so there is only ever one copy of it.

⬜ Confirm the hosted policy URL resolves and serves the current policy:  

```bash
node tools/release/verify-privacy-url.mjs
```

Exit 0 means live, direct, carrying the current policy word for word, and with the policy's contact address readable without JavaScript. The other exit codes are deliberately disjoint: **1** the URL does not resolve, redirects, or serves a stale policy (submission is blocked, and the fix is a deploy); **2** config error, nothing was checked; **3** could not tell, which is never an all-clear; **4** live and current, but a contact address is JavaScript-gated at the edge, which is **submittable** (see below).

**Exit 4 does not block you.** It means the URL resolves and serves the current policy, which is all the store's form validates, but the CDN's email-address obfuscation is rewriting the policy's `mailto:` links, so a reviewer or regulator reading the document without JavaScript sees `[email protected]` where the GDPR and DSA contact belongs. Submit, and fix the edge setting after: either turn email-address obfuscation off for the policy path, or publish the address as plain text as well, which the obfuscator does not rewrite. The script prints both ways out when it fires.

**This step used to tell you to EXPECT exit 3 and not read it as failure, and that instruction is withdrawn.** It was true when the CDN answered non-browser clients with 403 on every path of this domain; the bot-fight setting was turned off, and as measured on 2026-08-02 a plain `curl` and this script's own fetch both get 200 and the live run exits 0. **Treat exit 3 as what it says it is: could not tell.** The withdrawn instruction was worse than merely stale, which is why it is called out rather than quietly deleted: it pre-armed you to shrug at an inconclusive verdict at the exact moment a real 404 would be producing one, and a 404 that survived every green check is precisely what happened on 2026-08-01.

Do both of the checks below anyway, because they prove different things:

1. **Load the URL in a real browser.** That is the only check that exercises the same path the store's validator will: DNS, the edge, the cache, the redirect behaviour.
2. **Check the bytes against the repository**, by fetching the origin directly and feeding the result back in:

```bash
# POLICY_URL is the canonical policy address, taken from the policy page
# itself, trailing slash included, never retyped from memory.
curl -sS -o /tmp/policy.html --resolve xchain.io:443:<origin-ip> "$POLICY_URL"
node tools/release/verify-privacy-url.mjs --html /tmp/policy.html
```

That second one bypasses the edge on purpose, so it proves the deployed page is the current policy and says nothing about reachability, about a stale edge cache, or about the contact-address obfuscation above. The script declines to give a contact verdict on `--html` bytes for that reason, rather than answering confidently from evidence that cannot see the edge. Neither check subsumes the other.

**Why the trailing slash matters:** the hosted page is generated from [the wallet's privacy policy](../../privacy/privacy-policy.md) by the website build, and the site's canonical URL carries a trailing slash. Paste the canonical form with the slash, not the slashless one, to avoid a redirect hop under review. The script treats a redirect as a failure for the same reason, and names the destination so you can paste that instead.

**Content drift is covered from both ends, and you should confirm both.** The hosted page and this documentation set are two copies of one source; a drift between them is the exact mismatch-rejection pattern that has already been found once. In the website repository, run its build and confirm its privacy-policy sync test passes, which proves the CHECKED-IN page matches. The script above proves the DEPLOYED page matches, which is a different claim: a repository can be correct and the deploy stale.

⬜ Hosted policy confirmed live and in sync with [the wallet's privacy policy](../../privacy/privacy-policy.md) at the version you are about to submit.  

### Phase 4: Build artifact provenance (the zip you upload)

**The uploaded artifact is exclusively the CI-emitted `xchain-wallet-extension-vX.Y.Z.zip`. Never a locally built zip.** The wallet's shared working tree has a documented incident class of a build carrying a neighbour's uncommitted edits; the post-publish verification would only catch that days later, after review, with the bad build already live. Do not build the extension on your own machine and zip the result for upload; that build is not the one this ceremony verifies.

#### 4a. Get the CI artifact

The `.github/workflows/release.yml` tag workflow builds the extension zip and leaves it as a run artifact named `unsigned-web-extension`. It does not publish or sign anything itself. The release maintainer already downloaded it from the run matching the tag commit and staged it into `release-artifacts/vX.Y.Z/` as part of the normal release procedure. Confirm that staging happened for the tag you are about to submit:

```bash
ls release-artifacts/vX.Y.Z/xchain-wallet-extension-vX.Y.Z.zip
ls release-artifacts/vX.Y.Z/RELEASE_HASHES.txt
head -4 release-artifacts/vX.Y.Z/RELEASE_HASHES.txt
```

If either file is missing, stop; go back to the release procedure, not around it. Submitting a zip you built or found without a signed manifest behind it defeats the entire provenance chain this phase exists to enforce.

**Read the header, do not just confirm the filename exists.** The two `ls` lines above pass on a manifest that cannot possibly satisfy the next step, and that is not hypothetical: a locally recomputed manifest is named `RELEASE_HASHES.txt` exactly like a release one. The header tells them apart:

⬜ The header says `# tag: vX.Y.Z`, naming the tag you are submitting. **If it says `# tag: (none)`, this is a local recompute, not a release manifest, and it cannot be uploaded.** A recompute proves a zip matches itself; it says nothing about which release the zip is. Verifying with `--tag` will refuse it (`manifest describes '(none)' but you expected ...`), and verifying without `--tag` will also refuse it (`cannot tell which release this manifest is for`). Both refusals are correct. Neither is a tool fault, and neither means you may proceed.  
⬜ The header says `# dev-mock-gate:` something other than `not-run`.  

If you have a recompute rather than a release manifest, the artifact you need has not been produced yet. That is a release-engineering blocker upstream of this ceremony, not something to work around here: the store assigns a permanent extension ID to whatever you upload first.

#### 4b. Check the sha256 before upload

```bash
bash tools/release/verify.sh --input release-artifacts/vX.Y.Z/ \
  --tag vX.Y.Z --artifact xchain-wallet-extension-vX.Y.Z.zip
```

Confirm it reports the hash as OK, and the signature as OK too. This is the same command the [release QA checklist](../qa-checklist.md) asks for in its store-release provenance section; this page does not duplicate that checklist, it points at the one command you need at this exact moment.

**This phase cannot be completed before the release-signing key exists, and that is a stronger statement than it used to make here.** This page said until 2026-08-03 that only the SIGNATURE waited on the key ceremony, implying the hash could be checked today. It cannot, and the reason is worth stating so nobody burns a day rediscovering it: the tagged manifest and the signature come from the same command. Only the signing step writes a `RELEASE_HASHES.txt` that names a tag; the unsigned fallback (`verify.sh --recompute`) deliberately stamps `# tag: (none)`, which 4a above rejects and which `verify.sh` itself then refuses in both directions. The release runners hold no signing key by design, so CI cannot supply one either. Until the key ceremony lands there is no artifact this phase can accept, and therefore no upload in Phase 6.

⬜ `verify.sh` reports the zip's hash as OK against `RELEASE_HASHES.txt`.  
⬜ The checked sha256 is ready to record in the publish log. That row is written in the same step as the actual upload (Phase 6), not before it.  

### Phase 5: Fill in the store listing form

Everything paste-ready lives in [Listing collateral](#listing-collateral) below. This phase tells you which console field takes which section.

| Console field | Source |
|---|---|
| Single purpose | [Single-purpose statement](#single-purpose-statement) |
| Permission justification, per permission (`storage`, `sidePanel`, `notifications`, `alarms`, content script, `web_accessible_resources`) | [Permission justifications](#permission-justifications) |
| Content-script / host-permission justification | [Content script and injected-provider justification](#content-script-and-injected-provider-justification) |
| Listing name, summary, full description | [Listing copy](#listing-copy) |
| Screenshots (1280x800 popup, side panel, sign approval) and small promo tile (440x280) | [Listing assets](#listing-assets) |
| Category and final name | [Category and name](#category-and-name) |
| Privacy-policy URL | The canonical URL from [the wallet's privacy policy](../../privacy/privacy-policy.md); confirm it is still live right before you paste it (Phase 3) |
| Privacy practices: remote code, and the data-usage checkboxes | [The extension's data-disclosure answers](../../privacy/data-disclosure.md), which answer the whole tab field by field |

⬜ Single-purpose, permission justifications, and content-script justification pasted from the collateral below.  
⬜ Listing name and description pasted. The name is **`XChain Wallet`**, and it must equal `manifest.json`'s own `name`, which a smoke enforces.  
⬜ Four listing assets uploaded from `packages/extension/docs/listing-assets/`.  
⬜ Remote-code answer and the data-usage categories ticked from the [data-disclosure answers](../../privacy/data-disclosure.md), and every category the console shows that the disclosure does not name recorded back into it before submitting.  
⬜ Privacy-policy URL field set to the canonical hosted address.  
⬜ Category and name fields filled from [Category and name](#category-and-name).  

**Before ticking any data-usage box, re-measure.** The wallet does not collect user data, and that is a measured fact rather than a position: the first-party API hosts sit behind a proxy and retain no visitor IP address, and the one log that carries wallet addresses is kept for a day. Two ordinary administrative changes would silently make the answer false again (enabling a real-client-IP module on the API hosts, or moving the explorer access log back under the default rotation). The [data-collection record](../../privacy/data-collection.md) is the declaration all three store forms are transcribed from; confirm it is still true before you answer.

⬜ Re-measured: the access-log configuration and retention on the three first-party API hosts still match the [data-collection record](../../privacy/data-collection.md).  

All three store forms answer "not collected", together, and a smoke fails if they ever stop agreeing.

**The support-email and trader-declaration fields on this form are the same declaration as Phase 2c.** Transcribe the same values; do not re-source them.

### Phase 6: First upload

⬜ Upload `xchain-wallet-extension-vX.Y.Z.zip` from `release-artifacts/vX.Y.Z/` (the file you hash-checked in Phase 4, not a re-download, not a re-build).  
⬜ **Set visibility to UNLISTED, not public.** This is the first-submission rule: the listing is installable only via a direct link until every exit criterion in Phase 8 passes.  
⬜ Submit for review.  

#### Immediately after upload

⬜ **Record the assigned extension ID.** Chrome assigns this 32-character (`a` to `p`) hash at first upload, and it is permanent: losing the account means losing the ID, and every installed user is orphaned with no update path. There is no retry on this one; write it down correctly the first time.  
⬜ Add the extension ID to the release credential inventory row for this account.  
⬜ Add it to the [dApp bridge documentation](../../bridge.md), wherever it documents `chrome-extension://<id>/...` for integrators (currently a placeholder `<id>`), so provider-detection guidance stops being hypothetical.  
⬜ **Append the publish-log row**, in the same sitting as the upload, not later: version, the zip sha256 from Phase 4b, item (`main`, since this is the first submission), operator, date. Follow the format already scaffolded in `packages/extension/docs/publish-log.md`; its current row is a labelled example, and the replace-with-a-real-entry conventions are documented at the top of that file.  

### Phase 7: While the review clock runs

Expect days for a new wallet listing; budget two weeks. This is a waiting phase, not an idle one.

⬜ If any correspondence arrives (a question, a warning, a rejection), log it in the operator's correspondence log, in full, **before** responding. Respond via the console's appeal or reply flow. Never resubmit blind: read the reviewer's stated reason, check it against the existing justification language in [Listing collateral](#listing-collateral) first, and reuse language a reviewer has already accepted where it applies.  
⬜ If the review rejects the submission, fix the specific finding, log the outcome and the follow-up action taken in the correspondence log, and resubmit through the same unlisted-first path. Phase 2's ordering rule applies to a resubmission too: if any account-shape change is pending when a resubmission goes in, that is the exact race this ceremony was built to avoid.  

### Phase 8: Exit criteria before the public flip

Do not flip visibility to public until every item below is checked. These are concrete and checkable, not a vibe.

⬜ Installed from the store link (the unlisted item's direct URL, not a sideload) on at least 2 machines.  
⬜ A patch version published and observed auto-updating on both of those machines within 24 hours, **measured from the patch showing as PUBLISHED in the console**, not from when it was uploaded; its own review clock sits in between the two.  
⬜ Connect and sign driven end to end against the sample dApp (see [Testing with the sample dApp](test-dapp-runbook.md)), from the **store-installed** build specifically, not a local development build. This matters because a development server can silently substitute a mock SDK; only a store-installed build proves the real signing path.  

> **Serve the sample dApp on the machine you are testing from.** These two criteria combine into a trap: "at least 2 machines" invites pointing the second machine at the first one's static server by LAN address, and `http://192.168.x.x:5500` is neither `localhost` nor `127.0.0.1`, so the content script does not run there. `window.xchain` never appears and it reads exactly like a wallet bug, which is a symptom this scope decision has already produced once. Run the server on each machine, or put it behind TLS. Do not widen the manifest to make a test setup work: `test/smoke/audits/extension-provider-origins.smoke.js` will fail, and widening triggers a store re-review and can disable the extension for installed users until they re-accept.

⬜ **The store-version monitor is live.** The script exists (`tools/release/store-version-monitor.mjs`, gated by `test/smoke/audits/store-version-monitor.smoke.js`). What does not exist yet is the running job, and that is what this box is about. Two things are still missing and both come out of this ceremony: the item ID (Chrome assigns it at first upload, Phase 6) and an operator running the install documented in `tools/release/README.md`. Do not flip to public before it is running: this monitor is what turns a rogue or compromised publish into a same-day alert instead of a silent one, by reading the publish log against the live store version. Confirm its scheduled job is actually installed and has fired at least once before treating this box as checked, not merely that the script exists. **The script itself refuses to be mistaken for a running check:** with no item ID set it exits 2 (config error), never 0, precisely so a job that never really ran cannot read as an all-clear.  
⬜ **All boxes above checked** before flipping visibility to public.  

Once public: the store's staged-rollout percentage is not available to this listing yet (Chrome requires more than 10,000 users for that). Every subsequent release soaks in the beta lane first, which is a separate ceremony from this one.

### What this runbook deliberately does not cover

- **Rollback.** There is no rollback lever on the Chrome Web Store; a previous version can never be re-served. If you need one, read `tools/release/rollback-rerelease.sh`'s own header first, then the incident runbook's emergency-levers section, before reaching for the script during an actual incident. The recipe is prepared and gated by `test/smoke/audits/rollback-rerelease.smoke.js`, so nothing about it is outstanding; it is simply a different ceremony, run under different conditions, and it is the slow path in every case.
- **Post-publish byte verification.** Once you are live, `tools/release/verify-store.sh` checks the store-served item against the signed reference (required at first publish, and after any account-security event). Its usage and flags are documented in its own header; this page does not repeat them, since the command differs by whether you have an unpacked install directory or a raw CRX.
- **Store API upload automation.** Not decided. Nothing here assumes it exists.
- **A second unlisted item for a beta-lane soak.** A separate setup ceremony once decided.

### What this runbook could not verify

- **Exact console menu paths and field labels** (where "convert to group publisher" or "trader declaration" literally live in the current console UI). Google changes this console's layout without much notice. Treat every console-navigation instruction above as "this feature exists and works this way", not as "click here". Confirm the actual click path against the live console at the time; if a described feature seems to have moved or been renamed, that is more likely a console change than an error here, but stop and re-verify rather than assuming.
- **Whether the console still requires the trader declaration in the same form step as the support email.** It is a forced declaration; the exact field ordering could not be confirmed.
- **The precise wording the review process uses for a domain-verification failure or a group-conversion prompt.** Treat Phase 2 as the sequencing rule (what must happen before what), not a transcript of console copy.

## Listing collateral

This is the paste-ready copy for the console's submission form: the single-purpose statement, a permission-justification paragraph per permission, the content-script and injected-provider justification, and the listing copy. It is kept here, not typed fresh into the console each time, so a resubmission after a rejection reuses language a reviewer has already seen rather than improvising new wording under time pressure. Whenever a permission, the content-script match list, or the single-purpose statement changes, update this page in the same change.

`test/smoke/audits/extension-listing-pack.smoke.js` holds this collateral to `packages/extension/manifest.json` and to [the wallet's privacy policy](../../privacy/privacy-policy.md): editing a permission, the content-script match list, the listing name, the summary or an asset size in one place and not the others fails the wallet's smoke suite. What it cannot check is whether the prose is persuasive; that is still a human read.

The canonical item name is `io.xchain.wallet.extension`, matching the desktop, Android and iOS item names. It is not the store's extension ID (Chrome assigns that at first upload) and it is not the listing's display name, so it does not get pasted into any console field.

### Single-purpose statement

Paste into the console's "Single purpose" field:

> XChain Wallet lets a user hold and move XChain Platform assets (Bitcoin, Dogecoin, Litecoin, and their XChain-issued tokens) self-custodially from within the browser, and sign XChain actions on behalf of dApps the user explicitly connects to.

Everything below is justified against this one sentence: if a permission does not serve holding or moving coins and tokens, or signing for a connected dApp, it should not be in the manifest.

### Permission justifications

One paragraph per permission, written for the reviewer who reads the console's permission-justification field: what it does, why the single purpose above requires it, and what it explicitly does not do. These mirror the privacy policy's "Permissions and what they are used for" section, and the two must stay in sync; a reviewer who reads both against each other is exactly the failure mode this collateral exists to avoid.

**`storage`**
The wallet stores your encrypted seed and keys, your addresses and settings, and the list of dApp origins you have approved, all in `chrome.storage.local`, entirely on your device. The single purpose requires persisting a self-custodial wallet across browser restarts; without `storage` the wallet could not remember your accounts or your dApp approvals between sessions. It is not used for analytics, tracking, or any data that leaves the device.

**`sidePanel`**
Lets the user open the wallet in the browser's side panel as an alternative to the toolbar popup, so the wallet UI can stay visible next to the page being used. It shows and operates on exactly the same on-device wallet state as the popup; it is a second UI surface for the same single purpose, not a new capability or a new data source.

**`notifications`**
Delivers a native browser notification for a background wallet event the user configured (a price alert, a governance-poll update, a payment deadline, a dispenser-escrow event) so the user sees it even when the popup is closed. This directly serves "moving assets": several of these events are time-sensitive and the wallet has no server component to push through instead. Notification content is generated on-device from data already on-device; nothing about the notification is sent anywhere.

**`alarms`**
Chrome shuts down an idle Manifest V3 service worker after roughly 30 seconds. `alarms` schedules a wake-up roughly every 24 seconds so the wallet's background worker, and the watchers described above (price and notification polling, the auto-lock timer), keep running. Without it, background notifications and the auto-lock safety timer would silently stop working between user interactions. It is purely a scheduling primitive; it collects and transmits nothing itself.

**Content script** (see the content-script justification below; it and the injected provider are one mechanism and are justified together).

**`web_accessible_resources`**
Exposes two static asset sets to pages that request them: the injected provider bundle, which is the file the content script loads to give a page `window.xchain`, and a set of chain-icon images that a connected dApp can use to render a recognizable icon for the coin it is dealing with. Both are read-only static files shipped in the extension bundle; neither carries wallet data, and neither is writable by the page.

### Content script and injected-provider justification

Paste into the console field that asks about the content-script / all-sites justification:

> XChain Wallet is a browser-extension crypto wallet in the same family as other browser wallets: any website can be a "dApp" that wants to request a connection, so the content script runs on secure origins (`https://*/*`) to inject a `window.xchain` provider object that a page's own script can call. It additionally runs on `http://localhost/*` and `http://127.0.0.1/*` so that developers building against the wallet can test on a local server. It deliberately does NOT run on other plain-HTTP origins: on a page served without TLS an on-path attacker can rewrite the page and impersonate the dApp, so the wallet declines to offer a provider there at all rather than relying on the user to notice.
>
> The provider does not read page content. It only relays requests a page's script explicitly makes to it (account address requests, transaction and action signing requests) to the wallet's background service worker over an isolated message channel, and relays the wallet's response back.
>
> No page gets anything from a connected wallet without the user approving that specific site first. This is the extension's connected-sites model: the first time a page calls the provider, the wallet shows a connection-approval prompt naming the requesting origin; only origins the user has approved receive account data or signing prompts, and the user can revoke a site's approval at any time from the wallet's settings. Injection alone (the content script running, the provider object existing on the page) grants a page nothing: it establishes a channel, not access.

The narrow scope above is what the manifest ships, not a promised mitigation. If anyone ever proposes widening these matches back out, note that widening triggers a store re-review and can disable the extension for installed users until they re-accept, and that the manifest-freeze gate will fail the release build first.

### Listing copy

Every feature claim below was checked against the shipped code rather than assumed: the side panel (the `sidePanel` permission plus `sidepanel.html`, confirmed live in the captured screenshot), per-site connect approval (the site gate in `packages/extension/src/bridge/handlers.js`), plain-language review before signing (the signing screen's intent panels; the raw hex view is developer-mode only), and signer support. Signer support in particular: the extension ships Ledger over WebHID plus software signing only, and Trezor is intentionally not offered in this shell, so the description says exactly that and makes no Trezor claim.

**Name:** XChain Wallet

It must equal `manifest.json`'s `name`, because the store takes the listing title from the package. A smoke fails if the two ever differ, so do not retype it at the console from memory.

**Summary (132-character limit):**

> Self-custodial wallet for Bitcoin, Dogecoin, Litecoin, and XChain assets. Connect to dApps and sign right from your browser.

The summary was measured at 124 characters at submission time, within the limit, and it is re-measured by the smoke rather than trusted.

**Full description (plain language, per the wallet documentation voice):**

> XChain Wallet is a self-custodial browser wallet for Bitcoin, Dogecoin, Litecoin, and the tokens issued on the XChain Platform. "Self-custodial" means your keys stay on your device: XChain Wallet never sees your seed phrase, never holds your funds, and there is no account to lose access to.
>
> With XChain Wallet you can:
>
> - Hold and send Bitcoin, Dogecoin, Litecoin, and XChain-issued tokens
> - Connect to XChain dApps from your browser, one site at a time, with your explicit approval before any site can see an address or ask for a signature
> - Sign with a software-derived key or a paired Ledger hardware wallet
> - Review every transaction before you approve it, in plain language, not raw hex
> - Use the side panel to keep your wallet visible while you browse
>
> XChain Wallet stores nothing about you on a server because it doesn't have one: no accounts, no analytics, no tracking. See the privacy policy for the full detail on what stays on your device and what leaves it (and why).

### Listing assets

The four uploaded files live in `packages/extension/docs/listing-assets/`, generated by `packages/extension/scripts/capture-listing-screenshots.mjs` so the next person can regenerate them against a changed UI instead of retaking them by hand. Every one uses the demo wallet: synthetic balances, no real address holding real funds.

✅ Screenshot 1280x800: popup view. Demo wallet ("Try in demo mode"), Mainnet, Home and Coins tab: synthetic BTC, LTC and DOGE balances only, no real address visible on this screen.  
✅ Screenshot 1280x800: side panel view. Same demo wallet, Tokens tab, showing the demo dataset's EXAMPLE ("Example Token") and PEPECREATURE ("Pepe Creature") tokens among others.  
✅ Screenshot 1280x800: sign-approval view. A `signMessage` approval window, driven end to end from a fake demo dApp origin (served locally by the capture script, never a real site) through the real injected-provider, content-script, service-worker and approval-broker route: connect, then request a message signature. It shows the demo wallet's own freshly generated, unfunded address as signer. The other two password-gated approval kinds both need a funded wallet, which the throwaway demo wallet deliberately never has; `signMessage` needs no funds, only a key, and is a genuine approval surface, so it covers this row.  
✅ Small promo tile 440x280: brand logo and wordmark on the accent gradient from `packages/core/src/ui/tokens.css`; no wallet data at all.  
✅ Every asset's pixel dimensions are re-read from the PNG headers by the listing-pack smoke, because a screenshot regenerated at a changed viewport is rejected by the store's upload form days into a review clock.  

### Category and name

✅ Category: **Productivity**, under the **Tools** subcategory. This is where comparable browser wallets sit, it needs no explanation under review, and the single-purpose statement already reads as a tool. The console's own taxonomy is the authority on the exact wording of the two levels: if it offers something other than a `Tools` subcategory under `Productivity`, pick the nearest and record what you actually chose here, rather than assuming this page was right about a menu it cannot see.  
✅ Final store name: **`XChain Wallet`**, which is also `manifest.json`'s `name`.  
✅ Support email: **`info@dankest.llc`**, matching what the Android listing publishes, and proven to receive. Publisher display name: **`Dankest, LLC`**.  

### Privacy practices

Use [the extension's data-disclosure answers](../../privacy/data-disclosure.md) for the remote-code question and the data-usage checkboxes, and [the wallet's privacy policy](../../privacy/privacy-policy.md) for the URL the privacy-policy field takes.
