<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Configuration

The wallet exposes most user configuration through Settings. The same settings schema is shared by the web app, Chrome MV3 extension, Electron desktop app, and the Capacitor mobile shell. The mobile package contains Android and iOS projects and wraps the web app's built interface.

Runtime preferences and per-origin grants live inside the encrypted vault. Build and release inputs configure the shell artifacts, but they do not replace the user's endpoint, fee, network, or privacy choices.

## Per-chain endpoints

The bundled registry is wallet-owned code under `packages/core/src/registry/descriptors/`. It contains Bitcoin, Litecoin, and Dogecoin descriptors for mainnet, testnet, and regtest. `packages/core/src/sdk/SDKRegistry.js` consumes those descriptors and applies any saved endpoint overrides when it lazily creates an SDK instance.

Settings → Network & endpoints exposes these values for every visible chain:

| Field | Default | Saved override |
|---|---|---|
| `explorerUrl` | Descriptor `explorer.defaultUrl` plus a nonstandard `defaultPort` | `settings.sdkEndpoints[chainId].explorerUrl` |
| `encoderUrl` | Descriptor `encoder.defaultUrl` plus a nonstandard `defaultPort` | `settings.sdkEndpoints[chainId].encoderUrl` |
| `hubUrl` | Descriptor `hub.defaultUrl` plus a nonstandard `defaultPort` | `settings.sdkEndpoints[chainId].hubUrl` |
| `custom` | `false` | `true` when any saved URL differs from all three descriptor defaults |

Ports are part of the saved URL strings. There are no separate `explorerPort`, `encoderPort`, or `hubPort` settings.

Settings → Network selects `mainnet`, `testnet`, or `regtest`. Mainnet is the default. Regtest is shown as a choice when Developer Mode is enabled. The active network filters both displayed chains and network requests. A persistent Not mainnet banner is shown on testnet and regtest.

Address type is an address-level preference, not an endpoint setting. Bitcoin supports `p2pkh`, `p2sh-p2wpkh`, `p2wpkh`, and `p2tr`; Litecoin supports the first three; Dogecoin supports `p2pkh` only. The descriptor default is `p2wpkh` for Bitcoin and Litecoin and `p2pkh` for Dogecoin. Settings → Fees separately offers `low`, `normal`, `fast`, and `custom`; each bundled descriptor defaults to `normal`. Replace-by-Fee is supported for Bitcoin and Litecoin and disabled for Dogecoin.

The endpoint editor validates that each value is an absolute HTTP or HTTPS URL with a host. Plain HTTP is accepted only for regtest descriptors or loopback hosts. Saving does not contact the service, inspect a banner, or enforce a five-second probe. The host is first contacted when the wallet uses the endpoint, so an unreachable override can make balances, history, and transactions unavailable for that chain.

## Settings store

`packages/core/src/schemas/settings.js` defines the version 3 Settings record. `packages/core/src/storage/Vault.js` stores it as the singleton `settings` member of the AES-256-GCM encrypted vault document. The stored record is sparse: values equal to release defaults are omitted, then `inflateSettings` restores defaults on read. Per-chain fee and ADS entries retain their chain keys while a missing preference means follow the current descriptor default.

Important code defaults include:

| Area | Settings and defaults |
|---|---|
| Appearance and region | `theme: "system"`, `reducedMotion: "auto"`, `language: "en"`, `fiatCurrency: "USD"` |
| Safety | `autolockMinutes: 15` (`0` means Never), `grace.undoSendEnabled: false`, `grace.undoSendSeconds: 5`, `panicMode.enabled: false`, `backupReminders: "off"` |
| Network and fees | `activeNetwork: "mainnet"`, empty `sdkEndpoints`, descriptor-resolved fee strategy, and descriptor-capped RBF behavior |
| Privacy | Tor routing, change-address rotation, small-balance hiding, blur-on-blur, and label restore are off; haptics, native price data, and metadata fetching are on |
| Display | `numberFormat: "full"`, `smallBalanceThreshold: "dust"`, token pin and hide row controls off, fiat values in history off |
| Notifications | Transaction confirmations, incoming receipts, messages, governance polls, deadlines, dispenser events, and incoming pending payments on; price alerts and sounds off; quiet hours off |
| Wallet behavior | `walletMode: "full"`, `verifyProofs: true`, Developer Mode and Learn Mode off |
| Local dApp development | Localhost auto-approval off and localhost password reuse off |
| ADS | `ads.enabled: true`; per-chain amounts resolve from the chain descriptors |

