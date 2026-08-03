<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/extension/docs/SUBMISSION-RUNBOOK.md @ 34639117 (worktree dirty) -->
<!-- ported 2026-08-02 from xchain-wallet/packages/extension/docs/STORE_LISTING_PACK.md @ 34639117 (worktree dirty) -->

# Chrome Web Store submission (browser extension)

This page covers submitting the XChain Wallet browser extension to the Chrome Web Store: the operational sequence for a first submission, and the listing collateral that goes into the store's console forms.

## Submission runbook

### Ground rules

- Two-factor authentication on the publisher account is a hardware security key or a passkey, never SMS or an authenticator app as a fallback. Phished publisher accounts pushing a malicious update is the dominant real-world extension-compromise pattern, so this is set up before anything else touches the account.
- The publisher identity never grants OAuth access to a third-party tool, a CI service, or a "connect your account" integration, no matter how convenient. An OAuth grant is a standing credential that does not show up in a routine password check.
- Credentials, recovery codes, and API keys are never written into this documentation, a chat log, or a screenshot. This document says where each one lives and how it is handled, never its value.
- A pending submission has exactly one operator. The console's draft listing is a singleton; two people editing it at once clobbers silently.

### 1. Register the developer account

Register with an organization-owned identity, not a personal account, and check the signed-in profile before clicking anything: the extension ID assigned at first upload is permanent, so registering under the wrong identity cannot be undone by re-registering later.

- Set up hardware-key or passkey two-factor authentication at registration time, before anything else.
- Grant no OAuth access to any third-party tool or automation from this identity.
- Record recovery codes into a secure, durable credential store in the same sitting they are generated.
- Point the account's contact email at a monitored shared inbox, never a personal one.

Prove the inbox is actually live before relying on it: compliance windows on a publisher account (a rejection response, a policy warning, a takedown notice) can be as short as seven days, so an unread inbox is how a listing dies quietly. Send a test message from an account that does not already forward into the same inbox, and confirm it arrives, spam folder included, on a cadence shorter than a week.

### 2. Account-shape changes before first submission

Complete these changes before the first submission goes in. Doing any of them after a submission is pending risks the review clock resetting or the listing entering an inconsistent state mid-review.

**Group publisher conversion.** Converting a solo publisher account to a group publisher is irreversible; there is no console flow back to a solo publisher. It moves the publish credential to a group with at least two independently-recovered member identities, trading a single point of failure in one login for a group's own admin surface becoming part of the trust boundary. That trade is deliberate: go in knowing what is being accepted, not discovering it later.

**Domain verification.** Complete domain verification against the project's own domain so the listing carries the verified-publisher badge before first submission.

**Trader declaration.** The EU Digital Services Act requires a trader declaration: legal entity name, business postal address, contact email, and phone number, published permanently and publicly on the listing. This is not reversible in the sense that matters: even after editing the fields later, the original values were public and indexed the moment they went live. Use the same contact details across every store listing (Chrome, the Android store, and the iOS store); one legal entity showing different public contacts on different listings is exactly the kind of inconsistency a reviewer or a regulator notices.

### 3. Confirm the privacy policy is live

