<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/mobile/docs/PRIVACY_NUTRITION_LABELS.md @ 34639117 (worktree dirty) -->

# App Store privacy nutrition labels (iOS)

This page mirrors the App Store privacy nutrition label published for the iOS app. The label, the [privacy policy](privacy-policy.md) and the traffic the app actually generates all have to say the same thing, so these answers are derived from what the app calls, never from what it was meant to call. The Google Play equivalent is [Data safety](data-safety.md).

## What the app contacts, in the terms Apple asks about

On iOS, at default settings, the app automatically contacts:

| Host | Party | What leaves the device |
|---|---|---|
| `explorer.xchain.io` | first | the wallet addresses being queried, and the IP |
| `encoder.xchain.io` | first | addresses, amounts and ticks for the transaction being built, and the IP |
| `hub.xchain.io` | first | the IP only (signed config snapshot) |
| `api.coingecko.com` | third | the IP, and that a wallet is in use. Off in Settings under Privacy. Never called on test networks |
| a host the token issuer chose, plus `ipfs.io` / `arweave.net` | third | the IP, and which token was opened. Off in Settings under Privacy |

Three things that appear on the Android form or in the privacy policy are deliberately not on this list, each for a structural reason:

- **Block-explorer icons** (`mempool.space`, `blockstream.info`, `litecoinspace.org`, `blockchair.com`, `blockcypher.com`). The privacy policy discloses these load with no way to switch them off; that is true of the browser extension. On iOS, the app's content security policy admits no remote image origin at all, so the app never makes this request.
- **Remote token media of any kind.** Same restriction for images; audio and video have no route to load remotely either. The token's metadata document is still fetched, which is why the issuer-chosen host above is on the list and the media hosts are not.
- **The update feed** (`downloads.xchain.io`). An in-app "a newer version exists" notice is an App Store policy question rather than a preference, and the iOS app does not implement the native support the check needs. It is not reached on this shell.

## The fact that decides the whole form

Apple's definition of "collect" is transmitting data off the device and keeping it longer than needed to service the request in real time.

The wallet's first-party API hosts sit behind Cloudflare, which means the address our own servers log is Cloudflare's, not the visitor's: measured across a full day of traffic, the overwhelming majority of distinct source addresses in each log fell inside Cloudflare's published ranges. **No wallet user IP is retained**, so nothing links an address to a person.

Only `explorer.xchain.io` carries wallet addresses in its request lines, and that log has one-day retention. `encoder.xchain.io` takes addresses in request bodies, which are not logged, and `hub.xchain.io` carries none.

On Apple's definition, which turns on retention beyond servicing the request, the honest label is **Data Not Collected**.

Cloudflare still sees and logs the visitor's IP address at its own network edge, under its own policy. That is disclosed as a third-party contact; it is not our retention.

## Form answers

### Tracking

**Does this app track users? No.** Nothing is linked to third-party data for advertising or measurement, no data goes to a data broker, and there is no analytics or attribution SDK in any shell. The App Tracking Transparency prompt is not required and is not shown.

### Data types

Every row below is filled in on the "not collected" basis the measurement above establishes.

| Apple data type | Collected | Why |
|---|---|---|
| Other Financial Info | No | Balance and history queries carry wallet addresses, and building a transaction carries addresses, amounts and ticks, but that is the request being serviced. Nothing is retained beyond it: `encoder.xchain.io` logs no addresses at all, and `explorer.xchain.io`'s request lines are kept one day with no client IP beside them. |
| Other Data Types | No | No client IP is retained: our logs record a Cloudflare edge address, not a visitor's. Third parties do see the requesting IP for coin statistics (CoinGecko) and token information (an issuer-chosen host), both user-disableable in Settings under Privacy, and both disclosed in the privacy policy. |
| Contact Info | No | No name, email, phone or address is asked for or held. There is no account. |
| Health & Fitness | No | |
| Payment Info | No | Nothing is sold in the app. There is no in-app purchase, no card, no fiat on-ramp. |
| Location | No | No location permission is declared. |
| Sensitive Info | No | |
| Contacts | No | The address book is local. No contacts permission is declared. |
| User Content | No | Encrypted on-chain messages are user to user; we hold no copy and no key. Photos are never read: the camera decodes QR frames live and stores nothing. |
| Browsing History | No | |
| Search History | No | |
| Identifiers | No | No user ID, no device ID, no advertising identifier is read or sent. |
| Purchases | No | |
| Usage Data | No | No product-interaction or advertising data is collected. |
| Diagnostics | No | No crash or performance SDK. |

### Export compliance

`ITSAppUsesNonExemptEncryption` is set to **No** in the app's configuration, under the standard exemption: the app uses TLS and standard, published cryptography (secp256k1 signing, AES-256-GCM at rest, Argon2id, and standard ECDH for messaging) and implements no proprietary algorithm. Full detail is in [Export compliance](export-compliance.md).

## Decision: retention on the first-party API hosts

The app's data-collection posture depends on whether the API hosts (`explorer.xchain.io`, `encoder.xchain.io`, `hub.xchain.io`) retain client IP addresses. As measured on the live hosts, none of the three retains a visitor's IP address, because each sits behind a reverse proxy that logs its own address rather than the caller's. The only address-bearing log is `explorer.xchain.io`'s, and it now retains request lines, including wallet addresses, for one day before deletion. On that basis the honest label on both Apple's and Google's forms is "not collected", and the two forms agree with each other and with the Chrome Web Store's [data disclosure](data-disclosure.md).
