<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/Data_Collection.md @ 34639117 (worktree dirty) -->

# Data collection: the technical detail

This page is the technical companion to the [privacy policy](privacy-policy.md). Where the policy explains what happens in plain language, this page lists every network destination the wallet contacts, what each one can learn, and what control you have over it.

## The short version

The wallet collects nothing. There is no account, no sign-up, no analytics, no crash reporting, and no server that holds user data.

That is not the whole story. A self-custodial wallet has to ask a server about the blockchain, and asking reveals which addresses you care about to whoever answers. That is not collection in the sign-up sense, but it is data leaving the device, and it is disclosed here in full.

## What never leaves the device

No code path sends any of this anywhere:

- The recovery phrase (BIP39 seed) and every private key derived from it.
- The wallet password.
- Imported private keys.
- The decrypted contents of the vault (labels, address book, settings).

Key material is encrypted at rest with AES-256-GCM under a key derived by Argon2id. The storage layer never sees plaintext. Where the encrypted material physically sits depends on the shell: browser storage (web), `chrome.storage.local` (extension), an encrypted file plus the OS keychain (desktop), the app's private storage plus the Android Keystore (Android), or the app's private container plus the iOS Keychain (iOS).

## Analytics, telemetry and crash reporting

**None, in any shell.** No analytics SDK, no crash reporter, no usage tracking. Nothing in the wallet reports how it is used to anyone.

An on-device diagnostic dump is available if you ask for one from within the app. It is generated locally and is never transmitted automatically. It redacts every address, balance, transaction id, contact and secret, and hashes free-form fields such as custom endpoint URLs rather than including them as plain text.

## What does leave the device

Ordered by how routine it is. "Reveals" means what the receiving server can learn, including the IP address any HTTPS request necessarily carries.

| # | What | Goes to | When | Reveals | Your control |
|---|---|---|---|---|---|
| 1 | Address queries: balances, history, UTXOs | `explorer.xchain.io` (per chain) | Whenever the wallet shows a balance or history | The addresses you hold, your IP | Endpoint is user-configurable in Settings |
| 2 | Transaction construction | `encoder.xchain.io` | When you compose a send or any action | Source and destination addresses, amounts, fees | Endpoint is user-configurable |
| 3 | Live address subscription | explorer host | While notifications are on | The address being watched, a persistent connection from your IP | Follows the explorer setting |
| 4 | Config and chain-registry lookups | `hub.xchain.io` | On every app or service start | Your IP only. No wallet data. The response is cryptographically signed and rejected if it does not verify | Not a toggle |
| 5 | Coin price lookups | `api.coingecko.com`, a third party | Viewing a native-coin page, and a periodic poll only while a price alert is armed | Your IP and which coins you looked at. No addresses | Opt-out in Settings under Privacy. On by default. The wallet's own on-chain price oracle is tried first |
| 6 | Token metadata fetch | A URL taken from the token's own on-chain record, so a server chosen by whoever issued the token | Viewing a token whose description is a URL | Your IP, and to that issuer, that you looked at their token | Opt-out in Settings under Privacy. On by default |
| 7 | Trezor Connect | `connect.trezor.io` (SatoshiLabs) | Only if you pair a Trezor. Web and desktop shells only; the extension ships no Trezor support, and the mobile apps' content security policy does not permit the request either | Handled inside Trezor's own frame under their privacy policy | Only reached by choosing to use a Trezor |
| 8 | Update check | `downloads.xchain.io` | Desktop on launch; Android at most once a day, and only for a directly-downloaded APK (a Play install updates through Play and never makes this request) | Your IP. The running version is not sent; the wallet compares the latest release's description against itself on-device. Auto-download is off; installing is always your choice | Android: opt-out in Settings. Desktop: no opt-out for the check itself |
| 9 | Backup restore from a pointer | A URL you type | Only when you restore from a pointer | Whatever that host logs. The payload is already encrypted with your password. Only `https` links are accepted | Entirely user-initiated |
| 10 | Block-explorer icon loads | `mempool.space`, `blockstream.info`, `litecoinspace.org`, `blockchair.com`, `blockcypher.com`, depending on the coin | Browser extension only. Whenever a transaction detail view renders on a live network, before you click anything. Every other shell injects a content security policy whose `img-src` admits no remote origin, so the request is never made there | Your IP, and that you opened a transaction detail view | None. There is no toggle for this one, on the shell that makes it |
| 11 | IPFS and Arweave gateway fetches | `ipfs.io`, `arweave.net` | When a token's metadata document (row 6) or a media URL inside it is an `ipfs://` or `ar://` link | Your IP and the content id you resolved | Follows row 6 |

