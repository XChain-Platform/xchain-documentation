<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2026 Dankest, LLC -->

# Wallet Architecture

This document describes how the wallet is organized at the package level, how the three shells relate to the shared core, and how state and messages flow through the system at runtime.

## Three shells, one core

The wallet is a pnpm workspace with three product surfaces — a browser web app, a Chrome MV3 extension, and an Electron desktop app — and a shared `@xchain-wallet/core` that contains everything *except* the host-specific glue.

```
@xchain-wallet/core
├── src/ui/             primitives (Button, Input, Screen, ChainBadge, AddressText, …)
├── src/shared/         shared routes (Home, Send, Receive, Issue, …) + components + hooks
├── src/flows/          imperative flows (createWallet, unlockWallet, sendAsset, …)
├── src/signers/        Signer interface + Software / Trezor / Ledger / Remote / Multisig
├── src/sdk/            SDKRegistry, defaultFactory, submitWithSigner
├── src/storage/        Vault, codec, backend abstractions
├── src/schemas/        wallet, address, account, multisigConfig, multisigSigningSession, …
├── src/registry/       action descriptors + registry validators
├── src/decoder/        plain-English action decoder for sign-screen safety rails
├── src/uri/            BIP21, multisig PSBT envelope, chunked PSBT-QR, QR detect
├── src/crypto/         kdf, mnemonic, hd, walletBlob, aead, backup, label-sync, wif
├── src/airdrop/        airdrop recipient parsing
├── src/market/         orderbook bucketization
├── src/i18n/           string registry (en + future locales)
├── src/branding/       logo + colors + asset registry
└── src/templates/      cross-chain templates (parallel composer presets)
```

Each shell wraps the core in a small amount of host-specific glue:

| Shell | Glue layer | Vault location | Session key location |
|---|---|---|---|
| `@xchain-wallet/web` | Vite SPA + `hostBridge.js` | IndexedDB | in-memory only |
| `@xchain-wallet/extension` | service worker + content script + injected provider + popup + approval window | `chrome.storage.local` | `chrome.storage.session` |
| `@xchain-wallet/desktop` | Electron main / preload / renderer | encrypted file via main process | OS keychain (optional) |

Every route renders the same React tree across shells; only the host bridge differs.

## Package boundaries

```
                   ┌────────────────────────────────────────────────┐
                   │                @xchain-wallet/core             │
                   │  React routes + components + flows + signers   │
                   │  + storage + schemas + decoder + uri + crypto  │
                   └─┬──────────────────┬──────────────────┬────────┘
                     │                  │                  │
   ┌─────────────────▼─────┐  ┌─────────▼─────────┐  ┌─────▼─────────────────┐
   │ @xchain-wallet/web    │  │ @xchain-wallet/   │  │ @xchain-wallet/       │
   │ Vite SPA              │  │ extension         │  │ desktop               │
   │ hostBridge.js         │  │ background +      │  │ Electron main +       │
   │ sdkFactory.js         │  │ content + popup + │  │ preload + renderer    │
   │                       │  │ approval + inject │  │                       │
   └─────────────────┬─────┘  └─────────┬─────────┘  └─────┬─────────────────┘
                     │                  │                  │
                     └──────────────┐   │   ┌──────────────┘
                                    ▼   ▼   ▼
                            ┌──────────────────────┐
                            │      xchain-sdk      │  (sibling repo)
                            │  actions + encoder + │
                            │  explorer + hub + ws │
                            └──────────────────────┘

@xchain-wallet/bridge-spec    typed window.xchain definitions (consumed by dApps)
@xchain-wallet/test-dapp      reference dApp exercising the bridge
@xchain-wallet/e2e            Playwright suite (web shell)
```

`xchain-sdk` is the only data + signing dependency. The wallet never talks directly to the encoder, explorer, hub, or coin nodes — every blockchain-facing call routes through the SDK. This single boundary means the SDK can swap out endpoints, add chains, or change protocols and the wallet inherits the change without modification.

## Three-shell-to-core seams

Each shell registers *two* host functions with core:

1. **SDK factory** — `core/src/sdk/SDKRegistry` calls a host-supplied factory to mint per-chain SDK instances. Web/desktop instantiate `xchain-sdk` directly; the extension instantiates the SDK in the service worker and routes calls from popup / approval / full-screen via `MessageHost`.
2. **Storage backend** — `core/src/storage/backend.js` selects between IndexedDB (web), `chrome.storage.local` (extension), and a file-backed adapter (desktop main process). Vault encryption / decryption is identical across all three.

The hot path for a signed action across shells is identical:

```
User clicks Send in a route from core/src/shared/routes/
   ↓
flow function from core/src/flows/sendAsset.js
   ↓
sdk.send(actionParams) → action string
   ↓
sdk.encoder.createTransaction(...) → unsigned PSBT
   ↓
signer.signPsbt(psbt) → signed PSBT  ← Signer chosen via core/src/flows/resolveSigner
   ↓                                    Software / Trezor / Ledger / Remote / Multisig
sdk.broadcast(rawTx) → txid
   ↓
sdk.waitForAction(txid) → indexed
```

