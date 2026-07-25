<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - BROADCAST
This action broadcasts a message, and can also be used to create oracles and data feeds.

> **Betting does not use `BROADCAST`.** Betting markets are created, wagered on, and resolved with the self-contained [`BET`](./BET.md) action. The feed formats below are general-purpose data feeds and carry no betting, escrow, or settlement behaviour.

## PARAMS
| Name                     | Type   | Description                                                |
| ------------------------ | ------ | ---------------------------------------------------------- |
| `VERSION`                | String | Format Version                                             |
| `MESSAGE`                | String | A text string                                              |
| `VALUE`                  | String | Numerical value                                            |
| `FEE`                    | String | Indicates usage percentage fee (1=1%, 2=2%, etc)           |
| `MEMO`                   | String | An optional memo to include                                |
| `BROADCAST_ACTION_INDEX` | String | `ACTION_INDEX` of broadcast action                         |

## Formats

### Version `0` - Broadcast Message
- `VERSION|MESSAGE|VALUE`

### Version `1` - Broadcast Oracle
- `VERSION|MESSAGE|VALUE|FEE|MEMO`

### Version `2` - Broadcast Data Feed
- `VERSION|MESSAGE|FEE|MEMO`

### Version `3` - Broadcast Data Feed Update
- `VERSION|BROADCAST_ACTION_INDEX|VALUE|MEMO`

## Examples
```
BROADCAST|0|This is a test
This example broadcasts a simple message
```

```
BROADCAST|1|BTC-USD|84860|0.01|BTC Price on Sat Apr 12 2025 14:35:36 UTC
This example creates an oracle for BTC-USD price, gives the current price, indicates a 1% oracle usage fee, and includes a memo
```

```
BROADCAST|2|BTC-USD hourly close|1|Published every hour on the hour
This example creates a named data feed, charges a 1% oracle usage fee, and includes a memo
```

```
BROADCAST|3|1234|84860|BTC-USD close on Tue Aug 19 2025 01:55:00 UTC
This example publishes a new value on the feed created in the previous example with an `ACTION_INDEX` of 1234, and includes a memo
```


## Rules

## Notes
- `CAST` `ACTION` can be used for shorter reference to `BROADCAST` `ACTION`
- Price oracles can be created by broadcasting TICK-FIAT as `MESSAGE`, price as `VALUE`, and a `FEED_FEE` and `TIMESTAMP`
- Data feeds are created with `FORMAT` 2 (name the feed in `MESSAGE`, set an optional usage `FEE`) and updated with `FORMAT` 3 (reference the feed by `BROADCAST_ACTION_INDEX` and publish the new `VALUE`)
- Feeds carry data only. Nothing settles against them and nothing is escrowed on them; betting markets are [`BET`](./BET.md)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
