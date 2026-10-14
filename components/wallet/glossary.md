<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/GLOSSARY.md @ 34639117 (worktree dirty) -->

# Glossary

A reference for terms used throughout the wallet's design and user-facing surfaces. Wallet-specific vocabulary lives here; protocol-level terms (ACTION names, encoding types, BATCH, magic prefix) are defined in [Key Terms](../../getting-started/key-terms.md) and not duplicated here unless the wallet reuses the term with a narrower meaning.

## Wallet architecture

**core** - The shared `@xchain-wallet/core` package. It contains schemas, validators, flows, storage, software and remote signer support, shared routes and components, i18n, and build metadata. The bridge contract is a separate `@xchain-wallet/bridge-spec` package, while Ledger and Trezor implementations live in their own signer packages. See [Wallet Architecture](architecture.md).

**shell** - One of the wallet's end-user packages: a Chromium MV3 extension, a browser SPA, an Electron desktop app for Windows, macOS, and Linux, or a Capacitor wrapper around the web build. Android is shipped; the iOS package exists but its App Store release is pending. Each shell wires shared flows to its storage, messaging, and signer boundaries.

**vault** - The shared encrypted persistent-state facade. It exposes typed collections for wallets, accounts, addresses, contacts, connected sites, signers, pending work, watchlists, alerts, multisig and co-signer state, gated keys, autopay state, and one settings record. Shells supply storage backends such as IndexedDB, `chrome.storage.local`, an Electron file store, or a native mobile vault.

**flow** - A function in core's flows layer that performs a wallet operation such as creating a wallet, submitting an action, signing a message, or importing a backup. A flow receives the dependencies it needs, such as the vault, chain registry, SDK registry, or signer, which keeps it independent of a particular shell.

**MessageHost** - The named-message router shared by the shells. The extension runs it in the background service worker, the desktop app runs it in the Electron main process, and the web and mobile bundle run it in-page. It returns a common success or error envelope to the calling UI.

**messaging shim** - A per-shell module that exposes typed wrappers around sending a named message with a payload. Shells expose the same shim shape so shared routes render unchanged across shells.

## Signing and key management

**HD wallet** - A wallet whose keys are derived deterministically from a seed using BIP-32 and chain-specific BIP-44-style paths, including BIP-84 paths where applicable. New wallets generate a 12-word BIP-39 phrase by default and offer a 24-word option; import accepts valid 12, 15, 18, 21, or 24-word BIP-39 phrases.

**imported WIF** - A single private key imported either into an existing HD wallet or as a WIF-only wallet. The encrypted key is stored in the wallet record and linked to an address record. It is not recoverable from an HD wallet's mnemonic and needs its own backup.

**BIP39 passphrase** - An optional extra secret, often called a "25th word," combined with a BIP-39 mnemonic when deriving the seed. Different passphrases produce different wallets from the same mnemonic. The wallet captures it at creation or import and encrypts it under that wallet's master key, so normal unlock needs only the wallet password. Restoring from the recovery phrase on another device still requires the exact passphrase; a missing or mistyped value derives a different wallet.

**signer** - An object implementing the wallet's signing contract for transactions, messages, public-key derivation, status, and multisig contributions. Shipping implementations include the seed-backed software signer and the Trezor and Ledger device signers. A `RemoteSigner` proxies Trezor or Ledger operations across a shell transport. Address source and `signerId` determine which signing path is used; watch-only addresses have no signer.

**SignerPool** - An in-memory map of unlocked software signers keyed by wallet id. It is populated for an unlocked session, evicts one entry when that wallet is removed, and locks and clears every entry when the session locks. Hardware signer metadata is stored in the vault and is not held in this pool.

**panic mode** - A 24-hour signing freeze the user activates from Settings while the wallet is open. Signing remains blocked until the timer expires or the user explicitly deactivates the freeze from Settings. A separate duress passphrase silently activates the same freeze when it is entered on the locked screen after a real-password unlock fails. Bridge signing failures are surfaced as `PANIC_MODE`. A wallet wipe erases the panic freeze record and the duress passphrase so neither survives removal of the wallet.

**clipboard auto-clear** - A sensitive-copy retention setting from 0 to 600 seconds, with a 60-second default and 0 disabling expiry. Browser-based shells clear only if the wallet's copied value is still current; native mobile shells delegate sensitive marking and expiry to the native clipboard plugin.

## dApp bridge

