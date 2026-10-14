<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Testing

The wallet uses Vitest for unit and focused test tiers, standalone Node scripts for smoke coverage, Node's built-in test runner for developer tools, and Playwright for browser and live-chain end-to-end coverage. Run commands from the wallet workspace root unless a command says otherwise.

## Test suites

| Suite | Command | Discovered tests |
|---|---|---|
| Unit | `pnpm test:unit` | `test/unit/**/*.test.{js,jsx}` |
| Smoke | `pnpm test:smoke` | `test/smoke/**/*.smoke.js` |
| Integration | `pnpm test:integration` | `test/integration/**/*.test.{js,jsx}` |
| Security | `pnpm test:security` | `test/security/**/*.security.test.{js,jsx}` |
| Fuzz | `pnpm test:fuzz` | `test/fuzz/harness/**/*.fuzz.js` |
| Regression | `pnpm test:regression` | `test/regression/**/*.regression.test.{js,jsx}` |
| Boundary | `pnpm test:boundary` | `test/boundary/**/*.test.{js,jsx}` |
| Chaos | `pnpm test:chaos` | `test/chaos/**/*.test.{js,jsx}` |
| Accessibility | `pnpm test:a11y` | `test/a11y/**/*.a11y.test.{js,jsx}` |
| Tools | `pnpm test:tools` | `tools/**/*.test.mjs` |

Each Vitest tier has its own config under `test/vitest/`, so adding a test category does not silently expand another suite. The configs use a fork pool capped at the smaller of eight workers or one fewer than the available processors, with a minimum of one. The unit command on `origin/develop` does not pass Vitest's `--shard` option and CI does not define a unit shard matrix, so the current unit suite is worker-bounded rather than sharded.

The smoke runner discovers files recursively and runs them sequentially, stopping on the first failure. Smokes are static wiring, source, artifact, and audit checks rather than browser tests. Some smokes inspect the published documentation sibling; CI checks that repository out and points `XCHAIN_DOCS_ROOT` at it so those checks cannot silently disappear.

`pnpm test:all` runs unit, smoke, integration, boundary, chaos, fuzz, regression, security, accessibility, and tools in sequence. The shorter `pnpm run ci` gate runs unit, integration, security, fuzz, smoke, and tools. `pnpm run ci:full` mirrors the broader GitHub workflow, including regression, build checks, coverage, boundary, chaos, accessibility, and Playwright.

## Playwright E2E

The root command is:

```bash
pnpm exec playwright install --with-deps chromium  # first run
pnpm test:e2e
```

`pnpm test:e2e` uses `test/e2e/playwright.config.js`. It drives the web SPA through Vite at `http://localhost:5173`, selects the dev-mock SDK explicitly, and runs one worker so tests do not share vault state accidentally. CI starts a fresh server; a local run can reuse a server already listening on the configured port.

The default config runs ordinary specs under `test/e2e/tests/` in one project named `chromium`, using Playwright's `Desktop Chrome` device descriptor. It excludes `*.regtest.spec.js`, `*.testnet.spec.js`, and `*.extension.spec.js`, which have their own configurations. On a macOS host the desktop browser runs with the host platform, so Playwright's `ControlOrMeta` shortcut resolves to Command and the keyboard-shortcut specs exercise the macOS binding.

Additional root commands select the live-chain configurations:

```bash
pnpm test:e2e:regtest
pnpm test:e2e:testnet
```

The E2E package also exposes `pnpm --dir test/e2e test:extension` for the extension configuration. The regtest suite signs and broadcasts against its configured venue. The testnet suite uses public testnet services and accepts treasury input through standard input; see `test/e2e/README.md` in the wallet repository before running either live suite.

### Android smoke project status

The default Playwright config on `origin/develop` does not define an `android-lg-k51-smoke` project. It also does not define a 412 by 869 viewport, a Chrome 102 user agent, or `@smoke` and `@lg-k51` tag selection. Those names and values must not be treated as an active gate until they exist in the wallet configuration and tagged specs.

