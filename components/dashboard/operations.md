<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Dashboard: Operations

## First Run

1. Install dependencies with `npm install` on Node.js 22 or later.
2. Start the host: `AUTH_REQUIRED=1 npm start`. It listens on `PORT` (default 7800) and `HOST` (default `0.0.0.0`).
3. Open `/setup` from the machine itself. Give the wizard a MariaDB host, port, user, password, and database name. It tests the connection, creates the database and tables if they are missing, seeds the first admin, and writes `data/config.json`.
4. Sign in at `/login` with the admin account the wizard created.

The wizard latches once `data/config.json` carries `setupCompletedAt`. It cannot be re-run, which is deliberate: an open setup endpoint on a live deployment is a way to reseed an admin.

Two deployment shapes skip the wizard:

- **Configured from the environment.** Set the `XCHAIN_DB_*` variables, start the host, and run `npm run auth:seed` to create the first admin. The command prints a one-time password.
- **Provisioned by a script from another machine.** Set `XCHAIN_SETUP_ALLOW_REMOTE=1` (and `XCHAIN_SETUP_ALLOW_NO_CSRF=1` when driving the API directly) for the duration of the provisioning run, then unset both.

## Running Behind a Proxy

The shipped topology is one Apache reverse-proxy hop in front of the dashboard. That count must match reality, because the client IP derived from it feeds the login and setup rate limiters and the audit log.

- Fewer hops declared than exist: every visitor arrives as the proxy, so all of them share one rate-limit bucket and the audit trail records the proxy's address.
- More hops declared than exist: a caller supplies its own address, walks past the per-IP limiters by rotating it, and writes whatever it likes into the audit trail.

Set `TRUST_PROXY_HOPS` to the real number, `0` for a directly exposed deployment. A malformed value is refused at boot, and a production-like start that is riding on the default logs a warning.

## Pages and Endpoints

### Host

| Path | Method | Purpose |
|---|---|---|
| `/` | GET | Welcome page |
| `/health` | GET | Liveness probe |
| `/setup` | GET | First-run wizard, with `/api/setup/status`, `/api/setup/test-db`, and `/api/setup/initialize` behind it. Public until setup completes, then closed. |
| `/login`, `/logout` | GET, POST | Session login and logout, throttled per IP |
| `/profile` | GET, POST | Own profile, password change, avatar upload and clear |
| `/users` | GET | User administration page |
| `/api/users` | GET, POST | List and create users |
| `/api/users/:id` | GET, PUT, DELETE | Read, update, delete a user |
| `/api/users/:id/password` | PUT | Set another user's password (admin) |
| `/api/users/:id/avatar` | POST, DELETE | Manage another user's avatar |
| `/settings` | GET | Settings page, including plugin-contributed schemas |
| `/api/settings/save`, `/api/settings/reset/:key`, `/settings/reset-all` | POST | Persist and reset settings |
| `/servers` | GET | Pushed host metrics overview |
| `/servers/:hostname` | GET | One host, with `series.json` and `snapshot.json` companions |
| `/servers/admin` | GET, POST | Add, regenerate, and delete watched hosts and their tokens |
| `/api/server-monitor/ingest` | POST | Agent metrics ingest (public, token-authenticated) |
| `/api/versions` | GET | Version information for the running host |

### Monitor plugin, mounted at `/monitor`

| Path | Purpose |
|---|---|
| `/monitor/` | Service health overview |
| `/monitor/status`, `/monitor/healthz` | Machine-readable status and liveness |
| `/monitor/api/series`, `/monitor/api/events` | Series data for the charts, and event submission |
| `/monitor/chains` | Per-chain heights, lag, and stall reasons |
| `/monitor/flow` | Pipeline flow view |
| `/monitor/oracles` | Price-oracle feeds, current and pending values |
| `/monitor/staking` | Validator stake and capability bonds |
| `/monitor/contracts`, `/monitor/contract/:coin/:env/:idx` | Contract activity |
| `/monitor/protocol` | Protocol parameter view |
| `/monitor/integrity` | Cross-validator hash comparison across `XCHAIN_SYNC_SOURCES` |
| `/monitor/census`, `/monitor/validator/:pubkey` | Validator census and detail |
| `/monitor/timeline`, `/monitor/changes` | Observed state transitions |
| `/monitor/alerts` | Alert inbox, with acknowledge and resolve |
| `/monitor/api/alerts/test` | Dry run or real send across configured channels |

### CI-status plugin, mounted at `/ci`

| Path | Purpose |
|---|---|
| `/ci/` | Board of recent GitHub Actions runs per repository |
| `/ci/repo/:name`, `/ci/api/repo/:name` | One repository's history, incidents, and flaky scores |
| `/ci/api/status`, `/ci/healthz` | Machine-readable board state and liveness |
| `/ci/refresh` | Force an immediate poll |

