<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Regtest Development

Regtest is a fully local, self-contained blockchain environment where you control block production. It is the fastest and safest way to develop and test XChain applications. No real funds at risk, blocks mine on demand, and you can reset everything and start over any time.

---

## What Regtest Provides

- A local Bitcoin (or Litecoin/Dogecoin) node in regtest mode with instant block production
- Full XChain stack: decoder, indexer, explorer, encoder, hub, UTXO tracker
- `xchain-regtest-miner`: auto-mines mempool transactions and exposes a funding API
- An open XCHAIN mint for gas: create the token once, then any address mints what it needs (see [Getting XCHAIN Gas Tokens](#getting-xchain-gas-tokens))
- Zero confirmation latency, blocks appear in seconds, not minutes

---

## Setting Up with xchain-node

`xchain-node` is the CLI tool that installs and manages all services as Docker containers.

```bash
# Install the regtest stack (downloads images, creates containers, starts everything)
xchain-node install master all bitcoin regtest

# Start all services
xchain-node start all bitcoin regtest

# Stop all services
xchain-node stop all bitcoin regtest

# Check service status
xchain-node ps
```

After `install`, all the following services are running locally:

| Service | Default Port | Role |
|---|---|---|
| Bitcoin node (regtest) | 18443 | Coin node |
| xchain-decoder | 3002 | Polls node, writes to Decoder DB |
| xchain-indexer | 3004 | Processes actions, writes to Indexer DB |
| xchain-explorer | 8080 | REST API + web UI |
| xchain-encoder | 3003 | PSBT builder |
| xchain-hub | 10000 | Config oracle |
| xchain-utxo-tracker | 3001 | UTXO/balance queries |
| xchain-regtest-miner | 3005 | Auto-miner + funding API |

---

## Keeping an Idle Chain Available

The explorer refuses to serve a coin whose newest indexed block has aged past a wall-clock threshold, so a frozen replica returns an error instead of passing old data off as current. That threshold is `EXPLORER_TIP_MAX_AGE_S` and it defaults to `21600` seconds (6 hours).

A live chain never reaches it, because blocks keep arriving. Regtest reaches it all the time, because blocks are mined on demand. Leave a dev stack idle overnight and by morning the coin has aged out:

- REST reads return `503` with `{"code": "COIN_DATA_STALE"}`
- WebSocket subscribe and catch-up frames come back as an `error` frame with the same code
- `/{COIN}/api/status` reports `stale: true` and drops the coin from its `available` map, while leaving it in `supported`

Nothing is broken and nothing is lost. Mining one block clears it immediately. To stop it happening at all, switch the gate off for your regtest coin:

| Setting | Effect |
|---|---|
| `EXPLORER_TIP_MAX_AGE_S_RBTC=0` | Disables the tip-age gate for that one coin. `RBTC` is the route code, so use `RLTC` or `RDOGE` for the other regtest chains. |
| `EXPLORER_TIP_MAX_AGE_S=0` | Disables the gate for every coin this explorer serves. |

Prefer the per-coin form. It leaves the gate working for anything else the same instance serves.

On an `xchain-node` stack the setting goes in that coin/network's config file, one `KEY=VALUE` line, then recreate the explorer container so it picks the new environment up:

```bash
# from your xchain-node checkout
echo 'EXPLORER_TIP_MAX_AGE_S_RBTC=0' >> config/bitcoin-regtest

# container environment is fixed when the container is created, so a plain
# restart is not enough
xchain-node install master xchain-explorer bitcoin regtest
```

Running the explorer straight from its repo instead, put the same line in its `.env`.

There is deliberately no built-in regtest exemption. The gate fails closed on purpose, and a rule keyed on a network name would let anything calling itself regtest re-open that hole silently. Disabling it stays an explicit operator setting, per coin, in a file you can read.

---

## Funding Test Addresses

The regtest miner exposes a simple JSON-RPC for funding addresses:

```js
// Fund an address with 1 BTC
async function fundAddress(address, amount = 1.0) {
  const res = await fetch('http://localhost:3005', {
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
  await fetch('http://localhost:3005', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'continue_mining', params: {} }),
  });
}

await mineBlock();
```

---

## Getting XCHAIN Gas Tokens

XCHAIN is the platform gas token. Actions that write to the database charge fees in XCHAIN (an ISSUE costs 1 XCHAIN on regtest), deducted from the acting address's XCHAIN balance.

A fresh regtest chain starts with **no XCHAIN at all**. On mainnet the token is injected by the genesis ledger, and that injection deliberately never runs on regtest, so the token has to be created once per chain. Regtest lifts mainnet's restrictions for exactly this purpose: any funded address may issue the XCHAIN tick, that issue is itself fee-exempt, and once the token exists any address can mint gas freely.

One-time, on a fresh chain (or after a reset), from any funded address:

```js
// Create the XCHAIN token with an open mint window
await sdk.issue({
  tick: 'XCHAIN',
  maxSupply: '100000000',
  maxMint: '100000',   // per-mint cap; keep it high for dev convenience
  decimals: 8,
});
await mineBlock();
```

Then, whenever a test address needs gas, mint it. There is no special holder address or key to find:

```js
await sdk.mint({ tick: 'XCHAIN', amount: '1000' });
await mineBlock();
```

If the ISSUE fails with `invalid: issued by another address`, the token already exists on your chain (something created it earlier); skip straight to minting. This is the same sequence the e2e suite performs: its first run creates XCHAIN if it is missing (`test/initialCheck.test.js` in `xchain-e2e-test`), and every fixture funds itself with a MINT.

### Native-coin fees and oracle prices

Fee-bearing actions can alternatively pay the fee in the native coin (an extra transaction output to the fee destination address) instead of XCHAIN. That path is validated against XCHAIN/USD and COIN/USD oracle prices, and a fresh regtest stack has no oracle publishing, so it fails with `no current oracle price for BTC/USD`. The error means the price is missing, not that the stack is broken.

Either pay fees in XCHAIN (the default, needs no oracle), or seed prices the way the e2e harness does: `test/helpers/nativeFeeHelper.js` in `xchain-e2e-test` writes XCHAIN/USD and COIN/USD rows into the indexer's price snapshots and attaches the native fee output for you.

---

## Connecting the SDK to Regtest

```js
const XChainSDK = require('@dankest-llc/xchain-sdk');

// Hub-based discovery (recommended: hub knows all service ports)
const sdk = new XChainSDK({
  hubUrl: 'http://localhost:10000',
});

// Or hardcode each service
const sdk = new XChainSDK({
  encoderUrl: 'http://localhost:3003',
  explorerUrl: 'http://localhost:8080',
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
curl http://localhost:8080/BTC/api/token/MYTOKEN
curl http://localhost:8080/BTC/api/balances/YOUR_ADDRESS
curl http://localhost:8080/BTC/api/history/MYTOKEN/token
```

If the explorer answers `503 COIN_DATA_STALE` for every endpoint on a coin, the query is fine and the chain has simply gone quiet: see [Keeping an Idle Chain Available](#keeping-an-idle-chain-available).

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
xchain-node stop all bitcoin regtest

# Remove containers and volumes
xchain-node uninstall all bitcoin regtest

# Reinstall fresh
xchain-node install master all bitcoin regtest
xchain-node start all bitcoin regtest
```

This drops all MariaDB data, LevelDB data, and the regtest blockchain, giving you a clean slate.

---

## Next Steps

- [Build_Your_First_Token.md](build-your-first-token.md): your first token against this environment
- [Integration_Patterns.md](integration-patterns.md): structuring test harnesses and production apps
- [Query_The_Explorer.md](query-the-explorer.md): verifying state during development

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
