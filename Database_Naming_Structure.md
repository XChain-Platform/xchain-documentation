# XChain Platform Specification

**Copyright © 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**  

Licensed under the **Dankest Community License**  
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).  

You may not use, modify, or distribute this material except in compliance with the License.  
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)

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