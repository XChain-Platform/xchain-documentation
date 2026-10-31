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

A ticker name can hold an id without a token behind it: a rejected `ISSUE` still interns the
`TICK` it attempted, which gives that name a block-stamped ticker id but no token row. Whether
an `ISSUE` may then create the token through that id depends on `ISSUE_CARET_TICK_NO_CREATE`
(see [Flag-Day Values](./flag-days.md) for its status on each network):

- **At or above the gate**, an `ISSUE` whose `^<id>` `TICK` resolves to a name with no token
  row is `invalid: TICK (unknown)`, so a caret `TICK` can only edit a token that exists.
- **Below the gate**, the same `ISSUE` resolves the name and is judged as a new issuance of it,
  so it can settle valid and create the token through the id form. An implementation that
  replays history applies this verdict to every block before the gate on that network.

The gate never touches a caret `TICK` that names an existing token, and an `ISSUE` in the
genesis load is exempt from it.

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

**Ticker fields:** `TICK`, `GIVE_TICK`, `GET_TICK`, `DIVIDEND_TICK`, `CALLBACK_TICK`, and
`LIST.ITEM` when the list `TYPE` is ticker. The ticker-typed list item carries two
qualifications the five single-value fields do not. A `^<id>` written there is only ever
RESOLVED, never minted: the reference has to match a block-stamped ticker row of an
existing token, and an item that matches none is recorded `invalid: TICK (unknown)` and
left out of the materialized item set while the `LIST` action itself stays `valid`. And
the reference SDK does not compact it, so a client that wants the shorter form writes
`^<tickid>` itself.
See [LIST](./actions/list.md).

At or above `LIST_TICK_COIN_ACTIVATION`, a ticker-typed `LIST.ITEM` may be
coin-qualified as `COIN:TICK` or `COIN:^<tickid>`. The `COIN:^<tickid>` form names
that coin's own ticker id and is resolved only by that coin's own chain. An item is
coin-qualified only when the text before its first colon is BTC, LTC, or DOGE
(case-folded), or a `RESERVED_FUTURE_ROOTS` entry; anything else, including `:PEPE`,
is a bare ticker as before. An item qualified with the reading chain's own coin is
checked like the bare item, so its `^<tickid>` resolves against that chain's
block-stamped ticker rows, and is stored bare. Another coin's item is never resolved
on this chain: it is checked for form only (`invalid: TICK (format)`) and stored as
written with its root upper-cased. Below `LIST_TICK_COIN_ACTIVATION`, a colon item is
an ordinary ticker name looked up as written.

`FILE.GATE_TICKER` is also resolved on input, but clients must write it in full. The
indexer checks it through the same ticker lookup as the fields above, so a `^<tickid>`
resolves and the `FILE` is accepted, but the value is then stored verbatim as the file's
gate. The `SEND` key-handoff rule finds a token's gated packs by comparing that stored
value to a lookup key taken from the `SEND`'s `TICK`, and which key it uses depends on
`SEND_CARET_PACK_KEY_ACTIVATION` (see [Activation Module Catalogue](./activation-catalogue.md)
and [Flag-Day Values](./flag-days.md)):

- **At or above the gate**, a `^<tickid>` `SEND` `TICK` is resolved to the ticker name
  first, so a caret `SEND` and a named `SEND` look up the same packs. A compacted gate is
  then missed by every `SEND`, whichever spelling it uses.
- **Below the gate**, the lookup key is the `TICK` as written. A compacted gate is then
  missed by every `SEND` that writes the ticker name, and a gate written in full is missed
  by every `SEND` that writes `TICK` as `^<tickid>`.

Either way, a missed pack requires no handoff: the `SEND` settles valid and the recipient
receives the token without the key. The gate is active from genesis on testnet and regtest
and is not yet armed on mainnet, so on mainnet a `SEND` of a gated token must write `TICK`
in full for the handoff rule to apply. The reference SDK keeps its existence check on
`GATE_TICKER` and never compacts it, but it does compact a `SEND`'s `TICK` by default, so
build gated-token transfers with `compactTickers: false` on any network where the gate is
not armed. See [FILE](./actions/file.md).

**Address fields that receive an index id:** the destination/transfer/get-address style
fields of an action:
`SEND.DESTINATION`, `MINT.DESTINATION`, `MESSAGE.DESTINATION`, `SWEEP.DESTINATION`,
`ISSUE.TRANSFER`, `ISSUE.TRANSFER_SUPPLY`, `DISPENSER.GET_ADDRESS`,
`DISPENSER.ORACLE_ADDRESS`, `ORDER.GET_ADDRESS`, `SWAP.GET_ADDRESS`,
`DEPLOY.SLASH_DESTINATION`, and `LIST.ITEM` when the list `TYPE` is address.