**bridge** - The `window.xchain` provider injected into web pages by the Chromium extension's content script. Its public surface includes connection and read methods, `signMessage()`, `signAction()`, `signPsbt()`, `coSign()`, `signIn()`, `parallel()`, and event subscriptions. The desktop and web shells use separate internal messaging objects rather than attaching this dApp provider themselves. The full surface is documented in [dApp Bridge](bridge.md).

**ConnectedSite** - A vault record created when the bridge grants a connect request, either through user approval or the Developer Mode localhost auto-approve path. It stores the origin, app identity, timestamps, chain and account scopes, message-signing permission, per-action permissions, session history, and whether the grant was auto-approved.

**approval** - A user decision requested by the extension bridge before connecting or signing when policy requires consent. The extension's approval broker opens an `approval.html` popup, parks the request until the user decides, and treats a closed or timed-out popup as rejection.

**bridge error code** - A stable string identifier returned in a failure response. `USER_REJECTED`, `NOT_CONNECTED`, `WALLET_LOCKED`, `BLOCKED_BY_USER`, `THROTTLED`, and so on. The full table lives in [dApp Bridge](bridge.md).

**throttle** - A per-origin sliding-window limiter applied to `signMessage`, `signAction`, `signPsbt`, `coSign`, `parallel`, and `signIn`. The default allowance is five signing requests per 60 seconds, and settings may override both values. A rejected call returns `THROTTLED` with `retryAfterMs`, `burst`, and `windowMs` hints. Connect, disconnect, and read methods are not throttled.

**blocklist** - A user-managed list of exact origins or `*.example.com` wildcard patterns. Matching connect and signing requests are rejected with `BLOCKED_BY_USER`. Adding an entry also evicts matching ConnectedSite records so existing grants cannot keep signing.

**SIWX** - Sign-In with XChain. The bridge's `signIn` method signs a versioned challenge containing the app id, wallet-stamped requesting origin, address, nonce, timestamp, and expiry time. A relying service must verify the origin as well as the signature and other fields.

## Storage and state

**Wallet record** - The vault representation of one seed-backed or WIF-only wallet. It stores identity and origin metadata, format, encryption and KDF parameters, encrypted seed material where applicable, an optional encrypted BIP-39 passphrase, imported WIF entries, and multisig configurations.

**Account** - A BIP-44-style partition under a wallet seed. Its record stores the wallet id, user-facing name, non-negative derivation index, creation time, and sparse per-chain active-address overrides. The default account uses index 0; additional accounts use higher indices.

**Address record** - A persisted address entry containing chain and network, source, account link, address type, derivation path where applicable, public key, signer link, label, visibility flags, and receive/change/dispenser role. HD records are created during wallet creation, account or chain activation, and later address derivation; imported-WIF and watch-only records may have no account or derivation path.

**Settings record** - The vault's single global settings slot, stored sparsely as differences from current defaults. It includes appearance, auto-lock, active network, endpoints, fees, donation state, notifications, privacy controls, bridge blocklist and throttle settings, wallet-scoped token preference maps, developer controls, and other preferences. Active panic and duress state is persisted separately from this record.

**v2-tolerant** - The wallet's label for an additive schema field that remains optional within an existing record version. Readers supply a default when the field is absent, so older records remain valid without a schema-version migration.

**ConnectedSites collection** - Vault store of approved dApp origins.

**ADS** - Automatic Donation System. Each successfully broadcast transaction advances a per-chain accumulator by a configurable contribution. Once the accumulator has already reached its trigger, the next transaction includes one donation output for the accumulated amount, then resets the accumulator to that transaction's contribution toward the next cycle.

## Onboarding and recovery

**onboarding** - The first-launch sequence: accept the current license, view or skip a one-time explainer, then choose create, import, FreeWallet migration, partner pairing, or demo mode. Wallet creation collects a name and password, offers 12 or 24 words and an optional BIP-39 passphrase, displays the mnemonic, verifies selected words, persists the wallet, and ends with an ADS notice. The ADS screen informs rather than asks for consent; its controls live in Settings.

**dry-run restore** - A non-destructive backup check. It derives a configurable number of addresses per selected chain from a BIP-39 or Counterwallet mnemonic and compares them with the current wallet's persisted addresses, without writing to the vault. It does not fetch or calculate balances.

**word-quiz** - The wallet-creation verification stage where the user re-types random, non-adjacent mnemonic words. It asks for three positions from a 12-word phrase and four from a 24-word phrase, and skips the first word.

**backup reminder** - A Home card for a funded wallet with no recorded backup verification. Passing the creation word-quiz or successfully exporting an encrypted backup marks the wallet verified. Before verification, the gentle reminder can be snoozed for 24 hours; after the wallet has remained funded for seven days, it becomes firm and cannot be dismissed.

