# Architecture

This section describes how the XChain Platform is structured as a system — the data flow from blockchain to query API, the role of each service, and the database design that ties them together. Intended for developers integrating with the platform and operators running it.

| Document | Description |
|---|---|
| [Data Pipeline](./DATA_PIPELINE.md) | End-to-end data flow from coin node through decoder, indexer, and explorer |
| [Component Map](./COMPONENT_MAP.md) | All 10 services, their roles, and how they connect to each other |
| [Database Design](./DATABASE_DESIGN.md) | Naming conventions, the dual-DB model (decoder + indexer), and schema overview |
