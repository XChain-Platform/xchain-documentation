<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform SDK — Wallet & Auth Reference

This document covers the SDK's wallet and authentication modules: key management, address validation, message signing, challenge-response wallet verification, PSBT signing, transaction broadcasting, and UTXO queries.

---

## Overview

The SDK provides two modules for wallet integration:

- **`sdk.wallet`** (`WalletUtils`) — Key management, address derivation and validation, PSBT signing, transaction broadcasting, and UTXO queries.
- **`sdk.auth`** (`AuthUtils`) — Challenge-response wallet ownership verification and message signing.

Both modules are available on the SDK instance and as top-level convenience methods:

```js
const sdk = new XChainSDK({ network: 'bitcoin-mainnet', encoderUrl: 'localhost' });

// Namespaced access
sdk.wallet.generateKeyPair();
sdk.auth.generateChallenge('bc1q...');

// Convenience access (same thing)
sdk.generateKeyPair();
sdk.generateChallenge('bc1q...');
```

All methods that involve private keys are synchronous (pure crypto, no network calls). Methods that query external services (`broadcastTx`, `getUTXOs`) are async and require the encoder to be configured.

---

## Supported Networks

| Network string | Chain | Segwit | WIF prefix |
|---|---|---|---|
| `bitcoin-mainnet` | Bitcoin | Yes | `0x80` |
| `bitcoin-testnet` | Bitcoin testnet | Yes | `0xef` |
| `bitcoin-regtest` | Bitcoin regtest | Yes | `0xef` |
| `litecoin-mainnet` | Litecoin | Yes | `0xb0` |
| `litecoin-testnet` | Litecoin testnet | Yes | `0xef` |
| `litecoin-regtest` | Litecoin regtest | Yes | `0xef` |
| `dogecoin-mainnet` | Dogecoin | No | `0x9e` |
| `dogecoin-testnet` | Dogecoin testnet | No | `0xf1` |
| `dogecoin-regtest` | Dogecoin regtest | No | `0xf1` |

Dogecoin does not support SegWit. Requesting a `p2wpkh` or `p2sh-p2wpkh` address on a Dogecoin network throws `SEGWIT_NOT_SUPPORTED`.

---

## Key Management

### Generate a Key Pair

```js
const kp = sdk.generateKeyPair();
// kp.wif          — WIF-encoded private key (string)
// kp.privateKey   — raw private key (Buffer)
// kp.publicKey    — compressed public key (Buffer)
// kp.publicKeyHex — compressed public key (hex string)
// kp.compressed   — true
```

Pass `{ compressed: false }` to generate an uncompressed key pair (65-byte public key).

### Import a WIF Key

```js
const kp = sdk.importWIF('cNjGh3...');
// Returns the same shape as generateKeyPair()
```

Throws `NETWORK_MISMATCH` if the WIF's network byte doesn't match the SDK's configured network. Throws `INVALID_WIF` for malformed input.

---

## Address Derivation

Derive an address from a public key (Buffer or hex string):

```js
// P2PKH (legacy) — default
const legacy = sdk.deriveAddress(kp.publicKey);

// P2WPKH (bech32 / native segwit)
const segwit = sdk.deriveAddress(kp.publicKey, { type: 'p2wpkh' });

// P2SH-P2WPKH (wrapped segwit)
const wrapped = sdk.deriveAddress(kp.publicKey, { type: 'p2sh-p2wpkh' });
```

| Type | Format | Example prefix (BTC mainnet) |
|---|---|---|
| `p2pkh` | Base58Check | `1...` |
| `p2wpkh` | Bech32 | `bc1q...` |
| `p2sh-p2wpkh` | Base58Check (P2SH) | `3...` |

---

## Address Validation

Validate any coin address against the configured network (or a specific override):

```js
const result = sdk.validateAddress('bc1qexample...');
// result.valid   — boolean
// result.type    — 'p2pkh', 'p2wpkh', 'p2sh', 'p2wsh', or null
// result.network — 'bitcoin-mainnet', etc., or null
// result.error   — error message string, or null

// Check against a specific network
const ltcResult = sdk.validateAddress('ltc1q...', 'litecoin-mainnet');
```

If no network is configured and no override is given, the address is checked against all 9 supported networks. Returns `{ valid: false }` (does not throw) for invalid addresses.

---

## Challenge-Response Wallet Verification

The auth module provides a three-step flow for proving wallet ownership:

### Step 1: Generate a Challenge (Server)