**demo mode** - A try-before-commit lane that creates a persistent throwaway BIP-39 wallet named `Demo Wallet` with an auto-generated password, synthetic balances and history, and seeded demo contacts. Local metadata lets the shell silently unlock it after reload, display an "Exit demo & wipe" banner, and auto-expire it after 24 hours.

## Build and release

**reproducible build** - A build that produces the same bytes given the same source tree, locked toolchain, and pinned environment. The wallet's desktop pipeline targets Level-2 reproducibility (the pre-signing artifact). See [Reproducible Builds](reproducible-builds.md).

**synchronized versioning** - The wallet's release rule: the root package version is the source of truth for every `packages/*/package.json`, the extension manifest and visible version name, the in-app `WALLET_VERSION`, the README version copies, the changelog section, and the release tag.

**RELEASE_HASHES.txt** - A release manifest containing a signed header and SHA-256 entries for the files covered by that release lane. It is published as `RELEASE_HASHES/vX.Y.Z.txt` with a detached `.asc` OpenPGP signature. The desktop updater verifies the signature with the release public key compiled into the app and refuses an update whose downloaded artifact is not listed with the expected hash.

**smoke** - A standalone script that exercises a thin slice of wiring without a browser test environment. Smokes pin source assertions plus runtime exercises of small modules, and run alongside the wallet's broader test suite.

## Other terms

**chain registry** - The runtime catalog of supported chains. Each chain descriptor carries an id, coin, network kind, display name, address types, default address type, supported actions, and URI scheme. Bridge handlers consult it to validate a request's chain id against permitted chains.

**SDK registry** - A lazy cache of one XChain SDK instance per chain id. It constructs each instance from the chain registry's explorer, encoder, and hub endpoints plus any user overrides, applies bounded network timeouts and explorer rate limiting, and invalidates instances when endpoint or routing settings change.

**reachability** - The wallet's network-health layer. It probes the active chains' explorer, encoder, and hub services, classifies each chain and the overall wallet as normal, degraded, or offline, and records explorer freshness where available. Shared UI polls every 30 seconds by default and shows a reachability banner in the extension, web/mobile, and desktop shells after corroborating non-normal results.

**learn mode** - A Settings toggle that adds plain-language explanatory notes to the standard confirmation surfaces. It is off by default.

**developer mode** - A Settings toggle that gates bundled regtest activation and faucet controls, custom chain management, web layout previews, localhost dApp auto-connect and optional timed auto-sign, and the logs and diagnostics console. It is off by default. Network endpoint editing is a separate Settings section.

**i18n** - Internationalization. The shared runtime uses `intl-messageformat` for full ICU MessageFormat, lazy-loads registered locale dictionaries, falls back to English for missing keys, and synchronizes the document's language and text direction with the stored setting. A developer-only pseudo-RTL locale exercises right-to-left layout, and shared styles use logical properties such as `margin-inline-start` and `padding-inline-end` where direction matters.

<!-- BEGIN auto-generated glossary appendix -->

## Appendix: Machine-derived terms

The entries in this appendix are auto-generated from canonical
source files. Do **not** edit by hand; run
`node tools/glossary/generate-appendix.js` to refresh from source.
Sources:

- `packages/bridge-spec/src/index.ts`: `BridgeErrorCode` union
- `packages/core/src/schemas/connectedSite.js`: `SitePermissions` keys

### Bridge error codes

Reasons a bridge call (connect / signMessage / signAction / signPsbt /
signIn) can fail. dApps switch on `result.error` to choose the
right user-facing copy.

- `USER_REJECTED`
- `NOT_CONNECTED`
- `WALLET_LOCKED`
- `CHAIN_NOT_SUPPORTED`
- `ACCOUNT_NOT_AUTHORIZED`
- `ADDRESS_NOT_AUTHORIZED`
- `UNSUPPORTED_ACTION`
- `INVALID_PARAMS`
- `CHALLENGE_EXPIRED`
- `BROADCAST_FAILED`
- `PANIC_MODE`
- `THROTTLED`
- `BLOCKED_BY_USER`
- `BRIDGE_VERSION_MISMATCH`
- `INTERNAL_ERROR`

### ConnectedSite permission keys

Per-origin permissions surface; each key on a `ConnectedSite.permissions`
record gates a bridge capability for that origin.

- `chains`
- `accounts`
- `canSignMessage`
- `canSignAction`

<!-- END auto-generated glossary appendix -->
---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
