<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# xchain-dashboard

Generic Express dashboard host. Provides a shared web shell — auth, user management, audit log, styleguide, and a plugin-loading framework — that any platform tool can extend by dropping in an Express router alongside a manifest object.

## Role in the Platform

xchain-dashboard is an **optional infrastructure service**. The core data pipeline (decoder → indexer → explorer) does not depend on it. Its purpose is to give operator-facing tools a consistent place to live: a single authenticated web interface with shared navigation, user accounts, and audit logging instead of each tool shipping its own login screen.

Plugins plug in at a `mountPath` they declare in their manifest. The host merges their sidebar entries into the global chrome and mounts their router. Multiple plugins can coexist in one process.

A bundled **monitor plugin** (`monitor/`) is always active, exposing a live view of the services running on the host machine.

## What the Host Provides

| Feature | Notes |
|---|---|
| Login / logout | Session-based; bcrypt passwords; 30-day rolling cookie |
| User management | `/users` — create, edit, deactivate, avatar upload |
| Role system | `admin`, `operator`, `viewer`; routes opt in via `requireAuth` / `requireRole` |
| Audit log | Every authenticated mutation is recorded in `user_audit` |
| First-run setup wizard | `/setup` — collects MariaDB credentials before any route is reachable |
| Styleguide | `/styleguide` — shared CSS/component reference for plugin authors |
| Health endpoint | `GET /health` — JSON liveness probe, no auth required |
| Plugin loader | Env-var-driven; validates manifest shape; mounts router + merges sidebar |

## Plugin API

Each plugin must export a manifest object from its entry-point file:

```js
module.exports = {
  name:      'my-plugin',           // unique identifier
  mountPath: '/my-plugin',          // absolute URL prefix; router mounted here
  router:    require('./routes'),   // express.Router() or null
  sidebar:   [...],                 // sidebar entry descriptors
  settings:  [...],                 // settings-page contribution (may be [])
  register(ctx) { ... },           // optional async lifecycle hook
};
```

The `register(ctx)` hook receives:

| ctx field | Type | Description |
|---|---|---|
| `ctx.auth` | object | `requireAuth`, `requireRole`, `isAuthEnabled` |
| `ctx.userService` | object | User CRUD backed by MariaDB |
| `ctx.auditService` | object | Audit log writes |
| `ctx.db` | pool | Raw MariaDB connection pool |
| `ctx.layout` | function | Page-chrome wrapper for server-rendered HTML |
| `ctx.chrome` | object | Full chrome barrel (tables, sidebar helpers, etc.) |

Paths under `<mountPath>/static/` are automatically exempted from the auth gate so plugins can serve their own CSS and JS without login redirects.

## See Also

- [CONFIGURATION.md](./CONFIGURATION.md) — environment variables, plugin format, MariaDB setup
- [OPERATIONS.md](./OPERATIONS.md) — starting the dashboard, health checks, common tasks

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