The path is the same in the web shell (signer runs in the page), the extension (signer runs in the service worker), and the desktop app (signer runs in the main process). Differences live entirely behind the SDK factory + storage backend seams.

## Vault and state model

The wallet's persisted state is a single AES-256-GCM-encrypted blob containing:

| Collection | Schema | Purpose |
|---|---|---|
| `wallets` | `core/src/schemas/wallet.js` | Encrypted seed, derivation roots, settings; schema v2 supports per-address multisig configs |
| `accounts` | `core/src/schemas/account.js` | BIP44 account groupings under a wallet |
| `addresses` | `core/src/schemas/address.js` | Derived addresses with chain + script type + label |
| `contacts` | `core/src/schemas/contact.js` | Saved address book |
| `connectedSites` | `core/src/schemas/connectedSite.js` | Per-origin dApp permission grants |
| `multisigs` | `core/src/schemas/multisigConfig.js` | n-of-m configurations, schema v2 |
| `multisigSigningSessions` | `core/src/schemas/multisigSigningSession.js` | In-flight cosigner state |
| `pendingTxs` | `core/src/schemas/pendingTx.js` | Queued broadcasts |
| `pendingAirdrops` | `core/src/schemas/pendingAirdrop.js` | Multi-output airdrop progress |
| `signers` | `core/src/schemas/signer.js` | Registered hardware / remote signers |
| `settings` | `core/src/schemas/settings.js` | Per-chain endpoints, auto-lock, locale, theme |
| `watchlist` | `core/src/schemas/watchlistEntry.js` | Followed addresses |

Master key derivation: password → Argon2id (calibrated per device, floor 64 MiB × 3 iterations × 1 parallelism) → 32-byte master key → AES-256-GCM-decrypts the vault blob.

## Schema migrations

Schemas declare a `version` and a forward migration. `core/src/schemas/migrations.js` runs on every vault load and walks legacy records up to the current version transparently. The active migration is **v1 → v2** for `Wallet.multisig` (single config) → `Wallet.multisigs[]` (per-address multi-config). Legacy v1 wallets continue to load without user intervention.

## Signer interface

`core/src/signers/Signer.js` declares the abstract surface every signer implements:

- `getPublicKey(path, chain)`
- `signMessage(address, message)`
- `signPsbt(psbt, inputs)`
- `signMultisigPsbt(psbt, inputs, config)` — classical n-of-m
- `participateInMuSig2(session, round)` — MuSig2 collaborative session
- `displayName()` / `id()` / `firmwareVersion()` — identity and gating

Five concrete implementations:

- **`SoftwareSigner`** — derives keys from the unlocked vault, signs in the host process
- **`TrezorSigner`** — Trezor Connect, all current models; `trezorFormat.js` adapts XChain PSBTs to Trezor's expected schema
- **`LedgerSigner`** — `@ledgerhq/hw-app-btc` over WebHID; `ledgerFormat.js` adapts XChain PSBTs
- **`RemoteSigner`** — pairs across shells (e.g., desktop signs a PSBT scanned from the web shell's QR); `signerPortProtocol.js` defines the message envelope
- **`MultisigSigner`** — orchestrates classical n-of-m sessions and MuSig2 round protocol; built on top of `signMultisigPsbt` exposed by `xchain-sdk@1.13.0+`

Hardware signers expose vendor-specific deferral errors when a feature isn't yet supported in firmware (e.g., MuSig2 nonce wiring on Trezor / Ledger), with a documented path to fall back to the software signer.

## Action decoder + sign-screen safety rails

`core/src/decoder/actionDecoder.js` reverses every supported action string into a plain-English summary that's rendered alongside the encoder's PSBT on the sign screen. Even if a malicious encoder fabricates output bytes, the user sees `to`, `amount`, and `asset` reflected back from their own form input — not from the encoder's response.

Future work (§21.2 from the spec) adds a byte-level cross-check that re-decodes the encoder's PSBT and compares it to the user's form intent. That's the next iteration of the safety rail.

## Build pipelines

| Shell | Bundler | Output |
|---|---|---|
| Web | Vite (with `vite-plugin-node-polyfills` and optional `@vitejs/plugin-basic-ssl`) | `packages/web/dist/` — static SPA |
| Extension | Vite (multi-entry: popup, approval, background service worker, content script, injected provider) | `packages/extension/dist/` — unpacked Chrome extension |
| Desktop renderer | Vite | `packages/desktop/build/` — bundled into the Electron asar |
| Desktop installers | electron-builder | `packages/desktop/dist/` — `.dmg` / `.exe` / `.AppImage` |
| Desktop pre-signing (reproducible) | `electron-builder --dir` | `packages/desktop/dist/linux-unpacked/` + `RELEASE_HASHES.txt` |

See [Build & Release](BUILD_RELEASE.md) for per-shell signing, packaging, and distribution detail, and [Reproducible Builds](REPRODUCIBLE_BUILDS.md) for the Level-2 verification protocol.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **Dankest Community License**.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
