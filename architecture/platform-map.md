<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Platform Map

An interactive map of the whole XChain Platform: every service, library, database, and external system as nodes, the runtime links between them as edges, and the paths a request actually takes as selectable flows.

Pick a flow in the right-hand panel to light up its complete path through the diagram, step by step: submitting an action from the wallet, the block confirmation pipeline, a smart-contract deploy and execute, a cross-chain call (XCALL), the attestation round-trip, PRICE oracle rounds, validator replication, state anchoring on Dogecoin, the regtest e2e campaign, and the plain read path. Hover any component or link for what it does; click a node to trace just its connections; drag to pan and scroll to zoom.

<iframe src="platform-map-app.html" title="Interactive XChain platform map" style="width:100%;height:78vh;min-height:540px;border:1px solid rgba(139,150,173,.35);border-radius:8px;background:#0e1117" loading="lazy"></iframe>

[Open the map full screen](platform-map-app.html)

## Machine-readable version

The same graph is published as one JSON document for tools and AI agents: [`platform-map.json`](platform-map.json). It carries typed `nodes` (service, library, database, external, actor), `edges` with a `kind` for each link (RPC, async broadcast, DB read/write, in-process library), and `flows` whose ordered `steps` reference node and edge ids, so an agent can walk any end-to-end path without parsing prose. See [Building AI Agents on XChain](../ai-agents/README.md) for everything else the platform publishes for agents.

## How it relates to the other architecture pages

- The [Component Map](component-map.md) describes each of the services in depth: purpose, inputs, outputs, storage, and communication.
- The [Data Pipeline](data-pipeline.md) walks the core decode-and-index path in prose.
- This page is the graph view over the same system: one picture, with the flows made explicit.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
