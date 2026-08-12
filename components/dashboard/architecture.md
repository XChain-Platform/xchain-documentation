<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Dashboard: Architecture

## Overview

The dashboard is one Express application in one process. `bin/dashboard.js` reads `PORT` and `HOST` and calls `start()` in `src/server.js`, which builds the app, mounts the host's own routes, and then hands the remaining surface to plugins. There is no worker, no queue, and no scheduler beyond the plugins' own polling timers.

```
bin/dashboard.js
   |
   v
src/server.js  createApp()
   |
   +-- trust proxy (declared hop count)
   +-- access log            -> logs/dashboard.log
   +-- ingest route          -> POST /api/server-monitor/ingest (own 256 KB body parser)
   +-- express.json (1 MB)
   +-- static cache          -> styleguide CSS, favicon, users page script
   +-- express.static        -> public/, data/avatars/
   +-- setup wizard          -> /setup, /api/setup/*   (public, latches after first run)
   +-- auth                  -> sessions, /login, /logout, role gates
   +-- host routes           -> /, /users, /profile, /health, /servers, /settings
   +-- legacy redirect       -> old un-prefixed plugin URLs
   +-- plugin loader         -> /monitor, /ci, plus XCHAIN_DASHBOARD_PLUGINS
   +-- error pipeline        -> database-unreachable page, otherwise an opaque 500
```

The order is the design. Three parts of it are load-bearing:

- **The ingest route mounts ahead of every application-level JSON parser.** It is the only route an unauthenticated caller can post a body to, so it carries its own 256 KB parser behind its own rate limit and shared-secret gate. Whichever parser sees a body first is the cap that binds, so mounting it later would silently hand the anonymous cap to the setup wizard's 100 KB default.
- **The static cache registers before `express.static`.** The styleguide stylesheet, the favicon, and the users page script are read once into memory, so a stalled network share cannot leave the console unstyled.
- **Host routes mount before the legacy redirect.** `/users` belongs to the host; the redirect only catches prefixes no host route claimed.

## Source Layout

| Path | Responsibility |
|---|---|
| `bin/dashboard.js` | Process entry point: reads `PORT` / `HOST`, calls `start()` |
| `bin/auth-seed.js` | Creates or resets the first admin, printing a one-time password |
| `src/server.js` | Express app factory and middleware order |
| `src/trust-proxy.js` | Resolves the declared proxy-hop count, refusing a malformed value |
| `src/auth/` | Login, sessions, roles, user CRUD, audit log, MariaDB access |
| `src/setup/` | First-run wizard: database probe, creation, first admin, config write |
| `src/chrome/` | Page chrome: layout, sidebar, brand, styleguide-linked styles |
| `src/plugins/loader.js` | Plugin discovery, manifest validation, mounting, sidebar aggregation |
| `src/routes/` | Host routes: welcome, users, profile, health, servers, settings |
| `src/views/` | Host page renderers |
| `src/server-monitor/` | Host-side ingest endpoint, schema, retention, and views |
| `src/static-cache.js` | In-memory cache for the assets a page cannot render without |
| `src/util/escape.js` | Single-pass HTML-entity escape applied to every rendered value |
| `monitor/` | Bundled network-monitor plugin (`xchain-monitor`, mounted at `/monitor`) |
| `ci-status/` | Bundled CI-status plugin (`xchain-ci-status`, mounted at `/ci`) |
| `server-monitor/` | Vendored POSIX shell push-agent, installed on the hosts being watched |
| `public/` | Styleguide, images, page scripts |
| `data/` | Runtime state: `config.json`, `session-secret`, `avatars/` (never committed) |

`server-monitor/` and `src/server-monitor/` are different things that share a name: the first is the agent that runs on a watched host and needs no Node.js, the second is the endpoint that receives what the agent sends.

## Plugin Contract

A plugin is a path that `require()`s to a manifest object. The loader validates the manifest before mounting anything, so a malformed plugin fails loudly at boot instead of half-registering.

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Unique plugin id, used in logs and settings keys |
| `mountPath` | yes | URL prefix the router is mounted at, for example `/monitor` |
| `router` | yes | Express router serving everything under `mountPath` |
| `sidebar` | yes | Entries merged into the shared chrome navigation |
| `settings` | yes | Settings schema surfaced on the host's settings page |
| `register(ctx)` | no | Lifecycle hook called with auth, audit, and layout helpers |

Loading rules:

- The two bundled plugins are passed in as `extraManifests` and load in the same single pass as the `XCHAIN_DASHBOARD_PLUGINS` entries, so the aggregated sidebar and settings are complete before the first page renders.
- Any path under `<mountPath>/static/` is public, so a plugin can serve its own client-side JavaScript and CSS without tripping the auth gate.
- `register(ctx)` is where a plugin creates its tables and starts its pollers. The monitor plugin registers its event and alert tables; the CI-status plugin migrates `ci_status_runs` and starts the GitHub poller, which is skipped entirely when no token is configured.

