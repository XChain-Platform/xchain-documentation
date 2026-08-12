<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Components

This section contains documentation for each of the 15 XChain Platform components. Each subdirectory covers the component's role, configuration, API surface, and internal design. Intended for developers and operators who need to understand or work with a specific service.

| Component | Role |
|---|---|
| [encoder](./encoder/) | Encodes XChain ACTION data into PSBT-based blockchain transactions |
| [decoder](./decoder/) | Polls coin nodes, extracts XChain transactions, and writes raw data to MariaDB |
| [indexer](./indexer/) | Reads decoder output, processes ACTION logic, and writes final state to MariaDB |
| [sync](./sync/) | Replicates indexer databases to validators via REST snapshots and WebSocket streaming |
| [vm](./vm/) | Deterministic smart contract execution engine: sandboxed V8 isolates with AST-based gas metering |
| [explorer](./explorer/) | Serves REST and JSON-RPC APIs plus a web UI over the indexer database |
| [hub](./hub/) | Decentralized config oracle, price oracle, cross-chain attestation, SWAP coordinator, PBFT consensus, governance: backed by MariaDB |
| [utxo-tracker](./utxo-tracker/) | Indexes UTXOs from coin nodes and serves address and balance queries |
| [sdk](./sdk/) | Developer SDK for constructing and submitting XChain actions |
| [contracts](./contracts/) | MIT-licensed smart contract template library, patterns, linter CLI, and no-code policy generator |
| [wallet](./wallet/) | Reference self-custodial multi-chain wallet: browser, Chrome extension, and Electron desktop |
| [node](./node/) | CLI tool for installing and managing all platform services as Docker containers |
| [e2e-test](./e2e-test/) | End-to-end Mocha test suite that exercises the full platform stack |
| [regtest-miner](./regtest-miner/) | Auto-mines mempool transactions for regtest development environments |
| [dashboard](./dashboard/) | Operator console: auth, plugin host, network monitor, and CI-status board |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