These payload fields also receive an index id when they carry a value the network has not
interned yet, each under its own condition:

- `LIST.DESTINATION`: only for a valid format 3 `TRANSFER`.
- `VOTE.DELEGATE_TO`: only for a valid v3 delegation that names a delegate. A blank value
  clears the delegation and receives nothing. Below `VOTE_RESPECTS_SLEEP` the delegate is
  not format-checked, so any non-empty value on a valid delegation receives an id.
- The `XBRIDGE` destination field, `DEST_ADDRESS` (v0 and v3), `BTC_ADDRESS` (v1) or
  `ORIGIN_ADDRESS` (v4): for every recorded `XBRIDGE`, valid or refused. A refused row is
  still recorded, so any non-empty destination receives an id, even one that is not a
  well-formed address.

A `DEPLOY` also registers its contract's derived address, `C:<CHAIN>:<ACTION_INDEX>`, once
it passes every check that runs before its constructor: the size and gas limit, the VM
gates, the fee and the sleeping check, with no held chunk verdict landing on it. The
address receives an index id whatever the constructor then does, so a `DEPLOY` that ends
invalid because its constructor failed has still registered it. A pending chunked landing
registers nothing.

These lists name payload fields, not every source of a new id. A value written as `^<id>`
never receives a new id in any field, because interning it only looks up an existing id.
Beyond the payload fields, the reference indexer gives the next id to every new address it
interns while it processes a block, wherever that address comes from. Those sources
include:

- the transaction's own `SOURCE` and destination (step 2 below);
- every address a ledger credit, debit or escrow is recorded against, including a credit
  made by a system pass at the end of the block, such as the bridge settle pass, which
  records each leg under its own `action_index` and credits a bridged-in destination that
  may be new to this chain;
- every address in an action's address mappings, which for `DIVIDEND`, `AIRDROP` and
  `CALLBACK` can hold thousands of recipients.

The complete id-receiving surface is therefore the reference indexer's interning order. A
second implementation reproduces the same ids only by interning the same addresses in the
same order.

**Address fields where a `^<id>` is resolved on input:** `MINT.DESTINATION`,
`MESSAGE.DESTINATION`, `SWEEP.DESTINATION`, `ISSUE.TRANSFER`, `ISSUE.TRANSFER_SUPPLY`,
`DISPENSER.GET_ADDRESS`, `DISPENSER.ORACLE_ADDRESS`, `ORDER.GET_ADDRESS`,
`SWAP.GET_ADDRESS`, `DEPLOY.SLASH_DESTINATION`, `LIST.DESTINATION` for a format 3
`TRANSFER` at or above `LIST_TRANSFER_ACTIVATION`, and `LIST.ITEM` when the list `TYPE`
is address at or above `LIST_ADDRESS_REF_ACTIVATION`. Each of these handlers resolves
the reference before its address format check.

For a format 3 `TRANSFER`, `LIST.DESTINATION` is resolved before its address check. A
reference that names no block-stamped address is
`invalid: DESTINATION (unresolvable ^id)` at or above `CARET_REF_STRICT_ACTIVATION`;
below that strict gate, the unresolved text instead falls through to
`invalid: DESTINATION (format)`.

At or above `LIST_ADDRESS_REF_ACTIVATION`, a type-2 `LIST.ITEM` written `^<id>` in the
canonical form is resolved against the deterministic, block-stamped address set before
the format check. One that resolves to nothing stays as written and is recorded
`invalid: ADDRESS (format)`, while the `LIST` action itself stays `valid`.

An address-typed `LIST.ITEM` is resolved at or above `LIST_ADDRESS_REF_ACTIVATION`; the
two id-receiving cases below are NOT resolved on input. A `^<id>` written there is
judged by the plain address format check, which it always fails, and the transaction fee
is spent either way. What the failure costs differs, because each field is scored at
its own granularity, not at the action's:

- `SEND.DESTINATION`: the **leg** carrying the reference is recorded
  `invalid: DESTINATION (format)` and moves nothing. Each leg of a multi-recipient
  `SEND` is validated on its own, so the remaining legs still settle; a single-recipient
  `SEND` has one leg, so there the whole send fails. Write every `SEND` destination in
  full, whether the send has one recipient or many.
