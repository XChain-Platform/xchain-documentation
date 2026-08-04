<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/extension/docs/DATA_DISCLOSURE.md @ 34639117 (worktree dirty) -->
<!-- 2026-08-03: the operator's answers, the paste-ready justification and the -->
<!-- pre-submission checks were folded back in from that source, by operator -->
<!-- ruling: ceremonies are documentation, and documentation has one home. -->

# Chrome Web Store data disclosure (Privacy practices tab)

This page is the Chrome Web Store Privacy practices declaration for the XChain Wallet browser extension, field by field, in the form the release operator transcribes into the console while working [the Chrome Web Store submission runbook](../release/extension/chrome-web-store.md), Phase 5.

This is the third store form, and it asks the same questions as the other two in a third vocabulary. The answers are a **translation of [the data-collection record](data-collection.md)**, the declaration of record, exactly as [Data safety](data-safety.md) (Google Play) and [Privacy nutrition labels](privacy-nutrition-labels.md) (Apple) are. Do not answer this form from the privacy-policy prose, and do not answer it from memory of what the other two say: change the record first, then all three.

## What the console is the authority on

Two different things are quoted below and they are not equally certain:

- **The Chrome Web Store User Data Policy vocabulary is confirmed verbatim** from the published policy (personally identifiable information, financial and payment information, health information, authentication information, website content and resources, form data, web browsing activity, personal communications, user-generated content), with its definitions. That vocabulary is what the reasoning below rests on, and it is stable.
- **The console's on-screen checkbox labels are not quoted from the console.** They are grouped below under the labels the dashboard is expected to show.

So: answer by the FACT, then find the checkbox whose label covers that fact. If the console shows a category this page does not name, or names one differently, **tick by the fact and record what you actually saw here**, in the same pass, before you submit. That is the same rule the listing collateral carries for the category taxonomy, for the same reason: a document that guesses at a menu it cannot see should say so rather than be believed.

## Fields that are not data questions

These are answered elsewhere and are listed only so this page maps the whole tab and the operator is not left wondering which document a field comes from.

