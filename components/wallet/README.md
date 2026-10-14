<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# XChain Platform Wallet

## What is xchain-wallet

xchain-wallet is the reference self-custodial wallet for the XChain Platform. It runs as a browser web app, a Chrome MV3 extension (popup + full-screen + side panel), a desktop application (Windows / macOS / Linux), and a Capacitor mobile app with Android and iOS projects, all from a single React codebase organized as a pnpm workspace. The wallet supports Bitcoin, Litecoin, and Dogecoin, with additional chains loaded from the hub's signed chain registry. It uses [xchain-sdk](../sdk/) for protocol actions, transaction construction, and chain services, while wallet-owned signer implementations keep signing keys either encrypted in the local vault or on a hardware device.

The wallet exposes all 32 current user-encodable ACTION types, a built-in DEX surface, ECIES and ECDH encrypted messaging, smart contracts, staking and delegation, classical n-of-m and MuSig2 multisig coordination, cross-chain flows, dispensers, parimutuel betting markets, on-chain governance voting, an extension-provided `window.xchain` dApp bridge, and air-gapped PSBT signing via animated QR transport.

## Features

- **Four shells, one codebase**: `@xchain-wallet/web` (Vite SPA, mobile-responsive), `@xchain-wallet/extension` (Chrome MV3 popup + full-screen + side panel + service worker), `@xchain-wallet/desktop` (Electron with main-process vault and signing-host isolation), `@xchain-wallet/mobile` (Capacitor wrapper of the built web SPA with Android and iOS native projects); all use `@xchain-wallet/core` for routes, components, flows, and signer contracts
- **All 32 user-encodable ACTIONs** (every action has an authoring form; `PROTOCOL_ONLY_ACTIONS` is empty): ADDRESS, AIRDROP, BATCH, BET, BROADCAST, CALLBACK, COINPAY, COLLECT, DELEGATE, DEPLOY, DEPOSIT, DESTROY, DISPENSER, DIVIDEND, EXECUTE, FILE, ISSUE, LINK, LIST, MESSAGE, MINT, ORDER, PRICE, SEND, SLEEP, STAKE, SWAP, SWEEP, UNSTAKE, VOTE, WITHDRAW, XBRIDGE. COLLECT is BTC-only; the other 31 are offered on all three chains
- **Self-custodial key management**: BIP39 mnemonic + optional 25th-word passphrase (captured once at setup and stored encrypted alongside the mnemonic), BIP32 HD derivation per chain, AES-256-GCM vault encrypted with an Argon2id-derived master key (calibrated per device), Counterwallet legacy mnemonic import
- **Pluggable signer interface**: four concrete signers, `SoftwareSigner` (in-vault keys), `TrezorSigner` (the hosted Trezor Connect build in the web and desktop shells), `LedgerSigner` (WebHID), and `RemoteSigner` (an in-shell bridge that lets background flows reach a Trezor or Ledger signer running in the UI; it does not pair separate devices or shells). The MV3 extension does not load Trezor's remote script, and store-profile mobile builds expose no hardware-signer path. Multisig (classical n-of-m + MuSig2) is coordinated by flows over the available signers; a dedicated `MultisigSigner` class is not implemented
- **Token issuance suite**: issue / mint / destroy / distribute / dividend / dispenser / broadcast / airdrop / sweep, with parsed-recipient previews and dry-run review
- **DEX surface**: markets list, market view with lightweight-charts price chart, place-order panel, orderbook, recent trades, open orders, trade history
- **Encrypted messaging inbox**: ECIES (default, multi-device) and ECDH (shared-session) compose and decrypt flows; the inbox recognizes AES pre-shared-key records but has no AES key-entry or send surface. The compose flow handles pubkey lookup, encryption, signing, and broadcast
- **Smart contracts**: deploy from source, execute methods through the manual form or ABI-derived named and typed inputs, deposit and withdraw, contracts-list / contract-detail explorer views, and gas-limit validation and suggestions
- **Staking + delegation**: STAKE / UNSTAKE / DELEGATE contract versions are offered across supported chains; validator and capability versions plus COLLECT rewards are Bitcoin-only. The wallet includes the staking dashboard, delegation form, and operator dashboard
- **Cross-chain flows**: single-fill cross-chain swaps, federation-matched cross-chain orders, cross-chain templates, a parallel composer for multi-chain submission, a per-chain SDK registry, and link / swap coordinators
- **Multisig coordinator**: create n-of-m configs, paste-inbox for partial PSBTs, AnimatedQrFrames PSBT-QR transport, session state machine, MuSig2 round labels, schema-v2 per-address multi-config support, camera scanner, and cosigner account provisioning
- **dApp bridge (`window.xchain`)**: the extension injects a provider typed by `@xchain-wallet/bridge-spec`: connect, getAccounts, getBalances, signMessage, signPsbt, signAction, signIn (Sign-In with XChain), and event subscriptions; the extension service worker enforces per-origin permission grants
- **Air-gapped PSBT signing**: BIP21 / multisig PSBT envelope / chunked PSBT-QR; QR scanner + AnimatedQrFrames for offline cosigner round-trips; `prefers-reduced-motion` honored with manual frame stepping
- **Sign-screen safety rails**: plain-English action decoder shows `to` / `amount` / `asset` as the user typed them, even if the encoder fabricates output; per-action expectation summaries; explicit user confirmation
- **Onboarding and recovery**: create / import / Counterwallet-migrate / dry-run-restore / discover-used-addresses gap-limit scan; view-private-key + export-WIF gated by a "Before you continue" warning in an unlocked session (no password re-entry; a locked wallet must be unlocked first)
- **Lock / unlock / auto-lock**: Argon2id-derived session key cached in `chrome.storage.session` together with a signing-capable copy of the password (extension), an OS-keychain-encrypted file plus an in-memory copy (desktop when a keychain backend is available), or memory only (web and desktop without a keychain); foreground auto-lock, background auto-lock backstops in the extension and desktop, a manual lock action, and OS keychain auto-unlock on desktop
- **i18n + a11y**: string registry under `packages/core/src/i18n`; static a11y audit gate (button label / img alt / input label / textarea label / div-onclick role+tabIndex) blocks regressions in CI; WCAG 2.2 AA target for the external audit
- **Reproducible builds**: Level-2 reproducibility of the pre-signing Linux desktop bundle: digest-pinned base image, frozen lockfile, `SOURCE_DATE_EPOCH` from `git log`, `RELEASE_HASHES.txt` SHA-256 manifest, and a 19-rule static repro-build audit
- **URI scheme handling**: desktop and mobile register handlers for `bitcoin:`, `dogecoin:`, `litecoin:`, and `xchain:` URIs; the web shell registers `web+xchain:` and attempts `xchain:` where the browser allows it; the extension registers `web+xchain:`
- **Automatic Donation System (ADS)**: opt-out micro-donation appended to each submitted action; consent captured at onboarding; configurable per chain in Settings; invisible in normal use with no extra line on sign screens
- **Connected sites + permissions**: the extension keeps a per-origin grant store, revocable from Settings, and surfaces approval UI for privileged dApp requests

