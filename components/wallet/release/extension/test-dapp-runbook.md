<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/packages/extension/docs/TEST_DAPP_RUNBOOK.md @ 34639117 (worktree dirty) -->

# Testing a dApp connection against the browser extension

A manual pass that exercises the extension's dApp bridge end to end, against a real browser profile with the packaged extension loaded. It complements automated background-flow tests, which cover the same request and response shapes in isolation; this is the equivalent trip through the live browser UI.

Run this before tagging a release candidate, and after any change that touches the bridge handlers, the approval flow, the content script or injected provider, or the message routing between them.

## Prerequisites

- **Node.js** 22 (22.x LTS); Node 18 fails on the `mariadb` ESM package (`ERR_REQUIRE_ESM`); Node 24 cannot build `isolated-vm`. Node 22 is required.
- pnpm at the major the wallet repo pins in its root `package.json` `packageManager` field (`pnpm@11.8.0` as of 2026-08-24). pnpm 9 cannot re-resolve that workspace, so the `pnpm install` below fails on it.
- A regtest XChain stack running locally, so the local coin-node endpoints the wallet talks to respond.
- A Chromium-family browser: Chrome, Edge, Brave, and Arc all work, since the Manifest V3 contract is the same across them.

## 1. Build and load the extension

```bash
pnpm install
pnpm -C packages/extension build
```

Build artifacts land in `packages/extension/dist/`:

- `manifest.json`
- `background.js`, `content/contentScript.js`, `inject/xchainProvider.js`
- `popup.html` and `approval.html`, plus hashed JS assets
- icons

In the browser:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on.
3. Click **Load unpacked** and select `packages/extension/dist/`.
4. Pin the XChain Wallet action icon so the popup is one click away.

## 1b. Running this against a store-installed build

Everything above builds the extension locally and loads it unpacked, which is right for development and **wrong for the release exit criterion**. The store-release ceremony requires connect and sign to be driven from the build the store actually served, because that is the only version of this walkthrough that proves the shipped artifact signs: a local build can differ from the uploaded one, and a development server can silently substitute a mock SDK, so an unpacked run can pass while the published extension is broken.

When you are here for that criterion rather than for development, replace section 1 with:

1. Open the unlisted item's direct store link in the browser profile you are testing with, and install it from there. Not a sideload, not a re-load of `packages/extension/dist/`.
2. Confirm on `chrome://extensions` that the entry shows the store item, not an unpacked one: it has the store item's own identifier, and no "Load unpacked" origin.
3. Pin the action icon as above.

The rest of this page then applies unchanged, with two differences worth knowing before you start:

- **The extension's origin is the store-assigned identifier**, so any origin you see in an approval popup or in developer tools is `chrome-extension://<id>/` with the real identifier rather than a locally generated one.
- **Seeding a wallet (section 2) is the same operation but a different route**: a store build has no development origin to seed through, so onboard through the extension's own flow, or attach to its service worker from `chrome://extensions` in developer mode exactly as below.

Serve the sample dApp on the machine you are testing from. A LAN address is neither `localhost` nor `127.0.0.1`, the content script does not run there, and `window.xchain` never appears, which reads exactly like a wallet bug.

## 2. Seed a wallet

Until the packaged onboarding flow covers this, seed a wallet for the test run through the extension's own developer tools: open the service worker's storage panel and confirm the wallet's vault entries exist. If not, plant a vault using a scripted helper, or skip ahead and run a headless automated smoke test instead of the manual pass.

## 3. Serve a sample dApp

```bash
pnpm -C packages/test-dapp build   # if a build script is configured
# or, for a quick harness:
npx http-server packages/test-dapp -p 5500
```

Open `http://localhost:5500` in the browser. `window.xchain` is injected there because the content script matches exactly these three patterns, and no others:

```
https://*/*
http://localhost/*
http://127.0.0.1/*
```

The extension deliberately does not inject on other plain-HTTP origins: on a page served without TLS, an on-path attacker can rewrite the page and impersonate the dApp, so the wallet declines to offer a provider there at all rather than relying on the user to notice.

**Serve the sample dApp on the machine you are testing from.** A common way to test from a second machine is to point it at the first machine's server by LAN address, and an address like `http://192.168.x.x:5500` is neither `localhost` nor `127.0.0.1`. The content script will not run there, `window.xchain` never appears, and it reads exactly like a wallet bug. Serve the dApp locally on each machine, or put it behind TLS. Do not widen the extension's content-script matches to make a test setup work: widening triggers Chrome Web Store re-review and can disable the extension for installed users until they re-accept.

## 4. Walk through the sample flow

A minimal runner page that calls the sample dApp's example flow and reports the result is enough to drive every stage below. Click through the approval popups that open:

| Stage | What happens | What you should see |
|---|---|---|
| `provider.connect` | Approval popup opens | Connection request screen naming the requesting origin, with a chain picker. Select a chain and click **Connect**. |
| `provider.getActiveChains` / `getAddresses` / `getBalances` | Silent reads | The report shows an account count greater than zero. A balance call may error against a stubbed SDK, but it must not hang. |
| `provider.signIn` | Approval popup opens | Sign-in screen showing the requesting app's id and a nonce. Enter your wallet password and **Approve**. |
| `provider.signMessage` | Approval popup opens | Sign-message screen showing the plaintext to be signed. Enter your password and **Approve**. |
| `provider.signAction` (send) | Approval popup opens | Sign-action screen showing the action type and its parameters. Enter your password and **Approve**. |
| `provider.signAction` (an unsupported action) | No popup | The bridge returns an "unsupported action" error directly, naming the actions it does support. |
| `provider.disconnect` | Silent | The connected site is removed from the wallet. A fresh `connect` prompts again. |

## 5. Edge cases worth clicking

- **Reject in the popup.** The dApp's promise rejects with a "user rejected" error. Verify the error surfaces in the report.
- **Close the approval window** (the X button). Same effect as rejecting.
- **Reconnect.** A second `connect` from the same origin is idempotent: no popup, and the promise resolves immediately with the existing permissions.
- **Toggle "Always allow on this origin"** on the sign-action screen. The next send request from the same origin skips the approval popup entirely.
- **Lock the wallet mid-flow.** Subsequent bridge calls should fail with a clear "vault not ready" error, not hang. Unlock the wallet, then retry from the dApp side.

## What's covered by automated tests

An automated background-flow test already exercises everything in step 4 except the actual popup UI clicks: it simulates the popup by resolving approvals directly with the same result shapes the popup itself produces. If you are only verifying that a bridge-handler change did not break that shape, the automated test is enough, and you can skip the manual run. Run this runbook before tagging a release candidate where the UI and the extension-load path specifically matter.
