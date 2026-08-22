<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Operations

This section covers everything needed to deploy, configure, monitor, and maintain an XChain Platform node. Intended for node operators and infrastructure engineers responsible for running the platform in production or development environments.

| Document | Description |
|---|---|
| [Deployment](./deployment.md) | How to deploy the full platform stack from scratch |
| [xchain-node CLI Manual](../components/node/operations.md) | Every xchain-node command, option, and parameter |
| [XCHAIN Genesis](./xchain-genesis.md) | One-time fixed-supply XCHAIN issuance and validator reward-pool funding |
| [Docker](./docker.md) | Docker Compose configuration and container management |
| [Configuration](./configuration.md) | All configuration options across each service |
| [API Keys](./api-keys.md) | The platform-wide no-key posture: fail-open with a loud startup warning |
| [Monitoring](./monitoring.md) | Health checks, metrics, and alerting for a running node |
| [Disk Management](./disk-management.md) | Moving a chain's block data or datadir to a larger disk safely |
| [Reorg Handling](./reorg-handling.md) | How the platform detects and recovers from blockchain reorganizations |
| [Upgrading](./upgrading.md) | One command updates everything installed; granular control and rollback |
| [Releases](./releases.md) | Every published train, its component set, and how to install a specific one |
| [Release Process](./release-process.md) | How a release train is cut, signed and published, and how hotfixes ship |
| [Release Signing](./release-signing.md) | The platform release key, and how to verify a download against it |
| [Troubleshooting](./troubleshooting.md) | Common problems and how to diagnose and fix them |
| [Privacy & Telemetry](./telemetry.md) | What anonymous usage data xchain-node sends, and how to turn it off |

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
