<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->

# Login with XChain and wallet requests

## What a site can do

A site can ask a person to prove control of one or more wallet addresses, including a taproot address. It can also request a message signature, a signed XChain action, or a signed PSBT on any blockchain the wallet supports.

The same requests can reach the XChain browser extension, web wallet, desktop app, Android app, and iOS app. The person reviews every request in the wallet and chooses whether to approve or reject it.

## Install and create the browser client

Install the browser package for the site and the SDK for server-side verification and transaction building:

```bash
npm install @dankest-llc/xchain-connect @dankest-llc/xchain-sdk
```

Create one client when the page loads and start its browser-return listener. `explorerUrl` is used for balance reads when the extension is not available:

```js
import { createClient } from '@dankest-llc/xchain-connect';

const xchain = createClient({ explorerUrl: 'https://explorer.xchain.io' });
xchain.start();
```

Each wallet request returns an object with `ok:true` on success or the error shape described below. Call `xchain.request(...)` directly inside the person's click handler so the browser preserves the user gesture needed to open a wallet.

## Licence

`@dankest-llc/xchain-connect` is MIT licensed. The wallet and SDK are AGPL licensed with a commercial option. Links, `window.xchain`, and callbacks need no licence.

## Log in from the browser

Fetch a single-use nonce when the page loads. The click handler consumes it and starts the wallet request before its first asynchronous pause:

```js
import { createClient } from '@dankest-llc/xchain-connect';
const xchain = createClient({ explorerUrl: 'https://explorer.xchain.io' });
xchain.start();
let loginNonce;
fetch('/auth/login-nonce', { method: 'POST' })
  .then((response) => response.json())
  .then(({ nonce }) => { loginNonce = nonce; });
document.querySelector('#login').addEventListener('click', async () => {
  if (!loginNonce) return;
  const nonce = loginNonce;
  loginNonce = undefined;
  const response = await xchain.request('login', { appId: 'music.example', nonce });
  const result = response.result;
  return fetch('/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nonce, result }) });
});
```

The request defaults to returning to the current page without its fragment. Pass a `return`, `callback`, or both as the third argument to `xchain.request` when the site needs an explicit destination. If both are present, they must have the same origin.

## Verify a login on the server

Have the page request a nonce as soon as it loads, then pass that nonce to the wallet's login call. The server must issue each nonce from a cryptographically secure source, give it a short expiry, and consume it on the first verification attempt.

```js
const crypto = require('crypto');
const express = require('express');
const XChainSDK = require('@dankest-llc/xchain-sdk');

const app = express();
const sdk = new XChainSDK({ hubUrl: process.env.XCHAIN_HUB_URL });
const loginNonces = new Map();

const appId = 'music.example';
const origin = 'https://music.example';
const tick = 'MYTOKEN';
const min = '1';
const maxAgeMs = 5 * 60 * 1000;

app.use(express.json());

app.post('/auth/login-nonce', (req, res) => {
  const nonce = crypto.randomBytes(32).toString('base64url');
  loginNonces.set(nonce, Date.now() + maxAgeMs);
  setTimeout(() => loginNonces.delete(nonce), maxAgeMs);
  res.json({ nonce });
});

app.post('/auth/verify', async (req, res) => {
  const { nonce, result } = req.body;
  const expiresAt = loginNonces.get(nonce);
  loginNonces.delete(nonce);
  if (!expiresAt || expiresAt <= Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired nonce' });
  }

  const verified = await sdk.auth.verifyLogin(result, {
    appId,
    origin,
    nonce,
    maxAgeMs,
  });
  if (!verified.valid) {
    return res.status(401).json({ error: verified.error });
  }

  const { holds, amount } = await sdk.auth.holdsAtLeast(
    verified.address,
    tick,
    min,
    { chainId: verified.chainId },
  );
  if (!holds) {
    return res.status(403).json({ error: 'Required token holding not found' });
  }

  res.json({
    address: verified.address,
    chainId: verified.chainId,
    amount: amount.toString(),
  });
});
```

`sdk.auth.verifyLogin(result, { appId, origin, nonce, maxAgeMs })` returns `{ valid, address, chainId, addresses, error }` and never throws for a bad login. It verifies every shared address in its own signature format: `legacy` for p2pkh, p2sh-p2wpkh, and p2wpkh, and `bip322-simple` for p2tr. It caps `maxAgeMs` at 60 minutes.

