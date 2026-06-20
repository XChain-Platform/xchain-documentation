<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Keys & Signing

This document covers everything between the user's password and a broadcast transaction; KDF, vault encryption, mnemonic handling, HD derivation, the signer interface, and the five concrete signer implementations.

## Master key derivation

The user's password is never persisted. On unlock it's stretched through **Argon2id** to a 32-byte master key:

| Parameter | Value |
|---|---|
| Algorithm | Argon2id (`@noble/hashes`) |
| Memory floor | 64 MiB |
| Iteration floor | 3 |
| Parallelism | 1 |
| Salt | 16 random bytes per wallet, persisted with the vault |
| Output | 32 bytes (used as AES-256-GCM key) |

Calibration: on first wallet creation the wallet runs Argon2id with the floor parameters and increases iterations until the derivation takes ≥ 750 ms on the device. The chosen `(memory, iterations)` is stored alongside the salt; subsequent unlocks use the same parameters. This puts the dial above the OWASP 2023 baseline on modern hardware while remaining unlock-grade fast.

After derivation the master key:

- Decrypts the vault blob via AES-256-GCM
- Is cached for the session (`chrome.storage.session` on the extension, OS keychain on desktop if enabled, in-memory only on web)
- Is zeroed when the wallet locks

The password itself is zeroed immediately after derivation.

## Vault encryption

The vault is a single AES-256-GCM ciphertext. On unlock the wallet:

1. Reads the salt + KDF parameters from the storage backend
2. Derives the master key from the user's password
3. Decrypts the ciphertext; a tag mismatch surfaces as "wrong password"
4. JSON-parses the plaintext into the schema-validated vault tree
5. Runs `core/src/schemas/migrations.js` if the schema version is older than current

Vault contents include the encrypted seed, derivation roots, accounts, addresses, contacts, connected-sites, multisig configs, in-flight signing sessions, queued broadcasts, registered signers, and settings. See [Architecture; Vault and state model](ARCHITECTURE.md) for the full collection list.

## Mnemonic handling

Two mnemonic formats are supported on import:

- **BIP39**: 12, 15, 18, 21, or 24 words, validated against the BIP39 wordlist by `@scure/bip39`. Generation defaults to 12 words (128-bit entropy); a caller may request 24 words (256-bit) by passing a higher `strengthBits` value. Optional 25th-word passphrase is offered on the create flow and on import.
- **Counterwallet legacy**: 12 words from a non-standard wordlist. Implemented in-house at `core/src/crypto/counterwallet.js` + `counterwallet-wordlist.js` because the wordlist isn't published in any standardized package.

Both flows derive a BIP32 seed and store the encrypted seed in the vault. The plaintext mnemonic is shown to the user during create + view-private-key flows, both gated behind explicit confirmation, and is never persisted in plaintext.

Migration: a Counterwallet-imported wallet can be migrated to BIP39 on demand via the `MigrateToBip39` route. The wallet generates a fresh 24-word BIP39 mnemonic, derives the same chain/account roots, and offers a sweep flow to move balances from the legacy derivation to the new one. The migration is opt-in and reversible (the legacy mnemonic continues to control the legacy addresses).

## HD derivation

Each chain has a `ChainDescriptor` (registered in `core/src/sdk/SDKRegistry`) declaring its BIP44 coin type and address-type templates. `core/src/crypto/hd.js` walks the BIP32 tree from the seed:

```
seed → m / 44' / coinType' / account' / change / index
```

Address types per chain:

| Chain | BIP44 coin type | Default | Other supported |
|---|---|---|---|
| Bitcoin | 0 | `p2wpkh` (bech32) | `p2pkh`, `p2sh-p2wpkh`, `p2tr` |
| Litecoin | 2 | `p2wpkh` | `p2pkh`, `p2sh-p2wpkh` |
| Dogecoin | 3 | `p2pkh` | (Dogecoin lacks segwit on most deployments) |

The wallet runs a gap-limit scan (`core/src/flows/discoverUsedAddresses.js`) on import to populate already-used receive addresses without forcing the user to manually walk the index.

## Signer interface

Every signer implements the abstract surface in `core/src/signers/Signer.js`:

```
class Signer {
    id()                                       // stable identifier
    displayName()                              // user-facing label
    firmwareVersion()                          // for hardware signers
    getPublicKey(path, chain)                  // for receive-address derivation
    signMessage(address, message)              // for SIGN_IN, dApp signMessage
    signPsbt(psbt, inputs)                     // single-key flows
    signMultisigPsbt(params)                   // classical n-of-m: full-PSBT variant
    signMultisigClassical(params)              // classical n-of-m: single-input sighash variant
    signMusig2Round1(params)                   // MuSig2 round 1: generate public nonce
    signMusig2Round2(params)                   // MuSig2 round 2: produce partial signature
}
```

Methods that aren't supported by a particular signer return a typed deferral error (`UnsupportedSignerOperation`) with a message pointing the user at the software signer or the appropriate workaround. Sign screens render the deferral inline so the user understands *why* a sign attempt didn't proceed.

## Concrete signers

### `SoftwareSigner`

Derives keys from the unlocked vault and signs in the host process. The fastest path; the only signer that can do MuSig2 today.

