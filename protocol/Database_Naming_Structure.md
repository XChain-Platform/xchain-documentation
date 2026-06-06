<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Specification

**Copyright © 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**  

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)  
with a commercial license available for proprietary use.  

You may use, modify, and distribute this material under the terms of the License.  
See the [licensing overview](https://docs.xchain.io/legal/licensing).

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

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
