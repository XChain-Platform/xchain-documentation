<!--
Copyright © 2025–2026 Dankest, LLC
SPDX-License-Identifier: AGPL-3.0-or-later
Licensed under the GNU Affero GPL v3.0 or later; see LICENSE.md.
A commercial license is available — contact legal@dankest.llc.
-->

# Charging Agents for Data and APIs

You have something an AI agent wants — a data feed, an API, a file. XChain lets the agent pay for it in your token, inside the request itself: the agent asks, your server answers "402 — here's the price," the agent pays on-chain, retries, and gets the goods. No accounts, no API keys, no card forms. This guide is for the **seller** side; agents paying are covered by the SDK's `X402Client` (one call: `client.fetchUrl(url)`).

## The five-minute version

```js
const { XChainSDK, X402Gateway } = require('xchain-sdk');
const express = require('express');

const sdk = new XChainSDK({ network: 'dogecoin-mainnet' });
const gateway = new X402Gateway({
    coin: 'DOGE',
    explorer: sdk.explorer,
    send: { tick: 'MYTOKEN', amount: '5', payTo: 'D...your address', minConfirmations: 1 },
    stateDir: '/var/lib/my-api/x402',
});
gateway.startSweeper();

const app = express();
app.get('/api/report', gateway.middleware(), (req, res) => {
    res.json({ report: '…the paid content…', receipt: req.x402 });
});
```

Every unpaid request gets a 402 with payment instructions; every paid request passes through with `req.x402` describing the verified payment. That's the whole integration.

## Three ways to charge

**Pay per call** (`send`) — each request costs N tokens, paid by a SEND to your address carrying a one-time invoice code. Best for: individual queries, downloads, one-off purchases.

**Hold to access** (`dispenser`) — the caller must *hold* at least N of a token you sell through an on-chain [dispenser](../developer-guide/Build_A_Dispenser.md). The 402 tells agents exactly where to buy. Best for: memberships, subscriptions-without-billing, token-gated communities. Anyone holding the token gets in — that's the point.

**Deposit and meter** (`deposit`) — the caller tops up once with a SEND to your deposit address, then each call debits a local ledger until it runs dry. Best for: high-frequency, low-price calls where a payment per request would be too slow.

You can offer all three at once; the agent picks.

## Speed vs. certainty

A confirmed payment takes about a block (≈1 minute on Dogecoin). If that's too slow, set `minConfirmations: 0` and the gateway accepts payments the moment they hit the mempool — **provisionally**. Unconfirmed XChain payments are weaker than unconfirmed coin payments (the token transfer can still fail validation at confirmation), so the gateway re-checks every provisional grant and tells you (`onProvisionalFailed`) if one never confirms.

Rules of thumb: 0-conf for previews, cheap calls, revocable access. One confirmation or more for anything you can't take back — especially decryption keys. The deposit scheme gives you instant *and* certain: the top-up confirms once, the calls are local.

## Selling files

Combine this with [token-gated content](../protocol/Token_Gated_Content.md): publish the encrypted file on-chain, then sell the decryption key through a paid endpoint. The buyer pays, receives the key payload, pulls the ciphertext from the explorer, and decrypts locally. The e2e reference (`xchain-e2e-test/test/helpers/x402Storefront.js`) shows the complete storefront in ~100 lines.

## Honest fine print

- The invoice codes are single-use and bound to the payer's address — replays and front-running don't work.
- The gateway's file-backed state is for a **single server process**. Running multiple instances? Plug in a shared store (`invoiceStore` option).
- Prices are token amounts, not USD. If you want USD-pegged pricing, adjust the configured amount from your own price feed for now; native USD quoting arrives with the platform price oracle surface.
- Full wire spec for interoperators: [protocol/X402_Payments.md](../protocol/X402_Payments.md).
