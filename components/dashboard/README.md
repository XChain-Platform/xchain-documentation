<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Dashboard

## What is xchain-dashboard

xchain-dashboard is the operator console for an XChain Platform deployment. It is a standalone Express application that supplies the parts every internal tool needs (login, sessions, roles, an audit log, a first-run setup wizard, and a shared page chrome) and then lets plugins add the actual pages. Two plugins ship in the repository: the network monitor at `/monitor`, which watches the running services, and the CI-status board at `/ci`, which watches the platform's GitHub Actions runs. Private plugins are loaded from `XCHAIN_DASHBOARD_PLUGINS` without changing the host.

The dashboard is an observer. It reads the hub, explorer, sync, indexer, and UTXO-tracker APIs, and it receives pushed host metrics from the `server-monitor` agent. It never writes protocol state, never holds a key, and no other service depends on it, so it can be restarted, moved, or switched off without touching the pipeline.

It has its own MariaDB database for users, sessions, audit rows, host metrics, monitor events and alerts, and CI runs. Every table is created on demand at startup or at plugin registration, so a fresh deployment needs an empty database and nothing else.

## Features

- **Plugin host**: discovery from `XCHAIN_DASHBOARD_PLUGINS`, manifest validation, router mounting, sidebar merging, and a `register(ctx)` lifecycle hook that hands each plugin the auth, audit, and layout helpers
- **Two auth modes**: full sessions with `admin` / `operator` / `viewer` roles when `AUTH_REQUIRED` is on, or a single-operator LAN mode where every request is a synthetic admin
- **First-run setup wizard**: probes or creates the database, seeds the first admin, writes `data/config.json`, then latches itself off permanently
- **Network monitor**: per-service probes, red/yellow/green thresholds, oracle and staking boards, cross-validator integrity checks, and an alert inbox with Telegram, Discord, webhook, email, and SMS channels
- **CI-status board**: polls GitHub Actions across the org, persists runs, scores flaky workflows, and reports incidents
- **Host metrics ingest**: the vendored `server-monitor/` shell agent pushes CPU, memory, disk, and network samples to `/api/server-monitor/ingest`, authenticated per host by a bearer token stored only as a SHA-256 hash
- **Audit trail**: login, user, and role changes are recorded with the real client IP, derived from a proxy-hop count the operator declares rather than a guess
- **1016 tests** (measured 2026-08-12): host, monitor, and CI-status suites covering auth, sessions, setup, plugin loading, route authorization, output escaping, and ingest

## Documentation

| Document | Description |
|---|---|
| [Architecture](architecture.md) | Middleware order, plugin contract, auth and setup internals, database tables |
| [Configuration](configuration.md) | Environment variables, `data/config.json`, thresholds |
| [Operations](operations.md) | First-run setup, pages and endpoints, the push agent, troubleshooting |

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/XChain-Platform/xchain-dashboard.git
cd xchain-dashboard
npm install
```

Node.js 22 or later is required.

## Quick Start

Start the host and open the setup wizard:

```bash
AUTH_REQUIRED=1 npm start        # listens on PORT (default 7800)
```

Visit `http://127.0.0.1:7800/setup` and give the wizard a MariaDB host, port, and credentials. It creates the database if it does not exist, creates the tables, seeds the first admin account, and writes `data/config.json`. The wizard then latches: once setup has completed, `/setup` is closed for good.

To skip the wizard and configure from the environment instead, set the `XCHAIN_DB_*` variables and seed the first admin from the command line:

```bash
npm run auth:seed                # prints a one-time password
```

Load a private plugin alongside the bundled two:

```bash
XCHAIN_DASHBOARD_PLUGINS=/abs/path/to/some-plugin npm start
```

## Scripts

| Script | Purpose |
|---|---|
| `npm start` | Run the dashboard host |
| `npm run auth:seed` | Create or reset the first admin user |
| `npm test` | Host suite |
| `npm run test:monitor` | Monitor plugin suite |
| `npm run test:ci-status` | CI-status plugin suite |
| `npm run ci` | All three suites in order: the gate |
| `npm run coverage` | c8 coverage across the host and both plugins |

## Dependencies

| Package | Purpose |
|---|---|
| `express` | HTTP server and routing (Express 5) |
| `express-session` | Session cookies, backed by a MariaDB session store |
| `bcryptjs` | Password hashing |
| `mariadb` | Database driver, used with raw parameterized SQL |
| `multer` | Avatar uploads |
| `marked` | Markdown rendering for in-app documents |
| `nodemailer` | Email alert channel |
| `mocha` | Test runner |
| `c8` | Coverage reporting |

## Related

- [Hub](../hub/): config, price, and attestation source the monitor reads
- [Sync](../sync/): the replication service whose `/status` hashes the integrity board cross-checks
- [Explorer](../explorer/): the API the monitor uses for chain and action health
- [Node](../node/): installs and runs the platform services the dashboard watches
- [Telemetry](../../operations/telemetry.md): what the platform reports about itself
- [Monitoring](../../operations/monitoring.md): the operations view of alerting and health

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
