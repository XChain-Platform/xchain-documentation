<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Regtest Development

Regtest is a fully local, self-contained blockchain environment where you control block production. It is the fastest and safest way to develop and test XChain applications — no real funds at risk, blocks mine on demand, and you can reset everything and start over any time.

---

## What Regtest Provides

- A local Bitcoin (or Litecoin/Dogecoin) node in regtest mode with instant block production
- Full XChain stack: decoder, indexer, explorer, encoder, hub, UTXO tracker
- `xchain-regtest-miner` — auto-mines mempool transactions and exposes a funding API
- Pre-seeded accounts and a GAS address that holds XCHAIN tokens
- Zero confirmation latency — blocks appear in seconds, not minutes

---

## Setting Up with xchain-node

`xchain-node` is the CLI tool that installs and manages all services as Docker containers.

```bash
# Install the regtest stack (downloads images, creates containers, starts everything)
node xchain-node install --regtest

# Start all services
node xchain-node start --regtest

# Stop all services
node xchain-node stop --regtest

# Check service status
node xchain-node status
```

After `install`, all the following services are running locally:

| Service | Default Port | Role |
|---|---|---|
| Bitcoin node (regtest) | 18443 | Coin node |
| xchain-decoder | — | Polls node, writes to Decoder DB |
| xchain-indexer | — | Processes actions, writes to Indexer DB |
| xchain-explorer | 35300 | REST API + web UI |
| xchain-encoder | 35400 | PSBT builder |
| xchain-hub | 35500 | Config oracle |
| xchain-utxo-tracker | 35200 | UTXO/balance queries |
| xchain-regtest-miner | 38332 | Auto-miner + funding API |

---

## Funding Test Addresses

The regtest miner exposes a simple JSON-RPC for funding addresses:

```js
// Fund an address with 1 BTC
async function fundAddress(address, amount = 1.0) {
  const res = await fetch('http://localhost:38332', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'send_funds',
      params: { address, amount },
    }),
  });
  const data = await res.json();
  console.log('Funded:', data);
}

await fundAddress('bc1qtestaddress...', 1.0);
```

Then mine the funding transaction into a block:

```js
async function mineBlock() {
  await fetch('http://localhost:38332', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'continue_mining', params: {} }),
  });
}

await mineBlock();
```

---

## Getting XCHAIN Gas Tokens

XCHAIN is the platform gas token. Actions that write to the database charge fees in XCHAIN. In regtest, the GAS address is pre-configured in each indexer's coin config (`src/configs/BTC.js`) and already holds XCHAIN.

To get XCHAIN into a test address, have the GAS address send some:

```js
// The GAS address's private key is available in the regtest config
// Check xchain-indexer/src/configs/BTC.js for the GAS_ADDRESS value

const sendAction = sdk.send({
  tick: 'XCHAIN',
  amount: '1000',
  destination: 'YOUR_TEST_ADDRESS',
});

const psbt = await sdk.encoder.createPSBT({
  action: sendAction,
  publicKey: 'GAS_ADDRESS_PUBLIC_KEY',
  utxos: gasAddressUtxos,
});

await signAndBroadcastFromGas(psbt.psbt);
await mineBlock();
```

Alternatively, the GAS address can issue XCHAIN to your test address immediately during setup in your test harness — see the e2e test suite for examples.

---

## Connecting the SDK to Regtest

```js
const XChainSDK = require('xchain-sdk');

// Hub-based discovery (recommended — hub knows all service ports)
const sdk = new XChainSDK({
  hubUrl: 'http://localhost:35500',
});

// Or hardcode each service
const sdk = new XChainSDK({
  encoderUrl: 'http://localhost:35400',
  explorerUrl: 'http://localhost:35300',
});
```

---

## Running the E2E Test Suite

The `xchain-e2e-test` service contains a full Mocha test suite that exercises all services end-to-end against the regtest stack.

```bash
cd /path/to/xchain-e2e-test
npm install
npm run api
```

The suite funds addresses, issues tokens, sends, creates dispensers, orders, and swaps, verifying each step via the explorer. Run it after any code change to catch regressions across the whole pipeline.

---

## Debugging

### Check the Decoder Database

The decoder writes raw, unprocessed action records. If a transaction is on-chain but missing from the indexer, check the decoder first:

```sql
-- Connect to XChain_BTC_Regtest_Decoder
SELECT * FROM actions ORDER BY block_index DESC LIMIT 20;
```

### Check the Indexer Database

The indexer processes decoder actions and maintains balances, token state, and order books:

```sql
-- Connect to XChain_BTC_Regtest_Indexer
SELECT * FROM balances WHERE address = 'YOUR_ADDRESS';
SELECT * FROM tokens WHERE tick = 'MYTOKEN';
SELECT * FROM actions ORDER BY action_index DESC LIMIT 20;
```

### Check the Explorer API

If the indexer has data but the explorer doesn't, the explorer may have a query bug. Hit the endpoint directly:

```bash
curl http://localhost:35300/api/token/MYTOKEN
curl "http://localhost:35300/api/balances?address=YOUR_ADDRESS"
curl "http://localhost:35300/api/actions?tick=MYTOKEN"
```

### Service Logs

```bash
# View logs for a service (Docker)
docker logs xchain-decoder --tail 100 -f
docker logs xchain-indexer --tail 100 -f
docker logs xchain-explorer --tail 100 -f
```

### Confirm a Transaction Is in a Block

```bash
# via bitcoin-cli in the regtest container
docker exec xchain-btc-node bitcoin-cli -regtest getrawtransaction YOUR_TXID 1
```

---

## Resetting and Starting Fresh

To wipe all state and start from a clean chain:

```bash
# Stop all services
node xchain-node stop --regtest

# Remove containers and volumes
node xchain-node uninstall --regtest

# Reinstall fresh
node xchain-node install --regtest
node xchain-node start --regtest
```

This drops all MariaDB data, LevelDB data, and the regtest blockchain, giving you a clean slate.

---

## Next Steps

- [BUILD_YOUR_FIRST_TOKEN.md](BUILD_YOUR_FIRST_TOKEN.md) — your first token against this environment
- [INTEGRATION_PATTERNS.md](INTEGRATION_PATTERNS.md) — structuring test harnesses and production apps
- [QUERY_THE_EXPLORER.md](QUERY_THE_EXPLORER.md) — verifying state during development

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
