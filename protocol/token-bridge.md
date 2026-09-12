<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform: Token Bridge

The [Cross-Chain Bridge](./xchain-bridge.md) gives XCHAIN, the platform's own fee token, a
shadow balance on every chain it runs on. This document describes the same mechanism opened up
to any issuer's token: one supply on its origin chain, provably backed one for one in a
protocol-owned escrow, with shadow balances anyone can mint and redeem elsewhere. See
[`XBRIDGE`](./actions/xbridge.md) for the wire action (versions `3`, `4` and `5`) and
[Token Bridge](../concepts/token-bridge.md) for the issuer-facing explanation.

## Who this is for

- **Quote assets.** A stablecoin issuer who issues on one chain and wants the same supply
  spendable on the others, so every token on those chains can be listed against it locally with
  no `COINPAY` leg.
- **Project tokens.** An issuer with a community on more than one chain who wants one supply and
  one price rather than three independent issuances that drift apart.

## Principle

Nothing here is specific to XCHAIN except which chain is the origin. The origin chain is
wherever the token was issued (`ISSUE`, not necessarily BTC): its escrow lives there, lock
happens there, burn happens on a bridged copy, and a copy never bridges onward. Spoke-to-spoke
travel is two hops through the origin, so every token has exactly one escrow and the invariant
stays per token per destination chain, exactly as it does for XCHAIN.

