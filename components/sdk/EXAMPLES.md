<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Examples

End-to-end usage examples for common XChain Platform SDK workflows.

## Table of Contents

- [Setup](#setup)
- [Query Balances](#query-balances)
- [Get Token Info](#get-token-info)
- [Send Tokens](#send-tokens)
- [Send Tokens with PSBT](#send-tokens-with-psbt)
- [Issue a New Token](#issue-a-new-token)
- [Update Token Description](#update-token-description)
- [Lock Token Properties](#lock-token-properties)
- [Mint Tokens](#mint-tokens)
- [Destroy Tokens](#destroy-tokens)
- [Create a Dispenser](#create-a-dispenser)
- [Cancel a Dispenser](#cancel-a-dispenser)
- [Place a DEX Order](#place-a-dex-order)
- [Cancel a DEX Order](#cancel-a-dex-order)
- [Batch Multiple Actions](#batch-multiple-actions)
- [Cross-Chain Swap](#cross-chain-swap)
- [Sweep All Balances](#sweep-all-balances)
- [Broadcast a Message](#broadcast-a-message)
- [Send a Plaintext Message](#send-a-plaintext-message)
- [Send an Encrypted Message (ECIES)](#send-an-encrypted-message-ecies)
- [Read and Decrypt Messages](#read-and-decrypt-messages)
- [ECIES Encrypt/Decrypt Without Sending](#ecies-encryptdecrypt-without-sending)
- [ECDH Session Messaging](#ecdh-session-messaging)
- [AES Pre-Shared Key Messaging](#aes-pre-shared-key-messaging)
- [Public Key Lookup](#public-key-lookup)
- [Sleep / Pause an Address](#sleep--pause-an-address)
- [Create and Edit a List](#create-and-edit-a-list)
- [Pay Dividends](#pay-dividends)
- [Query Market Data](#query-market-data)
- [Query Transaction History](#query-transaction-history)
- [Validate Before Creating](#validate-before-creating)
- [Force Encoding Type](#force-encoding-type)
- [Error Handling](#error-handling)
- [Hub Discovery](#hub-discovery)
- [Request Logging](#request-logging)
- [Deploy a Smart Contract](#deploy-a-smart-contract)
- [Execute a Contract Method](#execute-a-contract-method)
- [Deposit Tokens into a Contract](#deposit-tokens-into-a-contract)
- [Withdraw Tokens from a Contract](#withdraw-tokens-from-a-contract)
- [Using the Contract Client](#using-the-contract-client)
- [Contract Authoring Utilities](#contract-authoring-utilities)
- [Generate a Key Pair](#generate-a-key-pair)
- [Import a WIF Key](#import-a-wif-key)
- [Derive Addresses](#derive-addresses)
- [Validate an Address](#validate-an-address)
- [Challenge-Response Wallet Verification](#challenge-response-wallet-verification)
- [Custom Message Signing](#custom-message-signing)
- [Sign and Broadcast a Transaction](#sign-and-broadcast-a-transaction)
- [Token-Gated Content Access](#token-gated-content-access)
- [Fetch UTXOs](#fetch-utxos)
- [Submit Action (Full Lifecycle)](#submit-action-full-lifecycle)
- [Wallet Session](#wallet-session)
- [Fee Estimation](#fee-estimation)
- [Issue and Distribute Workflow](#issue-and-distribute-workflow)
- [Stake and Delegate](#stake-and-delegate)
- [Cross-Chain Parallel Actions](#cross-chain-parallel-actions)
- [Interactive REPL](#interactive-repl)

---

## Setup

```js
const { XChainSDK } = require('xchain-sdk');

// Minimal — action string generation only (no network calls)
const sdk = new XChainSDK();

// With explorer (for querying blockchain data)
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    explorerPort: 8080
});

// With encoder (for generating PSBTs)
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    encoderUrl: 'encoder.xchain.io',
    encoderPort: 3000
});
```

---

## Query Balances

```js
const balances = await sdk.getBalances('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
console.log(balances);
// { total: 5, data: [{ tick: 'MYTOKEN', amount: '1000', ... }, ...] }

// With pagination
const page2 = await sdk.getBalances('bc1q...', { page: 2, limit: 50, sortorder: 'DESC' });
```

---

## Get Token Info

```js
const token = await sdk.getToken('MYTOKEN');
console.log(token.info.tick);       // 'MYTOKEN'
console.log(token.supply.current);  // '500000'
console.log(token.supply.max);      // '21000000'
console.log(token.locks.mint);      // true/false
```

---

## Send Tokens

```js
// Generate the ACTION string only (no PSBT)
const result = await sdk.send({
    tick: 'MYTOKEN',
    amount: '100',
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    memo: 'Payment for services'
});

console.log(result.actionString); // 'SEND|0|MYTOKEN|100|bc1q...|Payment for services'
console.log(result.version);     // 0
console.log(result.psbt);        // null (no encoder options provided)
```

---

## Send Tokens with PSBT

```js
// Generate ACTION string AND encode into a PSBT
const result = await sdk.send(
    {
        tick: 'MYTOKEN',
        amount: '100',
        destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    },
    {
        pubkey: 'your-public-key-or-address',
        change: 'your-change-address',
        rbf: true
    }
);

console.log(result.actionString); // 'SEND|0|MYTOKEN|100|bc1q...'
console.log(result.psbt);        // '70736274ff...' (hex-encoded PSBT)
console.log(result.encoding);    // 'OP_RETURN' (auto-selected)

// Sign the PSBT with your wallet and broadcast to the network
```

---

## Issue a New Token

```js
const result = await sdk.issue({
    tick: 'NEWTOKEN',
    maxSupply: '21000000',
    maxMint: '1000',
    decimals: 8,
    description: 'A new token on XChain',
    mintSupply: '0',
    lockMaxSupply: 1,
    lockDescription: 0
});

console.log(result.version);     // 0 (full create)
console.log(result.actionString); // 'ISSUE|0|NEWTOKEN|21000000|1000|8|A new token on XChain|0|...'
```

---

## Update Token Description

```js
// Only provide tick + description → SDK auto-selects v1 (shortest format)
const result = await sdk.issue({
    tick: 'NEWTOKEN',
    description: 'Updated description for my token'
});

console.log(result.version); // 1 (description update — much shorter than v0)
```

---

## Lock Token Properties

```js
const result = await sdk.issue({
    tick: 'NEWTOKEN',
    lockMaxSupply: 1,
    lockMint: 1,
    lockMintSupply: 0,
    lockMaxMint: 0,
    lockDescription: 1,
    lockSleep: 0,
    lockCallback: 0
});

console.log(result.version); // 3 (lock update format)
```

---

## Mint Tokens

```js
const result = await sdk.mint({
    tick: 'NEWTOKEN',
    amount: '1000',
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    memo: 'Initial mint'
});
```

---

## Destroy Tokens

```js
const result = await sdk.destroy({
    tick: 'NEWTOKEN',
    amount: '500',
    memo: 'Burning supply'
});
```

---

## Create a Dispenser

```js
const result = await sdk.dispenser({
    giveTick: 'MYTOKEN',
    giveAmount: '100',
    giveEscrow: '1000',
    getTick: 'PAYTOKEN',
    getAmount: '50',
    fiatCode: 'USD',
    fiatAmount: '10.00',
    memo: 'Token vending machine'
});
```

---

## Cancel a Dispenser

```js
// Provide only the dispenser action index → SDK selects v1 (cancel)
const result = await sdk.dispenser({
    dispenserActionIndex: 12345,
    memo: 'Closing dispenser'
});

console.log(result.version); // 1
```

---

## Place a DEX Order

```js
const result = await sdk.order({
    giveTick: 'TOKEN_A',
    giveAmount: '100',
    getTick: 'TOKEN_B',
    getAmount: '200',
    expiration: 1735689600,
    memo: 'Sell A for B'
});
```

---

## Cancel a DEX Order

```js
const result = await sdk.order({
    orderActionIndex: 99999,
    memo: 'Cancelling order'
});

console.log(result.version); // 1 (cancel format)
```

---

## Batch Multiple Actions

```js
// Fluent builder API
const result = await sdk.batch()
    .send({ tick: 'TOKEN_A', amount: '50', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
    .send({ tick: 'TOKEN_B', amount: '25', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
    .mint({ tick: 'TOKEN_C', amount: '1000', destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
    .build();

console.log(result.action);       // 'BATCH'
console.log(result.actionString);  // 'BATCH|0|SEND|0|TOKEN_A|50|bc1q...;SEND|0|TOKEN_B|25|bc1q...;MINT|0|TOKEN_C|1000|bc1q...'

// With encoder to get a PSBT
const tx = await sdk.batch()
    .send({ tick: 'A', amount: '10', destination: 'bc1q...' })
    .destroy({ tick: 'B', amount: '5' })
    .build({ pubkey: 'your-pubkey' });

console.log(tx.psbt); // PSBT hex
```

---

## Cross-Chain Swap

```js
const result = await sdk.swap({
    giveTick: 'BTC_TOKEN',
    giveAmount: '100',
    getTick: 'LTC_TOKEN',
    getAmount: '500',
    expiration: 1735689600,
    memo: 'Cross-chain swap'
});
```

---

## Sweep All Balances

```js
const result = await sdk.sweep({
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    balances: 1,
    ownerships: 1,
    escrows: 0,
    memo: 'Moving everything to new address'
});
```

---

## Broadcast a Message

```js
const result = await sdk.broadcast({
    message: 'Hello XChain!',
    value: '42'
});
```

---

## Send a Plaintext Message

```js
// Low-level: generate the action string only
const result = await sdk.message({
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    coin: 'BTC',
    plaintextMessage: 'Hello, this is a direct message'
});

console.log(result.version); // 3 (plaintext format)

// High-level: create, sign, and broadcast in one call
const sent = await sdk.sendMessage({
    wif: senderWIF,
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    coin: 'BTC',
    message: 'This is a public message visible to everyone!',
    method: null,  // null = plaintext
    encoder: { pubkey: senderPubkeyHex }
});
console.log('Sent:', sent.txid);
```

---

## Send an Encrypted Message (ECIES)

ECIES is the default encryption method. It encrypts directly to the recipient's public key — no prior key exchange needed, and messages can be decrypted on any device that holds the recipient's private key.

```js
const result = await sdk.sendMessage({
    wif: senderWIF,
    destination: 'bc1qrecipient...',
    coin: 'BTC',
    message: 'Hello, this is a private ECIES message!',
    // method: 1 is the default, no need to specify
    encoder: { pubkey: senderPubkeyHex }
});

console.log('Sent encrypted message:', result.txid);
console.log('Action string:', result.actionString);
```

---

## Read and Decrypt Messages

Fetch messages for an address. Pass your WIF to auto-decrypt ECIES messages addressed to you.

```js
const messages = await sdk.getMessagesForAddress('bc1qmyaddress...', {
    wif: myWIF,           // Needed to decrypt ECIES messages
    type: 'received',     // 'sent', 'received', or 'all'
    limit: 10
});

for (const msg of messages) {
    console.log(`From: ${msg.from}`);
    console.log(`  Text: ${msg.text}`);
    console.log(`  Encrypted: ${msg.encrypted}`);
    console.log(`  Method: ${msg.method}`);
    console.log(`  Block: ${msg.block}`);
}
```

---

## ECIES Encrypt/Decrypt Without Sending

Use the low-level ECIES methods directly for encryption without creating an on-chain transaction.

```js
// Look up recipient's public key
const recipientPubkey = await sdk.getPublicKey('bc1qrecipient...');

// Encrypt
const encrypted = sdk.messaging.eciesEncrypt('Secret message content', recipientPubkey);
console.log('Ciphertext:', encrypted.ciphertext);

// Decrypt (recipient side)
const decrypted = sdk.messaging.eciesDecrypt(encrypted.ciphertext, recipientWIF);
console.log('Decrypted:', decrypted.plaintext);
```

---

## ECDH Session Messaging

ECDH requires both parties to exchange public keys via format 0/1 messages before sending encrypted messages.

```js
// Step 1: Sender generates their session key
const senderSession = sdk.messaging.generateSessionKey(senderWIF);

// Step 2: Send format 0 key exchange request (on-chain)
const keyExchange = await sdk.message({
    destination: 'bc1qrecipient...',
    coin: 'BTC',
    encryptionMethod: 2,
    encryptionKey: senderSession.publicKey
}, { pubkey: senderPubkeyHex });
// Sign and broadcast keyExchange.psbt...

// Step 3: Recipient responds with format 1 containing their pubkey
const recipientSession = sdk.messaging.generateSessionKey(recipientWIF);
const keyResponse = await sdk.message({
    destination: senderAddress,
    coin: 'BTC',
    encryptionMethod: 2,
    encryptionKey: recipientSession.publicKey
}, { pubkey: recipientPubkeyHex });
// Sign and broadcast keyResponse.psbt...

// Step 4: Both sides derive the same shared secret
const senderSecret = sdk.messaging.deriveSharedSecret(senderWIF, recipientSession.publicKey);
const recipientSecret = sdk.messaging.deriveSharedSecret(recipientWIF, senderSession.publicKey);
console.log('Secrets match:', senderSecret.sharedSecret === recipientSecret.sharedSecret);

// Step 5: Encrypt/decrypt with the shared secret
const encrypted = sdk.messaging.sessionEncrypt('ECDH session message', senderSecret.sharedSecret);
const decrypted = sdk.messaging.sessionDecrypt(encrypted.ciphertext, recipientSecret.sharedSecret);
console.log('Decrypted:', decrypted.plaintext);

// Or use the high-level send with a pre-derived shared secret
const result = await sdk.sendMessage({
    wif: senderWIF,
    destination: 'bc1qrecipient...',
    coin: 'BTC',
    message: 'Encrypted with ECDH session key',
    method: 2,
    sharedSecret: senderSecret.sharedSecret,
    encoder: { pubkey: senderPubkeyHex }
});
```

---

## AES Pre-Shared Key Messaging

AES uses a pre-shared key that both parties know, exchanged out-of-band.

```js
const sharedKey = 'my-secret-passphrase-shared-between-parties';

// Send an AES-encrypted message
const result = await sdk.sendMessage({
    wif: senderWIF,
    destination: 'bc1qrecipient...',
    coin: 'BTC',
    message: 'This message is encrypted with a shared passphrase',
    method: 3,
    sharedKey: sharedKey,
    encoder: { pubkey: senderPubkeyHex }
});

console.log('Sent AES message:', result.txid);

// Decrypt manually (getMessagesForAddress can't auto-decrypt AES)
const encrypted = sdk.messaging.aesEncrypt('Test AES message', sharedKey);
const decrypted = sdk.messaging.aesDecrypt(encrypted.ciphertext, sharedKey);
console.log('AES roundtrip:', decrypted.plaintext);
```

---

## Public Key Lookup

Look up the public key for any address that has sent at least one XChain transaction.

```js
const pubkey = await sdk.getPublicKey('bc1qsomeaddress...');
if (pubkey) {
    console.log('Public key:', pubkey);  // '02a1b2c3...'
} else {
    console.log('No public key found');
    console.log('(Address may not have sent any XChain transactions yet)');
}
```

---

## Sleep / Pause an Address

```js
// Pause all actions from this address until block 800000
const result = await sdk.sleep({ resumeBlock: 800000 });

// Pause a specific token until block 800000
const result2 = await sdk.sleep({
    resumeBlock: 800000,
    tick: 'MYTOKEN'
});

console.log(result.version);  // 0 (address sleep)
console.log(result2.version); // 1 (tick sleep)
```

---

## Create and Edit a List

```js
// Create a TICK list
const create = await sdk.list({ type: 1, item: 'TOKEN_A,TOKEN_B,TOKEN_C' });

// Edit an existing list — add an item
const edit = await sdk.list({
    edit: 1,               // 1 = ADD
    listActionIndex: 12345,
    item: 'TOKEN_D'
});

console.log(create.version); // 0 (create)
console.log(edit.version);   // 1 (edit)
```

---

## Pay Dividends

```js
const result = await sdk.dividend({
    tick: 'MYTOKEN',
    dividendTick: 'PAYTOKEN',
    amount: '1',
    memo: 'Q1 dividend payout'
});
```

---

## Query Market Data

```js
// Get all markets
const markets = await sdk.getMarkets();

// Get markets for a specific token
const tokenMarkets = await sdk.getMarkets('MYTOKEN');

// Get a specific trading pair
const pair = await sdk.getMarket('TOKEN_A', 'TOKEN_B');

// Get the order book
const orderbook = await sdk.getOrderbook('TOKEN_A', 'TOKEN_B');

// Get trade history
const history = await sdk.getMarketHistory('TOKEN_A', 'TOKEN_B', null, {
    page: 1,
    limit: 50,
    sortorder: 'DESC'
});
```

---

## Query Transaction History

```js
// Get history for an address
const history = await sdk.getHistory('bc1q...', 'address', { limit: 20 });

// Get a specific transaction
const tx = await sdk.getTransaction('abc123...', 'tx_hash');

// Get a specific action by index
const action = await sdk.getAction(12345);

// Get sends for an address
const sends = await sdk.getSends('bc1q...', 'address', { sortorder: 'DESC' });

// Get all mints for a token
const mints = await sdk.getMints('MYTOKEN', 'token', { limit: 100 });
```

---

## Validate Before Creating

```js
// Dry-run validation — no action string generated, no errors thrown
const result = sdk.validateAction('send', {
    tick: 'MYTOKEN',
    amount: '100',
    destination: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
});

if (result.valid) {
    console.log('Input is valid, safe to create');
} else {
    console.log('Validation errors:', result.errors);
    // [{ code: 'MISSING_REQUIRED_FIELD', message: '...', details: {...} }]
}
```

---

## Force Encoding Type

```js
// Force P2SH encoding (even if data fits in OP_RETURN)
const result = await sdk.send(
    { tick: 'TOKEN', amount: '100', destination: 'bc1q...' },
    { pubkey: 'your-pubkey', encoding: 'P2SH' }
);
console.log(result.encoding); // 'P2SH'

// OP_RETURN — will throw if action string > 76 bytes (user-data limit; 80 bytes total per output)
try {
    await sdk.issue(
        { tick: 'TOKEN', maxSupply: '21000000', maxMint: '1000', decimals: 8, description: 'A long description...' },
        { pubkey: 'your-pubkey', encoding: 'OP_RETURN' }
    );
} catch (e) {
    console.log(e.code);             // 'ENCODING_DATA_TOO_LARGE'
    console.log(e.details.suggestion); // 'P2SH'
}
```

---

## Error Handling

```js
const { XChainSDK, SDKValidationError, SDKEncoderError, SDKExplorerError } = require('xchain-sdk');

try {
    await sdk.send({ tick: 'BAD|TOKEN', amount: '100', destination: 'bc1q...' });
} catch (e) {
    if (e instanceof SDKValidationError) {
        console.log('Validation error:', e.code);    // 'FORBIDDEN_CHARACTER'
        console.log('Details:', e.details);           // { action: 'SEND', errors: [...] }
    } else if (e instanceof SDKEncoderError) {
        console.log('Encoder error:', e.code);        // 'ENCODER_RPC_ERROR'
    } else if (e instanceof SDKExplorerError) {
        console.log('Explorer error:', e.code);       // 'EXPLORER_HTTP_404'
    }
}
```

---

## Hub Discovery

```js
const sdk = new XChainSDK({
    network: 'bitcoin-regtest',
    hubUrl: 'hub.xchain.io',
    hubPort: 8001
});

// Fetch config from hub — resolves explorer + encoder endpoints automatically
await sdk.init();

// Now explorer and encoder are configured
const balances = await sdk.getBalances('bc1q...');
const tx = await sdk.send(
    { tick: 'TOKEN', amount: '100', destination: 'bc1q...' },
    { pubkey: 'your-pubkey' }
);
```

---

## Request Logging

```js
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io',
    encoderUrl: 'encoder.xchain.io',
    hooks: {
        onRequest: (info) => {
            console.log(`[${info.service}] → ${info.method} ${info.url || ''}`);
        },
        onResponse: (info) => {
            console.log(`[${info.service}] ← ${info.status || 'OK'}`);
        },
        onError: (info) => {
            console.error(`[${info.service}] ERROR: ${info.error}`);
        },
        onRetry: (info) => {
            console.warn(`[${info.service}] Retry #${info.attempt} in ${info.delay}ms: ${info.error}`);
        }
    }
});
```

---

## Real-Time: Listen for New Blocks

```js
await sdk.connectWs();

const unsub = sdk.onBlock((event) => {
    console.log('Block', event.data.block_index, '—', event.data.action_count, 'actions');
});

// Later: stop listening
unsub();
```

---

## Real-Time: Watch an Address

```js
await sdk.connectWs();

sdk.onAddress('1abc...', (event) => {
    if (event.type === 'ADDRESS_UPDATE') {
        console.log('Balances:', event.data.balances);
    } else {
        console.log(event.type, ':', event.data.action_index);
    }
}, { snapshot: true });
```

---

## Real-Time: COINPay Auto-Responder

```js
await sdk.connectWs();

sdk.onCoinpayRequired('1BotAddr...', async (event) => {
    const { payee_address, coin_amount, expiration } = event.data;
    console.log('COINPay needed:', coin_amount, 'BTC to', payee_address);
    console.log('Deadline:', new Date(expiration * 1000));

    // Construct and broadcast a COINPAY transaction
    const result = await sdk.coinpay({
        order_match_action_index: event.data.order_match_action_index
    }, { pubkey: 'your-pubkey' });
    console.log('COINPay broadcast:', result.psbt);
});
```

---

## Real-Time: Multi-Address Portfolio Tracker

```js
await sdk.connectWs();

const addresses = ['1wallet-a...', '1wallet-b...', '1wallet-c...'];

// Subscribe to all addresses in one batch
sdk.ws.subscribe(['address'], {
    addresses: addresses,
    types: ['SEND', 'AIRDROP', 'DIVIDEND'],
    snapshot: true
});

sdk.ws.on('ADDRESS_UPDATE', (msg) => {
    console.log(msg.data.address, '→', msg.data.balances);
});

sdk.ws.on('SNAPSHOT', (msg) => {
    console.log('Initial state for', msg.data.address, ':', msg.data.balances);
});
```

---

## Deploy a Smart Contract

```js
// Read contract source code
const contractSource = `
module.exports = {
    greet: function(xchain) {
        let name = xchain.getInputParam(0) || 'world';
        return 'Hello, ' + name + '!';
    }
};
`;

// Validate the contract source before deploying
let check = sdk.contracts.validate(contractSource);
if (!check.valid) {
    console.error('Contract validation failed:', check.error);
} else {
    // Deploy (auto hex-encodes the source code)
    let result = await sdk.deploy({
        code: contractSource,
        gasLimit: 200000
    }, { pubkey: 'yourPubkey', encoding: 'P2WSH' });

    console.log(result.actionString);  // DEPLOY|0|<hex>|200000
    console.log(result.psbt);          // PSBT for signing
}
```

---

## Execute a Contract Method

```js
// Call a method on a deployed contract
let result = await sdk.execute({
    contractActionIndex: 12345,
    method: 'greet',
    params: ['Alice']
}, { pubkey: 'yourPubkey' });

console.log(result.actionString);  // EXECUTE|0|12345|greet|Alice

// After the transaction confirms, check execution results via explorer
let exec = await sdk.getExecution(actionIndex);
if (exec.success) {
    console.log('Return value:', exec.returnValue);
} else {
    console.log('Execution failed:', exec.error);
}
```

---

## Deposit Tokens into a Contract

```js
// Fund a contract with tokens
let result = await sdk.deposit({
    contractActionIndex: 12345,
    tick: 'MYTOKEN',
    quantity: '1000'
}, { pubkey: 'yourPubkey' });

console.log(result.actionString);  // DEPOSIT|0|12345|MYTOKEN|1000
```

---

## Withdraw Tokens from a Contract

```js
// Withdraw tokens (must be contract owner)
let result = await sdk.withdraw({
    contractActionIndex: 12345,
    tick: 'MYTOKEN',
    quantity: '500'
}, { pubkey: 'yourPubkey' });

console.log(result.actionString);  // WITHDRAW|0|12345|MYTOKEN|500
```

---

## Using the Contract Client

```js
// Create a bound client for repeated interactions with a contract
const amm = sdk.contract(12345);

// Execute a method
await amm.call('swap', ['TOKENA', '100'], { pubkey: 'yourPubkey' });

// Deposit tokens
await amm.deposit('TOKENA', '500', { pubkey: 'yourPubkey' });

// Withdraw tokens
await amm.withdraw('TOKENA', '250', { pubkey: 'yourPubkey' });

// Query contract data from the explorer
let info = await amm.getInfo();           // contract metadata
let state = await amm.getState();          // all state key-value pairs
let state_key = await amm.getState('reserveA');  // specific state key
let balance = await amm.getBalance('TOKENA');     // contract token balance
let history = await amm.getExecutions();   // execution history
```

---

## Contract Authoring Utilities

```js
// Hex encode/decode
let hex = sdk.contracts.encode('module.exports = {}');
let source = sdk.contracts.decode(hex);

// Check code size
let sizeCheck = sdk.contracts.checkCodeSize(contractSource);
console.log(sizeCheck.bytes + ' / ' + sizeCheck.limit + ' bytes');
console.log('Within limit:', sizeCheck.withinLimit);

// Syntax validation (requires acorn)
let validation = sdk.contracts.validate(contractSource);
if (!validation.valid) {
    console.log('Error:', validation.error);
}
if (validation.warnings) {
    for (let w of validation.warnings) console.log('Warning:', w);
}

// Float usage detection
let floatWarnings = sdk.contracts.checkFloatUsage(contractSource);
for (let w of floatWarnings) console.log(w);

// Gas limit suggestion (heuristic)
let gas = sdk.contracts.suggestGasLimit(contractSource);
console.log('Suggested gas:', gas.suggested, '(' + gas.rationale + ')');
```

---

## Generate a Key Pair

```js
const sdk = new XChainSDK({ network: 'bitcoin-mainnet' });

const kp = sdk.generateKeyPair();
console.log('WIF:', kp.wif);
console.log('Public key:', kp.publicKeyHex);
console.log('Compressed:', kp.compressed); // true

// Uncompressed key pair
const kpUncompressed = sdk.generateKeyPair({ compressed: false });
console.log('Uncompressed public key length:', kpUncompressed.publicKey.length); // 65
```

---

## Import a WIF Key

```js
const sdk = new XChainSDK({ network: 'bitcoin-mainnet' });

const kp = sdk.importWIF('L1aW4aubDFB7yfras...'); // your WIF key
console.log('Public key:', kp.publicKeyHex);
console.log('Address:', sdk.deriveAddress(kp.publicKey));
```

---

## Derive Addresses

```js
const sdk = new XChainSDK({ network: 'bitcoin-mainnet' });
const kp = sdk.generateKeyPair();

// Legacy (P2PKH)
const legacy = sdk.deriveAddress(kp.publicKey);
console.log('P2PKH:', legacy); // 1...

// Native SegWit (bech32)
const segwit = sdk.deriveAddress(kp.publicKey, { type: 'p2wpkh' });
console.log('P2WPKH:', segwit); // bc1q...

// Wrapped SegWit (P2SH-P2WPKH)
const wrapped = sdk.deriveAddress(kp.publicKey, { type: 'p2sh-p2wpkh' });
console.log('P2SH-P2WPKH:', wrapped); // 3...

// Works with hex string too
const sameAddress = sdk.deriveAddress(kp.publicKeyHex);
console.log(legacy === sameAddress); // true
```

---

## Validate an Address

```js
const sdk = new XChainSDK({ network: 'bitcoin-mainnet' });

// Check against configured network
let result = sdk.validateAddress('bc1qexample...');
console.log(result.valid);   // true
console.log(result.type);    // 'p2wpkh'
console.log(result.network); // 'bitcoin-mainnet'

// Check against a specific network
result = sdk.validateAddress('ltc1q...', 'litecoin-mainnet');
console.log(result.valid);   // true

// Invalid address — returns { valid: false }, never throws
result = sdk.validateAddress('not-an-address');
console.log(result.valid);   // false
console.log(result.error);   // 'Address does not match any supported network.'

// No network configured — checks all 9 networks
const noNetSdk = new XChainSDK();
result = noNetSdk.validateAddress('bc1qexample...');
console.log(result.network); // 'bitcoin-mainnet' (auto-detected)
```

---

## Challenge-Response Wallet Verification

Full server + client flow for proving a user owns a wallet address.

```js
const XChainSDK = require('xchain-sdk');

// --- Server side ---

const serverSdk = new XChainSDK({ network: 'bitcoin-mainnet' });

// Step 1: Generate a challenge for the user to sign
const challenge = serverSdk.generateChallenge('bc1quseraddress...', {
    appId: 'MyMusicApp'
});
// Store challenge.nonce in your session/database
// Send challenge.challenge to the client

console.log(challenge.challenge);
// "XChain wallet verification\nApp: MyMusicApp\nAddress: bc1quseraddress...\nNonce: a1b2c3...\nTimestamp: 2026-04-07T..."

console.log(challenge.expiresAt);
// "2026-04-07T17:50:00.000Z" (5 minutes from now)


// --- Client side (wallet app) ---

const clientSdk = new XChainSDK({ network: 'bitcoin-mainnet' });

// Step 2: User signs the challenge with their wallet
const signed = clientSdk.signMessage(challenge.challenge, userWIF);
// Send signed.signature back to the server


// --- Server side ---

// Step 3: Verify the signature
const result = serverSdk.verifyOwnership(
    'bc1quseraddress...',
    challenge.challenge,
    signed.signature
);

if (result.valid) {
    console.log('Wallet ownership verified for', result.address);
    // Grant access, issue session token, etc.
} else {
    console.log('Verification failed:', result.error);
}
```

---

## Custom Message Signing

Sites can generate their own messages instead of using the SDK's default format. This lets the server verify using any tool — the SDK, `bitcoinjs-message`, or the coin node's `verifymessage` RPC.

```js
const sdk = new XChainSDK({ network: 'bitcoin-mainnet' });

// Site generates its own message (no SDK needed for this part)
const myMessage = `Welcome to MyCoolSite!\nPlease sign to verify wallet ownership.\nNonce: ${crypto.randomUUID()}`;

// Pass it through generateChallenge for consistent metadata tracking
const challenge = sdk.generateChallenge('bc1quseraddr...', { message: myMessage });
// challenge.challenge === myMessage (unchanged)
// challenge.nonce, challenge.timestamp still returned for bookkeeping

// Client signs it
const signed = sdk.signMessage(myMessage, wif);

// Server verifies — using SDK
const result = sdk.verifyOwnership('bc1quseraddr...', myMessage, signed.signature);

// OR verify without the SDK at all:
const bitcoinMessage = require('bitcoinjs-message');
const valid = bitcoinMessage.verify(myMessage, 'bc1quseraddr...', signed.signature);
```

---

## Sign and Broadcast a Transaction

Complete workflow: create an action, encode it as a PSBT, sign it, and broadcast.

```js
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    encoderUrl: 'encoder.example.com',
    encoderPort: 3000
});

const kp = sdk.importWIF(process.env.WALLET_WIF);
const address = sdk.deriveAddress(kp.publicKey, { type: 'p2wpkh' });

// 1. Create and encode the action
const action = await sdk.send(
    { tick: 'MYTOKEN', amount: '50', destination: 'bc1qrecipient...' },
    { pubkey: kp.publicKeyHex }
);

console.log('Action:', action.actionString);
console.log('Unsigned PSBT:', action.psbt);

// 2. Sign the PSBT
const signed = sdk.signPsbt(action.psbt, kp.wif);
console.log('Transaction ID:', signed.txid);

// 3. Broadcast
const broadcast = await sdk.broadcastTx(signed.txHex);
console.log('Broadcast confirmed:', broadcast.txid);
```

---

## Token-Gated Content Access

Check if a user holds a token before granting access. Combines wallet verification with balance checks.

```js
const express = require('express');
const { XChainSDK } = require('xchain-sdk');
const { bignumber, largerEq } = require('mathjs');

const app = express();
app.use(express.json());

const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.example.com'
});

// Step 1: Issue a challenge
app.post('/auth/challenge', (req, res) => {
    const { address } = req.body;
    const challenge = sdk.generateChallenge(address, { appId: 'StreamApp' });
    // Store challenge.nonce → address mapping (Redis, DB, etc.)
    res.json({ message: challenge.challenge, nonce: challenge.nonce });
});

// Step 2: Verify signature + check token balance
app.post('/auth/verify', async (req, res) => {
    const { address, signature, nonce } = req.body;

    // Look up the stored challenge by nonce (your storage layer)
    const storedChallenge = await getStoredChallenge(nonce);
    if (!storedChallenge) return res.status(400).json({ error: 'Invalid or expired challenge' });

    // Verify wallet ownership
    const result = sdk.verifyOwnership(address, storedChallenge, signature);
    if (!result.valid) return res.status(401).json({ error: result.error });

    // Check token balance
    const balances = await sdk.getBalances(address);
    const entry = balances.find(b => b.tick === 'ALBUMTOKEN');
    if (!entry || !largerEq(bignumber(entry.amount), bignumber('1'))) {
        return res.status(403).json({ error: 'Must hold at least 1 ALBUMTOKEN' });
    }

    // Issue session token (your session layer)
    const sessionToken = createSession(address);
    res.json({ sessionToken });
});

// Step 3: Protected route
app.get('/stream/:trackId', requireSession, (req, res) => {
    res.json({ streamUrl: getSignedUrl(req.params.trackId) });
});
```

---

## Fetch UTXOs

```js
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    encoderUrl: 'encoder.example.com'
});

const utxos = await sdk.getUTXOs('bc1qmyaddress...');
console.log(`Found ${utxos.length} UTXOs`);

for (const utxo of utxos) {
    console.log(`  ${utxo.txid}:${utxo.vout} — ${utxo.value} sats`);
}

// Use UTXOs when creating a transaction
const action = await sdk.send(
    { tick: 'MYTOKEN', amount: '10', destination: 'bc1qrecipient...' },
    { pubkey: publicKeyHex, utxos: utxos }
);
```

---

## Submit Action (Full Lifecycle)

Submit an action through the complete pipeline — create, encode, sign, broadcast, and wait for the indexer — in one call:

```js
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.example.com',
    encoderUrl: 'encoder.example.com'
});

const result = await sdk.submitAction(
    { action: 'SEND', params: { tick: 'MYTOKEN', amount: '100', destination: 'bc1qrecipient...' } },
    { pubkey: '02abc123...' },
    {
        wif: 'your-wif-key',
        onProgress: (step, data) => console.log(`Step: ${step}`)
    }
);

console.log(result.txid);         // transaction hash
console.log(result.encoding);     // 'OP_RETURN', 'P2SH', etc.
console.log(result.indexed);      // action data from the indexer
console.log(result.spentInputs);  // UTXOs consumed by this transaction
```

## Wallet Session

Create a session bound to a single key and send multiple transactions:

```js
const session = sdk.session('your-wif-key');

console.log(`Address: ${session.address}`);
console.log(`Public key: ${session.pubkey}`);

// Send multiple transactions back-to-back (UTXO chaining prevents double-spend)
await session.send({ tick: 'TOKEN', amount: '10', destination: 'bc1qaddr1...' });
await session.send({ tick: 'TOKEN', amount: '20', destination: 'bc1qaddr2...' });
await session.send({ tick: 'TOKEN', amount: '30', destination: 'bc1qaddr3...' });

// Query balances scoped to the session address
const balances = await session.getBalances();
console.log(balances);
```

## Fee Estimation

Estimate fees before committing to a transaction:

```js
const estimate = await sdk.estimateFees(
    { action: 'SEND', params: { tick: 'TOKEN', amount: '100', destination: 'bc1q...' } },
    { pubkey: '02abc123...' }
);

console.log(`Fee: ${estimate.fee} satoshis`);
console.log(`Encoding: ${estimate.encoding}`);
console.log(`Input total: ${estimate.inputTotal}`);
console.log(`Output total: ${estimate.outputTotal}`);

// The returned PSBT can be signed directly to skip re-encoding
if (estimate.fee < 5000) {
    const signed = sdk.signPsbt(estimate.psbt, wif);
    await sdk.broadcastTx(signed.txHex);
}
```

## Issue and Distribute Workflow

Issue a token and send it to multiple recipients in one call:

```js
const result = await sdk.issueAndDistribute(
    'your-wif-key',
    { tick: 'NEWTOKEN', maxSupply: '1000000', decimals: 8 },
    [
        { destination: 'bc1qaddr1...', amount: '500000' },
        { destination: 'bc1qaddr2...', amount: '300000' },
        { destination: 'bc1qaddr3...', amount: '200000' }
    ]
);

console.log(`Token issued: ${result.issue.txid}`);
for (const send of result.sends) {
    console.log(`Sent: ${send.txid}`);
}
```

## Stake and Delegate

Stake XCHAIN tokens and delegate a signing key (capability staking; BTC chain only):

```js
const result = await sdk.stakeAndDelegate(
    'your-wif-key',
    {
        version: 1,                   // 1 = new stake, 2 = top up an existing pubkey
        amount: '1000',               // XCHAIN staked — capabilities are auto-qualified from the aggregate amount
        signingPubkey: 'aabbccdd...'  // 64 hex characters (Ed25519 public key)
    },
    {
        newSigningPubkey: 'eeff0011...'  // optional — omit to skip delegation
    }
);

console.log(`Staked: ${result.stake.txid}`);
console.log(`Delegated: ${result.delegate.txid}`);

// Later: collect rewards
const session = sdk.session('your-wif-key');
await session.collect({});

// Later: unstake
await session.unstake({ signingPubkey: 'aabbccdd...' });  // releases the pubkey's full aggregate stake
```

## Cross-Chain Parallel Actions

Execute actions on multiple chains simultaneously:

```js
const { XChainSDK, CrossChainHelper } = require('xchain-sdk');

const btcSdk = new XChainSDK({ network: 'bitcoin-mainnet', explorerUrl: '...', encoderUrl: '...' });
const ltcSdk = new XChainSDK({ network: 'litecoin-mainnet', explorerUrl: '...', encoderUrl: '...' });

const bridge = new CrossChainHelper({ BTC: btcSdk, LTC: ltcSdk });

// Send tokens on both chains at the same time
const results = await bridge.parallel([
    {
        chain: 'BTC',
        wif: btcWIF,
        actionData: { action: 'SEND', params: { tick: 'BTCTOKEN', amount: '50', destination: btcAddr } }
    },
    {
        chain: 'LTC',
        wif: ltcWIF,
        actionData: { action: 'SEND', params: { tick: 'LTCTOKEN', amount: '100', destination: ltcAddr } }
    }
]);

console.log(`BTC tx: ${results[0].txid}`);
console.log(`LTC tx: ${results[1].txid}`);

// Get balances across all chains
const allBalances = await bridge.getAllBalances('bc1qmyaddress...');
```

## Interactive REPL

Start an interactive session for exploration and prototyping:

```bash
npm run repl
```

```
  XChain SDK REPL
  Network: bitcoin-regtest

  Available in scope:
    sdk            - XChainSDK instance
    session(wif)   - Create a WalletSession
    keygen()       - Generate a new keypair

  Commands:
    .actions       - List all action types
    .status        - Show SDK configuration
    .fields ACTION - Show fields for an action

xchain> const keys = keygen()
xchain> keys.wif
'cNjFk...'
xchain> const s = session(keys.wif)
xchain> s.address
'mwCwTc...'
xchain> .fields SEND
  v0: VERSION|TICK|AMOUNT|DESTINATION|MEMO
  v1: VERSION|TICK|AMOUNT|DESTINATION|AMOUNT|DESTINATION|MEMO
  v2: VERSION|TICK|AMOUNT|DESTINATION|TICK|AMOUNT|DESTINATION|MEMO
  v3: VERSION|TICK|AMOUNT|DESTINATION|MEMO|TICK|AMOUNT|DESTINATION|MEMO
```

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