## Documentation

| Document | Description |
|---|---|
| [Architecture](architecture.md) | Repo layout, package boundaries, state flow, four-shell model, core/web/extension/desktop/mobile seams |
| [Keys & Signing](keys-signing.md) | BIP39 + passphrase, HD derivation, vault encryption, software / Trezor / Ledger / Remote signers, multisig coordination |
| [Security & Threat Model](security.md) | Protected assets, in-scope and out-of-scope threats, sign-screen safety rails, audit posture |
| [UX Surfaces](ux.md) | Onboarding, lock/unlock, balances, history, send/receive, sign screens, contacts, QR scanner, command palette, settings |
| [UI Style Guide](ui-style-guide.md) | Contributor rules for page layout, responsive control sizing, vertical rhythm, templates, and shared UI components |
| [Features](features.md) | Token issuance, DEX, messaging, dispensers, contracts, staking, multisig, cross-chain: surface-by-surface |
| [Bridge](bridge.md) | `window.xchain` dApp bridge: connect, signMessage, signPsbt, signAction, signIn, events, error codes |
| [URI Schemes](uri-schemes.md) | BIP21 + chain URIs + multisig PSBT envelope + chunked PSBT-QR transport |
| [Multisig](multisig.md) | Classical n-of-m + MuSig2: create flow, paste inbox, session state machine, PSBT-QR cosigner round-trips |
| [Shell; Extension](shell-extension.md) | Chrome MV3 architecture, manifest, service worker, content script, injected provider, approval popup |
| [Shell; Desktop](shell-desktop.md) | Electron main / renderer split, OS keychain, WebHID hardware transports, electron-builder packaging, auto-updater |
| [Shell; Web](shell-web.md) | Vite SPA, mobile responsiveness, extension-detect banner, session-only key handling |
| [Build & Release](build-release.md) | Synchronized versioning, Chrome Web Store submission, electron-builder, signing, release-hashes |
| [Reproducible Builds](reproducible-builds.md) | Level-2 reproducibility: scope, scaffolding audit, run-twice verification, drift sources |
| [Testing](testing.md) | Smoke gates, Playwright E2E, a11y audit, repro-build audit, manifest audit, bridge-e2e, hw-sign-e2e |
| [Configuration](configuration.md) | Per-chain endpoints, custom RPC, signer registration, settings store, developer mode |
| [Threat Model](threat-model.md) | Attacker-scenario walkthroughs, known open risks, verification cadence; complements Security |
| [Glossary](glossary.md) | Wallet and protocol terminology used across these pages |
| [Dependencies](dependencies.md) | Why each runtime dependency exists and what it is trusted with |
| [Release Engineering](release/README.md) | Lane index: desktop installers, Chrome Web Store, Google Play, App Store, verify-release, QA checklist, CI setup |
| [Privacy](privacy/privacy-policy.md) | Privacy policy plus store collateral: data collection, Play data safety, Apple nutrition labels, Chrome disclosure, trader identity, export compliance |

