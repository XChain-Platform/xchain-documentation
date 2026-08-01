<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK: NFT & Registry Builders

This document covers two pure-builder namespaces exposed on the SDK instance:

- `sdk.nft.*`: param builders for the NFT pattern (ISSUE with DECIMALS=0 and LOCK_MAX_SUPPLY=1), collection child ticks, content attachment (LINK params), TIS documents, and the canonical NFT classifier.
- `sdk.project.*`: param builders for official-token project rosters (TICK-type LIST + owner-validated LINK).

Neither namespace makes network calls. Submit-flow recipes that wire these builders into live actions live on `sdk.workflows` (see [Workflows](workflows.md)).

**Protocol specs:**

- [NFT Standard](../../protocol/nft-standard.md)
- [Project Registry](../../protocol/project-registry.md)
- [Token Information Standard](../../protocol/token-information-standard.md)

---

## sdk.nft.*

### `sdk.nft.unique(params)` → ISSUE params

Build ISSUE params for a unique 1-of-1 NFT fully minted to the issuer.

```js
const params = sdk.nft.unique({
    tick:        'MYART',         // required
    description: 'action:12345', // optional; TIS data_ref or URL
    transfer:    null,            // optional; transfer issuer ownership after issue
    memo:        null             // optional
});
// Returns: { tick, maxSupply: '1', mintSupply: '1', decimals: '0', lockMaxSupply: '1', ... }
```

The SDK's key invariant: `DECIMALS=0` and `LOCK_MAX_SUPPLY=1`. Every unique token's maximum supply is exactly 1.

---

### `sdk.nft.edition(params)` → ISSUE params

Build ISSUE params for an edition of N identical, indivisible prints.

```js
// Pre-minted edition: full supply goes to the issuer immediately
const params = sdk.nft.edition({
    tick:   'PRINTS',            // required
    supply: '100',               // required; MAX_SUPPLY (edition size)
    description: null,
    transfer:    null,
    memo:        null
});

// Fair-mint edition: MINT window; zero prints self-minted at issuance
const params = sdk.nft.edition({
    tick:   'PRINTS',
    supply: '100',
    mint: {
        maxMint:    '1',       // MAX_MINT per mint call
        perAddress: '2',       // optional; MINT_ADDRESS_MAX
        startBlock: 850000,    // optional; MINT_START_BLOCK
        stopBlock:  860000     // optional; MINT_STOP_BLOCK
    }
});
```

When `mint` is present, `LOCK_MAX_SUPPLY` validates the declared cap (not minted supply), so the full supply stays publicly mintable.

---

### `sdk.nft.collectionItem(params)` → ISSUE params

Build ISSUE params for a distinct 1-of-1 collection item. The resulting tick is `parent.name`. The issuer must own the parent tick (enforced by the indexer; this builder only constructs params).

```js
const params = sdk.nft.collectionItem({
    parent: 'MYCOLLECTION',   // required
    name:   'item001',        // required; child segment only, must not contain '.'
    description: null,
    transfer:    null,
    memo:        null
});
// Equivalent to sdk.nft.unique({ tick: 'MYCOLLECTION.item001', ... })
```

---

### `sdk.nft.attachContentParams(params)` → LINK params

Build LINK params that officially attach a FILE to a token (the NFT content-attachment pattern). The LINK source must own the token; the indexer validates ownership.

```js
const params = sdk.nft.attachContentParams({
    coin:             'BTC',   // or pass fileCoin/issueCoin separately for cross-chain
    fileActionIndex:  12345,   // ACTION_INDEX of the FILE upload
    issueActionIndex: 99,      // ACTION_INDEX of the token's ISSUE
    memo:             null
});
// Returns: { coin1, coin1ActionIndex, coin2, coin2ActionIndex, memo }
```

For cross-chain attachments pass `fileCoin` and `issueCoin` instead of `coin`.

---

### `sdk.nft.tisDocument(params)` → `{ doc, json }`

Build a minimal TIS v1.0.0 document for an NFT-pattern token. The intended workflow is: upload the returned JSON as a FILE action (TYPE `application/json`), then set the token's DESCRIPTION to `action:<index>` of that upload.

```js
const { doc, json } = sdk.nft.tisDocument({
    tick:             'MYART',              // required
    name:             'My Art Token',       // optional; display name
    description:      'A 1-of-1 collectible', // optional; prose description
    imageActionIndex: 12345,                // optional; on-chain artwork FILE
    imageCoin:        null,                 // optional; base coin ticker when artwork
                                            //   is on a sibling chain (e.g. 'DOGE')
    imageUrl:         null,                 // optional; off-chain URL (data_ref preferred)
    imageType:        'image/png',          // optional; artwork MIME type
    imageName:        'artwork.png'         // optional; artwork filename
});
```

**`doc` shape:**

```json
{
  "tick": "MYART",
  "categories": [{ "type": "main", "data": "NFT" }],
  "name": "My Art Token",
  "description": "A 1-of-1 collectible",
  "images": [
    {
      "data_ref": "action:12345",
      "type": "image/png",
      "name": "artwork.png"
    }
  ]
}
```

**Cross-chain `data_ref` form:** when `imageCoin` is provided, the reference becomes `action:<COIN>:<index>` (e.g. `action:DOGE:12345`). The base coin ticker is used; the network tier (mainnet/testnet/regtest) is implied by context. This is the same form used in TIS `data_ref` fields and on-chain DESCRIPTION pointers.

---

### `sdk.nft.isNft(token)` → boolean

Canonical NFT classification predicate. Returns `true` when a token record satisfies the NFT pattern: `DECIMALS=0` and `LOCK_MAX_SUPPLY=1`. Accepts UPPER_SNAKE (indexer shape), snake_case (explorer JSON), or camelCase SDK shapes.

```js
const token = await sdk.getToken('MYART');
if (sdk.nft.isNft(token)) {
    console.log('MYART is an NFT');
}
```

---

## sdk.project.*

### `sdk.project.rosterParams(params)` → LIST params

Build LIST v0 params for a new official-token roster (TYPE=TICK).

```js
const params = sdk.project.rosterParams({
    ticks: ['TOKENA', 'TOKENB', 'TOKENC']   // required; non-empty array of TICK names
});
// Returns: { type: '1', item: ['TOKENA', 'TOKENB', 'TOKENC'] }
```

---

### `sdk.project.rosterEditParams(params)` → LIST params

Build LIST v1 params that derive a new roster from an existing one. Pass `add` OR `remove`. Not both (two edits require two LIST actions).

```js
// Add a tick
const params = sdk.project.rosterEditParams({
    listActionIndex: 200,          // required; ACTION_INDEX of the existing roster LIST
    add:             ['TOKEND']    // or remove: ['TOKENA'] (never both)
});
// Returns: { edit: '1', listActionIndex: '200', item: ['TOKEND'] }
```

---

### `sdk.project.attestRosterParams(params)` → LINK params

Build LINK params that attest a roster to a project (the owner-validated green-banner binding). Both sides must be on the project's own chain; cross-chain LINK rows carry no authority (the indexer skips owner validation when COIN2 is remote).

```js
const params = sdk.project.attestRosterParams({
    coin:             'BTC',   // required; the project's chain
    listActionIndex:  200,     // required; ACTION_INDEX of the roster LIST
    issueActionIndex: 99,      // required; ACTION_INDEX of the project tick's ISSUE
    memo:             null     // optional
});
// Returns: { coin1: 'BTC', coin1ActionIndex: '200', coin2: 'BTC', coin2ActionIndex: '99', memo }
```

The LINK source must be the project tick's current owner. The indexer rejects the LINK during ownership escrow.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