`packages/core/src/flows/settings.js` deep-merges a patch, normalizes descriptor-default values, validates the complete result, and only then writes it. Invalid patches are rejected without changing the vault. On read, the Vault applies registered forward migrations and inflates the sparse record. It does not claim that arbitrary malformed manual edits are repaired.

## Signer registration

The Pair hardware signer action renders `packages/core/src/shared/routes/PairSignerForm.jsx`. Web and desktop wire both Trezor and Ledger factories. The MV3 extension wires Ledger over WebHID and deliberately disables Trezor pairing because extension policy forbids its remotely loaded Connect code. Ledger pairing also requires a browser context with WebHID.

Successful pairing calls `packages/core/src/flows/registerSigner.js` and stores a `SignerRecord` in the encrypted `signers` collection:

| Field | Purpose |
|---|---|
| `id` / `walletId` | Stable record identifier and owning wallet |
| `kind` / `vendor` | `trezor` or `ledger`; vendor must match kind |
| `model` / `deviceIdentifier` | Vendor model and an opaque identifier used to recognize the same device |
| `label` | User-facing name |
| `firmwareVersion` | Last observed version, or `null` before one is reported |
| `pairedAt` / `lastSeenAt` | Pairing and most recent successful interaction timestamps |

The record intentionally contains no PIN, seed, private key, or xpub. Software signers are implicit per wallet and do not receive `SignerRecord` rows. Re-pairing the same `(walletId, vendor, deviceIdentifier)` updates the existing record instead of creating a duplicate. The bundled `packages/core/src/signers/firmware-manifest.js` supplies pairing-time firmware verdicts; firmware marked unsupported blocks Save.

`packages/core/src/flows/reconcileAddressSigners.js` is a migration helper for addresses whose `signerId` is `null`. A caller must supply unlocked signers. The helper compares each derived public key with the address's stored public key and derivation path, refuses ambiguous matches, and skips watch-only or imported addresses without a path. The production shells do not call this helper automatically at unlock time.

## Connected sites

Per-origin dApp grants are encrypted vault records defined by `packages/core/src/schemas/connectedSite.js`:

| Field | Purpose |
|---|---|
| `id`, `schemaVersion` | Record identity and schema version |
| `origin`, `appName`, `appIcon` | Site identity shown to the user |
| `connectedAt`, `lastUsedAt` | Connection and most recent use timestamps |
| `permissions.chains` | Granted chain IDs |
| `permissions.accounts` | Granted account IDs |
| `permissions.canSignMessage` | Permanent message-signing grant; otherwise the wallet asks |
| `permissions.canSignAction` | Per-action `always`, `ask`, or `never` policy |
| `sessionHistory` | Timestamped action decisions with an approved flag |
| `autoApproved` | Optional marker for a Developer Mode localhost grant |

Settings → Connected sites shows the grant details and supports Disconnect, Block, and Unblock. Disconnect deletes the grant, and a later privileged bridge call fails as not connected until the site connects again. The UI offers a short-lived Undo action that restores the deleted snapshot. Blocking is stronger: it adds the origin or wildcard to `settings.blockedOrigins` and evicts matching connected-site records. The same panel exposes the recent blocklist audit log and the per-origin sign-request throttle.

## Build-time configuration

The repository builds four shell families:

| Shell | Package and target |
|---|---|
| Web | `@xchain-wallet/web`, a Vite browser SPA |
| Extension | `@xchain-wallet/extension`, a Chrome MV3 popup, full-screen page, side panel, and service worker |
| Desktop | `@xchain-wallet/desktop`, Electron packages for Windows, macOS, and Linux |
| Mobile | `@xchain-wallet/mobile`, Capacitor Android and iOS projects containing the built web SPA |

