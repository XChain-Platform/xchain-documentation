<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Integration Patterns

This guide covers common patterns for integrating XChain into real applications. Each pattern includes a description, key considerations, and working code examples.

---

## SDK Configuration for Production

In production, use hub-based config discovery so services can be relocated without code changes:

```js
const XChainSDK = require('xchain-sdk');

const sdk = new XChainSDK({
  hubUrl: process.env.XCHAIN_HUB_URL || 'http://localhost:35500',
});
```

For multi-chain applications, instantiate one SDK per chain:

```js
const btcSdk = new XChainSDK({ hubUrl: process.env.BTC_HUB_URL });
const ltcSdk = new XChainSDK({ hubUrl: process.env.LTC_HUB_URL });
const dogeSdk = new XChainSDK({ hubUrl: process.env.DOGE_HUB_URL });
```

---

## Pattern 1: Token Issuance Platform

Create tokens on behalf of users. Each user provides their own public key and UTXOs; you build and return the PSBT for them to sign in their wallet.

```js
// API endpoint: POST /issue-token
async function issueTokenForUser(req, res) {
  const { tick, maxSupply, decimals, description, publicKey, utxos } = req.body;

  // Validate tick is available
  try {
    await sdk.explorer.getToken({ tick });
    return res.status(400).json({ error: 'Ticker already taken' });
  } catch {
    // Token doesn't exist yet — good
  }

  const action = sdk.issue({
    tick,
    maxSupply,
    decimals,
    description,
  });

  const psbt = await sdk.encoder.createPSBT({
    action,
    publicKey,
    utxos,
  });

  // Return unsigned PSBT to user's wallet for signing
  res.json({ psbt: psbt.psbt, format: psbt.format });
}
```

After the user signs and broadcasts the transaction, poll for confirmation:

```js
async function waitForTokenConfirmation(tick, maxWaitMs = 120000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const token = await sdk.explorer.getToken({ tick });
      return token;
    } catch {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  throw new Error(`Token ${tick} not confirmed within ${maxWaitMs}ms`);
}
```

---

## Pattern 2: Payment Processing

Watch for incoming SEND actions to your address and confirm them via the explorer.

```js
class PaymentWatcher {
  constructor(sdk, address) {
    this.sdk = sdk;
    this.address = address;
    this.lastSeenBlock = 0;
    this.handlers = [];
  }

  onPayment(handler) {
    this.handlers.push(handler);
  }

  async start(pollIntervalMs = 10000) {
    while (true) {
      await this.poll();
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
  }

  async poll() {
    const history = await this.sdk.explorer.getHistory({
      address: this.address,
      page: 1,
      limit: 50,
    });

    const newPayments = history.filter(
      h =>
        h.action === 'SEND' &&
        h.destination === this.address &&
        h.block_index > this.lastSeenBlock
    );

    for (const payment of newPayments) {
      for (const handler of this.handlers) {
        await handler(payment);
      }
      this.lastSeenBlock = Math.max(this.lastSeenBlock, payment.block_index);
    }
  }
}

// Usage
const watcher = new PaymentWatcher(sdk, 'bc1qmymerchantaddress...');
watcher.onPayment(async payment => {
  console.log(
    `Received ${payment.amount} ${payment.tick} from ${payment.source} ` +
    `(txid: ${payment.txid})`
  );
  await fulfillOrder(payment);
});
watcher.start(10000);
```

---

## Pattern 3: Token-Gated Access

Gate access to content, features, or services based on whether a user holds a specific token. This pattern covers balance checks, wallet ownership proof, session management, real-time invalidation, and on-chain gating via smart contracts.

