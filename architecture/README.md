<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Architecture

This section describes how the XChain Platform is structured as a system; the data flow from blockchain to query API, the role of each service, and the database design that ties them together. Intended for developers integrating with the platform and operators running it.

| Document | Description |
|---|---|
| [Data Pipeline](./data-pipeline.md) | End-to-end data flow from coin node through decoder, indexer, and explorer |
| [Component Map](./component-map.md) | All 13 services, their roles, and how they connect to each other |
| [Platform Map (interactive)](./platform-map.html) | Zoomable diagram of every service and link, with selectable end-to-end flows (action write path, XCALL, attestation, replication, anchoring) |
| [Platform Map (JSON)](./platform-map.json) | The same graph as machine-readable `{nodes, edges, flows}` for tools and AI agents |
| [Database Design](./database-design.md) | Naming conventions, the three-DB model (decoder + indexer + hub), and schema overview |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
