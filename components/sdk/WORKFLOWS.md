<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK: Workflow Recipes

Workflow recipes are high-level helpers that compose multiple actions into common multi-step operations. Each recipe creates a wallet session internally and executes the steps sequentially with UTXO chaining.

All workflow methods are available directly on the SDK instance and also via `sdk.workflows`.

---

## issueAndDistribute

Issue a new token and immediately send it to multiple recipients:

```js
const result = await sdk.issueAndDistribute(
    wif,
    { tick: 'NEWTOKEN', maxSupply: '1000000', decimals: 8 },
    [
        { destination: 'bc1qaddr1...', amount: '500000' },
        { destination: 'bc1qaddr2...', amount: '300000' },
        { destination: 'bc1qaddr3...', amount: '200000' }
    ]
);

console.log(result.issue.txid);      // ISSUE transaction
console.log(result.sends[0].txid);   // first SEND transaction
console.log(result.sends.length);    // 3
```

---

## issueAndMint

Issue a new token and mint the initial supply in one flow:

```js
const result = await sdk.issueAndMint(
    wif,
    { tick: 'NEWTOKEN', maxSupply: '1000000', decimals: 8 },
    { amount: '100000', destination: 'bc1qrecipient...' }
);

console.log(result.issue.txid); // ISSUE transaction
console.log(result.mint.txid);  // MINT transaction
```

The `tick` field in mintParams is automatically filled from the issue params.

---

## createDispenser

Create a token dispenser:

```js
const result = await sdk.createDispenser(wif, {
    giveTick:   'MYTOKEN',
    giveAmount: '10',
    giveEscrow: '1000',
    getTick:    'BTC',
    getAmount:  '0.001',
    memo:       '10 MYTOKEN per 0.001 BTC'
});

console.log(result.txid);
```

---

## createOrder / cancelOrder

Place and cancel DEX orders:

```js
// Place an order
const result = await sdk.createOrder(wif, {
    giveTick:   'TOKENA',
    giveAmount: '100',
    getTick:    'TOKENB',
    getAmount:  '200',
    expiration: 850000
});

// Cancel the order (using the indexed action_index)
await sdk.cancelOrder(wif, result.indexed.action_index);
```

---

## stakeAndDelegate

Stake XCHAIN tokens and delegate a signing key in one flow (capability staking; BTC-only):

```js
const result = await sdk.stakeAndDelegate(
    wif,
    { version: 1, amount: '1000', signingPubkey: 'aabb...' },  // capabilities auto-qualified from amount; pubkey is 64 hex chars
    { newSigningPubkey: 'ccdd...' }  // optional; omit to skip delegation
);

console.log(result.stake.txid);
console.log(result.delegate.txid);   // null if delegateParams was omitted
```

---

## deployAndFund

Deploy a smart contract and optionally deposit initial tokens:

```js
const result = await sdk.deployAndFund(
    wif,
    {
        code: 'class MyContract { constructor() { this.count = 0; } increment() { this.count++; } }',
        gasLimit: 100000
    },
    [
        { tick: 'TOKENA', quantity: '1000' },
        { tick: 'TOKENB', quantity: '500' }
    ]
);

console.log(result.deploy.txid);
console.log(result.deploy.indexed.action_index);  // contract ACTION_INDEX
console.log(result.deposits.length);               // 2
```

The contract `action_index` from the deploy result is automatically used for the deposit operations.

---

## distributeDividend

Distribute a dividend to all holders of a token:

```js
const result = await sdk.distributeDividend(wif, {
    tick:         'HOLDERTOKEN',
    dividendTick: 'REWARDTOKEN',
    amount:       '10000'
});

console.log(result.txid);
```

---

## issueNft

Issue a unique 1-of-1 NFT fully minted to the issuer. Builds ISSUE params via `sdk.nft.unique()`:

```js
const result = await sdk.issueNft(wif, {
    tick:        'MYART',
    description: 'action:12345',  // optional TIS data_ref or URL
    transfer:    null,             // optional; transfer issuer ownership after issue
    memo:        null
});

console.log(result.txid);
```

---

## issueNftEdition

Issue an edition of N identical, indivisible prints. Builds ISSUE params via `sdk.nft.edition()`. Pass `mint` to open a public fair-mint window instead of pre-minting the full supply to the issuer:

