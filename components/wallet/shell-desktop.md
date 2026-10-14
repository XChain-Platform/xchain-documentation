<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Shell: Desktop

`@xchain-wallet/desktop` is the Electron-based desktop shell. It ships for Windows, macOS, and Linux from a single codebase and a single source tree.

## Two-process model

The desktop shell uses Electron's main / renderer split (§9.3.2 of the spec) as a hard isolation boundary:

```mermaid
flowchart BT
    RENDERER["Electron renderer<br>React app from @xchain-wallet/core<br>(same routes / components / flows<br>as web + extension)"]
    PRELOAD["preload.js<br>contextBridge.exposeInMainWorld(<br>'xchainWalletBridge',<br>exposes sendMessage(message)<br>)"]
    MAIN["Electron main<br>Vault (encrypted file at rest)<br>SDKRegistry (per-chain SDK)<br>Signers (Software / Remote)<br>HW signers via signer bridge<br>(live instances in renderer)<br>ApprovalBroker<br>ConnectedSites"]

    RENDERER -->|"window.xchainWalletBridge.sendMessage(...)"| PRELOAD
    PRELOAD -->|"ipcMain.handle('xchain-wallet:message', …)"| MAIN
```

Keys never cross the IPC boundary into the renderer. Even if the renderer is compromised, the worst it can do is request a sign; and every sign routes through the user-confirmed approval surface.

## Main process

`packages/desktop/main/index.js` boots the same `createBackgroundHost` factory the extension's service worker uses. The wallet's flows, handlers, and error envelopes are identical across shells; only the storage backend and the message transport differ.

| Module | Role |
|---|---|
| `main/index.js` | Boots Electron, creates the `BrowserWindow`, and injects the OS notification adapter (`electron.Notification`) that delivers §46 transaction and price-alert notifications via native desktop toasts |
| `main/runtime.js` | Lifecycle: app-ready, before-quit, second-instance handling |
| `main/storage.js` | File-backed Vault adapter; encrypted at rest with the same AES-256-GCM scheme as the extension |
| `main/keychain.js` | Session-master-key cache: an OS-keychain-encrypted `session.bin` when a keychain backend is available, in memory otherwise |
| `main/messageHost.js` | `MessageHost` integration: same as the extension's service worker |
| `main/protocol.js` | URI scheme registration (`bitcoin:` / `dogecoin:` / `litecoin:` / `xchain:`) via `app.setAsDefaultProtocolClient` |
| `main/permissions.js` | Per-origin permission grants; same `connectedSites` schema as the extension |
| `main/signerBridgeListener.js` | Receives sign requests from a paired `RemoteSigner` channel |
| `main/updater.js` | electron-updater wiring; signature-verified auto-updates |
| `main/meta.js` | `package.json.version` exposure for the About screen |

Notification delivery has no dedicated module file; the OS adapter (`electron.Notification`) is injected inline by `main/index.js` into the shared `runtime.js` lifecycle. There is no side-panel in the desktop shell; side-panels are a browser-extension API (`chrome.sidePanel`) not available in Electron.

## Preload

`preload.js` runs in an isolated context and uses `contextBridge.exposeInMainWorld` to expose a single function (`xchainWalletBridge.sendMessage(message)`) to the renderer. The renderer cannot reach Electron internals, Node.js APIs, or the filesystem; it can only pass typed messages to the main process and receive typed responses.

## Renderer

The renderer renders the same React tree as the web SPA from `@xchain-wallet/core`. It talks to main through `messaging.js` helpers that mirror the popup / web `messaging.js` so feature code is shell-agnostic.

