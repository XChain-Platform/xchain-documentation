<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform - Database Naming Structure

The XChain Platform follows the following database naming structure :

XChain_`{CHAIN}`\_`{NETWORK}`\_`{COMPONENT}`

# Chains

| Chain    | Name   |
---------- | ------ |
| Bitcoin  | `BTC`  |
| Dogecoin | `DOGE` |
| Litecoin | `LTC`  |

# Networks

| Network | Name      |
--------- | --------- |
| Mainnet | `Mainnet` |
| Testnet | `Testnet` |
| Regtest | `Regtest` |

# Components

| Component       | Name      |
----------------- | --------- |
| Encoder/Decoder | `Decoder` |
| XChain Indexer  | `Indexer` |

# Examples

## Bitcoin Database Names
- `XChain_BTC_Mainnet_Decoder`
- `XChain_BTC_Testnet_Decoder`
- `XChain_BTC_Regtest_Decoder`
- `XChain_BTC_Mainnet_Indexer`
- `XChain_BTC_Testnet_Indexer`
- `XChain_BTC_Regtest_Indexer`

## Litecoin Database Names
- `XChain_LTC_Mainnet_Decoder`
- `XChain_LTC_Testnet_Decoder`
- `XChain_LTC_Regtest_Decoder`
- `XChain_LTC_Mainnet_Indexer`
- `XChain_LTC_Testnet_Indexer`
- `XChain_LTC_Regtest_Indexer`

## Dogecoin Database Names
- `XChain_DOGE_Mainnet_Decoder`
- `XChain_DOGE_Testnet_Decoder`
- `XChain_DOGE_Regtest_Decoder`
- `XChain_DOGE_Mainnet_Indexer`
- `XChain_DOGE_Testnet_Indexer`
- `XChain_DOGE_Regtest_Indexer`

# Column and Field Naming

## Transaction identifiers: `tx_hash` vs `txid`

The platform uses two distinct identifiers for on-chain transactions. They are
not interchangeable, and one of them is consensus-bound, so the distinction must
be respected in columns, wire fields, and API responses.

| Identifier | Meaning | Where |
| ---------- | ------- | ----- |
| `tx_hash` | The hash of the on-chain transaction that **carries or is the XChain action** being processed or referenced. Consensus-bound: it is part of the `request_id` and `CALL_ID` preimages and the synthetic XEXEC `TX_HASH`, so it cannot be renamed without a flag-day. | Indexer and explorer persisted rows, the public explorer REST/JSON-RPC, ACTION-derivation preimages, the decoder's `mempool_transactions` (the candidate action-carrying tx). |
| `txid` (and `*_txid` columns such as `anchor_txid`) | A native-coin (BTC/LTC/DOGE) transaction id **referenced as data by an action**, not the action-carrying transaction itself: a payment, a DOGE anchor publish, a cross-chain match settlement, an x402 payment. Mirrors Bitcoin Core's `txid` RPC field at the node boundary. | `coinpays.txid`, `anchor_txid`, cross-chain match settlement ids, x402 payment ids, encoder output, the obfuscation-key derivation. |

Rule of thumb: if it is the transaction an action was decoded from (or a consensus
derivation over it), it is `tx_hash`; if it is some other coin transaction the
action points at, it is `txid` (or a `<thing>_txid` column). In JavaScript the
camelCase `txHash` is the same identifier as `tx_hash`.

Never name the action-carrying transaction hash `txid` or `tx_id`, and never name a
referenced native-coin payment, anchor, or settlement id `tx_hash`.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