- **Key access**: derives via `@scure/bip32` from the in-memory seed; never returns raw key bytes to the renderer / page
- **PSBT signing**: `xchain-sdk` `wallet.signPsbt` with the derived WIF
- **Message signing**: `bitcoinjs-message` over the SDK
- **Multisig**: `xchain-sdk` `wallet.signMultisigPsbt` for classical n-of-m; full MuSig2 round support
- **Trade-offs**: keys live in the host process while unlocked. Mitigated by short auto-lock, in-memory-only session keys on web, and main-process isolation on desktop

### `TrezorSigner`

Trezor Connect over WebUSB / WebHID. Supported on all current Trezor models.

- **Pairing**: Trezor Connect popup; the wallet records the device's public key and a `displayName` in the signers store
- **PSBT signing**: `trezorFormat.js` (`core/src/signers/trezorFormat.js`) adapts XChain PSBTs to Trezor's expected schema, with the OP_RETURN / P2SH / P2WSH / multisig encoding modes mapped to Trezor's `output_script_type` taxonomy
- **Message signing**: Trezor's native message-sign flow
- **Multisig**: classical n-of-m PSBT signing flow is scaffolded but vendor-API-heavy; current builds surface a deferral pointing the user at the software signer for full coverage. MuSig2 nonce wiring is firmware-gated and not yet shipped
- **Trade-offs**: slowest signing path due to per-input device confirmation; users see + confirm every output on the device screen

### `LedgerSigner`

`@ledgerhq/hw-app-btc` over `@ledgerhq/hw-transport-webhid`. Supported on all current Ledger models running the Bitcoin app (with appropriate altcoin apps for LTC and DOGE).

- **Pairing**: WebHID device-picker; the wallet records the device's public key and a `displayName` in the signers store
- **PSBT signing**: `ledgerFormat.js` adapts XChain PSBTs; Ledger's PSBT signing surface is used directly when available
- **Message signing**: Ledger's native message-sign flow
- **Multisig**: same status as Trezor: classical n-of-m scaffolded with vendor-deferral, MuSig2 firmware-gated
- **Firmware gates**: `firmware-manifest.js` declares minimum firmware versions per chain + feature; `checkFirmware.js` runs on pair and on every privileged op

### `RemoteSigner`

Pairs across shells. Use case: the user keeps the seed on the desktop app (highest isolation) and uses the web app or extension for browsing; sign requests are forwarded to the desktop app over a paired channel.

- **Pairing**: out-of-band pair code from the desktop's "Pair Signer" route; remote shell stores the channel + remote pubkey
- **Transport**: `signerPortProtocol.js` defines the request envelope (PSBT + chain + path) and response envelope (signed PSBT or deferral error)
- **Trade-offs**: adds an authenticated round-trip to the user-confirmed device for each sign; recovery from a flaky channel falls back to the software signer

### Multisig orchestration (Phase 4+)

A dedicated `MultisigSigner` class is planned (§17.5) but not yet implemented. Multisig signing is currently orchestrated through flows in `core/src/flows/multisigSigning.js`, which drive `SoftwareSigner` for each cosigner contribution. See [Multisig](MULTISIG.md) for the full session state machine.

- **Classical n-of-m** (P2SH / P2WSH): one round. Each cosigner calls `signMultisigClassical` or `signMultisigPsbt`; the coordinator merges partial sigs and finalizes.
- **MuSig2** (taproot): two rounds per BIP327. Round 1 collects a public nonce per cosigner (`signMusig2Round1`); round 2 collects a 32-byte partial signature (`signMusig2Round2`). Intermediate state is persisted to `multisigSigningSessions`.
- **Transport**: paste-inbox or PSBT-QR (BIP21 envelope or chunked PSBT-QR). See [URI Schemes](URI_Schemes.md)

## Backup, recovery, and dry-run restore

The wallet ships three backup paths:

- **View private key**: per-address WIF export, gated behind password re-entry; surfaced in the `ViewPrivateKey` route
- **Backup file**: full vault export as an encrypted blob; `core/src/crypto/backup.js` re-wraps the vault with a backup-specific KDF
- **Mnemonic + passphrase**: the canonical recovery path; recreating the wallet on any compatible client recovers identical addresses

The `dryRunRestore` flow (`core/src/flows/dryRunRestore.js`) lets a user verify they have the right mnemonic + passphrase combination without committing to a fresh wallet; the wallet derives the first N addresses and shows them alongside any on-chain history. If the addresses look right, the user confirms; otherwise they go back to retry the mnemonic.

`importSingleWif` and `importWif` cover the case where a user has only a single private key (e.g., recovered from a paper wallet or another wallet) and wants the XChain wallet to manage it. These flows create a single-address, no-mnemonic wallet that supports all wallet operations except HD-derived receive-address generation.

## Label sync

`core/src/crypto/labelSync.js` provides an opt-in, end-to-end-encrypted address-label sync across the user's own devices. The user's mnemonic is the only key material; labels are encrypted with a derived sub-key and stored as a regular `MESSAGE` (ECIES-to-self) action on the user's primary chain. Other shells running the same mnemonic decrypt and merge the labels into their local vault. The same wallet on multiple devices stays consistent; nobody else sees plaintext labels.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
