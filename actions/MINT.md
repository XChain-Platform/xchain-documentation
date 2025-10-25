---

**Copyright © 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**  

Licensed under the **Dankest Community License**  
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).  

You may not use, modify, or distribute this material except in compliance with the License.  
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)

---

# XChain Platform Action Specification - MINT
This action mints `TICK` supply.

## PARAMS
| Name          | Type   | Description                          |
| ------------- | ------ | ------------------------------------ |
| `VERSION`     | String | Format Version                       |
| `TICK`        | String | Ticker name or Ticker ID             |
| `AMOUNT`      | String | Amount of `TICK` to mint             |
| `DESTINATION` | String | Address to transfer minted `TICK` to |
| `MEMO`        | String | An optional memo to include          |

## Formats

### Version `0`
- `VERSION|TICK|AMOUNT|DESTINATION|MEMO`

## Examples
```
MINT|0|JDOG|1
This example mints 1 JDOG `token` to the broadcasting address
```

```
MINT|0|BRRR|10000000000000|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev
This example mints 10,000,000,000,000 BRRR tokens and transfers them to 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev 
```

## Rules
- `TICK` supply may be minted until `MAX_SUPPLY` is reached.
- Transactions that attempt to mint supply beyond `MAX_SUPPLY` shall be considered invalid and ignored.

## Notes
- Use `^` (caret) as prefix when passing `TICK_ID` for `TICK` field (^1234 = `TICK_ID` 1234)