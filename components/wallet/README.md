<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# XChain Platform Wallet

## What is xchain-wallet

xchain-wallet is the reference self-custodial wallet for the XChain Platform. It runs as a browser web app, a Chrome MV3 extension (popup + full-screen + side panel), a desktop application (Windows / macOS / Linux), and a Capacitor mobile app (Android now, iOS later), all from a single React codebase published as a pnpm workspace. The wallet supports Bitcoin, Litecoin, and Dogecoin at launch, with additional chains added as the platform adds them. It consumes [xchain-sdk](../sdk/) as its only data and signing layer and never duplicates SDK functionality.

The wallet implements every XChain feature exposed by the platform: all 31 user-encodable ACTION types, a built-in DEX surface, encrypted messaging (ECIES / ECDH / AES), smart contracts, BTC staking + delegation, classical n-of-m + MuSig2 multisig, cross-chain flows, dispensers, parimutuel betting markets, on-chain governance voting, a `window.xchain` dApp bridge, and air-gapped PSBT signing via animated QR transport.

## Features

- **Four shells, one codebase**: `@xchain-wallet/web` (Vite SPA, mobile-responsive), `@xchain-wallet/extension` (Chrome MV3 popup + full-screen + side panel + service worker), `@xchain-wallet/desktop` (Electron, main-process signing isolation), `@xchain-wallet/mobile` (Capacitor wrapper of the built web SPA; Android shipped, iOS later); all share `@xchain-wallet/core` for routes, components, flows, and signers
- **All 31 user-encodable ACTIONs** (every action has an authoring form; `PROTOCOL_ONLY_ACTIONS` is empty): ADDRESS, AIRDROP, BATCH, BET, BROADCAST, CALLBACK, COINPAY, COLLECT, DELEGATE, DEPLOY, DEPOSIT, DESTROY, DISPENSER, DIVIDEND, EXECUTE, FILE, ISSUE, LINK, LIST, MESSAGE, MINT, ORDER, PRICE, SEND, SLEEP, STAKE, SWAP, SWEEP, UNSTAKE, VOTE, WITHDRAW. COLLECT, DEPLOY, and EXECUTE are BTC-only; the other 28 are offered on all three chains
- **Self-custodial key management**: BIP39 mnemonic + optional 25th-word passphrase (captured once at setup and stored encrypted alongside the mnemonic), BIP32 HD derivation per chain, AES-256-GCM vault encrypted with an Argon2id-derived master key (calibrated per device), Counterwallet legacy mnemonic import
- **Pluggable signer interface**: four concrete signers, `SoftwareSigner` (in-vault keys), `TrezorSigner` (Trezor Connect), `LedgerSigner` (WebHID), and `RemoteSigner` (cross-shell pairing). Multisig (classical n-of-m + MuSig2) is orchestrated by flows over these signers rather than by a signer of its own; a dedicated `MultisigSigner` is planned but not implemented
- **Token issuance suite**: issue / mint / destroy / distribute / dividend / dispenser / broadcast / airdrop / sweep, with parsed-recipient previews and dry-run review
- **DEX surface**: markets list, market view with lightweight-charts price chart, place-order panel, orderbook, recent trades, open orders, trade history
- **Encrypted messaging inbox**: ECIES (default, multi-device), ECDH (session), AES (pre-shared); compose flow handles pubkey lookup + encryption + sign + broadcast in one step
- **Smart contracts**: deploy from source, execute methods, deposit and withdraw, contracts-list / contract-detail explorer views, gas estimation, ContractClient bindings
- **BTC staking + delegation**: stake / unstake / delegate (rotate or revoke) / collect rewards; staking dashboard, delegation form, operator dashboard
- **Cross-chain flows**: cross-chain swap form, cross-chain templates, parallel composer for atomic multi-chain submission, per-chain SDK registry
- **Multisig coordinator**: create n-of-m configs, paste-inbox for partial PSBTs, AnimatedQrFrames PSBT-QR transport, session state machine, MuSig2 round labels, per-address multi-config support, camera scanner
- **dApp bridge (`window.xchain`)**: typed bridge spec at `@xchain-wallet/bridge-spec`: connect, getAccounts, getBalances, signMessage, signPsbt, signAction, signIn (Sign-In with XChain), event subscriptions; per-origin permission grants enforced in the extension service worker and desktop main process
- **Air-gapped PSBT signing**: BIP21 / multisig PSBT envelope / chunked PSBT-QR; QR scanner + AnimatedQrFrames for offline cosigner round-trips; `prefers-reduced-motion` honored with manual frame stepping
- **Sign-screen safety rails**: plain-English action decoder shows `to` / `amount` / `asset` as the user typed them, even if the encoder fabricates output; per-action expectation summaries; explicit user confirmation
- **Onboarding and recovery**: create / import / Counterwallet-migrate / dry-run-restore / discover-used-addresses gap-limit scan; view-private-key + export-WIF gated behind password re-entry
- **Lock / unlock / auto-lock**: Argon2id-derived session key cached in `chrome.storage.session` (extension) or in-memory (web/desktop); foreground auto-lock; manual lock action; OS keychain auto-unlock on desktop
- **i18n + a11y**: string registry under `core/src/i18n`; static a11y audit gate (button label / img alt / input label / textarea label / div-onclick role+tabIndex) blocks regressions in CI; WCAG 2.2 AA target for the external audit
- **Reproducible builds**: Level-2 reproducibility of the pre-signing Linux desktop bundle: digest-pinned base image, frozen lockfile, `SOURCE_DATE_EPOCH` from `git log`, `RELEASE_HASHES.txt` SHA-256 manifest, 18-rule static repro-build audit
- **URI scheme handling**: registered handlers for `bitcoin:`, `dogecoin:`, `litecoin:`, and `xchain:` URIs across all three shells
- **Automatic Donation System (ADS)**: opt-out micro-donation appended to each submitted action; consent captured at onboarding; configurable per chain in Settings; invisible in normal use with no extra line on sign screens
- **Connected sites + permissions**: per-origin grant store, revocable from Settings, surfaced in the approval popup before every privileged action

