<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# dApp Bridge and Wallet Requests

`@dankest-llc/xchain-connect` is the MIT-licensed browser package for Login with XChain and wallet requests. It uses the typed `window.xchain` provider when the Chromium extension is available at bridge protocol 0.2.0 or later. Otherwise it launches the same request through an `xchain:request` link, so the web wallet, desktop app, Android app, or iOS app can show the wallet's existing approval page.

The package and provider share the same `{method, params}` request vocabulary and `{ok:false, error, message?}` failure shape. The package adds transport selection, request-link encoding, pending-request storage, browser-return handling, and public explorer balance reads. The extension provider also exposes connection, permission, co-signing, batching, and event methods that require a live extension channel.

Links, `window.xchain`, and callbacks need no licence. The wallet and SDK remain AGPL-licensed with a commercial option.

## Install and create a client

```bash
npm install @dankest-llc/xchain-connect
```

Create one client when the page loads. Fetch a login nonce at the same time, but call the wallet method synchronously from the user's click so browsers preserve the launch gesture.

```ts
import { createClient } from '@dankest-llc/xchain-connect';

const xchain = createClient({
    app: { name: 'Example App' },
    return: 'https://app.example.com/wallet-return',
});

let loginNonce;
loginButton.disabled = true;
fetch('/auth/login-nonce')
    .then((r) => r.json())
    .then(({ nonce }) => {
        loginNonce = nonce;
        loginButton.disabled = false;
    });

loginButton.addEventListener('click', () => {
    xchain.login({
        appId: 'app.example.com',
        nonce: loginNonce,
        chainId: 'bitcoin-mainnet',
    }).then((result) => {
        if (!result.ok) handleWalletError(result);
    });
});
```

The client defaults `return` to the current page URL without its fragment. A request can instead name an HTTPS `callback`, or name both. When both are present they must have the same origin. HTTP is permitted only for localhost when the wallet is in Developer Mode.

## Transport selection

The client uses these transports:

| Environment | Launch | Result path |
|---|---|---|
| Chromium extension with provider version 0.2.0 or later | Calls `window.xchain` | Resolves in the same tab; the page can forward the result to its server |
| Web wallet | Opens `https://wallet.xchain.io/` with the request link | Returns in the URL fragment and uses `BroadcastChannel` to update the opener when possible; it cannot send callbacks |
| Desktop app | Opens the `xchain:request` link | Opens the browser return and can send a server callback |
| Android app | Opens a verified App Link, with an intent fallback where supported | Returns to the calling browser when it can be identified safely and can send a callback |
| iOS app | Opens a Universal Link from the tap | Opens the browser return, using the browser hint when possible, and can send a callback |
| No installed wallet | Opens the wallet hand-off page | The person chooses the app, web wallet, download, or phone path |

On desktop without the extension, the first request shows a chooser and remembers the site's selection. A phone QR is available when the published link is at most 2,900 characters.

The package stores the pending request's `id`, method, nonce, and state in local storage. It reads and removes `#xchain=` results on page load and `hashchange`, and delivers the same result whether the wallet returned in the original tab or a new one. An unsolicited successful login is offered behind a **Continue as** bar with `solicited: false`. Any other result without a matching pending request returns `NO_PENDING_REQUEST`.

## Request methods

### `login(params) → Promise<LoginResult>`

Login with XChain asks the person to choose one or more addresses, signs a separate challenge for each address, and returns the first choice at the top level.

```ts
{
    appId: string;
    nonce: string;
    chains?: string[];
    chainId?: string;
    expiresInMs?: number;
    maxAddresses?: number;
}
```

`maxAddresses` is from 1 through 5 and defaults to 1. `expiresInMs` defaults to five minutes. `chains` and `chainId` narrow the wallet's address picker.

```ts
{
    ok: true;
    address: string;
    chainId: string;
    challenge: string;
    challengeParts: object;
    signature: string;
    signatureFormat: 'legacy' | 'bip322-simple';
    addresses: Array<{
        address: string;
        chainId: string;
        addressType: string;
        challenge: string;
        signature: string;
        signatureFormat: 'legacy' | 'bip322-simple';
    }>;
}
```

The top-level fields repeat `addresses[0]`. P2PKH, P2SH-P2WPKH, and P2WPKH use `legacy` signatures. P2TR uses BIP-322 simple signatures.

The challenge stays byte-for-byte compatible with the earlier API:

```text
XChain Sign-In v2 | <appId> | <origin> | <address> | <nonce> | <timestamp> | <expiresAt>
```

The origin is stamped by the extension or derived from the request's return or callback target. A relying server must verify the signature, app id, origin, single-use nonce, timestamp, and expiry. Use `sdk.auth.verifyLogin`, which verifies every shared address in its declared signature format and never throws for an invalid login.

#### `signIn(params) → Promise<SignInResult>`

`signIn` remains as a deprecated alias for `login`. New integrations use `login`. The challenge prefix remains `XChain Sign-In v2` for wire compatibility.

### `signMessage(params) → Promise<SignMessageResult>`

