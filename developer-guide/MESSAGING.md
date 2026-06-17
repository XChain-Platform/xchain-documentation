# Messaging Guide

This guide covers sending and receiving encrypted and plaintext messages between addresses using the XChain SDK's messaging module.

## Overview

The MESSAGE action supports three encryption methods:

| Method | Name | Use Case |
|--------|------|----------|
| 1 | ECIES (default) | Address communication: encrypt to recipient's public key, no key exchange needed, works across devices |
| 2 | ECDH | Session communication: two-party key exchange for forward secrecy, device-bound |
| 3 | AES | Shared secret communication: pre-shared key encryption, key exchanged out-of-band |

## Prerequisites

- Running xchain-explorer, xchain-encoder, and a coin node
- A funded address with UTXOs for sending transactions

## Setup

```javascript
const XChainSDK = require('xchain-sdk');

const sdk = new XChainSDK({
    network:     'bitcoin-regtest',
    explorerUrl: 'localhost',
    explorerPort: 8080,
    encoderUrl:  'localhost',
    encoderPort: 3001
});
```

## Sending an Encrypted Message (ECIES)

ECIES is the default and recommended encryption method. It encrypts directly to the recipient's public key. No prior key exchange is needed, and messages can be decrypted on any device that holds the recipient's private key.

```javascript
let result = await sdk.sendMessage({
    wif: senderWIF,
    destination: '1RecipientAddress...',
    coin: 'BTC',
    message: 'Hello, this is a private message!',
    encoder: { pubkey: senderPubkeyHex }
});

console.log('Sent encrypted message, txid:', result.txid);
```

Under the hood, the SDK:
1. Looks up the recipient's public key via the explorer API
2. Generates an ephemeral keypair
3. Derives a shared secret via ECDH with the recipient's public key
4. Encrypts the message with AES-256-GCM
5. Creates a MESSAGE action, encodes it into a PSBT, signs, and broadcasts

## Sending a Plaintext Message

Plaintext messages are visible to everyone on-chain. Pass `method: null` to skip encryption.

```javascript
let result = await sdk.sendMessage({
    wif: senderWIF,
    destination: '1RecipientAddress...',
    coin: 'BTC',
    message: 'This is a public message visible to everyone!',
    method: null,
    encoder: { pubkey: senderPubkeyHex }
});
```

## Reading and Decrypting Messages

Fetch messages for an address. Pass your WIF to auto-decrypt ECIES messages addressed to you.

```javascript
let messages = await sdk.getMessagesForAddress('1MyAddress...', {
    wif: myWIF,           // Needed to decrypt ECIES messages
    type: 'received',     // 'sent', 'received', or 'all'
    limit: 10
});

for (let msg of messages) {
    console.log(`From: ${msg.from}`);
    console.log(`  Text: ${msg.text}`);
    console.log(`  Encrypted: ${msg.encrypted}`);
    console.log(`  Method: ${msg.method}`);
    console.log(`  Block: ${msg.block}`);
}
```

Each message object contains:
- `from`: sender address
- `to`: recipient address
- `text`: decrypted message text (or `null` if decryption failed or no WIF provided)
- `encrypted`: `true` if the message was encrypted
- `method`: encryption method used (1, 2, 3, or `null` for plaintext)
- `txid`: transaction hash
- `block`: block height
- `timestamp`: block timestamp

## Low-Level ECIES Encrypt/Decrypt

Use the messaging module directly for encryption without creating an on-chain transaction.

```javascript
// Look up a public key
let recipientPubkey = await sdk.getPublicKey('1RecipientAddress...');

// Encrypt
let encrypted = sdk.messaging.eciesEncrypt('Secret message', recipientPubkey);
console.log('Ciphertext:', encrypted.ciphertext);

// Decrypt (recipient side)
let decrypted = sdk.messaging.eciesDecrypt(encrypted.ciphertext, recipientWIF);
console.log('Decrypted:', decrypted.plaintext);
```

## ECDH Session-Based Messaging (Method 2)

ECDH requires a key exchange handshake before sending messages. Both parties exchange public keys via format 0/1 MESSAGE actions, then derive a shared secret for the session.

> **Note:** ECDH sessions are device-bound. The shared secret only exists on the devices that performed the key exchange. Use ECIES (method 1) if you need multi-device support.

```javascript
// Step 1: Sender generates their session key
let senderSession = sdk.messaging.generateSessionKey(senderWIF);

// Step 2: Send format 0 key exchange request (on-chain)
let keyExchange = await sdk.message({
    destination: '1RecipientAddress...',
    coin: 'BTC',
    encryptionMethod: 2,
    encryptionKey: senderSession.publicKey
}, { pubkey: senderPubkeyHex });
// Sign and broadcast keyExchange.psbt...

// Step 3: Recipient responds with format 1 containing their pubkey
let recipientSession = sdk.messaging.generateSessionKey(recipientWIF);
let keyResponse = await sdk.message({
    destination: senderAddress,
    coin: 'BTC',
    encryptionMethod: 2,
    encryptionKey: recipientSession.publicKey
}, { pubkey: recipientPubkeyHex });
// Sign and broadcast keyResponse.psbt...

// Step 4: Both sides derive the same shared secret
let senderSecret = sdk.messaging.deriveSharedSecret(senderWIF, recipientSession.publicKey);
let recipientSecret = sdk.messaging.deriveSharedSecret(recipientWIF, senderSession.publicKey);
// senderSecret.sharedSecret === recipientSecret.sharedSecret

// Step 5: Encrypt/decrypt with the shared secret
let encrypted = sdk.messaging.sessionEncrypt('Session message', senderSecret.sharedSecret);
let decrypted = sdk.messaging.sessionDecrypt(encrypted.ciphertext, recipientSecret.sharedSecret);
```

## AES Pre-Shared Key Messaging (Method 3)

AES uses a pre-shared key that both parties know. The key must be exchanged out-of-band (not on-chain).

```javascript
let sharedKey = 'my-secret-passphrase-shared-between-parties';

// Send
let result = await sdk.sendMessage({
    wif: senderWIF,
    destination: '1RecipientAddress...',
    coin: 'BTC',
    message: 'Encrypted with a shared passphrase',
    method: 3,
    sharedKey: sharedKey,
    encoder: { pubkey: senderPubkeyHex }
});

// Decrypt manually: getMessagesForAddress can't auto-decrypt AES, so the app must supply the key
let encrypted = sdk.messaging.aesEncrypt('Test message', sharedKey);
let decrypted = sdk.messaging.aesDecrypt(encrypted.ciphertext, sharedKey);
```

## Public Key Lookup

Look up the public key for any address that has sent at least one XChain transaction.

```javascript
let pubkey = await sdk.getPublicKey('1SomeAddress...');
if (pubkey) {
    console.log('Public key:', pubkey);
} else {
    console.log('No public key found (address may not have sent any XChain transactions)');
}
```

## Choosing an Encryption Method

| Consideration | ECIES (1) | ECDH (2) | AES (3) |
|---------------|-----------|----------|---------|
| Key exchange needed? | No | Yes (format 0/1) | Out-of-band |
| Multi-device support | Yes | No (device-bound) | Yes (if key is shared) |
| Forward secrecy | Per-message (ephemeral keys) | Per-session | No |
| Best for | General messaging | Long-running sessions | Password-protected messages |