> **SDK v1.5.0+:** The XChain SDK now has built-in wallet verification methods (`sdk.generateChallenge()`, `sdk.signMessage()`, `sdk.verifyOwnership()`) that handle challenge generation, message signing, and signature verification. See the [Wallet & Auth Reference](../components/sdk/WALLET.md) for the full API and the [SDK Examples](../components/sdk/EXAMPLES.md#challenge-response-wallet-verification) for end-to-end code. The patterns below show both the raw `bitcoinjs-message` approach and the SDK approach.

### Step 1: Balance Check

The simplest form — query the explorer to see if an address holds enough of a token:

```js
const { bignumber, largerEq } = require('mathjs');

async function checkBalance(address, requiredTick, minimumAmount) {
  const balances = await sdk.explorer.getBalances({ address });
  const entry = balances.find(b => b.tick === requiredTick);
  if (!entry) return false;
  return largerEq(bignumber(entry.amount), bignumber(minimumAmount));
}
```

A balance check alone is **not sufficient for production use**. Anyone can claim to own an address by submitting it as a query parameter. You need to verify that the user actually controls the private key for that address.

### Step 2: Wallet Ownership Proof (Challenge-Response)

To prove a user controls an address, issue a random challenge string and require them to sign it with their wallet. The server verifies the signature against the claimed address.

```js
const crypto = require('crypto');
const bitcoinMessage = require('bitcoinjs-message');

// Store pending challenges (use Redis or a database in production)
const challenges = new Map();

// Issue a challenge
app.post('/auth/challenge', (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'address required' });

  const nonce = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  const message = `XChain token-gate login\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

  challenges.set(nonce, { address, message, timestamp });

  // Expire challenges after 5 minutes
  setTimeout(() => challenges.delete(nonce), 5 * 60 * 1000);

  res.json({ message, nonce });
});

// Verify the signed challenge
app.post('/auth/verify', async (req, res) => {
  const { nonce, signature } = req.body;

  const challenge = challenges.get(nonce);
  if (!challenge) return res.status(400).json({ error: 'Invalid or expired challenge' });

  // Prevent replay
  challenges.delete(nonce);

  // Check that the challenge hasn't expired (5-minute window)
  if (Date.now() - challenge.timestamp > 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Challenge expired' });
  }

  // Verify signature matches the claimed address
  try {
    const valid = bitcoinMessage.verify(challenge.message, challenge.address, signature);
    if (!valid) return res.status(401).json({ error: 'Invalid signature' });
  } catch {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  // Signature valid — now check the token balance
  const hasToken = await checkBalance(challenge.address, 'MYTOKEN', '1');
  if (!hasToken) {
    return res.status(403).json({ error: 'Address does not hold required token' });
  }

  // Issue a session token (see Step 3)
  const sessionToken = createSession(challenge.address);
  res.json({ sessionToken, address: challenge.address });
});
```

**Client-side flow:** The user's wallet (browser extension, mobile app, or CLI) signs the challenge message using the standard Bitcoin `signmessage` operation. Most Bitcoin, Litecoin, and Dogecoin wallets support this natively. The signature is sent back to the server for verification.

**Library choice by chain:**

| Chain | Verification library | Notes |
|---|---|---|
| Bitcoin | `bitcoinjs-message` | Supports legacy, segwit (P2SH-P2WPKH), and native segwit |
| Litecoin | `bitcoinjs-message` with Litecoin network params | Same format, different address prefix |
| Dogecoin | `bitcoinjs-message` with Dogecoin network params | Same format, different address prefix |

### Step 3: Session Management and Caching

Re-checking the balance on every request is expensive and slow. Once ownership is proven, issue a short-lived session and re-verify the balance periodically.

```js
const sessions = new Map();

function createSession(address) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    address,
    verifiedAt: Date.now(),
    lastBalanceCheck: Date.now(),
  });
  return token;
}

// Middleware: validate session and re-check balance on a schedule
function requireToken(tick, minimum, { recheckIntervalMs = 60000 } = {}) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No session token' });

    const session = sessions.get(token);
    if (!session) return res.status(401).json({ error: 'Invalid session' });

    // Re-check balance if the cached check is stale
    const now = Date.now();
    if (now - session.lastBalanceCheck > recheckIntervalMs) {
      const stillHolds = await checkBalance(session.address, tick, minimum);
      if (!stillHolds) {
        sessions.delete(token);
        return res.status(403).json({ error: 'Token balance no longer sufficient' });
      }
      session.lastBalanceCheck = now;
    }

    req.gateAddress = session.address;
    next();
  };
}

