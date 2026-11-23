<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# XChain Platform URI Scheme

The XChain URI Scheme defines a compact, QR-friendly text format for representing user-initiated actions on the XChain Platform. A wallet, explorer, dApp, or any other XChain-aware tool can produce a URI; any XChain-aware tool that scans or pastes that URI can route the user to the right screen with the right fields pre-filled.

The scheme is the XChain equivalent of [BIP21](https://github.com/bitcoin/bips/blob/master/bip-0021.mediawiki); a payment-and-action URI you can put in a QR code, a link, or a clipboard. Unlike BIP21, the XChain scheme is cross-chain (Bitcoin / Litecoin / Dogecoin from a single namespace), names a specific action (not just a payment), and is open to future actions beyond send and receive.

## JSON Specifications

### v1.0.0

There is no JSON schema for this URI format; URI parameters are flat key=value pairs and are documented per action in the tables below. A machine-readable parameter manifest may be published under [`./json/`](./json/) in a future revision once the action surface stabilizes.

## URI Format

```
xchain:<COINCODE>/<action>[?<param>=<value>[&<param>=<value>]...]
```

### Components

| Component | Description |
| :--- | :--- |
| `xchain:` | Fixed scheme identifier. Case-insensitive in input; producers SHOULD emit lowercase. |
| `<COINCODE>` | Short identifier folding coin + network into one token. See [Coin Codes](#coin-codes). Case-insensitive in input; producers SHOULD emit uppercase. |
| `/` | Path separator between coin code and action. Required when an action is present. |
| `<action>` | Verb identifying the intent. See [Actions](#actions). Case-insensitive in input; producers SHOULD emit lowercase. |
| `?<params>` | Optional query string of `key=value` pairs joined by `&`. See [Parameter Conventions](#parameter-conventions). |

The URI is an opaque (no `//`) form, the same shape BIP21 uses (`bitcoin:bc1q…`). This is intentional: opaque URIs round-trip cleanly through QR scanners, terminal pastes, and OS-level handlers without being mangled by URL parsers that expect a host.

## Coin Codes

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

### Naming Rule

Mainnet codes are the canonical ticker (`BTC`, `LTC`, `DOGE`). Testnet codes prepend `T`. Regtest codes prepend `R`. Adding a chain means registering its coin and its three network codes in this table.

Codes are matched case-insensitively on input, but producers SHOULD emit them in uppercase for visual consistency.

## Actions

The action segment identifies the user intent. The scheme is open-ended: any verb the platform has a screen for can be a registered action. Today's actions:

| Action | Intent | Consumer behavior |
| :--- | :--- | :--- |
| `send` | Pay an address (or token amount) | Open the payer's Send screen, pre-fill chain / token / amount / destination |
| `receive` | Request a payment to an address | Open the payee's Receive screen for the named chain (rarely used in QRs: see note below) |
| `execute` | Invoke a contract method | Open the contract EXECUTE form with the chain, contract, method, and parameters pre-filled |
| `multisig-sign` | Sign a multisig PSBT request | Validate the request envelope and open the multisig signing session |
| `request` | Ask the wallet to approve one site request | Open the existing approval page and send the answer only to the site named by the request |

When a wallet generates a QR to **request payment** (i.e. someone wants to be paid), it encodes `action=send`: the scanner is the party that will send the funds, and `send` represents what they're about to do. `action=receive` is reserved for use cases where the URI is asking the consumer to open their own Receive screen, for example, a kiosk QR that says "tap to display your receive address."

### Extensibility

New actions are added by:

1. Reserving the verb in the [Action Registry](#action-registry) table below.
2. Specifying the action's parameter set (which params are required, optional, and what they mean) in a new subsection of [Per-Action Reference](#per-action-reference).
3. Wallets and tools implement the new action in their dispatch table. Tools that don't recognize the action SHOULD surface a "this action isn't supported by this tool" message rather than silently treating the URI as a generic send. Concretely: a wallet that does not recognize an action verb MUST NOT broadcast a transaction, open a send form, or take any value-transferring action. The correct response is to display the raw action name and an explanatory message, then stop. Wallets can also check the `v=` parameter: a version higher than the wallet's supported maximum is a signal to prompt the user to upgrade before proceeding.

Verbs SHOULD be short, lowercase, hyphen-separated, and describe the user-visible action (not an implementation detail). New wallet capabilities are methods of `request`, not new verbs.

### Action Registry

| Action | Status | Spec |
| :--- | :--- | :--- |
| `send` | Stable | [Per-Action Reference → send](#send) |
| `receive` | Stable | [Per-Action Reference → receive](#receive) |
| `execute` | Stable | [Per-Action Reference → execute](#execute) |
| `multisig-sign` | Stable | [Per-Action Reference → multisig-sign](#multisig-sign) |
| `request` | Stable | [Per-Action Reference → request](#request) |
| _(reserved for future actions)_ | None | None |

## Parameter Conventions

URI parameters are flat `key=value` pairs joined by `&`, percent-encoded per RFC 3986. Two reserved prefixes carry meaning across all actions:

| Prefix | Meaning |
| :--- | :--- |
| `req-<name>` | The consumer MUST honor `<name>` or reject the URI. Borrowed from BIP21; a required parameter the consumer doesn't recognize is a hard fail, not a silent skip. |
| _(no prefix)_ | Optional. Consumer may ignore parameters it doesn't understand. |

Boolean parameters use the literal strings `true` or `false`.

Amounts are decimal strings in the asset's display unit (e.g. `0.001` for one mBTC, not `100000` for 100,000 satoshis). The wallet handles the conversion to wire units.

Memos cannot contain `|` or `;`; those characters are reserved by the protocol layer downstream. URI generators MUST strip or reject memos containing them. The wallet rejects pasted / scanned URIs whose memo violates this rule.

## Per-Action Reference

### send

Open the payer's Send screen for the named chain. The payer will sign and broadcast a transaction; the URI's job is to pre-fill the form.

| Param | Required | Description |
| :--- | :--- | :--- |
| `to` | Yes | Destination address. Must validate against the coin code's chain. |
| `amount` | No | Decimal amount in display units (`tick`'s units if `tick` is present, else the native coin's units). |
| `tick` | No | Token tick. Omit for native-coin sends. Case-insensitive; producers SHOULD emit uppercase. |
| `memo` | No | Free-text memo attached to the action. Must not contain `|` or `;`. |
| `label` | No | Optional receiver-facing label (display only; not persisted on-chain). |
| `message` | No | Optional sender-facing note (display only; not persisted on-chain). |

#### Examples

| URI | Meaning |
| :--- | :--- |
| `xchain:BTC/send?to=bc1qexampleaddress` | Open Send on Bitcoin mainnet to `bc1q…`. No amount or token specified; the payer fills them in. |
| `xchain:BTC/send?to=bc1qexampleaddress&amount=0.001` | Same, with 0.001 BTC pre-filled. |
| `xchain:TBTC/send?to=tb1qexampleaddress&amount=1&tick=PEPECREATURE` | Open Send on Bitcoin testnet to `tb1q…`, pre-filled with 1 PEPECREATURE. |
| `xchain:DOGE/send?to=DDoGeexampleaddress&amount=420&memo=Thanks!` | Open Send on Dogecoin mainnet, 420 DOGE, with a memo. |

### receive

Open the consumer's Receive screen for the named chain. The consumer's wallet will display the user's own receive address for that chain.

| Param | Required | Description |
| :--- | :--- | :--- |
| `tick` | No | If present, the Receive screen pre-selects this token (so the displayed address is the appropriate one for the requested asset). |
| `amount` | No | Suggested amount for the Receive screen's payment-request UI. |
| `memo` | No | Suggested memo for the payment-request UI. Must not contain `|` or `;`. |

#### Examples

| URI | Meaning |
| :--- | :--- |
| `xchain:BTC/receive` | Open Receive on Bitcoin mainnet. |
| `xchain:TBTC/receive?tick=PEPECREATURE&amount=1` | Open Receive on Bitcoin testnet, pre-filled to request 1 PEPECREATURE. |

### execute

Open the wallet's contract EXECUTE form for the named chain with the call target pre-filled. The wallet signs and broadcasts the resulting `EXECUTE` action; the URI's job is only to pre-fill the form (the explorer's "Write Contract" card is the primary producer). The wallet re-reads the contract's declared [ABI](contract-abi.md), when present, to render named parameter inputs.

| Param | Required | Description |
| :--- | :--- | :--- |
| `contract` | Yes | The deployed contract's `action_index` (the `EXECUTE` action's `CONTRACT_ACTION_INDEX`). A URI without it is unroutable and treated as unrecognized. |
| `method` | No | Method name to invoke. Pre-fills the form; the user can change it before signing. |
| `params` | No | Positional arguments as a single pipe-delimited string, percent-encoded (`a\|b` → `a%7Cb`). Elements must not themselves contain `\|` or `;` (the same rule as `EXECUTE`'s `PARAMS` wire field). Parameter names/types, when the contract declares them, are display metadata only; see [Contract ABI](contract-abi.md). |

There is no gas parameter: a top-level `EXECUTE` has no gas-limit field on the wire. Its ceiling is
the protocol gas ceiling except when `EXECUTE_NATIVE_METERED_GAS_ACTIVATION` makes a smaller native
fee output the paid gas budget. Wallets should ignore a `gas` query parameter if a link carries one
and size a native fee output through the indexer quote.

#### Examples

| URI | Meaning |
| :--- | :--- |
| `xchain:TBTC/execute?contract=500&method=fund` | Open the EXECUTE form on Bitcoin testnet targeting contract 500, method `fund` pre-selected. |
| `xchain:RBTC/execute?contract=362&method=release&params=alice%7C42` | Regtest contract 362, `release("alice","42")` pre-filled. |

### multisig-sign

Open the wallet's multisig signing session for one validated request envelope. The link is `xchain://multisig-sign?req=<req>` with no coin code; `multisig-sign` is the host and the path is empty or `/`.

| Param | Required | Description |
| :--- | :--- | :--- |
| `req` | Yes | Unpadded base64url encoding of the UTF-8 JSON for one multisig PSBT envelope. Its `kind` is `multisig-request-signature`, `multisig-request-nonce`, or `multisig-request-partial`; reply and finalized envelopes are refused. The value contains only base64url characters (`A-Z`, `a-z`, `0-9`, `_`, `-`) and is at most 1,048,576 characters. `req` is a plain parameter, not a BIP21 `req-` required-parameter prefix. |

The wallet checks this form before parsing the legacy path-style `xchain://<chainId>/<tick>` form. A valid link routes to the multisig signing session with the link filled in; a malformed link is refused instead of opening any other screen.

#### Examples

| URI | Meaning |
| :--- | :--- |
| `xchain://multisig-sign?req=eyJ2IjoxLCJraW5kIjoibXVsdGlzaWctcmVxdWVzdC1zaWduYXR1cmUiLCJmaW5nZXJwcmludCI6ImU3MzJlNGRlNTlkNGJmYjY4NGNmNTgwNTkzNmM4MTZkMTYyYzk2YTcxYjc4MDE2Zjk5YjdkNWE3ZWY5Njc3M2EiLCJzZXNzaW9uUmVmIjp7InNjaGVtZSI6InAyc2gtbXVsdGlzaWciLCJ0aHJlc2hvbGQiOjIsImNvc2lnbmVyUHVia2V5cyI6WyIwMjExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEiLCIwMzIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIiXSwibXNnSGFzaCI6IjMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMiLCJwc2J0SGV4IjoiIn19` | Open a multisig signing session from one `multisig-request-signature` envelope. |

### request

Ask the wallet to approve one site request. The link is `xchain:request?v=1&req=<req>` with no coin code. `v` is required and MUST be exactly `1`. A wallet that does not recognize `v` or the requested method shows a "needs a newer wallet" message and opens nothing.

`req` is the unpadded base64url encoding of the UTF-8 JSON request envelope. It is a plain parameter, not a BIP21 `req-` required-parameter prefix. The envelope has a closed set of keys; a wallet MUST refuse a link containing an unknown envelope key.

| Key | Required | Description |
| :--- | :--- | :--- |
| `v` | Yes | Envelope version. MUST be the number `1`. |
| `id` | Yes | 128 random bits identifying a single-use request. The wallet MUST refuse reuse. |
| `method` | Yes | One of `login`, `signMessage`, `signAction`, or `signPsbt`. |
| `params` | Yes | Parameters for the named method. |
| `return` | Conditional | Browser return URL. At least one of `return` and `callback` is required. |
| `callback` | Conditional | Server callback URL. At least one of `return` and `callback` is required. |
| `state` | No | Opaque state returned with the answer so the site can correlate the request. |
| `exp` | Yes | Expiration time, at most 10 minutes ahead. The wallet rechecks it when the approval page appears. |
| `app` | No | Object containing `{name}` for secondary display text. It is never identity. |
| `browser` | No | One of `chrome`, `firefox`, `edge`, `safari`, or `samsung`. It is only an iOS return hint and never identity. |

At least one of `return` and `callback` is required. When both are present, they MUST share one origin, and the wallet shows that origin during approval. Both URLs MUST use HTTPS, except that Developer Mode permits HTTP for localhost. Neither URL may contain credentials or a fragment, and each is limited to 2,048 characters. A complete published HTTPS link is limited to 16,384 characters.

Sites publish the request wrapped as `https://wallet.xchain.io/link/?uri=<percent-encoded link>`. The wallet also accepts the `https://xchain.io/wallet/link/` form. The answer goes back by browser return in the `#xchain=` fragment of `return` and by server callback as an HTTPS POST to `callback`. Both response paths are described in the [wallet integration guide](../developer-guide/wallet-integration.md).

#### Examples

| URI | Meaning |
| :--- | :--- |
| `xchain:request?v=1&req=eyJ2IjoxLCJpZCI6IjRmNmEzZDJjMWIwZTQ5NzhhNWM2ZDdlOGY5MDEyMzQ1IiwibWV0aG9kIjoibG9naW4iLCJwYXJhbXMiOnsic2NvcGUiOiJhY2NvdW50In0sInJldHVybiI6Imh0dHBzOi8vYXBwLmV4YW1wbGUuY29tL3dhbGxldC1yZXR1cm4iLCJzdGF0ZSI6ImU3YjRjMmE5IiwiZXhwIjoxNzk1MzIxODAwLCJhcHAiOnsibmFtZSI6IkV4YW1wbGUgQXBwIn0sImJyb3dzZXIiOiJzYWZhcmkifQ` | Request login approval for Example App and return the answer to its HTTPS browser return URL. |

## Compatibility

### BIP21 alongside

Plain BIP21 URIs (`bitcoin:`, `litecoin:`, `dogecoin:`) remain fully supported as a parallel format. External wallets that only speak BIP21 can still pay an XChain address by scanning a bare-address BIP21 QR. The wallet generates a BIP21 URI by default when no XChain-specific customization (token, action, etc.) is set, maximizing interoperability with non-XChain wallets.

The wallet's BIP21 parser recognizes the XChain extension parameters `tick` and `chain` and surfaces them on the Send screen if present, so a `bitcoin:bc1q…?tick=PEPECREATURE` URI works too, with the caveat that external wallets ignore the extension.

| URI form | Recommended for |
| :--- | :--- |
| `xchain:<CODE>/<action>?…` | XChain-to-XChain QRs that need to carry chain, token, amount, or non-send actions |
| `bitcoin:<addr>?amount=…` (and `litecoin:` / `dogecoin:`) | Bare-address payment requests intended to work with any wallet, not just XChain wallets |

### Legacy path-style form

Older QRs may use the path-style form:

```
xchain://<chainId>/<tick>?amount=&to=&memo=&kind=receive
```

Where `<chainId>` is the descriptor id (e.g. `bitcoin-mainnet`). Wallets MUST accept this form for backwards compatibility but SHOULD NOT generate new QRs in this format. The coin-code opaque form is preferred for new QRs because it's shorter, uses the platform-wide short identifier, and surfaces the action explicitly.

The full descriptor-to-coin-code mapping:

| `<chainId>` descriptor | Coin code |
| :--- | :--- |
| `bitcoin-mainnet` | `BTC` |
| `bitcoin-testnet` | `TBTC` |
| `bitcoin-regtest` | `RBTC` |
| `litecoin-mainnet` | `LTC` |
| `litecoin-testnet` | `TLTC` |
| `litecoin-regtest` | `RLTC` |
| `dogecoin-mainnet` | `DOGE` |
| `dogecoin-testnet` | `TDOGE` |
| `dogecoin-regtest` | `RDOGE` |

Wallets parsing the legacy form SHOULD translate the `<chainId>` to its coin code using this table before routing, then treat the URI as equivalent to the opaque form.

## Versioning Rules

The URI scheme follows semantic versioning. The current version is **v1.1.0**, which adds the `request` action while preserving every v1.0.0 URI form.

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
