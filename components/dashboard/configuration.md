<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Dashboard: Configuration

The dashboard reads its configuration from two places: `data/config.json`, written by the setup wizard, and the environment. Database settings resolve from the file first, then from the `XCHAIN_DB_*` variables, then fail. Everything else is environment-only.

`data/config.json` holds database credentials and the `setupCompletedAt` stamp that latches the wizard. It is generated at runtime and is never committed.

## Host

| Variable | Default | Description |
|---|---|---|
| `PORT` | `7800` | Listening port |
| `HOST` | `0.0.0.0` | Listening address |
| `AUTH_REQUIRED` | unset | `1`, `true`, `yes`, or `on` enables sessions, login, roles, and the audit log. Anything else, including unset, gives every request a synthetic admin. |
| `SESSION_SECRET` | generated | Session signing secret, ignored with a warning if shorter than 32 characters. When unset, the persisted `data/session-secret` is used, and generated at mode 0600 on first boot, so a restart does not sign everyone out. |
| `SESSION_SECURE_COOKIE` | derived | Forces the `Secure` flag on or off. When unset, the cookie is secure unless `NODE_ENV` is `development`. |
| `NODE_ENV` | unset | Only consulted for the cookie default above |
| `TRUST_PROXY_HOPS` | `1` | Number of reverse-proxy hops to trust when deriving the client IP. Must be an integer from 0 to 10; a malformed value is refused at boot rather than silently treated as 1. |
| `TRUSTED_ORIGINS` | unset | Comma-separated origins accepted by the origin check on state-changing requests, in addition to the request's own host |
| `XCHAIN_DASHBOARD_PLUGINS` | unset | Comma-separated absolute paths to plugin entry points. The bundled monitor and CI-status plugins load regardless. |
| `DEBUG_AUDIT` | unset | When set, audit-write failures are logged instead of being swallowed |

### Database

Used only when `data/config.json` has no database section, which is the case for a deployment that skips the setup wizard.

| Variable | Default | Description |
|---|---|---|
| `XCHAIN_DB_HOST` | `127.0.0.1` | MariaDB host |
| `XCHAIN_DB_PORT` | `3306` | MariaDB port |
| `XCHAIN_DB_USER` | none | MariaDB user |
| `XCHAIN_DB_PASSWORD` | none | MariaDB password |
| `XCHAIN_DB_DATABASE` | none | Database name |

### Setup wizard

| Variable | Default | Description |
|---|---|---|
| `XCHAIN_SETUP_ALLOW_REMOTE` | unset | `1` allows the wizard to be driven from a non-local address. Leave unset unless provisioning is automated from another host. |
| `XCHAIN_SETUP_ALLOW_NO_CSRF` | unset | `1` skips the wizard's CSRF check, for scripted provisioning only |

### Host metrics ingest

| Variable | Default | Description |
|---|---|---|
| `DASHBOARD_INGEST_URL` | `https://dashboard.xchain.io` | Base URL printed in the agent install snippet on the servers page |
| `MONITOR_INGEST_SECRET` | unset | When set, every ingest request must carry a matching `x-ingest-secret` header. Compared in constant time, before any database work. |
| `MONITOR_INGEST_RATE_LIMIT` | `60` | Ingest requests allowed per IP per minute before a `429` |
| `XC_MONITOR_RETENTION_DAYS` | `7` | Days of pushed snapshots to keep. Must be an integer from 1 to 3650; anything else fails at startup rather than silently disabling pruning. |

## Monitor plugin

Upstream endpoints. Defaults target a local development stack.

| Variable | Default | Description |
|---|---|---|
| `XCHAIN_EXPLORER_URL` | `http://127.0.0.1:8080` | Explorer base URL |
| `XCHAIN_SYNC_URL` | `http://127.0.0.1:3006` | Sync base URL |
| `XCHAIN_HUB_URL` | `http://127.0.0.1:10000` | Hub base URL |
| `XCHAIN_SYNC_SOURCES` | unset | Comma-separated (newlines allowed) list of sync base URLs, one per validator or replica. Two or more enable the cross-validator hash comparison on the integrity page; a single source can only ever report "single source". |
| `XCHAIN_INDEXER_URL_BTC` / `_LTC` / `_DOGE` | unset | Per-coin indexer JSON-RPC endpoints for the soft-stall check. Coins left unset are skipped. |
| `XCHAIN_UTXO_TRACKER_URL_BTC` / `_LTC` / `_DOGE` | unset | Per-coin UTXO-tracker endpoints for the halt and reorg check. Coins left unset are skipped. |
| `HUB_API_KEY` | unset | API key for hub endpoints that require one |
| `SYNC_API_KEY` | unset | API key for sync endpoints that require one |
| `XCHAIN_UTXO_TRACKER_API_KEY` | unset | API key for the UTXO tracker |
| `TELEMETRY_ADMIN_KEY` | unset | Admin key for the hub telemetry endpoints |
| `XCHAIN_MONITOR_HTTP_TIMEOUT_MS` | `4000` | Per-probe HTTP timeout. A probe that hangs is reported as unreachable, not as healthy. |

Thresholds.

