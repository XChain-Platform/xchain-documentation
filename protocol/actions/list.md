<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - LIST
This action creates, edits, shares, or transfers a list of items for use in actions.

## PARAMS
| Name                | Type   | Description                       |
| --------------      | ------ | ----------------------------------|
| `VERSION`           | String | Format Version                    |
| `TYPE`              | String | List type (1=TICK, 2=ADDRESS, 3=UNION) |
| `MEMO`              | String | An optional memo to include       |
| `ITEM`              | String | Any valid `TICK` or `ADDRESS`, or for a `TYPE` 3 union the `ACTION_INDEX` of a member list; at or above `LIST_TICK_COIN_ACTIVATION`, a `TICK` item may be `COIN:TICK` or `COIN:^<tickid>`; rest field, repeat for each item |
| `EDIT`              | String | Edit action (1=ADD, 2=REMOVE)     |
| `LIST_ACTION_INDEX` | String | `ACTION_INDEX` of existing `LIST` |
| `DESTINATION`       | String | Address that receives ownership (format 3) |


## Formats

### Version `0` 
- `VERSION|TYPE|MEMO|...ITEM`

### Version `1` 
- `VERSION|EDIT|LIST_ACTION_INDEX|MEMO|...ITEM`

### Version `2` - SHARE
- `VERSION|LIST_ACTION_INDEX|MEMO`

### Version `3` - TRANSFER
- `VERSION|LIST_ACTION_INDEX|DESTINATION|MEMO`


## Examples
```
LIST|0|1||JDOG|BRRR|TEST
This example creates a list of 3 tickers, with no memo
```

```
LIST|0|1|Our official tokens|JDOG|BRRR|TEST
This example creates a list of 3 tickers, with a memo
```

```
LIST|0|2||1ExampleAddressXXXXXXXXXXXXXXXXXXX|1FWDonkMbC6hL64JiysuggHnUAw2CKWszs|1BTNSGASK5En7rFurDJ79LQ8CVYo2ecLC8
This example creates a list of 3 addresses
```

```
LIST|1|1|1234||1ExampleAddressXXXXXXXXXXXXXXXXXXX|1FWDonkMbC6hL64JiysuggHnUAw2CKWszs
This example creates a new list from an existing list (1234) and adds 2 addresses to the new list
```

```
LIST|1|2|4321|Removed at their request|1ExampleAddressXXXXXXXXXXXXXXXXXXX|1FWDonkMbC6hL64JiysuggHnUAw2CKWszs
This example creates a new list from an existing list (4321) and removes 2 addresses from the new list, with a memo
```

```
LIST|0|3||1234|5678
This example creates a union of lists 1234 and 5678
```

```
LIST|2|1234|Shared compliance list
This example permanently shares list 1234
```

```
LIST|3|1234|1ExampleAddressXXXXXXXXXXXXXXXXXXX|New list owner
This example transfers ownership of list 1234 to a full address
```

```
LIST|3|4321|^5678|Rotated list owner
This example transfers ownership of list 4321 to the address identified by address id 5678
```

```
LIST|0|1||PEPE|BTC:^5|DOGE:WOW
On Bitcoin, at or above `LIST_TICK_COIN_ACTIVATION`, this creates a ticker list holding the bare ticker PEPE, Bitcoin ticker id 5 written coin-qualified, and the Dogecoin ticker WOW
```

## Rules
- Each `ITEM` is judged on its own. An item that fails its type check (an unknown `TICK`,
  or an `ADDRESS` the format check rejects) is recorded `invalid` and left OUT of the
  list's item set; it does not fail the action. A `LIST` is `valid` or not on its fixed
  fields alone (`VERSION`, `TYPE`/`EDIT`, `LIST_ACTION_INDEX`, `MEMO`, and a `SOURCE`
  that is not sleeping), so a `LIST` whose every item was rejected still publishes, as an
  empty list. Read the resulting membership back rather than assuming what you sent
