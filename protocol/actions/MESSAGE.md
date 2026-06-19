<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - MESSAGE
This action allows for the sending of plaintext and encrypted messages between addresses.

## PARAMS
| Name                | Type   | Description                                          |
| ------------------- | ------ | ---------------------------------------------------- |
| `VERSION`           | String | Broadcast Format Version                             |
| `COIN`              | String | Destination coin network (BTC, LTC, DOGE)            |
| `DESTINATION`       | String | Address of the message or key recipient              |
| `ENCRYPTION_METHOD` | String | Encryption Method (1=ECIES, 2=ECDH, 3=AES)          |
| `ENCRYPTION_KEY`    | String | Public key to be used to exchange messages            |
| `ENCRYPTED_MESSAGE` | String | Message encrypted with shared key                    |
| `PLAINTEXT_MESSAGE` | String | Plaintext message (visible to all!)                  |

## Encryption Methods

### Method `1` - ECIES (Default): Address Communication
Elliptic Curve Integrated Encryption Scheme. Encrypts a message directly to the recipient's public key. The sender generates an ephemeral keypair per message, derives a shared secret via ECDH with the recipient's public key, and encrypts the message with AES-256-GCM. The ephemeral public key is included in the ciphertext so the recipient can decrypt using their private key.

- No key exchange required (no format `0`/`1` handshake needed)
- Works across multiple devices; any device with the recipient's private key can decrypt
- Recommended for general address-to-address messaging

### Method `2` - ECDH: Session Communication
Elliptic Curve Diffie-Hellman key exchange. Both parties exchange public keys (via format `0` and `1` messages) and derive a shared secret. All subsequent messages in the session are encrypted with that shared secret.

- Requires a key exchange handshake before sending messages
- Session is device-bound; the shared secret only exists on the devices that performed the exchange
- Provides forward secrecy when using ephemeral keys
- Best for long-running conversations where both parties are on the same device

### Method `3` - AES: Shared Secret Communication
Advanced Encryption Standard with a pre-shared key. Both parties must already know the same secret key, exchanged out-of-band (not on-chain).

- No on-chain key exchange; the shared key must be established externally
- Useful for password-protected messages or group messaging
- Simpler encryption model but requires secure key distribution

## Formats

### Version `0` - Sender Key
- `VERSION|COIN|DESTINATION|ENCRYPTION_METHOD|ENCRYPTION_KEY`

### Version `1` - Receiver Key
- `VERSION|COIN|DESTINATION|ENCRYPTION_METHOD|ENCRYPTION_KEY`

### Version `2` - Encrypted Message
- `VERSION|COIN|DESTINATION|ENCRYPTED_MESSAGE`
- Version `2` does **not** carry an `ENCRYPTION_METHOD` field on the wire. Absence of this field in a version `2` message **MUST** be interpreted as `ENCRYPTION_METHOD = 1` (ECIES). Encoders **MUST NOT** include the field in version `2` messages (doing so makes the message unencodable, as no format version has a slot for both `ENCRYPTED_MESSAGE` and `ENCRYPTION_METHOD`). For ECDH (method `2`) and AES (method `3`), the session/key is established out-of-band (via the format `0`/`1` handshake or off-chain) and decryption is driven by the application, which already knows the method.

### Version `3` - Plaintext Message
- `VERSION|COIN|DESTINATION|PLAINTEXT_MESSAGE`

## Examples
```
MESSAGE|2|BTC|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|ECIES_ENCRYPTED_CIPHERTEXT_HERE
This example sends an ECIES encrypted message to BTC address 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev
This can be broadcast on any chain (BTC, DOGE, or LTC)
```

```
MESSAGE|0|BTC|1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev|2|PUBLIC_KEY_GOES_HERE
This example requests an ECDH key exchange with BTC address 1JDogZS6tQcSxwfxhv6XKKjcyicYA4Feev (method 2)
```

```
MESSAGE|1|BTC|1Donatet2LrNpuWByAnH8gc9Wh9zSzZuLC|2|PUBLIC_KEY_GOES_HERE
This example responds to the above ECDH key exchange request
```

```
MESSAGE|2|DOGE|DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L|ENCRYPTED_MESSAGE_GOES_HERE
This example sends an encrypted message to DOGE address DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L
```

```
MESSAGE|3|LTC|LZEjckteAtWrugbsy9zU8VHEZ4iUiXo9Nm|Hello
This example sends a plaintext message to LTC address LZEjckteAtWrugbsy9zU8VHEZ4iUiXo9Nm
```

## Rules
- `ENCRYPTION_KEY`, `ENCRYPTED_MESSAGE`, and `PLAINTEXT_MESSAGE` are limited to 1,048,576 Characters (1MB)

## Notes
- Use `^` (caret) as prefix when passing an `ADDRESS_ID` for `DESTINATION` (^57 = `ADDRESS_ID` 57); see [Index ID References](../Index_Id_References.md)
- `MSG` `ACTION` can be used for shorter reference to `MESSAGE` `ACTION`
- `COIN` identifies the destination address's network, messages can be broadcast on any chain regardless of the destination's chain (e.g. send a message to a BTC address via the DOGE network for cheaper/faster transactions)
- `COIN` must be one of: `BTC`, `LTC`, `DOGE`
- Format `0` is to be used when first initializing an ECDH key exchange request (method `2`)
- Format `1` is to be used when responding to an ECDH key exchange request (method `2`)
- Format `0` and `1` are not needed for ECIES (method `1`); the recipient's public key is resolved from on-chain transaction history
- `PLAINTEXT_MESSAGE` and `ENCRYPTED_MESSAGE` characters **NOT** allowed are :
   - pipe `|` (used as field separator)
   - semicolon `;` (used as command separator)

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
