<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - ISSUE
This action creates or updates a `TICK`.

> **Wallet issuer flow.** The [xchain-wallet](https://github.com/XChain-Platform/xchain-wallet) ships a *Manage Token* surface (per-token admin page reachable from *My Tokens*) that wraps the issuer actions: `ISSUE`, `MINT`, `DESTROY`, `DIVIDEND`, `AIRDROP`, `BROADCAST`, supply/description locks, ownership transfer, dispenser creation, in a guided UI with owner-gate and confirm-prelude steps. The protocol-level fields below are the canonical source; the wallet is one of several clients that can build these transactions.

## PARAMS
| Name               | Type   | Description                                                                                |
| ------------------ | ------ | ------------------------------------------------------------------------------------------ |
| `VERSION`          | String | Format Version                                                                             |
| `TICK`             | String | Ticker name or Ticker ID                                                                   |
| `MAX_SUPPLY`       | String | Maximum token supply                                                                       |
| `MAX_MINT`         | String | Maximum amount of supply a `MINT` transaction can issue                                    |
| `DECIMALS`         | String | Number of decimal places token should have (max: 18, default: 0)                           |
| `DESCRIPTION`      | String | Description of token (249 chars max)                                                       |
| `MINT_SUPPLY`      | String | Amount of token supply to mint in immediately (default:0)                                  |
| `TRANSFER`         | String | Address to transfer ownership of the `TICK` to (owner can perform future actions on token) |
| `TRANSFER_SUPPLY`  | String | Address to transfer `MINT_SUPPLY` to (mint initial supply and transfer to address)         |
| `LOCK_MAX_SUPPLY`  | String | Lock `MAX_SUPPLY` permanently (cannot increase `MAX_SUPPLY`)                               |
| `LOCK_MAX_MINT`    | String | Lock `MAX_MINT` permanently (cannot edit `MAX_MINT`)                                       |
| `LOCK_MINT`        | String | Lock `TICK` against `MINT` command                                                         |
| `LOCK_MINT_SUPPLY` | String | Lock `TICK` against issuing additional supply via `MINT_SUPPLY`                            |
| `LOCK_DESCRIPTION` | String | Lock `TICK` against `DESCRIPTION` changes                                                  |
| `LOCK_SLEEP`       | String | Lock `TICK` against `SLEEP` command                                                        |
| `LOCK_CALLBACK`    | String | Lock `TICK` against `CALLBACK` command                                                     |
| `CALLBACK_BLOCK`   | String | Enable `CALLBACK` command at or after `CALLBACK_BLOCK`                                     |
| `CALLBACK_TICK`    | String | `TICK` that users get when `CALLBACK` command is used                                      |
| `CALLBACK_AMOUNT`  | String | `CALLBACK_TICK` amount that users get when `CALLBACK` command is used                      |
| `ALLOW_LIST`       | String | `ACTION_INDEX` of a `LIST` of addresses allowed to interact with this token                |
| `BLOCK_LIST`       | String | `ACTION_INDEX` of a `LIST` of addresses NOT allowed to interact with this token            |
| `MINT_ADDRESS_MAX` | String | Maximum amount of supply any address can mint via `MINT` transactions                      |
| `MINT_START_BLOCK` | String | First `BLOCK_INDEX` at which `MINT` transactions are allowed (begin mint, inclusive)       |
| `MINT_STOP_BLOCK`  | String | Last `BLOCK_INDEX` at which `MINT` transactions are allowed (end mint, inclusive)          |
| `CONTROLLER`       | String | `ACTION_INDEX` of a deployed contract whose `guard` gates one `ACTION_CLASS` of this token (see [Controller-Bound Tokens](../controller-bound-tokens.md)) |
| `ACTION_CLASS`     | String | Which class the binding gates: `transfer`, `trade`, `burn`, `mint`, `stake`, `ownership`, or the catch-all `all` (fallback for any class with no specific binding; most-specific-wins) |
| `COOLDOWN_BLOCKS`  | String | Drop-cooldown committed at bind time: blocks of friction before a later `UNBIND` takes effect |
| `UNBIND`           | String | `1` drops the live binding for `ACTION_CLASS`; `0` binds                                    |
| `BRIDGE_CHAINS`    | String | Comma list of destination coins this `TICK` may bridge to via [`XBRIDGE`](./xbridge.md), or `-` for none; empty means unchanged |
| `MIN_DEPTH`        | String | Confirmation depth the federation must honour for this `TICK`'s bridge locks, raise-only over the platform default; empty means unchanged |
| `LOCK_BRIDGE`      | String | `1` permanently locks `BRIDGE_CHAINS` and `MIN_DEPTH`                                       |
| `MEMO`             | String | An optional memo to include                                                                |

## Formats

### Version `0`
- `VERSION|TICK|MAX_SUPPLY|MAX_MINT|DECIMALS|DESCRIPTION|MINT_SUPPLY|TRANSFER|TRANSFER_SUPPLY|LOCK_MAX_SUPPLY|LOCK_MAX_MINT|LOCK_DESCRIPTION|LOCK_SLEEP|LOCK_CALLBACK|CALLBACK_BLOCK|CALLBACK_TICK|CALLBACK_AMOUNT|ALLOW_LIST|BLOCK_LIST|MINT_ADDRESS_MAX|MINT_START_BLOCK|MINT_STOP_BLOCK|LOCK_MINT|LOCK_MINT_SUPPLY|MEMO`

### Version `1` - Edit `DESCRIPTION`
- `VERSION|TICK|DESCRIPTION|MEMO`

### Version `2` - Edit `MINT` `PARAMS`
- `VERSION|TICK|MAX_MINT|MINT_SUPPLY|TRANSFER_SUPPLY|MINT_ADDRESS_MAX|MINT_START_BLOCK|MINT_STOP_BLOCK|MEMO`

### Version `3` - Edit `LOCK` `PARAMS`
- `VERSION|TICK|LOCK_MAX_SUPPLY|LOCK_MAX_MINT|LOCK_DESCRIPTION|LOCK_SLEEP|LOCK_CALLBACK|LOCK_MINT|LOCK_MINT_SUPPLY|MEMO`

### Version `4` - Edit `CALLBACK` `PARAMS`
- `VERSION|TICK|CALLBACK_BLOCK|CALLBACK_TICK|CALLBACK_AMOUNT|MEMO`

### Version `5` - Edit `LIST` `PARAMS`
- `VERSION|TICK|ALLOW_LIST|BLOCK_LIST|MEMO`

### Version `6` - Bind/unbind a `CONTROLLER` for one `ACTION_CLASS`
- `VERSION|TICK|CONTROLLER|ACTION_CLASS|COOLDOWN_BLOCKS|UNBIND|MEMO`

### Version `7` - Bridge opt-in
- `VERSION|TICK|BRIDGE_CHAINS|MIN_DEPTH|LOCK_BRIDGE|MEMO`

## Examples
```
ISSUE|0|JDOG
This example issues a JDOG token 
```

```
ISSUE|0|JDOG|1||||1|||1
This example issues a JDOG token with MAX_SUPPLY set to 1, Mints 1 token via MINT_SUPPLY, and has LOCK_MAX_SUPPLY set to 1 to permanently lock the MAX_SUPPLY
```

```
ISSUE|0|JDOG|0|0|0|http://example.com/images/JDOG_icon.png
This example issues a JDOG token with a DESCRIPTION which points to an icon
```

```
ISSUE|0|JDOG|0|0|0|http://example.com/images/JDOG_icon.png|0|1ExampleAddressXXXXXXXXXXXXXXXXXXX
This example issues a JDOG token with a DESCRIPTION which points to an icon, and transfers token ownership to 1ExampleAddressXXXXXXXXXXXXXXXXXXX
```

```
ISSUE|0|JDOG|1000|1|0
This example issues a JDOG token with a max supply of 1000, and a maximum mint of 1 JDOG per mint
```

```
ISSUE|0|JDOG|1000|1|0|BTNS Tokens Are Cool!
This example issues a JDOG token with a max supply of 1000, and a DESCRIPTION of 'BTNS Tokens are Cool!'
```

```
ISSUE|0|BRRR|10000000000000000000|10000000000000|0|https://example.com/json/JDOG.json|100
This example issues a BRRR token with a max supply of 1 Quandrillion supply and a maximum mint of 1 Trillion BRRR per mint, associates a JSON file with the token, and immediately mints 100 BRRR to the broadcasting address.
```

```
ISSUE|0|TEST|100|1|0||1|1ExampleAddressXXXXXXXXXXXXXXXXXXX|1ExampleAddressXXXXXXXXXXXXXXXXXXX
This example issues a TEST token with a max supply of 100, and a maximum mint of 1 TEST per mint. This also mints 1 TEST token, and transfers ownership AND initial token supply to 1ExampleAddressXXXXXXXXXXXXXXXXXXX
```

## Rules
- `TICK` must be 1 to 250 characters in length
- `TICK` characters allowed are :
   - Alphanumeric characters : a-zA-Z0-9
   - Special characters: ~!@#$%^&*()_+-={}[]:<>.?
- `TICK` characters **NOT** allowed are :
   - pipe `|` (used as field separator)
   - semicolon `;` (used as command separator)
   - backslash `\` (reserved)
   - slash `/` (used as directory indicator)
   - `^` (caret) cannot be used as first character in a `TICK` name (used as ticker id indicator)
- Period `.` is allowed inside a `TICK` name as the parent/child separator (e.g. `JDOG.SUB1`), but a `TICK` may not begin or end with a period
- First `ISSUE` with `valid` status will be the owner of the `TICK`
- Additional `ISSUE` transactions after first valid `ISSUE`, will be considered invalid and ignored, unless broadcast from `TICK` owners address
- `DECIMALS` can not be changed after `TICK` supply is issued and/or minted
- `MAX_SUPPLY` max value is 1,000,000,000,000,000,000,000 (1 Sextillion)
- `MAX_SUPPLY` can not be set below existing supply
- `LOCK_MAX_SUPPLY` can only be set to `1` when the token's `MAX_SUPPLY` is set (`MIN_TOKEN_SUPPLY` or greater), declared in the same `ISSUE` or already on the token record. Minted supply is NOT required: a fair-mint token may declare its `MAX_SUPPLY` and permanently lock it at issuance, before any supply exists. Setting `LOCK_MAX_SUPPLY` with no `MAX_SUPPLY` declared is invalid.
- On any chain other than BTC, a broadcast `ISSUE` of the `XCHAIN` (GAS) tick is refused with `invalid: TICK (BTC-only)`, from every source including the GAS address, on every network including regtest; the reserved-tick check is case-folded (`btc`, `BTC`, `Btc`, ... are all reserved everywhere), closing a gap where an exact-case check let a mismatched-case ticker through. System-injected creation of the tick (the [`XBRIDGE`](./xbridge.md) v2/v5 settle leg creating a chain's first shadow row) is exempt from this refusal: it is not a broadcast `ISSUE`. See [Cross-Chain Bridge](../xchain-bridge.md) and [Token Bridge](../token-bridge.md).
- **Reserving room for chains XChain integrates later.** Behind `TICK_NAMESPACE_ACTIVATION`, two further rules protect the short and chain-code namespace before a squatter can take it: a top-level `ISSUE` that would CREATE a brand-new tick shorter than four characters is refused with `invalid: TICK (length)` (editing or re-issuing an existing tick, including the `^id` form, is unaffected, so anything issued before the flag keeps its owner and supply); and a fixed list of future chain codes (`RESERVED_FUTURE_ROOTS`, e.g. `ETH`, `SOL`, `AVAX`, ...; see [Flag-Day Values](../flag-days.md) for the exact list) is reserved the same way `BTC`, `LTC` and `DOGE` already are, refused with `invalid: TICK (reserved)`. Both rules apply to top-level creation only; a subasset such as `ABCD.X` is unaffected by the length floor. Below the activation the handler is unchanged.
- **Format `7` refusals**, in addition to the field checks above: a destination not in `COINS` other than this chain is `invalid: BRIDGE_CHAINS`; a format `7` on a row with `LOCK_BRIDGE` already set is `invalid: BRIDGE_CHAINS (locked)`; a non-empty `BRIDGE_CHAINS` naming a native tick that contains a dot is `invalid: TICK (subassets are not bridgeable yet)`; a non-empty `BRIDGE_CHAINS` on a token carrying a live `ALLOW_LIST`, `BLOCK_LIST` or controller binding is `invalid: TICK (policy-bound tokens are not bridgeable yet)`; a non-empty `BRIDGE_CHAINS` whose `ALLOW_LIST` or `BLOCK_LIST` membership exceeds `XPOLICY_MAX_MEMBERS` (10,000) is `invalid: TICK (policy list exceeds XPOLICY_MAX_MEMBERS)`. Behind `TOKEN_POLICY_INHERITANCE_ACTIVATION` the policy-bound refusal lifts (see [Token Bridge](../token-bridge.md#policy-inheritance)); the controller refusal and the membership ceiling never lift on their own.
- **Formats `5` and `6` on a bridged token.** While a row's `BRIDGE_CHAINS` is non-empty or its `bridged` bit is set (the bit is set by the first applied bridge lock and never cleared), a format `5` (list edit) or format `6` (controller bind/unbind), and a format `0` re-issue carrying a non-empty `ALLOW_LIST` or `BLOCK_LIST`, are refused with `invalid: TICK (bridged tokens cannot be policy-bound yet)`. Emptying `BRIDGE_CHAINS` afterward does not reopen the door while bridged copies are outstanding. Behind `TOKEN_POLICY_INHERITANCE_ACTIVATION`, formats `5` and a listed format `0` on a bridged token apply and propagate to every bridged copy (see [Token Bridge](../token-bridge.md#policy-inheritance)); a controller bind (format `6`) on a bridged token stays refused either way.

## Notes
- `ISSUE` `TICK` with `MAX_SUPPLY` and `MINT_SUPPLY` set to any non `0` value, to mint supply until `MAX_SUPPLY` is reached (owner can mint beyond `MAX_MINT`)
- `ISSUE` `TICK` with `MAX_SUPPLY` and `MAX_MINT` set to any non `0` value, to enable user minting (fair minting)
- `ISSUE` `TICK` with `LOCK_MAX_SUPPLY` set to `1` to permanently lock `MAX_SUPPLY`
- `ISSUE` `TICK` with `LOCK_MAX_MINT` set to `1` to permanently lock `MAX_MINT`
- `ISSUE` `TICK` with `LOCK_MINT` set to `1` to permanently prevent use of the `MINT` command
- `ISSUE` `TICK` with `LOCK_SLEEP` set to `1` to permanently prevent use of the `SLEEP` command
- `ISSUE` `TICK` with `LOCK_CALLBACK` set to `1` to permanently prevent use of the `CALLBACK` command
- `DESCRIPTION` can contain a URL to a an icon to use for this token (48x48 standard size)
- `DESCRIPTION` can contain a URL to a JSON file with additional information
- `DESCRIPTION` can NOT contain any pipe `|` or semi-colon `;` characters, as these are reserved
- `CALLBACK_BLOCK`, `CALLBACK_TICK`, and `CALLBACK_AMOUNT` can be edited via `ISSUE` action if `TICK` supply is NOT distributed
- **Note on BRC20/SRC20 familiarity:** In BRC20 and SRC20, a `DEPLOY` command defines a new token. In XChain, `ISSUE` fills that role. XChain also has a separate [`DEPLOY`](./deploy.md) action, but that action deploys a smart contract to the XChain VM; it is not an alias for `ISSUE` and does not create a token. Clients migrating from BRC20/SRC20 should use `ISSUE` where they previously used `DEPLOY`.
- By default any `ADDRESS` can interact with a `TICK`, use `ALLOW_LIST` and `BLOCK_LIST` to change this behavior
- `CONTROLLER` binds the `TICK` to a deployed contract (its `ACTION_INDEX`) on the same chain for one `ACTION_CLASS` (`transfer`/`trade`/`burn`/...). Once bound, the indexer runs that contract's `guard` method before guarded native actions of that class settle: enabling enforced royalties, transfer policies, and other programmable rules. The contract must exist and be active when bound; a missing/throwing `guard` is fail-closed (denies the action). Bindings are append-only (use version `6` to bind or, with `UNBIND=1`, to drop one); the `COOLDOWN_BLOCKS` committed at bind time is the friction on a later unbind, so holders can gauge how durable the rules are. Full semantics: [Controller-Bound Tokens](../controller-bound-tokens.md)
- `MINT_ADDRESS_MAX` can be used to limit the maximum `TICK` `AMOUNT` that a single address can `MINT`
- `MINT_START_BLOCK` and `MINT_STOP_BLOCK` can be used to determine period(s) when `MINT` transactions are allowed
- `MINT_START_BLOCK` and `MINT_STOP_BLOCK` must be at or after the block the `ISSUE` confirms in; at/above the `ISSUE_INHERITED_MINT_WINDOW` activation (see [Flag-Day Values](../flag-days.md)) that check applies only when the `ISSUE` explicitly sets the field, so an owner can re-issue to update other parameters (for example `MAX_MINT`) after the mint window has opened without restating or moving the window
- `MIN_TOKEN_SUPPLY` value is 0.000000000000000001
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` fields (^1234 = `TICK_ID` 1234)
- Use `^` (caret) as prefix when passing an `ADDRESS_ID` for address fields (`TRANSFER`, `TRANSFER_SUPPLY`) (^57 = `ADDRESS_ID` 57); see [Index ID References](../index-id-references.md)
- `ISSUE` with `DECIMALS` `0` and `LOCK_MAX_SUPPLY` `1` is the standard non-fungible token (NFT) pattern: uniques, editions, and parent/child collections are defined in the [NFT Standard](../nft-standard.md)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