Reproducible web, extension, and desktop builds use the shell Dockerfiles and the `packages/web/scripts/reproduce.sh`, `packages/extension/scripts/reproduce.sh`, and `packages/desktop/scripts/reproduce.sh` entry points. Their principal inputs are:

| Input | Source or use |
|---|---|
| `NODE_VERSION` / `NODE_SHA256_X64` | Docker build arguments pinned to `tools/release/toolchain.json` |
| `PNPM_VERSION` | Docker build argument matching the root `packageManager` field |
| `SOURCE_DATE_EPOCH` | Required by each deterministic build script and derived from the selected commit timestamp |
| `LC_ALL` / `LANG` / `TZ` | Pinned to `C.UTF-8` / `C.UTF-8` / `UTC` inside the build environment |
| Wallet version | Kept in lockstep across the root and package manifests and `packages/core/src/buildInfo.js`; there is no `XCHAIN_WALLET_VERSION` package field |
| Desktop signing inputs | Release-only certificate, Apple notarization, or Azure Trusted Signing variables checked by `macos-signing.cjs` and `windows-signing.cjs` |
| `XCHAIN_MOBILE_RELEASE_PROFILE` / `XCHAIN_RELEASE_TAG` | Mobile build profile, defaulting to `store`, and optional release-tag input |

The source tree contains no tracked `.env` file. Local web development can opt into HTTPS or an allowed host through `VITE_HTTPS`, `HTTPS`, and `VITE_DEV_ALLOWED_HOST`; those do not configure wallet accounts or production chain endpoints.

## Developer mode

Settings → Developer mode controls these live surfaces:

- **Developer Mode**: enables regtest activation, custom-chain management, local dApp controls, preview tools, and diagnostics.
- **Learn Mode**: adds plain-language notes to confirmation screens.
- **Variant popover**: previews web layout variants and requires Developer Mode.
- **Regtest networks**: activates bundled Bitcoin, Litecoin, or Dogecoin regtest descriptors, seeds fee and ADS records, and derives the first address for existing accounts. Software derivation requires the wallet password; a selected paired hardware signer derives on the device.
- **Regtest faucet**: asks a configured local miner for native test coins; Bitcoin regtest can open the normal signed Mint flow for test XCHAIN.
- **Custom chains**: accepts a complete JSON `ChainDescriptor`, validates it through `validateChainDescriptor`, persists it in `settings.customChains`, and registers it for the running wallet.
- **Localhost dApps**: can auto-approve connect requests from loopback origins. A separate opt-in can reuse a password from a real approval for 5 minutes or 1 hour; the cached password stays in service-worker memory and clears when that process ends.
- **Logs and diagnostics console**: displays the process-local bounded console buffer from the time capture begins.

Developer Mode is off by default. It does not itself display a global warning banner. The banner is tied to `settings.activeNetwork` and appears whenever testnet or regtest is active. Redacted diagnostic export is under Settings → About, not the Developer Mode panel. That export counts sensitive collections instead of enumerating them, hashes custom endpoint URLs, and redacts addresses, balances, transaction IDs, recovery phrases, private keys, and connected-site details before copy.

## Locale

The string runtime is `packages/core/src/i18n/index.js`, with locale dictionaries under `packages/core/src/i18n/locales/<code>/index.js`. English is the user-facing locale shipped today. `pseudo-rtl` is a developer-only mirrored English dictionary used to test right-to-left layout.

The default is `settings.language: "en"`; the wallet does not automatically select the browser or operating-system locale. Missing localized keys fall back to English, and a missing English key renders its key. Locale changes update the document's `lang` and `dir` attributes and persist across shells through `LocaleSync.jsx`.

To add a locale:

1. Add `packages/core/src/i18n/locales/<bcp47>/index.js` with a default-exported dictionary matching the English keys.
2. Use ICU MessageFormat syntax for variables, plurals, selects, numbers, and dates.
3. Add a friendly name to `LANGUAGE_LABELS` in `LanguageRegionSection.jsx` if the BCP 47 code is not sufficient. Vite discovers the locale module automatically through `import.meta.glob`.
4. Run the i18n smoke and unit tests, including missing-key fallback, ICU formatting, lazy locale loading, and locale synchronization.

