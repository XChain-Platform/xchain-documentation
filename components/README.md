<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Components

This section contains documentation for each of the 12 XChain Platform microservices. Each subdirectory covers the component's role, configuration, API surface, and internal design. Intended for developers and operators who need to understand or work with a specific service.

| Component | Role |
|---|---|
| [encoder](./encoder/) | Encodes XChain ACTION data into PSBT-based blockchain transactions |
| [decoder](./decoder/) | Polls coin nodes, extracts XChain transactions, and writes raw data to MariaDB |
| [indexer](./indexer/) | Reads decoder output, processes ACTION logic, and writes final state to MariaDB |
| [indexer-sync](./indexer-sync/) | Replicates indexer databases to validators via REST snapshots and WebSocket streaming |
| [vm](./vm/) | Deterministic smart contract execution engine — sandboxed V8 isolates with AST-based gas metering |
| [explorer](./explorer/) | Serves REST and JSON-RPC APIs plus a web UI over the indexer database |
| [hub](./hub/) | Config oracle and cross-chain action coordinator backed by LevelDB |
| [utxo-tracker](./utxo-tracker/) | Indexes UTXOs from coin nodes and serves address and balance queries |
| [sdk](./sdk/) | Developer SDK for constructing and submitting XChain actions |
| [node](./node/) | CLI tool for installing and managing all platform services as Docker containers |
| [e2e-test](./e2e-test/) | End-to-end Mocha test suite that exercises the full platform stack |
| [regtest-miner](./regtest-miner/) | Auto-mines mempool transactions for regtest development environments |

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
