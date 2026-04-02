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

Check whether a user holds a minimum token balance before granting access to a feature or resource.

```js
const { bignumber, largerEq } = require('mathjs');

async function checkAccess(address, requiredTick, minimumAmount) {
  const balances = await sdk.explorer.getBalances({ address });
  const entry = balances.find(b => b.tick === requiredTick);
  if (!entry) return false;
  return largerEq(bignumber(entry.amount), bignumber(minimumAmount));
}

// Express middleware
function requireTokenBalance(tick, minimum) {
  return async (req, res, next) => {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });

    const hasAccess = await checkAccess(address, tick, minimum);
    if (!hasAccess) {
      return res.status(403).json({
        error: `Must hold at least ${minimum} ${tick}`,
      });
    }
    next();
  };
}

// Apply to a route
app.get('/premium-content',
  requireTokenBalance('MYTOKEN', '100'),
  (req, res) => res.json({ content: '...' })
);
```

Importantly: balance checks are advisory. A user could transfer tokens away after the check. For strong guarantees, require the user to sign a challenge message with the address holding the tokens.

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

## Next Steps

- [REGTEST_DEVELOPMENT.md](REGTEST_DEVELOPMENT.md) — build and test locally
- [QUERY_THE_EXPLORER.md](QUERY_THE_EXPLORER.md) — full explorer API reference
- [BATCH_OPERATIONS.md](BATCH_OPERATIONS.md) — multi-action efficiency patterns

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
