<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform SDK: Messaging Reference

This document covers the SDK's messaging module: ECIES, ECDH, and AES encryption for MESSAGE actions, public key lookup, and high-level send/receive with automatic encryption and decryption.

---

## Overview

The SDK provides a messaging module for encrypted and plaintext communication between addresses:

- **`sdk.messaging`** (`MessagingUtils`); ECIES/ECDH/AES encryption, public key resolution, high-level send and receive.

Available on the SDK instance and as top-level convenience methods:

```js
const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'localhost',
    encoderUrl: 'localhost'
});

// Namespaced access
sdk.messaging.eciesEncrypt('Hello', recipientPubkey);
sdk.messaging.send(params, sdk);

// Convenience access
sdk.sendMessage(params);
sdk.getPublicKey(address);
sdk.getMessagesForAddress(address, opts);
```

---

## Encryption Methods

| Method | Constant | Name | Key Exchange | Multi-Device | Best For |
|--------|----------|------|--------------|--------------|----------|
| 1 | `ECIES` | Address Communication | None (uses recipient pubkey) | Yes | General messaging (default) |
| 2 | `ECDH` | Session Communication | Format 0/1 handshake | No (device-bound) | Long-running sessions |
| 3 | `AES` | Shared Secret | Out-of-band | Depends on key sharing | Password-protected messages |

---

## ECIES (Method 1): Address Communication

ECIES encrypts directly to the recipient's public key. No prior key exchange is needed. Any device with the recipient's private key can decrypt.

### Encrypt

```js
const result = sdk.messaging.eciesEncrypt(plaintext, recipientPubkey);
// result.ciphertext — hex-encoded ciphertext
```

Parameters:
- `plaintext` (string); Message to encrypt
- `recipientPubkey` (string|Buffer); Recipient's compressed public key (33 bytes hex)

The ciphertext contains: `ephemeralPubkey(33) + iv(12) + authTag(16) + encryptedData`

### Decrypt

```js
const result = sdk.messaging.eciesDecrypt(ciphertext, wif);
// result.plaintext — decrypted message string
```

Parameters:
- `ciphertext` (string|Buffer); Hex-encoded ciphertext from `eciesEncrypt`
- `wif` (string); Recipient's WIF private key

---

## ECDH (Method 2): Session Communication

ECDH requires a key exchange handshake. Both parties exchange public keys via format 0/1 MESSAGE actions, then derive a shared secret.

### Generate Session Key

```js
const result = sdk.messaging.generateSessionKey(wif);
// result.publicKey — hex-encoded compressed public key for key exchange
```

### Derive Shared Secret

```js
const result = sdk.messaging.deriveSharedSecret(wif, theirPublicKey);
// result.sharedSecret — hex-encoded 32-byte shared secret
```

Both parties derive the same shared secret from `myPrivateKey + theirPublicKey`.

### Encrypt / Decrypt

```js
const encrypted = sdk.messaging.sessionEncrypt(plaintext, sharedSecret);
// encrypted.ciphertext — hex-encoded ciphertext

const decrypted = sdk.messaging.sessionDecrypt(ciphertext, sharedSecret);
// decrypted.plaintext — original message
```

---

## AES (Method 3): Shared Secret Communication

AES uses a pre-shared key. If the key is not exactly 32 bytes, it is hashed with SHA-256 to derive the encryption key.

### Encrypt / Decrypt

```js
const encrypted = sdk.messaging.aesEncrypt(plaintext, sharedKey);
// encrypted.ciphertext — hex-encoded ciphertext

const decrypted = sdk.messaging.aesDecrypt(ciphertext, sharedKey);
// decrypted.plaintext — original message
```

Parameters:
- `sharedKey` (string|Buffer); Pre-shared key (hex string, Buffer, or passphrase)

---

## Public Key Lookup

Look up the public key for any address that has sent at least one XChain transaction. The public key is extracted from the transaction's scriptSig/witness data by the decoder and served via the explorer API.

```js
// Via convenience method
const pubkey = await sdk.getPublicKey('1SomeAddress...');

// Via module directly
const pubkey = await sdk.messaging.getPublicKey(address, sdk.explorer);
```

