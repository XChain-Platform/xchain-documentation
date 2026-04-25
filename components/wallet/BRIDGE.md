<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2026 Dankest, LLC -->

# dApp Bridge — `window.xchain`

The wallet exposes a typed `window.xchain` provider to dApps in browser tabs. Third-party developers consume the typed API through the `@xchain-wallet/bridge-spec` TypeScript package.

## Provider lifecycle

The Chrome extension's content script (`packages/extension/src/content/contentScript.js`) injects `packages/extension/src/inject/xchainProvider.js` into every page at `document_start`. The injected provider exposes `window.xchain` and proxies calls to the extension's service worker over `postMessage`. The desktop app exposes the same provider over its preload bridge.

```ts
import { getProvider } from '@xchain-wallet/bridge-spec/client';

const xchain = await getProvider({ timeout: 3000 });
if (!xchain) {
    // No XChain wallet available in this tab. Surface install link.
}
```

`getProvider` resolves once `window.xchain` is available, or rejects on timeout. The reference implementation in `@xchain-wallet/test-dapp` shows the recommended detection + reconnect logic.

## Versioning

The bridge protocol carries its own semver, independent of the wallet release version:

```ts
import { BRIDGE_SPEC_VERSION } from '@xchain-wallet/bridge-spec';
// '0.1.0'
```

Minor bumps add methods. Major bumps are breaking. The wallet keeps the bridge spec backward-compatible across minor wallet releases — a dApp pinned to bridge-spec `0.1.x` continues to work as the wallet ships `1.0.x`, `1.1.x`, …

## Methods

### `connect(opts?)`

Request the initial origin grant. Surfaces the approval popup on first call from a new origin; resolves immediately on subsequent calls if the origin already has a grant.

```ts
const result = await xchain.connect({ chains: ['bitcoin-mainnet'] });
if (result.error) { /* user rejected, or chain unsupported */ }
console.log(result.accounts, result.addresses);
```

### `getSupportedChains()`

Returns the chain descriptors the wallet exposes — `id`, `coin`, `displayName`, `networkKind`, `addressTypes`, `defaultAddressType`, `supportedActions`, `uriScheme`. Internal-only fields (default endpoint URLs, fee strategy, derivation templates) are not exposed.

### `getAccounts()` / `getBalances(address)`

Read-only. Returns the user's exposed accounts / addresses + token balances. The dApp sees an opaque `id` + display label — derivation paths, BIP44 indices, and creation timestamps are not surfaced.

### `signMessage(params)`

Signs an arbitrary message under the user's chosen address. The user sees the message in plain text in the approval popup before signing. The result is a `bitcoinjs-message`-compatible signature that any verifier can check.

```ts
const result = await xchain.signMessage({
    address: 'bc1q...',
    message: 'Hello, dApp.',
});
if (!result.error) {
    console.log(result.signature);  // base64 signature
}
```

### `signPsbt(params)`

Signs a dApp-supplied PSBT. The wallet:

