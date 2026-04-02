<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform SDK — ACTION Reference

Complete reference for all 19 ACTION types supported by the XChain Platform SDK.

---

## Creating Actions

The SDK provides two ways to create an action:

### Convenience methods (recommended)

Each action has a dedicated method named after the action in lowercase:

```js
await sdk.send({ tick: 'MYTOKEN', amount: '100', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
await sdk.issue({ tick: 'MYTOKEN', maxSupply: '1000000', decimals: 8 })
await sdk.mint({ tick: 'MYTOKEN', amount: '100' })
// etc.
```

An optional second argument passes encoder options (see [ENCODER.md](./ENCODER.md)):

```js
await sdk.send({ tick: 'MYTOKEN', amount: '100', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' }, { encoding: 'OP_RETURN' })
```

### Generic method

```js
await sdk.createAction({ action: 'SEND', params: { tick: 'MYTOKEN', amount: '100', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' }, encoder: { encoding: 'OP_RETURN' } })
```

### Return value

All action methods return a result object with the following shape:

```js
{
  action:       'SEND',          // normalized ACTION name
  version:      0,               // format version selected (integer)
  actionString: 'SEND|0|MYTOKEN|100|bc1q...', // pipe-delimited protocol string
  fields:       { TICK: 'MYTOKEN', AMOUNT: '100', DESTINATION: 'bc1q...' }, // normalized fields
  encoding:     null,            // encoding type (populated when encoder is used)
  psbt:         null             // PSBT (populated when encoder builds the transaction)
}
```

### Field name normalization

Params may be supplied in camelCase (`maxSupply`, `listActionIndex`) or UPPER_SNAKE_CASE (`MAX_SUPPLY`, `LIST_ACTION_INDEX`). The SDK normalizes both forms before processing.

### Validation dry-run

To validate params without building an action string:

```js
let { valid, errors } = sdk.validateAction('SEND', { tick: 'MYTOKEN', amount: '100', destination: 'bc1q...' })
```

---

## Actions

---

### ADDRESS

Configure address-level preferences for fee routing and memo requirements.

**Format Versions:** v0 (preferences)

**Format:** `ADDRESS|VERSION|FEE_PREFERENCE|REQUIRE_MEMO|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| feePreference | integer | No | Fee routing: `1` = destroy, `2` = protocol, `3` = community |
| requireMemo | integer | No | Whether to require a memo on incoming sends (`0` or `1`) |
| memo | string | No | Optional note |

**Notes:**
- All fields are optional; omitting all fields is valid (no-op update).
- `feePreference` must be `1`, `2`, or `3` if provided.

```js
await sdk.address({ feePreference: 2, requireMemo: 1 })
```

See also: [`../actions/ADDRESS.md`](../../protocol/actions/ADDRESS.md)

---

### AIRDROP

Distribute tokens to all addresses on a list.

**Format Versions:** v0 (single tick, one list), v1 (single tick, one list, multiple destinations per entry), v2 (multiple ticks, separate lists), v3 (multiple ticks with per-entry memos)

**Format v0:** `AIRDROP|VERSION|TICK|AMOUNT|LIST_ACTION_INDEX|MEMO`
**Format v1:** `AIRDROP|VERSION|LIST_ACTION_INDEX|TICK|AMOUNT|TICK|AMOUNT|MEMO`
**Format v2:** `AIRDROP|VERSION|TICK|AMOUNT|LIST_ACTION_INDEX|TICK|AMOUNT|LIST_ACTION_INDEX|MEMO`
**Format v3:** `AIRDROP|VERSION|TICK|AMOUNT|LIST_ACTION_INDEX|MEMO|TICK|AMOUNT|LIST_ACTION_INDEX|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to airdrop (name or `^ID` reference) |
| amount | string | Yes | Amount to send per address on the list |
| listActionIndex | integer | Yes | ACTION_INDEX of the LIST action defining the recipient set |
| memo | string | No | Optional note |

```js
await sdk.airdrop({ tick: 'MYTOKEN', amount: '10', listActionIndex: 42 })
```

See also: [`../actions/AIRDROP.md`](../../protocol/actions/AIRDROP.md)

---

### BATCH

Combine multiple action commands into a single transaction.

**Format Versions:** v0 (command string)