Returns the hex-encoded compressed public key (66 characters), or `null` if not found.

---

## High-Level Send

Send a message with automatic pubkey resolution, encryption, action creation, PSBT signing, and broadcasting.

```js
const result = await sdk.sendMessage({
    wif: senderWIF,
    destination: recipientAddress,
    coin: 'BTC',                      // BTC, LTC, or DOGE — destination address network
    message: 'Hello!',
    method: 1,                        // 1=ECIES (default), 2=ECDH, 3=AES, null=plaintext
    sharedSecret: '...',              // Required for method 2
    sharedKey: '...',                 // Required for method 3
    encoder: { pubkey: senderPubkey } // Encoder options
});
// result.txid         — transaction ID
// result.actionString — the raw MESSAGE action string
```

### Method Behavior

| `method` | Behavior |
|----------|----------|
| `1` (default) | Looks up recipient pubkey via explorer, ECIES encrypts, creates format 2 MESSAGE |
| `2` | Encrypts with provided `sharedSecret` (from prior ECDH key exchange), creates format 2 MESSAGE |
| `3` | Encrypts with provided `sharedKey`, creates format 2 MESSAGE |
| `null` | No encryption, creates format 3 MESSAGE (plaintext) |

---

## High-Level Receive / Read

Fetch and optionally decrypt messages for an address.

```js
const messages = await sdk.getMessagesForAddress('1MyAddress...', {
    wif: myWIF,             // Optional: decrypt ECIES messages
    type: 'received',       // 'sent', 'received', or 'all' (default)
    limit: 10,
    page: 1,
    sortorder: 'DESC'
});
```

Each message object:

| Field | Type | Description |
|-------|------|-------------|
| `from` | string | Sender address |
| `to` | string | Recipient address |
| `text` | string\|null | Decrypted/plaintext message, or null if not decryptable |
| `encrypted` | boolean | Whether the message was encrypted |
| `method` | number\|null | Encryption method (1, 2, 3) or null for plaintext |
| `txid` | string | Transaction hash |
| `block` | number | Block height |
| `timestamp` | number | Block timestamp |

Auto-decryption only works for ECIES (method 1) when `wif` is provided. ECDH and AES messages require the application to supply the shared secret/key and decrypt manually using `sessionDecrypt()` or `aesDecrypt()`.

---

## Convenience Methods

| Method | Equivalent |
|--------|------------|
| `sdk.sendMessage(params)` | `sdk.messaging.send(params, sdk)` |
| `sdk.getPublicKey(address)` | `sdk.messaging.getPublicKey(address, sdk.explorer)` |
| `sdk.getMessagesForAddress(address, opts)` | `sdk.messaging.getMessages(address, opts, sdk.explorer)` |

---

## Error Handling

The messaging module throws `SDKMessagingError` with the following codes:

| Code | When |
|------|------|
| `INVALID_MESSAGE` | Empty or non-string plaintext |
| `INVALID_PUBKEY` | Invalid or missing public key |
| `INVALID_WIF` | Invalid or network-mismatched WIF |
| `INVALID_CIPHERTEXT` | Ciphertext too short or malformed |
| `INVALID_KEY` | Missing encryption key |
| `INVALID_COIN` | Missing or invalid COIN value (must be BTC, LTC, or DOGE) |
| `INVALID_DESTINATION` | Missing destination address |
| `INVALID_METHOD` | Unknown encryption method |
| `PUBKEY_NOT_FOUND` | No public key found for recipient (ECIES send) |
| `DECRYPTION_FAILED` | AES-GCM decryption failure (wrong key or corrupted data) |
| `EXPLORER_REQUIRED` | Explorer not configured for pubkey lookup |
| `ENCODER_REQUIRED` | Encoder options missing for send |
| `SDK_REQUIRED` | SDK instance not provided to `send()` |
| `SHARED_SECRET_REQUIRED` | ECDH method used without shared secret |
| `SHARED_KEY_REQUIRED` | AES method used without shared key |
| `NETWORK_NOT_CONFIGURED` | Network not set in SDK options |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