| Variable | Default | Description |
|---|---|---|
| `XCHAIN_INDEXER_LAG_WARN` | `50` | Indexer block lag that trips a warning. A named stall reason or an unhealthy circuit trips a critical regardless. |
| `XCHAIN_UTXO_TRACKER_LAG_WARN` | `10` | UTXO-tracker block lag that trips a warning |
| `XCHAIN_ANCHOR_BALANCE_WARN` | `30` | Publisher wallet balance in DOGE below which a warning fires. Despite the name, this pair covers **both** the ANCHOR publisher and the ORACLE PRICE v0 publisher, which spend from the same DOGE wallet ([ANCHOR publisher not publishing / DOGE wallet low](../hub/operations.md)), so retuning it re-colours both panels. |
| `XCHAIN_ANCHOR_BALANCE_CRIT` | `10` | Same shared wallet: the balance in DOGE below which a critical fires. Keep the warn value strictly above this one; the critical branch is tested first, so an equal or lower warn value is a state the monitor can never reach. |
| `XCHAIN_CHECKPOINT_INTERVAL_BLOCKS` | `6` | Expected checkpoint cadence in BTC blocks, mirroring the hub's own default. Set it if a hub deployment overrides its interval. |
| `XCHAIN_ORACLE_PUBLISH_COIN` | `DOGE` | Coin whose oracle publish cadence is tracked |
| `XCHAIN_ORACLE_PUBLISH_ENV` | `mainnet` | Network the publish coverage check reads |
| `XCHAIN_ORACLE_PUBLISH_STALL_ROUNDS` | `20` | Missed publish rounds before the rail is reported stalled |
| `XCHAIN_ORACLE_PUBLISH_COVERAGE_GRACE_ROUNDS` | `3` | Rounds of grace before incomplete coverage is reported |

Per-host red/yellow/green thresholds for pushed metrics are stored in `monitor_thresholds` and edited on the settings page, not in the environment.

### Alerting

The alert engine ships armed: `ALERT_ENABLED` defaults on, and every alert is recorded in the inbox at `/monitor/alerts` whether or not a delivery channel exists. External paging stays off until a channel credential is present. Dispatch is fail-quiet at runtime, so the engine announces missing wiring once at boot and again on the alerts page, naming variables and never values.

| Variable | Channel | Description |
|---|---|---|
| `ALERT_ENABLED` | - | `false` silences the engine entirely. On by default. |
| `ALERT_ROUTE_WARN` / `ALERT_ROUTE_CRIT` | - | Comma-separated channel names, overriding the default routing |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | telegram | Primary pager, routed on warn and crit |
| `DISCORD_WEBHOOK_URL` | discord | Incoming-webhook URL, routed on warn and crit |
| `ALERT_WEBHOOK_URL` | webhook | Generic JSON POST target |
| `SMTP_HOST` + `ALERT_EMAIL_TO` | email | Crit only by default |
| `SMTP_PORT` | email | Defaults to `587` |
| `SMTP_USER` + `SMTP_PASS` | email | Omit both for an unauthenticated relay |
| `SMTP_FROM` | email | Falls back to `SMTP_USER` |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM` + `ALERT_SMS_TO` | sms | Crit only by default |

## CI-status plugin

| Variable | Default | Description |
|---|---|---|
| `XCHAIN_CI_GITHUB_TOKEN` | unset | GitHub token with `repo` and `actions:read` scope. `GITHUB_TOKEN` and `GH_TOKEN` are accepted as fallbacks. With no token the poller never starts and the board explains why. |
| `XCHAIN_CI_ORG` | `XChain-Platform` | Organisation or user whose repositories are surveyed |
| `XCHAIN_CI_REPOS` | unset | Explicit repository allowlist. When set, discovery is skipped. |
| `XCHAIN_CI_EXCLUDE` | unset | Repositories to drop from discovery. `.github` is always excluded. |
| `XCHAIN_CI_API_BASE` | `https://api.github.com` | API base, for GitHub Enterprise |
| `XCHAIN_CI_REFRESH_MS` | `180000` | Poll cadence in milliseconds |
| `XCHAIN_CI_HTTP_TIMEOUT_MS` | `8000` | Per-request timeout in milliseconds |
| `XCHAIN_CI_CONCURRENCY` | `6` | Repositories fetched in parallel, sized to stay well inside the authenticated rate limit |
| `XCHAIN_CI_HISTORY_RUNS` | `100` | Runs pulled per workflow per poll: the window the timeline, success rate, and flaky score derive from |
| `XCHAIN_CI_SPARK_RUNS` | `24` | Runs shown in the overview sparkline |
| `XCHAIN_CI_RETENTION_DAYS` | `90` | Persisted run retention; older rows are pruned each poll |
| `XCHAIN_CI_ALERTS` | on | Alerts on red and recovery transitions. Sends only when a channel is configured. |

## Secrets

Every credential above belongs in the deployment's environment file, never in the repository. The monitor prints variable names when wiring is missing and never prints values, and `data/config.json`, `data/session-secret`, and `data/avatars/` are all excluded from version control.

## Related

- [Architecture](architecture.md): how the configuration is consumed
- [Operations](operations.md): first run, pages, and troubleshooting
- [Platform configuration](../../operations/configuration.md): configuration across all services

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