## Documentation

| Document | Description |
|---|---|
| [Architecture](architecture.md) | Repo layout, package boundaries, state flow, three-shell model, core/web/extension/desktop seams |
| [Keys & Signing](keys-signing.md) | BIP39 + passphrase, HD derivation, vault encryption, signer interface, software / Trezor / Ledger / Remote / Multisig |
| [Security & Threat Model](security.md) | Protected assets, in-scope and out-of-scope threats, sign-screen safety rails, audit posture |
| [UX Surfaces](ux.md) | Onboarding, lock/unlock, balances, history, send/receive, sign screens, contacts, QR scanner, command palette, settings |
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

The wallet is a pnpm workspace. Clone the repo and install workspace dependencies:

```bash
git clone https://github.com/XChain-Platform/xchain-wallet.git
cd xchain-wallet
pnpm install
```

The repository depends on a sibling `xchain-sdk` checkout, both `packages/web/package.json` and `packages/extension/package.json` link `xchain-sdk` from `../../../xchain-sdk`. Clone [xchain-sdk](https://github.com/XChain-Platform/xchain-sdk) next to `xchain-wallet` before installing.

## Quick Start

### Run the web SPA

```bash
pnpm --filter @xchain-wallet/web dev
```

Vite serves the wallet at `http://localhost:5173`. The web shell is mobile-responsive, open it on a phone for the mobile UX. A native Android app, the Capacitor wrapper of this web build, has shipped (`v0.336.0`); a native iOS app is still on the post-launch roadmap.

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

The web SPA is the lowest-friction entry point: visit a hosted instance, create or import a wallet, and sign locally in the browser. Master keys never leave the browser tab; vault ciphertext is persisted in IndexedDB. The web shell is mobile-responsive.

Web shell key isolation is fundamentally weaker than the extension's, same-origin scripts on `wallet.xchain.io` could in principle access in-memory key material. Mitigations: short session lifetime (in-memory only; refresh = re-locked), no master key in `sessionStorage`, no third-party `<script>` tags. Power users on extreme threat models should prefer the extension or desktop shells.

### Chrome MV3 extension

The extension provides MetaMask-style UX: a popup launched from the toolbar, a full-screen view for power-user workflows, a side panel (Chrome's persistent sidebar, toggleable from Settings), an isolated content script that injects `window.xchain` into pages, and a service worker that owns the vault and signers. All sensitive operations (unlock, sign, approval) run in extension-origin pages so page chrome cannot read or tamper with them.

The extension's manifest version follows wallet semver via a derive rule (`packages/core/scripts/derive-extension-version.js`) and is gated by an 11-rule static audit (`extension-manifest-audit.js`) on every commit.

### Desktop application

The desktop shell uses Electron with a hard main / renderer split (§9.3.2):

- **Main process** owns the Vault, the SDK instance, and all signers. Keys never cross the IPC boundary into the renderer.
- **Renderer process** runs the same React app from `@xchain-wallet/core` and talks to main via a preload-exposed `window.xchainWalletBridge.sendMessage(message)`.

Builds target Windows, macOS, and Linux via electron-builder. The pre-signing Linux artifact is Level-2 reproducible (see [Reproducible Builds](reproducible-builds.md).

### dApp integration

Third-party dApps integrate via the `window.xchain` provider injected by the extension (and exposed equivalently by the desktop shell). Consume the typed `@xchain-wallet/bridge-spec` package for full TypeScript types of every method, parameter, and result envelope. See [Bridge](bridge.md) for the full API.

## Repository Layout

```
xchain-wallet/
├── package.json                 workspace root, single source of truth for version
├── pnpm-workspace.yaml          packages/* + test/e2e
├── tsconfig.base.json           shared TS config (JS + JSDoc throughout)
├── packages/
│   ├── core/                    React components, state, flows, signers, schemas, SDK integration
│   ├── web/                     browser SPA shell (Vite)
│   ├── extension/               Chrome MV3 extension shell
│   ├── desktop/                 Electron desktop shell
│   ├── bridge-spec/             window.xchain TypeScript type definitions
│   ├── signers-ledger/          Ledger hardware signer (WebHID transport)
│   ├── signers-trezor/          Trezor hardware signer (Connect transport)
│   └── test-dapp/               reference dApp exercising the bridge
├── tools/
│   └── build-reproduce/         reproducible-build helper scripts
├── test/e2e/                    Playwright E2E suite (web shell)
├── docs/                        in-repo architecture + threat-model + dependency notes
├── CHANGELOG.md                 Keep a Changelog format; root is authoritative
└── LICENSE.md / NOTICE.md       GNU Affero General Public License v3.0 (AGPL-3.0)
```

All packages ship at the **same version**. Every shell's About screen surfaces its own `package.json.version` so users can verify all shells came from the same codebase.

## Status

Pre-v1.0 release-candidate (`0.338.0`). All four implementation phases; Phase 1 (framework), Phase 2 (issuance + hardware), Phase 3 (DEX + messaging), Phase 4 (contracts + staking + cross-chain + multisig), are closed. The autonomous portion of the §56.3 pre-launch track is also closed; three user-driven items remain before v1.0.0 GA: external security audit, external accessibility audit, and Chrome Web Store submission. Audit-readiness packets ship with the repo.

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
| `xchain-sdk` | The wallet's only data and signing layer: actions, encoder, explorer, hub, WebSocket |
| `react` / `react-dom` | UI framework |
| `@noble/hashes` | SHA-256, SHA-512, HMAC, Argon2id, PBKDF2: wallet KDF + commitment + integrity |
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

See [Dependencies](dependencies.md) for the per-package "why we depend on this" review.

---

**Copyright &copy; 2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