## Installation

The wallet is a pnpm 11 workspace and requires Node.js 22 or later. Clone the repo and install workspace dependencies:

```bash
git clone https://github.com/XChain-Platform/xchain-wallet.git
cd xchain-wallet
pnpm install
```

No sibling SDK checkout is required. The web, extension, and desktop packages install `npm:@dankest-llc/xchain-sdk@0.22.4` under the local package name `xchain-sdk`, and the lockfile pins the release dependency. For simultaneous SDK development, `pnpm run sdk:link` links a checkout at `../xchain-sdk` by default, `pnpm run sdk:status` reports what each shell resolves, and `pnpm run sdk:unlink` restores the published package.

## Quick Start

### Run the web SPA

```bash
pnpm --filter @xchain-wallet/web dev
```

Vite serves the wallet at `http://localhost:5173`. The web shell is mobile-responsive; open it on a phone for the mobile UX. The `@xchain-wallet/mobile` package wraps the same production web build and contains the native Android and iOS projects.

### Build the Chrome extension

```bash
pnpm --filter @xchain-wallet/extension build
```

`packages/extension/dist/` is the unpacked extension. In Chrome / Edge / Brave, open `chrome://extensions`, enable Developer Mode, click *Load unpacked*, and select `dist/`.

### Run the desktop app

```bash
pnpm --filter @xchain-wallet/desktop start
```

Builds the renderer and launches Electron locally. For packaged releases, see [Build & Release](build-release.md).

## Usage Modes

### Browser web app

The web SPA is the lowest-friction entry point: visit a hosted instance, create or import a wallet, and sign locally in the browser. Master keys never leave the browser page; vault ciphertext is persisted in IndexedDB. The web shell is mobile-responsive.

Web shell key isolation is fundamentally weaker than the extension's: scripts running in the wallet page can in principle access in-memory key material. Mitigations include a short in-memory session lifetime, refresh-to-lock behavior, no master key in `sessionStorage`, and a restrictive CSP. Pairing a Trezor loads Trezor's hosted Connect script on demand from the single allowlisted Trezor origin; the mobile store profile removes that script and frame allowance. Users who require stronger process isolation should prefer the extension or desktop shells.