```ts
{ chainId: string; address: string; message: string }
```

```ts
{
    ok: true;
    address: string;
    signature: string;
    signatureFormat: 'legacy' | 'bip322-simple';
    signedMessage: string;
}
```

The approval shows the exact message. Messages beginning with the reserved login challenge prefix are refused and must use `login`.

### `signAction(params) → Promise<SignActionResult>`

`signAction` uses the SDK action vocabulary:

```ts
{
    chainId: string;
    from: string;
    action: string;
    params: Record<string, unknown>;
}
```

```ts
{ ok: true; txid: string; chainId: string }
```

The wallet validates the action, builds the approval description, shows the miner fee and transaction preview where simulation is available, verifies the built transaction against the approved intent, signs it, and broadcasts it. Enabled actions follow the wallet's evidence-backed action list. An action outside that list returns `UNSUPPORTED_ACTION`.

The bridge refuses `legs`, `prebuiltPsbt`, `utxos`, `customOutputs`, and `encoding`. It drops `fee`, `feePerKb`, and `rbf`. Per-asset `SWEEP`, chain-gated actions on an ineligible chain, pre-launch mainnet actions, and actions requiring multiple transactions are refused before approval. Single two-phase P2SH, P2WSH, and Taproot pairs remain eligible because the wallet verifies their carrier scripts and reveals.

### `signPsbt(params) → Promise<SignPsbtResult>`

```ts
{
    chainId: string;
    psbtHex: string;
    signingPaths: Array<{
        inputIndex: number;
        address?: string;
        derivationPath?: string;
        sighashType?: number;
    }>;
}
```

```ts
{ ok: true; signedPsbtHex: string; txHex?: string }
```

Each signing path contains exactly one of `address` or `derivationPath`. Every path must resolve to an address owned by one wallet on the requested chain. The approval independently decodes the PSBT and displays destinations, amounts, change, and fee. `signPsbt` does not broadcast. A PSBT shaped as a BIP-322 `to_sign` transaction is refused so it cannot forge a P2TR login.

### `getBalances(chainId, address)`

The connect package reads the public explorer and returns:

```ts
{
    address: string;
    data: Array<{ tick: string; amount: string }>;
    total: string;
}
```

The package uses a fixed chain-to-explorer map unless `explorerUrl` overrides it. The extension provider's method of the same name is unchanged and returns the provider's `Balance[]` records for an authorized address.

## Extension provider

The Chromium extension injects `window.xchain` at `document_start` on HTTPS pages and on localhost HTTP pages. It dispatches `xchain#initialized` after installation. Discovery helpers handle the injection race:

```ts
import {
    getProvider,
    isXChainAvailable,
    PROVIDER_READY_EVENT,
} from '@dankest-llc/xchain-connect';

const provider = isXChainAvailable()
    ? window.xchain
    : await getProvider({ timeoutMs: 3000 });
```

Every current provider reports:

```ts
provider.version;
provider.isXChainWallet;
```

Protocol 0.2.0 providers support `login`; protocol 0.1.0 providers remain discoverable for direct extension integrations but do not support the cross-device request client.

### Connection and reads

`connect(opts?)` creates or reuses an origin-scoped grant. A new grant requires at least one account and chain. Existing grants return without another connect prompt. Blocked origins are refused. Developer Mode can auto-approve a localhost connection, but grants no remembered signing permission.

| Method | Result |
|---|---|
| `connect(opts?)` | `{ok, version, supportedVersions, accounts, chains, permissions}` or a bridge error |
| `disconnect()` | Removes the current origin's grant |
| `getAccounts()` | Accounts within the grant |
| `getAddresses(chainId)` | Wallet addresses on the granted chain and accounts |
| `getBalances(chainId, address)` | Provider `Balance[]` rows for one granted address |
| `getSupportedChains()` | Registry descriptors; callable before connect unless the origin is blocked |
| `getActiveChains()` | Active chain ids within the grant |

Read methods other than `getSupportedChains` require a connection. Their promise rejects on failure because their result types have no `{ok}` envelope.

### Provider-only signing methods

`coSign(params)` requests the wallet's passive contribution to a stored 2-of-2 MuSig2 account. It always opens an approval and returns one signature record per approved input. A policy refusal is `{ok:true, approved:false, reason, detail?}`; transport, permission, and approval failures use the bridge error shape.

`parallel(actions)` accepts 1 through 20 `signAction` requests and processes them in order. Each item has its own result, and the current extension can show a separate approval for each action. Successful broadcasts are not rolled back if a later item fails. Batch-level validation, connection, throttle, and transport failures reject the promise.

### Events

```ts
provider.on('accountsChanged', handleAccounts);
provider.on('chainChanged', handleChain);
provider.on('disconnect', handleDisconnect);
provider.off('accountsChanged', handleAccounts);
```

Event delivery is best effort and only targets tabs that have called the bridge at that origin. The provider has no transaction-status or market-data event.

## Permissions and approvals

