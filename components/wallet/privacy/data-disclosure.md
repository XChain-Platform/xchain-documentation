<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/extension/docs/DATA_DISCLOSURE.md @ 34639117 (worktree dirty) -->

# Chrome Web Store data disclosure

This page mirrors the Chrome Web Store Privacy practices declaration published for the XChain Wallet browser extension. It answers the same underlying facts as [Data safety](data-safety.md) (Google Play) and [Privacy nutrition labels](privacy-nutrition-labels.md) (Apple), translated into the Chrome Web Store's own vocabulary.

## Remote code

**The extension does not execute remote code.** All executable code ships inside the extension package. The extension loads no script from any remote origin, uses no dynamic code execution on fetched content, and its only network traffic is data (JSON from blockchain APIs and a price feed), never code. The build is reproducible from source, so the published package can be rebuilt and compared byte for byte against what is listed.

Separately, and asked by the Chrome Web Store's Limited Use text: the extension does not use Google APIs and does not process Google user data. The [privacy policy](privacy-policy.md) carries the required Limited Use statement.

## What the extension sends off the device

| Host | Party | Why | What leaves | Your control |
|---|---|---|---|---|
| `explorer.xchain.io` | first | balances, transaction history, token rows, fee quotes | the addresses being queried, and the requesting IP | Settings, endpoint is user-configurable |
| `encoder.xchain.io` | first | builds the unsigned transaction the device then signs | addresses, amounts, ticks, and the requesting IP | Settings, endpoint is user-configurable |
| `hub.xchain.io` | first | signed chain-registry snapshot, fee data | the requesting IP; no addresses | Settings, endpoint is user-configurable |
| `api.coingecko.com` | third | native-coin price and market statistics | the requesting IP, and that a wallet is in use; no addresses | Settings, coin statistics, on by default |
| `ipfs.io` | third | gateway for a token linking to `ipfs://` | the requesting IP, and which token was opened | Settings, token information, on by default |
| `arweave.net` | third | gateway for a token linking to `ar:` | the requesting IP, and which token was opened | Settings, token information, on by default |
| a host the token issuer chose | third | the token information document linked from a token's own on-chain description | the requesting IP, and which token was opened, to a host neither we nor the user picked | Settings, token information, on by default |
| `mempool.space`, `blockstream.info`, `litecoinspace.org`, `blockchair.com`, `www.blockcypher.com` | third | the block-explorer icon beside a "view on explorer" link | the requesting IP, and that a transaction detail view was opened | none |
| a host the user typed | third | restoring an encrypted backup from a link the user supplies | the requesting IP; the file is already encrypted under the user's password | user-initiated only, `https` only |

Two rows deserve a second look before this is transcribed anywhere else:

- **The token-issuer host.** The only automatic contact to a destination that neither we nor the user chose, on by default. A token issuer can learn who opened their token.
- **The block-explorer icons.** The only egress on this shell with no user control at all, fired as a routine screen renders, before the user clicks anything. This happens on the extension and nowhere else: every other shell restricts remote images through its content security policy, and the extension does not.

`downloads.xchain.io` is not contacted from this shell: the update feed is a desktop path, and the extension updates through the browser's own store.

Ledger hardware wallets use WebHID over USB and make no network request at all. Trezor is not supported in this shell, so `connect.trezor.io` is never contacted here.

## The collection decision

**The extension does not collect user data**, and this is a plain fact, not an argument. The same answer lands on all three store forms.

The first-party hosts `explorer.xchain.io`, `encoder.xchain.io` and `hub.xchain.io` sit behind Cloudflare, so the address our own servers log is Cloudflare's, not a visitor's: measured across a full day of traffic, the overwhelming majority of distinct source addresses in each log fell inside Cloudflare's published ranges. **No wallet user IP is retained, so there is no IP-to-address linkage to disclose.**

Only `explorer.xchain.io` carries wallet addresses in its request lines, and that log has one-day retention. `encoder.xchain.io` takes addresses in request bodies, which are not logged; `hub.xchain.io` carries none.

Cloudflare still sees and logs the visitor's IP address at its own network edge, under its own policy. That is disclosed as a third-party contact, and it is not our retention.

## Data usage

Every "No" below carries the reason it is a No.

| Category | Collected | Why |
|---|---|---|
| Health information | No | Nothing in the product touches health data of any kind. |
| Authentication information | No | The recovery phrase, private keys, wallet password and vault contents are encrypted at rest (AES-256-GCM under an Argon2id-derived key) in local browser storage, and no code path transmits any of them anywhere. |
| Personal communications | No | XChain messaging is end-to-end encrypted between two users and written on-chain; we operate no message store and hold no copy, and no plaintext ever reaches a server. |
| Location | No | No geolocation API is called and no location permission is declared. |
| Web browsing activity / web history | No | `host_permissions` is empty; no tab, navigation, history or web-request permission is declared. The content script is a message relay that reads no page content and makes no cross-origin request. The list of sites the user has approved is stored locally and never transmitted. |
| User activity | No | No analytics SDK, no crash reporter, no usage tracking, in any shell. No clicks, keystrokes, scroll or mouse position are recorded. |
| Website content and resources | No | The content script injects the wallet's page provider and relays only the requests a page's own script explicitly makes to it. It does not read, scrape or transmit page text, images, media or links. |
| Form data | No | Nothing reads or transmits the contents of any page's form fields. |
| User-generated content | No | Labels, contacts and memos the user types stay in the local encrypted vault. A memo the user chooses to put in a transaction goes on-chain by their own action; that is the transaction, not collection. |
| Personally identifiable information | No | No name, email, phone, username or account exists anywhere in the product. No client IP is retained, so nothing links a wallet address to a person. |
| Financial and payment information | No | Balances and transaction inputs are transmitted to first-party servers to read the chain and build an unsigned transaction, which is the request itself rather than collection. Nothing is retained beyond servicing it. |

### A judgment call worth stating plainly

**On "authentication information," and why a wallet full of keys answers "No."** The seed, keys and password are generated on the device, are encrypted at rest, and leave it never; there is no server to send them to, because there is no server. That is the same answer every comparable self-custodial wallet gives. The extension does undeniably *store* authentication material locally and describes it as such wherever a form's wording asks about storage rather than transmission.

**The donation feature is not advertising.** It is an optional setting that adds a small extra output to the user's own transaction, paying a project donation address. It sends no data, makes no extra network call, and is not an ad product.

## Certifications

All three of the following are true statements about this product:

- We do not sell or transfer user data to third parties, outside of the approved use cases. There is nothing to sell: no account, no profile, no user record. The third-party contacts above are the user's own content requests (a price, a token's metadata document, an explorer's icon), not transfers of user data to those parties.
- We do not use or transfer user data for purposes unrelated to the item's single purpose, which is letting the user hold and move XChain Platform coins self-custodially from within the browser, and sign XChain actions on behalf of sites they connect to.
- We do not use or transfer user data to determine creditworthiness or for lending purposes. The product has no credit, lending or scoring feature of any kind.