## Alerting

The engine records every alert in the inbox whether or not a delivery channel is configured, so `/monitor/alerts` is the record even on a deployment that pages nobody. External delivery turns on the moment a channel credential appears in the environment; Telegram and a Discord webhook are the decided channels and are routed on both `warn` and `crit`, email and SMS on `crit` only.

Dispatch is fail-quiet: a channel with no credential is skipped rather than throwing mid-alert. Because a silent skip is easy to miss, the engine announces the gaps once at boot with a `[xchain-monitor] alert wiring:` banner naming every missing variable, and repeats the banner on the alerts page. It prints names, never values.

To check the wiring without paging anyone, use the **Dry run** button on `/monitor/alerts`, or `POST /monitor/api/alerts/test?dry=1`. It resolves the routing and reports which channels would deliver, with no outbound request. **Send test** performs a real delivery.

## Host Metrics Agent

`server-monitor/` in the repository is a self-contained POSIX shell agent. It needs no Node.js, installs to `/usr/local/share/server-monitor`, and pushes CPU, memory, disk, and network samples to the dashboard's ingest endpoint.

Install it on a watched host from a checkout:

```bash
sudo ./server-monitor/install.sh
```

A one-line remote install (fetching the script directly by URL) is not offered publicly, because xchain-dashboard's source is not publicly distributed.

Register the host first on `/servers/admin`. The page issues a bearer token and prints the matching install snippet, using `DASHBOARD_INGEST_URL` as the base. Only the token's SHA-256 hash is stored, so a lost token is regenerated rather than recovered, and the token is bound to the hostname it was issued for.

Ingest is rate-limited per IP (`MONITOR_INGEST_RATE_LIMIT`, 60 per minute by default) and caps the request body at 256 KB. A deployment that wants a second gate in front of the endpoint can set `MONITOR_INGEST_SECRET`, after which every agent must also send a matching `x-ingest-secret` header.

## Retention

| Data | Setting | Default |
|---|---|---|
| Pushed host snapshots | `XC_MONITOR_RETENTION_DAYS` | 7 days |
| Persisted CI runs | `XCHAIN_CI_RETENTION_DAYS` | 90 days |

Snapshot pruning runs on a timer started at boot; CI pruning runs on each poll. `XC_MONITOR_RETENTION_DAYS` is validated at startup and a bad value stops the process, because the earlier behaviour of falling back to zero turned pruning off silently while the process looked healthy.

## Logs

Requests are appended to `logs/dashboard.log`, one line per request: timestamp, method, status, duration, path, and user. Static assets and probe paths (`/health`, `/favicon`, `/styleguide`, `/images`, `/avatars`) are suppressed, so the log stays a record of what operators did.

## Testing

```bash
npm run ci              # host, monitor, and CI-status suites in order
npm test                # host suite only
npm run test:monitor    # monitor plugin only
npm run test:ci-status  # CI-status plugin only
npm run coverage        # c8 across all three
```

Node.js 22 is required; the suites are the release gate.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every page renders a "database unreachable" panel | MariaDB is down or the credentials in `data/config.json` are wrong | Fix the database or correct the file, then restart |
| `/setup` returns 404 or refuses the request | Setup already completed, or the caller is not local | Expected. Use `npm run auth:seed` for account recovery, or set `XCHAIN_SETUP_ALLOW_REMOTE=1` deliberately |
| Pages load unstyled | The styleguide asset could not be read | The static cache serves the last good copy; check the filesystem under `public/` |
| Login works but every visitor shares a rate-limit bucket | `TRUST_PROXY_HOPS` declares fewer hops than exist | Set it to the real proxy depth |
| Alerts appear in the inbox but nothing is delivered | No channel credential is configured | Read the boot banner or the alerts page, both name the missing variables |
| The integrity page reports "single source" | `XCHAIN_SYNC_SOURCES` is unset or lists one URL | List two or more validator sync URLs |
| The CI board is empty and explains it needs a token | No GitHub token in the environment | Set `XCHAIN_CI_GITHUB_TOKEN` with `repo` and `actions:read` scope |
| A monitor rail reports stale rather than failing | A probe timed out | Raise `XCHAIN_MONITOR_HTTP_TIMEOUT_MS` or fix the upstream service |

## Related

- [Configuration](configuration.md): every variable and its default
- [Architecture](architecture.md): middleware order, plugin contract, tables
- [Monitoring](../../operations/monitoring.md): platform-wide monitoring practice
- [Troubleshooting](../../operations/troubleshooting.md): platform-wide troubleshooting

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