The renderer process runs with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`; the standard hardened Electron configuration.

## Window sizing and responsive layout

The first window opens at 1024 by 768 px, reduced as needed to fit the primary display's work area. Electron enforces a 640 by 600 px minimum window size. Moves and resizes save the normal window bounds to `window-bounds.json`; closing or quitting flushes the latest bounds synchronously.

On launch, the main process validates the saved dimensions and compares the rectangle with every current display work area. It preserves an origin that still belongs to a display while fitting the dimensions to that work area. For other saved rectangles with useful overlap, it chooses the display with the greatest overlap and clamps the window onto it; it discards an unusable saved position so Electron can choose a visible one. This recovers the window after a monitor is disconnected or its resolution changes. Additional windows reuse the saved size and request a 24 px cascade offset when that remains visible.

The View menu exposes Electron's Zoom In, Zoom Out, and Reset Zoom actions. The wallet does not set application-specific numeric zoom limits, so Electron's built-in limits apply; Reset Zoom restores the default scale. Layout tiers use the renderer container's width in CSS pixels, so zoom can move the UI between tiers even though the native window cannot be resized below 640 px.

| Effective container width | Header and navigation |
|---|---|
| Compact, under 640 px | The persistent header wraps its action group onto a second row. Navigation moves to the bottom bar with Home, History, Send, Scan, and More; More contains the remaining destinations, wallet switcher, Settings, and Lock. At the default zoom this tier is below the native window minimum. |
| Rail, 640 to 899 px | A 64 px left icon rail replaces the bottom bar. Navigation labels remain available to assistive technology but are visually hidden; the brand and wallet-switcher rows are hidden because those actions remain reachable elsewhere. The persistent header stays above route content. |
| Full, 900 px and wider | A 220 px labelled left sidebar replaces the icon rail. The persistent header stays above route content and the bottom bar remains absent. |

In every tier the desktop header remains mounted across unlocked route changes. It keeps the wallet logo, watch-only status when applicable, network status, command-palette button, and lock action available while the active route scrolls independently.

## OS keychain auto-unlock

On by default whenever a real OS keychain backend is available; there is no setting that turns it off. After an unlock, the main process encrypts the **session master key** (32 bytes, not the password) with Electron `safeStorage` and writes the ciphertext to `session.bin` in the app's user-data directory (mode `0600`). The key material that decrypts it stays in the OS keychain:

| OS | `safeStorage` backend |
|---|---|
| macOS | Keychain |
| Windows | DPAPI |
| Linux | Secret Service (GNOME Keyring) or KWallet, via libsecret |

When no keychain backend is available, or Electron reports the `basic_text` fallback, nothing is written to disk: the key is held in memory for the running process only, and every launch asks for the password.

On a later launch, the main process decrypts `session.bin` and the wallet boots already unlocked, but only within the user's auto-lock window: a launch gate drops the cached key, and the user sees the lock screen, when the idle window has elapsed or the idle record is missing or unreadable. With auto-lock set to Never (and on a demo wallet) the gate keeps the cached key with no time limit. Lock, whether manual or by auto-lock, and wallet reset delete `session.bin`, which is how a user makes the next launch ask for the password. If the ciphertext cannot be decrypted (a different OS user, a reset keychain), the wallet asks for the password.

The file is only as safe as the OS keychain: code running as the same OS user while the keychain is unlocked may be able to decrypt `session.bin`. On a shared machine, set an auto-lock timeout rather than Never, and lock before quitting.

## Hardware signer transports

Hardware pairing runs in the renderer over browser-standard transports; the desktop shell bundles no native USB or HID bindings:

| Signer | Transport |
|---|---|
| Trezor | Trezor's hosted Connect build (`connect.trezor.io`), loaded only inside an isolated bridge window (below) |
| Ledger | `@ledgerhq/hw-transport-webhid` (works in Electron renderer too) |

The renderer holds the live hardware signer instances (`renderer/signerBridge.js`) and starts pairing through `renderer/signerFactories/trezorFactory.js` and `ledgerFactory.js`. The main process reaches those signers over the preload-exposed `xchainWalletSignerBridge` IPC channel. Private keys stay on the device.

**Trezor bridge window.** Trezor's hosted Connect script never runs in the main window. `trezorFactory.js` opens a separate bridge window, and `main/index.js` puts it on its own Electron session (partition `trezor-connect-isolated`) wired to `attachHidDenial` in `main/permissions.js`, so nothing running there can be granted a HID device. The bridge window has no preload and its own CSP: `default-src 'none'`, with only `https://connect.trezor.io` admitted for script, connect and frame sources, plus one nonce-admitted inline responder. It answers a fixed `postMessage` allowlist (`init`, `getFeatures`, `getAddress`, `getPublicKey`, `signTransaction`, `signMessage`). The main window's own CSP keeps `script-src 'self'`, `connect-src 'self'` and `frame-src 'none'`, so the renderer's code never fetches from Trezor's domain.

