<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Creating Tokens on XChain

Anyone can create a digital token on Bitcoin, Litecoin, or Dogecoin using XChain. No programming skills required. This guide explains what tokens are, how to configure them, and what choices you make when bringing a new token into existence.

---

## What Is a Token?

A token is a digital asset that you define and control. Think of it like issuing your own currency, loyalty points, membership pass, or digital collectible, except instead of a bank or company managing the records, the blockchain does. Every token balance, every transfer, every rule change is recorded permanently on Bitcoin, Litecoin, or Dogecoin.

Once created, your token can be sent between addresses, traded on the built-in exchange, distributed to thousands of people at once, or used as the basis for a business application. The rules you set at creation determine what anyone (including you) can do with it later.

---

## Choosing a Token Name (Ticker)

Every token has a **ticker**; a short name that identifies it, similar to a stock symbol. Tickers on XChain can be 1 to 250 characters long.

A few things to know when choosing a name:

- **Names are unique per blockchain.** If someone already created a token called `GOLD` on Bitcoin, you cannot create another `GOLD` on Bitcoin. You could, however, create `GOLD` on Litecoin, since each chain has its own independent namespace.
- **First come, first served.** The first valid creation wins the name. There is no registration process or approval; it is simply a race to be first.
- **Case does not matter for lookups.** `MYTOKEN`, `mytoken`, and `MyToken` all refer to the same ticker. The name is stored as you typed it, but searches are case-insensitive.
- **Only certain characters are allowed.** A ticker may use letters (`a-z`, `A-Z`), digits (`0-9`), and the punctuation `~ ! @ # $ % ^ & * ( ) _ + - = { } [ ] : < > . ?`. Everything else is rejected, so a space, a comma, an apostrophe, a quotation mark, `|`, `;`, `/`, or `\` will fail; `MY TOKEN` and `GOLD,SILVER` are not valid names. A period (`.`) is allowed and is used to create sub-tokens (see below), but it cannot appear at the start or end of a name.
- **Some names are reserved.** The tickers `BTC`, `LTC`, `DOGE`, and `XCHAIN` are reserved for the platform itself and cannot be issued by anyone except the platform's designated accounts.

---

## Sub-Tokens

If you add a parent token name followed by a period and a suffix (for example `MYTOKEN.SILVER`) you create a **sub-token**. Sub-tokens are cheaper to create than top-level tokens and are useful for organizing related assets under a common brand.

Think of a parent token like a company, and sub-tokens like individual product lines under that company. The naming connection is enforced by the protocol, not just a convention: `MYTOKEN` must already exist, and only its current owner can create `MYTOKEN.SILVER`, so nobody else can register a direct child of a name you hold. The rule applies one level at a time: `MYTOKEN.SILVER.COIN` is gated on whoever owns `MYTOKEN.SILVER`, so once you sell a sub-token its new owner controls the names beneath it. Creation is also refused while the parent's ownership is escrowed in an open ownership offer.

Each sub-token gets its own ownership record once it exists. Selling `MYTOKEN` does not hand over the sub-tokens already issued under it, and selling `MYTOKEN.SILVER` does not give the buyer any claim on the parent.

---

## Setting Token Properties

When you create a token, you configure a set of properties that define how it behaves. You do not have to set all of them at once; most can be updated later unless you choose to lock them.

### Supply

**Max Supply** is the ceiling on how many tokens can ever exist. Once that ceiling is reached through minting, no more can be created. Think of it like a gold mine with a finite amount of gold; once it is dug out, there is no more.

Setting a max supply of zero means the supply is unlimited, which is appropriate for some use cases (like reward points that grow over time) but not others (like collectibles where scarcity matters).

### Decimals

**Decimals** control how divisible your token is. A token with 0 decimals can only exist in whole units. A token with 8 decimals can be divided into hundred-millionths, like Bitcoin itself.

If you are creating a loyalty points system where you only want whole points, set decimals to 0. If you are creating a financial instrument that might be fractionally owned, higher decimals give you flexibility.

### Description

A short text description of your token. This appears in explorers and wallets. Keep it clear and accurate; it is the first thing people will read when they encounter your token.

---

## Minting Rules

**Minting** is the act of creating new tokens and adding them to circulation. You set the rules for how minting works at creation time.

- **Mint Supply**: How much supply is issued straight to you at the moment you create the token, up to Max Supply. For example, if mint supply is 100, creating the token credits you 100 tokens. This is your own issued supply, not the amount a public mint produces; editing the token issues that much again unless you lock it.
- **Max Mint**: The largest amount of supply any single mint transaction may create. It caps how much one mint produces, not how many mints can happen; left unset (`0`) there is no per-transaction cap and Max Supply is the only ceiling.
- **Mint Start Block / Mint Stop Block**: You can schedule a minting window. Before the start block, minting is not allowed. After the stop block, minting closes. This is how you run a timed token launch; a window opens, people mint during it, and it closes automatically.
- **Per-Address Limit**: You can cap the total amount a single address is allowed to mint, added up across every mint that address makes. This prevents one person from minting everything in a public launch.

If you want to be the only person who can mint (a controlled issuance), you keep the token locked down and mint from your own address. If you want a public fair launch where anyone can mint, you set open minting rules and let the community participate.

---

## Access Control

You can restrict which addresses are allowed to interact with your token. The lists gate **both sides** of a transfer: an address that fails the check can neither receive the token nor send tokens it already holds.

**Allow List**: Only addresses on this list can send or receive the token. Everyone else is blocked. This is useful for compliance-restricted assets, private token distributions, or anything where you need to know exactly who holds your token.

**Block List**: Addresses on this list are barred from sending or receiving the token. Everyone else can transact normally. This is useful for blocking specific bad actors while keeping the token open to the general public.

Because the sending address is checked too, taking a holder off the allow list (or adding them to the block list) freezes the balance they already hold: they keep it, but they cannot move it until the lists change.

Both lists reference named lists you define on-chain using the LIST action. You can update these lists at any time, unless you choose to lock them permanently.

---

## Programmable Policy (Controllers)

Allow and block lists answer "who may hold this token." If your rules need to go further than a list of addresses, you can bind your token to a **controller**: a contract you deploy on-chain that gets the final say over specific kinds of action.

Before a bound action settles, the network runs the controller's guard. The guard can let the action through, deny it outright, or, on a sale, attach a split that routes part of the seller's proceeds to addresses it names. That last one is how enforced royalties, marketplace fees and revenue share are expressed; there is no separate royalty setting.

You choose which kinds of action a controller gates:

- **transfer**: sends of the token
- **trade**: creating an order, a swap, or a dispenser
- **burn**: destroying supply
- **mint**: creating new supply
- **stake**: staking the token into a contract
- **ownership**: handing over the token's ownership record

There is also **all**, a catch-all you can bind on its own or underneath the specific classes. Exactly one guard ever runs for any action: the most specific binding wins, and `all` is the fallback for any class you have not bound directly. Binding `all` is therefore a single action that gates everything, which is what makes it a "freeze this token entirely" or "compliance-gate everything" policy.

Four things to know before you bind one:

- **It is opt-in.** A token with no binding behaves exactly as it always has, with no added fee and no added overhead.
- **It fails closed.** If the guard denies, errors, or runs out of gas, the action does not happen and anything the guard did is rolled back.
- **The actor pays for it.** Whoever broadcasts the action pays the guard's gas, up to a bounded ceiling.
- **Only you can bind or drop one**, and dropping is subject to a cooldown you commit to at bind time: the binding keeps applying until that many blocks have passed.

See [Controller-Bound Tokens](../protocol/controller-bound-tokens.md) for the full mechanics.

---

## Building Trust: Locking Parameters

One of the most powerful features in XChain is the ability to **lock** a parameter permanently. Once locked, that parameter can never be changed. Not by you, not by anyone.

Why would you want to lock your own token? Because it builds trust.

Imagine you are launching a collectible token and you tell buyers "only 10,000 will ever exist." That is a promise. If you lock the max supply, it becomes a verifiable, unbreakable guarantee written into the blockchain itself. Buyers do not have to trust your word; they can verify the lock themselves.

Parameters you can lock include:

- **LOCK_MAX_SUPPLY**: the `MAX_SUPPLY` ceiling can never be raised, proving the total cannot be inflated beyond what is set now
- **LOCK_MINT**: no one can ever run the MINT command against this token again, so no new supply can ever be created
- **LOCK_MINT_SUPPLY**: the token is frozen against you issuing any further supply to yourself via `MINT_SUPPLY`; public minting is unaffected
- **LOCK_MAX_MINT**: the `MAX_MINT` per-transaction amount cap is frozen permanently and can never be edited again
- **LOCK_DESCRIPTION**: proves the token's description cannot be swapped out
- **LOCK_SLEEP**: the token can never be paused by the SLEEP command; useful for tokens that must always be tradeable
- **Callback settings** (`LOCK_CALLBACK`): proves the recall terms cannot be altered after the fact

Locking is a one-way door. Think carefully before locking anything. Once it is done, there is no going back. Not even for you.

One thing the lock flags do not cover is a **controller binding**. There is no `LOCK_CONTROLLER`, so a binding cannot be frozen the way a max supply can, and one can be added to a token after it has been issued. The drop-cooldown you commit to at bind time is the only friction on changing or removing one. Anyone weighing up a token's guarantees should read its bindings alongside its locks.

---

## Token Ownership

The address that creates a token owns it. The owner can:

- Update any unlocked parameters
- Lock parameters permanently
- Transfer ownership to a different address

Transferring ownership is done through an update to the token, changing the registered owner.

---

## Fees

Creating a token costs a protocol fee. The fee is *priced* in **XCHAIN**, the platform's gas token, but on every chain you can *pay* it in that chain's own coin: bitcoin, litecoin, or dogecoin. The network's price oracle converts the amount at the moment you act, so you do not have to acquire XCHAIN before you can create a token.

On **Litecoin and Dogecoin, paying in the native coin is the only option**: an action submitted without a native-coin fee output is rejected. On **Bitcoin** you may instead have the fee deducted from an XCHAIN balance, if you hold one and prefer that.

Either way you also need a small amount of the underlying coin to cover the ordinary miner transaction fee, exactly as you would for any transaction on that chain. See [Gas and Fees](../concepts/gas.md) for the full schedule.

---

## After Creation

Once your token exists, you can:

- **Mint** more supply (subject to the rules you set)
- **Send** tokens to other addresses
- **Update** any parameters you did not lock
- **List** it on the built-in exchange (see the Trading guide)
- **Airdrop** it to a list of addresses at once
- **Pay dividends** to all holders proportionally
- **Sleep** it temporarily to pause all trading
- **Callback** (recall) tokens from all holders if you configured a callback at creation
- **Bind a controller** to hand enforcement of transfers, trades, mints, burns, staking, or ownership changes to a contract you deploy, and drop it later subject to the cooldown you set

Your token lives on the blockchain permanently. Even if every XChain node went offline, the token records remain embedded in Bitcoin, Litecoin, or Dogecoin transactions forever.

---

*See also: [Trading](./trading.md) | [Betting](./betting.md) | [Use Cases](./use-cases.md) | [FAQ](./faq.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
