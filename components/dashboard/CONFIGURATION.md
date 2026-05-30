<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# xchain-dashboard — Configuration

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `7800` | TCP port the dashboard listens on |
| `HOST` | `0.0.0.0` | Bind address |
| `AUTH_REQUIRED` | _(unset)_ | Set to `true`, `1`, `yes`, or `on` to enable session-based login. Without it the dashboard runs in open/LAN mode with a synthetic admin user attached to every request |
| `XCHAIN_DASHBOARD_PLUGINS` | _(unset)_ | Comma-separated list of **absolute paths** to plugin entry-point files (see Plugin Discovery below) |
| `SESSION_SECRET` | _(auto)_ | Express-session signing secret. When unset, a secret is generated on first boot and persisted at `data/session-secret` (mode 0600). Setting this env var overrides the file |
| `SESSION_SECURE_COOKIE` | _(unset)_ | Set to `true`, `1`, `yes`, or `on` to mark the session cookie `Secure` (HTTPS-only). Required when the dashboard is behind a TLS-terminating reverse proxy |

## MariaDB Setup

Database credentials are not set via env vars. They are collected by the first-run setup wizard at `/setup` and written to `data/config.json`. This file is gitignored and created on first run.

The dashboard uses three tables in the configured MariaDB database:

| Table | Purpose |
|---|---|
| `users` | User accounts (username, bcrypt password_hash, role, display_name, avatar) |
| `sessions` | Express-session store (session id, user id, data, expiry) |
| `user_audit` | Append-only audit log of authenticated mutations |

The tables are created automatically if they do not exist.

## Plugin Discovery

Plugins are discovered via the `XCHAIN_DASHBOARD_PLUGINS` environment variable:

```bash
XCHAIN_DASHBOARD_PLUGINS=/abs/path/to/plugin-a,/abs/path/to/plugin-b npm start
```

Each entry is an absolute path that is `require()`d at startup. The resolved module must export a **manifest object** with the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Unique plugin identifier |
| `mountPath` | string | yes | Absolute URL prefix (must start with `/`); the plugin's Express router is mounted here |
| `router` | Router \| null | yes | An `express.Router()` or `null` if the plugin has no routes |
| `sidebar` | array | yes | Sidebar entry descriptors to merge into the host chrome; may be `[]` |
| `settings` | array | yes | Settings-page contributions; may be `[]` |
| `register` | function \| null | no | Async lifecycle hook called with the host context object (`ctx`) after the router is mounted |
| `settingsSchema` | array \| null | no | Schema-driven settings definitions; each entry: `{ key, type, default, category, label, description, restartHint?, sensitive? }` |
| `settingsStore` | object \| null | no | Required when `settingsSchema` is provided; must implement `getSchema`, `getRaw`, `getAll`, `setMany`, `reset` |
| `settingGroups` | object \| null | no | Group metadata keyed by group slug: `{ [slug]: { label, description, order } }` |

### Plugin Contract Details

- `mountPath` must be a string starting with `/` (e.g. `/my-plugin`).
- Paths under `<mountPath>/static/` are automatically exempted from the auth gate — serve plugin CSS, JS, and images there.
- The `register(ctx)` hook receives the host context; see [README.md](./README.md) for the full `ctx` shape.
- Plugins are loaded in the order they appear in `XCHAIN_DASHBOARD_PLUGINS`. Sidebar entries are merged in that order.

### Bundled Monitor Plugin

A network monitor plugin (`monitor/`) is always loaded regardless of `XCHAIN_DASHBOARD_PLUGINS`. It provides a live view of platform services running on the host machine and is mounted at `/monitor`.

## Data Directory

At runtime, `data/` holds files that are gitignored and generated on first use:

| Path | Contents |
|---|---|
| `data/config.json` | MariaDB credentials written by the setup wizard |
| `data/session-secret` | Auto-generated session signing secret (mode 0600) |
| `data/avatars/` | User avatar uploads |

## Access Log

Requests are logged to `logs/dashboard.log` (one line per request: ISO timestamp, method, status code, elapsed ms, URL, username). Static assets and `/health` are suppressed from the log.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
