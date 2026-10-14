<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- reviewed 2026-10-13 against xchain-wallet origin/develop @ 348b3a369b6b -->

# Threat Model Detail

[Security & Threat Model](security.md) covers the wallet's protected assets, its in-scope and out-of-scope threats, the sign-screen safety rails, and its audit posture. This page is the companion to that one: it does not repeat that ground. Instead it walks through specific attacker scenarios and their mitigations, and tracks the open items that follow from them. Read [Security & Threat Model](security.md) first if you haven't.

Nothing here is secret. The goal, on both pages, is a posture that's reviewable from the outside.

## Attacker scenarios

### A malicious dApp requesting every permission

**Attack.** A dApp calls `connect()` with an aspirational list of requested chains, followed by `signAction` calls on unsupported or destructive action kinds.

**Mitigations.**

- The normal connect approval screen preselects the chains the dApp requested and the primary account. The user can remove either scope and must still press Approve. If the request names no chains, no chain starts selected.
- Connect grants set message signing to false and the per-action signing map to empty. An "always allow" action grant is stored only after that action is approved and submitted successfully.
- The bridge handler returns `UNSUPPORTED_ACTION` before opening a popup for any action outside its supported action list.
- Supported `SEND` and `SWEEP` approvals render the normalized protocol payload in plain language and project balance changes when the balance read succeeds.
- Developer-mode localhost auto-connect and auto-sign are separate, off-by-default settings. Auto-sign also requires a positive cache timeout and reuses only a password already entered during the current session.

### A password-guessing offline attacker

**Attack.** An attacker steals the vault blob plus its key-derivation parameters and brute-forces the password offline.

**Mitigations.**

- New shell vaults use Argon2id with a fresh 16-byte salt, 64 MiB of memory, 3 iterations, and one lane. The core also has a per-device calibration helper, but the current shell onboarding handlers pass the floor parameters directly. The wallet created or imported during onboarding is sealed with the same password and parameters, so a stolen vault master key also opens that wallet's seed without the password; see [Security & Threat Model](security.md#protected-assets).
- No password hint is ever stored on-device.
- Repeated bad passwords trigger an escalating delay: the third failure waits 5 seconds, then 15 seconds, 60 seconds, 5 minutes, and a 15-minute cap from the seventh failure onward. Extension and desktop enforce a persisted throttle before running Argon2id; web and mobile enforce the same ladder in the lock screen, so a caller that bypasses that UI can still attempt a full-cost derivation.
- These delays slow attempts through the wallet but cannot rate-limit an attacker working on a stolen blob. The Argon2id cost remains the offline defense.

### A spoofed approval-window overlay

**Attack.** A malicious page renders a lookalike "Approve" overlay to trick the user into confirming a different payload than the real one.

**Mitigations.**

- The extension opens `approval.html` as a browser popup under the extension origin. Page content cannot draw inside or message that extension document.
- The background broker parks each request under a random UUID, and the popup fetches that exact broker-owned request before rendering it.
- Closing the approval window counts as rejection. The broker also rejects a request after five minutes, when its requester tab closes, when the wallet locks, or when the extension runtime suspends.

### A compromised encoder swaps an output

**Attack.** The encoder service returns a PSBT with a swapped destination or amount.

**Mitigations, with one bridge limit.**

- The shared `composeActionForConfirm` path composes one PSBT in the host, decomposes it, and refuses an unexpected, missing, or wrong-value output. It also compares the action bytes carried by the PSBT with the action string that was composed. Taproot envelope flows check the reveal transaction too.
- A confirmation screen using that path receives the verified PSBT, a decoded intent, projected balance changes, and exact fees when they can be derived. Approval signs the same prebuilt PSBT byte-for-byte instead of asking the encoder to rebuild it.
- **Known limit.** Extension bridge `signAction` supports `SEND` and `SWEEP`, shows their normalized intent first, then builds and signs after approval through the atomic submission path. That path does not run the in-wallet confirmation pipeline's output-set and action-byte checks against the encoder result.

### Development-mode addresses reaching mainnet

**Attack.** A user mistakes a development build's fabricated addresses and balances for live network data, or expects that build to sign and broadcast a real transaction.

**Mitigations.**

