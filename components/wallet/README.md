<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2026 Dankest, LLC -->

# XChain Platform Wallet

## What is xchain-wallet

xchain-wallet is the reference self-custodial wallet for the XChain Platform. It runs as a browser web app, a Chrome MV3 extension (popup + full-screen), and a desktop application (Windows / macOS / Linux) — all from a single React codebase published as a pnpm workspace. The wallet supports Bitcoin, Dogecoin, and Litecoin at launch, with additional chains added as the platform adds them. It consumes [xchain-sdk](../sdk/) as its only data and signing layer and never duplicates SDK functionality.

The wallet implements every XChain feature exposed by the platform: all 29 ACTION types, a built-in DEX surface, encrypted messaging (ECIES / ECDH / AES), smart contracts, BTC staking + delegation, classical n-of-m + MuSig2 multisig, cross-chain flows, dispensers, a `window.xchain` dApp bridge, and air-gapped PSBT signing via animated QR transport.

## Features

- **Three shells, one codebase** — `@xchain-wallet/web` (Vite SPA, mobile-responsive), `@xchain-wallet/extension` (Chrome MV3 popup + full-screen + service worker), `@xchain-wallet/desktop` (Electron, main-process signing isolation); all share `@xchain-wallet/core` for routes, components, flows, and signers
- **All 29 XChain ACTIONs** — SEND, ISSUE, MINT, DESTROY, ORDER, DISPENSER, DIVIDEND, SWEEP, SWAP, AIRDROP, MESSAGE, LIST, LINK, BROADCAST, ADDRESS, BATCH, DEPLOY, EXECUTE, DEPOSIT, WITHDRAW, COINPAY, STAKE, UNSTAKE, DELEGATE, REVOKE_DELEGATION, CLAIM_REWARDS, CALLBACK, SLEEP, FILE
- **Self-custodial key management** — BIP39 mnemonic + optional 25th-word passphrase, BIP32 HD derivation per chain, AES-256-GCM vault encrypted with an Argon2id-derived master key (calibrated per device), Counterwallet legacy mnemonic import
- **Pluggable signer interface** — `SoftwareSigner` (in-vault keys), `TrezorSigner` (Trezor Connect), `LedgerSigner` (WebHID), `RemoteSigner` (cross-shell pairing), `MultisigSigner` (classical n-of-m + MuSig2)
- **Token issuance suite** — issue / mint / destroy / distribute / dividend / dispenser / broadcast / airdrop / sweep, with parsed-recipient previews and dry-run review
- **DEX surface** — markets list, market view with lightweight-charts price chart, place-order panel, orderbook, recent trades, open orders, trade history
- **Encrypted messaging inbox** — ECIES (default, multi-device), ECDH (session), AES (pre-shared); compose flow handles pubkey lookup + encryption + sign + broadcast in one step
- **Smart contracts** — deploy from source, execute methods, deposit and withdraw, contracts-list / contract-detail explorer views, gas estimation, ContractClient bindings
- **BTC staking + delegation** — stake / unstake / delegate / revoke-delegation / claim-rewards; staking dashboard, delegation form, operator dashboard
- **Cross-chain flows** — cross-chain swap form, cross-chain templates, parallel composer for atomic multi-chain submission, per-chain SDK registry
- **Multisig coordinator** — create n-of-m configs, paste-inbox for partial PSBTs, AnimatedQrFrames PSBT-QR transport, session state machine, MuSig2 round labels, per-address multi-config support, camera scanner
- **dApp bridge (`window.xchain`)** — typed bridge spec at `@xchain-wallet/bridge-spec`: connect, getAccounts, getBalances, signMessage, signPsbt, signAction, sendAction, signIn (Sign-In with XChain), event subscriptions; per-origin permission grants enforced in the extension service worker and desktop main process
- **Air-gapped PSBT signing** — BIP21 / multisig PSBT envelope / chunked PSBT-QR; QR scanner + AnimatedQrFrames for offline cosigner round-trips; `prefers-reduced-motion` honored with manual frame stepping
- **Sign-screen safety rails** — plain-English action decoder shows `to` / `amount` / `asset` as the user typed them, even if the encoder fabricates output; per-action expectation summaries; explicit user confirmation
- **Onboarding and recovery** — create / import / Counterwallet-migrate / dry-run-restore / discover-used-addresses gap-limit scan; view-private-key + export-WIF gated behind password re-entry
- **Lock / unlock / auto-lock** — Argon2id-derived session key cached in `chrome.storage.session` (extension) or in-memory (web/desktop); foreground auto-lock; manual lock action; OS keychain auto-unlock on desktop
- **i18n + a11y** — string registry under `core/src/i18n`; static a11y audit gate (button label / img alt / input label / textarea label / div-onclick role+tabIndex) blocks regressions in CI; WCAG 2.2 AA target for the external audit
- **Reproducible builds** — Level-2 reproducibility of the pre-signing Linux desktop bundle: digest-pinned base image, frozen lockfile, `SOURCE_DATE_EPOCH` from `git log`, `RELEASE_HASHES.txt` SHA-256 manifest, 18-rule static repro-build audit
- **URI scheme handling** — registered handlers for `bitcoin:`, `dogecoin:`, `litecoin:`, and `xchain:` URIs across all three shells
- **Connected sites + permissions** — per-origin grant store, revocable from Settings, surfaced in the approval popup before every privileged action