## Auto-updater

`electron-updater` is wired in `main/updater.js`. Updates are:

- Pulled from a maintainer-controlled release feed
- **Signature-verified** before swap; the updater refuses to install an artifact whose signature doesn't match the publisher key
- Surfaced to the user as an in-app prompt rather than auto-applied; the user accepts or postpones

Signature verification is the security-critical part. The audit-readiness packet calls it out specifically: "verify auto-updater verifies signature before swap" is one of the three desktop-shell asks for the external audit.

## Packaging

`electron-builder` (config at `packages/desktop/electron-builder.config.cjs`) produces:

| Target | Output |
|---|---|
| macOS | `.dmg` (Apple-notarized) + `.app` (signed) |
| Windows | `.exe` installer (Authenticode-signed) |
| Linux | `.AppImage` (xz-compressed, deterministic) |

The pre-signing artifact (Linux only at v1.0.0) is **Level-2 reproducible** (see [Reproducible Builds](reproducible-builds.md). Independent verifiers can rebuild from source and produce the same `linux-unpacked/` content the maintainer signs.

## Configuration knobs

| File | Purpose |
|---|---|
| `electron-builder.config.cjs` | Build targets, signing configuration, asar settings, AppImage compression |
| `Dockerfile` | Reproducible-build container: digest-pinned base, NODE_VERSION pinned, locale + TZ pinned |
| `scripts/build.sh` | Build script: asserts SOURCE_DATE_EPOCH, uses `--frozen-lockfile`, emits `RELEASE_HASHES.txt` |
| `scripts/reproduce.sh` | Verification script: derives SOURCE_DATE_EPOCH from `git log`, builds from a fresh worktree |
| `Reproducible_Builds.md` | The desktop-package-level companion to the platform-wide protocol |

## Run locally

```bash
pnpm --filter @xchain-wallet/desktop start
```

Builds the renderer with Vite and launches Electron pointing at the local build. Hot-reload of renderer code is supported in dev mode; main process changes require a restart.

## Build a packaged release

```bash
pnpm --filter @xchain-wallet/desktop dist           # signed installers per platform
pnpm --filter @xchain-wallet/desktop dist:unpacked  # pre-signing Linux bundle
pnpm --filter @xchain-wallet/desktop reproduce      # rebuild and verify
```

`dist` requires the maintainer signing identity (Apple Developer cert for macOS, Authenticode cert for Windows); `dist:unpacked` doesn't and is what the reproducible-build verification actually rebuilds.

## URI registration

On every launch the desktop app claims the `xchain:` scheme via `app.setAsDefaultProtocolClient`. The coin schemes (`bitcoin:`, `dogecoin:`, `litecoin:`) are declared at install time but claimed only after an opt-in, which is off by default and has no settings toggle yet, so the desktop app does not handle them today.

Clicking an `xchain:` URI in the OS launches or focuses the desktop app and, once the wallet is unlocked, opens the matching form prefilled: Send for a payment link, Receive for a receive link, and the contract Execute form for an execute link that names a contract. A link clicked while the app was closed or locked is held until then. A link only ever prefills a form; the user still reviews and confirms it.

The user can revoke the registration via OS-level "default app" settings; the wallet doesn't fight back.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