- Web development and test builds select the mock deliberately unless `VITE_XCHAIN_REAL_SDK=1` selects the real SDK. The extension can fall back to the mock when its real SDK is unavailable in a non-production build. Desktop refuses to start without the real SDK.
- Mock addresses contain a visible `devmock` marker and are not valid on-chain addresses. The mock also warns in the console, serves fabricated balances, and refuses signing and broadcast, so it cannot receive or move mainnet funds.
- Production web and extension builds remove the mock branch. Their build scripts run `tools/build-reproduce/check-no-dev-mock.sh`, which fails if an executable bundle still contains the mock implementation or warning marker. A production real-SDK load failure is fatal rather than a fallback.

### The same balance approved twice in two windows

**Attack.** Two confirmation surfaces are open at once against one balance, and each is told the full amount is available, so both get approved and one transaction can be rejected on-chain after the user already authorized it.

**Mitigation, and where it does not hold.** At approval, the shared confirmation flow can reserve exactly one non-native token debit derived from its balance simulation. A later pre-flight nets that hold out of the available balance. For a single-leg `SEND`, unconfirmed `PendingTx` records continue the deduction after signing until the indexed balance includes the spend. Native-coin debits, multi-token debits, and simulations without exactly one readable token debit are not reserved.

- **Extension confirmation flows: shared.** One service worker serves every popup window, so eligible confirmation flows share one ledger, and it survives a worker restart because it persists to session storage.
- **Web: not shared across tabs.** The web shell builds a background host per page. Two browser tabs are two separate JavaScript contexts and therefore two independent ledgers. Two tabs can each approve against the full balance.
- **Desktop: shared while the app runs.** Every renderer window talks to the single main-process runtime and MessageHost, so eligible confirmation flows share its in-memory ledger. It does not persist across process restart.
- **dApp bridge approvals: not reserved.** `SignApproval` resolves the user's decision directly and does not register a reservation through the shared confirmation hook. Concurrent bridge `signAction` requests therefore do not gain this protection.

The extension end-to-end test exercises the single-token race because extension popups share a service worker. A green run there says nothing about separate web tabs. Closing the web gap needs cross-tab coordination, which the current web host does not implement.

Nothing in this scenario grants a third party a new destination or amount: both transactions still reflect the user's approvals. The failure mode is over-authorization against stale available balance, commonly followed by one conflicting transaction failing, not silent redirection of funds.

## Known open items

These are the remaining limits visible in the current implementation.

| Item | Status |
|---|---|
| Bridge `signAction` encoder-result verification | Open; `SEND` and `SWEEP` use the post-approval atomic submission path rather than the tamper-checked in-wallet confirmation pipeline |
| Hardware-wallet transport coverage | Web and desktop support Ledger and Trezor; the MV3 extension supports Ledger only; mobile WebViews support neither transport |
| Reproducible-build publication | Deterministic build procedures cover Linux desktop, extension, and web; per-release extension and web manifests, other desktop operating systems, and iOS archive reproducibility remain limited as described in [Reproducible Builds](reproducible-builds.md) |
| External security review | Pending, required before a general-availability mainnet release |
| Reservation coverage | Open for separate web tabs, dApp bridge approvals, native-coin spends, and multi-token spends; eligible extension and desktop confirmation flows share a host |

## Verification

Every claim on this page and on [Security & Threat Model](security.md) is meant to be checkable against the wallet's own source and test suite, not just asserted in prose. The bridge end-to-end test suite covers connect, unsupported actions, and close-as-reject behavior. The unlock-flow tests and unlock-throttle tests cover AES-GCM authentication, Argon2id use, and rate limits. The action-decoder tests plus `test/unit/flows/confirmChecks.test.js` and `test/unit/flows/composeActionForConfirm.test.js` cover readable intent and encoder-tamper refusal. The onboarding tests cover the persist boundary, while `test/unit/flows/reservationLedger.test.js` and the extension reservation-race test cover the shared-ledger behavior and its shell boundary. Run the relevant groups with `pnpm test:unit`, `pnpm test:smoke`, or `pnpm test:e2e:regtest` from the wallet repository.

## Change review cadence

This page, and [Security & Threat Model](security.md), are updated:

- Before each release, as part of the release checklist.
- After any security-adjacent change to crypto, storage, or the bridge, with the reviewer confirming the relevant mitigations still match the code.
- After any reported incident, even one that turned out to be out of scope, to capture the scope-boundary reasoning for future readers.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