Use `verified.address`, never an address from the request body, as the session identity. Run authorization checks only against that proven address and its verified chain. `sdk.auth.holdsAtLeast(address, tick, min, { chainId })` returns `{ holds, amount }`, where `amount` is a bignumber.

## Read balances

After login, read balances for the verified chain and address. In the browser examples below, `session.address` and `session.chainId` are the identity values returned by the server after verification. Amounts are decimal strings, so compare them with `BigInt` or a decimal library rather than a JavaScript `number`:

```js
const balances = await xchain.getBalances(session.chainId, session.address);
renderBalances(balances);
```

The package reads the public explorer when it is using a request link and returns `{address, data:[{tick, amount}], total}`. With an extension provider, it uses the provider's granted-site balance method and returns that method's `Balance[]` result. Keep the rendering code prepared for both documented shapes.

## Sign a message

The wallet signs the exact message with the requested address. Taproot addresses return `bip322-simple`; other supported address types return `legacy`:

```js
const signed = await xchain.request('signMessage', {
  chainId: session.chainId,
  address: session.address,
  message: 'Confirm music.example account recovery',
});
```

Verify the signature on the server before acting on it. Do not treat a successful transport return as proof by itself.

## Sign and broadcast an action

`signAction` takes the SDK action vocabulary. The wallet validates the action, shows its facts and fee, verifies the built transaction against the approved intent, signs it, and broadcasts it. A successful result contains `{ok:true, txid, chainId}`.

These examples show `SEND`, `ORDER`, `EXECUTE`, and `BATCH` requests:

```js
await xchain.request('signAction', {
  chainId: session.chainId,
  from: session.address,
  action: 'SEND',
  params: { tick: 'MYTOKEN', amount: '1', destination: 'tb1qq6hag67dl53wl99vzg42z8eyzfz2xlkvvlryfj' },
});

await xchain.request('signAction', {
  chainId: session.chainId,
  from: session.address,
  action: 'ORDER',
  params: { giveTick: 'MYTOKEN', giveAmount: '10', getTick: 'OTHERTOKEN', getAmount: '25' },
});

await xchain.request('signAction', {
  chainId: session.chainId,
  from: session.address,
  action: 'EXECUTE',
  params: { contractActionIndex: 12345, method: 'redeem', params: ['ticket-42'] },
});

await xchain.request('signAction', {
  chainId: session.chainId,
  from: session.address,
  action: 'BATCH',
  params: { command: 'SEND|0|MYTOKEN|1|tb1qq6hag67dl53wl99vzg42z8eyzfz2xlkvvlryfj;DESTROY|0|MYTOKEN|1' },
});
```

Build a `BATCH` command with the SDK's batch builder in production instead of joining action strings from user input. The wallet refuses unsupported actions and dangerous transaction-building fields before showing an approval.

## Sign a PSBT built on your server

Build and validate a transaction on the server, using the authenticated session's proven address. Do not let the browser substitute the source address or an arbitrary PSBT:

```js
app.post('/wallet/send-psbt', requireLogin, async (req, res) => {
  const address = req.session.verifiedAddress;
  const built = await sdk.createAction({
    action: 'SEND',
    params: {
      tick: req.body.tick,
      amount: req.body.amount,
      destination: req.body.destination,
    },
    encoder: { pubkey: address, change: address },
  });
  if (!built.psbt) return res.status(400).json({ error: 'Action requires managed submission' });
  res.json({ psbtHex: built.psbt, signingPaths: [{ inputIndex: 0, address }] });
});
```

Prepare the server request before the click, then start `signPsbt` in the click handler so the launch retains its user gesture:

```js
let psbtRequest;
fetch('/wallet/send-psbt', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ tick: 'MYTOKEN', amount: '1', destination: 'tb1qq6hag67dl53wl99vzg42z8eyzfz2xlkvvlryfj' }),
}).then((response) => response.json()).then((body) => { psbtRequest = body; });

document.querySelector('#sign-psbt').addEventListener('click', () => {
  if (!psbtRequest) return;
  xchain.request('signPsbt', { chainId: session.chainId, ...psbtRequest })
    .then(handleWalletResult);
});
```

The wallet signs only the listed inputs and returns `{ok:true, signedPsbtHex, txHex?}`. `signPsbt` does not broadcast. Broadcast a finalized transaction from the server only after checking that its inputs, outputs, fee, and action still match the operation the site intended.

## How it opens on each device

