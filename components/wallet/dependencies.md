<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/DEPENDENCIES.md @ 34639117 (worktree dirty) -->

# Dependencies

This page inventories the wallet's direct runtime dependencies: external packages declared by a shipped workspace, internal workspace links, and native libraries compiled into a user-installable application. Transitive packages are recorded in `pnpm-lock.yaml` and the native lock and verification files, but are not enumerated here. Dev-only build, lint, and test tools are excluded, except for Electron because the packaged desktop application embeds the Electron runtime.

For each external JavaScript package, the [floor versions](#floor-versions) table gives both the manifest range and the version selected by the committed lockfile. A frozen install and the wallet's [reproducible builds](reproducible-builds.md) use the lockfile selection.

CI installs with `pnpm install --frozen-lockfile` and runs `pnpm audit --prod --audit-level=high` on pushes and pull requests to `develop` and `master`. The audit job fails on high or critical production-dependency advisories.

## Core

`@xchain-wallet/core` contains the shared crypto, storage, flows, UI, URI handling, and signer abstractions used by the shipped shells.

### `@noble/ciphers`

Provides AES-GCM for authenticated encryption in the wallet crypto layer.

### `@noble/curves`

Provides secp256k1 operations used when validating multisig extended public keys and Ed25519 verification for signed remote chain-registry documents.

### `@noble/hashes`

Provides Argon2id, SHA-256, and byte conversion helpers used by key derivation, integrity checks, registry verification, signer fingerprints, and other wallet flows. The Ledger signer workspace also uses its SHA-256 implementation.

### `@scure/base`

Provides Base58Check for WIF and address handling, Bech32 and Bech32m for address validation, and Base32 for BBQR PSBT encoding.

### `@scure/bip32`

Provides BIP32 hierarchical deterministic key derivation and extended-public-key parsing. The wallet uses it for account and address derivation and multisig xpub handling.

### `@scure/bip39`

Provides BIP39 mnemonic generation, validation, the English word list, and seed derivation. The separate Counterwallet-compatible mnemonic path and word list live in the wallet source.

### `intl-messageformat`

Formats the wallet's ICU-style localized messages, including plural and select expressions.

### `lightweight-charts`

Renders market price charts in the shared UI. It is declared by core and by each browser or desktop shell that bundles that UI.

### `lucide-react`

Supplies the icon components exported through the core UI icon module.

### `pako`

Inflates zlib-wrapped or raw DEFLATE data when decoding compressed BBQR PSBT payloads.

### `qrcode`

Renders receive addresses, private-key exports, and animated QR frames. It is declared by core, extension, and web.

### `react`, `react-dom`

Provide the shared component and DOM rendering runtime. Core declares them as optional peers, while the extension, web, and desktop shells declare them as direct runtime dependencies.

## Extension shell

The extension is a Chrome MV3 shell. It consumes `@xchain-wallet/core`, renders the shared React UI, and hosts the background wallet and dApp bridge flows.

Its direct external runtime dependencies are `@ledgerhq/hw-app-btc`, `@ledgerhq/hw-transport-webhid`, `lightweight-charts`, `qrcode`, `react`, `react-dom`, and the published `xchain-sdk` package. The two Ledger packages provide the Bitcoin-family application client and browser WebHID transport. The SDK provides the chain data, composition, signing-support, and broadcast APIs used by the background host.

## Web shell

The web shell is the browser SPA and the web bundle wrapped by the mobile shell. It consumes `@xchain-wallet/core` and reuses `@xchain-wallet/extension` background-host code so the browser shells share wallet flows.

Its direct external runtime dependencies match the extension's: `@ledgerhq/hw-app-btc`, `@ledgerhq/hw-transport-webhid`, `lightweight-charts`, `qrcode`, `react`, `react-dom`, and `xchain-sdk`.

## Desktop shell

The Electron shell ships for Windows, macOS, and Linux. The packaged application embeds Electron, uses the shared React renderer, and reuses the extension background host in its main process.

### `electron-updater`

Checks and downloads updates for packaged, direct-download builds. Store-managed Mac App Store, Microsoft Store, and Snap installations bypass the self-updater. Automatic download and install-on-quit are disabled: the user starts the download, the wallet verifies it, and a separate restart action calls the installer.

### `openpgp`

Verifies the detached maintainer signature over `RELEASE_HASHES.txt` against the public key pinned in the application. The update gate also checks that the signed manifest describes the expected release and lane, covers every file named by the channel pointer, and contains the downloaded artifact's hash. A rejected download is not prepared for installation and is deleted on a best-effort basis.

This dependency runs in the main process. It is not part of the renderer's key-handling path.

### `undici`

Supplies the global dispatcher used to route Node `fetch` traffic through the configured SOCKS5 proxy when desktop Tor routing is enabled. The desktop applies the same proxy setting separately to the SDK's HTTP agents and Chromium's session, so SDK requests, main-process fetches, renderer traffic, and updater traffic move together.

### Hardware signer packages

`@ledgerhq/hw-app-btc` and `@ledgerhq/hw-transport-webhid` provide the Ledger Bitcoin-family client and WebHID transport. Ledger transport is used in the renderer and does not require a native USB binding.

Desktop also links `@xchain-wallet/signers-ledger` and `@xchain-wallet/signers-trezor`. The Trezor signer package has no external package dependency: shell factories inject a Connect-compatible transport, and desktop loads Trezor's hosted Connect build inside an isolated bridge window.

### Renderer and protocol packages

`react`, `react-dom`, and `lightweight-charts` provide the renderer. `xchain-sdk` provides protocol access. Desktop also links `@xchain-wallet/core`, `@xchain-wallet/extension`, and `@xchain-wallet/bridge-spec` for shared flows, the background host, and dApp bridge helpers.

## Mobile shell

`@xchain-wallet/mobile` is a Capacitor wrapper around the web SPA. Android is shipped with a minimum API level of 26. The iOS application targets iOS 16 or later and is built but pending App Store release.

The JavaScript workspace declares `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`, and the internal `@xchain-wallet/web` workspace. Android directly compiles AndroidX AppCompat, CoordinatorLayout, Core Splashscreen, and Biometric, plus Bouncy Castle for native Argon2id derivation. iOS uses the Capacitor and Cordova Swift packages and compiles the vendored Argon2 reference implementation for native Argon2id derivation.

## Signer workspaces

`@xchain-wallet/signers-ledger` declares only `@noble/hashes` externally. Shell-specific factories inject the Ledger application client and transport.

`@xchain-wallet/signers-trezor` declares no external runtime dependencies. Shell-specific factories inject the Trezor Connect surface, while the signer package contains the device-independent transaction and message conversion logic.

## `@xchain-wallet/bridge-spec`

This private workspace has zero declared runtime dependencies. It exports TypeScript bridge types, runtime guards, and a reference client used by the wallet's dApp bridge and test dApp.

## `@xchain-wallet/test-dapp`

This private reference dApp depends only on `@xchain-wallet/bridge-spec` through a workspace link. It exercises the `window.xchain` bridge surface with the shared types and runtime helpers.

## Review cadence

- **On pushes and pull requests to `develop` and `master`**: CI performs a frozen install and audits production dependencies at high severity.
- **Weekly**: a separate scheduled job checks the Electron lockfile version against the wallet's Electron patch and major-version cadence. It is an alerting job, not a release gate.
- **When a manifest changes**: review the direct runtime inventory and declared ranges on this page together with the lockfile change.

## Floor versions

The manifest range is the compatibility declaration. The locked version is the exact selection in `pnpm-lock.yaml` on the wallet's `origin/develop` branch. Repeated shell dependencies are listed once when every declaring workspace uses the same range.

| Package | Declared range | Locked version |
|---|---:|---:|
| `@noble/ciphers` | `^1.0.0` | `1.3.0` |
| `@noble/curves` | `^1.9.0` | `1.9.7` |
| `@noble/hashes` | `^1.8.0` | `1.8.0` |
| `@scure/base` | `^1.1.9` | `1.2.6` |
| `@scure/bip32` | `^1.5.0` | `1.7.0` |
| `@scure/bip39` | `^1.4.0` | `1.6.0` |
| `intl-messageformat` | `^11.2.12` | `11.2.12` |
| `lightweight-charts` | `^4.2.0` | `4.2.3` |
| `lucide-react` | `^1.16.0` | `1.16.0` |
| `pako` | `^1.0.11` | `1.0.11` |
| `qrcode` | `^1.5.4` | `1.5.4` |
| `react` | `^18.3.0` | `18.3.1` |
| `react-dom` | `^18.3.0` | `18.3.1` |
| `@ledgerhq/hw-app-btc` | `^10.21.0` | `10.21.1` |
| `@ledgerhq/hw-transport-webhid` | `^6.35.0` | `6.35.1` |
| `electron-updater` | `^6.8.9` | `6.8.9` |
| `openpgp` | `^6.3.1` | `6.3.1` |
| `undici` | `^8.10.2` | `8.11.2` |
| `xchain-sdk` | `npm:@dankest-llc/xchain-sdk@0.22.4` | `0.22.4` |
| `@capacitor/android` | `^8.5.1` | `8.5.2` |
| `@capacitor/core` | `^8.5.1` | `8.5.2` |
| `@capacitor/ios` | `^8.5.1` | `8.5.2` |
| `electron` | `^44.7.0` | `44.7.0` |

Native mobile declarations use their platform lock and build files rather than `pnpm-lock.yaml`:

| Platform dependency | Declaration |
|---|---:|
| Android minimum, compile, and target SDK | `26`, `36`, `36` |
| AndroidX AppCompat | `1.7.1` |
| AndroidX CoordinatorLayout | `1.3.0` |
| AndroidX Core Splashscreen | `1.2.0` |
| AndroidX Biometric | `1.1.0` |
| Bouncy Castle `bcprov-jdk18on` | `1.86` |
| Capacitor Swift package | exact `8.5.0` |
| iOS deployment target | `16` |
| Vendored Argon2 reference implementation | tag `20190702`, commit `62358ba2123abd17fccf2a108a301d4b52c01a7c` |

Internal workspace links use `workspace:*`; the shipped private workspaces are versioned `0.341.3`. The committed lockfile resolves those links to their sibling workspace directories.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