**Format:** `BATCH|VERSION|COMMAND`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| command | string | Yes | Semicolon-delimited list of action strings |

**Notes:**
- BATCH cannot contain nested BATCH actions.
- BATCH cannot contain FILE actions.
- At most **one MINT** action per BATCH.
- At most **one ISSUE** action per BATCH.
- See [BATCH.md](./BATCH.md) for the fluent builder interface (`sdk.batch()`).

```js
await sdk.batch({
  command: 'SEND|0|MYTOKEN|50|bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh|;SEND|0|OTHER|25|bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh|'
})
```

See also: [`../actions/BATCH.md`](../../protocol/actions/BATCH.md)

---

### BROADCAST

Publish a data value or fee schedule on-chain, or settle a previously registered broadcast.

**Format Versions:** v0 (message + value), v1 (message + value + fee + memo), v2 (message + fee + memo), v3 (settle a prior broadcast)

**Format v0:** `BROADCAST|VERSION|MESSAGE|VALUE`
**Format v1:** `BROADCAST|VERSION|MESSAGE|VALUE|FEE|MEMO`
**Format v2:** `BROADCAST|VERSION|MESSAGE|FEE|MEMO`
**Format v3:** `BROADCAST|VERSION|BROADCAST_ACTION_INDEX|VALUE|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| message | string | Conditional | Broadcast message / label (required unless `broadcastActionIndex` is set) |
| value | string/number | No | Numeric value associated with the broadcast |
| fee | string/number | No | Fee percentage (numeric) |
| memo | string | No | Optional note |
| broadcastActionIndex | integer | Conditional | ACTION_INDEX of a prior BROADCAST to settle (alternative to `message`) |

**Notes:**
- Must supply either `message` or `broadcastActionIndex`.
- `message` must not contain `|` or `;`.

```js
// Publish a feed
await sdk.broadcast({ message: 'PRICE_BTC_USD', value: 65000, fee: 0.01 })

// Settle a prior broadcast
await sdk.broadcast({ broadcastActionIndex: 120, value: 67000 })
```

See also: [`../actions/BROADCAST.md`](../../protocol/actions/BROADCAST.md)

---

### CALLBACK

Trigger a callback on an issued token, redeeming holder balances at the terms defined in the ISSUE.

**Format Versions:** v0 (single tick)

**Format:** `CALLBACK|VERSION|TICK|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token name or `^ID` reference to call back |
| memo | string | No | Optional note |

```js
await sdk.callback({ tick: 'MYTOKEN', memo: 'Calling back all holders' })
```

See also: [`../actions/CALLBACK.md`](../../protocol/actions/CALLBACK.md)

---

### DESTROY

Permanently burn tokens, removing them from supply.

**Format Versions:** v0 (single tick), v1 (two ticks, same memo), v2 (two ticks, separate memos)

