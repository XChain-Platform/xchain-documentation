<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->

# Index ID References (`^<id>` compaction)

A ticker or address can be referenced on the wire either by its full value or by
its numeric index id with a caret prefix. The id form is almost always smaller, so
it shrinks transactions and lowers fees.

| Reference | Full form | Compact form |
|---|---|---|
| Ticker | `JDOG` | `^1234` (the `index_tickers` id) |
| Address | `1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev` | `^57` (the `index_addresses` id) |

The caret form is accepted anywhere the full value is accepted, EXCEPT a brand-new
value being defined for the first time (an `ISSUE` defining `TICK`, or any field that
introduces an address the network has not seen). A new value has no id yet, so it must
be written in full.

## Where it applies

**Ticker fields:** `TICK`, `GIVE_TICK`, `GET_TICK`, `DIVIDEND_TICK`, `CALLBACK_TICK`.

**Address fields:** the destination/transfer/get-address style fields of an action:
`SEND.DESTINATION`, `MINT.DESTINATION`, `MESSAGE.DESTINATION`, `SWEEP.DESTINATION`,
`ISSUE.TRANSFER`, `ISSUE.TRANSFER_SUPPLY`, `DISPENSER.GET_ADDRESS`,
`DISPENSER.ORACLE_ADDRESS`, `ORDER.GET_ADDRESS`, `SWAP.GET_ADDRESS`,
`DEPLOY.SLASH_DESTINATION`, and `LIST.ITEM` when the list `TYPE` is address.

Explicitly NOT address references (never compactable as `^<id>`):

- `SOURCE`: the transaction sender, taken from the transaction itself, not a payload field.
- `COINPAY` recipient: taken from a native-coin transaction output, not the payload.
- `CONTROLLER` (`ISSUE` v6 / `ADDRESS` v1): the `ACTION_INDEX` of a guard contract, not
  an address. A contract is addressed elsewhere as `C:<CHAIN>:<ACTION_INDEX>`.

## How ids are assigned (deterministic and reorg-safe)

An index id is a small dense integer assigned in a fully deterministic order derived
from chain data alone, so the same `^<id>` resolves to the same entity on every node:

1. Across actions, assignment follows `action_index`, which is total and reorg-handled.
   A `BATCH` sub-action has its own `action_index`, so one action is the assignment unit.
2. Within one action, the `SOURCE` address is registered first, then the new addresses
   the action introduces are registered in byte-sorted (binary) order of their VALUE.
   Ordering by value, not by field position, keeps the assignment stable across client
   and indexer code changes.
3. Ids are assigned by an explicit dense counter (the surviving `MAX(id) + 1`), never by
   a database auto-increment (which does not rewind on delete).

On a chain reorganization, index rows first seen in the orphaned blocks are deleted and
the counter resumes from the surviving maximum, so reapplying the canonical chain
reproduces the exact same ids. This is what makes `^<id>` safe to put on the wire: an
id can never name two different entities across two honest nodes that reach the same tip
by different reorg paths.

This assignment rule is a frozen wire rule. The set of fields above and the
value-sorted order are part of consensus; changing either is a wire-format change.

## SDK behavior

The reference SDK compacts eligible single-value ticker and address fields to `^<id>`
automatically (opt out with `{ compactTickers: false }` / `{ compactAddresses: false }`).
It only ever emits a `^<id>` for a value it has already resolved to an existing id via the
explorer, and it falls back to the full value whenever an id cannot be resolved, so a
client never emits an id the indexer would not recognize. Multi-recipient (array) and
type-gated list fields are left in full form by the SDK.

---

**Copyright &copy; 2025-2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC, https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.
