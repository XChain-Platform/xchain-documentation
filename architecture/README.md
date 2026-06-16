<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Architecture

This section describes how the XChain Platform is structured as a system; the data flow from blockchain to query API, the role of each service, and the database design that ties them together. Intended for developers integrating with the platform and operators running it.

| Document | Description |
|---|---|
| [Data Pipeline](./Data_Pipeline.md) | End-to-end data flow from coin node through decoder, indexer, and explorer |
| [Component Map](./Component_Map.md) | All 10 services, their roles, and how they connect to each other |
| [Database Design](./Database_Design.md) | Naming conventions, the dual-DB model (decoder + indexer), and schema overview |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
