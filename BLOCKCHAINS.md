# XChain Platform — Supported Blockchains

The XChain Platform is designed to run on any number of blockchains. Adding support for a new blockchain requires only a coin-specific configuration file defining fee schedules, special addresses, and network parameters — the protocol specification, indexer logic, action handlers, and all tooling remain unchanged. The architecture scales horizontally: each blockchain runs its own independent pipeline (decoder, indexer, explorer, UTXO tracker) with its own databases, while a shared hub coordinates cross-chain operations.

## Currently Supported

| Chain | Networks | Coin Node | Native Ticker | Status |
|---|---|---|---|---|
| **Bitcoin** | mainnet, testnet, regtest | `bitcoind` | `BTC` | Active |
| **Litecoin** | mainnet, testnet, regtest | `litecoind` | `LTC` | Active |
| **Dogecoin** | mainnet, testnet, regtest | `dogecoind` | `DOGE` | Active |

Each chain supports three network types:

| Network | Purpose |
|---|---|
| **Mainnet** | Production network — real value, permanent transactions |
| **Testnet** | Public test network — free test coins, mirrors mainnet behavior |
| **Regtest** | Local regression testing network — instant block generation, fully controlled environment |

## Chain-Specific Differences

The same protocol specification applies across all chains. Chain-specific differences are limited to:

- **Fee amounts** — Issuance fees and DEX listing fees are configured independently per chain
- **Special addresses** — Burn, gas, and donation addresses are unique per chain and per network
- **Block timing** — Each chain has different block intervals and confirmation characteristics
- **Address formats** — Each chain uses its own address encoding (e.g., `1...` / `bc1...` for Bitcoin, `L...` / `ltc1...` for Litecoin, `D...` for Dogecoin)
- **Transaction parsing** — Litecoin requires stripping the HogEx flag; Dogecoin requires stripping AuxPoW headers before parsing with bitcoinjs-lib

Each chain and network combination runs its own independent set of services with its own databases. Tokens on Bitcoin are separate from tokens on Litecoin — they share the same protocol rules but maintain independent state. Cross-chain interaction is possible through the SWAP action coordinated by the hub.

## Adding New Blockchains

Any Bitcoin-compatible blockchain can be added to the XChain Platform. The requirements are:

1. The blockchain must support a Bitcoin-compatible JSON-RPC interface (standard `getblock`, `getrawtransaction`, etc.)
2. Transactions must be parseable by bitcoinjs-lib (with optional pre-processing for chain-specific quirks)
3. A coin-specific configuration file must be created defining fee schedules and special addresses per network

If you represent a blockchain project and would like to add support for your chain to the XChain Platform, please get in contact at [https://dankest.llc](https://dankest.llc).

## Regtest and Private Blockchains

The **regtest** (regression test) network type is a locally-controlled blockchain environment where blocks are generated on demand rather than through proof-of-work mining. Regtest is essential for development and testing, but its capabilities extend far beyond that.

### Development and Testing

In regtest mode, the xchain-regtest-miner service monitors the mempool and mines blocks automatically — typically waiting a few seconds to batch transactions before generating a block. This enables:

- **Instant confirmation** — No waiting for miners; transactions are confirmed in seconds
- **Free transactions** — Regtest coins have no real value, so developers can test freely
- **Reproducible environments** — Start from block 0 with a known state every time
- **Automated testing** — The xchain-e2e-test suite runs entirely on regtest, creating wallets, broadcasting actions, and verifying state programmatically

### Custom Networks for Private Deployments

Regtest networks are fully isolated — they have no connection to any public blockchain. This makes them ideal for creating **custom private blockchain deployments** where an organization controls the entire network:

- **Private token platforms** — Companies can run XChain on a private regtest network to issue and manage tokens in a controlled environment with no public blockchain exposure
- **Internal asset tracking** — Track ownership, transfers, and audit trails for internal assets using the full XChain token lifecycle (ISSUE, SEND, MINT, DESTROY, SWEEP)
- **Controlled trading** — Use the built-in DEX (ORDER, DISPENSER) for internal markets with configurable fee structures
- **Data notarization** — Use BROADCAST and FILE actions to create tamper-proof records on a private chain
- **Custom governance** — Allow/block lists, minting windows, and lockable parameters provide fine-grained control over token behavior

A private deployment runs the same software stack as a public deployment — the only difference is that the coin node runs in regtest mode and the network is not connected to any public peers.

> **Note on licensing:** The XChain Platform is released under the **Dankest Community License**, which is based on the Apache License 2.0 with additional terms that **prohibit commercial use without a separate license**. Organizations interested in running the XChain Platform on a private blockchain for commercial purposes should contact [https://dankest.llc](https://dankest.llc) to discuss licensing options.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