No key can touch a bridged row. The escrow is the origin chain's keyless role address
(`ADDRESS.BRIDGE_<COIN>`); the bridged copy on the destination is owned by that chain's own
keyless bridge role address, not by any issuer key. An owner key could set lists, bind a
controller, or transfer the row, all of which milestone 1 keeps off the bridged copy entirely
(see [What does not generalize](#what-does-not-generalize)). With a keyless owner, nobody can,
and the row's own locks are belt and braces.

## Naming: the bridged row lives under its origin chain's root

The bare-name question decides whether this is usable at all: three options were weighed, and
only one survives a squatter.

- **Same bare name, required free on every destination.** Fails the day one squatter registers
  the name on one chain for one issuance fee; a stablecoin's expansion would be blockable by
  anyone.
- **A mapping registry.** Nothing on the wire says two tokens on two chains are one asset, the
  map is state somebody has to administer, and it confuses users.
- **Origin-rooted namespace (adopted).** A token native to BTC lands on DOGE and LTC as
  `BTC.<NAME>`; a token native to DOGE lands on BTC as `DOGE.<NAME>`.

`BTC`, `LTC` and `DOGE` are reserved ticks on every chain, and the platform's subasset parent
gate refuses any child whose parent does not exist or is owned by another address. The bridge
creates the root row itself the first time a token from that origin arrives: protocol-owned,
supply zero, every lock set. From that block a user `ISSUE` of `<COIN>.anything` on that chain
fails with the ordinary parent-owner refusal, and no new guard is needed for children. This is
the same origin-badge convention wrapped tokens use elsewhere: the name on the wire says where
the asset is native, there is no registry, and squatting cannot block anyone. Wallets and
explorers render the bare name with an origin badge (`BTC.PEPECASH` shows as "PEPECASH,
bridged from BTC"). The one bare-name exception is XCHAIN itself, reserved on every chain and
needing no root.

### Two limits in milestone 1

Both are refused at lock time, so no transfer can strand:

- **Dotted origin names.** A subasset (`BTC.PEPE.CASH`) would need an intermediate row the
  bridge does not yet create; a lock or opt-in of a dotted native tick is refused with
  `invalid: TICK (subassets are not bridgeable yet)`. A later milestone walks the prefix and
  creates the missing intermediate rows.
- **Length.** A native tick that would not fit once rooted (origin prefix plus a dot) is refused
  with `invalid: TICK (too long to bridge)`.

## The bridged row on the destination

Created by the first settle leg for that tick on that chain, the way the XCHAIN row is created
on first use:

1. **The root row** (`<ORIGIN>`), if absent: owned by this chain's own bridge role address for
   that origin, uncapped supply, zero decimals, every lock set, mint permanently disabled. One
   per origin chain per destination chain, ever.
2. **The child row** (`<ORIGIN>.<NAME>`): the same owner and locks, decimals taken from the
   signed transfer record, uncapped supply (nothing off the origin can ever mint it, and a
   copied cap would go stale the moment the origin's own `MAX_SUPPLY` changes). Nothing else is
   copied from the origin: the bridged row starts with no description, no lists, no
   controller.

If the child row already exists, a later settle leg compares the signed decimals against it:
equal applies normally; unequal with zero supply re-parameterizes the row (the same rule every
token gets: decimals may move until supply exists); unequal with supply refuses the leg outright
and logs it, rather than silently drifting two chains' views of the same token's precision.

Supply on a bridged row moves only by a settle-in (up) and a burn (down): a broadcast `ISSUE` of
a coin-rooted tick is refused by the ordinary parent-ownership gate, and a `DESTROY` of a bridged
row is refused in favor of the burn leg of `XBRIDGE`.

## Issuer opt-in

Bridgeability is a property the token owner sets on the origin row, **default off**, through
[`ISSUE` format `7`](./actions/issue.md#version-7---bridge-opt-in):

- `BRIDGE_CHAINS`: which destination chains a lock may target. Empty means unchanged, so a
  later format `7` can extend the list without restating it.
- `MIN_DEPTH`: a confirmation depth the federation must honour for this token's locks, on top of
  the platform default; raise-only, never lower.
- `LOCK_BRIDGE`: freezes both fields forever, the holder's assurance against the owner (and
  against a new owner after an ownership transfer, which inherits both fields).

A lock checks the origin row's `BRIDGE_CHAINS` at its own block; a destination not on the list
is refused with `invalid: TICK (not bridgeable to DEST_COIN)`. `MIN_DEPTH` is stamped onto the
pending transfer at lock time and never re-read later, so an issuer raising it afterward can
never make an already-accepted lock un-signable. Removing a chain from `BRIDGE_CHAINS` only
stops new locks; it never touches balances already bridged, and burns are always allowed, so an
issuer can close a door but never strand anyone on the other side of it.

## What does not generalize

- **Trust.** [Cross-Chain Bridge: Trust model](./xchain-bridge.md#trust-model) applies
  unchanged, and matters more here: XCHAIN's milestone-1 hub-trusted mint is a statement about
  the platform's own token. A third-party issuer bridging real value should read that section
  before opting in. This spec arms nowhere before the checkpoint cross-check described there is
  built and armed on that network.
- **Reorg finality.** An applied mint is final and the origin escrow can drop on a reorg (see
  [Reorgs and finality](./xchain-bridge.md#reorgs-and-finality)). For a third-party token that is
  the issuer's own unbacked liability, not the platform's; `MIN_DEPTH` is the issuer's own price
  for that risk, and the token's page shows it.
- **Issuer policy across chains.** Allow lists, block lists, controller bindings and sleep live
  on the origin row and, in milestone 1, do not carry to a bridged copy at all. A regulated
  issuer who needs a block on one chain to also hold on another cannot rely on this milestone.
  Milestone 1 keeps the two states mutually exclusive rather than silently under-enforcing: a
  token with any live list or controller binding cannot opt into bridging, and a bridged token
  cannot set one. Sleep is chain-local by the same reasoning: sleeping the origin stops new
  locks but never touches outstanding copies, which keep trading, and burns still release.
  Behind `TOKEN_POLICY_INHERITANCE_ACTIVATION` the list and sleep half of this exclusion lifts;
  see [Policy inheritance](#policy-inheritance) below. Controller bindings never lift on their
  own (a controller names a local contract; nothing about it is portable to another chain).

**Milestone ladder:** plain, undotted tokens with no policy first; then activation on a proven
network; then policy inheritance and generic (any-coin) lists; mainnet arming last, gated the
same way XCHAIN's own bridge is.

## Policy inheritance

Once `TOKEN_POLICY_INHERITANCE_ACTIVATION` is active on a network, a token's allow list, block
list and sleep state are no longer mutually exclusive with bridging: the issuer's policy is
signed once on the origin row and **inherited** on every bridged copy, never re-issued per
chain. See the platform's `policy-propagation` specification for the full mechanism; the
shape that matters to a reader of this page:

- **One list, everywhere.** The origin's `ALLOW_LIST` and `BLOCK_LIST` membership is signed by
  the `cross_chain` quorum into a `policy_snapshots` row (the same mirror channel
  `bridge_transfers` rides) and materialized on each destination as its own local lists, owned
  by that chain's bridge role address so no user key can edit them (`invalid: LIST_ACTION_INDEX
  (bridge-owned)`, [`LIST`](./actions/list.md)). Sleep carries the same way, as an injected
  `SLEEP`.
- **A confirmed lag, not a live mirror.** Between an origin-side edit and its effect on a copy:
  the origin's own confirmation depth, a signing round, the mirror, and an `effective_time`
  margin, the same discipline a bridge lock's own finality already accepts. The copy enforces
  the *previous* policy for that window; nothing is retroactive.
  `getappliedpolicy(tick)` (indexer, open read) shows exactly what a given chain has applied and
  as of which origin block.
- **A membership ceiling.** A token whose `ALLOW_LIST` or `BLOCK_LIST` exceeds
  `XPOLICY_MAX_MEMBERS` (10,000 addresses) cannot opt into bridging in the first place
  (`invalid: TICK (policy list exceeds XPOLICY_MAX_MEMBERS)`, [`ISSUE` format
  `7`](./actions/issue.md)); every snapshot and every destination materialization carries the
  full membership, so this bounds both the mirror's transport size and the write amplification
  on every chain holding a copy.
- **Any-coin list items.** Because one list now has to be enforced identically on every chain a
  token has a copy on, a `LIST` of type `ADDRESS` accepts an address of *any* coin the platform
  runs, not only the chain it was broadcast on; see [`LIST`](./actions/list.md).
- **Controller bindings are the one thing that still does not travel.** A controller names a
  local contract deployed on one chain (`utility.js` runs its `guard` in that chain's own VM);
  nothing about a snapshot can make that contract exist elsewhere. A controller-bound token
  cannot opt into bridging and a bridged token cannot bind one, under this activation or any
  later one, without a separate controller-portability build the platform does not carry today.

## Reads and surfaces

`getbridgeinvariant` (hub) takes an optional tick and, without one, returns the map keyed by
tick with XCHAIN always present. `getpendingbridgetransfers` and `getbridgetransfer` (indexer)
gain the tick, decimals, and effective confirmation depth fields the general case needs. The
explorer, SDK and wallet surfaces are the same ones XCHAIN's own bridge uses, extended with a
tick dimension; see [Token Bridge](../concepts/token-bridge.md) for the issuer- and
holder-facing view.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
