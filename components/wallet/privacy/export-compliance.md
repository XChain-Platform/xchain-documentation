<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/Export_Compliance.md @ 34639117 (worktree dirty) -->

# Encryption and export compliance

App stores ask about export compliance on every submission that contains encryption. This page is the single stance XChain Wallet uses across the App Store, Google Play and the Chrome Web Store, so the answer does not diverge between them.

## The question the stores are asking

Every store's encryption question reduces to two things: does the app contain encryption, and if so, is it the ordinary published kind or something that would need a licence.

**Yes, the wallet contains encryption.** A self-custodial wallet is encryption software: it encrypts a recovery phrase at rest and it signs transactions.

## What the wallet actually uses

All of it is standard, published, widely implemented cryptography. There is no proprietary or in-house algorithm anywhere in the wallet.

| Purpose | Algorithm |
|---|---|
| Encrypting the vault at rest | AES-256-GCM |
| Deriving the vault key from the password | Argon2id (RFC 9106) |
| Transaction signing | ECDSA over secp256k1 |
| Verifying the signed chain registry | Ed25519 |
| Hashing | SHA-256 |
| Key derivation and mnemonics | BIP32, BIP39 |
| Address and data encoding | Base58, Bech32 |
| Desktop session key wrapping | OS-native (macOS Keychain, Windows DPAPI) |

Two properties matter for the classification, and both hold:

1. **Every algorithm is a published standard.** AES, Argon2id, secp256k1, Ed25519, SHA-256, BIP32 and BIP39 are all publicly specified. Nothing is secret or novel.
2. **The implementation is open source.** The wallet is licensed AGPL-3.0-or-later and its source is published, as is every cryptographic library it uses. Nothing is a private fork.

The wallet is also not a general-purpose encryption product. It does not encrypt user files or messages on demand; the cryptography exists to protect the user's own keys and to sign their own transactions.

## The stance

**XChain Wallet uses only standard, publicly available cryptography, implemented by open-source libraries, in published open-source code.**

That is the sentence every store answer reduces to. It is verified against the code and can be stated without qualification.

## The part that is a legal judgment, not an engineering one

Whether that stance qualifies for a specific export exemption, and which one, is a compliance decision rather than a technical fact:

1. **Which App Store answer applies.** App Store Connect asks whether the app uses exempt encryption. The open-source route (the US publicly-available-encryption-source-code exemption) is the one that fits an AGPL wallet whose source is published, though whether the standard "limited to authentication and digital signature" exemption is a better fit is a compliance question rather than an engineering one.
2. **Whether a source-code notification is owed.** The publicly-available route can carry a one-time notification obligation to the relevant export authority, naming where the source is published.
3. **Whether an annual self-classification report applies.** Some exemption routes carry a yearly reporting obligation.
4. **Non-US jurisdictions.** The stores are global, and whether any listing country requires its own encryption declaration is a compliance question independent of the above.

## Tor routing, and what it does not add

The desktop app can route its traffic through a local Tor SOCKS5 proxy. This does not change the classification above and does not add an encryption capability:

- The wallet speaks the SOCKS5 protocol to a proxy the user already runs. It does not bundle, ship or implement Tor, and it does not implement onion routing.
- SOCKS5 CONNECT carries no cryptography of its own. The TLS that protects the traffic is the same standard TLS described above, terminated at the real destination.

This is stated as "can use a user-supplied local SOCKS5 proxy," not as "ships Tor." The distinction matters on a form asking what the app contains.

**Web and the browser extension do not offer this feature and must not be described as offering it.** It exists only on desktop.