An extension connection stores chain and account scopes, message-signing policy, and per-action policy for the requesting origin. Protected reads and signing calls enforce those scopes. The user blocklist and per-origin throttle run before signing.

Every allowed remote signing request opens the extension's own approval UI and asks for the wallet password. Successful prompts can remember message or action policy, but the extension still prompts again for non-localhost calls. The only auto-sign path is the separate, opt-in Developer Mode password cache for localhost. It is disabled by default.

Request links never create or use an extension site grant, never offer **Always allow**, and never use localhost auto-sign. They perform chain and address checks against the vault, and the approval names the origin that receives the answer.

## Request-link envelope and answers

The canonical link is:

```text
xchain:request?v=1&req=<base64url(UTF-8 JSON)>
```

The closed envelope contains `v`, `id`, `method`, `params`, optional `return`, optional `callback`, optional `state`, `exp`, optional `app`, and optional `browser`. Unknown keys are refused. At least one answer target is required. `exp` can be at most 10 minutes ahead and is checked again when approval appears. The complete published HTTPS wrapper is limited to 16,384 characters.

A browser return appends this fragment:

```text
#xchain=<base64url({v, id, method, ok, result | error, state, claim})>
```

A server callback posts the equivalent JSON. It carries no cookies, follows no redirects, times out after 10 seconds, and is limited to 10 KB. Outside Developer Mode, callback destinations resolving to loopback or private ranges are refused. Callbacks are unauthenticated, so only result signatures prove anything.

When both paths are present, the wallet mints a random claim and sends it in the fragment and callback. A server starts the session only for the browser that presents the matching claim or full signed result. A callback-only login has no claim and is lower assurance because a real-time relay can phish it.

## Error codes

Result-union failures have the shape `{ok:false, error, message?}`. Branch on `error`; `message` is diagnostic text.

| Code | Meaning |
|---|---|
| `USER_REJECTED` | The person rejected or abandoned approval, or policy refused it. |
| `NOT_CONNECTED` | The extension origin has no connected-site grant. |
| `WALLET_LOCKED` | A required vault or signer is locked. |
| `CHAIN_NOT_SUPPORTED` | The chain is unknown or unavailable to the request. |
| `ACCOUNT_NOT_AUTHORIZED` | The requested account or co-signer is unavailable or unauthorized. |
| `ADDRESS_NOT_AUTHORIZED` | The address or derivation path is unavailable or unauthorized. |
| `UNSUPPORTED_ACTION` | The action is not in the wallet's enabled bridge action list. |
| `INVALID_PARAMS` | Required data is missing or a parameter fails validation. |
| `CHALLENGE_EXPIRED` | The login challenge or its permitted verification window expired. |
| `BROADCAST_FAILED` | A signed action failed during network broadcast. |
| `PANIC_MODE` | The active panic freeze blocks signing. |
| `THROTTLED` | The request exceeded the applicable rate limit. |
| `BLOCKED_BY_USER` | The user blocklist matches the requesting origin. |
| `BRIDGE_VERSION_MISMATCH` | The requested protocol range matches no supported version. |
| `BALANCES_UNAVAILABLE` | The public balance source could not supply the requested data. |
| `INTERNAL_ERROR` | An unexpected wallet, signer, or transport failure occurred. |
| `REQUEST_EXPIRED` | A request link expired before approval. |
| `REQUEST_TOO_LARGE` | The client refused a request that exceeds the link limit. |
| `RESULT_TOO_LARGE` | The wallet refused a result that exceeds the delivery limit. |
| `NO_PENDING_REQUEST` | The package received a non-login result with no matching pending request. |

`NO_PENDING_REQUEST` is package-only. The other request-link codes use the same result envelope as provider errors.

## Versioning

The bridge protocol version is independent of the wallet release version:

```ts
import {
    BRIDGE_SPEC_VERSION,
    BRIDGE_SUPPORTED_VERSIONS,
} from '@dankest-llc/xchain-connect';

BRIDGE_SPEC_VERSION === "0.2.0";
BRIDGE_SUPPORTED_VERSIONS;
```

The current version is `0.2.0`, and the supported protocol list is `['0.1.0', '0.2.0']`. `connect.requiredBridgeVersion` accepts exact versions and supported semantic-version ranges. An invalid or unmatched range fails closed with `BRIDGE_VERSION_MISMATCH`.

## Security boundaries

1. The content script accepts only the public bridge surface, stamps the page origin, and confines requests to the extension service worker.
2. Vault access, permission checks, password handling, signing, and broadcasts remain behind the wallet boundary. A page never receives seed or private-key material.
3. Extension requests enforce the connected site's origin, chain, account, address, blocklist, and throttle scopes.
4. Link requests run without stored site trust and show the answer origin on the approval.
5. Approval content runs on a wallet-controlled origin and independently shows the operation details, miner fee, and relevant transaction data.
6. The wallet signs the same checked PSBT that passed intent, output, carrier-script, and reveal verification.

See [Security & Threat Model](security.md) for link identity, replay, callback, claim, wrong-browser, and login-fixation controls.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