## Documentation

| Document | Description |
|---|---|
| [Architecture](ARCHITECTURE.md) | Repo layout, package boundaries, state flow, three-shell model, core/web/extension/desktop seams |
| [Keys & Signing](Keys_Signing.md) | BIP39 + passphrase, HD derivation, vault encryption, signer interface, software / Trezor / Ledger / Remote / Multisig |
| [Security & Threat Model](SECURITY.md) | Protected assets, in-scope and out-of-scope threats, sign-screen safety rails, audit posture |
| [UX Surfaces](UX.md) | Onboarding, lock/unlock, balances, history, send/receive, sign screens, contacts, QR scanner, command palette, settings |
| [Features](FEATURES.md) | Token issuance, DEX, messaging, dispensers, contracts, staking, multisig, cross-chain — surface-by-surface |
| [Bridge](BRIDGE.md) | `window.xchain` dApp bridge: connect, signMessage, signPsbt, signAction, signIn, events, error codes |
| [URI Schemes](URI_Schemes.md) | BIP21 + chain URIs + multisig PSBT envelope + chunked PSBT-QR transport |
| [Multisig](MULTISIG.md) | Classical n-of-m + MuSig2: create flow, paste inbox, session state machine, PSBT-QR cosigner round-trips |
| [Shell — Extension](Shell_Extension.md) | Chrome MV3 architecture, manifest, service worker, content script, injected provider, approval popup |
| [Shell — Desktop](Shell_Desktop.md) | Electron main / renderer split, OS keychain, WebHID hardware transports, electron-builder packaging, auto-updater |
| [Shell — Web](Shell_Web.md) | Vite SPA, mobile responsiveness, extension-detect banner, session-only key handling |
| [Build & Release](Build_Release.md) | Synchronized versioning, Chrome Web Store submission, electron-builder, signing, release-hashes |
| [Reproducible Builds](Reproducible_Builds.md) | Level-2 reproducibility: scope, scaffolding audit, run-twice verification, drift sources |
| [Testing](TESTING.md) | Smoke gates, Playwright E2E, a11y audit, repro-build audit, manifest audit, bridge-e2e, hw-sign-e2e |
| [Configuration](CONFIGURATION.md) | Per-chain endpoints, custom RPC, signer registration, settings store, developer mode |

## Installation

The wallet is a pnpm workspace. Clone the repo and install workspace dependencies:

