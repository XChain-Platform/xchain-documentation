<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/DEPENDENCIES.md @ 34639117 (worktree dirty) -->

# Dependencies

Every third-party runtime dependency in XChain Wallet is enumerated here with:

- **Why we depend on it**: the specific feature it provides that the wallet would otherwise have to implement and review itself.
- **License**: must be permissive (MIT, Apache-2.0, BSD, ISC, CC0).
- **Maintainer context**: a trust signal; the wallet prefers dependencies from authors who also maintain widely-used adjacent packages.

Any new runtime dependency requires an addition to this page. CI runs a production-only audit on every change; known advisories are surfaced as review comments before merge.

This page tracks *runtime* dependencies, anything that ships in a user-installable artifact. Dev-only tooling (build, lint, test runners) is reviewed at bump time but not enumerated here.

## Core

### `@noble/hashes`

**Why.** SHA-256, SHA-512, HMAC, Argon2id, PBKDF2, all the primitives behind the wallet's crypto layer (key derivation, seed derivation, commitment keys, label-sync, PSBT-QR integrity). Constant-time implementations, audited, no native bindings.

**License.** MIT.

**Maintainer.** Paul Miller (@paulmillr). Author of the adjacent `@noble/curves` (secp256k1) and `@noble/ciphers` packages, and a Bitcoin Core contributor.

### `@scure/base`

**Why.** base58check encoding and decoding for WIF and address parsing. Avoids pulling in a much larger Bitcoin library for a handful of functions.

**License.** MIT.

**Maintainer.** Paul Miller (@paulmillr), with a Trail of Bits audit.

### `@scure/bip32`

**Why.** BIP32 HD derivation. Used everywhere the wallet derives a key from the seed: receive addresses, signing, WIF export, dry-run restore, gap-limit scan.

**License.** MIT.

**Maintainer.** Paul Miller (@paulmillr), with a Trail of Bits audit.

### `@scure/bip39`

**Why.** BIP39 mnemonic generation, validation, and seed derivation. A legacy Counterwallet-style import path lives in the wallet's own codebase because that wordlist isn't standardized anywhere; BIP39 is the ubiquitous case and this package is the audited implementation.

**License.** MIT.

**Maintainer.** Paul Miller (@paulmillr), with a Trail of Bits audit.

## Extension shell

The extension shell is a workspace dependent on core. It pulls in all of core's transitive dependencies listed above; the extension shell itself introduces no new third-party runtime dependencies.

## Web shell

The web shell is a workspace dependent on core. It pulls in core's transitive dependencies; the web shell adds no new third-party runtime dependencies.

## Desktop shell

The Electron shell.

### `electron-updater`

Auto-update against the wallet's self-hosted release feed. It downloads and installs; it does not decide whether an update is trustworthy on its own. See `openpgp` below.

### `openpgp`

Verifies the maintainer's signature over the release manifest before an update is installed.

This is a real dependency in a wallet, so the reason has to be worth it. The built-in updater checks a checksum from the channel pointer file, which is served by the same host as the binary, so it is a checksum from the party that served the file rather than an independent signature. On Windows and macOS, the operating system's own code-signature check is a genuine second factor; on Linux there is none, so whoever controls the download host (or the CDN in front of it) could silently push attacker-controlled code to every Linux desktop user. Verifying a signature against a key pinned inside the app closes that gap, and doing so needs an OpenPGP implementation.

The alternative considered was a second signing scheme using primitives already present in the Node runtime, which needs no dependency but adds a second key, a second ceremony step, and a second thing to rotate. The wallet chose one key and one signature instead.

This dependency runs in the main process only. It is not in the renderer bundle and is not on any path that touches user keys.

### `undici`

Routes Node's global `fetch` through a SOCKS5 proxy when the user turns on Tor routing.

Node already runs `undici` internally for every `fetch` call, so this is not new code in the process; what the direct dependency buys is a dispatcher-configuration entry point that Node does not otherwise expose. Without it, the SDK's HTTP traffic would be proxied while price lookups, coin metadata, and registry sync kept going direct: a privacy feature that covers some egress paths but not others is worse than none, because the user believes all of them are covered.

The alternative was a hand-written wrapper over Node's own HTTPS module, which needs no dependency but only covers the call sites known today; the next `fetch` call added in the main process would silently leak outside the proxy. A global dispatcher covers every current and future call site.

This dependency runs in the main process only.

### `@ledgerhq/hw-app-btc`, `@ledgerhq/hw-transport-webhid`

Ledger hardware-signer support over WebHID. Local USB transport, no network service.

### `react`, `react-dom`, `lightweight-charts`

The renderer, shared with the other shells.

### Workspace and linked dependencies

Core, the extension's shared handlers, and the protocol SDK are consumed as workspace or linked dependencies: shared flows, the background host, and the SDK client.

## `@xchain-wallet/bridge-spec`

Zero runtime dependencies. Ships TypeScript types plus a handful of pure helper functions. Consumers are third-party dApp authors who install this package directly, so keeping it dependency-free keeps their install light.

## `@xchain-wallet/test-dapp`

Depends only on `@xchain-wallet/bridge-spec` as a workspace dependency. The test dApp exercises the bridge surface via the type definitions; no third-party runtime dependencies.

## Review cadence

- **Every change that touches a package manifest**: the reviewer confirms this page is updated for any new, removed, or version-bumped runtime dependency.
- **Weekly**: an outdated-dependency check runs against the lockfile, with bumps scheduled for the next weekly release window.
- **On advisory**: if a security audit tool surfaces a CVE mid-cycle, it goes to the top of the queue regardless of cadence.

## Floor versions

Every dependency above uses a caret range. The floor is what has actually been tested against; the committed lockfile pins the exact installed versions. Reproducible builds (see [Reproducible Builds](reproducible-builds.md)) work from the lockfile, not the ranges.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
