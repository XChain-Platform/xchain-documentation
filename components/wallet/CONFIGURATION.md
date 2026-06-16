<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Configuration

The wallet's configuration surface is small by design. Most settings are user-controlled at runtime via Settings → … rather than environment variables; build-time configuration is limited to per-shell distribution targets.

## Per-chain endpoints

Each chain in the wallet's registry has a `ChainDescriptor` declared by the SDK and surfaced in the wallet's `core/src/sdk/SDKRegistry.js`. The wallet ships sensible defaults; users override them in Settings → Chains:

| Field | Default | Override |
|---|---|---|
| `encoderUrl` / `encoderPort` | Per-chain default from the SDK | Settings → Chains → Custom RPC |
| `explorerUrl` / `explorerPort` | Per-chain default from the SDK | Settings → Chains → Custom RPC |
| `hubUrl` / `hubPort` | Per-chain default from the SDK | Settings → Chains → Custom RPC |
| `networkKind` | `mainnet` | Developer mode → Network override |
| `defaultAddressType` | `p2wpkh` (BTC / LTC), `p2pkh` (DOGE) | Settings → Chains → Address-type preference |
| `feeStrategy` | Hub-recommended fee | Settings → Chains → Fee strategy |

Custom RPCs are useful for:

- Running a local indexer for development
- Pointing at a regtest stack
- Using a self-hosted Hub for privacy
- Failing over to a backup endpoint

The wallet validates each custom URL on save: HTTPS-only by default (overridable per-chain for regtest / localhost), responds to a probe call within 5 seconds, returns the expected service banner.

## Settings store

Settings persist in the encrypted vault under the `settings` collection (`core/src/schemas/settings.js`):

| Section | Keys |
|---|---|
| Security | `autoLockTimeoutMs`, `osKeychainAutoUnlock`, `requirePasswordToViewKey`, `confirmEverySign` |
| Chains | per-chain `encoderUrl`, `explorerUrl`, `hubUrl`, `addressType`, `feeStrategy` |
| Display | `locale`, `theme`, `reducedMotionOverride`, `chartTimeframe` |
| Notifications | `desktopNotifications`, `webSocketNotifications`, `notificationLevel` |
| Developer | `developerMode`, `networkOverride`, `verboseDecoder`, `diagnosticDumpEnabled` |
| ADS | `adsEnabled`, `adsPercentage`, `adsDestination` |

All settings round-trip through the schema validator on load, so a manually edited or restored vault that's missing a field falls back to the documented default rather than crashing the wallet.

## Signer registration

Signers are registered via the Pair Signer flow (`PairSignerForm.jsx`) and persisted under the `signers` collection. Each registered signer carries:

| Field | Purpose |
|---|---|
| `id` | Stable identifier across sessions |
| `kind` | `software` / `trezor` / `ledger` / `remote` / `multisig` |
| `displayName` | User-facing label |
| `publicKey` | For derivation cross-check |
| `firmwareVersion` | Hardware signers; gated by `firmware-manifest.js` |
| `pairCode` / `channelId` | Remote signers |
| `addressMatchPolicy` | Which addresses this signer handles |

`reconcileAddressSigners` (`core/src/flows/reconcileAddressSigners.js`) runs at unlock time and ensures every address has at least one signer that can sign for it. Addresses without a usable signer surface a "this address is read-only" badge in the address list.

## Connected sites

Per-origin dApp grants live under `connectedSites`:

| Field | Purpose |
|---|---|
| `origin` | Stamped origin from the content script |
| `accounts` | Granted account IDs |
| `addresses` | Granted address IDs |
| `actionPolicies` | Per-action `always` / `ask` / `never` |
| `grantedAt` / `lastUsedAt` | Audit timeline |

Settings → Connected Sites lists every grant with revoke. Revocation is immediate; the dApp's next call surfaces a fresh approval popup.

## Build-time configuration

| Variable | Where | Purpose |
|---|---|---|
| `NODE_VERSION` | `Dockerfile` | Pinned for reproducible builds |
| `SOURCE_DATE_EPOCH` | `scripts/build.sh` | Pinned for reproducible builds; derived from `git log -1 --pretty=%ct` |
| `LC_ALL` / `TZ` | `Dockerfile` | Pinned to `C.UTF-8` / `UTC` for reproducibility |
| `XCHAIN_WALLET_VERSION` | `package.json` | Single source of truth; replicated to every sub-package |
| Apple signing identity | maintainer environment | Code-signs the macOS `.app` / `.dmg` |
| Authenticode signing identity | maintainer environment | Code-signs the Windows `.exe` |

There is intentionally no `.env` for the wallet. Endpoints, signer pairings, and per-origin grants are all user-controlled at runtime and flow through the encrypted vault.

## Developer mode

Settings → Developer enables a few power-user surfaces:

- **Network override per chain**: point Bitcoin at testnet or regtest, etc. Surfaces a banner reminding the user they're not on mainnet.
- **Custom RPC**: same as Settings → Chains but exposes additional fields (auth headers, request timeouts).
- **Diagnostic dump**: `core/src/flows/diagnosticDump.js` produces an anonymized state snapshot suitable for bug reports. No private keys, no mnemonics, no contact PII; just shape + version + recent error envelopes.
- **Verbose action decoder**: `core/src/decoder/actionDecoder.js` outputs raw + decoded form rather than just the rendered summary.

Developer mode is off by default. Enabling it surfaces a yellow banner in every shell so the user remembers they're not on the default network.

## Locale

`core/src/i18n/` holds the string registry. English (`en.js`) ships at v1.0.0 GA. Adding a locale:

1. Add `core/src/i18n/<locale>.js` with the same key set as `en.js`
2. Register the locale in `core/src/i18n/index.js`
3. The locale picker in Settings → Display surfaces it automatically
4. The smoke `i18n.smoke.js` verifies key parity across locales

The wallet defaults to the browser / OS-reported locale, falling back to `en` if a locale-specific bundle isn't available.

## Branding

`core/src/branding/branding.js` centralizes:

- Logo asset references (light + dark variants)
- Per-chain colors and icons
- Application display name + URL
- License + NOTICE strings (surfaced in About)

White-label variants of the wallet (e.g. for private XChain Platform deployments) override `branding.js` while keeping every other surface identical. This is the only place the wallet code reads brand identity, there's no hard-coded "XChain Wallet" string scattered through the routes.

## ADS: Automatic Donation System

Opt-in. When enabled in Settings:

| Setting | Default | Purpose |
|---|---|---|
| `adsEnabled` | `false` | Master toggle |
| `adsPercentage` | `1.0` | Percentage of fee routed to the donation address |
| `adsDestination` | Platform's open-development fund | Configurable to any address the user chooses |

The wallet adds an additional output to every signed transaction equal to the configured percentage of the network fee. The user sees the additional output on the sign screen and can decline; ADS does not deduct silently.

ADS is off by default and is intentionally never on the primary CTA path. It's a "show your work, then ask" feature.

## Schema migrations

Schemas declare a `version`; `core/src/schemas/migrations.js` runs at vault-load time and walks legacy records up to the current version. Active migrations:

| From | To | Change |
|---|---|---|
| `Wallet` v1 | `Wallet` v2 | `Wallet.multisig` → `Wallet.multisigs[]` (per-address multi-config) |

Migrations are transparent; a v1 vault loads in v2 without user intervention. Migrated vaults remain backward-readable as long as the migration is reversible; one-way migrations (none today) would require an explicit user-confirm at unlock.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
