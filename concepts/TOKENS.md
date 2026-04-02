<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Tokens

Tokens are the primary asset type on the XChain Platform. Any address on any supported chain can create a token, define its rules, and transfer it to others — all using standard blockchain transactions.

## Creating a Token with ISSUE

A token is brought into existence by an `ISSUE` ACTION. The issuing address becomes the token's owner and can update most parameters later — unless they have been locked.

Key parameters set at issuance:

| Parameter | Description |
|---|---|
| `TICK` | The ticker symbol. 1–250 characters. Case-insensitive in lookups, stored as-is. |
| `MAX_SUPPLY` | The ceiling on total supply. Can be up to 10^21 units. Once minted supply reaches this, no further minting is possible. |
| `DECIMALS` | Decimal precision, 0–18. A token with `DECIMALS=8` and a balance of `100000000` displays as `1.00000000`. |
| `MINT_SUPPLY` | How many units are created per `MINT` call. |
| `MAX_MINT` | Maximum number of times the token can be minted (caps total mints, not total supply). |
| `DESCRIPTION` | A short human-readable description. |
| `ALLOW_LIST` | Reference to a `LIST` of addresses permitted to hold or receive this token. If set, only listed addresses can receive transfers. |
| `BLOCK_LIST` | Reference to a `LIST` of addresses barred from receiving this token. |
| `MINT_START_BLOCK` | Block height before which minting is not allowed. |
| `MINT_STOP_BLOCK` | Block height after which minting is not allowed. |
| `MINT_ADDRESS_MAX` | Maximum cumulative mints allowed from a single address. |
| `CALLBACK_BLOCK` | Block height at which the issuer can force-recall tokens. |
| `CALLBACK_TICK` | The token paid to holders during a callback. |
| `CALLBACK_AMOUNT` | How much `CALLBACK_TICK` is paid per unit recalled. |

Only one token per ticker can exist on a given chain and network. The first valid `ISSUE` for a ticker wins; subsequent attempts from different addresses are rejected.

## Updating a Token

The token owner (the address that issued it) can update non-locked parameters by sending another `ISSUE` ACTION for the same ticker. Only parameters that are explicitly set in the update ACTION are changed; omitted parameters retain their current values.

This allows an issuer to, for example, open a mint window by setting `MINT_START_BLOCK` and `MINT_STOP_BLOCK` after the initial issuance, or to attach metadata after the token has been created.

## Locking Parameters

Any parameter can be **locked** — once locked, it cannot be changed by any subsequent `ISSUE`, even from the token owner. Locks are permanent and irreversible.

Locks are applied by including a lock flag in the `ISSUE` ACTION. Separate locks exist for:

- Supply locks (max supply, mint supply, max mint)
- Description lock
- Allow list / block list locks
- Callback lock
- Owner transfer lock (prevents ownership from ever being transferred)

Locking is a trust mechanism. A token with a locked max supply provably cannot be inflated. A token with a locked allow list provably cannot have its access rules changed. Users and integrations can rely on locked parameters without trusting the issuer.

## Supply Management

**Minting** adds tokens to circulation. A `MINT` ACTION, sent by any address (unless restricted), creates new units up to the `MAX_SUPPLY`. Minting is subject to:
- Mint windows (`MINT_START_BLOCK` / `MINT_STOP_BLOCK`)
- Per-address limits (`MINT_ADDRESS_MAX`)
- Total mint count limits (`MAX_MINT`)

The token owner mints from the issuance address; public minting (where any address can mint) is also supported, enabling fair-launch token distributions.

**Destroying** tokens removes them permanently. A `DESTROY` ACTION burns a specified amount from the sender's balance, reducing circulating supply. Destroyed tokens cannot be recovered.

## Access Control: Allow Lists and Block Lists

`ALLOW_LIST` and `BLOCK_LIST` reference `LIST` actions by their `ACTION_INDEX`. A list is a set of addresses or tickers defined on-chain.

- **Allow list**: Only addresses on this list may receive transfers of the token. Useful for compliance-restricted instruments or private token distributions.
- **Block list**: Addresses on this list cannot receive transfers. Useful for sanctions screening or preventing known bad actors from holding an asset.

Both lists can be updated unless locked. The `LIST` being referenced can itself be updated by its owner, making access control dynamic without requiring a new `ISSUE`.

## CALLBACK: Force-Recall

A token can be set up at issuance to support a forced recall at a future block. When the `CALLBACK_BLOCK` is reached, the issuer can invoke the `CALLBACK` ACTION, which:

1. Collects all outstanding token balances from every holder
2. Pays each holder a specified amount of `CALLBACK_TICK` per unit recalled

This mechanism supports instruments like bonds (repay principal at maturity), stablecoins with a redemption mechanism, or any token that has a defined end-of-life. The terms (callback block, exchange rate, payment token) are set at issuance and optionally locked, so holders know the terms before buying.

## SLEEP: Pause Trading

The `SLEEP` ACTION pauses all transfers and trading of a token until a specified block height. While a token is sleeping:

- Sends, sweeps, and airdrops of the token fail
- Order book and dispenser operations with the token fail
- The issuer can still issue or update token parameters

SLEEP is useful for scheduled maintenance, governance votes, or any scenario requiring a temporary freeze. It is time-bounded — trading resumes automatically at the specified resume block.

## Transfer Validation

Every transfer (SEND, SWEEP, AIRDROP, DIVIDEND, ORDER, DISPENSER) runs the same validation chain before any state change:

1. **Token exists**: The ticker must refer to a valid, issued token.
2. **Sufficient balance**: The sender must have enough available (unescowed) balance.
3. **Not sleeping**: The token must not be in a SLEEP period.
4. **Allow list check**: If the token has an allow list, the recipient must be on it.
5. **Block list check**: If the token has a block list, the recipient must not be on it.
6. **Memo check**: If the recipient has set a memo requirement via `ADDRESS`, the transfer must include a memo.

All checks must pass for a transfer to execute. Partial execution is not possible.

## Token Metadata: Token Information Standard

Token metadata — images, descriptions, links, audio, video — is stored off-chain and referenced by a URI in the token's description field. The [Token Information Standard](../protocol/Token_Information_Standard.md) defines the expected JSON schema for that metadata document, including fields for name, description, image, and various media types.

This keeps on-chain data minimal while enabling rich off-chain presentation in explorers and wallets.

## Reserved Tickers

The following tickers cannot be issued by any address except the designated GAS address for each chain:

| Ticker | Reserved for |
|---|---|
| `BTC` | Bitcoin |
| `LTC` | Litecoin |
| `DOGE` | Dogecoin |
| `XCHAIN` | The platform fee token |

See [Gas](./GAS.md) for details on the XCHAIN token and its special status.

---

*See also: [Ledger](./LEDGER.md) | [Gas](./GAS.md) | [ISSUE spec](../protocol/actions/ISSUE.md) | [Token Information Standard](../protocol/Token_Information_Standard.md)*

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
