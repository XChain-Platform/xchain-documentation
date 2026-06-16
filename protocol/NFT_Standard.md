<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# NFT Standard

Non-fungible tokens on XChain are a **composition of existing primitives, not a special
token type**. There is no NFT ACTION, no NFT flag, and no NFT-specific wire format;
the protocol treats every `TICK` uniformly, and "NFT" is a documented pattern of field
values that the consensus layer already enforces. This document is the canonical
definition of that pattern: what makes a token non-fungible, how collections work, how
content is attached and displayed, and what clients and collectors should verify.

It composes five existing primitives: the [`ISSUE`](./actions/ISSUE.md) ACTION (supply
and locks), parent/child `TICK` names (collections), the [`FILE`](./actions/FILE.md) and
[`LINK`](./actions/LINK.md) ACTIONs (content attachment), and the
[Token Information Standard](./Token_Information_Standard.md) (display). No new ACTIONs.
No new fields. No new indexer rules.

---

## What it lets a creator do

- **Issue a unique 1-of-1** whose supply is consensus-guaranteed never to inflate and
  never to split into fractions.
- **Issue an edition of N identical prints** (same guarantees, supply N) optionally
  distributed through a public fair-mint window.
- **Build a collection of distinct items** under one parent name, where the chain itself
  proves every item was added by the collection's owner.
- **Attach any number of files of any type** (images, video, audio, PDFs, archives,
  anything) to a token, each attachment owner-signed and chain-verifiable, including
  files stored on a different chain.
- **Sell, vend, airdrop, and trade** through the built-in DEX rails, including selling
  the *issuer rights* to a token, and trading across chains, with no marketplace
  contract required.

---

## Definition

A token follows the NFT pattern when its `ISSUE` satisfies **both**:

| Property | Field | Why it matters |
|---|---|---|
| Indivisible | `DECIMALS` = `0` (or empty; `0` is the default) | The consensus layer rejects fractional amounts of a 0-decimals token in every amount-bearing ACTION (`SEND`, `ORDER`, `SWAP`, `DISPENSER`, `DESTROY`, `AIRDROP`, `DIVIDEND`, `MINT`, …). `DECIMALS` cannot be changed once supply exists. |
| Permanently capped | `LOCK_MAX_SUPPLY` = `1` | `MAX_SUPPLY` can never be raised. A 1-of-1 stays a 1-of-1; an edition of 100 stays 100. |