// Protected routes
app.get('/content/song/:id',
  requireToken('ALBUMTOKEN', '1'),
  (req, res) => {
    // Serve the song — req.gateAddress is the verified holder
    res.json({ streamUrl: generateSignedUrl(req.params.id, req.gateAddress) });
  }
);

app.get('/content/book/:id',
  requireToken('BOOKTOKEN', '1', { recheckIntervalMs: 300000 }), // 5-min cache for books
  (req, res) => {
    res.json({ chapters: getBookContent(req.params.id) });
  }
);
```

**Tuning `recheckIntervalMs`:** shorter intervals give stronger guarantees that the user still holds the token, but increase explorer API load. For most content-gating scenarios, 60 seconds is a reasonable default. For high-value access (financial data, live events), consider 10–15 seconds. For static content (e-books, documentation), 5 minutes is fine.

### Step 4: Real-Time Balance Invalidation via WebSocket

Instead of polling on a timer, use the SDK's WebSocket API to get instant notifications when a user's balance changes. This lets you revoke access within seconds of a token transfer.

```js
await sdk.connectWs();

// Track all active sessions
function watchSession(sessionToken, address, tick, minimum) {
  const unsub = sdk.onAddress(address, async (event) => {
    if (event.type === 'ADDRESS_UPDATE') {
      const stillHolds = await checkBalance(address, tick, minimum);
      if (!stillHolds) {
        sessions.delete(sessionToken);
        unsub(); // stop watching
        // Optionally: push a notification to the client via their WebSocket
      }
    }
  });

  // Store unsub so we can clean up when the session expires
  const session = sessions.get(sessionToken);
  if (session) session.unsub = unsub;
}
```

### Step 5: Smart Contract-Based Gating (On-Chain)

For use cases where the gating logic itself must be trustless and on-chain — not controlled by a server — deploy a smart contract that checks balances before releasing content hashes or toggling access flags.

```js
// Contract: on-chain token gate
// Deployed via the DEPLOY action
module.exports = {
  initialize: function(xchain) {
    xchain.state.set('owner', xchain.getSourceAddress());
    // requiredTick and minimumAmount are set via configure()
  },

  // Owner sets the gating rules
  configure: function(xchain) {
    var caller = xchain.getSourceAddress();
    if (caller !== xchain.state.get('owner')) {
      throw new Error('Only the owner can configure');
    }
    xchain.state.set('requiredTick', xchain.getInputParam(0));
    xchain.state.set('minimumAmount', xchain.getInputParam(1));
  },

  // Owner registers content (stores a hash or identifier)
  registerContent: function(xchain) {
    var caller = xchain.getSourceAddress();
    if (caller !== xchain.state.get('owner')) {
      throw new Error('Only the owner can register content');
    }
    var contentId = xchain.getInputParam(0);
    var contentHash = xchain.getInputParam(1);
    xchain.state.set('content:' + contentId, contentHash);
  },

  // Anyone can call — contract checks their balance on-chain
  accessContent: function(xchain) {
    var caller = xchain.getSourceAddress();
    var requiredTick = xchain.state.get('requiredTick');
    var minimumAmount = xchain.state.get('minimumAmount');

    var balance = xchain.getBalance(caller, requiredTick);
    if (!balance || xchain.math.smaller(balance, minimumAmount)) {
      throw new Error('Insufficient token balance for access');
    }

    var contentId = xchain.getInputParam(0);
    var contentHash = xchain.state.get('content:' + contentId);
    if (!contentHash) {
      throw new Error('Content not found');
    }

    // Emit a message back to the caller with the content hash
    // The caller's off-chain app reads this from the indexer
    xchain.emit.message({
      destination: caller,
      memo: 'access:' + contentId + ':' + contentHash,
    });
  }
};
```

**When to use on-chain vs off-chain gating:**

| Scenario | Approach |
|---|---|
| Web app serving media (music, video, e-books) | **Off-chain** — server checks balance, serves content |
| Proving access rights to a third party trustlessly | **On-chain** — contract verifies balance, emits proof |
| Physical access (event entry, venue) | **Off-chain** — QR code + challenge-response at the door |
| DAO/governance feature unlock | **On-chain** — contract checks balance before executing logic |
| Content where the creator doesn't run a server | **On-chain** — contract holds content hashes, verifies holders |

### End-to-End Example: Token-Gated Music Platform

Putting it all together — a music platform where listeners must hold an artist's token to stream songs:

```js
const express = require('express');
const crypto = require('crypto');
const bitcoinMessage = require('bitcoinjs-message');
const { bignumber, largerEq } = require('mathjs');
const XChainSDK = require('xchain-sdk');