1. Parses the PSBT
2. Resolves which inputs the user controls (per the user's accounts + addresses)
3. Renders a sign screen showing inputs / outputs / fee in plain English
4. Signs the user's inputs and returns the partially-signed PSBT

The dApp specifies which signing path (`p2wpkh`, `p2sh-p2wpkh`, `p2tr`, etc.) to use per input. The wallet refuses to sign inputs whose path doesn't match the user's known address types.

### `signAction(params)`

Signs a dApp-supplied XChain action. This is the highest-level API and the recommended path for most dApps:

```ts
const result = await xchain.signAction({
    chain: 'bitcoin-mainnet',
    action: 'SEND',
    params: {
        tick: 'MYTOKEN',
        amount: '100',
        destination: 'bc1q...',
    },
    fromAddress: 'bc1qmyaddr...',
});
```

The wallet:

1. Validates the action against its registry of action descriptors (`core/src/registry/actions.js`)
2. Calls `xchain-sdk` to encode the action into a PSBT
3. Renders the sign screen — form values from the dApp on top, decoded action summary in the middle, encoder PSBT bytes on the bottom (hidden behind a "Show advanced" toggle by default)
4. Signs and returns the signed PSBT

If the action is unsupported (not in the wallet's registry, or the user has no balance on the chosen chain), an `UnsupportedActionResult` is returned with a typed reason — letting the dApp fall back gracefully.

### `sendAction(params)`

Same as `signAction` but also broadcasts. The user sees one approval; the wallet returns the txid + final indexed result via the SDK's WebSocket layer.

```ts
const result = await xchain.sendAction({ ...same params... });
console.log(result.txid, result.indexed);
```

### `signIn(params)` — Sign-In with XChain

Challenge-response authentication. The dApp generates a challenge and the wallet signs it; the dApp's backend verifies the signature against the user's address.

The challenge format is versioned:

```ts
import { formatSignInChallenge, parseSignInChallenge, SIGN_IN_CHALLENGE_VERSION } from '@xchain-wallet/bridge-spec';

const challenge = formatSignInChallenge({
    version: SIGN_IN_CHALLENGE_VERSION,
    domain: 'app.example.com',
    address: 'bc1q...',
    nonce: crypto.randomUUID(),
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    statement: 'Sign in to Example.',
});

const result = await xchain.signIn({ challenge });
// result.signature is verifiable with bitcoinjs-message
```

The wallet refuses to sign:

- A challenge with a past `expiresAt`
- A challenge whose `domain` doesn't match the request origin
- A challenge whose `version` is unrecognized

This bakes origin and freshness into the challenge format itself — the dApp doesn't have to implement them client-side.

## Events

```ts
xchain.on('accountsChanged', (accounts) => { ... });
xchain.on('chainChanged', (chainId) => { ... });
xchain.on('disconnect', () => { ... });
```

Action-status streams (block / address / token / market / dispenser) live on the SDK's WebSocket layer rather than the bridge — dApps that need real-time data subscribe via the SDK directly. Keeping the bridge surface small reduces the audit surface and the per-origin permission surface.

## Permissions

Every privileged method (`signMessage`, `signPsbt`, `signAction`, `sendAction`, `signIn`) routes through the approval window. Per-origin grants in the vault's `connectedSites` collection encode three policies per action:

- **`always`** — auto-approve subsequent calls; the wallet still re-renders the review pane and the user can cancel before sign
- **`ask`** — surface the approval popup every time
- **`never`** — refuse silently with an `EPermissionDenied` error

Default for a fresh origin is `ask` for every action; the user can promote to `always` from the approval popup or from Settings → Connected Sites.

## Error model

Every method returns either a success envelope or a `BridgeErrorResult`. Codes:

| Code | Meaning |
|---|---|
| `EUserRejected` | User clicked Reject in the approval popup |
| `EPermissionDenied` | Per-origin policy is `never` for this method |
| `EWalletLocked` | Wallet is locked; user needs to unlock |
| `ENoWallet` | No wallet has been created or imported |
| `EChainUnsupported` | Wallet doesn't support the requested chain |
| `EActionUnsupported` | Wallet's action registry doesn't recognize the action |
| `EActionParamsInvalid` | Action params failed validation |
| `EAddressUnknown` | `fromAddress` isn't owned by the user |
| `EChallengeExpired` | Sign-in challenge `expiresAt` is in the past |
| `EChallengeOriginMismatch` | Sign-in challenge `domain` doesn't match request origin |
| `EChallengeVersionUnsupported` | Sign-in challenge `version` is unrecognized |
| `ESignerDeferred` | Hardware signer doesn't support this op (e.g. MuSig2) |
| `EBridgeTimeout` | Service worker didn't respond within the timeout |
| `EUnknown` | Anything not above; details in `message` |

Always `if (result.error) handleError(result.error.code)` before reading the success fields.

## Test dApp

`@xchain-wallet/test-dapp` is a reference dApp that exercises every bridge method end-to-end. It ships in the wallet repo at `packages/test-dapp/`. Use it as:

- A **smoke check** during wallet development — `bridge-e2e.smoke.js` exercises the bridge handlers against the test-dapp's mock provider in node
- A **runbook** for manual QA — `packages/extension/docs/TEST_DAPP_RUNBOOK.md` walks you through a hands-on bridge round-trip with the loaded extension and a running test-dapp page
- A **starter** for third-party integrators — copy the directory and replace its mock provider with the real `getProvider` import

## Security model

The bridge enforces three layers between the dApp and the user's keys:

1. **Origin stamping.** The content script reads `origin` from `window.location.origin` and stamps every message before forwarding to the service worker. Page scripts cannot forge a different origin — they can only post messages to the content script's relay, and the content script's stamp is what the bridge handler checks.
2. **Service-worker boundary.** The service worker (extension) or main process (desktop) owns the vault and the signers. Every privileged op crosses the boundary, where it's matched against `connectedSites` and routed through the approval popup. The renderer / page never sees the master key, the seed, or any private key.
3. **Per-method approval.** Even with an `always` grant, the approval popup re-renders the review pane on every privileged call. The user can revoke the grant in one click if anything looks off.

See [Security & Threat Model](SECURITY.md) for the full posture.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **Dankest Community License**.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
