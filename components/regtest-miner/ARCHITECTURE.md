<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Regtest Miner — Architecture

## Position in the Data Pipeline

The regtest miner is testing infrastructure that sits alongside the coin node in the data pipeline. It drives block production in regtest environments, which is required for the decoder, indexer, and all downstream services to function during development and testing:

```
                    ┌────────────────────────┐
                    │  xchain-regtest-miner  │
                    │  (auto-mines blocks)   │
                    └───────────┬────────────┘
                                │ generatetoaddress
                                ▼
                    ┌────────────────────────┐
                    │  Coin Node (regtest)   │
                    │  bitcoind / litecoind  │
                    │  / dogecoind           │
                    └───────────┬────────────┘
                                │ JSON-RPC
                    ┌───────────▼────────────┐
                    │    xchain-decoder      │
                    │ (extracts XChain txs)  │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │    xchain-indexer      │
                    │  (processes ACTIONs)   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │    xchain-explorer     │
                    │  (serves API + UI)     │
                    └────────────────────────┘
```

## Internal Components

```
┌─────────────────────────────────────────────────────────┐
│                  xchain-regtest-miner                    │
│                                                          │
│  ┌────────────┐    ┌──────────────────────┐              │
│  │  api.js     │    │ XChainRegtestMiner   │              │
│  │  (Express)  │───►│  - prepareWallet()   │              │
│  │  JSON-RPC   │    │  - start() loop      │              │
│  │  6 methods  │    │  - fillMempool()     │              │
│  └────────────┘    │  - setMiningTime()   │              │
│                     └─────────┬────────────┘              │
│                               │                           │
│                     ┌─────────▼────────────┐              │
│                     │ BlockchainConnector   │              │
│                     │  15 RPC methods       │              │
│                     │  axios + Basic Auth   │              │
│                     └─────────┬────────────┘              │
└───────────────────────────────┼──────────────────────────┘
                                │ HTTP JSON-RPC
                                ▼
                    ┌───────────────────────┐
                    │  Coin Node (regtest)  │
                    │  bitcoind / litecoind │
                    │  / dogecoind          │
                    └───────────────────────┘
```

### Source Files

| File | Lines | Purpose |
|---|---|---|
| `src/api.js` | ~170 | Environment validation, Express server, JSON-RPC routing, miner lifecycle |
| `src/XChainRegtestMiner.js` | ~489 | Mining loop, wallet management, fillMempool, timer control |
| `src/BlockchainConnector.js` | ~486 | JSON-RPC 2.0 client wrapping 15 Bitcoin Core methods with retry logic |

## Mining Loop

The miner's core loop runs every 1 second (`CHECK_BLOCK_DELAY_MS`):

1. Poll `getrawmempool` to check for unconfirmed transactions
2. If new transactions are detected (mempool length increased):
   - On first detection: start the initial timer (default 30s) and the extension timer (default 5s)
   - On subsequent new transactions: reset only the extension timer
3. If either timer expires: call `generatetoaddress(1, walletAddress)` to mine a block, then reset all timers
4. If the mempool empties: clear all timers (no mining needed)

The loop skips mempool polling when `keepMining` is `false`, allowing external control of mining via the API.

```
┌─────────────────────────────────────────────────┐
│                  Mining Loop                     │
│                                                  │
│  ┌──────────┐     ┌──────────────────────────┐  │
│  │  Sleep    │────►│ Check keepMining flag    │  │
│  │  1 second │     └──────────┬───────────────┘  │
│  └──────────┘                │                   │
│       ▲            ┌─────────▼──────────┐        │
│       │            │ getrawmempool      │        │
│       │            └─────────┬──────────┘        │
│       │                      │                   │
│       │            ┌─────────▼──────────┐        │
│       │            │ New txs detected?  │        │
│       │            └──┬──────────────┬──┘        │
│       │           Yes │              │ No        │
│       │     ┌─────────▼────┐   ┌─────▼────────┐ │
│       │     │ Start/reset  │   │ Timer expired?│ │
│       │     │ timers       │   └──┬─────────┬──┘ │
│       │     └──────────────┘  Yes │         │ No │
│       │              ┌────────────▼───┐     │    │
│       │              │ Mine 1 block   │     │    │
│       │              │ Reset timers   │     │    │
│       │              └────────────────┘     │    │
│       └─────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

## Wallet Lifecycle

On startup, `prepareWallet` follows a 4-branch decision tree:

1. **Wallet already loaded** — `getWalletInfo` succeeds → get a new address, check balance
2. **Wallet exists but not loaded** — `getWalletInfo` fails, `loadWallet` succeeds → get a new address
3. **No wallet** — both fail → `createWallet`, get a new address
4. **Balance check** — if balance is zero and chain height ≤ 100, mine 101 blocks for coinbase maturity; if height > 100, mine 1 block

## fillMempool Stress Testing

The `fillMempool` method constructs real Bitcoin transactions for mempool load testing:

1. Generate a BIP39 mnemonic and derive a BIP32 HD wallet (`m/44'/0'/0'/0`)
2. Request funding from the node wallet in chunks of up to 2,500 outputs each
3. Mine blocks to confirm funding transactions
4. Construct PSBTs distributing funds to derived addresses (one PSBT per chunk)
5. Sign, finalize, and broadcast each PSBT
6. Construct and broadcast individual spending transactions back to the main address

Mining is paused during this process (`keepMining = false`) and automatically restored in a `finally` block. A mutex prevents concurrent `fillMempool` calls.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
