<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Testing

The wallet's test strategy combines headless unit tests (vitest), headless smokes (plain Node), browser-driven E2E (Playwright), static audit gates (a11y, manifest, repro-build), and a reference test-dapp for manual bridge runbooks.

## Smoke suite

`pnpm test:smoke` (run from the workspace root) runs the full smoke suite via Node. **365 smoke files** run; CI fails on any regression.

The smokes are deliberately *static*; they exercise component imports, render trees, registry validation, schema migrations, and audit scripts without spinning up real backends. They run in seconds and gate every commit.

Counts below are file counts per `test/smoke/` subdirectory, measured 2026-07-27.

| Group | Files | Coverage |
|---|---|---|
| `ui/` | 170 | Screens, layouts, and UI primitives: render trees, empty and error states, QR transport, capslock and paste handling, confirm-screen composition, reduced-motion behaviour |
| `actions/` | 37 | Per-action authoring forms and their validation, one file per action surface (`airdrop-form`, `batch-composer`, `broadcast-form`, `address-preferences`, …) |
| `audits/` | 28 | a11y-audit, repro-build-audit, extension-manifest-audit, release-gates, and the other static gates |
| `core/` | 26 | Registry validation, schema migrations, shared helpers |
| `markets/` | 14 | DEX surfaces |
| `bridge/` | 12 | `window.xchain` dApp bridge and the approval broker |
| `signers/` | 12 | Software, Trezor, Ledger, Remote, Multisig, hw-factories, hw-sign-e2e, signer-port-protocol |
| `shells/` | 11 | Web SPA, extension popup/full-screen/side-panel, desktop |
| `multisig/`, `onboarding/`, `staking/` | 8 each | Classical n-of-m + MuSig2, vault creation and import, staking and delegation |
| `dispensers/`, `contracts/` | 7, 6 | Dispenser lifecycle; contract deploy/execute surfaces |
| `addresses/`, `security/`, `governance/`, `messaging/` | 5, 4, 3, 3 | Address list, security gates, governance polls, encrypted messaging |
| `wallet/`, `desktop/`, `docs/` | 1 each | Vault, Electron shell, docs conformance |
| **Total** | **365** | All run on every commit |

The test files live under `test/smoke/` (workspace root), organised into subdirectories by surface area. Each smoke is named for the surface it covers (`send-form.smoke.js`, `multisig-signing.smoke.js`, etc.); the convention makes it easy to find the right file when extending coverage.

## Vitest suites

Beyond the smokes, the wallet runs eight vitest suites. Measured 2026-07-27:

| Suite | Command | Tests |
|---|---|---|
| Unit | `pnpm test:unit` | 4,264 across 291 files |
| Integration | `pnpm test:integration` | 80 |
| Boundary | `pnpm test:boundary` | 49 |
| Security | `pnpm test:security` | 30 |
| Chaos | `pnpm test:chaos` | 16 |
| Fuzz | `pnpm test:fuzz` | 10 |
| Accessibility | `pnpm test:a11y` | 8 |
| Regression | `pnpm test:regression` | 4 |

`pnpm test:all` chains all of them plus the smoke suite, for a wallet total of 4,825 tests.

## Audit gates

Three static audits run as part of the smoke suite. CI fails if any audit surfaces violations.

### A11y audit (`a11y-audit.js`)

Five rules over every JSX file under `packages/core/src/shared/` + `packages/core/src/ui/`:

| Rule | What it requires |
|---|---|
| `button-needs-text-or-aria-label` | Every `<button>` has visible text, an aria-label, or a presumed-text expression child |
| `img-needs-alt` | Every `<img>` has an `alt` attribute |
| `input-needs-label` | Every `<input>` has a `label` / `aria-label` / `aria-labelledby` / `placeholder` / matching `<label htmlFor>` |
| `textarea-needs-label` | Same for `<textarea>` |
| `div-onclick-needs-role` | Every `<div onClick>` has `role` + `tabIndex` |