**Format v0:** `DESTROY|VERSION|TICK|AMOUNT|MEMO`
**Format v1:** `DESTROY|VERSION|TICK|AMOUNT|TICK|AMOUNT|MEMO`
**Format v2:** `DESTROY|VERSION|TICK|AMOUNT|MEMO|TICK|AMOUNT|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to destroy (name or `^ID` reference) |
| amount | string | Yes | Amount to burn |
| memo | string | No | Optional note |

```js
await sdk.destroy({ tick: 'MYTOKEN', amount: '500', memo: 'Deflationary burn' })
```

See also: [`../actions/DESTROY.md`](../../protocol/actions/DESTROY.md)

---

### DISPENSER

Create a vending machine that automatically exchanges one token for another.

**Format Versions:** v0 (create), v1 (cancel), v2 (edit)

**Format v0 (create):** `DISPENSER|VERSION|GIVE_COIN|GIVE_TICK|GIVE_AMOUNT|GIVE_ESCROW|GET_COIN|GET_TICK|GET_AMOUNT|GET_ADDRESS|FIAT_CODE|FIAT_AMOUNT|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`
**Format v1 (cancel):** `DISPENSER|VERSION|DISPENSER_ACTION_INDEX|MEMO`
**Format v2 (edit):** `DISPENSER|VERSION|DISPENSER_ACTION_INDEX|GIVE_ESCROW|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`

**Params — create (v0):**

| Param | Type | Required | Description |
|---|---|---|---|
| giveCoin | string | No | Coin being given (`BTC`, `LTC`, `DOGE`) |
| giveTick | string | Yes | Token being given |
| giveAmount | string | Yes | Amount given per fill |
| giveEscrow | string | No | Amount to escrow upfront |
| getCoin | string | No | Coin accepted in return (`BTC`, `LTC`, `DOGE`) |
| getTick | string | Yes | Token accepted in return |
| getAmount | string | Yes | Amount required per fill |
| getAddress | string | No | Address to receive the get-side funds |
| fiatCode | string | No | Fiat currency code for pricing (e.g. `USD`) |
| fiatAmount | string | No | Fiat price in `X.XX` format |
| expiration | integer | No | Block height at which the dispenser expires |
| allowList | integer | No | ACTION_INDEX of a LIST to restrict buyers |
| blockList | integer | No | ACTION_INDEX of a LIST to ban buyers |
| memo | string | No | Optional note |

**Params — cancel (v1):**

| Param | Type | Required | Description |
|---|---|---|---|
| dispenserActionIndex | integer | Yes | ACTION_INDEX of the dispenser to cancel |
| memo | string | No | Optional note |

**Params — edit (v2):**

| Param | Type | Required | Description |
|---|---|---|---|
| dispenserActionIndex | integer | Yes | ACTION_INDEX of the dispenser to edit |
| giveEscrow | string | No | Updated escrow amount |
| expiration | integer | No | Updated expiration block |
| allowList | integer | No | Updated allow-list ACTION_INDEX |
| blockList | integer | No | Updated block-list ACTION_INDEX |
| memo | string | No | Optional note |

```js
// Create
await sdk.dispenser({
  giveTick: 'MYTOKEN',
  giveAmount: '100',
  getTick: 'BTC',
  getAmount: '0.001',
  getAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  fiatCode: 'USD',
  fiatAmount: '65.00'
})

// Cancel
await sdk.dispenser({ dispenserActionIndex: 77 })
```

See also: [`../actions/DISPENSER.md`](../../protocol/actions/DISPENSER.md)

---

### DIVIDEND

Pay a dividend of one token proportionally to all holders of another token.

**Format Versions:** v0 (single tick)

**Format:** `DIVIDEND|VERSION|TICK|DIVIDEND_TICK|AMOUNT|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token whose holders receive the dividend |
| dividendTick | string | Yes | Token being distributed as the dividend |
| amount | string | Yes | Total amount to distribute |
| memo | string | No | Optional note |

```js
await sdk.dividend({ tick: 'MYTOKEN', dividendTick: 'REWARD', amount: '1000' })
```

See also: [`../actions/DIVIDEND.md`](../../protocol/actions/DIVIDEND.md)

---

### FILE

Attach a file to the chain. File data is supplied via the encoder (not in the action string itself).

**Format Versions:** v0 (metadata)

