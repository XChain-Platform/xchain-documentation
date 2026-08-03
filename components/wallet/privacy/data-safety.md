<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/mobile/docs/DATA_SAFETY.md @ 34639117 (worktree dirty) -->

# Google Play Data safety (Android)

This page mirrors the Data safety declaration published for the Android app on Google Play. The form, the [privacy policy](privacy-policy.md) and the app's actual network traffic all have to agree, so these answers are derived from what the app calls, not from what it is intended to do.

## Endpoints the app contacts

| Endpoint | Why | What leaves the device |
|---|---|---|
| `https://explorer.xchain.io` | balances, history, token data | the addresses being queried, and the requesting IP |
| `https://encoder.xchain.io/` | builds unsigned transactions | transaction inputs: addresses, amounts, ticks |
| `https://hub.xchain.io/` | signed chain-registry snapshot, fee data | nothing identifying beyond the request itself |
| `https://api.coingecko.com/api/v3` | fiat price display | the requesting IP; no addresses, no amounts |
| a host the token issuer chose, plus `ipfs.io` / `arweave.net` | the information document a token links from its own on-chain description | the requesting IP, and which token was opened, to a third party neither we nor the user chose |
| `https://downloads.xchain.io/wallet/android/latest.json` | "is there a newer version?", for a directly-downloaded APK only, never for a Play install | the requesting IP and the running version; no addresses, no identifiers |

The token-metadata row is the one that matters most on this form: when the metadata-fetch setting is on, which is the default, the app follows a URL out of a token's on-chain description and resolves `ipfs://` and `ar:` links through public gateways. It is a third-party contact, on by default, to a destination chosen by whoever issued the token, and it is disclosed both here and in the privacy policy.

**A Play-installed copy never makes the update-check request, on any setting.** The check is gated at runtime on how the app was installed. A Play install answers `store` and no update-check request is ever made; only a directly-downloaded APK, which no store keeps current, ever asks. It is declared here anyway, since disclosing a request the Play build does not make is the safer direction on this form. The request itself carries the requesting IP and the running version, no addresses and no identifiers, at most once a day, and can be switched off in Settings under About.

Remote token media (images, audio, video) is not fetched at all: the app's content policy admits no remote origin for images and has no path for audio or video, so those elements never load. Only the metadata document itself is fetched.

## Form answers

### Data collection and sharing

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (TLS only; cleartext traffic is refused at the platform level) |
| Do you provide a way for users to request that their data is deleted? | **Not applicable** (no account, no server-side user data; uninstalling removes everything, and the app can also wipe its own storage from Settings) |

Balance and history queries do send wallet addresses and the device's IP address to first-party infrastructure, and building a transaction sends addresses and amounts. That is the request being serviced, not retained collection: our servers do not retain client IP addresses (see [Data collection](data-collection.md)), and the one log that carries wallet addresses is kept for one day.

### Per-category answers

| Category | Collected | Shared | Notes |
|---|---|---|---|
| Location | No | No | No location permission is declared. |
| Personal info | No | No | No name, email, address, or user ID. There is no account. |
| Financial info | No | No | Balances are read from a public blockchain; nothing is stored by us. Keys never leave the device. |
| Health and fitness | No | No | |
| Messages | No | No | Encrypted on-chain messaging is user-to-user; we hold no copy. |
| Photos and videos | No | No | Camera is used for live QR decoding only. No image is stored, saved, or transmitted. |
| Audio | No | No | |
| Files and docs | No | No | |
| Calendar | No | No | |
| Contacts | No | No | The in-app address book is local, and no device contacts permission is declared. |
| App activity | No | No | No analytics SDK is present in any shell. |
| Web browsing | No | No | |
| App info and performance | No | No | No crash-reporting SDK. |
| Device or other IDs | No | No | No advertising ID, no device ID is read or sent. |

### Security practices

- Data is encrypted in transit (TLS enforced at the platform level).
- Users can request data deletion: not applicable, but the app can erase its own storage from within Settings, and uninstalling removes it all.
- The app follows the Play Families policy: not applicable, not targeted at children.
- Independent security review: not yet published.