```js
// Default structured message (includes address, nonce, timestamp)
const challenge = sdk.generateChallenge('bc1quseraddress...');
// challenge.challenge — the message string to sign
// challenge.nonce     — hex nonce (store this server-side)
// challenge.timestamp — ISO 8601 timestamp
// challenge.expiresAt — ISO 8601 expiry (default 5 minutes)

// Custom application ID
const challenge = sdk.generateChallenge('bc1q...', { appId: 'MyMusicApp' });

// Custom message (your site generates its own format)
const challenge = sdk.generateChallenge('bc1q...', {
    message: 'Sign this to access premium content on MyApp. Nonce: abc123'
});
// challenge.challenge === the custom message, used as-is
```

When `opts.message` is provided, the SDK uses it verbatim. The nonce and timestamp metadata are still returned for the caller's bookkeeping but are not embedded in the message. This means sites can generate their own messages and verify independently of the SDK.

### Step 2: Sign the Challenge (Wallet/Client)

```js
const signed = sdk.signMessage(challenge.challenge, userWIF);
// signed.signature — base64 encoded signature
// signed.address   — the address derived from the signing key
```

For SegWit addresses, pass the appropriate option:

```js
// Native segwit (bech32)
sdk.signMessage(message, wif, { segwitNative: true });

// Wrapped segwit (P2SH-P2WPKH)
sdk.signMessage(message, wif, { segwitRedeemScript: true });
```

### Step 3: Verify Ownership (Server)

```js
const result = sdk.verifyOwnership('bc1quseraddress...', challenge.challenge, signed.signature);
// result.valid   — boolean
// result.address — the address that was verified
// result.error   — null on success, error message on failure
```

`verifyOwnership` never throws — it returns `{ valid: false, error: '...' }` on failure. This makes it safe to use in request handlers without try/catch:

```js
app.post('/auth/verify', (req, res) => {
    const { address, message, signature } = req.body;
    const result = sdk.verifyOwnership(address, message, signature);
    if (!result.valid) return res.status(401).json({ error: result.error });
    // Grant access...
});
```

### Verify Any Message

`verifyMessage` is a simpler alias that doesn't return the address:

```js
const result = sdk.verifyMessage(address, message, signature);
// result.valid — boolean
// result.error — null or error string
```

### SDK-Independent Verification

Sites that don't want to depend on the SDK for server-side verification can use `bitcoinjs-message` directly:

```js
const bitcoinMessage = require('bitcoinjs-message');
const valid = bitcoinMessage.verify(message, address, signature);
```

Or use the coin node's `verifymessage` JSON-RPC method. The signatures produced by `sdk.signMessage` are standard Bitcoin message signatures compatible with all of these.

---

## PSBT Signing

Sign an unsigned PSBT hex string (from the encoder) with a WIF private key:

```js
const result = sdk.signPsbt(unsignedPsbtHex, wif);
// result.txHex   — signed raw transaction hex (ready to broadcast)
// result.txid    — transaction ID
// result.psbtHex — signed PSBT hex
```

This method finalizes all inputs after signing and extracts the raw transaction. The `txHex` is what you pass to `broadcastTx`.

### Full Workflow: Create → Sign → Broadcast

```js
// 1. Create an action and encode it as a PSBT
const action = await sdk.send(
    { tick: 'MYTOKEN', amount: '100', destination: 'bc1qrecipient...' },
    { pubkey: publicKeyHex }
);

// 2. Sign the PSBT
const signed = sdk.signPsbt(action.psbt, wif);

// 3. Broadcast the signed transaction
const broadcast = await sdk.broadcastTx(signed.txHex);
console.log('Transaction ID:', broadcast.txid);
```

---

## Transaction Broadcasting

Broadcast a signed raw transaction to the coin node via the encoder:

```js
const result = await sdk.broadcastTx(signedTxHex);
// result.txid — the transaction ID returned by the coin node
```

Requires the encoder to be configured. The encoder proxies the `sendrawtransaction` call to the coin node.

---

## UTXO Queries

Fetch UTXOs for an address:

```js
const utxos = await sdk.getUTXOs('bc1qmyaddress...');
// [ { txid: 'abc...', vout: 0, value: 50000 }, ... ]
```

Requires the encoder to be configured. The encoder proxies the request to the xchain-utxo-tracker service.

---

## Error Handling

The wallet and auth modules throw two error classes:

| Class | When |
|---|---|
| `SDKWalletError` | Key management, address derivation, PSBT signing, broadcasting, UTXO queries |
| `SDKAuthError` | Challenge generation, message signing, signature verification failures |

See [Errors](ERRORS.md) for the complete list of error codes.

Exception: `verifyOwnership` and `verifyMessage` **do not throw** — they return `{ valid: false, error: '...' }` on failure. This is intentional so that verification can be used in request handlers without try/catch boilerplate.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