**Format:** `FILE|VERSION|NAME|TYPE|TITLE|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| name | string | Yes | File name (e.g. `image.png`) |
| type | string | Yes | MIME type or file type identifier |
| title | string | No | Human-readable title |
| memo | string | No | Optional note |

**Notes:**
- Raw file data is passed via the `encoder` argument, not in params.
- FILE actions cannot appear inside a BATCH.

```js
await sdk.file({ name: 'logo.png', type: 'image/png', title: 'Project Logo' }, { rawData: fileBuffer })
```

See also: [`../actions/FILE.md`](../../protocol/actions/FILE.md)

---

### ISSUE

Create or update a token. Multiple update sub-formats allow targeted edits without re-specifying the full token definition.

**Format Versions:** v0 (full create), v1 (description update), v2 (mint params update), v3 (lock update), v4 (callback update), v5 (list update)

**Format v0 (create):** `ISSUE|VERSION|TICK|MAX_SUPPLY|MAX_MINT|DECIMALS|DESCRIPTION|MINT_SUPPLY|TRANSFER|TRANSFER_SUPPLY|LOCK_MAX_SUPPLY|LOCK_MAX_MINT|LOCK_DESCRIPTION|LOCK_SLEEP|LOCK_CALLBACK|CALLBACK_BLOCK|CALLBACK_TICK|CALLBACK_AMOUNT|ALLOW_LIST|BLOCK_LIST|MINT_ADDRESS_MAX|MINT_START_BLOCK|MINT_STOP_BLOCK|LOCK_MINT|LOCK_MINT_SUPPLY|MEMO`
**Format v1 (description):** `ISSUE|VERSION|TICK|DESCRIPTION|MEMO`
**Format v2 (mint params):** `ISSUE|VERSION|TICK|MAX_MINT|MINT_SUPPLY|TRANSFER_SUPPLY|MINT_ADDRESS_MAX|MINT_START_BLOCK|MINT_STOP_BLOCK|MEMO`
**Format v3 (locks):** `ISSUE|VERSION|TICK|LOCK_MAX_SUPPLY|LOCK_MAX_MINT|LOCK_DESCRIPTION|LOCK_SLEEP|LOCK_CALLBACK|LOCK_MINT|LOCK_MINT_SUPPLY|MEMO`
**Format v4 (callback):** `ISSUE|VERSION|TICK|CALLBACK_BLOCK|CALLBACK_TICK|CALLBACK_AMOUNT|MEMO`
**Format v5 (lists):** `ISSUE|VERSION|TICK|ALLOW_LIST|BLOCK_LIST|MEMO`

**Params — full create (v0):**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token name (1–250 chars; see Validation Rules) |
| maxSupply | string | No | Maximum total supply (0 to 1 sextillion) |
| maxMint | string | No | Maximum per-mint amount |
| decimals | integer | No | Decimal places (0–18) |
| description | string | No | Token description (max 250 chars) |
| mintSupply | string | No | Supply made available for minting |
| transfer | string | No | Address authorized to transfer the issuance |
| transferSupply | string | No | Amount of supply available for transfer |
| lockMaxSupply | integer | No | Lock max supply from future changes (`0` or `1`) |
| lockMaxMint | integer | No | Lock max mint from future changes (`0` or `1`) |
| lockDescription | integer | No | Lock description from future changes (`0` or `1`) |
| lockSleep | integer | No | Lock sleep from future changes (`0` or `1`) |
| lockCallback | integer | No | Lock callback from future changes (`0` or `1`) |
| callbackBlock | integer | No | Block height at which the callback triggers |
| callbackTick | string | No | Token paid out on callback |
| callbackAmount | string | No | Amount paid per token on callback |
| allowList | integer | No | ACTION_INDEX of a LIST to restrict minters |
| blockList | integer | No | ACTION_INDEX of a LIST to ban minters |
| mintAddressMax | string | No | Maximum mints allowed per address |
| mintStartBlock | integer | No | Block height minting opens |
| mintStopBlock | integer | No | Block height minting closes |
| lockMint | integer | No | Lock minting permanently (`0` or `1`) |
| lockMintSupply | integer | No | Lock mint supply from future changes (`0` or `1`) |
| memo | string | No | Optional note |

**Params — description update (v1):**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to update |
| description | string | No | New description |
| memo | string | No | Optional note |

**Params — mint params update (v2):**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to update |
| maxMint | string | No | New max-mint value |
| mintSupply | string | No | New mint supply |
| transferSupply | string | No | New transfer supply |
| mintAddressMax | string | No | New per-address mint cap |
| mintStartBlock | integer | No | New mint open block |
| mintStopBlock | integer | No | New mint close block |
| memo | string | No | Optional note |

**Params — lock update (v3):**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to update |
| lockMaxSupply | integer | No | `0` or `1` |
| lockMaxMint | integer | No | `0` or `1` |
| lockDescription | integer | No | `0` or `1` |
| lockSleep | integer | No | `0` or `1` |
| lockCallback | integer | No | `0` or `1` |
| lockMint | integer | No | `0` or `1` |
| lockMintSupply | integer | No | `0` or `1` |
| memo | string | No | Optional note |

**Params — callback update (v4):**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to update |
| callbackBlock | integer | No | New callback block height |
| callbackTick | string | No | New callback payout token |
| callbackAmount | string | No | New callback payout amount |
| memo | string | No | Optional note |

**Params — list update (v5):**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to update |
| allowList | integer | No | New allow-list ACTION_INDEX |
| blockList | integer | No | New block-list ACTION_INDEX |
| memo | string | No | Optional note |

```js
// Full create
await sdk.issue({
  tick: 'MYTOKEN',
  maxSupply: '1000000',
  maxMint: '100',
  decimals: 8,
  description: 'My first XChain token',
  mintStartBlock: 850000
})