const app = express();
app.use(express.json());

const sdk = new XChainSDK({ hubUrl: process.env.XCHAIN_HUB_URL });
const sessions = new Map();
const challenges = new Map();

// --- Auth endpoints ---

app.post('/auth/challenge', (req, res) => {
  const { address } = req.body;
  const nonce = crypto.randomBytes(32).toString('hex');
  const message = `Stream access\nAddress: ${address}\nNonce: ${nonce}\nTime: ${Date.now()}`;
  challenges.set(nonce, { address, message, timestamp: Date.now() });
  setTimeout(() => challenges.delete(nonce), 5 * 60 * 1000);
  res.json({ message, nonce });
});

app.post('/auth/verify', async (req, res) => {
  const { nonce, signature } = req.body;
  const challenge = challenges.get(nonce);
  if (!challenge) return res.status(400).json({ error: 'Invalid or expired challenge' });
  challenges.delete(nonce);

  try {
    if (!bitcoinMessage.verify(challenge.message, challenge.address, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch {
    return res.status(401).json({ error: 'Verification failed' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { address: challenge.address, lastCheck: Date.now() });
  res.json({ sessionToken: token });
});

// --- Gated content ---

async function checkBalance(address, tick, minimum) {
  const balances = await sdk.explorer.getBalances({ address });
  const entry = balances.find(b => b.tick === tick);
  if (!entry) return false;
  return largerEq(bignumber(entry.amount), bignumber(minimum));
}

// Each album maps to a token tick
const ALBUM_TOKENS = {
  'album-001': { tick: 'ROCKALBUM', minimum: '1' },
  'album-002': { tick: 'JAZZALBUM', minimum: '1' },
};

app.get('/stream/:albumId/:trackNum', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Login required' });

  const album = ALBUM_TOKENS[req.params.albumId];
  if (!album) return res.status(404).json({ error: 'Album not found' });

  // Re-check balance every 60 seconds
  if (Date.now() - session.lastCheck > 60000) {
    const holds = await checkBalance(session.address, album.tick, album.minimum);
    if (!holds) {
      sessions.delete(token);
      return res.status(403).json({ error: `Must hold ${album.tick} to stream` });
    }
    session.lastCheck = Date.now();
  }

  // Serve a time-limited signed URL to the audio file
  const signedUrl = generateSignedStreamUrl(req.params.albumId, req.params.trackNum);
  res.json({ streamUrl: signedUrl, expiresIn: 3600 });
});

app.listen(3000);
```

### Security Considerations

- **Always verify wallet ownership.** A balance check without signature verification is trivially bypassed — anyone can look up a whale's address and claim it.
- **Use short-lived signed URLs for content delivery.** Don't serve raw file paths. Generate URLs that expire (e.g., via S3 presigned URLs or a CDN token) so that a shared link stops working.
- **Re-check balances periodically.** A user might transfer their tokens away after logging in. The `recheckIntervalMs` parameter controls this tradeoff.
- **Consider transfer-lock tokens.** If your use case requires that holders cannot sell or transfer the token (e.g., membership credentials), set `TRANSFER_LOCK` on the token at issuance. This eliminates the "transfer tokens away after the check" problem entirely.
- **Rate-limit the challenge endpoint.** Without rate limiting, an attacker can generate unlimited challenge strings.
- **Use HTTPS.** Signatures and session tokens must travel over encrypted connections.

---

## Pattern 4: DEX Frontend

Display the order book and allow users to place and cancel orders.

```js
// Fetch all open orders for a trading pair
async function getOrderBook(giveTick, getTick) {
  const allOrders = await sdk.explorer.getOrders({ tick: giveTick, limit: 100 });
  const open = allOrders.filter(o => o.status === 'open');

  const buys = open.filter(o => o.give_tick === getTick && o.get_tick === giveTick);
  const sells = open.filter(o => o.give_tick === giveTick && o.get_tick === getTick);

  // Sort: best price first
  sells.sort((a, b) => Number(a.get_amount) / Number(a.give_amount) -
                       Number(b.get_amount) / Number(b.give_amount));
  buys.sort((a, b) => Number(b.give_amount) / Number(b.get_amount) -
                      Number(a.give_amount) / Number(a.get_amount));

  return { buys, sells };
}

// Place a sell order: offer 100 MYTOKEN for 500 XCHAIN
async function placeSellOrder(publicKey, utxos) {
  const action = sdk.order({
    giveCoin: 'BTC',
    giveTick: 'MYTOKEN',
    giveAmount: '100',
    getCoin: 'BTC',
    getTick: 'XCHAIN',
    getAmount: '500',
    expiration: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
  });

  const psbt = await sdk.encoder.createPSBT({ action, publicKey, utxos });
  return psbt; // return to user's wallet for signing
}

// Cancel an order
async function cancelOrder(orderActionIndex, publicKey, utxos) {
  const action = sdk.order({
    version: 1,
    orderActionIndex,
    memo: 'Cancelled via DEX UI',
  });
  const psbt = await sdk.encoder.createPSBT({ action, publicKey, utxos });
  return psbt;
}
```

---

## Pattern 5: Airdrop Tool

Distribute tokens to a list of addresses in one transaction.

```js
async function executeAirdrop(recipients, tick, amountPerAddress, publicKey, utxos) {
  // Step 1: Create an address LIST
  const listAction = sdk.list({
    type: 2, // ADDRESS list
    items: recipients,
  });
  const listPsbt = await sdk.encoder.createPSBT({ action: listAction, publicKey, utxos });
  const listTxid = await signAndBroadcast(listPsbt.psbt);
  await waitForConfirmation(listTxid);

  // Step 2: Get the list's ACTION_INDEX
  const listActions = await sdk.explorer.getActions({ txid: listTxid });
  const listActionIndex = listActions[0].action_index;

  // Step 3: Execute the AIRDROP
  const airdropAction = sdk.airdrop({
    tick,
    amount: amountPerAddress,
    list: listActionIndex,
  });
  const airdropPsbt = await sdk.encoder.createPSBT({
    action: airdropAction,
    publicKey,
    utxos: refreshedUtxos, // fetch new UTXOs after list tx
  });
  const airdropTxid = await signAndBroadcast(airdropPsbt.psbt);
  await waitForConfirmation(airdropTxid);

  console.log(
    `Airdropped ${amountPerAddress} ${tick} to ${recipients.length} addresses`
  );
  return airdropTxid;
}
```

AIRDROP charges XCHAIN gas proportional to the number of addresses on the list. Ensure the sender holds enough XCHAIN before calling.

---

## Pattern 6: Portfolio Tracker

Aggregate all token balances for a set of addresses.

```js
async function buildPortfolio(addresses) {
  const portfolio = {};

  await Promise.all(
    addresses.map(async address => {
      const balances = await sdk.explorer.getBalances({ address, limit: 100 });
      for (const { tick, amount } of balances) {
        portfolio[tick] = portfolio[tick] || { total: '0', holders: [] };
        portfolio[tick].holders.push({ address, amount });

        const { add, bignumber } = require('mathjs');
        portfolio[tick].total = add(
          bignumber(portfolio[tick].total),
          bignumber(amount)
        ).toString();
      }
    })
  );

  return portfolio;
}

const myAddresses = [
  'bc1qaddress1...',
  'bc1qaddress2...',
  'bc1qaddress3...',
];

const portfolio = await buildPortfolio(myAddresses);
Object.entries(portfolio).forEach(([tick, data]) => {
  console.log(`${tick}: ${data.total} across ${data.holders.length} addresses`);
});
```

---

## Error Handling Best Practices

```js
async function withRetry(fn, retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Attempt ${attempt} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
}

// Wrap any explorer call
const token = await withRetry(() => sdk.explorer.getToken({ tick: 'MYTOKEN' }));
```

Distinguish between network errors (retry) and protocol errors (don't retry):

```js
async function safeGetToken(tick) {
  try {
    return await sdk.explorer.getToken({ tick });
  } catch (err) {
    if (err.status === 404) return null;  // token does not exist
    throw err;                             // network/server error — let it propagate
  }
}
```

---

## Polling for State Changes

The explorer is polled, not pushed. Build a lightweight event loop:

```js
class BlockPoller {
  constructor(sdk, onNewBlock) {
    this.sdk = sdk;
    this.onNewBlock = onNewBlock;
    this.lastBlock = 0;
  }

  async start(intervalMs = 15000) {
    while (true) {
      try {
        // Check the latest block via any action query
        const recent = await this.sdk.explorer.getActions({ page: 1, limit: 1 });
        if (recent.length && recent[0].block_index > this.lastBlock) {
          this.lastBlock = recent[0].block_index;
          await this.onNewBlock(this.lastBlock);
        }
      } catch (err) {
        console.error('Polling error:', err.message);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
}

const poller = new BlockPoller(sdk, async blockIndex => {
  console.log('New block:', blockIndex);
  // Check for new payments, order fills, dispenser events, etc.
});
poller.start(10000);
```

---

## Pattern 7: Real-Time State Tracking with WebSocket

Instead of polling the explorer REST API, use the WebSocket API for instant event-driven updates.

### When to Use WebSocket vs Polling

| Use Case | Approach |
|---|---|
| Dashboard showing live block count | **WebSocket** — `onBlock()` |
| Trading bot reacting to order matches | **WebSocket** — `onCoinpayRequired()` |
| One-time balance lookup | **REST** — `getBalances()` |
| Periodic report generation | **REST** — poll on a schedule |
| Real-time portfolio tracker | **WebSocket** — `onAddress()` with snapshot |

### Example: Event-Driven COINPay Bot

```js
const { XChainSDK } = require('xchain-sdk');

const sdk = new XChainSDK({
    network: 'bitcoin-mainnet',
    explorerUrl: 'explorer.xchain.io'
});

await sdk.connectWs();

// React instantly to COINPay obligations
sdk.onCoinpayRequired('1BotAddress...', async (event) => {
    const { payee_address, coin_amount, expiration } = event.data;

    // Check deadline
    const deadline = new Date(expiration * 1000);
    if (deadline < new Date()) {
        console.log('Obligation already expired, skipping');
        return;
    }

    // Construct and broadcast COINPAY
    const tx = await sdk.coinpay({
        order_match_action_index: event.data.order_match_action_index
    }, { pubkey: process.env.PUBKEY });

    console.log('COINPay sent:', tx.psbt);
});
```

### Example: Live Dashboard

```js
await sdk.connectWs();

// Network overview
sdk.onBlock((event) => {
    updateBlockHeight(event.data.block_index);
    updateActionCount(event.data.action_count);
});

// Watch specific token
sdk.onToken('PEPE', (event) => {
    updateTokenSupply(event.data.supply);
    updateHolderCount(event.data.holders);
});

// Watch market
sdk.onMarket('PEPE', 'BTC', (event) => {
    updatePrice(event.data.last_price);
    updateVolume(event.data.volume_24h);
});
```

See the [SDK WebSocket documentation](../components/sdk/WEBSOCKET.md) for the full API reference.

---

## Next Steps

- [Regtest_Development.md](Regtest_Development.md) — build and test locally
- [Query_The_Explorer.md](Query_The_Explorer.md) — full explorer API reference
- [Batch_Operations.md](Batch_Operations.md) — multi-action efficiency patterns

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
