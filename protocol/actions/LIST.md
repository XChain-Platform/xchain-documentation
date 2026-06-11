<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - LIST
This action creates a list of items for use in actions.

## PARAMS
| Name                | Type   | Description                       |
| --------------      | ------ | ----------------------------------|
| `VERSION`           | String | Format Version                    |
| `TYPE`              | String | List type (1=TICK, 2=ADDRESS)     |
| `ITEM`              | String | Any valid `TICK` or `ADDRESS`     |
| `EDIT`              | String | Edit action (1=ADD, 2=REMOVE)     |
| `LIST_ACTION_INDEX` | String | `ACTION_INDEX` of existing `LIST` |


## Formats

### Version `0` 
- `VERSION|TYPE|ITEM`

### Version `1` 
- `VERSION|EDIT|LIST_ACTION_INDEX|ITEM`


## Examples
```
LIST|0|1|JDOG|BRRR|TEST
This example creates a list of 3 tickers
```

```
LIST|0|2|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|1FWDonkMbC6hL64JiysuggHnUAw2CKWszs|1BTNSGASK5En7rFurDJ79LQ8CVYo2ecLC8
This example creates a list of 3 addresses
```

```
LIST|1|1|1234|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|1FWDonkMbC6hL64JiysuggHnUAw2CKWszs
This example creates a new list from an existing list (1234) and adds 2 addresses to the new list
```

```
LIST|1|2|4321|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|1FWDonkMbC6hL64JiysuggHnUAw2CKWszs
This example creates a new list from an existing list (4321) and removes 2 addresses from the new list
```

## Rules
- In order for a `LIST` to be considered `valid`, all `TICK` or `ADDRESS`  must be valid
- A `TICK` list contains only `TICK` items
- A `ADDRESS` list contains only `ADDRESS` items

## Notes
- Format version `0` allows for creating a list of `TYPE`
- Format version `1` allows for creating a list from an existing list via `LIST_ACTION_INDEX` and `EDIT`
- `ITEM` can be repeated many times in a `LIST` request
- `ITEM` values should be unique
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` items (^1234 = `TICK_ID` 1234)
- A `TICK` list `LINK`ed to a token's `ISSUE` by the token's owner is that project's official-token roster — see the [Project Registry Standard](../Project_Registry.md)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