The current optional LG K51 venues are named `android-lg-k51`. The layout, axe, and click-crawl configurations use a 411 by 814 CSS viewport at a 1.75 device scale factor. These are audit venues and are not part of `pnpm test:e2e`.

## Layout and style-guide guards

The layout sweep walks reachable wallet screens at Android, iPhone, iPad, and optional Electron desktop sizes. It records measurements and a screenshot for each screen, including horizontal page scroll, off-screen or clipped controls, unreachable content, nested scrollers, and lists or cards that fail to fill the usable content width. Findings go into JSON Lines output for a person to review; the sweep deliberately does not turn every finding into a test failure.

Run the web and desktop sweeps separately:

```bash
pnpm --dir test/e2e exec playwright test --config playwright.layout.config.js
pnpm --filter @xchain-wallet/desktop build:renderer
pnpm --dir test/e2e exec playwright test --config playwright.layout-desktop.config.js
```

### Visual checks

Before a layout batch lands, compare every affected screen against `develop` at phone, landscape, side panel, extension popup, and desktop sizes. Review the comparisons screen by screen, then delete the comparison screenshots.

Two automated guards complement the sweep:

- `test/unit/ui/pageTemplates.test.jsx` keeps page-gutter ownership in `Screen`, verifies the compact, rail, full, and short-landscape token values, keeps scrolling and stable scrollbar space on the screen body, and rejects route template roots that add their own page geometry.
- `test/smoke/ui/settings-mobile-layout.smoke.js` requires Settings control rows, labels, and fixed-width text or number inputs to become fluid and wrap below 480 CSS pixels without stretching checkbox, radio, or range controls.

The development style guide lives at `/style-guide/` on the web dev server. Unit tests keep its sections, exported UI primitives, state matrix, tokens, terminology, and Chrome 102 browser-floor guidance synchronized with implementation. `origin/develop` does not contain Playwright `toHaveScreenshot` assertions or committed style-guide screenshot baseline assets, so visual baseline comparison is not a current gate.

## Build size budget

The web Vite build enforces a 1,000,000-byte ceiling on the emitted main `index` entry chunk. The build fails if that chunk is missing or exceeds the ceiling. `test/smoke/audits/web-entry-chunk-size.smoke.js` pins the limit, checks that the plugin measures emitted bytes, and verifies that QR encoding remains in a route-loaded chunk. The root build command runs the package build, so this budget is enforced by the build job as well as checked structurally by the smoke suite.

This is the only explicit bundle-size ceiling on `origin/develop`; the extension and desktop Vite configs do not declare additional byte budgets.

## CSS and WebView compatibility

Chrome 102 is the oldest supported Android WebView engine described by the style guide. Compatibility is guarded at several levels:

- `test/unit/web/cssCompatibilityAudit.test.js` checks the Chrome 102 CSS auditor against unsupported feature families and verifies that Settings CSS supplies fallbacks or matching `@supports` guards.
- `test/unit/ui/pageTemplates.test.jsx` rejects unguarded `:has()` selectors across core CSS modules.
- The web build's `colorMixFallback` PostCSS plugin generates fallback declarations for engines that do not support `color-mix()`.
- `test/smoke/audits/webview-compat.smoke.js` scans production CSS and JavaScript for guarded dynamic viewport units, `:has()`, container queries, and `structuredClone()`. It also pins the ES2022 build target, the pre-bundle check for `Object.hasOwn` and `Array.prototype.at`, and an iOS deployment target of 16 or newer.

The wallet therefore has a concrete Chrome 102 CSS audit and an iOS 16 WebView floor. It does not have a separately named Safari 16 CSS-audit helper on `origin/develop`; Safari-specific semantic list-role behavior is covered by `test/unit/ui/nativeRoleAudit.test.js`.

## Adding coverage

Add a test under the directory and filename pattern owned by its suite. Smoke files need no manifest entry because `_run-smokes.js` discovers every `*.smoke.js` below `test/smoke/`. Add browser flows to the default Playwright suite only when they can run against the dev-mock SPA; signing, broadcast, extension-runtime, and public-testnet behavior belongs in the matching dedicated configuration.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
