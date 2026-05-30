<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# xchain-dashboard — Operations

## Starting the Dashboard

```bash
cd xchain-dashboard
npm install
npm start                 # listens on PORT (default 7800), binds 0.0.0.0
```

To load plugins:

```bash
XCHAIN_DASHBOARD_PLUGINS=/abs/path/to/plugin npm start
```

To enable authentication:

```bash
AUTH_REQUIRED=true npm start
```

To run on a different port or bind address:

```bash
PORT=8080 HOST=127.0.0.1 npm start
```

## First-Run Setup

On a fresh install with no `data/config.json`, every request redirects to `/setup`. The setup wizard collects MariaDB credentials and writes `data/config.json`. Once complete, `/setup` mutations are locked until restart.

## Seeding an Admin User

After setup, create the initial admin account:

```bash
npm run auth:seed
```

This prints a one-time password to stdout. Log in at `http://<host>:7800/login` with the printed credentials and change the password immediately via `/profile`.

## Health Check

```
GET /health
```

Returns JSON without requiring authentication:

```json
{
  "ok": true,
  "service": "xchain-dashboard",
  "version": "0.1.0",
  "uptime_s": 3600,
  "auth_required": false
}
```

Use this endpoint for monitoring and readiness probes. A `200 ok: true` response means the process is up and Express is handling requests. It does not verify MariaDB connectivity.

## User Management

Authenticated admin users can manage accounts at `/users`:

- **Create user** — username, display name, role (`admin` / `operator` / `viewer`), optional email
- **Edit user** — change role, display name, email, avatar
- **Deactivate user** — removes login access without deleting the audit history
- **Reset password** — admin can set a new password for any user

## Common Operational Tasks

### Rotating the Session Secret

Set `SESSION_SECRET` to a new value and restart. All existing sessions are immediately invalidated and users must log in again. Alternatively, delete `data/session-secret` and restart — a new secret is generated automatically.

### Changing MariaDB Credentials

Edit `data/config.json` directly (or delete it to re-run the setup wizard at `/setup`), then restart the process.

### Adding or Removing a Plugin

Update the `XCHAIN_DASHBOARD_PLUGINS` env var and restart. Plugins are loaded at boot; there is no hot-reload.

### Checking Logs

Access log:

```bash
tail -f logs/dashboard.log
```

Lines are suppressed for static assets and `/health`. Each line format:

```
ISO-TIMESTAMP  METHOD  STATUS  ELAPSEDms  /path  username
```

Process-level errors and plugin load failures go to stdout/stderr.

### Running Behind a Reverse Proxy

If TLS is terminated upstream (nginx, Caddy, etc.), set `SESSION_SECURE_COOKIE=true` so the session cookie is marked `Secure`. Also configure the proxy to pass `X-Forwarded-For` and `X-Forwarded-Proto` headers if you need accurate client IP logging.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
