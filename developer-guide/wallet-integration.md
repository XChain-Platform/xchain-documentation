<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025-2026 Dankest, LLC -->

# Login with XChain and wallet requests

## What a site can do

A site can ask a person to prove control of one or more wallet addresses, including a taproot address. It can also request a message signature, a signed XChain action, or a signed PSBT on any blockchain the wallet supports.

The same requests can reach the XChain browser extension, web wallet, desktop app, Android app, and iOS app. The person reviews every request in the wallet and chooses whether to approve or reject it.

## Licence

`@dankest-llc/xchain-connect` is MIT licensed. The wallet and SDK are AGPL licensed with a commercial option. Links, `window.xchain`, and callbacks need no licence.

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
