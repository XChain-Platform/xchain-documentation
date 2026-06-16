<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Security & Threat Model

This document names what the wallet defends against, what it deliberately doesn't, and which mitigations ship today. It tracks the in-repo `docs/Threat_Model.md` and the §12 + §14 sections of the wallet specification.

## Protected assets

| Asset | Location | Consequence of compromise |
|---|---|---|
| BIP39 seed phrase | Only in the user's possession (paper / hardware). Encrypted at rest in the vault. | Full loss of funds across every chain the wallet derives |
| Wallet master key | Derived from password via Argon2id; held in memory while unlocked | Decryption of the persisted vault → access to all private keys |
| Vault blob | `chrome.storage.local` (extension), IndexedDB (web), or encrypted file (desktop). AES-256-GCM with the master key | Offline access to the ciphertext. Still requires the password to decrypt |
| Session master key | `chrome.storage.session` (extension), OS keychain (desktop, optional), or in-memory (web). Cleared on browser close / tab close | Skips the Argon2id cost of re-unlocking. Not the raw password |
| User password | Never persisted. In memory only during unlock / sign, zeroed after use | Full access to every locked vault on the device |
| Connected-site grants | Persisted in the vault's `connectedSites` collection | Silent approval of dApp requests the user previously granted |

## In scope

### Browser-execution threats

- **XSS against the dApp bridge.** Mitigated by content-script isolation (extension) and CSP on the web app. `origin` is stamped by the content script. Never read from page content. Handled by `packages/extension/src/content/contentScript.js` and the bridge handler's `requireSite` check.
- **Malicious same-origin scripts in the web app.** The web shell's key isolation is fundamentally weaker than the extension's. Mitigations: short session lifetime (in-memory only; refresh = re-locked), no master key in `sessionStorage`, no third-party `<script>` tags on `wallet.xchain.io`, optional extension-detect banner that recommends the extension when installed.
- **Compromised extension page chrome.** The popup and approval window run in the extension's origin, isolated from page content. Password never leaves the approval window.

### Storage threats

- **Offline attacker with the encrypted blob.** Wallet is password-locked with Argon2id (calibrated to ≥ 750 ms per derivation on the device, floor 64 MiB × 3 iterations × 1 parallelism). Without the password, the blob is AES-256-GCM-protected.
- **Tampering with the ciphertext.** AES-GCM tag mismatch surfaces as an unlock failure. An attacker who modifies the blob cannot produce a valid plaintext that opens.
- **Key recovery from `chrome.storage.session`.** Session key is the derived master key (32 bytes), not the password. On browser close, the session namespace is cleared by Chrome. Attackers with runtime access to the session have already won; the line isn't held there.

### Network threats

- **MITM against SDK endpoints.** Every shell endpoint is HTTPS-by-default. Per-chain URLs live in the `ChainDescriptor` and are user-settable only via explicit Settings action.
- **Malicious Hub / Explorer.** Balances, UTXOs, and address-history reads are informational; a lying server can mis-report balances but cannot sign transactions. Signing paths never trust the server for destination / amount, both come from the user-authored Send form.
- **Malicious Encoder.** Returns a PSBT the wallet signs. Mitigation: the Send form renders a plain-English decoder summary (§30) BEFORE sign; the user sees `to`, `amount`, `asset` as they typed them, even if the encoder fabricates output bytes. Known gap: byte-level cross-check of encoder PSBT vs user intent is the next iteration of the safety rail.

### dApp-bridge threats

- **Origin spoofing.** Content script stamps `origin` from `window.location.origin` server-side; the bridge handler refuses requests without a stamped origin.
- **Approval bypass.** Every privileged method (`signMessage`, `signPsbt`, `signAction`, `sendAction`, `signIn`) routes through the approval window with explicit user confirmation. Per-origin grants (`connectedSites`) opt the user into "always allow" or "ask each time" per action.
- **Replay across origins.** `signIn` (Sign-In with XChain) bakes the origin and a nonce into the challenge prefix. The wallet refuses to sign a challenge whose `origin` doesn't match the stamped one.

### User-error threats