- A `TICK` list contains only `TICK` items
- At or above `LIST_TICK_COIN_ACTIVATION`, a `TICK` item may be written `COIN:TICK` or `COIN:^<tickid>` (that coin's own ticker id). It is coin-qualified only when the text before its first colon is BTC, LTC, or DOGE (case-folded), or an entry in `RESERVED_FUTURE_ROOTS`; anything else, including `:PEPE`, is a bare ticker as before. An item qualified with this chain's own coin is checked like the bare item and stored bare. Another coin's item is checked for form only and recorded `invalid: TICK (format)` if malformed; otherwise it is stored as written with its root upper-cased, and it matches nothing on a chain that does not hold that ticker. Every consumer, including AIRDROP and the project roster, reads only its own coin's items. A mirror of a shared ticker list stores every item as written, and the share record qualifies bare items with the home coin (`DOGE:PEPE`, or `DOGE:^<id>` when the name form passes 200 characters). Below `LIST_TICK_COIN_ACTIVATION`, a colon item is an ordinary ticker name looked up as written.
- A `ADDRESS` list contains only `ADDRESS` items
- An `ADDRESS` item validates against this chain's own coin and network by default. Behind `TOKEN_POLICY_INHERITANCE_ACTIVATION`, an item that is a valid address of ANY coin the platform runs (BTC, LTC, DOGE, at this network) is admitted, not only this chain's own coin; this widens which items an `ADDRESS` list can hold, it never narrows one. See [Token Bridge](../token-bridge.md#policy-inheritance) for why: a bridged token's allow/block list is enforced identically on every chain it has a copy on, so the list has to be able to name a holder on any of them. Below the flag, an item of another chain's address format fails its type check like any other malformed `ADDRESS` and is recorded `invalid`, per the rule above.
- At or above `LIST_ADDRESS_REF_ACTIVATION`, an `ITEM` of an `ADDRESS` list (`TYPE` 2) written as `^<id>` in canonical form (a positive decimal id with no leading zero) is resolved against the deterministic, block-stamped address set before the format check. This applies to a create (`VERSION 0`) and to an add or remove edit (`VERSION 1`); the list stores and matches the resolved address, so a later edit may name the same member in full. An id that names no block-stamped address stays as written and is recorded `invalid: ADDRESS (format)`, while the `LIST` itself stays `valid`. A `TICK` list item is never resolved this way. Below `LIST_ADDRESS_REF_ACTIVATION`, a `^<id>` item is not resolved and is recorded `invalid: ADDRESS (format)` like any other malformed `ADDRESS`.
- A `LIST` edit (`VERSION 1`) whose `LIST_ACTION_INDEX` names a list created by a chain's own `ADDRESS.BRIDGE_<COIN>` role address is refused with `invalid: LIST_ACTION_INDEX (bridge-owned)`. Those lists exist only once a bridged token's policy has been carried to this chain (see [Token Bridge](../token-bridge.md#policy-inheritance)); no user key owns them, and only the platform's own injected edits, carrying the finalized policy snapshot's membership, may ever change one.
- At or above `LIST_SHARE_ACTIVATION`, a SHARE (`VERSION 2`) is accepted only from the list's current owner; otherwise it is refused with `invalid: LIST_ACTION_INDEX (not owner)`. Only a `TYPE` 1 TICK list or `TYPE` 2 ADDRESS list can be shared; any other type, including a `TYPE` 3 union, is refused with `invalid: LIST_ACTION_INDEX (type)`. A list can be shared only once, and another SHARE is refused with `invalid: LIST_ACTION_INDEX (already shared)`. A list with more than `LIST_SHARE_MAX_MEMBERS` (10,000) valid items is refused with `invalid: LIST_ACTION_INDEX (list exceeds LIST_SHARE_MAX_MEMBERS)`. Sharing is permanent.
- At or above `LIST_SHARE_ACTIVATION`, a format 1 edit that would take a shared list past `LIST_SHARE_MAX_MEMBERS` (10,000) members is refused with `invalid: ITEM (shared list exceeds LIST_SHARE_MAX_MEMBERS)`.
- At or above `LIST_SHARE_ACTIVATION`, a SHARE (`VERSION 2`) pays the flat `LIST_SHARE` fee (100,000 gas), and a format 1 edit of a shared list pays `LIST_SHARED_EDIT_BASE` (5,000 gas) plus `LIST_SHARED_EDIT_PER_ITEM` (100 gas) for each item it actually adds or removes. Both fees are priced on the unified gas schedule. Creating a list, editing a local list that is not shared, and a TRANSFER (`VERSION 3`) pay no fee; the platform's injected legs that maintain a bridge-owned list also pay no fee. As with every fee on its chain, the fee is paid in the fee token from `SOURCE`'s balance or as a native-coin output in the same transaction; on Litecoin and Dogecoin, the native-coin output is the only accepted form. A `LIST` that cannot pay is refused with `invalid: insufficient funds (FEE)` or `invalid: insufficient fee (native coin output required)`. Below `LIST_SHARE_ACTIVATION`, no `LIST` format charges a fee.
- At or above `LIST_TRANSFER_ACTIVATION`, a TRANSFER (`VERSION 3`) is accepted only from the list's current owner; otherwise it is refused with `invalid: LIST_ACTION_INDEX (not owner)`. `DESTINATION` must be a full address or an address id written as `^<id>`, which is resolved on input. An id that names no address is refused with `invalid: DESTINATION (unresolvable ^id)`, and anything that is not an address is refused with `invalid: DESTINATION (format)`. Every later owner check reads the latest valid transfer's destination.
- At or above `LIST_SHARE_CONSUMER_ACTIVATION`, a mirror of a shared list is owned by the destination chain's `BRIDGE_<HOME>` role address, where `HOME` is the shared list's home chain. The mirror follows the home list version by version. Every broadcast edit of a mirror is refused with `invalid: LIST_ACTION_INDEX (bridge-owned)`; only the platform's injected version-apply legs may edit it.
- At or above `LIST_UNION_ACTIVATION`, a `TYPE` 3 create (`VERSION 0`) makes a union whose items are the `ACTION_INDEX`es of other lists. Each member must be a valid `TICK` or `ADDRESS` list, either local or a bridge-owned mirror, and all members must have one type: the type of the first valid item on a create, or the type the union was created with on an edit. A union is one level deep, and each item is stored as its list's root `ACTION_INDEX`, so the union follows that list's edits. An item that is not a canonical positive integer or names no valid list is recorded `invalid: LIST (unknown)`, another union is recorded `invalid: LIST (union)`, and a list of the other type is recorded `invalid: LIST (type)`; each invalid item is left out while the `LIST` stays `valid`. On a create and on an edit, more than `LIST_UNION_MAX_MEMBERS` (16) members is refused with `invalid: ITEM (union exceeds LIST_UNION_MAX_MEMBERS)`, and a merged membership above `LIST_SHARE_MAX_MEMBERS` (10,000) is refused with `invalid: ITEM (union exceeds LIST_SHARE_MAX_MEMBERS)`. A create with no valid member is refused with `invalid: ITEM (no member list)`. A format 1 edit of a union adds or removes member lists. Every reader of a union, including a token's allow or block list and `AIRDROP`, sees the distinct members of its member lists at the same block in byte order, and the union reads as its member type. Below `LIST_UNION_ACTIVATION`, a `TYPE` 3 create is refused with `invalid: TYPE (unknown)`.

## Notes
- Format version `0` allows for creating a list of `TYPE`
- Format version `1` allows for creating a list from an existing list via `LIST_ACTION_INDEX` and `EDIT`
- Format version `2` permanently shares an existing list via `LIST_ACTION_INDEX`
- Format version `3` transfers ownership of an existing list to `DESTINATION`
- `MEMO` is optional and sits BEFORE `ITEM`, unlike every other action, where it comes last. `ITEM` repeats, so a memo after it could not be told apart from one more item. A `LIST` with no memo still leaves the field empty (`LIST|0|1||JDOG`)
- `ITEM` can be repeated many times in a `LIST` request
- `ITEM` values should be unique
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` items (^1234 = `TICK_ID` 1234)
- A `TICK` list `LINK`ed to a token's `ISSUE` by the token's owner is that project's official-token roster, see the [Project Registry Standard](../project-registry.md)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
