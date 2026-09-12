<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Token Bridge

XChain runs on three chains, but a token is only ever issued on one of them. The token bridge
lets an issuer give their token a real, provably-backed presence on the others without splitting
its supply into three independent tokens that can drift apart in price. It is the same mechanism
that gives [XCHAIN](./gas.md#the-xchain-token) itself a balance on chains it was never issued
on; see [Token Bridge](../protocol/token-bridge.md) for the protocol-level design and
[`XBRIDGE`](../protocol/actions/xbridge.md) for the wire action.

## The idea in one paragraph

Lock a token on the chain it was issued on ("the origin"), into a protocol-owned escrow nobody
holds a key for. A matching copy appears on the destination chain, mintable and spendable there.
Burn the copy, and the same amount unlocks back on the origin. One unit is always either sitting
in the escrow or circulating as exactly one copy somewhere: the supply never doubles, and anyone
can move value back to the origin at any time by burning.

## What the bridged copy is called

A token issued as `PEPECASH` on Bitcoin appears on Dogecoin and Litecoin as `BTC.PEPECASH`,
never as a bare `PEPECASH` a squatter could have already registered there. Wallets and explorers
show the bare name with a small origin badge, so a holder sees "PEPECASH, bridged from BTC" and
never has to think about the underlying naming. The prefix is the whole point: it is what lets
anyone verify which chain actually backs a token, with no registry and no possibility of a name
collision blocking an issuer's expansion.

## Origin chain, one escrow

Whichever chain a token is issued on is its origin for the token bridge's whole life. The
escrow for that token lives there, in the same keyless role address the platform already uses
for XCHAIN's own bridge. A bridged copy on another chain can never itself be re-bridged onward:
moving value from one non-origin chain to another always passes back through the origin first.
That keeps the accounting simple for every party involved: one escrow, one shadow supply, per
destination.

## Turning it on: the issuer's opt-in

Bridging is off by default. An issuer opts a token in by naming which destination chains it may
bridge to, and, optionally, a required confirmation depth beyond the platform's usual default,
a natural knob for an issuer who wants extra assurance against a reorg before a lock is treated
as final. That choice can be locked permanently, which is the issuer's way of promising holders
the settings can never be pulled out from under them, even by a future owner of the token.

## What holders should know before bridging value

- **A bridged mint is final.** If something ever goes wrong upstream of the lock (a chain
  reorg deep enough to undo it, for instance), the platform has no way to undo a mint that has
  already happened on the destination. The confirmation depth an issuer sets is exactly the
  price that makes reaching that situation expensive; a higher depth (longer wait, more
  security) is always an issuer's option, never a holder's.
- **An issuer's allow list, block list and pause now travel with a bridged token.** Once the
  network has turned this on, a token that has ever put itself under an allow list or a block
  list can bridge, and a policy the issuer sets on the origin afterward reaches every bridged
  copy automatically, enforced identically everywhere, never re-set per chain. The two are still
  not instant: an origin-side change reaches a copy after that chain's own confirmation depth
  plus a short signing-and-mirror margin (typically a few minutes), so a copy briefly enforces
  the *previous* policy right after the issuer changes it, never a *later* one before the issuer
  changes it. A list also has a size ceiling (10,000 addresses) an issuer sees at opt-in time,
  since every snapshot and every chain's copy carries the full list. A smart-contract-controlled
  policy is the one exception that still does not travel: the contract only exists on the chain
  it was deployed on, so a controller-bound token still cannot bridge, and a bridged token
  still cannot bind one.
- **Sleep is chain-local.** Pausing a token on its origin chain stops new locks from that
  chain, but any copies already bridged elsewhere keep trading, and burning them back to the
  origin still works. A holder relying on a token being "fully paused" everywhere should know
  that, today, it is only paused where it was issued.
- **Subassets aren't bridgeable yet.** A token issued as a child of another token (a name with a
  dot in it, like `PARENT.CHILD`) cannot be bridged in this milestone; only plain, undotted
  tokens can.

## Why not just issue the same ticker on every chain?

Because nothing then proves the three tickers are the same asset, or that whoever issued the
second and third copies is the same person who issued the first. A holder would have to trust
an out-of-band claim instead of reading it off the chain. The bridge instead makes the
relationship provable: every bridged unit traces back, in the protocol's own ledger, to a real
unit locked in a real escrow on the chain it actually came from.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