### Chrome MV3 extension

The extension provides MetaMask-style UX: a popup launched from the toolbar, a full-screen view for power-user workflows, a side panel (Chrome's persistent sidebar, toggleable from Settings), an isolated content script that injects `window.xchain` into pages, and a service worker that owns the vault and signing host. Live hardware signer objects run in extension-origin UI and communicate with the service worker over a constrained signer port. Unlock, signing, and approval UI remain in extension-origin pages so website scripts cannot read or alter them.

The extension's manifest version follows wallet semver via `packages/core/scripts/derive-extension-version.js` and is gated by an 18-rule static audit in `extension-manifest-audit.js`.

### Desktop application

The desktop shell uses Electron with a hard main / renderer split (§9.3.2):

- **Main process** owns the vault, SDK-backed message host, software signing operations, file storage, auto-lock backstop, and keychain session cache.
- **Renderer process** runs the React app from `@xchain-wallet/core`. Ledger and Trezor signer objects run there because their browser transports require it, but the private keys remain on the devices. A constrained preload exposes `window.xchainWalletBridge.sendMessage(message)` and a separate hardware-signer message port.

Builds target Windows, macOS, and Linux via electron-builder. The pre-signing Linux artifact is Level-2 reproducible (see [Reproducible Builds](reproducible-builds.md)).

### dApp integration

Third-party dApps integrate via the `window.xchain` provider injected by the extension. The desktop preload's `window.xchainWalletBridge` is an internal renderer-to-main API, not the public dApp provider. Consume the typed `@xchain-wallet/bridge-spec` package for full TypeScript types of every public method, parameter, and result envelope. See [Bridge](bridge.md) for the full API.

## Repository Layout

```
xchain-wallet/
├── package.json                 workspace root, single source of truth for version
├── pnpm-workspace.yaml          packages/* + test/e2e
├── tsconfig.base.json           shared TS config (JS + JSDoc throughout)
├── packages/
│   ├── core/                    React components, state, flows, signers, schemas, SDK integration
│   ├── web/                     browser SPA shell (Vite)
│   ├── extension/               Chrome MV3 extension shell (popup + full-screen + side panel)
│   ├── desktop/                 Electron desktop shell (Windows / macOS / Linux)
│   ├── mobile/                  Capacitor Android / iOS shell wrapping the web build
│   ├── bridge-spec/             window.xchain TypeScript type definitions
│   ├── signers-ledger/          Ledger hardware signer (WebHID transport)
│   ├── signers-trezor/          Trezor hardware signer (Connect transport)
│   └── test-dapp/               reference dApp exercising the bridge
├── tools/
│   ├── build-reproduce/         reproducible-build helper scripts
│   ├── release/                 release signing and verification pipeline
│   ├── regtest/                 local regtest helpers
│   ├── glossary/                documentation glossary generator
│   ├── dev/                     local SDK linking helpers
│   └── eslint/                  repository ESLint plugin and rules
├── test/
│   └── e2e/                     Playwright E2E suite (web shell)
├── CHANGELOG.md                 Keep a Changelog format; root is authoritative
└── LICENSE.md / NOTICE.md       GNU Affero General Public License v3.0 (AGPL-3.0)
```

Every package under `packages/` ships at the **same version**. The private `test/e2e` workspace is exempt. Each user-facing shell surfaces its package version so users can verify that the builds came from the same codebase.

## Status

Pre-v1.0 (`0.341.3`). All four implementation phases, Phase 1 (framework), Phase 2 (issuance + hardware), Phase 3 (DEX + messaging), and Phase 4 (contracts + staking + cross-chain + multisig), are closed. The autonomous portion of the §56.3 pre-launch track is also closed; three user-driven items remain before v1.0.0 GA: external security audit, external accessibility audit, and Chrome Web Store submission. Audit-readiness packets ship with the repo.

## Scripts

The root exposes aggregate build, lint, typecheck, and test commands:

| Command | Description |
|---|---|
| `pnpm test` | Run the unit, fuzz, smoke, and tool-test suites |
| `pnpm build` | Run every package `build` script that is defined |
| `pnpm typecheck` | Run package-level typecheck where defined |
| `pnpm lint` | Run package-level lint where defined |

Selected root and package scripts (package scripts run with `pnpm --filter <pkg> <script>`):

| Package | Command | Description |
|---|---|---|
| root | `test:unit` | Vitest unit suite |
| root | `test:smoke` | Plain Node smoke runner |
| root | `test:integration` | Vitest integration suite |
| `@xchain-wallet/web` | `dev` | Vite dev server |
| `@xchain-wallet/web` | `build` | Production SPA bundle |
| `@xchain-wallet/web` | `preview` | Serve the production bundle locally |
| `@xchain-wallet/extension` | `build` | Production MV3 build |
| `@xchain-wallet/extension` | `dev` | Watch-mode build |
| `@xchain-wallet/desktop` | `start` | Run Electron locally |
| `@xchain-wallet/desktop` | `dist` | Build installers via electron-builder; signing depends on configured credentials |
| `@xchain-wallet/desktop` | `dist:unpacked` | Pre-signing Linux bundle (reproducible target) |
| `@xchain-wallet/desktop` | `reproduce` | Rebuild and verify against `RELEASE_HASHES.txt` |
| `@xchain-wallet/mobile` | `sync` | Stage the web build and run `cap sync android` |
| `@xchain-wallet/mobile` | `sync:ios` | Stage the web build and run `cap sync ios` |
| `@xchain-wallet/e2e` | `test` | Playwright E2E suite |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `xchain-sdk` | Published SDK alias used by the web, extension, and desktop shells for actions, transaction construction, explorer, hub, and WebSocket access |
| `react` / `react-dom` | UI framework |
| `@noble/hashes` | SHA-256, SHA-512, HMAC, Argon2id, PBKDF2: wallet KDF + commitment + integrity |
| `@noble/ciphers` | AES-256-GCM for the vault |
| `@noble/curves` | Ed25519 verification for remote chain registries and secp256k1 multisig utilities |
| `@scure/base` | base58check for WIF + address parsing |
| `@scure/bip32` | BIP32 HD derivation |
| `@scure/bip39` | BIP39 mnemonic generation, validation, seed derivation |
| `intl-messageformat` | Localized message formatting |
| `lucide-react` | UI icons |
| `pako` | BBQR payload compression |
| `qrcode` | QR-code rendering for receive, multisig PSBT-QR, sign-in challenges |
| `lightweight-charts` | DEX market-view price chart |
| `@ledgerhq/hw-app-btc` | Ledger Bitcoin app interface |
| `@ledgerhq/hw-transport-webhid` | Ledger WebHID transport |
| Hosted Trezor Connect | Trezor transport loaded on demand by web and desktop; `@trezor/connect-web` is deliberately not bundled or declared as a package dependency |
| `@capacitor/core` / `@capacitor/android` / `@capacitor/ios` | Native mobile shell and platform projects |
| `electron` | Desktop shell runtime (desktop only) |
| `electron-updater` | Desktop auto-updater (desktop only) |
| `openpgp` | Desktop update signature verification |
| `undici` | Desktop network dispatch and Tor proxy routing |

### Development

| Package | Purpose |
|---|---|
| `vitest` | Unit, integration, fuzz, security, boundary, regression, a11y, and related suites, with optional v8 coverage |
| `@testing-library/react` | React render helpers for Vitest suites |
| `vite` | Dev server + production bundler for web / extension / desktop renderer |
| `@vitejs/plugin-react` | React fast-refresh + JSX transform |
| `vite-plugin-node-polyfills` | Node-builtin polyfills for the browser |
| `electron-builder` | Desktop installer packaging |
| `@playwright/test` | E2E test runner for web, regtest, and extension projects |
| `@axe-core/playwright` | Automated WCAG 2.1 A/AA scan inside Playwright |

See [Dependencies](dependencies.md) for the per-package "why we depend on this" review.

---

**Copyright &copy; 2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