## Branding

`packages/core/src/branding/branding.js` centralizes the shared runtime brand values and image lookup:

- Product name, tagline, canonical wallet domain, and homepage URL
- Primary and secondary accent colors
- Default service bases and runtime service URLs
- Product logo and favicon filenames
- Small and large icons for all nine bundled chain descriptors

Chain-specific colors, names, endpoint defaults, and icon filenames also live in the chain descriptors. `brandingUrl()` resolves an image filename through Vite so production builds receive hashed asset URLs.

Branding is not a single-file white-label switch. Shell manifests, HTML titles, desktop packaging metadata, mobile native resources, license copy, and several user-facing strings also contain product identity. A branded distribution must audit those shell-specific files in addition to `branding.js`.

## ADS: Automatic Donation System

ADS is enabled by default. Onboarding shows an informational notice and points to Settings → Automatic Donation System, where the user can turn it off or customize each active chain's amount and threshold.

| Chain | Set aside per successful outgoing action | Trigger threshold |
|---|---:|---:|
| Bitcoin | 1,000 sats | 25,000 sats |
| Litecoin | 100,000 litoshis | 2,500,000 litoshis |
| Dogecoin | 5,000,000 koinu | 125,000,000 koinu |

The settings fields are `ads.enabled` and `ads.perChain[chainId]`. Each chain entry holds `perTxAmountSats`, `triggerAmountSats`, `accumulatedSats`, `lifetimeDonatedSats`, and `lifetimeTxCount`. Despite the historical `Sats` suffix, the amounts are the smallest unit of the selected chain. A `null` amount or threshold follows the current descriptor default.

After a successful broadcast, `packages/core/src/flows/ads.js` advances that chain's accumulator. When an earlier action has brought the accumulator to its threshold, the next action can receive one custom output for the accumulated amount. The output is added before the PSBT is composed and confirmed. After a successful donation broadcast, the accumulated amount resets to that action's per-transaction contribution.

Users cannot edit the destination. It comes from `ChainDescriptor.adsDonationAddress`. All nine bundled descriptors currently carry the explicit `PLACEHOLDER_REPLACE_BEFORE_MAINNET` sentinel, so `resolveAdsPlanForNextTx` refuses to inject a donation output for them. Counters still advance while ADS is enabled, and the Settings panel plainly reports that nothing is sent until a release supplies a real address. This is implemented configuration gating, not an active donation destination.

## Schema migrations

`packages/core/src/schemas/migrations.js` contains forward-only, per-record migration maps. Vault collection accessors migrate records on `get` or `list` and cache the migrated form in memory; the stored vault is updated on a later write. A record newer than the running schema, or one missing a required migration step, is rejected. Downgrade and backward-read guarantees are not provided.

Active migration chains are:

| Schema | From → To | Change |
|---|---|---|
| Wallet | v1 → v2 | Replaces `multisig` with `multisigs[]` and assigns an ID to a legacy config |
| Wallet | v2 → v3 | Adds `encryptedPassphrase: null` so pre-passphrase records are distinguishable |
| Account | v1 → v2 | Adds `activeAddressByChainId` |
| Address | v1 → v2 | Adds unresolved `signerId: null` |
| Address | v2 → v3 | Derives the address `role` from the derivation path |
| Address | v3 → v4 | Prefixes legacy default labels with the native ticker |
| Settings | v1 → v2 | Adds appearance, privacy, safety, panic, and backup-reminder fields with behavior-preserving defaults |
| Settings | v2 → v3 | Converts copied per-chain fee and ADS defaults to sparse descriptor-following values |
| Pending transaction | v1 → v2 | Adds structured `tick`, `amount`, and `params` fields |
| Pending transaction | v2 → v3 | Adds `mempoolSeenAt` without inventing an earlier sighting |
| Multisig config | v1 → v2 | Adds a stable config ID |

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
