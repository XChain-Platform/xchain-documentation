<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/GLOSSARY.md @ 34639117 (worktree dirty) -->

# Glossary

A reference for terms used throughout the wallet's design and user-facing surfaces. Wallet-specific vocabulary lives here; protocol-level terms (ACTION names, encoding types, BATCH, magic prefix) are defined in [Key Terms](../../getting-started/key-terms.md) and not duplicated here unless the wallet reuses the term with a narrower meaning.

## Wallet architecture

**core** - The shared package housing every shell-agnostic module: schemas, validators, flows, signers, the bridge spec, the shared route components, the i18n primitives, and the build-info constants. The shells (extension, web, desktop, mobile) consume core through workspace packages; nothing in core imports from a shell. See [Wallet Architecture](architecture.md).

**shell** - One of the wallet's end-user packages: extension (Chrome/Firefox/Edge MV3), web (browser SPA), desktop (Electron), or mobile (Capacitor wrapper around the web build). Each shell wires core's flows to its platform's storage substrate, messaging transport, and signer surface.

**vault** - The persistent store wrapping every collection the wallet maintains: wallets, accounts, addresses, settings, contacts, signers, connected sites. Each shell provides its own concrete implementation; flows accept a vault dependency and never know which shell they are running on.

**flow** - A function in core's flows layer that runs an end-to-end operation: create a wallet, send an action, sign a message, import a backup. Flows accept dependency injection (vault, chain registry, SDK registry, signer pool) so they can be tested without a live shell.

**MessageHost** - The background-process router that registers handlers by name and dispatches incoming messages to them. Each shell instantiates one host at startup and shares it across its popup, tab, or renderer surfaces.

**messaging shim** - A per-shell module that exposes typed wrappers around sending a named message with a payload. Shells expose the same shim shape so shared routes render unchanged across shells.

## Signing and key management

**HD wallet** - A wallet whose private keys are derived deterministically from a single seed via BIP-32 / BIP-39 / BIP-44 / BIP-84. The wallet's default model. Allows recovery from a 12 or 24-word mnemonic.

**imported WIF** - A single private key imported into an existing HD wallet. The key sits alongside derived keys but is not recoverable from the mnemonic; it must be backed up separately.

**BIP39 passphrase** - An optional "25th word" added to the mnemonic when deriving the seed. Different passphrases produce different wallets from the same mnemonic. Permanent: forgetting the passphrase permanently locks the wallet.

**signer** - An object that produces a signature for a transaction or message. Concrete kinds: software (mnemonic + password unlock), Trezor (over Trezor Connect), Ledger (over WebHID), and remote/multisig composites. Selected per address.

**SignerPool** - Per-wallet cache of unlocked signers. Software signers sit in the pool while the wallet is unlocked and are evicted on lock or removal. Hardware signers live there as connection metadata only; the device itself holds the key.

**panic mode** - A 24-hour signing freeze the user activates from the locked screen. All sign methods reject with `PANIC_MODE` until the freeze elapses. A separate "duress passphrase" silently trips the same state when entered as the unlock password.

**clipboard auto-clear** - A configurable timer (0 to 600 seconds, default 60 seconds) that wipes the clipboard after the wallet copies a sensitive value like a private key.

## dApp bridge

**bridge** - The `window.xchain` provider injected by the extension's content script (or attached directly in desktop / web). dApps call `connect()`, `signMessage()`, `signAction()`, `signPsbt()`, `signIn()`, `parallel()`, plus the read methods. The full surface is documented in [dApp Bridge](bridge.md).

**ConnectedSite** - A vault record created when a user approves a connect request. Stores the origin, app name, granted chains, granted accounts, and per-action permissions.

**approval** - A user prompt that the bridge raises before performing a sign request that needs interactive consent. Implemented by an approval broker in each shell (popup window, modal dialog, or desktop toast, depending on shell). The broker returns a decision object.

**bridge error code** - A stable string identifier returned in a failure response. `USER_REJECTED`, `NOT_CONNECTED`, `WALLET_LOCKED`, `BLOCKED_BY_USER`, `THROTTLED`, and so on. The full table lives in [dApp Bridge](bridge.md).

**throttle** - Per-origin rate limiter on the four sign methods. When an origin exceeds its burst allowance inside the rate window, the bridge rejects with `THROTTLED` plus a retry hint. Connect, disconnect, and read methods are not throttled.