The privacy-policy URL must resolve, serve the current policy, and not redirect, before the store form can be completed: a redirect under review can fail the store's own validator. See [the wallet's privacy policy](../../privacy/privacy-policy.md). Confirm the URL in a real browser (the same path the store's validator takes) and check that any contact address the policy publishes is readable without JavaScript; an edge-level rewrite of a `mailto:` link can leave a machine-readable address unreadable to a plain fetch even while the page itself is live and current.

### 4. Build artifact provenance

The uploaded package is exclusively a CI-built, hash-verified release artifact, never a locally built one. Confirm the artifact's hash against the published release manifest before uploading.

### 5. Fill in the store listing form

Use the listing collateral below for each field: single purpose, permission justifications, content-script justification, listing name and description, screenshots and promo tile, category, and privacy practices. See [the extension's data-disclosure answers](../../privacy/data-disclosure.md) for the privacy-practices tab (remote code and the data-usage checkboxes).

### 6. First upload

- Upload the verified release artifact.
- Set visibility to **unlisted**, not public. This is the first-submission rule: the listing stays installable only via a direct link until the exit criteria below all pass.
- Submit for review.
- Record the assigned extension ID once Chrome assigns it at first upload. It is permanent: losing the account means losing the ID, and every installed user is orphaned with no update path.
- Log the submission (version, artifact hash, date) for the record.

### 7. While the review clock runs

Expect the review to take days; budget for a couple of weeks on a first submission. If any correspondence arrives (a question, a warning, a rejection), log it in full before responding, and reuse language a reviewer has already accepted where it still applies rather than improvising new wording under time pressure. If the review rejects the submission, fix the specific finding and resubmit through the same unlisted-first path; the account-shape-change ordering above still applies to a resubmission.

### 8. Exit criteria before the public flip

Do not flip visibility to public until:

- The extension has been installed from the store's direct link on at least two machines.
- A patch release has been published and observed auto-updating on both machines within 24 hours of the patch showing as published in the console.
- Connect-and-sign has been driven end to end against a sample dApp (see [Testing with the sample dApp](test-dapp-runbook.md)) from the **store-installed** build specifically, not a local development build. A development server can silently substitute a mock SDK, so only a store-installed build proves the real signing path.
- A store-version monitor is running, so a rogue or compromised publish reads as a same-day alert instead of a silent one.

Once public, every subsequent release soaks in a beta lane before promotion. This document covers only the first submission of the main listing.

### What this runbook does not cover

- **Rollback.** The Chrome Web Store has no rollback lever; a previous version can never be re-served once superseded.
- **Post-publish byte verification.** Comparing the store-served item against the signed release reference is a separate, later step.
- **Store API upload automation.** Every upload described here is a human at the console.

## Listing collateral

### Single-purpose statement

Paste into the console's "Single purpose" field:

> XChain Wallet lets a user hold and move Bitcoin, Dogecoin, Litecoin, and their XChain-issued tokens self-custodially from within the browser, and sign XChain actions on behalf of dApps the user explicitly connects to.

Every permission below is justified against this one sentence: if a permission does not serve holding or moving coins and tokens, or signing for a connected dApp, it has no place in the manifest.

### Permission justifications

**`storage`**
The wallet stores an encrypted seed and keys, addresses and settings, and the list of approved dApp origins, entirely on-device. The single purpose requires persisting a self-custodial wallet across browser restarts; it is not used for analytics, tracking, or any data that leaves the device.

**`sidePanel`**
Lets the wallet open in the browser's side panel as an alternative to the toolbar popup, so the wallet stays visible next to the page in use. It operates on exactly the same on-device wallet state as the popup: a second UI surface for the same single purpose, not a new capability or a new data source.

**`notifications`**
Delivers a native browser notification for a background wallet event the user configured (a price alert, a governance-poll update, a payment deadline, an escrow event) so it is seen even when the popup is closed. Notification content is generated on-device from data already on-device; nothing about it is sent anywhere.

**`alarms`**
A Manifest V3 background service worker is shut down by the browser after roughly 30 seconds of idle time. This permission schedules a periodic wake-up so the background watchers above, and the wallet's auto-lock timer, keep running. It is purely a scheduling primitive: it collects and transmits nothing itself.

**Content script** (see the content-script justification below).

**`web_accessible_resources`**
Exposes two static asset sets to pages that request them: the injected-provider bundle that gives a page `window.xchain`, and a set of chain-icon images a connected dApp can use to render a recognizable icon for the coin it is dealing with. Both are read-only static files shipped in the extension bundle; neither carries wallet data, and neither is writable by the page.

### Content script and injected-provider justification

Paste into the console field asking about the content-script / all-sites justification:

> XChain Wallet is a browser-extension crypto wallet in the same family as other browser wallets: any website can be a "dApp" that wants to request a connection, so the content script runs on secure origins (`https://*/*`) to inject a `window.xchain` provider object that a page's own script can call. It additionally runs on `http://localhost/*` and `http://127.0.0.1/*` so that developers building against the wallet can test on a local server. It deliberately does not run on other plain-HTTP origins: on a page served without TLS an on-path attacker can rewrite the page and impersonate the dApp, so the wallet declines to offer a provider there at all rather than relying on the user to notice.
>
> The provider does not read page content. It only relays requests a page's script explicitly makes to it (account address requests, transaction and action signing requests) to the wallet's background service worker over an isolated message channel, and relays the response back.
>
> No page gets anything from a connected wallet without the user approving that specific site first. The first time a page calls the provider, the wallet shows a connection-approval prompt naming the requesting origin; only origins the user has approved receive account data or signing prompts, and a site's approval can be revoked at any time from the wallet's settings. Injection alone grants a page nothing: it establishes a channel, not access.

### Listing copy

**Name:** XChain Wallet

**Summary (132-character limit):**

> Self-custodial wallet for Bitcoin, Dogecoin, Litecoin, and XChain tokens. Connect to dApps and sign right from your browser.

**Full description:**

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

- Popup screenshot, 1280x800: the demo wallet's home view showing synthetic coin balances.
- Side panel screenshot, 1280x800: the demo wallet's token view.
- Sign-approval screenshot, 1280x800: a message-signing approval window, driven end to end through the real injected-provider path from a sample dApp origin, using the demo wallet's own freshly generated, unfunded address.
- Small promo tile, 440x280: brand mark and wordmark, no wallet data.

Every screenshot uses the demo wallet: synthetic balances, no real address holding real funds, and no data that leaves the device.

### Category

Productivity, under the Tools subcategory (or the nearest equivalent the console's own taxonomy offers).

### Privacy practices

Use [the extension's data-disclosure answers](../../privacy/data-disclosure.md) for the remote-code question and the data-usage checkboxes, and [the wallet's privacy policy](../../privacy/privacy-policy.md) for the privacy-policy URL field.