Row 6 is worth a second look: it is the only case where the wallet contacts a host that neither we nor you chose, and a token issuer can use it to learn who is looking at their token. It is on by default, which is a deliberate product choice, and it can be turned off.

Row 10 is worth the same second look, for the opposite reason: it is the only entry on this table with no user control at all. Five third-party hosts are contacted on a routine screen, before you click anything.

Ledger hardware wallets use WebHID over USB and make no network request at all.

## What our servers keep

`explorer.xchain.io`, `encoder.xchain.io` and `hub.xchain.io` sit behind Cloudflare, and the address our own servers log is Cloudflare's, not yours: measured across a full day of traffic, the overwhelming majority of distinct source addresses in each log fell inside Cloudflare's published ranges. **We do not retain your IP address.**

What those logs do keep is the request itself: the time, what was asked for, the response status and the user-agent. On `explorer.xchain.io` the thing being asked for is often a wallet address, so that log is kept for one day and then deleted. `encoder.xchain.io` receives addresses inside the body of a request, which is not written to the log, and `hub.xchain.io` never sees one. No account is attached to any of it, because there are no accounts.

Cloudflare itself sees and logs the real visitor IP address at its network edge, under its own privacy policy. That is a genuine third-party disclosure and stays disclosed here.

## What the wallet does not do

- No advertising, no ad SDK, no ad identifiers, no ad network.
- No sale or sharing of data with data brokers. There is nothing to sell.
- No user accounts, email collection, phone numbers or contact upload.
- No location, camera, microphone or contacts access beyond the QR scanner, which is used live and stores nothing.
- No cross-app or cross-site tracking. The browser extension requests no host permissions at all.
- No child-directed content and no age gate. The product is a self-custody wallet for adults handling their own coins.

**The donation feature is not advertising.** It is an optional setting that adds a small extra output to your own transaction, paying a project donation address. You are asked about it once during setup and can change it any time in Settings. It sends no data and makes no extra network call.

## Extension permissions, and why each exists

- `storage`: the encrypted vault and small operational state.
- `sidePanel`: renders the wallet in the browser's side panel.
- `notifications`: delivers the transaction and price alerts you enable.
- `alarms`: wakes the extension's background worker so the notification connection does not silently die.
- `host_permissions`: empty. No blanket access to the pages you visit.
- A content script matches `https://*/*`, `http://localhost/*` and `http://127.0.0.1/*` to inject the dApp provider (`window.xchain`). It is a message relay only: it reads no page content and makes no cross-origin request itself. All connection and approval decisions are enforced separately, and nothing is granted to a page until you approve that exact site.

## Jurisdiction-specific sections

This document does not currently include a jurisdiction-specific legal section, such as a GDPR lawful-basis statement or a CCPA notice.

## Tor routing (desktop only)

The desktop app can send everything in the table above through a local Tor SOCKS5 proxy. It is off by default. When it is on:

- Every entry in the table is routed, not some of them: the blockchain queries, the transaction construction, the config lookups, the price and token-metadata fetches, and the update check.
- The proxy resolves the hostnames, so your own DNS resolver does not see which servers the wallet contacts.
- If the proxy is not running, requests fail. They do not quietly go direct.

It is not offered on the web wallet or in the browser extension. A web page cannot use a proxy like this at all, and a browser extension could only redirect the entire browser rather than just the wallet's own requests.
