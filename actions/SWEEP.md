# XChain Platform Action Specification

**Copyright © 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**  

Licensed under the **Dankest Community License**  
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).  

You may not use, modify, or distribute this material except in compliance with the License.  
A full copy of the License

# XChain Platform Action - SWEEP
This action transfers all `TICK` balances and/or ownerships to an `DESTINATION` address.

## PARAMS
| Name          | Type   | Description                                                       |
| ------------- | ------ | ----------------------------------------------------------------- |
| `VERSION`     | String | Format Version                                                    |
| `DESTINATION` | String | address where `token` shall be swept                              |
| `BALANCES`    | String | Indicates if address `TICK` balances should be swept (default=1)  |
| `OWNERSHIPS`  | String | Indicates if address `TICK` ownership should be swept (default=1) |
| `ESCROWS`     | String | Indicates if escrowed tokens should be swept (default=0)          |
| `MEMO`        | String | Optional memo to include                                          |

## Formats

### Version `0`
- `VERSION|DESTINATION|BALANCES|OWNERSHIPS|ESCROWS|MEMO`

## Examples
```
SWEEP|0|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|1|1|1
This example sweeps `TICK` balances, ownerships, and escrowed tokens from the `SOURCE` address to 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev
```

```
SWEEP|0|1BoogrfDADPLQpq8LMASmWQUVYDp4t2hF9|0|1|0
This example sweeps only `TICK` ownerships from the `SOURCE` address to 1BoogrfDADPLQpq8LMASmWQUVYDp4t2hF9
```

## Rules
- `MEMO` characters **NOT** allowed are :
   - pipe `|` (used as field separator)
   - semicolon `;` (used as command separator)

## Notes
