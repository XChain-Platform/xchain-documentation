<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Hub: Telemetry REST API

Unlike the JSON-RPC methods in [API.md](./API.md), the hub's telemetry endpoints are
plain **REST routes** served on the same hub HTTP port (`HUB_PORT`, e.g. `10000` locally;
`https://hub.xchain.io` in production). They collect and expose the anonymous node-operator
usage census described in [operations/TELEMETRY.md](../../operations/TELEMETRY.md).

There are three routes:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/telemetry` | none | Ingest one anonymous usage ping from a node operator |
| `GET` | `/telemetry/summary` | none | Aggregate-only census (distribution counts) |
| `GET` | `/telemetry/operators` | `x-api-key` | Per-install operator detail (admin) |

All three are governed by the hub's `TELEMETRY_ENABLED` env var (default `true`). When the
hub has telemetry disabled, `POST /telemetry` returns `{"status":"disabled"}` and the two
`GET` routes return `{"enabled":false}`.

> **Privacy:** the raw connecting IP is never stored. At ingest the hub derives a coarse
> `country`/`region` and an optional one-way keyed hash (`ip_hash`, only when
> `TELEMETRY_IP_SALT` is set) from the connection, then discards the IP. See
> [operations/TELEMETRY.md](../../operations/TELEMETRY.md) for the full data policy and the
> collector-side env vars (`TELEMETRY_ENABLED`, `TELEMETRY_RETENTION_DAYS`,
> `TELEMETRY_IP_SALT`, `TELEMETRY_ADMIN_KEY`).

---

## `POST /telemetry`

Accepts a single usage ping from a node operator. Fire-and-forget: the endpoint **always
responds `{"status":"success"}`** once telemetry is enabled, even on an internal error;
so a misbehaving collector can never block or fail the caller's command. The node's own
IP is read only from the connection (the body must not carry it) and is never stored.

**Auth:** none.

**Request body (JSON):** all fields optional except `install_id`. String fields are
clamped to the byte lengths shown; over-length values are truncated, not rejected.

| Field | Type | Max len | Description |
|---|---|---|---|
| `install_id` | string | 36 | **Required.** Anonymous per-install UUID. Used only to dedupe installs. Missing/empty → `400`. |
| `event` | string | None | One of `install`, `update`, `start`, `heartbeat`. Any other value is coerced to `heartbeat`. |
| `node_version` | string | 32 | The `xchain-node` version. |
| `os_platform` | string | 32 | OS platform (e.g. `linux`, `darwin`). |
| `os_release` | string | 64 | OS release string. |
| `arch` | string | 16 | CPU architecture (e.g. `x64`, `arm64`). |
| `docker_version` | string | 32 | Docker engine version. |
| `modules` | array | ≤100 entries | Installed XChain services. Each entry: see below. |

Each `modules[]` entry:

| Field | Type | Max len | Description |
|---|---|---|---|
| `module` | string | 64 | Service name (e.g. `xchain-decoder`). |
| `coin` | string | 16 | Coin the service runs against (e.g. `bitcoin`); empty for chain-agnostic services. |
| `network` | string | 24 | Network (e.g. `mainnet`); empty for chain-agnostic services. |
| `version` | string | 32 | Service version. |
| `running` | boolean | None | Whether the service is currently running. |

**Request:**
```bash
curl -X POST http://localhost:10000/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "install_id":"550e8400-e29b-41d4-a716-446655440000",
    "event":"heartbeat",
    "node_version":"1.4.2",
    "os_platform":"linux",
    "os_release":"6.1.0-18-amd64",
    "arch":"x64",
    "docker_version":"26.1.0",
    "modules":[
      {"module":"xchain-decoder","coin":"bitcoin","network":"mainnet","version":"1.4.2","running":true},
      {"module":"xchain-hub","coin":"","network":"","version":"1.4.2","running":true}
    ]
  }'