| Wallet | What happens after the click | How the result returns |
|---|---|---|
| Browser extension | The site opens the wallet's existing approval window. | The request finishes in the same browser tab. The wallet does not send a server callback directly, but the site can forward the result. |
| Web wallet | The site opens the web wallet. If the browser blocks the new window, the current tab goes to the web wallet instead. | The web wallet returns through a URL fragment and passes the result to the original tab when possible. It cannot send a server callback. A callback-only request asks the person to open an installed wallet app. |
| Desktop app | The request link opens the app on its approval screen. | A browser return opens in the default browser. A server callback is also available. |
| Android app | A verified app link opens or brings forward the app. | The app returns to the calling browser when that browser can be identified safely, or to the default browser otherwise. A server callback is also available. |
| iOS app | A Universal Link opens the app from the person's tap. | The app opens the browser return, using the browser hint when possible. A server callback is also available. |
| Nothing installed | The link opens the hand-off panel at `https://wallet.xchain.io/link/`. The person can open the app, continue in the web wallet, or get the wallet. | The selected wallet handles the result. |

In a desktop browser with no extension, the first click shows a chooser for the desktop app, web wallet, wallet download, or a phone. The phone option shows a QR code when the request link is no more than 2,900 characters. The chooser remembers the selection for that site.

A browser return through a URL fragment is the default. A site can opt in to a server callback, or request both. If a login return reaches a browser that has no matching pending request, the package reports `solicited:false` and shows a Continue bar before delivering it. Other results without a matching pending request fail with `NO_PENDING_REQUEST`.

## Receive results on your server

Use the callback receiver in `@dankest-llc/xchain-sdk` with a persistent store in production. This complete in-memory example shows the store contract and issues a `cross-device` nonce for a QR login:

```js
const crypto = require('crypto');
const express = require('express');
const XChainSDK = require('@dankest-llc/xchain-sdk');
const app = express(), sdk = new XChainSDK();
const appId = 'music.example', origin = 'https://music.example';
const nonces = new Map(), callbacks = new Map();
const store = {
  issueNonce(mode) {
    const nonce = crypto.randomBytes(16).toString('base64url');
    nonces.set(nonce, { mode, expiresAt: Date.now() + 10 * 60 * 1000 });
    return nonce;
  },
  takeNonce(nonce) {
    const record = nonces.get(nonce);
    nonces.delete(nonce);
    return record && record.expiresAt > Date.now() ? { mode: record.mode } : null;
  },
  put(id, record) { callbacks.set(id, record); },
  get(id) { return callbacks.get(id); },
};
app.use(express.json({ limit: '10kb' }));
app.post('/auth/qr-login-nonce', (req, res) => {
  const nonce = store.issueNonce('cross-device');
  res.json({ nonce });
});
app.post('/auth/callback', async (req, res) => {
  const received = await sdk.auth.receiveCallback(req.body, { store, appId, origin });
  if (!received.accepted) return res.status(400).json(received);
  res.status(200).json(received);
});
```

The callback POST is unauthenticated, so only signatures prove anything about its contents. `sdk.auth.receiveCallback` verifies a login before storing it and consumes the nonce on the first attempt. A login's `status` is `approved` only when the callback carries no `claim` and its nonce was issued as `cross-device`; otherwise it is `approved-unclaimed`. Start a session only for the browser that presents the matching `claim` or the full signed result.

A QR or callback-only login is lower assurance because a real-time relay can phish it. Tell people they are signing in on another device and prefer a return to the browser that began the login.

## Errors

An unsuccessful request has the shape `{ok:false, error, message?}`. The `error` value is one of these bridge error codes:

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
- `BALANCES_UNAVAILABLE`
- `INTERNAL_ERROR`

Request links can also return `REQUEST_EXPIRED`, `REQUEST_TOO_LARGE`, or `RESULT_TOO_LARGE`. The connect package can return `NO_PENDING_REQUEST` when a non-login result arrives without its pending request.

## Testing on localhost

Return and callback URLs normally require HTTPS. With Developer Mode enabled in the wallet, an HTTP `return` or `callback` is allowed only when its host is localhost.

## Security checklist

- Verify every signature on the server. A callback is an unauthenticated delivery channel, so the callback itself proves nothing.
- Issue a single-use server nonce for each login.
- Use a return path that never redirects.
- Treat a callback-only or QR login as lower assurance than a login that returns to the initiating browser.