- **Forgotten password.** Irrecoverable without the recovery phrase. Onboarding copy states this explicitly. No "forgot password" link by design.
- **Lost recovery phrase.** Irrecoverable. The Create flow requires the user to acknowledge they've saved the phrase before persisting the vault, closing the tab at the mnemonic stage leaves no persisted wallet behind.
- **Phishing domain.** The extension-detect banner on the web app encourages users with the extension installed to use it (browser URL bar = trust anchor). Store-listing copy emphasizes the canonical domain.

## Out of scope

- **Zero-day browser sandbox escapes.** If the browser is compromised, so is the wallet. Users with extreme threat models should use air-gapped PSBT-QR flows (see [URI Schemes](URI_Schemes.md)) or hardware wallets.
- **Vendor firmware bugs.** Hardware-signer firmware (Trezor, Ledger) is out-of-scope for the wallet's audit; the wallet trusts the vendor's signed firmware.
- **Supply-chain attacks on vendored deps.** Mitigated by `pnpm audit --prod --audit-level=high` in CI + the per-dep review in `docs/DEPENDENCIES.md`. Reproducible builds (Level-2, see [Reproducible Builds](Reproducible_Builds.md)) narrow the blast radius; a verifier can prove the published artifact came from public source.
- **Physical access to an unlocked device.** No wallet can defend against this. Mitigations: foreground auto-lock (configurable in Settings) and manual lock action.
- **Raw-password attacks.** Outside the wallet's design; Argon2id raises the cost, the user's password choice does the rest.
- **Blockchain consensus.** The wallet trusts the platform's encoding / decoding / indexer logic and the underlying coin nodes' chain selection. The platform's correctness is audited separately.

## Sign-screen safety rails

Every signing surface; Send, Issue, Mint, Order, Dispenser, Dividend, Airdrop, Sweep, Stake, Delegate, Deploy, Execute, Deposit, Withdraw, Coinpay, Swap, Cross-chain, Multisig, is built on top of the same review pattern:

1. The user fills a form. The form's plain-English values are the canonical user intent.
2. The action descriptor encodes the intent into an XChain ACTION string.
3. `xchain-sdk` calls the encoder service to produce an unsigned PSBT.
4. The wallet *re-decodes* the action string with `core/src/decoder/actionDecoder.js` and renders the human-readable summary alongside the PSBT.
5. The user reviews the form values **and** the decoded summary (both must match) and confirms.
6. The signer signs the PSBT.

This means: even if the encoder is malicious and fabricates PSBT bytes, the user sees `to`, `amount`, `asset`, etc., reflected back from their own form input. The safety rail is *user-visible*: a mismatch is something a careful user can catch by eye.

The next iteration adds a byte-level cross-check that re-decodes the encoder's PSBT and compares it to the user's intent automatically, raising the rail from "user-visible" to "wallet-enforced".

## Audit posture

The wallet is pre-v1.0 GA at `1.0.0-rc.6`. Two external audits are queued before GA:

- **Security audit.** Cryptography (xchain-sdk MuSig2 + signEcdsa + ECPair / WIF / KDF), wallet flows (unlockWallet, signers, multisig session state machine, signMultisigPsbt path), shell IPC (extension service-worker boundary, desktop main / preload / renderer split). Audit-readiness packet at `claude/reports/specs/2026-04-24_security-audit-readiness.md` in the platform repo (gitignored).
- **Accessibility audit.** Color contrast, focus-visible, live-region timing, keyboard traps, screen-reader walkthroughs (NVDA + JAWS + VoiceOver), reduced-motion verification, touch-target sizing per WCAG 2.5.5, forced-colors / Windows high-contrast, reflow + zoom per WCAG 1.4.10. WCAG 2.2 AA target. Audit-readiness packet at `claude/reports/specs/2026-04-24_a11y-audit-readiness.md`.

Static gates run on every commit and protect against regressions in both surfaces between audits:

- `packages/core/scripts/a11y-audit.js`: five-rule mechanical scan over every shared route + UI primitive
- `packages/core/scripts/extension-manifest-audit.js`: 11-rule MV3 manifest audit
- `packages/core/scripts/repro-build-audit.js`: 18-rule reproducible-build scaffolding audit
- `packages/core/test/release-gates.smoke.js`: release readiness check

## Disclosure

Pre-GA: report security issues to `security@dankest.llc`. Audit findings will be coordinated with the external auditor on a 90-day responsible-disclosure window for High+ severity, with public disclosure timed to GA release notes.

Post-GA: the same channel; full disclosure policy lands with the v1.0.0 GA cut.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