```

**Response (`200`):**
```json
{"status":"success"}
```

**Other responses:**
- `400`: `{"error":"install_id is required"}` when `install_id` is missing/empty.
- `200`: `{"status":"disabled"}` when the hub has `TELEMETRY_ENABLED=false`.

---

## `GET /telemetry/summary`

Anonymous, aggregate-only census of node operators. Returns **distribution counts only**
(by version / OS / country / arch / Docker / running module / chain) derived from the
**latest ping per install** within the window. Never returns `install_id`, `ip_hash`,
`region`, or any per-install row; only group tallies. Read-only and safe to expose
publicly (e.g. to an operator dashboard or explorer).

**Auth:** none.

**Query parameters:**

| Name | Type | Default | Range | Description |
|---|---|---|---|---|
| `days` | integer | `30` | `1`–`365` | Trailing window in days. Non-numeric/`<1` → `30`; `>365` is capped to `365`. |

**Request:**
```bash
curl "http://localhost:10000/telemetry/summary?days=30"
```

**Response (`200`):**
```json
{
  "enabled": true,
  "window_days": 30,
  "operators": 128,
  "pings": 412,
  "byVersion":  [{"key":"1.4.2","count":90},{"key":"1.4.1","count":38}],
  "byOs":       [{"key":"linux","count":120},{"key":"darwin","count":8}],
  "byCountry":  [{"key":"US","count":54},{"key":"DE","count":21},{"key":"unknown","count":3}],
  "byArch":     [{"key":"x64","count":110},{"key":"arm64","count":18}],
  "byDocker":   [{"key":"26.1.0","count":70},{"key":"unknown","count":12}],
  "modules":    [{"key":"xchain-decoder","count":88},{"key":"xchain-indexer","count":80}],
  "chains":     [{"key":"bitcoin/mainnet","count":76},{"key":"litecoin/mainnet","count":40}],
  "chainModules": [
    {"coin":"bitcoin","network":"mainnet","module":"xchain-decoder","count":76},
    {"coin":"litecoin","network":"testnet","module":"xchain-indexer","count":12}
  ]
}
```

**Field reference:**

| Field | Type | Description |
|---|---|---|
| `enabled` | boolean | `true` when telemetry collection is on. `false` (with no other fields) when disabled. |
| `window_days` | integer | The effective window after clamping. |
| `operators` | integer | Distinct installs with at least one ping in the window. |
| `pings` | integer | Total pings in the window (activity volume, not unique installs). |
| `byVersion` | array | `{key, count}` tally by `node_version`, descending by count. |
| `byOs` | array | `{key, count}` tally by `os_platform`. |
| `byCountry` | array | `{key, count}` tally by derived country code (`unknown` when absent). |
| `byArch` | array | `{key, count}` tally by `arch`. |
| `byDocker` | array | `{key, count}` tally by `docker_version`. |
| `modules` | array | `{key, count}`: installs running each module (counted once per install). |
| `chains` | array | `{key, count}`: installs running ≥1 module on each `coin/network` (counted once per install). |
| `chainModules` | array | `{coin, network, module, count}`: installs running each `(module, coin, network)` combination. |

A null/empty value in any tallied dimension is reported under the key `unknown`.

**Disabled response (`200`):** `{"enabled":false}`.

---

## `GET /telemetry/operators`

Per-install (per-server) detail. Unlike the aggregate summary this returns
identifying-ish data (`ip_hash`, `region`, and exactly what each server runs), so it is
**fail-closed** behind an admin key. Intended for the operator's own auth-gated dashboard,
never public consumption.

**Auth:** required. Send the hub's `TELEMETRY_ADMIN_KEY` value in the `x-api-key` header.
If `TELEMETRY_ADMIN_KEY` is unset on the hub, or the header does not match, the route
returns `401`. (Set `TELEMETRY_ADMIN_KEY` on the hub to enable this endpoint, see
[operations/TELEMETRY.md](../../operations/TELEMETRY.md).)

**Query parameters:**

| Name | Type | Default | Range | Description |
|---|---|---|---|---|
| `days` | integer | `30` | `1`–`365` | Trailing window in days. Same clamping rules as `/telemetry/summary`. |

**Request:**
```bash
curl "http://localhost:10000/telemetry/operators?days=30" \
  -H "x-api-key: $TELEMETRY_ADMIN_KEY"
```

**Response (`200`):** operators are sorted by `last_seen`, most recent first.
```json
{
  "enabled": true,
  "window_days": 30,
  "operators": [
    {
      "install_id": "550e8400-e29b-41d4-a716-446655440000",
      "first_seen": "2026-05-10T08:00:00.000Z",
      "last_seen": "2026-06-03T09:00:00.000Z",
      "pings": 24,
      "country": "US",
      "region": "CA",
      "ip_hash": "9f86d081884c7d659a2feaa0c55ad015...",
      "node_version": "1.4.2",
      "os_platform": "linux",
      "os_release": "6.1.0-18-amd64",
      "arch": "x64",
      "docker_version": "26.1.0",
      "chains": ["bitcoin/mainnet", "litecoin/mainnet"],
      "modules": ["xchain-decoder", "xchain-hub", "xchain-indexer"]
    }
  ]
}
```

**Field reference (per operator):**

| Field | Type | Description |
|---|---|---|
| `install_id` | string | Anonymous per-install UUID. |
| `first_seen` | string\|null | Earliest ping in the window (ISO 8601). |
| `last_seen` | string | Latest ping in the window (ISO 8601). |
| `pings` | integer\|null | Ping count for this install in the window. |
| `country` | string\|null | Derived country code. |
| `region` | string\|null | Derived coarse region. |
| `ip_hash` | string\|null | One-way keyed network hash (null unless `TELEMETRY_IP_SALT` is set on the hub). |
| `node_version` | string\|null | `xchain-node` version. |
| `os_platform` | string\|null | OS platform. |
| `os_release` | string\|null | OS release string. |
| `arch` | string\|null | CPU architecture. |
| `docker_version` | string\|null | Docker engine version. |
| `chains` | array | Sorted unique `coin/network` pairs the install runs ≥1 running module on. |
| `modules` | array | Sorted unique running module names. |

**Other responses:**
- `401`: `{"error":"Unauthorized"}` when the admin key is unset or the header does not match.
- `200`: `{"enabled":false}` when the hub has `TELEMETRY_ENABLED=false`.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
</content>
</invoke>