| Console field | Answer comes from |
|---|---|
| Single purpose | [Single-purpose statement](../release/extension/chrome-web-store.md#single-purpose-statement) |
| Permission justification, one per permission | [Permission justifications](../release/extension/chrome-web-store.md#permission-justifications) |
| Content-script / host-permission justification | [Content script and injected-provider justification](../release/extension/chrome-web-store.md#content-script-and-injected-provider-justification) |
| Privacy policy URL | The canonical address published by [the privacy policy](privacy-policy.md), verified live by `tools/release/verify-privacy-url.mjs` |

## Remote code

**Answer: No, the extension does not execute remote code.**

Paste-ready justification:

> All executable code ships inside the extension package. The extension
> loads no script from any remote origin, uses no `eval` or
> `new Function` on fetched content, and its only network traffic is data
> (JSON from blockchain APIs and a price feed), never code. The build is
> reproducible from source, so the published package can be rebuilt and
> compared byte for byte.

This is not a claim on trust: `packages/extension/scripts/remote-code-audit.mjs` audits the built bundle for remote-code patterns and gates on them. It allow-lists three known-benign hits by code signature and was mutation-tested in both directions. Re-run it before each submission.

Related, and asked separately by the form's Limited Use text: the extension **does not use Google APIs and does not process Google user data**. [The privacy policy](privacy-policy.md) carries the required Limited Use statement verbatim.

## What the extension sends off the device

Derived from `packages/core/src/privacy/wireAudit.js`, filtered to the extension shell. This is the table the data-usage answers are reasoned from, and a smoke fails if a host egresses on this shell and is missing here, or if a host is listed here that the extension does not contact.

| Host | Party | Why | What leaves | User control |
|---|---|---|---|---|
| `explorer.xchain.io` | first | balances, transaction history, token rows, fee quotes | the addresses being queried, and the requesting IP | Settings, Networks: the endpoint is user-configurable |
| `encoder.xchain.io` | first | builds the unsigned transaction the device then signs | addresses, amounts, ticks, and the requesting IP | Settings, Networks: the endpoint is user-configurable |
| `hub.xchain.io` | first | signed chain-registry snapshot, fee data, SPV checkpoints | the requesting IP; no addresses | Settings, Networks: the endpoint is user-configurable |
| `api.coingecko.com` | third | native-coin price and market statistics | the requesting IP, and that a wallet is in use; no addresses | Settings, Privacy, coin statistics (ON by default) |
| `ipfs.io` | third | gateway for a token linking to `ipfs://` | the requesting IP, and which token was opened | Settings, Privacy, token information (ON by default) |
| `arweave.net` | third | gateway for a token linking to `ar:` | the requesting IP, and which token was opened | Settings, Privacy, token information (ON by default) |
| **a host the token issuer chose** (`*`) | third | the token information document linked from a token's own on-chain description | the requesting IP, and which token was opened, to a host neither we nor the user picked | Settings, Privacy, token information (ON by default) |
| `mempool.space` | third | the block-explorer icon beside a "view on explorer" link | the requesting IP, and that a transaction detail view was opened | **none** |
| `blockstream.info` | third | the block-explorer icon beside a "view on explorer" link | the requesting IP, and that a transaction detail view was opened | **none** |
| `litecoinspace.org` | third | the block-explorer icon beside a "view on explorer" link | the requesting IP, and that a transaction detail view was opened | **none** |
| `blockchair.com` | third | the block-explorer icon beside a "view on explorer" link | the requesting IP, and that a transaction detail view was opened | **none** |
| `www.blockcypher.com` | third | the block-explorer icon beside a "view on explorer" link | the requesting IP, and that a transaction detail view was opened | **none** |
| **a host the user typed** (`*`) | third | restoring an encrypted backup from a link the user supplies | the requesting IP; the file is already encrypted under the user's password | user-initiated only, `https` only |

Two rows deserve a second look before any of this is transcribed, and they are the two [the data-collection record](data-collection.md) already flags:

- **The token-issuer host.** The only automatic contact to a destination that neither we nor the user chose, on by default. A token issuer can learn who opened their token.
- **The five explorer icons.** The only egress on this shell with **no user control at all**, fired as a routine screen renders, before the user clicks anything. They happen on the extension and nowhere else: the extension ships no `content_security_policy` key, so Manifest V3's default applies and does not restrict `img-src`, while every other shell injects a policy whose `img-src` admits no remote origin.

`downloads.xchain.io` is deliberately absent: the update feed is a desktop path, and the extension updates through the browser's own store. Declaring traffic that does not occur is the same class of error as omitting traffic that does.

Ledger hardware wallets use WebHID over USB and make no network request at all. Trezor is not supported in this shell, so `connect.trezor.io` is never contacted here.

## The collection decision

**The wallet does not collect user data, and it is a plain fact rather than an argument.** The same answer lands on all three store forms.

It was blocked here for a day on a premise that measurement dissolved. The earlier record said the explorer, encoder and hub hosts each logged the client IP alongside a request line carrying the wallet address, retained 14 days. That was read off the Apache format string (`combined` starts with `%h`) rather than off the logs. `%h` is whoever opened the TCP connection, and behind a reverse proxy that is the proxy.

Measured on the live hosts on 2026-08-02:

- All three hosts are Cloudflare-proxied, and none of them loads a real-client-IP module or configures `CF-Connecting-IP` handling.
- So the logged source is a Cloudflare edge address, not a visitor's: explorer **844 of 846** distinct sources inside Cloudflare's published ranges, encoder **119 of 120**, hub **162 of 162**.
- **No wallet user IP is retained, so there is no IP-to-address linkage to disclose.**
- Only `explorer.xchain.io` carried wallet addresses in its request lines (857 of 7,520 that day). `encoder.xchain.io` takes them in POST bodies, which `combined` does not log; `hub.xchain.io` carries none.
- That one log now rotates **daily, with one generation kept**, so no wallet address survives 24 hours. Every other log is untouched at 14 days.

Cloudflare still sees and logs the visitor IP at its edge under its own policy. That is disclosed as a third-party contact, and it is not our retention.

**What would make this false again**, and both are things a sensible administrator might do for good reasons: enabling a real-client-IP module (which would start recording real client addresses), or moving the explorer access log back under the default rotation (which would silently restore the longer retention). [The data-collection record](data-collection.md) is where those two are re-measured; do it before every submission.

## Data usage: the answers

Every "No" below carries the reason it is a No, in a form a reviewer can check against the code, because an unstated "no" reads as an oversight.

| Category | Collected | Why |
|---|---|---|
| Health information | **No** | Nothing in the product touches health data of any kind. |
| Authentication information | **No** | The recovery phrase, private keys, wallet password and vault contents are encrypted at rest (AES-256-GCM under an Argon2id-derived key) in `chrome.storage.local` and **no code path transmits any of them anywhere**. See the judgment calls below, because this one has a counter-argument worth knowing. |
| Personal communications | **No** | XChain messaging is end-to-end encrypted between two users and written on-chain; we operate no message store and hold no copy, and no plaintext ever reaches a server. The ciphertext does transit `encoder.xchain.io` on its way into a transaction, which is the same first-party-log fact as the collection decision above. |
| Location | **No** | No geolocation API is called and no location permission is declared. The requesting IP that every HTTPS request necessarily carries is covered by the collection decision, not here. |
| Web browsing activity / web history | **No** | This is the strongest No on the form and the one a reviewer will probe hardest, so it is stated structurally: `host_permissions` is **empty**; no tab, navigation, history or web-request permission is declared (no `tabs`, no `webNavigation`, no `history`, no `webRequest`); the content script is a `postMessage` relay that reads no page content and makes no cross-origin request. The list of dApp origins the user has approved is stored in `chrome.storage.local` and is never transmitted. |
| User activity | **No** | No analytics SDK, no crash reporter, no usage tracking, in any shell. No clicks, keystrokes, scroll or mouse position are recorded. Verified across the whole workspace and dependency tree, and a smoke keeps that claim honest. |
| Website content and resources | **No** | The content script injects `window.xchain` and relays only the requests a page's own script explicitly makes to that provider. It does not read, scrape or transmit page text, images, media or links. |
| Form data | **No** | Nothing reads or transmits the contents of any page's form fields. |
| User-generated content | **No** | Labels, contacts and memos the user types stay in the local encrypted vault. A memo the user chooses to put in a transaction goes on-chain by their own action; that is the transaction, not collection. |
| Personally identifiable information | **No** | No name, email, phone, username or account exists anywhere in the product. The one arguable edge was a wallet address retained beside a client IP, since the policy's definition reaches "any type of identification number, such as ... account number". No client IP is retained, so nothing links an address to a person. |
| Financial and payment information | **No** | Balances and transaction inputs are transmitted to first-party servers to read the chain and build an unsigned transaction, which is the request itself rather than collection. Nothing is retained beyond servicing it: the encoder logs no addresses at all, and the explorer's request lines are kept one day and carry no client IP. |

### The judgment calls, written down so they are not re-argued at the console

**Authentication information, and why a wallet full of keys answers "No".** Chrome's User Data Policy defines *handling* as "collecting, transmitting, using, or sharing user data", and the disclosure asks what the extension collects. The seed, keys and password are generated on the device, are encrypted at rest, and leave it never; there is no server to send them to, because there is no server. That is the same answer every comparable self-custodial wallet gives, and it is consistent with the policy the listing points at. The counter-argument, stated so nobody discovers it mid-review: the extension undeniably *stores* authentication material, so if the console's on-screen label reads "collect **or store**" rather than "collect", tick it and describe it as local-only, encrypted, never transmitted. Answer what the label in front of you actually says.

**The donation setting is not advertising.** It is an optional setting that adds a small extra output to the user's own transaction, paying a project donation address. It sends no data, makes no extra network call, and is not an ad product. It is also inert today, since the donation addresses still ship as a placeholder sentinel. Do not let its acronym pull this listing into an advertising category on any form.

## Certifications

All three are certified. They are true statements about this product, not aspirations:

✅ **I do not sell or transfer user data to third parties**, outside of the approved use cases. There is nothing to sell: no account, no profile, no user record. The third-party contacts above are the user's own content requests (a price, a token's metadata document, an explorer's icon), not transfers of user data to those parties.  
✅ **I do not use or transfer user data for purposes unrelated to the item's single purpose.** The single purpose is letting the user hold and move XChain Platform coins self-custodially from within the browser, and sign XChain actions on behalf of sites they connect to, and every permission in the manifest is justified against it.  
✅ **I do not use or transfer user data to determine creditworthiness or for lending purposes.** The product has no credit, lending or scoring feature of any kind.  

## Before you tick anything

✅ All three store forms answer "not collected", and a smoke fails if they ever stop agreeing. Three stores, one binary.  
⬜ [The data-collection record](data-collection.md) has been re-read and is still true; in particular its server-logging finding is a claim with an expiry date, and the collection decision above rests on it. Re-measure the access-log configuration and retention on the explorer, encoder and hub hosts before submitting.  
⬜ The remote-code audit is clean **against the artifact being uploaded**, not against a local build. Unpack the release zip you hash-checked in the submission runbook's build-provenance phase, and point the audit at it:

```bash
unzip -q -o release-artifacts/vX.Y.Z/xchain-wallet-extension-vX.Y.Z.zip -d /tmp/cws-audit
node packages/extension/scripts/remote-code-audit.mjs /tmp/cws-audit
```

That directory argument is the whole point of this step. Run bare, the script falls back to the `dist` build directory inside `packages/extension`, which is a gitignored local build: it is whatever was last compiled on this machine, from whatever the working tree held at the time, and it can be days old and need never have matched what the store will serve. (It is gitignored, so on a fresh checkout it does not exist at all, and the audit stops rather than reporting anything.) The remote-code answer is permanent and public, and the same ceremony already refuses a locally built zip for upload for exactly this reason, so auditing one here and calling the answer a measurement would be measuring a different artifact from the one being shipped.  
⬜ `node tools/release/verify-privacy-url.mjs` exits 0, so the policy URL the form validates is live and serving the current policy. **Run it for real, over the network.** The smoke suite exercises the checker against stubs, not against the live URL, which is exactly how a 404 survived every green suite on 2026-08-01. **Exit 4 is not a failure and does not block you:** it means the URL is live and current but a contact address the policy publishes is JavaScript-gated at the edge, which is submittable, since the store validates that the URL resolves and serves the policy, and it does. The script prints both ways out when it fires. The CDN was obfuscating the contact address until 2026-08-02; it is not any more (measured: zero obfuscation spans zone-wide), and exit 4 is what tells you if that comes back, rather than the silent decode that hid it.  
⬜ The wallet's smoke suite is green, so the host table above still matches `packages/core/src/privacy/wireAudit.js` and the permission claims still match `packages/extension/manifest.json`.  
⬜ Any console label that differs from the categories named here has been recorded under [What the console is the authority on](#what-the-console-is-the-authority-on) above, in this pass, before submission.  