## Authentication

`AUTH_REQUIRED` selects between two modes, and the difference is total.

| | `AUTH_REQUIRED` on | unset or false |
|---|---|---|
| Session | `express-session`, rolling cookie `xcr.sid`, 30 days | none |
| Login | `/login`, `/logout`, throttled per IP | none |
| `req.user` | The signed-in account | Synthetic admin, username `operator` |
| Roles | `admin` (3), `operator` (2), `viewer` (1) | Always admin |
| Audit rows | Written | Not written |

The open mode exists for a single-operator machine on a trusted LAN. It is not a weaker login, it is no login, so anything reachable on the network is reachable by anyone.

Passwords are hashed with bcrypt. Sessions are stored in MariaDB, not in process memory, so a restart does not sign everyone out and two processes can serve the same deployment. The session cookie is marked `Secure` unless `NODE_ENV` is `development`, and `SESSION_SECURE_COOKIE` overrides that either way.

The audit log records the client IP taken from `req.ip`, which is only correct if the proxy-hop count is correct. Declaring too few hops collapses every visitor into the proxy's address, which merges every rate-limit bucket; declaring too many lets a caller write its own address into the audit trail and rotate past the limiters. `src/trust-proxy.js` therefore refuses a malformed value at boot and warns when a production-like start is riding on the default of one hop.

## Setup Wizard

`/setup` and `/api/setup/*` mount before auth, because a fresh installation has no user to log in as. The wizard:

1. Tests a database connection with the host, port, user, and password given in the form.
2. Creates the database and tables when they do not exist.
3. Seeds the first admin account.
4. Writes `data/config.json` with the connection settings and a `setupCompletedAt` stamp.
5. Latches: with that stamp present, the wizard's mutating endpoints are closed permanently.

Setup is rate-limited to 10 requests per minute per IP, is CSRF-protected, and rejects non-local callers unless the deployment explicitly opts out. The two escape hatches (`XCHAIN_SETUP_ALLOW_REMOTE`, `XCHAIN_SETUP_ALLOW_NO_CSRF`) exist for automated provisioning and are documented in [Configuration](configuration.md).

Database configuration resolves in a fixed order: `data/config.json` first, then the `XCHAIN_DB_*` environment variables, then an error. A deployment that never runs the wizard is therefore configured entirely from the environment.

## Database

One MariaDB database holds everything. Every table is created idempotently, either at startup or when the owning plugin registers, so there is no migration step to run by hand.

| Table | Created by | Contents |
|---|---|---|
| `users` | host auth | Accounts, bcrypt password hashes, roles |
| `sessions` | host auth | Session store rows for `express-session` |
| `user_audit` | host auth | Login, user, and role change events with client IP |
| `monitor_servers` | server-monitor schema | Watched hosts and their hashed ingest tokens |
| `monitor_snapshots` | server-monitor schema | Pushed CPU, memory, disk, and network samples |
| `monitor_thresholds` | server-monitor schema | Per-host red/yellow/green boundaries |
| `monitor_events` | monitor plugin | Health-state transitions observed by the probes |
| `monitor_alerts` | monitor plugin | The alert inbox, including acknowledgement state |
| `ci_status_runs` | CI-status plugin | Persisted GitHub Actions runs |

Access is raw parameterized SQL through the `mariadb` package. There is no ORM. Snapshot rows are pruned on a retention timer; CI runs are pruned on each poll.

## Metrics Ingest

`POST /api/server-monitor/ingest` is public by design: the agents that call it are shell scripts on other machines with no session cookie. Each watched host has a bearer token whose SHA-256 hash is stored in `monitor_servers`, and the token is bound to the hostname it was issued for, so a leaked token cannot be used to overwrite another host's series. The route is rate-limited, caps the body at 256 KB, and can require an additional shared secret through `MONITOR_INGEST_SECRET`.

## Output Escaping

Every value that reaches a page goes through the single-pass escape in `src/util/escape.js`, including values the dashboard did not author: hub responses, explorer fields, and CI job names all arrive from elsewhere and are all treated as hostile. The escape runs in one regex pass precisely so it cannot double-encode the ampersand it just introduced, and the monitor's view tests pin that behaviour.

## Related

- [Configuration](configuration.md): every environment variable and its default
- [Operations](operations.md): pages, endpoints, and the push agent
- [Hub](../hub/): the config and attestation source the monitor reads
- [Sync](../sync/): the replication status the integrity board cross-checks

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
