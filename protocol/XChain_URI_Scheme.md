<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# XChain Platform URI Scheme

The XChain URI Scheme defines a compact, QR-friendly text format for representing user-initiated actions on the XChain Platform. A wallet, explorer, dApp, or any other XChain-aware tool can produce a URI; any XChain-aware tool that scans or pastes that URI can route the user to the right screen with the right fields pre-filled.

The scheme is the XChain equivalent of [BIP21](https://github.com/bitcoin/bips/blob/master/bip-0021.mediawiki) — a payment-and-action URI you can put in a QR code, a link, or a clipboard. Unlike BIP21, the XChain scheme is cross-chain (Bitcoin / Litecoin / Dogecoin from a single namespace), names a specific action (not just a payment), and is open to future actions beyond send and receive.

# JSON Specifications

## v1.0.0

There is no JSON schema for this URI format — URI parameters are flat key=value pairs and are documented per action in the tables below. A machine-readable parameter manifest may be published under [`./json/`](./json/) in a future revision once the action surface stabilizes.

# URI Format

```
xchain:<COINCODE>/<action>[?<param>=<value>[&<param>=<value>]...]
```

## Components

| Component | Description |
| :--- | :--- |
| `xchain:` | Fixed scheme identifier. Case-insensitive in input; producers SHOULD emit lowercase. |
| `<COINCODE>` | Short identifier folding coin + network into one token. See [Coin Codes](#coin-codes). Case-insensitive in input; producers SHOULD emit uppercase. |
| `/` | Path separator between coin code and action. Required when an action is present. |
| `<action>` | Verb identifying the intent. See [Actions](#actions). Case-insensitive in input; producers SHOULD emit lowercase. |
| `?<params>` | Optional query string of `key=value` pairs joined by `&`. See [Parameter Conventions](#parameter-conventions). |

The URI is an opaque (no `//`) form, the same shape BIP21 uses (`bitcoin:bc1q…`). This is intentional: opaque URIs round-trip cleanly through QR scanners, terminal pastes, and OS-level handlers without being mangled by URL parsers that expect a host.

# Coin Codes

Coin codes are the short identifier shared across the XChain Platform: explorer / encoder / hub URL paths all use the same codes, and the URI scheme follows that convention. A code combines the **coin** (BTC / LTC / DOGE) with the **network** (mainnet, testnet, regtest) into a single uppercase token.

| Code | Coin | Network |
| :--- | :--- | :--- |
| `BTC` | Bitcoin | mainnet |
| `TBTC` | Bitcoin | testnet |
| `RBTC` | Bitcoin | regtest |
| `LTC` | Litecoin | mainnet |
| `TLTC` | Litecoin | testnet |
| `RLTC` | Litecoin | regtest |
| `DOGE` | Dogecoin | mainnet |
| `TDOGE` | Dogecoin | testnet |
| `RDOGE` | Dogecoin | regtest |

## Naming Rule

Mainnet codes are the canonical ticker (`BTC`, `LTC`, `DOGE`). Testnet codes prepend `T`. Regtest codes prepend `R`. Adding a chain means registering its coin and its three network codes in this table.

Codes are matched case-insensitively on input, but producers SHOULD emit them in uppercase for visual consistency.

# Actions

The action segment identifies the user intent. The scheme is open-ended: any verb the platform has a screen for can be a registered action. Today's actions:

| Action | Intent | Consumer behavior |
| :--- | :--- | :--- |
| `send` | Pay an address (or token amount) | Open the payer's Send screen, pre-fill chain / token / amount / destination |
| `receive` | Request a payment to an address | Open the payee's Receive screen for the named chain (rarely used in QRs — see note below) |

When a wallet generates a QR to **request payment** (i.e. someone wants to be paid), it encodes `action=send`: the scanner is the party that will send the funds, and `send` represents what they're about to do. `action=receive` is reserved for use cases where the URI is asking the consumer to open their own Receive screen — for example, a kiosk QR that says "tap to display your receive address."

## Extensibility

New actions are added by:

1. Reserving the verb in the [Action Registry](#action-registry) table below.
2. Specifying the action's parameter set (which params are required, optional, and what they mean) in a new subsection of [Per-Action Reference](#per-action-reference).
3. Wallets and tools implement the new action in their dispatch table. Tools that don't recognize the action SHOULD surface a "this action isn't supported by this tool" message rather than silently treating the URI as a generic send.

Verbs SHOULD be short, lowercase, hyphen-separated, and describe the user-visible action (not an implementation detail). Examples of well-formed future verbs: `execute`, `issue`, `dispense`, `dex-buy`, `sign-message`.

## Action Registry

| Action | Status | Spec |
| :--- | :--- | :--- |
| `send` | Stable | [Per-Action Reference → send](#send) |
| `receive` | Stable | [Per-Action Reference → receive](#receive) |
| _(reserved for future actions)_ | — | — |

# Parameter Conventions

URI parameters are flat `key=value` pairs joined by `&`, percent-encoded per RFC 3986. Two reserved prefixes carry meaning across all actions:

| Prefix | Meaning |
| :--- | :--- |
| `req-<name>` | The consumer MUST honor `<name>` or reject the URI. Borrowed from BIP21 — a required parameter the consumer doesn't recognize is a hard fail, not a silent skip. |
| _(no prefix)_ | Optional. Consumer may ignore parameters it doesn't understand. |

Boolean parameters use the literal strings `true` or `false`.

Amounts are decimal strings in the asset's display unit (e.g. `0.001` for one mBTC, not `100000` for 100,000 satoshis). The wallet handles the conversion to wire units.

Memos cannot contain `|` or `;` — those characters are reserved by the protocol layer downstream. URI generators MUST strip or reject memos containing them. The wallet rejects pasted / scanned URIs whose memo violates this rule.

# Per-Action Reference

## send

Open the payer's Send screen for the named chain. The payer will sign and broadcast a transaction; the URI's job is to pre-fill the form.

| Param | Required | Description |
| :--- | :--- | :--- |
| `to` | Yes | Destination address. Must validate against the coin code's chain. |
| `amount` | No | Decimal amount in display units (`tick`'s units if `tick` is present, else the native coin's units). |
| `tick` | No | Token tick. Omit for native-coin sends. Case-insensitive; producers SHOULD emit uppercase. |
| `memo` | No | Free-text memo attached to the action. Must not contain `|` or `;`. |
| `label` | No | Optional receiver-facing label (display only; not persisted on-chain). |
| `message` | No | Optional sender-facing note (display only; not persisted on-chain). |

### Examples

| URI | Meaning |
| :--- | :--- |
| `xchain:BTC/send?to=bc1qexampleaddress` | Open Send on Bitcoin mainnet to `bc1q…`. No amount or token specified — the payer fills them in. |
| `xchain:BTC/send?to=bc1qexampleaddress&amount=0.001` | Same, with 0.001 BTC pre-filled. |
| `xchain:TBTC/send?to=tb1qexampleaddress&amount=1&tick=PEPECREATURE` | Open Send on Bitcoin testnet to `tb1q…`, pre-filled with 1 PEPECREATURE. |
| `xchain:DOGE/send?to=DDoGeexampleaddress&amount=420&memo=Thanks!` | Open Send on Dogecoin mainnet, 420 DOGE, with a memo. |

## receive

Open the consumer's Receive screen for the named chain. The consumer's wallet will display the user's own receive address for that chain.

| Param | Required | Description |
| :--- | :--- | :--- |
| `tick` | No | If present, the Receive screen pre-selects this token (so the displayed address is the appropriate one for the requested asset). |
| `amount` | No | Suggested amount for the Receive screen's payment-request UI. |
| `memo` | No | Suggested memo for the payment-request UI. Must not contain `|` or `;`. |

### Examples

| URI | Meaning |
| :--- | :--- |
| `xchain:BTC/receive` | Open Receive on Bitcoin mainnet. |
| `xchain:TBTC/receive?tick=PEPECREATURE&amount=1` | Open Receive on Bitcoin testnet, pre-filled to request 1 PEPECREATURE. |

# Compatibility

## BIP21 alongside

Plain BIP21 URIs (`bitcoin:`, `litecoin:`, `dogecoin:`) remain fully supported as a parallel format. External wallets that only speak BIP21 can still pay an XChain address by scanning a bare-address BIP21 QR. The wallet generates a BIP21 URI by default when no XChain-specific customization (token, action, etc.) is set, maximizing interoperability with non-XChain wallets.

The wallet's BIP21 parser recognizes the XChain extension parameters `tick` and `chain` and surfaces them on the Send screen if present — so a `bitcoin:bc1q…?tick=PEPECREATURE` URI works too, with the caveat that external wallets ignore the extension.

| URI form | Recommended for |
| :--- | :--- |
| `xchain:<CODE>/<action>?…` | XChain-to-XChain QRs that need to carry chain, token, amount, or non-send actions |
| `bitcoin:<addr>?amount=…` (and `litecoin:` / `dogecoin:`) | Bare-address payment requests intended to work with any wallet, not just XChain wallets |

## Legacy path-style form

Older QRs may use the path-style form:

```
xchain://<chainId>/<tick>?amount=&to=&memo=&kind=receive
```

Where `<chainId>` is the descriptor id (e.g. `bitcoin-mainnet`). Wallets MUST accept this form for backwards compatibility but SHOULD NOT generate new QRs in this format. The coin-code opaque form is preferred for new QRs because it's shorter, uses the platform-wide short identifier, and surfaces the action explicitly.

# Versioning Rules

The URI scheme follows semantic versioning. The current version is **v1.0.0**.

- **PATCH** changes: clarifications, typo fixes, additional examples. No behavioral change.
- **MINOR** changes: new actions, new optional parameters, new coin codes. Old URIs continue to parse and route correctly.
- **MAJOR** changes: incompatible changes to the scheme, action grammar, or parameter semantics. Avoided unless absolutely necessary; would require a new scheme name (e.g. `xchain2:`) to avoid ambiguity with v1 URIs in the wild.

Producers MAY include a `v=` parameter to assert the scheme version they encoded against (e.g. `xchain:BTC/send?v=1&to=…`). Consumers MAY use this to surface a "you may need to upgrade your wallet" message when they see a version they don't recognize, but MUST otherwise parse the URI on a best-effort basis.

---

**Copyright &copy; 2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
