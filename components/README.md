# Components

This section contains documentation for each of the 10 XChain Platform microservices. Each subdirectory covers the component's role, configuration, API surface, and internal design. Intended for developers and operators who need to understand or work with a specific service.

| Component | Role |
|---|---|
| [encoder](./encoder/) | Encodes XChain ACTION data into PSBT-based blockchain transactions |
| [decoder](./decoder/) | Polls coin nodes, extracts XChain transactions, and writes raw data to MariaDB |
| [indexer](./indexer/) | Reads decoder output, processes ACTION logic, and writes final state to MariaDB |
| [explorer](./explorer/) | Serves REST and JSON-RPC APIs plus a web UI over the indexer database |
| [hub](./hub/) | Config oracle and cross-chain action coordinator backed by LevelDB |
| [utxo-tracker](./utxo-tracker/) | Indexes UTXOs from coin nodes and serves address and balance queries |
| [sdk](./sdk/) | Developer SDK for constructing and submitting XChain actions |
| [node](./node/) | CLI tool for installing and managing all platform services as Docker containers |
| [e2e-test](./e2e-test/) | End-to-end Mocha test suite that exercises the full platform stack |
| [regtest-miner](./regtest-miner/) | Auto-mines mempool transactions for regtest development environments |