- `MAX_SUPPLY` = `1` → a **unique** (1-of-1).
- `MAX_SUPPLY` = `N` → an **edition** of N identical prints (fungible within the
  edition, indivisible (the Counterparty rare-art tradition).

### Classification rule for clients

Explorers, wallets, and APIs that present a "collectibles" view should classify a token
as following the NFT pattern when **`DECIMALS = 0` AND `LOCK_MAX_SUPPLY = 1`** on the
token's current record. This is the canonical rule; use it as written so all clients
agree.

Classification is **presentational, not consensus**. Some integer-unit,
locked-supply tokens are currencies, not collectibles. The issuer disambiguates through
the [Token Information Standard](./Token_Information_Standard.md#nft-usage) by declaring
a category of `{ "type": "main", "data": "NFT" }`; clients should treat the TIS
category as the issuer's stated intent and the field rule above as the eligibility
test.

### Issuing

A unique 1-of-1, fully minted to the issuer (this is the `ISSUE` spec's own example;
`DECIMALS` empty defaults to 0):

```
ISSUE|0|PEPECREATURE|1||||1|||1
MAX_SUPPLY=1, MINT_SUPPLY=1, LOCK_MAX_SUPPLY=1
```

An edition of 100, pre-minted to the issuer for manual distribution:

```
ISSUE|0|PEPEPRINT|100||||100|||1
MAX_SUPPLY=100, MINT_SUPPLY=100, LOCK_MAX_SUPPLY=1
```

An edition of 100 distributed by public fair mint; one per address, inside a block
window (see [`MINT`](./actions/MINT.md)), capped and locked from the moment of
issuance, before any supply exists:

```
MAX_SUPPLY=100, MAX_MINT=1, DECIMALS=0, LOCK_MAX_SUPPLY=1,
MINT_ADDRESS_MAX=1, MINT_START_BLOCK=<open>, MINT_STOP_BLOCK=<close>
```

**Locking requires a declared cap, not minted supply.** `LOCK_MAX_SUPPLY=1` is valid
whenever the token's `MAX_SUPPLY` is set, in the same `ISSUE` or already on the token
record. Minted supply is not required, so a fair-mint drop locks its cap at creation
and satisfies the [classification rule](#classification-rule-for-clients) from its
first block. The only rejected case is locking with no `MAX_SUPPLY` declared, which
would permanently brick the tick at a cap of nothing.

The SDK provides `sdk.nft.unique()`, `sdk.nft.edition()`, and `sdk.nft.collectionItem()`
builders that set `DECIMALS=0` and `LOCK_MAX_SUPPLY=1` correctly, and `sdk.issueNft()`,
`sdk.issueNftEdition()`, and `sdk.issueNftCollectionItem()` workflow helpers that encode
and submit the resulting action in one call. The protocol does not infer intent: an issuer
who omits `LOCK_MAX_SUPPLY` has issued an ordinary token whose supply can later grow, and
no client should classify it as an NFT.

---

## Collections

A collection is a **parent `TICK` plus child `TICK`s** using the period-separated
parent/child naming that `ISSUE` already defines:

```
PEPESERIES            ← parent (the collection)
PEPESERIES.GENESIS    ← item 1
PEPESERIES.NIGHTSKY   ← item 2
```

The consensus rules that make this a provenance system already exist in `ISSUE`
validation:

- A child `ISSUE` is valid **only from the current owner of the parent** `TICK`.
- Child issuance is rejected while the parent's ownership is escrowed in an open
  ownership offer.
- Each child has its **own independent ownership record**; selling the parent's
  ownership does not move the children, and vice versa.

So collection authenticity is chain-native: every item in `PEPESERIES.*` was provably
added by whoever owned `PEPESERIES` at that block, and the parent's ownership history
is the collection's provenance trail. There is no consensus concept of a "complete"
collection; the parent owner may always add items; a creator who wants to declare a
collection closed does so in the collection's TIS metadata or other public statement.

For curated directories of **independently-named** tokens (community submissions that
keep their own ticks rather than living under a parent), see the
[Project Registry Standard](./Project_Registry.md); an owner-attested roster built
from `LIST` + `LINK`.

**Editions vs collections:** supply N on one tick = N *identical* prints; N *distinct*
items = N child ticks. A collection of editions (e.g. 50 items × 10 prints each) is 50
children, each with `MAX_SUPPLY=10`.

---

## Attaching content

Content attachment uses the existing **`FILE` + `LINK`** flow. Files are uploaded
on-chain with [`FILE`](./actions/FILE.md), then officially associated with a token by
[`LINK`](./actions/LINK.md)ing the FILE's `ACTION_INDEX` to the token's `ISSUE`
`ACTION_INDEX`:

1. `ISSUE` the token.
2. `FILE`: upload the content (any MIME type; raw bytes ride as `rawData`).
3. `LINK`: associate the FILE with the token's `ISSUE`.

`LINK` validation already enforces ownership: when the link target resolves to a local
`ISSUE`, the LINK is valid **only if its SOURCE is the current owner of that `TICK`**
(and the TICK's ownership is not escrowed). Anyone can upload files; only the token's
owner can officially associate one with the token.

Properties of the association:

- **Unlimited.** An owner may link any number of files over the token's lifetime:
  artwork, alternate formats, PDFs, audio stems, terms, anything.
- **No display semantics.** The protocol does not rank, select, or interpret linked
  files. A linked file means exactly one thing: *the token's owner attached this*.
  Which file renders as "the art" is decided by the token's
  [TIS metadata](./Token_Information_Standard.md#nft-usage), not by the chain.
- **Cross-chain capable.** `LINK` carries coin fields on both sides, so a token on DOGE
  can attach a file stored on BTC. (Cross-chain owner checks cannot be validated
  locally; clients should verify the remote side when it matters.)
- **Composes with token gating.** A [token-gated `FILE`](./Token_Gated_Content.md)
  (`GATE_TICKER` = the NFT's tick) makes the content decryptable only by holders,
  an NFT whose art or bonus content unlocks on ownership. The gated-transfer rules
  (`SEND` + `MESSAGE` pairing) apply unchanged.

---

## Display metadata

Display is governed entirely by the
[Token Information Standard](./Token_Information_Standard.md). The token's
`DESCRIPTION` points at TIS JSON (HTTPS URL with optional hash pin, `ipfs:`, `ord:`, or
`ar:` forms), and the TIS document declares what clients render:

- `images` / `audio` / `video` / `files` arrays select and order the media.
- `data_ref: action:<index>` points an entry at an **on-chain `FILE`**; a fully
  on-chain collection uses `data_ref` for every entry, so its display assets carry the
  same permanence as the token itself. Off-chain `data` URLs remain valid for creators
  who prefer them.
- `categories` carries the issuer's `NFT` declaration (see
  [classification](#classification-rule-for-clients)).

Issuers who want their metadata pointer immutable set `LOCK_DESCRIPTION=1`; after
which the `DESCRIPTION`, and therefore the token's TIS location, can never be changed.
Pairing a locked description with a content-addressed pointer (`ipfs:`/`ord:`/`ar:` or
URL`;HASH`) and on-chain `data_ref` entries yields end-to-end immutable presentation.

---

## What a collector should verify

Because "NFT" is a pattern rather than a flag, due diligence is a fixed checklist, all
answerable from chain state:

- ✅ `DECIMALS` is `0` and `LOCK_MAX_SUPPLY` is `1`; otherwise supply can inflate or split
- ✅ Current `MAX_SUPPLY` and issued supply match the seller's claim (1-of-1 vs edition size)
- ✅ For a collection item: the child was issued while the parent was held by the expected creator (parent ownership history)
- ✅ Linked content: the `LINK` SOURCE is the token's owner at link time; for on-chain art, the `FILE` bytes hash-match what's displayed
- ✅ If immutable metadata matters: `LOCK_DESCRIPTION` is set and the TIS pointer is content-addressed
- ✅ For gated content: the `KEY_HASH` matches the key received (see [Token-Gated Content](./Token_Gated_Content.md))

---

## Distribution and trading

All existing rails apply to NFT-pattern tokens with no special cases:

- **Drops:** `MINT` fair-mint windows (`MAX_MINT`, `MINT_ADDRESS_MAX`,
  `MINT_START_BLOCK`/`MINT_STOP_BLOCK`), [`AIRDROP`](./actions/AIRDROP.md) to holder
  lists, and [`DISPENSER`](./actions/DISPENSER.md) vending (pay coin, receive the
  token automatically).
- **Trading:** [`ORDER`](./actions/ORDER.md) (token/token or token/native-coin pairs,
  including cross-chain orders settled by the validator federation) and
  [`SWAP`](./actions/SWAP.md). Indivisibility is enforced throughout; a fractional
  amount of a 0-decimals token is invalid in every path.
- **Issuer-rights sales:** `GIVE_OWNERSHIP`/`GET_OWNERSHIP` on ORDER/SWAP/DISPENSER
  sell the token's *ownership record* (the right to link files, edit unlocked fields,
  issue children under a parent), distinct from holding its supply. Ownership trades
  are single-fill and escrow-protected.

## Royalties

**There are no royalty *fields* on any ACTION, and DEX settlement takes no fee on its
own.** Royalties aren't baked into the wire format or the settlement math; they are a
policy a token **opts into**, enforced by a programmable contract rather than a fixed
protocol rule.

The first-class way to enforce them is **[Controller-Bound Tokens](./Controller_Bound_Tokens.md)**:
a token binds a controller contract (via `ISSUE` v6) whose `guard` the indexer runs when
the token is listed for sale. The guard returns a basis-point split (`payoutLegs`) that
the indexer records on the order and applies to the seller's proceeds at each DEX match;
the creator's cut plus the seller's remainder, conserved exactly. Because the indexer is
the only settlement path and the same controller can also gate plain `SEND`s, the rule
**cannot be routed around**: yet it needs no custody: the token stays natively held and
natively tradeable. The binding is opt-in per token, not imposed platform-wide.

Creators who prefer a custody model can instead implement royalties in an ordinary
**marketplace contract** that takes custody via [`DEPOSIT`](./actions/DEPOSIT.md)/[`WITHDRAW`](./actions/WITHDRAW.md)
and enforces any fee split in contract logic; opt-in per collection, at the cost of the
contract holding the token.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