**blocklist** - A user-managed list of origins that the bridge hard-rejects with `BLOCKED_BY_USER`. Adding to the blocklist also evicts the matching ConnectedSite record so an in-flight session stops signing.

**SIWX** - Sign-In with XChain. The bridge's `signIn` flow's wire format: a deterministic challenge string produced from the app id, address, nonce, issued-at, and expires-at fields, signed by the wallet address.

## Storage and state

**Wallet record** - The vault's representation of one HD wallet. Holds a name, creation timestamp, encrypted seed, key-derivation parameters, plus optional imported keys for imported WIFs.

**Account** - A wallet-to-account partition. Each account is a BIP-44 derivation index off the wallet seed. A default account sits at index 0, with user-named accounts at higher indices. Addresses derive under their account's derivation path.

**Address record** - A persisted entry of chain, account, derivation path, address type, and address. Created the first time an address is needed (Receive, Send-from selector, sign request).

**Settings record** - One per wallet. Stores theme, fees, donation state, notifications, panic mode, auto-lock, blocklist, pinned coins, hidden coins, and other per-wallet preferences.

**v2-tolerant** - A schema convention: a new field added inside a schema's current version is declared optional and defaults sensibly when missing. Avoids forcing a version bump for additive changes.

**ConnectedSites collection** - Vault store of approved dApp origins.

**ADS** - Automatic Donation System. A per-chain accumulator that adds a configurable per-transaction donation to user transactions until a trigger threshold is reached, then bundles the accumulated donation into a single ACTION.

## Onboarding and recovery

**onboarding** - The first-launch flow: license acceptance, then a choice between create, import, or try-demo, then password setup, BIP39 passphrase opt-in, mnemonic display with a word-quiz, and donation-system consent.

**dry-run restore** - A non-destructive reverse of importing a mnemonic. Computes the addresses and balances a mnemonic would restore without writing anything to the vault. Used by the Backup panel to let a user verify their backup before relying on it.

**word-quiz** - The verification stage during wallet creation where the user re-types a few random non-adjacent mnemonic words to prove they wrote the phrase down correctly.

**backup reminder** - A progressive Home banner that escalates from gentle to firm copy if the user has not yet passed the word-quiz or written the mnemonic down somewhere durable.

**demo mode** - A try-before-commit lane that creates a throwaway HD wallet without prompting for a name. The wallet is flagged locally so the Home banner offers an "exit demo and wipe" affordance.

## Build and release

**reproducible build** - A build that produces the same bytes given the same source tree, locked toolchain, and pinned environment. The wallet's desktop pipeline targets Level-2 reproducibility (the pre-signing artifact). See [Reproducible Builds](reproducible-builds.md).

**synchronized versioning** - The wallet's release rule: every package bumps to the same version on every release, together with the in-app build-info version constant. The root package manifest is the source of truth.

**RELEASE_HASHES.txt** - The per-release manifest of SHA-256 hashes for every artifact (`.dmg`, `.exe`, `.AppImage`, `.deb`, `.zip`). Published alongside each release tag, and verified against a signature pinned inside the app before an update installs.

**smoke** - A standalone script that exercises a thin slice of wiring without a browser test environment. Smokes pin source assertions plus runtime exercises of small modules, and run alongside the wallet's broader test suite.

## Other terms

**chain registry** - The runtime catalog of supported chains. Each chain descriptor carries an id, coin, network kind, display name, address types, default address type, supported actions, and URI scheme. Bridge handlers consult it to validate a request's chain id against permitted chains.

**SDK registry** - Per-chain bundle of SDK modules keyed by chain id. Provides the encoder, broadcast, and explorer client. Flows accept an SDK registry dependency and resolve it per chain.

**reachability** - The wallet's offline-detection layer. A periodic background ping against the configured RPC and indexer endpoints feeds an offline / degraded banner mounted in every shell.

**learn mode** - A Settings toggle that surfaces extra explanatory copy throughout the UI for users still learning the protocol. Off by default.

**developer mode** - A Settings toggle that surfaces low-level features: regtest chain activation, a log console, auto-approve for localhost dApps, and custom endpoint editing. Off by default; gated as a single switch in the Developer Mode panel.

**i18n** - Internationalization. The wallet's i18n module supports ICU MessageFormat-subset templates with plural and select forms. A translation hook reads the active locale from context. CSS uses logical properties (`margin-inline-start`, `padding-inline-end`) so a future right-to-left locale lays out correctly without per-file edits.

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