```bash
git clone https://github.com/XChain-Platform/xchain-wallet.git
cd xchain-wallet
pnpm install
```

The repository depends on a sibling `xchain-sdk` checkout — both `packages/web/package.json` and `packages/extension/package.json` link `xchain-sdk` from `../../../xchain-sdk`. Clone [xchain-sdk](https://github.com/XChain-Platform/xchain-sdk) next to `xchain-wallet` before installing.

## Quick Start

### Run the web SPA

```bash
pnpm --filter @xchain-wallet/web dev
```

Vite serves the wallet at `http://localhost:5173`. The web shell is mobile-responsive — open it on a phone for the mobile UX while native iOS / Android apps are on the post-launch roadmap.

### Build the Chrome extension

```bash
pnpm --filter @xchain-wallet/extension build
```

`packages/extension/dist/` is the unpacked extension. In Chrome / Edge / Brave, open `chrome://extensions`, enable Developer Mode, click *Load unpacked*, and select `dist/`.

### Run the desktop app

```bash
pnpm --filter @xchain-wallet/desktop start
```

Builds the renderer and launches Electron locally. For packaged releases, see [Build & Release](Build_Release.md).

## Usage Modes

### Browser web app

The web SPA is the lowest-friction entry point — visit a hosted instance, create or import a wallet, and sign locally in the browser. Master keys never leave the browser tab; vault ciphertext is persisted in IndexedDB. The web shell is mobile-responsive.

Web shell key isolation is fundamentally weaker than the extension's — same-origin scripts on `wallet.xchain.io` could in principle access in-memory key material. Mitigations: short session lifetime (in-memory only; refresh = re-locked), no master key in `sessionStorage`, no third-party `<script>` tags. Power users on extreme threat models should prefer the extension or desktop shells.

### Chrome MV3 extension

The extension provides MetaMask-style UX: a popup launched from the toolbar, a full-screen view for power-user workflows, an isolated content script that injects `window.xchain` into pages, and a service worker that owns the vault and signers. All sensitive operations (unlock, sign, approval) run in extension-origin pages so page chrome cannot read or tamper with them.

The extension's manifest version follows wallet semver via a derive rule (`packages/core/scripts/derive-extension-version.js`) and is gated by an 11-rule static audit (`extension-manifest-audit.js`) on every commit.

### Desktop application

The desktop shell uses Electron with a hard main / renderer split (§9.3.2):

- **Main process** owns the Vault, the SDK instance, and all signers. Keys never cross the IPC boundary into the renderer.
- **Renderer process** runs the same React app from `@xchain-wallet/core` and talks to main via a preload-exposed `window.xchainWalletBridge.sendMessage(message)`.

Builds target Windows, macOS, and Linux via electron-builder. The pre-signing Linux artifact is Level-2 reproducible — see [Reproducible Builds](Reproducible_Builds.md).

### dApp integration

Third-party dApps integrate via the `window.xchain` provider injected by the extension (and exposed equivalently by the desktop shell). Consume the typed `@xchain-wallet/bridge-spec` package for full TypeScript types of every method, parameter, and result envelope. See [Bridge](BRIDGE.md) for the full API.

## Repository Layout

```
xchain-wallet/
├── package.json                 workspace root, single source of truth for version
├── pnpm-workspace.yaml          packages/* + e2e
├── tsconfig.base.json           shared TS config (JS + JSDoc throughout)
├── packages/
│   ├── core/                    React components, state, flows, signers, schemas, SDK integration
│   ├── web/                     browser SPA shell (Vite)
│   ├── extension/               Chrome MV3 extension shell
│   ├── desktop/                 Electron desktop shell
│   ├── bridge-spec/             window.xchain TypeScript type definitions
│   └── test-dapp/               reference dApp exercising the bridge
├── tools/
│   └── build-reproduce/         reproducible-build helper scripts
├── e2e/                         Playwright E2E suite (web shell)
├── docs/                        in-repo architecture + threat-model + dependency notes
├── CHANGELOG.md                 Keep a Changelog format; root is authoritative
└── LICENSE.md / NOTICE.md       Dankest Community License
```

All packages ship at the **same version**. Every shell's About screen surfaces its own `package.json.version` so users can verify all shells came from the same codebase.

## Status

Pre-v1.0 release-candidate (`1.0.0-rc.6`). All four implementation phases — Phase 1 (framework), Phase 2 (issuance + hardware), Phase 3 (DEX + messaging), Phase 4 (contracts + staking + cross-chain + multisig) — are closed. The autonomous portion of the §56.3 pre-launch track is also closed; three user-driven items remain before v1.0.0 GA: external security audit, external accessibility audit, and Chrome Web Store submission. Audit-readiness packets ship with the repo.

## Scripts

Root scripts run across all packages via `pnpm -r`:

| Command | Description |
|---|---|
| `pnpm test` | Run every package's tests |
| `pnpm build` | Build every shell's production artifact |
| `pnpm typecheck` | Run package-level typecheck where defined |
| `pnpm lint` | Run package-level lint where defined |

Per-package scripts (run with `pnpm --filter <pkg> <script>`):

| Package | Command | Description |
|---|---|---|
| `@xchain-wallet/core` | `test` | Vitest smoke suite |
| `@xchain-wallet/web` | `dev` | Vite dev server |
| `@xchain-wallet/web` | `build` | Production SPA bundle |
| `@xchain-wallet/extension` | `build` | Production MV3 build |
| `@xchain-wallet/extension` | `dev` | Watch-mode build |
| `@xchain-wallet/desktop` | `start` | Run Electron locally |
| `@xchain-wallet/desktop` | `dist` | Signed installers per platform |
| `@xchain-wallet/desktop` | `dist:unpacked` | Pre-signing Linux bundle (reproducible target) |
| `@xchain-wallet/desktop` | `reproduce` | Rebuild and verify against `RELEASE_HASHES.txt` |
| `@xchain-wallet/e2e` | `test` | Playwright E2E suite |

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `xchain-sdk` | The wallet's only data and signing layer — actions, encoder, explorer, hub, WebSocket |
| `react` / `react-dom` | UI framework |
| `@noble/hashes` | SHA-256, SHA-512, HMAC, Argon2id, PBKDF2 — wallet KDF + commitment + integrity |
| `@noble/ciphers` | AES-256-GCM for the vault |
| `@scure/base` | base58check for WIF + address parsing |
| `@scure/bip32` | BIP32 HD derivation |
| `@scure/bip39` | BIP39 mnemonic generation, validation, seed derivation |
| `qrcode` | QR-code rendering for receive, multisig PSBT-QR, sign-in challenges |
| `lightweight-charts` | DEX market-view price chart |
| `@trezor/connect-web` | Trezor signer transport |
| `@ledgerhq/hw-app-btc` | Ledger Bitcoin app interface |
| `@ledgerhq/hw-transport-webhid` | Ledger WebHID transport |
| `electron` | Desktop shell runtime (desktop only) |
| `electron-updater` | Desktop auto-updater (desktop only) |

### Development

| Package | Purpose |
|---|---|
| `vitest` | Smoke test runner with v8 coverage |
| `@testing-library/react` | React render helpers for smokes |
| `vite` | Dev server + production bundler for web / extension / desktop renderer |
| `@vitejs/plugin-react` | React fast-refresh + JSX transform |
| `vite-plugin-node-polyfills` | Node-builtin polyfills for the browser |
| `electron-builder` | Desktop installer packaging |
| `playwright` | E2E test runner (web shell) |
| `@axe-core/playwright` | Automated WCAG 2.1 A/AA scan inside Playwright |

See `docs/DEPENDENCIES.md` in the wallet repo for the per-package "why we depend on this" review.

---

**Copyright &copy; 2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