// Update description only
await sdk.issue({ tick: 'MYTOKEN', description: 'Updated description' })

// Lock max supply
await sdk.issue({ tick: 'MYTOKEN', lockMaxSupply: 1 })
```

See also: [`../actions/ISSUE.md`](../../protocol/actions/ISSUE.md)

---

### LINK

Link two on-chain actions across chains, establishing an association between them.

**Format Versions:** v0 (two-action link)

**Format:** `LINK|VERSION|COIN1|COIN1_ACTION_INDEX|COIN2|COIN2_ACTION_INDEX|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| coin1 | string | Yes | First coin (`BTC`, `LTC`, `DOGE`) |
| coin1ActionIndex | integer | Yes | ACTION_INDEX on `coin1` |
| coin2 | string | Yes | Second coin (`BTC`, `LTC`, `DOGE`) |
| coin2ActionIndex | integer | Yes | ACTION_INDEX on `coin2` |
| memo | string | No | Optional note |

```js
await sdk.link({ coin1: 'BTC', coin1ActionIndex: 500, coin2: 'LTC', coin2ActionIndex: 200 })
```

See also: [`../actions/LINK.md`](../../protocol/actions/LINK.md)

---

### LIST

Create or edit an allow/block list of ticks or addresses.

**Format Versions:** v0 (create), v1 (edit — add/remove items)

**Format v0 (create):** `LIST|VERSION|TYPE|ITEM`
**Format v1 (edit):** `LIST|VERSION|EDIT|LIST_ACTION_INDEX|ITEM`

**Params — create (v0):**

| Param | Type | Required | Description |
|---|---|---|---|
| type | integer | Yes | List type: `1` = TICK list, `2` = ADDRESS list |
| item | string | Yes | Initial item to add |

**Params — edit (v1):**

| Param | Type | Required | Description |
|---|---|---|---|
| edit | integer | Yes | Edit operation: `1` = ADD, `2` = REMOVE |
| listActionIndex | integer | Yes | ACTION_INDEX of the LIST to edit |
| item | string | Yes | Item to add or remove |

```js
// Create an address list
await sdk.list({ type: 2, item: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })

// Add to an existing list
await sdk.list({ edit: 1, listActionIndex: 55, item: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
```

See also: [`../actions/LIST.md`](../../protocol/actions/LIST.md)

---

### MESSAGE

Send an encrypted or plaintext message to a destination address.

**Format Versions:** v0 (key exchange setup), v1 (key exchange — same as v0), v2 (encrypted message body), v3 (plaintext message)

**Format v0/v1 (key exchange):** `MESSAGE|VERSION|DESTINATION|ENCRYPTION_METHOD|ENCRYPTION_KEY`
**Format v2 (encrypted body):** `MESSAGE|VERSION|DESTINATION|ENCRYPTED_MESSAGE`
**Format v3 (plaintext):** `MESSAGE|VERSION|DESTINATION|PLAINTEXT_MESSAGE`

**Params — key exchange (v0/v1):**

| Param | Type | Required | Description |
|---|---|---|---|
| destination | string | Yes | Recipient address |
| encryptionMethod | integer | Yes | `1` = ECDH, `2` = AES |
| encryptionKey | string | Yes | Public key or shared key material (max 1 MB) |

**Params — encrypted message (v2):**

| Param | Type | Required | Description |
|---|---|---|---|
| destination | string | Yes | Recipient address |
| encryptedMessage | string | Yes | Encrypted message payload (max 1 MB) |

**Params — plaintext (v3):**

| Param | Type | Required | Description |
|---|---|---|---|
| destination | string | Yes | Recipient address |
| plaintextMessage | string | Yes | Plaintext message body (max 1 MB) |

```js
// Plaintext
await sdk.message({ destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', plaintextMessage: 'Hello!' })

// Key exchange
await sdk.message({ destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', encryptionMethod: 1, encryptionKey: '<pubkey>' })
```

