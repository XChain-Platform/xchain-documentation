<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Testnet Cross-Chain Pair: Bitcoin Testnet and Litecoin Testnet

A recipe for an operator who already runs a testnet validator per [Run a Validator](./run-a-validator.md). It adds a Litecoin testnet indexer beside your Bitcoin testnet one, places a crossing pair of cross-chain `ORDER` actions, and reads the settlement from the public explorer.

> **Settlement needs the live federation.** Your indexers never match or settle a cross-chain trade on their own. The validator federation matches the two offers, signs one match record with a `cross_chain`-capability quorum (2f+1), and each chain's indexer then releases its escrow from that record. If the live testnet federation has fewer than 2f+1 validators serving `cross_chain`, the orders in this recipe stay open and nothing settles. A stack of your own does not substitute for the federation. See [Cross-Chain DEX](../protocol/cross-chain-dex.md) for the model.

## Prerequisites

⬜ A testnet validator installed and running per [Run a Validator](./run-a-validator.md), including the BTC testnet indexer from its Step 5  
⬜ Commands run from `~/xchain-node`, the directory the CLI reads its `.env` from  
⬜ Disk and time for a second chain: the Litecoin testnet stack restores from a bootstrap, then syncs the remainder  

## Step 1: install both testnet indexer stacks

The Bitcoin testnet stack is the one from Step 5 of the validator guide. Run it again only if you skipped it:

```bash
xchain-node install all bitcoin testnet
```

Install the Litecoin testnet stack beside it:

```bash
xchain-node install all litecoin testnet
```

Each chain gets its own coin node, decoder, indexer, encoder and UTXO tracker. The hub, explorer and MariaDB are shared, so the second install reuses the ones already running. See [Deployment](./deployment.md) for the per-chain layout.

## Step 2: confirm the hub mirror settings

An indexer settles a cross-chain match only from the finalized match record and capability snapshots that the hub mirror delivers into its own database. Without the mirror the match never reaches the indexer, and settlement waits forever.

The settings that matter on each indexer are:

| Name | Role |
|---|---|
| `HUB_DB_SYNC_ENABLED` | Turns the hub mirror on. `xchain-node` sets it to `true` on every indexer it installs. |
| `HUB_DB_NAME`, `HUB_DB_USER` | The database the mirror writes into. `xchain-node` points them at the indexer's own database. |
| `HUB_SEED_URLS` | Comma-separated hub feed URLs the indexer subscribes to; `default` expands to the network's built-in seeds. When set, the pinned `HUB_API_URL` is omitted. |
| `HUB_API_URL` | The single pinned hub feed URL, used when `HUB_SEED_URLS` is unset. |
| `HUB_FEED_API_KEY` | Read-only credential for the feed; readers fall back to `HUB_API_KEY`. |

For the exact semantics see [XChain Node configuration](../components/node/configuration.md) and the [indexer configuration](../components/indexer/configuration.md). Set any non-default value in `~/xchain-node/.env`, which is where the CLI reads host settings from.

The Bitcoin indexer also needs to reach the other chains it credits from; see "Wire each bridge destination to its origin indexer" in [Run a Validator](./run-a-validator.md#wire-each-bridge-destination-to-its-origin-indexer). Check that both indexers are synced before you place anything:

```bash
curl https://explorer.xchain.io/TBTC/api/status
curl https://explorer.xchain.io/TLTC/api/status
```

The status route is described in [Explorer API](../components/explorer/api.md). Compare each indexer's tip with its chain's before you continue.

## Step 3: fund a maker on each chain

A cross-chain `ORDER` escrows its GIVE side on the posting chain, so each chain needs a maker address holding both coin for fees and the token it gives.

1. Create one address per chain and send each testnet coin from a faucet, as in [Step 3 of Run a Validator](./run-a-validator.md#step-3-fund-the-two-addresses). The fee figures in that step are for Bitcoin testnet; budget the Litecoin side from the encoder's quote at the time.
2. On each chain, issue and mint a token for the maker to give, using the SDK actions in [SDK actions](../components/sdk/actions.md) (`sdk.issue` then `sdk.mint`). Use the `bitcoin-testnet` network string for the BTC maker and `litecoin-testnet` for the LTC maker; see [SDK configuration](../components/sdk/configuration.md).
3. Read the balance back from the explorer before continuing:

```bash
curl https://explorer.xchain.io/TBTC/api/balances/<btc-maker-address>
curl https://explorer.xchain.io/TLTC/api/balances/<ltc-maker-address>
```

## Step 4: place a crossing ORDER pair

Follow the cross-chain flow in [Cross-Chain Swap](../developer-guide/cross-chain-swap.md) for building, signing and broadcasting an action, and the field list in [ORDER](../protocol/actions/order.md) for the cross-chain form. Each order names the other chain as `GET_COIN` and carries a `GET_ADDRESS` on that chain, where the counter-token is released.

Post the first order from the BTC maker:

```js
await sdk.order({
  giveTick: 'BTCSIDE',
  giveAmount: '100',
  getCoin: 'LTC',
  getTick: 'LTCSIDE',
  getAmount: '100',
  getAddress: '<ltc-address-that-receives-LTCSIDE>',
})
```

Then post the crossing order from the LTC maker, with the give and get sides swapped and a `GET_ADDRESS` on Bitcoin testnet. Equal amounts at 1:1 make the price gate cross. The parameter list and the `getCoin` field are documented in [SDK actions](../components/sdk/actions.md).

Both orders must confirm on their own chains before the federation can see them. Find each order's `action_index` with the explorer's `actions` endpoint.

## Step 5: read settlement on the public explorer

Everything below is a public read against the explorer API in [Explorer API](../components/explorer/api.md):

```bash
curl "https://explorer.xchain.io/TBTC/api/orders/<btc-maker-address>/address"
curl "https://explorer.xchain.io/TLTC/api/orders/<ltc-maker-address>/address"
curl "https://explorer.xchain.io/TBTC/api/cross_chain_matches/<query>/match"
curl "https://explorer.xchain.io/TLTC/api/cross_chain_matches/<query>/match"
curl "https://explorer.xchain.io/TBTC/api/cross_chain_settlements/<query>/match"
curl "https://explorer.xchain.io/TLTC/api/cross_chain_settlements/<query>/match"
```

Settled looks like this:

⬜ Each order's `status` leaves `open`  
⬜ A `cross_chain_matches` row names both legs  
⬜ A `cross_chain_settlements` row exists on each chain  
⬜ Each maker's `GET_ADDRESS` holds the counter-token in `balances`  

If the orders stay `open` and no match row appears, the usual causes are, in order: the federation has no 2f+1 `cross_chain` quorum on testnet right now, an indexer is behind its chain tip, or the hub mirror from Step 2 is not delivering.

---

**Copyright &copy; 2025–2026 Dankest, LLC**
