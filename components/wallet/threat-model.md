<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/Threat_Model.md @ 34639117 (worktree dirty) -->

# Threat Model Detail

[Security & Threat Model](security.md) covers the wallet's protected assets, its in-scope and out-of-scope threats, the sign-screen safety rails, and its audit posture. This page is the companion to that one: it does not repeat that ground. Instead it walks through specific attacker scenarios and their mitigations, and tracks the open items that follow from them. Read [Security & Threat Model](security.md) first if you haven't.

Nothing here is secret. The goal, on both pages, is a posture that's reviewable from the outside.

## Attacker scenarios

### A malicious dApp requesting every permission

**Attack.** A dApp calls `connect()` with an aspirational list of requested chains, followed by `signAction` calls on unsupported or destructive action kinds.

**Mitigations.**

- The connect approval screen defaults to nothing checked when a dApp requests a set of chains; the user must opt in per chain.
- Per-action "always allow" permissions start empty at connect time; it is its own opt-in at sign time.
- The bridge handler returns `UNSUPPORTED_ACTION` for any action kind the wallet doesn't yet support, no approval popup opens at all in that case.
- Sign approvals render the decoded action in plain English, with warnings for suspicious parameters.

### A password-guessing offline attacker

**Attack.** An attacker steals the vault blob plus its key-derivation parameters and brute-forces the password offline.

**Mitigations.**

- Argon2id with a 64 MiB memory floor and at least 3 iterations, calibrated per device to target roughly one second of derivation time on the user's own machine.
- No password hint is ever stored on-device.
- No account lockout or rate-limiting exists, because it would be irrelevant against an offline attack. Defender effort goes entirely into raising the Argon2id cost instead.

### A spoofed approval-window overlay

**Attack.** A malicious page renders a lookalike "Approve" overlay to trick the user into confirming a different payload than the real one.

**Mitigations.**

- The approval popup is a real, OS-rendered window with its own origin, separate from the page. The operating system renders its chrome, not the page's own content.
- Every approval fetches its parked request by an id the broker issued; the page cannot forge a request id that the broker has already accepted.
- Closing the approval window counts as a rejection. A closed window can never consent.

### A compromised encoder swaps an output

**Attack.** The encoder service returns a PSBT with a swapped destination or amount.

**Mitigations, partial.**

- The sign screen renders the user's stated destination, amount, and coin from their own form, not the encoder's values. If the two diverge, the user has the information needed to notice.
- **Known gap.** There is no byte-level PSBT inspection before signing yet. A planned simulator would parse the PSBT and show "this transaction sends X to Y" independently of what the user typed, closing this from a user-visible rail to a wallet-enforced one.

### Development-mode addresses reaching mainnet

**Attack.** A user onboards under a development build that fell back to a mock SDK, generates addresses under that mock, receives real funds to them, then loses access once the real SDK replaces the mock.

**Mitigations.**

- The development-mode SDK fallback is explicitly flagged "do not use for mainnet" inline in the code paths that can reach it.
- Falling back to the mock fires a visible console warning that signing and broadcast will fail.
- Production builds pin the real SDK as a dependency; the fallback path should never trigger in a packaged release, and a build-time check greps for the fallback marker as a pre-release gate.

### The same balance approved twice in two windows

**Attack.** Two confirmation surfaces are open at once against one balance, and each is told the full amount is available, so both get approved and the second transaction is rejected on-chain after the user already authorized it. A dApp can arrange this deliberately, since the approval broker allows multiple concurrent approval windows by design, one per request.

**Mitigation, and where it does not hold.** A pre-flight reservation ledger registers an approved-but-not-yet-broadcast amount, so a second window nets it out of its own balance check and warns the user. That ledger lives inside the background host each shell runs, so the protection is only as wide as that host:

- **Extension: protected.** One service worker serves every popup window, so all windows share one ledger, and it survives a worker restart because it persists to session storage.
- **Web: not protected.** The web shell builds a background host per page. Two browser tabs are two separate JavaScript contexts and therefore two independent ledgers, with no cross-window protection at all. Two tabs can each approve against the full balance.
- **Desktop:** the ledger is in-memory per renderer host; the same limit applies to genuinely separate windows.

This is a real limit on the protection, not a gap in its tests: the extension's test suite is the only place the guarantee is currently exercised, and a green run there says nothing about the web shell. Closing it for the web shell needs a cross-tab channel, which does not exist yet.

The residual risk is bounded either way: the worst case is a rejected transaction and its miner fee, not stolen funds. Nothing in this scenario lets a third party move value; both approvals are the user's own.

## Known open items

These are tracked but not release-blocking; each has a short pointer to where the work would land.

| Item | Status |
|---|---|
| PSBT byte-level simulator before sign | Planned, next iteration of the sign-screen safety rail |
| Hardware-wallet transport coverage | Ongoing, expands with each hardware signer added |
| Background-mediated auto-lock that survives popup close/reopen | Tracked in the changelog |
| Reproducible-build pipeline | Live for desktop; extension and web tracked in [Reproducible Builds](reproducible-builds.md) |
| External security review | Pending, required before a general-availability mainnet release |
| Cross-tab reservation ledger for the web shell | Open; the extension shell is protected, the web shell is not (see the scenario above) |

## Verification

Every claim on this page and on [Security & Threat Model](security.md) is meant to be checkable against the wallet's own source and test suite, not just asserted in prose. As examples: content-script and bridge isolation is exercised by the bridge end-to-end test suite, AES-GCM and Argon2id handling by the unlock-flow tests, decoder warnings by the action-decoder tests, and onboarding's acknowledge-before-persist behavior by the onboarding tests. A reviewer can confirm any specific claim by reading the cited behavior in the wallet's public repository and running the corresponding test.

## Change review cadence

This page, and [Security & Threat Model](security.md), are updated:

- Before each release, as part of the release checklist.
- After any security-adjacent change to crypto, storage, or the bridge, with the reviewer confirming the relevant mitigations still match the code.
- After any reported incident, even one that turned out to be out of scope, to capture the scope-boundary reasoning for future readers.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