```js
// Pre-minted edition: all prints go to the issuer immediately
const result = await sdk.issueNftEdition(wif, {
    tick:   'PRINTS',
    supply: '100',
    memo:   'Limited edition'
});

// Fair-mint edition: public MINT window (no prints pre-minted)
const result = await sdk.issueNftEdition(wif, {
    tick:   'PRINTS',
    supply: '100',
    mint: {
        maxMint:    '1',    // max prints per mint call
        perAddress: '2',    // optional: max per address
        startBlock: 850000, // optional
        stopBlock:  860000  // optional
    }
});

console.log(result.txid);
```

---

## issueCollectionItem

Issue a distinct 1-of-1 item in a collection; a child TICK `parent.name`. The issuer must currently own the parent (enforced by the indexer). Builds params via `sdk.nft.collectionItem()`:

```js
const result = await sdk.issueCollectionItem(wif, {
    parent:      'MYCOLLECTION',
    name:        'item001',      // child segment only; must not contain '.'
    description: 'action:12345',
    memo:        null
});

console.log(result.txid);
```

---

## attachContent

Attach content to a token: upload a FILE, then LINK it to the token's ISSUE. Optionally author an on-chain TIS document pointing at the uploaded artwork. Requires `waitForIndexer: true` so each leg's ACTION_INDEX is resolvable before the next:

```js
const result = await sdk.attachContent(
    wif,
    {
        coin:             'BTC',
        issueActionIndex: 12345,      // ACTION_INDEX of the token's ISSUE
        file: {
            name:    'artwork.png',
            type:    'image/png',
            title:   'My Artwork',
            rawData: '<binary string>'
        },
        memo: null,
        // optional: also author an on-chain TIS document
        tis: {
            tick:        'MYART',
            name:        'My Art Token',
            description: 'A 1-of-1 digital collectible'
        }
    },
    { waitForIndexer: true }    // required
);

console.log(result.file.txid);    // FILE upload
console.log(result.link.txid);    // LINK attaching artwork to token
console.log(result.tisFile.txid); // TIS JSON FILE (only present when tis: was passed)
console.log(result.describe.txid);// ISSUE v1 pointing DESCRIPTION at TIS (same condition)
```

---

## setRoster

Publish (or replace) a project's official-token roster: submit a TICK-type LIST, then LINK it to the project's ISSUE. The LINK must come from the project tick's current owner. Requires `waitForIndexer: true`:

```js
// New roster
const result = await sdk.setRoster(
    wif,
    {
        coin:             'BTC',
        issueActionIndex: 99,        // ACTION_INDEX of the project tick's ISSUE
        ticks:            ['TOKENA', 'TOKENB', 'TOKENC'],
        memo:             null
    },
    { waitForIndexer: true }
);

// Edit an existing roster (add or remove; not both in one action)
const result = await sdk.setRoster(
    wif,
    {
        coin:             'BTC',
        issueActionIndex: 99,
        edit: {
            listActionIndex: 200,    // ACTION_INDEX of the existing roster LIST
            add:             ['TOKEND']   // use remove: ['TOKENA'] to remove instead
        }
    },
    { waitForIndexer: true }
);

console.log(result.list.txid);  // LIST (roster)
console.log(result.link.txid);  // LINK (roster attestation)
```

---

## Custom Workflows

All recipes use `WalletSession` internally. You can compose your own multi-step workflows:

```js
const session = sdk.session(wif);

// Custom workflow: issue, mint, then create a dispenser
await session.issue({ tick: 'TOKEN', maxSupply: '1000000', decimals: 8 });
await session.mint({ tick: 'TOKEN', amount: '1000', destination: session.address });
await session.dispenser({
    giveTick: 'TOKEN', giveAmount: '10', giveEscrow: '1000',
    getTick: 'BTC', getAmount: '0.001'
});
```

---

## Related Documentation

- [Wallet Sessions](SESSIONS.md); the session object used by all workflows
- [Transaction Lifecycle](LIFECYCLE.md): `submitAction` details, fee estimation
- [Actions](ACTIONS.md): parameter reference for each action type
- [Cross-Chain](CROSSCHAIN.md): multi-chain coordination

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