The audit walks JSX tags with a brace-balancing reader so `onClick={(e) => ...}` doesn't trip the parser. The button rule accepts both static text content AND any bare-identifier or string-literal expression child: `{p.label}`, `{busy ? 'Loading…' : 'Save'}`, or `Send` all count.

What this audit covers: structural a11y over all JSX files under `packages/core/src/shared/` and `packages/core/src/ui/`; 0 violations at v0.333.0.

What this audit does **not** cover (queued for the external a11y audit): color contrast, focus-visible styling, live-region timing, keyboard traps, screen-reader walkthroughs.

### Extension manifest audit (`extension-manifest-audit.js`)

11 rules covering MV3 compliance + version-derivation + privacy-friendly permissions. See [Build & Release; Extension version derivation](Build_Release.md#extension-version-derivation) and [Shell (Extension) Manifest](Shell_Extension.md#manifest).

### Repro-build audit (`repro-build-audit.js`)

18 rules covering Dockerfile / build.sh / reproduce.sh / electron-builder.config.cjs / Reproducible_Builds.md. See [Reproducible Builds; Scaffolding audit](Reproducible_Builds.md#scaffolding-audit).

### Release gates smoke

`release-gates.smoke.js` rolls up all of the above into a single "is this commit GA-shippable" check. Used by the maintainer at release-tag time as a final pre-flight.

## Playwright E2E

`pnpm --filter @xchain-wallet/e2e test` runs the Playwright suite against the web SPA. Three specs:

- `tests/onboarding.spec.js`: create + lock + unlock round-trip; wrong-password error; import (BIP39 test vector); import word-count validation
- `tests/send-form.spec.js`: review stage round-trip; protocol-memo char rejection; zero-amount rejection; broadcast surfaces the SDK-stub error (proves no hang)
- `tests/a11y.spec.js`: `@axe-core/playwright` scans every rendered Phase-1 screen for WCAG 2.1 A/AA violations

The Playwright config spawns Vite's dev server at `http://localhost:5173` via `pnpm -C ../../packages/web dev`. If the dev server is already running, `reuseExistingServer: !CI` picks it up so the suite doesn't fight for the port.

```bash
pnpm --filter @xchain-wallet/e2e install:browsers   # one-time browser download
pnpm --filter @xchain-wallet/e2e test
```

What's not in Playwright today: real signing + broadcast (the web shell ships a dev-only SDK stub for browsing without a regtest stack); dApp-bridge flows (covered by the headless `bridge-e2e.smoke.js` and the manual test-dapp runbook). Both are tracked for post-GA iteration.

## Bridge E2E

`bridge-e2e.smoke.js` exercises the full `window.xchain` bridge against the test-dapp's mock provider in node. Coverage:

- `connect` with origin grant
- `getAccounts` / `getBalances` / `getSupportedChains`
- `signMessage` round-trip
- `signPsbt` with input ownership resolution
- `signAction` happy path + `EActionUnsupported` deferral
- `sendAction` happy path
- `signIn` with challenge format + expiry validation
- Per-origin permission policy enforcement (`always` / `ask` / `never`)
- Approval popup routing for every privileged op

The headless suite catches regressions on every commit. The manual `packages/extension/docs/TEST_DAPP_RUNBOOK.md` complements it by exercising real Chrome runtime behaviors (extension message ports, content-script origin stamping, popup window lifecycle).

## Hardware signer E2E

`hw-sign-e2e.smoke.js` and `hw-factories.smoke.js` cover the Trezor + Ledger signer factories without a connected device. They:

- Validate the factory's `displayName()` / `id()` / `firmwareVersion()` interface
- Verify `trezorFormat.js` / `ledgerFormat.js` produce vendor-shaped PSBT inputs from XChain PSBTs
- Verify the deferral envelopes for unsupported ops (MuSig2, etc.) match the bridge's `ESignerDeferred` error code

Real-device coverage is manual and runs against the maintainer's test fleet before each release.

## Multisig coverage

| Smoke | Covers |
|---|---|
| `multisig-create.smoke.js` | Create flow: chain pick, threshold, cosigner addition, address derivation, persistence |
| `multisig-multi-config.smoke.js` | Schema v2 per-address multi-config support |
| `multisig-signing.smoke.js` | Session state machine: created → collecting → ready → finalized → broadcast → indexed |
| `multisig-signer.smoke.js` | `MultisigSigner` orchestration over an underlying `SoftwareSigner` |
| `multisig-psbt-signing.smoke.js` | Classical n-of-m PSBT combine + finalize via `xchain-sdk` `wallet.signMultisigPsbt` |
| `multisig-psbt-qr.smoke.js` | Chunked PSBT-QR encode / decode round-trip |
| `multisig-address.smoke.js` | BIP48 address derivation from threshold + cosigners |
| `multisig-badge.smoke.js` | UI badge rendering on multisig addresses |

The coverage runs end-to-end against software signers; hardware-signer multisig coverage is the next iteration once vendor-API surfaces stabilize.

## Repro-build verification

The byte-for-byte verification is **manual** and run on a clean dev machine. See [Reproducible Builds; Run-twice verification protocol](Reproducible_Builds.md#run-twice-verification-protocol). It's not part of the per-commit smoke suite because it requires a clean Docker host that the development environment doesn't always have. The scaffolding audit catches regressions in the inputs to reproducibility automatically; the full verification runs at release-tag time on at least two independent dev machines.

## What the smokes do not cover

- **Live regtest signing + broadcast.** The web shell's Playwright suite uses an SDK stub. Real signing + broadcast coverage moves to a sibling spec once `xchain-sdk` is bundled into the shell.
- **Hardware-signer device interaction.** Mocked at the format-adapter layer; real-device coverage is manual.
- **Cross-shell remote-signer round-trip.** Pair + sign over a real channel is exercised manually; the unit-level `signer-port-protocol.smoke.js` covers the envelope.
- **OS keychain integration.** Mocked in `desktop-keychain.smoke.js`; real Keychain Access / Credential Manager / Secret Service interaction is verified manually per platform.
- **Chrome runtime APIs.** `chrome.storage.local` / `chrome.storage.session` / `chrome.runtime.sendMessage` are mocked by the smoke harness. Real extension behavior is verified by loading the unpacked extension and walking the `TEST_DAPP_RUNBOOK.md`.
- **Real device cameras.** `getUserMedia` is mocked; actual scanner behavior is verified manually with a real device camera.

These gaps live with the maintainer's manual QA checklist and are exercised before each release-tag.

## Adding a smoke

When adding a new route, primitive, signer, flow, or audit:

1. Create `test/smoke/<group>/<surface>.smoke.js`
2. Import the surface and exercise its public API + render path
3. Use the existing harnesses (`a11y-harness.smoke.js`, `e2e-harness.smoke.js`, `setup.js`) where they apply
4. The runner (`test/smoke/_run-smokes.js`) discovers all `*.smoke.js` files recursively; no manifest to update
5. Verify locally with `pnpm test:smoke` from the workspace root
6. The smoke count in the next CHANGELOG entry should reflect the new total

## Continuous integration

Pre-GA, CI runs:

- `pnpm install --frozen-lockfile` at the workspace root
- `pnpm typecheck` across all packages with declared typecheck scripts
- `pnpm test:smoke`: 250+ smokes
- `pnpm --filter @xchain-wallet/e2e test` (in a Playwright-capable runner)

CI is intentionally minimal pre-GA per the wallet's "no GitHub Actions during build phase" convention. The smoke suite + Playwright + the audit gates are the verification mechanism; the maintainer runs them locally on every commit and the smokes block tag-time. A full CI lift lands alongside v1.0.0 GA.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