- Below `LIST_ADDRESS_REF_ACTIVATION`, `LIST.ITEM` when the list `TYPE` is address: the
  **item** is recorded
  `invalid: ADDRESS (format)` and left out of the materialized item set, while the `LIST`
  action itself stays `valid` and publishes the rest. So a roster or allow-list that
  carries a reference silently ships short rather than failing loudly. Write every
  address list item in full.

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
- The transaction's destination: taken from the transaction itself, not a payload field.
  It still receives an index id when new, in the order step 2 below gives.
- `CONTROLLER` (`ISSUE` v6 / `ADDRESS` v1): the `ACTION_INDEX` of a guard contract, not
  an address. A contract is addressed elsewhere as `C:<CHAIN>:<ACTION_INDEX>`.

## How ids are assigned (deterministic and reorg-safe)

An index id is a small dense integer assigned in a fully deterministic order derived
from chain data alone, so the same `^<id>` resolves to the same entity on every node:

1. Across actions, assignment follows `action_index`, which is total and reorg-handled.
   A `BATCH` sub-action has its own `action_index`, so one action is the assignment unit.
2. Within one action, the `SOURCE` address is registered first, then the transaction's
   destination: the destination address the decoder recorded for the transaction, its
   native-coin output destination when it has one. Both are registered before the action is
   parsed, so an unknown, not-yet-activated or refused action registers them too, and a
   plain native-coin transaction with no payload registers its destination as well. For
   the actions with a fixed positional wire layout (`MINT`, `MESSAGE`, `DISPENSER`,
   `ORDER` and `SWAP`), a pre-pass then registers the new addresses in their single-value
   fields in byte-sorted (binary) order of their VALUE, before the action's handler runs. Ordering by value, not
   by field position, keeps that assignment stable across client and indexer code changes.
   Every other id-receiving field sits outside that pre-pass: the single-value fields of
   `ISSUE` (`TRANSFER`, `TRANSFER_SUPPLY`), `SWEEP` (`DESTINATION`), `DEPLOY`
   (`SLASH_DESTINATION`, and the derived contract address), `LIST` (`DESTINATION`), `VOTE`
   (`DELEGATE_TO`) and `XBRIDGE` (its destination field), and the multi-value fields
   (`SEND.DESTINATION` recipients and `LIST.ITEM` entries). Their handler interns them in
   a fixed order that is identical on every node, so they receive deterministic ids as
   well. That order is the handler's, not the byte order of the values, so two new
   addresses introduced by one `ISSUE` are not assigned by the byte-sorted rule above.
3. Ids are assigned by an explicit dense counter (the surviving `MAX(id) + 1`), never by
   a database auto-increment (which does not rewind on delete).

On a chain reorganization, index rows first seen in the orphaned blocks are deleted and
the counter resumes from the surviving maximum, so reapplying the canonical chain
reproduces the exact same ids. This is what makes `^<id>` safe to put on the wire: an
id can never name two different entities across two honest nodes that reach the same tip
by different reorg paths.

This assignment rule is a frozen wire rule. The set of id-receiving fields and the other
interning sources above, the set of actions the value-sorted pre-pass covers, the
value-sorted order for those actions' single-value fields and the handler order for every
other id-receiving field are part of consensus; changing any of them, including moving an
action into or out of the pre-pass, is a wire-format change.

## SDK behavior

The reference SDK compacts eligible single-value ticker and address fields to `^<id>`
automatically (opt out with `{ compactTickers: false }` / `{ compactAddresses: false }`).
It only ever emits a `^<id>` for a value it has already resolved to an existing id via the
explorer, and it falls back to the full value whenever an id cannot be resolved, so a
client never emits an id the indexer would not recognize. Multi-recipient (array)
fields are left in full form by the SDK. For `SEND.DESTINATION`, and for
`LIST.ITEM` when the list `TYPE` is address below `LIST_ADDRESS_REF_ACTIVATION`, the
rules above require it: the indexer resolves no `^<id>` in those cases. At or above the
gate, the SDK still writes address list items in full even though the indexer resolves a
canonical reference. At or above `LIST_TICK_COIN_ACTIVATION`, on a ticker list (`TYPE`
1), the SDK writes a coin-qualified item whose root is BTC, LTC or DOGE and whose rest
is a well-formed name as `COIN:^<tickid>`, looking the id up on that coin's own explorer.
When the lookup fails or returns no id, the SDK keeps the item as written. An item
already in `COIN:^<tickid>` form stays in full. This compaction applies only to
coin-qualified name items: the SDK still writes every bare ticker item in full. Below
the gate, the SDK compacts no ticker list item. The SDK also leaves
`DISPENSER.GET_ADDRESS` and `DISPENSER.ORACLE_ADDRESS` in full form, for the decoder
reason above, even though the indexer would resolve a reference there.

---

**Copyright &copy; 2025-2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC, https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.