See also: [`../actions/MESSAGE.md`](../../protocol/actions/MESSAGE.md)

---

### MINT

Mint new tokens from an existing ISSUE's mintable supply.

**Format Versions:** v0 (single mint)

**Format:** `MINT|VERSION|TICK|AMOUNT|DESTINATION|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to mint (name or `^ID` reference) |
| amount | string | Yes | Amount to mint |
| destination | string | No | Address to receive the minted tokens (defaults to sender) |
| memo | string | No | Optional note |

```js
await sdk.mint({ tick: 'MYTOKEN', amount: '100', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
```

See also: [`../actions/MINT.md`](../../protocol/actions/MINT.md)

---

### ORDER

Create a peer-to-peer token exchange order.

**Format Versions:** v0 (create), v1 (cancel), v2 (edit)

**Format v0 (create):** `ORDER|VERSION|GIVE_COIN|GIVE_TICK|GIVE_AMOUNT|GET_COIN|GET_TICK|GET_AMOUNT|GET_ADDRESS|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`
**Format v1 (cancel):** `ORDER|VERSION|ORDER_ACTION_INDEX|MEMO`
**Format v2 (edit):** `ORDER|VERSION|ORDER_ACTION_INDEX|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`

**Params — create (v0):**

| Param | Type | Required | Description |
|---|---|---|---|
| giveCoin | string | No | Coin being offered (`BTC`, `LTC`, `DOGE`) |
| giveTick | string | Yes | Token being offered |
| giveAmount | string | Yes | Amount being offered |
| getCoin | string | No | Coin requested in return (`BTC`, `LTC`, `DOGE`) |
| getTick | string | Yes | Token requested in return |
| getAmount | string | Yes | Amount requested |
| getAddress | string | No | Address to receive the get-side funds |
| expiration | integer | No | Block height at which the order expires |
| allowList | integer | No | ACTION_INDEX of a LIST to restrict takers |
| blockList | integer | No | ACTION_INDEX of a LIST to ban takers |
| memo | string | No | Optional note |

**Params — cancel (v1):**

| Param | Type | Required | Description |
|---|---|---|---|
| orderActionIndex | integer | Yes | ACTION_INDEX of the order to cancel |
| memo | string | No | Optional note |

**Params — edit (v2):**

| Param | Type | Required | Description |
|---|---|---|---|
| orderActionIndex | integer | Yes | ACTION_INDEX of the order to edit |
| expiration | integer | No | Updated expiration block |
| allowList | integer | No | Updated allow-list ACTION_INDEX |
| blockList | integer | No | Updated block-list ACTION_INDEX |
| memo | string | No | Optional note |

```js
// Create
await sdk.order({
  giveTick: 'MYTOKEN',
  giveAmount: '500',
  getTick: 'OTHER',
  getAmount: '1000',
  getAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  expiration: 900000
})

// Cancel
await sdk.order({ orderActionIndex: 99 })
```

See also: [`../actions/ORDER.md`](../../protocol/actions/ORDER.md)

---

### SEND

Transfer tokens to one or more destination addresses.

**Format Versions:** v0 (single send), v1 (one tick, multiple destinations), v2 (multiple ticks, one memo), v3 (multiple ticks, per-send memos)

**Format v0:** `SEND|VERSION|TICK|AMOUNT|DESTINATION|MEMO`
**Format v1:** `SEND|VERSION|TICK|AMOUNT|DESTINATION|AMOUNT|DESTINATION|MEMO`
**Format v2:** `SEND|VERSION|TICK|AMOUNT|DESTINATION|TICK|AMOUNT|DESTINATION|MEMO`
**Format v3:** `SEND|VERSION|TICK|AMOUNT|DESTINATION|MEMO|TICK|AMOUNT|DESTINATION|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| tick | string | Yes | Token to send (name or `^ID` reference) |
| amount | string | Yes | Amount to send |
| destination | string | Yes | Recipient address |
| memo | string | No | Optional note attached to the send |

```js
await sdk.send({ tick: 'MYTOKEN', amount: '100', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })

// With memo
await sdk.send({ tick: 'MYTOKEN', amount: '100', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', memo: 'Payment for invoice 42' })
```

See also: [`../actions/SEND.md`](../../protocol/actions/SEND.md)

---

### SLEEP

Pause all activity on an address (or a specific token on an address) until a given block height.

**Format Versions:** v0 (address-wide sleep), v1 (tick-specific sleep)

**Format v0:** `SLEEP|VERSION|RESUME_BLOCK|MEMO`
**Format v1:** `SLEEP|VERSION|RESUME_BLOCK|TICK|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| resumeBlock | integer | Yes | Block height at which sleep ends |
| tick | string | No | If set, sleep applies only to this token |
| memo | string | No | Optional note |

```js
// Pause all activity until block 900000
await sdk.sleep({ resumeBlock: 900000 })

// Pause only MYTOKEN until block 900000
await sdk.sleep({ resumeBlock: 900000, tick: 'MYTOKEN' })
```

See also: [`../actions/SLEEP.md`](../../protocol/actions/SLEEP.md)

---

### SWAP

Fulfill an open ORDER by providing the requested side of the exchange.

**Format Versions:** v0 (create swap / accept an order), v1 (cancel), v2 (edit)

**Format v0:** `SWAP|VERSION|GIVE_COIN|GIVE_TICK|GIVE_AMOUNT|GET_COIN|GET_TICK|GET_AMOUNT|GET_ADDRESS|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`
**Format v1:** `SWAP|VERSION|SWAP_ACTION_INDEX|MEMO`
**Format v2:** `SWAP|VERSION|SWAP_ACTION_INDEX|EXPIRATION|ALLOW_LIST|BLOCK_LIST|MEMO`

**Params — create (v0):**

| Param | Type | Required | Description |
|---|---|---|---|
| giveCoin | string | No | Coin being given (`BTC`, `LTC`, `DOGE`) |
| giveTick | string | Yes | Token being given |
| giveAmount | string | Yes | Amount being given |
| getCoin | string | No | Coin requested in return (`BTC`, `LTC`, `DOGE`) |
| getTick | string | Yes | Token requested |
| getAmount | string | Yes | Amount requested |
| getAddress | string | No | Address to receive the get-side funds |
| expiration | integer | No | Block height at which the swap offer expires |
| allowList | integer | No | ACTION_INDEX of a LIST to restrict counterparties |
| blockList | integer | No | ACTION_INDEX of a LIST to ban counterparties |
| memo | string | No | Optional note |

**Params — cancel (v1):**

| Param | Type | Required | Description |
|---|---|---|---|
| swapActionIndex | integer | Yes | ACTION_INDEX of the swap to cancel |
| memo | string | No | Optional note |

**Params — edit (v2):**

| Param | Type | Required | Description |
|---|---|---|---|
| swapActionIndex | integer | Yes | ACTION_INDEX of the swap to edit |
| expiration | integer | No | Updated expiration block |
| allowList | integer | No | Updated allow-list ACTION_INDEX |
| blockList | integer | No | Updated block-list ACTION_INDEX |
| memo | string | No | Optional note |

```js
// Accept an order
await sdk.swap({
  giveTick: 'OTHER',
  giveAmount: '1000',
  getTick: 'MYTOKEN',
  getAmount: '500',
  getAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
})

// Cancel
await sdk.swap({ swapActionIndex: 103 })
```

See also: [`../actions/SWAP.md`](../../protocol/actions/SWAP.md)

---

### SWEEP

Transfer all balances, ownerships, and/or escrows from the current address to a destination address.

**Format Versions:** v0 (full sweep configuration)

**Format:** `SWEEP|VERSION|DESTINATION|BALANCES|OWNERSHIPS|ESCROWS|MEMO`

**Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| destination | string | Yes | Address to receive swept assets |
| balances | integer | No | Include token balances: `1` = yes (default), `0` = no |
| ownerships | integer | No | Include token ownerships: `1` = yes (default), `0` = no |
| escrows | integer | No | Include escrowed amounts: `1` = yes, `0` = no (default) |
| memo | string | No | Optional note |

```js
// Sweep everything
await sdk.sweep({ destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })

// Sweep balances and ownerships but not escrows
await sdk.sweep({ destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', balances: 1, ownerships: 1, escrows: 0 })
```

See also: [`../actions/SWEEP.md`](../../protocol/actions/SWEEP.md)

---

## Validation Rules

The SDK enforces these rules before serializing any action. Violations throw an `SDKValidationError`.

### TICK names (for ISSUE)

- Length: 1–250 characters.
- Allowed characters: `a-z A-Z 0-9 ~ ! @ # $ % ^ & * ( ) _ + - = { } [ ] \ : < > . ?`
- Cannot start with `^` (that prefix is reserved for ACTION_INDEX references).
- Cannot contain `|` (field separator) or `;` (command separator).
- Cannot contain `.` (parent/child separator) or `/` (directory separator).

### TICK references (everywhere except ISSUE)

When referencing an existing token by its indexer ID rather than its name, prefix with `^`:

```
^42    // reference ACTION_INDEX 42
```

The numeric part after `^` must be a valid integer.

### MEMO and DESCRIPTION text fields

- Cannot contain `|` (pipe) or `;` (semicolon).
- `DESCRIPTION` is additionally limited to **250 characters**.

### MESSAGE fields (`PLAINTEXT_MESSAGE`, `ENCRYPTED_MESSAGE`, `ENCRYPTION_KEY`)

- Maximum length: **1,048,576 characters** (1 MB).
- Cannot contain `|` or `;`.

### DECIMALS

- Must be an integer in the range **0–18**.

### MAX_SUPPLY

- Must be a non-negative integer.
- Maximum value: **1,000,000,000,000,000,000,000** (1 sextillion).

### Lock fields

`LOCK_MAX_SUPPLY`, `LOCK_MAX_MINT`, `LOCK_DESCRIPTION`, `LOCK_SLEEP`, `LOCK_CALLBACK`, `LOCK_MINT`, `LOCK_MINT_SUPPLY`

- Must be **`0`** or **`1`**.

### BALANCES / OWNERSHIPS / ESCROWS (SWEEP)

- Must be **`0`** or **`1`**.

### FIAT_CODE

Must be one of: `USD`, `CAD`, `AUD`, `MXN`, `GBP`, `JPY`, `CNY`, `CHF`, `BRL`, `INR`

### FIAT_AMOUNT

- Must match the pattern `X.XX` — a numeric value with exactly two decimal places (e.g. `65.00`, `1234.99`).

### Coin fields (`GIVE_COIN`, `GET_COIN`, `COIN1`, `COIN2`)

Must be one of: `BTC`, `LTC`, `DOGE`

### Address fields (`DESTINATION`, `GET_ADDRESS`, `TRANSFER`)

Must be a valid cryptocurrency address (validated by the SDK utility layer).

### ENCRYPTION_METHOD (MESSAGE)

Must be **`1`** (ECDH) or **`2`** (AES).

### FEE_PREFERENCE (ADDRESS)

Must be **`1`** (destroy), **`2`** (protocol), or **`3`** (community).

### LIST TYPE

Must be **`1`** (TICK list) or **`2`** (ADDRESS list).

### LIST EDIT

Must be **`1`** (ADD) or **`2`** (REMOVE).

### ACTION_INDEX fields

All `*_ACTION_INDEX` fields (`BROADCAST_ACTION_INDEX`, `DISPENSER_ACTION_INDEX`, `ORDER_ACTION_INDEX`, `SWAP_ACTION_INDEX`, `LIST_ACTION_INDEX`, `COIN1_ACTION_INDEX`, `COIN2_ACTION_INDEX`) must be numeric.

### BATCH constraints

- BATCH cannot contain nested BATCH actions.
- BATCH cannot contain FILE actions.
- At most **one MINT** per BATCH.
- At most **one ISSUE** per BATCH.

### Encoding size limits

When an `encoder` with an explicit `encoding` is passed, the SDK validates that the serialized action string fits within the encoding's byte budget:

| Encoding | Max data bytes |
|---|---|
| `OP_RETURN` | 76 bytes (80 − 4-byte magic `XCHN`) |
| `MULTISIGN` | ~61 bytes per chunk |
| `P2SH` | 476 bytes (520 − 44-byte script overhead) |
| `P2WSH` | 9,956 bytes (10,000 − 44-byte script overhead) |

If the action string exceeds the limit, an `ENCODING_DATA_TOO_LARGE` error is thrown with a suggested alternative encoding.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
