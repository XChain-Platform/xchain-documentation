<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->

# Index ID References

A ticker or address can be referenced on the wire either by its full value or by
its numeric index id with a caret prefix. The id form is almost always smaller, so
it shrinks transactions and lowers fees.

| Reference | Full form | Compact form |
|---|---|---|
| Ticker | `JDOG` | `^1234` (the `index_tickers` id) |
| Address | `1ExampleAddressXXXXXXXXXXXXXXXXXXX` | `^57` (the `index_addresses` id) |

The caret form is accepted in every field listed below as resolved on input, EXCEPT a
brand-new value being defined for the first time (an `ISSUE` defining `TICK`, or any field
that introduces an address the network has not seen). A new value has no id yet, so it must
be written in full.

## Canonical form

A `^<id>` reference has exactly ONE valid byte-form: a caret followed by the id in plain
decimal with **no leading zero** (ids start at 1, so `^0` is also invalid). This keeps a
single entity from having multiple equivalent wire spellings, which would otherwise
undermine any signature or dedupe canonicalization layered on top of the action bytes.

A reference is accepted only when both hold:

1. It matches `^[1-9][0-9]*` exactly (no leading zero, sign, decimal point, hex, scientific
   notation, or whitespace).
2. The id already exists in the deterministic, block-stamped id set.

Any other caret form (`^007`, `^1.5`, `^-1`, `^0x10`, `^1e3`, `^ 1`, `^`) and any id that
does not yet exist (a dangling or out-of-range reference) is left unresolved, so the field
is then judged by its full-value format check and rejected. The id digits are matched as a
string, never coerced to a fixed-width integer, so an arbitrarily large id keeps full
precision.

## Where it applies

Two different questions are answered here: which fields RECEIVE an index id when an action
introduces a new value, and in which fields a `^<id>` written on the wire is RESOLVED on
input. The first set is the consensus surface; the second is what a client may send.

**Ticker fields:** `TICK`, `GIVE_TICK`, `GET_TICK`, `DIVIDEND_TICK`, `CALLBACK_TICK`.

**Address fields that receive an index id:** the destination/transfer/get-address style
fields of an action:
`SEND.DESTINATION`, `MINT.DESTINATION`, `MESSAGE.DESTINATION`, `SWEEP.DESTINATION`,
`ISSUE.TRANSFER`, `ISSUE.TRANSFER_SUPPLY`, `DISPENSER.GET_ADDRESS`,
`DISPENSER.ORACLE_ADDRESS`, `ORDER.GET_ADDRESS`, `SWAP.GET_ADDRESS`,
`DEPLOY.SLASH_DESTINATION`, and `LIST.ITEM` when the list `TYPE` is address.

**Address fields where a `^<id>` is resolved on input:** `MINT.DESTINATION`,
`MESSAGE.DESTINATION`, `SWEEP.DESTINATION`, `ISSUE.TRANSFER`, `ISSUE.TRANSFER_SUPPLY`,
`DISPENSER.GET_ADDRESS`, `DISPENSER.ORACLE_ADDRESS`, `ORDER.GET_ADDRESS`,
`SWAP.GET_ADDRESS` and `DEPLOY.SLASH_DESTINATION`. Each of these handlers resolves the
reference before its address format check.

Two id-receiving fields are NOT resolved on input. A `^<id>` written there is judged by
the plain address format check, so the action is rejected on chain with the fee spent:

- `SEND.DESTINATION`: rejected as `invalid: DESTINATION (format)`. Write every `SEND`
  destination in full, whether the send has one recipient or many.
- `LIST.ITEM` when the list `TYPE` is address: rejected as `invalid: ADDRESS (format)`.
  Write every address list item in full.

Two resolved-on-input fields must still be written in full by clients:
`DISPENSER.GET_ADDRESS` and `DISPENSER.ORACLE_ADDRESS`. The indexer resolves a `^<id>` in
either, but the decoder keys dispense detection on `GET_ADDRESS` and oracle-fee
recognition on `ORACLE_ADDRESS` straight out of the payload, and it cannot resolve an id
reference because its address id space differs from the indexer's, so a compacted value
produces a dispenser that never dispenses or a create rejected as unpaid. See
[DISPENSER](./actions/dispenser.md).

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
   the action introduces in its single-value fields are registered in byte-sorted (binary)
   order of their VALUE. Ordering by value, not by field position, keeps the assignment
   stable across client and indexer code changes. The multi-value fields
   (`SEND.DESTINATION` recipients and `LIST.ITEM` entries) sit outside that pre-pass:
   their handler interns them in a fixed order that is identical on every node, so they
   receive deterministic ids as well.
3. Ids are assigned by an explicit dense counter (the surviving `MAX(id) + 1`), never by
   a database auto-increment (which does not rewind on delete).

On a chain reorganization, index rows first seen in the orphaned blocks are deleted and
the counter resumes from the surviving maximum, so reapplying the canonical chain
reproduces the exact same ids. This is what makes `^<id>` safe to put on the wire: an
id can never name two different entities across two honest nodes that reach the same tip
by different reorg paths.

This assignment rule is a frozen wire rule. The set of id-receiving fields above, the
value-sorted order for the single-value fields and the handler order for the multi-value
fields are part of consensus; changing any of them is a wire-format change.

## SDK behavior

The reference SDK compacts eligible single-value ticker and address fields to `^<id>`
automatically (opt out with `{ compactTickers: false }` / `{ compactAddresses: false }`).
It only ever emits a `^<id>` for a value it has already resolved to an existing id via the
explorer, and it falls back to the full value whenever an id cannot be resolved, so a
client never emits an id the indexer would not recognize. Multi-recipient (array) and
type-gated list fields are left in full form by the SDK, which the rules above require:
the indexer resolves no `^<id>` in `SEND.DESTINATION` or `LIST.ITEM`. The SDK also leaves
`DISPENSER.GET_ADDRESS` and `DISPENSER.ORACLE_ADDRESS` in full form, for the decoder
reason above, even though the indexer would resolve a reference there.

---

**Copyright &copy; 2025-2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC, https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.
